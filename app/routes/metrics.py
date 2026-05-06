"""
Unadvertised metrics dashboard, backed by App Insights.

This route is intentionally NOT linked from the nav. There's no identity
gate in code - whoever opens it queries App Insights with their own
``DefaultAzureCredential`` (i.e. their own ``az login``). Users without
read access on the ``NoteHelper_Telemetry`` resource get 403 responses,
which the page renders as per-card error states.

Cards (in order):
    1. MSX Account Teams probe (the new ``SalesBuddy.MsxAccountTeamProbe``
       custom event we emit hourly)
    2-N. Ported queries from the existing
       ``infra/workbooks/salesbuddy-usage-workbook.json`` workbook.
"""
from __future__ import annotations

import logging

from flask import Blueprint, render_template, request

from app.services.app_insights import AppInsightsError, query_to_dicts

logger = logging.getLogger(__name__)

metrics_bp = Blueprint('metrics', __name__)


# ---------------------------------------------------------------------------
# KQL queries - mostly ported verbatim from
# infra/workbooks/salesbuddy-usage-workbook.json. Workbook params are
# substituted to plain KQL: {TimeRange} -> "> ago(Nd)", {Role} -> "all".
# ---------------------------------------------------------------------------

def _q_probe_status(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.MsxAccountTeamProbe"
| where timestamp > ago({days}d)
| extend result = tostring(customDimensions.result)
| summarize events = count() by result
| order by events desc
"""


def _q_probe_timeline(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.MsxAccountTeamProbe"
| where timestamp > ago({days}d)
| extend result = tostring(customDimensions.result)
| summarize events = count() by bin(timestamp, 1h), result
| order by timestamp asc
"""


def _q_probe_recent(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.MsxAccountTeamProbe"
| where timestamp > ago({days}d)
| extend result = tostring(customDimensions.result),
         instance_id = tostring(customDimensions.instance_id),
         error_code = tostring(customDimensions.error_code)
| project timestamp, result, instance_id, error_code
| order by timestamp desc
| take 25
"""


def _q_dau(days: int) -> str:
    return f"""
let LatestProfile = customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id)
| summarize arg_max(timestamp, *) by instance_id
| extend user_role = tostring(customDimensions.user_role)
| project instance_id, user_role;
customEvents
| where name == "SalesBuddy.FeatureUsage"
| where timestamp > ago({days}d)
| extend instance_id = tostring(customDimensions.instance_id)
| join kind=leftouter LatestProfile on instance_id
| extend user_role = coalesce(user_role, "unknown")
| summarize DAU = dcount(instance_id) by bin(timestamp, 1d), user_role
| order by timestamp asc
"""


def _q_installs_by_role() -> str:
    return """
customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id)
| summarize arg_max(timestamp, *) by instance_id
| extend user_role = tostring(customDimensions.user_role)
| summarize installs = dcount(instance_id) by user_role
| order by installs desc
"""


def _q_flag_adoption() -> str:
    return """
let LatestProfile = customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id)
| summarize arg_max(timestamp, *) by instance_id;
LatestProfile
| summarize
    total = dcount(instance_id),
    msx_writeback     = dcountif(instance_id, tostring(customDimensions.msx_auto_writeback) == "true"),
    copilot_actions   = dcountif(instance_id, tostring(customDimensions.copilot_actions_enabled) == "true"),
    stale_milestones  = dcountif(instance_id, tostring(customDimensions.show_stale_milestones) == "true"),
    hygiene_tasks     = dcountif(instance_id, tostring(customDimensions.show_hygiene_tasks) == "true"),
    auto_sync         = dcountif(instance_id, tostring(customDimensions.milestone_auto_sync) == "true"),
    workiq_connect    = dcountif(instance_id, tostring(customDimensions.workiq_connect_impact) == "true"),
    custom_workiq_prompt = dcountif(instance_id, tostring(customDimensions.has_workiq_prompt) == "true")
| project Feature = pack_array("MSX writeback","Copilot actions","Stale milestones","Hygiene tasks","Milestone auto-sync","WorkIQ connect impact","Custom WorkIQ prompt"),
          Installs = pack_array(msx_writeback, copilot_actions, stale_milestones, hygiene_tasks, auto_sync, workiq_connect, custom_workiq_prompt),
          Total = total
| mv-expand Feature to typeof(string), Installs to typeof(long)
| extend AdoptionPct = round(100.0 * Installs / Total, 1)
| project Feature, Installs, Total, AdoptionPct
| order by AdoptionPct desc
"""


def _q_adoption_by_role() -> str:
    return """
