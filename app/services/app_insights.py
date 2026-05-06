"""
Thin wrapper over the Application Insights REST API.

Used by the unadvertised ``/metrics`` dashboard to run KQL queries
against the shared ``NoteHelper_Telemetry`` workspace. Authentication
uses ``DefaultAzureCredential`` so whoever runs the app uses their own
``az login``. Users without read access on the App Insights resource
will get HTTP 403 responses; the dashboard renders that as a per-card
error rather than crashing the page.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests
from azure.identity import AzureCliCredential, DefaultAzureCredential

logger = logging.getLogger(__name__)


class AppInsightsError(Exception):
    """Raised on auth or HTTP failures from the App Insights REST API."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


# App ID for the NoteHelper_Telemetry component (parsed from the
# connection string in telemetry_shipper.py - same App Insights resource
# we ship to).
APP_ID = '84a49533-d8f7-4720-a3cf-9da762f11a64'

# The App Insights resource lives in the BlaineCorp tenant. We pin the
# tenant when acquiring tokens so guest users (e.g. a Microsoft account
# invited as a guest) get a token issued by the resource's home tenant
# instead of their own. Without this pin, az login -> Microsoft tenant
# would mint a token that App Insights rejects with HTTP 403.
TENANT_ID = '96d12531-723e-46c1-842b-0480739c7419'

_API_BASE = 'https://api.applicationinsights.io/v1/apps'
_TOKEN_SCOPE = 'https://api.applicationinsights.io/.default'

_credential = None
_cached_token: Optional[str] = None
_token_expiry: float = 0
_DEFAULT_TIMEOUT_SECONDS = 10


def _get_token() -> str:
    """Acquire a token for the App Insights data plane. Cached until expiry."""
    global _credential, _cached_token, _token_expiry

    now = time.time()
    if _cached_token and now < _token_expiry - 60:
        return _cached_token

    if _credential is None:
        # Prefer AzureCliCredential for local dev - faster, no prompts.
        # Pin the tenant so guest users get a BlaineCorp-issued token.
        try:
            cred = AzureCliCredential(tenant_id=TENANT_ID)
            cred.get_token(_TOKEN_SCOPE)
            _credential = cred
        except Exception:
            _credential = DefaultAzureCredential(
                additionally_allowed_tenants=[TENANT_ID],
            )

    try:
        token_obj = _credential.get_token(_TOKEN_SCOPE)
    except Exception as exc:
        raise AppInsightsError(
            f'Failed to acquire App Insights token: {exc}'
        ) from exc

    _cached_token = token_obj.token
    _token_expiry = token_obj.expires_on
    return _cached_token


def reset_token_cache() -> None:
    """Drop the in-process token + credential cache.

    Call this after the user has done a fresh ``az login`` so the next
    request acquires a token from the new disk cache instead of reusing
    the stale in-memory one.
    """
    global _credential, _cached_token, _token_expiry
    _credential = None
    _cached_token = None
    _token_expiry = 0


def is_auth_error(exc: 'AppInsightsError') -> bool:
    """True if the error looks like 'user is not signed in to BlaineCorp'.

    Used by the metrics UI to decide whether to surface the
    "sign in to BlaineCorp" button. We treat any 401/403 as an auth
    issue, plus token-acquisition failures (which never get a status code).
    """
    if exc.status_code in (401, 403):
        return True
    msg = str(exc).lower()
    return (
        'failed to acquire' in msg
        or 'invalid_grant' in msg
        or 'interaction_required' in msg
        or 'aadsts' in msg
    )


def query(
    kql: str,
    timespan: str = 'P7D',
    timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Run a KQL query against App Insights and return the raw response.

    Args:
        kql: The KQL query string.
        timespan: ISO 8601 duration (e.g. ``"P1D"``, ``"P7D"``, ``"P30D"``).
        timeout_seconds: HTTP timeout.

    Returns:
        A dict with at least ``columns`` (list of ``{name, type}``) and
        ``rows`` (list of lists). The first table from the API response
        is unwrapped for callers who only care about the primary result.

    Raises:
        AppInsightsError: On token acquisition, network, or HTTP errors.
    """
    token = _get_token()
    url = f'{_API_BASE}/{APP_ID}/query'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    body = {'query': kql, 'timespan': timespan}

    try:
        resp = requests.post(
            url, headers=headers, json=body, timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        raise AppInsightsError(
            f'App Insights request failed: {exc}'
        ) from exc

    if resp.status_code != 200:
        body_text = (resp.text or '')[:500]
        raise AppInsightsError(
            f'App Insights HTTP {resp.status_code}: {body_text}',
            status_code=resp.status_code,
        )

    payload = resp.json() or {}
    tables = payload.get('tables') or []
    if not tables:
        return {'columns': [], 'rows': []}

    table = tables[0]
    return {
        'columns': table.get('columns') or [],
        'rows': table.get('rows') or [],
    }


def query_to_dicts(
    kql: str,
    timespan: str = 'P7D',
    timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    """Run a query and return rows as a list of dicts keyed by column name."""
    result = query(kql, timespan=timespan, timeout_seconds=timeout_seconds)
    columns = [c.get('name') for c in result['columns']]
    return [dict(zip(columns, row)) for row in result['rows']]