let LatestProfile = customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id)
| summarize arg_max(timestamp, *) by instance_id
| extend user_role = tostring(customDimensions.user_role);
LatestProfile
| where user_role in ("se", "dss")
| summarize
    installs = dcount(instance_id),
    msx_writeback_pct = round(100.0 * dcountif(instance_id, tostring(customDimensions.msx_auto_writeback) == "true")    / dcount(instance_id), 1),
    copilot_pct       = round(100.0 * dcountif(instance_id, tostring(customDimensions.copilot_actions_enabled) == "true") / dcount(instance_id), 1),
    stale_pct         = round(100.0 * dcountif(instance_id, tostring(customDimensions.show_stale_milestones) == "true")   / dcount(instance_id), 1),
    auto_sync_pct     = round(100.0 * dcountif(instance_id, tostring(customDimensions.milestone_auto_sync) == "true")     / dcount(instance_id), 1)
    by user_role
| order by user_role asc
"""


def _q_entity_counts() -> str:
    return """
let LatestProfile = customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id)
| summarize arg_max(timestamp, *) by instance_id
| extend user_role = tostring(customDimensions.user_role);
LatestProfile
| summarize
    p50_notes      = percentile(toreal(customMeasurements.note_count), 50),
    p90_notes      = percentile(toreal(customMeasurements.note_count), 90),
    p50_customers  = percentile(toreal(customMeasurements.customer_count), 50),
    p90_customers  = percentile(toreal(customMeasurements.customer_count), 90),
    p50_engagements= percentile(toreal(customMeasurements.engagement_count), 50),
    p90_engagements= percentile(toreal(customMeasurements.engagement_count), 90),
    p50_milestones = percentile(toreal(customMeasurements.milestone_count), 50),
    p90_milestones = percentile(toreal(customMeasurements.milestone_count), 90)
    by user_role
| order by user_role asc
"""


def _q_top_features(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.FeatureUsage"
| where timestamp > ago({days}d)
| extend instance_id = tostring(customDimensions.instance_id),
         feature = tostring(customDimensions.feature)
| where isnotempty(feature)
| summarize
    requests = count(),
    installs = dcount(instance_id)
    by feature
| order by installs desc, requests desc
| take 30
"""


def _q_reports(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.FeatureUsage"
| where timestamp > ago({days}d)
| extend feature = tostring(customDimensions.feature),
         category = tostring(customDimensions.category),
         instance_id = tostring(customDimensions.instance_id)
| where category == "Reports" or feature startswith "reports."
| where isnotempty(feature)
| extend report = iff(feature startswith "reports.", substring(feature, 8), feature)
| summarize report_views = count(), installs = dcount(instance_id) by report
| order by installs desc, report_views desc
"""


def _q_power_features(days: int) -> str:
    return f"""
let LatestProfile = customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id)
| summarize arg_max(timestamp, *) by instance_id
| extend user_role = tostring(customDimensions.user_role)
| project instance_id, user_role;
let interesting = dynamic([
    "revenue.dashboard", "revenue.import",
    "main.action_items_hub", "milestones.tracker",
    "ai.fill_my_day", "engagements.hub",
    "partners.list", "projects.list"
]);
customEvents
| where name == "SalesBuddy.FeatureUsage"
| where timestamp > ago({days}d)
| extend feature = tostring(customDimensions.feature),
         instance_id = tostring(customDimensions.instance_id)
| where feature in (interesting)
| join kind=leftouter LatestProfile on instance_id
| summarize
    installs_using = dcount(instance_id),
    se_installs    = dcountif(instance_id, user_role == "se"),
    dss_installs   = dcountif(instance_id, user_role == "dss"),
    unknown_installs = dcountif(instance_id, user_role == "unknown" or isempty(user_role))
    by feature
| order by installs_using desc
"""


def _q_errors(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.FeatureUsage"
| where timestamp > ago({days}d)
| extend feature = tostring(customDimensions.feature),
         is_error = toreal(customMeasurements.is_error)
| summarize
    requests = count(),
    errors = countif(is_error == 1.0),
    error_pct = round(100.0 * countif(is_error == 1.0) / count(), 2),
    p50_ms = percentile(toreal(customMeasurements.response_time_ms), 50),
    p95_ms = percentile(toreal(customMeasurements.response_time_ms), 95)
    by feature
| where requests > 20
| order by error_pct desc, p95_ms desc
| take 25
"""


def _q_workiq_failures(days: int) -> str:
    return f"""
customEvents
| where name == "SalesBuddy.WorkIQFailure"
| where timestamp > ago({days}d)
| extend operation = tostring(customDimensions.operation),
         failure_type = tostring(customDimensions.failure_type),
         instance_id = tostring(customDimensions.instance_id)
| summarize
    failures = count(),
    installs_affected = dcount(instance_id)
    by operation, failure_type
| order by failures desc
"""


def _q_app_versions() -> str:
    return """
customEvents
| where name == "SalesBuddy.InstallProfile"
| where timestamp > ago(30d)
| extend instance_id = tostring(customDimensions.instance_id),
         app_version = tostring(customDimensions.app_version)
| summarize arg_max(timestamp, *) by instance_id
| summarize installs = dcount(instance_id) by app_version
| order by installs desc
"""


def _safe_query(title: str, kql: str, timespan: str) -> dict:
    """Run a query, returning ``{rows, error}`` so one failure can't 500 the page."""
    try:
        rows = query_to_dicts(kql, timespan=timespan)
        return {'title': title, 'rows': rows, 'error': None}
    except AppInsightsError as exc:
        logger.warning(f'Metrics card "{title}" failed: {exc}')
        return {
            'title': title,
            'rows': [],
            'error': str(exc),
            'status_code': exc.status_code,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception(f'Metrics card "{title}" raised unexpectedly')
        return {'title': title, 'rows': [], 'error': str(exc)}


@metrics_bp.route('/metrics')
def metrics_dashboard():
    """Render the (unadvertised) App Insights-backed metrics dashboard."""
    try:
        days = int(request.args.get('days', 7))
    except (TypeError, ValueError):
        days = 7
    if days not in (1, 7, 30, 90):
        days = 7
    timespan = f'P{days}D'

    cards = {
        'probe_status':     _safe_query('Probe results',          _q_probe_status(days),     timespan),
        'probe_timeline':   _safe_query('Probe timeline (hourly)', _q_probe_timeline(days),  timespan),
        'probe_recent':     _safe_query('Recent probe events',    _q_probe_recent(days),     timespan),
        'dau':              _safe_query('Daily active users',     _q_dau(days),              timespan),
        'installs_by_role': _safe_query('Installs by role',       _q_installs_by_role(),     'P30D'),
        'flag_adoption':    _safe_query('Feature flag adoption',  _q_flag_adoption(),        'P30D'),
        'adoption_by_role': _safe_query('Adoption by role',       _q_adoption_by_role(),     'P30D'),
        'entity_counts':    _safe_query('Entity-count distribution', _q_entity_counts(),     'P30D'),
        'top_features':     _safe_query('Top 30 features',        _q_top_features(days),     timespan),
        'reports':          _safe_query('Reports opened',         _q_reports(days),          timespan),
        'power_features':   _safe_query('Power-feature adoption', _q_power_features(days),   timespan),
        'errors':           _safe_query('Error rate & latency',   _q_errors(days),           timespan),
        'workiq_failures':  _safe_query('WorkIQ failures',        _q_workiq_failures(days),  timespan),
        'app_versions':     _safe_query('App version distribution', _q_app_versions(),       'P30D'),
    }

    # Headline status for the probe card: derive from probe_status counts.
    probe_summary = _summarize_probe(cards['probe_status'])

    return render_template(
        'metrics.html',
        days=days,
        cards=cards,
        probe_summary=probe_summary,
    )


def _summarize_probe(card: dict) -> dict:
    """Summarize the probe_status card into a banner-friendly dict."""
    if card.get('error'):
        return {
            'state': 'unknown',
            'label': 'Unable to read probe data',
            'detail': card['error'],
            'counts': {},
        }

    counts = {row.get('result'): row.get('events', 0) for row in card.get('rows', [])}
    outage = counts.get('outage', 0)
    ok = counts.get('ok', 0)

    if outage > 0:
        return {
            'state': 'outage',
            'label': f'Outage detected ({outage} probe events)',
            'detail': 'msp_accountteams returned 0x80040224.',
            'counts': counts,
        }
    if ok > 0:
        return {
            'state': 'healthy',
            'label': f'Healthy ({ok} successful probes)',
            'detail': 'No outage signature observed in the selected window.',
            'counts': counts,
        }
    return {
        'state': 'no-data',
        'label': 'No probe data in window',
        'detail': 'The probe may not have run yet, or telemetry is opted out.',
        'counts': counts,
    }
