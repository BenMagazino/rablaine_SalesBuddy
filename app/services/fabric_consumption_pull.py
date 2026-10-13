"""Read Fabric workload and capacity consumption through Power BI QES.

Queries follow the captured Fabric Consumption reports, without their top-500
account limiter. Authentication and DSR decoding reuse the revenue reader's
stateless helpers; report tokens and model IDs remain isolated.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

import requests

from app.services import revenue_pull

DATASET_ID = "27b59ca8-3fcf-47ee-9db3-f05f0f2b4188"
WORKLOAD_REPORT_ID = "ab993815-0671-4c70-b07f-dc9b96dff8c0"
CAPACITY_REPORT_ID = "ed8e1bea-f0fd-4603-81fb-7ed8bd7bc3e6"
MODEL_ID = 5193796
SOURCE_TIMEZONE = "UTC"
MAX_PAGES = 200
CHUNK_SIZE = 20
CAPACITY_CHUNK_SIZE = 25
RI_PRICING_LEVELS = (
    "EA RI", "MCA Partner-Led RI", "MCA Field-Led RI", "MCA Customer-Led RI",
    "Direct RI", "MCA Inside Sales - DR RI", "CSP - RI",
)
REVENUE_FIELDS = {
    "revenue_summary": (
        "total_revenue_ytd", "reservation_revenue_ytd", "paygo_revenue_ytd",
        "reservation_share_ratio", "reporting_fiscal_month_id",
    ),
    "revenue_months": (
        "total_revenue", "reservation_revenue", "paygo_revenue", "reservation_share_ratio",
        "fiscal_month", "fiscal_month_id",
    ),
}


class FabricPullError(Exception):
    """A scoped Fabric query could not be completed safely."""


def _source(name: str, entity: str, extension: bool = False) -> dict:
    """Return a semantic-query source."""
    result = {"Name": name, "Entity": entity, "Type": 0}
    if extension:
        result["Schema"] = "extension"
    return result


def _column(source: str, field: str, name: str) -> dict:
    """Return a named column selection."""
    return revenue_pull._col(source, field, name)


def _measure(source: str, field: str, name: str) -> dict:
    """Return a named measure selection."""
    return revenue_pull._mea(source, field, name)


def _members(source: str, field: str, values: list[str]) -> dict:
    """Build string members with escaped semantic-query literals."""
    return revenue_pull._in(
        source, field, ["'" + value.replace("'", "''") + "'" for value in values],
    )


def _tpids(values: list[int]) -> dict:
    """Filter numeric TPID, never the report's 'Account Name (TPID)' display label."""
    return revenue_pull._in("a", "TPID", [f"{int(value)}L" for value in values])


def _notification_filters(source: str, reports: list[str]) -> list[dict]:
    """Match the published report's notification filter context."""
    return [
        _members(source, "Report", reports),
        revenue_pull._not_in(source, "Created By", ["'Automated'"]),
    ]


def _calendar_filter(as_of: date) -> dict:
    """Use the captured 365-day inclusive calendar ending yesterday in UTC."""
    start = as_of - timedelta(days=364)
    return {"Condition": {"Between": {
        "Expression": {"Column": _column("c", "Calendar Date", "date")["Column"]},
        "LowerBound": {"Literal": {"Value": f"datetime'{start.isoformat()}T00:00:00'"}},
        "UpperBound": {"Literal": {"Value": f"datetime'{as_of.isoformat()}T00:00:00'"}},
    }}}


def workload_context(tpids: list[int], as_of: date) -> tuple[list[dict], list[dict]]:
    """Match the workload report's 365-day calendar and capacity context.

    CU Hours (28d) is a model-defined rolling measure within that context, not
    the sum of the entire 365-day calendar selection.
    """
    sources = [
        _source("a", "Account"), _source("f", "Fabric Capacity Units"),
        _source("e", "Environment"), _source("c", "Calendar"),
        _source("cap", "Capacity"), _source("n", "-> Report Notifications"),
    ]
    where = [
        _tpids(tpids),
        _members("e", "Environment", ["PROD", "MSIT"]),
        _members("cap", "Capacity Grouping", ["Fabric", "Fabric Trial", "Power BI Premium"]),
        _calendar_filter(as_of),
        *_notification_filters("n", ["All", "Fabric Capacity 360"]),
    ]
    return sources, where


def revenue_extension() -> dict:
    """Captured account-level CD revenue DAX, not capacity ownership or reservation coverage."""
    measures = []
    pricing = ",".join(json.dumps(level) for level in RI_PRICING_LEVELS)
    for period, dates in (
        ("MTD", "DATESMTD('Calendar'[Calendar Date])"),
        ("YTD", 'DATESYTD(\'Calendar\'[Calendar Date], "6-30")'),
    ):
        total = f"Fabric Revenue {period}"
        reserved = f"{total} Reserved Instance RI"
        measures.extend([
            {"Name": total, "DataType": 3, "Expression": (
                "VAR _MaxDateId = Local.Revenue.MaxMonthId() "
                f"VAR _Dates = CALCULATETABLE({dates},"
                "'Calendar'[FiscalMonthId] = _MaxDateId) "
                "RETURN CALCULATE(SUMX(Revenue,"
                "Revenue[BilledRevenueCD] + Revenue[AzureConsumedRevenueCD]),_Dates,"
                "'Product Master'[Product] IN {\"Fabric\", \"F SKU\"},"
                "'Product Master'[Product Group] IN {\"Fabric\", \"Fabric Platform\"})"
            )},
            {"Name": reserved, "DataType": 3, "Expression": (
                f"CALCULATE([{total}],'Revenue'[AZ Pricing Level 2] IN {{{pricing}}})"
            )},
            {"Name": f"{total} Pay-as-you-go", "DataType": 3,
             "Expression": f"[{total}] - [{reserved}]"},
            {"Name": f"Fabric RI share {period}", "DataType": 3,
             "Expression": f"DIVIDE([{reserved}], [{total}])"},
        ])
    measures.append({
        "Name": "Fabric Revenue Reporting Month Id", "DataType": 4,
        "Expression": "Local.Revenue.MaxMonthId()",
    })
    return {"Version": 0, "Name": "extension", "Entities": [{
        "Extends": "-> Report Measures", "Name": "-> Report Measures", "Measures": measures,
    }]}


def build_revenue_query(tpids: list[int], as_of: date, monthly: bool = False) -> dict:
    """Use the captured revenue/calendar context with a direct numeric Account.TPID scope."""
    sources = [
        _source("a", "Account"), _source("c", "Calendar"), _source("cap", "Capacity"),
        _source("n", "-> Report Notifications"), _source("rev", "-> Report Measures", True),
    ]
    select = [_column("a", "TPID", "tpid")]
    if monthly:
        select.extend([
            _column("c", "Fiscal Month", "fiscal_month"),
            _column("c", "FiscalMonthId", "fiscal_month_id"),
        ])
    period = "MTD" if monthly else "YTD"
    suffix = "" if monthly else "_ytd"
    select.extend([
        _measure("rev", f"Fabric Revenue {period}", f"total_revenue{suffix}"),
        _measure("rev", f"Fabric Revenue {period} Reserved Instance RI",
                 f"reservation_revenue{suffix}"),
        _measure("rev", f"Fabric Revenue {period} Pay-as-you-go", f"paygo_revenue{suffix}"),
        _measure("rev", f"Fabric RI share {period}", "reservation_share_ratio"),
    ])
    if not monthly:
        select.append(_measure(
            "rev", "Fabric Revenue Reporting Month Id", "reporting_fiscal_month_id",
        ))
    return {"Version": 2, "From": sources, "Select": select, "Where": [
        _tpids(tpids), _calendar_filter(as_of),
        _members("cap", "Capacity Grouping", ["Fabric", "Fabric Trial", "Power BI Premium"]),
        *_notification_filters("n", ["All", "Fabric Capacity 360"]),
    ]}


def _revenue_queries(tpids: list[int], as_of: date) -> list[tuple]:
    """Reuse identical complete-query families in full and revenue-only imports."""
    return [
        (kind, build_revenue_query(tpids, as_of, monthly=kind == "revenue_months"),
         WORKLOAD_REPORT_ID, revenue_extension())
        for kind in REVENUE_FIELDS
    ]


def _revenue_metadata(tpids: list[int], as_of: date) -> dict:
    """Disclose source units and account-level limitations without guessing currency or FX."""
    return {
        "complete": True, "requested_tpids": tpids, "dataset_id": DATASET_ID,
        "model_id": MODEL_ID, "report_id": WORKLOAD_REPORT_ID,
        "as_of_date": as_of.isoformat(), "calendar_timezone": "UTC",
        "calendar_start": (as_of - timedelta(days=364)).isoformat(),
        "calendar_end": as_of.isoformat(), "fiscal_year_end": "June 30",
        "reported_units": "CD", "currency": None,
        "currency_basis": "Source BilledRevenueCD + AzureConsumedRevenueCD; FX not established.",
        "paygo_definition": "Report-native total Fabric revenue minus RI-classified revenue.",
        "scope": "Account-level revenue classification, not per-capacity reservation ownership.",
        "ri_pricing_levels": list(RI_PRICING_LEVELS),
    }


def validate_revenue_payload(payload: dict, tpids: set[int]) -> None:
    """Reject incomplete, foreign, malformed, duplicate or contradictory revenue results."""
    import math

    if not isinstance(payload, dict) or not isinstance(payload.get("metadata"), dict):
        raise FabricPullError("Fabric revenue returned malformed metadata.")
    metadata = payload["metadata"]
    requested = metadata.get("requested_tpids")
    if (metadata.get("complete") is not True or not isinstance(requested, list)
            or any(isinstance(value, bool) or not str(value).isdigit()
                   for value in requested) or set(int(value) for value in requested) != tpids):
        raise FabricPullError("Fabric revenue did not confirm its complete account scope.")
    for kind, fields in REVENUE_FIELDS.items():
        rows = payload.get(kind)
        if not isinstance(rows, list):
            raise FabricPullError(f"Fabric revenue omitted its {kind} result set.")
        identities = set()
        for row in rows:
            if not isinstance(row, dict):
                raise FabricPullError("Fabric revenue returned a malformed result row.")
            value = row.get("tpid")
            if (isinstance(value, bool) or not str(value).isdigit() or int(value) not in tpids
                    or any(field not in row for field in fields)):
                raise FabricPullError("Fabric revenue returned invalid scope or missing fields.")
            for field in fields:
                value = row[field]
                if field == "fiscal_month":
                    if not isinstance(value, str) or not value.strip():
                        raise FabricPullError("Fabric revenue returned an invalid month label.")
                elif field.endswith("month_id"):
                    if value is not None and (
                        isinstance(value, bool) or not str(value).isdigit() or int(value) <= 0
                    ):
                        raise FabricPullError("Fabric revenue returned an invalid reporting month.")
                    if kind == "revenue_months" and value is None:
                        raise FabricPullError("Fabric revenue omitted the month identifier.")
                elif value is not None:
                    try:
                        valid = not isinstance(value, bool) and math.isfinite(float(value))
                    except (TypeError, ValueError):
                        valid = False
                    if not valid:
                        raise FabricPullError("Fabric revenue returned an invalid numeric value.")
            identity = (
                int(row["tpid"]),
                int(row["fiscal_month_id"]) if row.get("fiscal_month_id") is not None else None,
            )
            if identity in identities:
                raise FabricPullError("Fabric revenue returned duplicate account/month rows.")
            identities.add(identity)
            suffix = "" if kind == "revenue_months" else "_ytd"
            total, reserved, paygo = [
                row[field + suffix]
                for field in ("total_revenue", "reservation_revenue", "paygo_revenue")
            ]
            if all(value is not None for value in (total, reserved, paygo)):
                if not math.isclose(float(total), float(reserved) + float(paygo),
                                    rel_tol=1e-7, abs_tol=0.001):
                    raise FabricPullError("Fabric RI and PAYG revenue do not reconcile.")
            ratio = row["reservation_share_ratio"]
            if ratio is not None and reserved is not None and total is not None:
                if float(total) == 0 or not math.isclose(
                    float(ratio), float(reserved) / float(total), rel_tol=1e-7, abs_tol=1e-8,
                ):
                    raise FabricPullError("Fabric RI share contradicts its source amounts.")


def pull_fabric_revenue(
    tpids: list[int], progress: Callable | None = None, *, chunk: int = CHUNK_SIZE,
    client: FabricQueryClient | None = None, as_of: date | None = None,
) -> dict:
    """Read only account revenue in complete bounded batches, never capacity histories."""
    if any(isinstance(value, bool) or not str(value).isdigit() or int(value) <= 0 for value in tpids):
        raise FabricPullError("Fabric revenue requires positive integer TPIDs.")
    tpids = sorted(set(int(value) for value in tpids))
    if not tpids or chunk < 1:
        raise FabricPullError("Fabric revenue requires accounts and a positive chunk size.")
    as_of = as_of or datetime.now(timezone.utc).date() - timedelta(days=1)
    reader = client or FabricQueryClient()
    output = {kind: [] for kind in REVENUE_FIELDS}
    batches = [tpids[index:index + chunk] for index in range(0, len(tpids), chunk)]
    try:
        for index, batch in enumerate(batches):
            for kind, query, report, extension in _revenue_queries(batch, as_of):
                rows = _query_scoped(reader, query, report, extension, "a", "TPID", batch, True)
                validate_revenue_payload({
                    "metadata": {"complete": True, "requested_tpids": batch},
                    **{name: rows if name == kind else [] for name in REVENUE_FIELDS},
                }, set(batch))
                output[kind].extend(rows)
                if progress:
                    progress({"sync_type": "fabric_revenue", "scope": "revenue_only",
                              "phase": kind, "progress": int((index + 1) / len(batches) * 90),
                              "message": f"Loaded revenue batch {index + 1}/{len(batches)}."})
    finally:
        if client is None:
            reader.close()
    output["metadata"] = _revenue_metadata(tpids, as_of)
    validate_revenue_payload(output, set(tpids))
    return output


def build_workload_query(tpids: list[int], as_of: date, detail: bool = False) -> dict:
    """Query every workload with its true customer/capacity denominator."""
    sources, where = workload_context(tpids, as_of)
    sources.append(_source("t", "Tenant"))
    select = [
        _column("a", "TPID", "tpid"),
        _column("t", "Tenant Id", "tenant_id"),
        _column("cap", "Capacity Id", "capacity_id"),
        _column("cap", "Capacity SKU", "sku"),
    ]
    if detail:
        select.extend([
            _column("f", "Workload Type", "workload"),
            _column("f", "Artifact Kind", "artifact_kind"),
            _column("f", "Operation Name", "operation"),
        ])
    select.extend([
        _measure("f", "CU Hours (28d)", "cu_hours"),
        _measure("f", "CU Hours (28d) MoM %", "mom_change_ratio"),
    ])
    return {"Version": 2, "From": sources, "Select": select, "Where": where}


def build_customer_query(tpids: list[int], as_of: date) -> tuple[dict, dict]:
    """Capture report customer totals and Direct Lake's overlapping usage."""
    sources, where = workload_context(tpids, as_of)
    sources.append(_source("fx", "Fabric Capacity Units", True))
    extension = {"Version": 0, "Name": "extension", "Entities": [
        {"Extends": "Fabric Capacity Units", "Name": "Fabric Capacity Units", "Measures": [{
            "Name": "Direct Lake CU (28d)", "DataType": 2,
            "Expression": (
                'CALCULATE([CU Hours (28d)],'
                '\'Fabric Capacity Units\'[Direct Lake Capacity Flag]="true")'
            ),
        }]},
    ]}
    return {
        "Version": 2, "From": sources, "Where": where,
        "Select": [
            _column("a", "TPID", "tpid"),
            _measure("f", "CU Hours (28d)", "cu_hours"),
            _measure("f", "CU Hours (28d) MoM %", "mom_change_ratio"),
            _measure("fx", "Direct Lake CU (28d)", "direct_lake_cu_hours"),
        ],
    }, extension


def build_mau_query(tpids: list[int], as_of: date) -> tuple[dict, dict]:
    """Read distinct customer MAU independently to avoid a cross-fact query plan."""
    sources, where = workload_context(tpids, as_of)
    sources.append(_source("u", "Usage Fabric", True))
    extension = {"Version": 0, "Name": "extension", "Entities": [
        {"Extends": "Usage Fabric", "Name": "Usage Fabric", "Measures": [{
            "Name": "Fabric Core MAU", "DataType": 4,
            "Expression": 'CALCULATE([Fabric MAU],\'Product Master\'[Product]="Fabric Core")',
        }]},
    ]}
    return {
        "Version": 2, "From": sources, "Where": where,
        "Select": [
            _column("a", "TPID", "tpid"), _measure("u", "Fabric Core MAU", "fabric_core_mau"),
        ],
    }, extension


def build_customer_workload_query(tpids: list[int], as_of: date) -> dict:
    """Obtain workload numerators directly, including blank current/prior-only rows."""
    sources, where = workload_context(tpids, as_of)
    return {
        "Version": 2, "From": sources, "Where": where,
        "Select": [
            _column("a", "TPID", "tpid"),
            _column("f", "Workload Type", "workload"),
            _measure("f", "CU Hours (28d)", "cu_hours"),
            _measure("f", "CU Hours (28d) MoM %", "mom_change_ratio"),
        ],
    }


def _capacity_extension() -> dict:
    """Numeric-only report measures and their exact HAR DAX dependencies."""
    last = (
        "CALCULATE(MAX('Fabric Capacity Units NRT'[DateTime]),"
        "ALLEXCEPT('Fabric Capacity Units NRT','Calendar',"
        "'Time'[DIM_TimeId],'Fabric Capacity Units NRT'[DateTime]))"
    )
    def latest(expression: str) -> str:
        """Evaluate a measure at the report's selected latest timestamp."""
        return (
            f"VAR MaxDate = [_MaxDateTime] RETURN CALCULATE({expression},"
            "ALL('Time'),'Fabric Capacity Units NRT'[DateTime]=MaxDate)"
        )

    sku = (
        "VAR LastDates=ADDCOLUMNS(VALUES('Fabric Capacity Units NRT'[Capacity Id]),"
        "\"MaxDateTime\",CALCULATE(MAX('Fabric Capacity Units NRT'[DateTime]),"
        "ALLEXCEPT('Fabric Capacity Units NRT','Fabric Capacity Units NRT'[Capacity Id]))) "
        "VAR SKUs=CALCULATETABLE(SUMMARIZE('Fabric Capacity Units NRT',"
        "'Fabric Capacity Units NRT'[CapacitySKUOrder],'Fabric Capacity Units NRT'[Sku]),"
        "TREATAS(LastDates,'Fabric Capacity Units NRT'[Capacity Id],"
        "'Fabric Capacity Units NRT'[DateTime])) "
        "RETURN SELECTCOLUMNS(TOPN(1,SKUs,'Fabric Capacity Units NRT'[CapacitySKUOrder],DESC),"
        "'Fabric Capacity Units NRT'[Sku])"
    )
    groups = {
        "Fabric Capacity Units NRT": {
            "Current SKU NRT": (sku, 1),
            "_MaxDateTime": (last, 7),
            "_MAX_% Utilization": (latest("[% Util]"), 3),
            "_MAX_% Utilization_max30": (latest("[MaxUtilwithinHour]"), 3),
            "_MAX_users": (latest("[NRT User Count]"), 4),
        },
        "-> Data Dictionary": {
            "% Util": (
                "DIVIDE([NRT Background CU Seconds]+[NRT Interactive CU Seconds],"
                "[NRT Available CU Seconds]+[NRT Available Auto Scale Seconds])", 3),
            "MaxUtilwithinHour": ("DIVIDE([NRT Max30sec],[NRt Available 30Sec])", 3),
            "NRT Max30sec": (
                "[NRT Max Smoothed Background CU Seconds]+"
                "[NRT Max Smoothed Interactive CU Seconds]", 2),
            "NRt Available 30Sec": ("DIVIDE([NRT Available CU Seconds],120)", 2),
            "_MAX_Throttling": (latest("[NRT Throttling Seconds]"), 2),
            "_MAX_Hour-AutoScale": (latest("[NRT Available Auto Scale Seconds]"), 2),
            "AutoScaleON": ('IF([_MAX_Hour-AutoScale]>0,"ON",BLANK())', 1),
        },
    }
    return {"Version": 0, "Name": "extension", "Entities": [
        {"Extends": entity, "Name": entity, "Measures": [
            {"Name": name, "Expression": formula, "DataType": dtype}
            for name, (formula, dtype) in measures.items()
        ]} for entity, measures in groups.items()
    ]}


def build_capacity_query(tpids: list[int], trend: bool = False) -> dict:
    """Query capacity summary or hourly detail, preserving NRT retained history."""
    sources = [
        _source("a", "Account"), _source("f", "Fabric Capacity Units NRT"),
        _source("n", "-> Report Notifications"),
    ]
    if not trend:
        sources.extend([
            _source("fx", "Fabric Capacity Units NRT", True),
            _source("d", "-> Data Dictionary", True),
        ])
    select = [
        _column("a", "TPID", "tpid"),
        _column("f", "Tenant Id", "tenant_id"),
        _column("f", "Capacity Id", "capacity_id"),
    ]
    if trend:
        select.extend([
            _column("f", "DateTime", "observed_at"),
            _column("f", "Sku", "sku"),
        ])
    else:
        select.append(_measure("fx", "Current SKU NRT", "sku"))
    fields = {
        "interactive_cu_seconds": "NRT Interactive CU Seconds",
        "background_cu_seconds": "NRT Background CU Seconds",
        "available_cu_seconds": "NRT Available CU Seconds",
        "autoscale_cu_seconds": "NRT Available Auto Scale Seconds",
        "throttling_seconds": "NRT Throttling Seconds",
        "interactive_rejections": "NRT Interactive Rejection Count",
        "background_rejections": "NRT Background Rejection Count",
        "unsmoothed_cu_hours": "NRT Unsmoothed CU Time Hours",
        "successful_operations": "NRT Successful Operations",
        "failed_operations": "NRT Failed Operations",
        "cancelled_operations": "NRT Cancelled Operations",
        "rejected_operations": "NRT Rejected Operations",
        "in_progress_operations": "NRT In Progress Operations",
        "invalid_operations": "NRT Invalid Operations",
        "operation_duration_seconds": "NRT Operation Duration Seconds",
    }
    select.extend(_measure("f", field, name) for name, field in fields.items())
    if not trend:
        select.extend([
            _measure("fx", "_MAX_% Utilization", "latest_utilization_ratio"),
            _measure("fx", "_MAX_% Utilization_max30", "max_30s_utilization_ratio"),
            _measure("fx", "_MAX_users", "latest_users"),
            _measure("d", "_MAX_Throttling", "latest_throttling_seconds"),
            _measure("d", "AutoScaleON", "autoscale"),
        ])
    return {
        "Version": 2, "From": sources, "Select": select,
        "Where": [
            _tpids(tpids),
            *_notification_filters("n", ["CUNRT_Fabric", "All"]),
        ],
    }


class FabricQueryClient:
    """Report-isolated Power BI credentials, transport, and complete pagination."""

    def __init__(self, session: requests.Session | None = None) -> None:
        """Create a client without authenticating until the first query."""
        self.session = session or requests.Session()
        self.mwc: str | None = None
        self.expiry = 0.0
        self.url: str | None = None
        self.model_id = MODEL_ID

    def _mint(self, report_id: str) -> str:
        """Mint a dedicated-capacity token for the Fabric model."""
        if self.mwc and self.url and time.time() < self.expiry - 60:
            return self.mwc
        url = (
            f"{revenue_pull._CLUSTER}/explore/reports/{report_id}/"
            "modelsAndExploration?preferReadOnlySession=true"
        )
        headers = {
            "Authorization": f"Bearer {revenue_pull._get_pbi_token()}",
            "x-powerbi-hostenv": "Embed for Organization",
            "origin": "https://msit.powerbi.com", "referer": "https://msit.powerbi.com/",
        }
        response = None
        for attempt in range(3):
            try:
                response = self.session.get(url, headers=headers, timeout=(20, 180))
                if response.status_code not in (429, 500, 502, 503, 504):
                    break
            except (requests.ConnectionError, requests.Timeout) as exc:
                if attempt == 2:
                    raise FabricPullError("Fabric authentication connection failed.") from exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
        if response is None:
            raise FabricPullError("Fabric authentication returned no response.")
        if not response.ok:
            raise FabricPullError(f"Fabric model authentication failed ({response.status_code}).")
        mwc = next((token for token in revenue_pull._JWT_RE.findall(response.text)
                    if revenue_pull._is_mwc(token)), None)
        if not mwc:
            raise FabricPullError("Fabric report returned no dedicated-capacity token.")
        models = response.json().get("models") or []
        model = next((m for m in models if m.get("dbName") == DATASET_ID), None)
        if not model or not model.get("id"):
            raise FabricPullError("Fabric report did not resolve the expected dataset.")
        self.model_id = int(model["id"])
        self.mwc = mwc
        self.expiry = float(revenue_pull._decode_jwt(mwc).get("exp") or time.time() + 1200)
        self.url = revenue_pull._qes_url_from_mwc(mwc)
        return mwc

    def query(self, query: dict, report_id: str, extension: dict | None = None) -> list[dict]:
        """Return all rows or raise, never returning a partial/truncated result."""
        result: list[dict] = []
        seen_rows: set[str] = set()
        seen_cursors: set[str] = set()
        restart = None
        for _ in range(MAX_PAGES):
            rows, restart = self._page(query, report_id, extension, restart)
            for row in rows:
                identity = json.dumps(row, sort_keys=True, default=str)
                if identity not in seen_rows:
                    seen_rows.add(identity)
                    result.append(row)
            if not restart:
                return result
            cursor = json.dumps(restart, sort_keys=True)
            if cursor in seen_cursors:
                raise FabricPullError("Fabric pagination repeated its cursor.")
            seen_cursors.add(cursor)
        raise FabricPullError("Fabric query exceeded the complete-pagination limit.")

    def _page(self, query: dict, report_id: str, extension: dict | None,
              restart: Any) -> tuple[list[dict], Any]:
        """Execute one page with bounded transient retries and token refresh."""
        for attempt in range(3):
            mwc = self._mint(report_id)
            window = {"Count": 30000}
            if restart:
                window["RestartTokens"] = restart
            command = {
                "Query": query,
                "Binding": {
                    "Primary": {"Groupings": [{"Projections": list(range(len(query["Select"])))}]},
                    "DataReduction": {"DataVolume": 3, "Primary": {"Window": window}},
                    "Version": 1,
                },
                "ExecutionMetricsKind": 1,
            }
            if extension:
                command["Extension"] = extension
            body = {
                "version": "1.0.0", "modelId": self.model_id,
                "queries": [{
                    "Query": {"Commands": [{"SemanticQueryDataShapeCommand": command}]},
                    "QueryId": "", "ApplicationContext": {
                        "DatasetId": DATASET_ID, "Sources": [{"ReportId": report_id}],
                    },
                }],
                "cancelQueries": [], "userPreferredLocale": "en-US",
                "allowLongRunningQueries": True,
            }
            try:
                response = self.session.post(self.url, headers={
                    "authorization": f"MWCToken {mwc}",
                    "content-type": "application/json;charset=UTF-8",
                    "activityid": str(uuid.uuid4()), "requestid": str(uuid.uuid4()),
                    "x-ms-workload-resource-moniker": DATASET_ID,
                    "origin": "https://msit.powerbi.com",
                }, data=json.dumps(body), timeout=(20, 300))
                if response.status_code == 401 and attempt < 2:
                    self.mwc = None
                    continue
                if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                if not response.ok:
                    raise FabricPullError(f"Fabric query failed ({response.status_code}).")
                payload = json.loads(response.text.lstrip("\ufeff"))
                result = payload["results"][0]["result"]
                if result.get("error"):
                    raise FabricPullError("Fabric model rejected the query.")
                data = result.get("data")
                if not data or not data.get("dsr") or not data["dsr"].get("DS"):
                    shapes = (data or {}).get("dsr", {}).get("DataShapes", [])
                    codes = [shape.get("odata.error", {}).get("code") for shape in shapes]
                    codes = [code for code in codes if isinstance(code, str)
                             and code.replace("_", "").isalnum() and len(code) < 100]
                    if codes:
                        raise FabricPullError(f"Fabric source query error: {', '.join(codes)}.")
                    raise FabricPullError("Fabric query returned no complete data shape.")
                datasets = data["dsr"]["DS"]
                if len(datasets) != 1:
                    raise FabricPullError("Fabric query returned an unexpected data shape.")
                dataset = datasets[0]
                if not isinstance(dataset.get("IC"), bool):
                    raise FabricPullError("Fabric query did not confirm result completeness.")
                cursor = dataset.get("RT") if dataset.get("IC") is False else None
                if dataset.get("IC") is False and not cursor:
                    raise FabricPullError("Fabric query was truncated without a restart token.")
                return revenue_pull._decode(data), cursor
            except (requests.ConnectionError, requests.Timeout) as exc:
                if attempt == 2:
                    raise FabricPullError("Fabric query connection failed after retries.") from exc
                time.sleep(1.5 * (attempt + 1))
        raise FabricPullError("Fabric authentication refresh failed.")

    def close(self) -> None:
        """Release the HTTP connection pool."""
        self.session.close()


def pull_fabric_consumption(tpids: list[int], progress: Callable | None = None,
                           chunk: int = CHUNK_SIZE, client: FabricQueryClient | None = None,
                           as_of: date | None = None) -> dict:
    """Pull all configured accounts in bounded chunks, including all workloads.

    The workload calendar ends yesterday in the Power BI service's UTC clock.
    NRT has its own retained time span and must not be mislabeled as 28-day data.
    """
    tpids = sorted(set(int(t) for t in tpids))
    if not tpids or chunk < 1:
        raise FabricPullError("At least one TPID and a positive chunk size are required.")
    as_of = as_of or datetime.now(timezone.utc).date() - timedelta(days=1)
    reader = client or FabricQueryClient()
    output = {
        "customer_totals": [], "customer_workloads": [], "workload_totals": [], "workloads": [],
        "capacities": [], "trends": [],
        "revenue_summary": [], "revenue_months": [],
    }
    batches = [tpids[i:i + chunk] for i in range(0, len(tpids), chunk)]
    try:
        for index, batch in enumerate(batches):
            customer_query, customer_extension = build_customer_query(batch, as_of)
            mau_query, mau_extension = build_mau_query(batch, as_of)
            queries = [
                ("customer_totals", customer_query, WORKLOAD_REPORT_ID, customer_extension),
                ("customer_workloads", build_customer_workload_query(batch, as_of),
                 WORKLOAD_REPORT_ID, None),
                ("workload_totals", build_workload_query(batch, as_of), WORKLOAD_REPORT_ID, None),
                ("capacities", build_capacity_query(batch), CAPACITY_REPORT_ID,
                 _capacity_extension()),
                ("customer_mau", mau_query, WORKLOAD_REPORT_ID, mau_extension),
                *_revenue_queries(batch, as_of),
            ]
            discovered: dict[str, list[dict]] = {}
            for kind, query, report, extension in queries:
                if progress:
                    progress({
                        "phase": kind, "progress": int(index / len(batches) * 90),
                        "message": f"Batch {index + 1}/{len(batches)}: querying {kind}.",
                    })
                rows = _query_scoped(reader, query, report, extension, "a", "TPID", batch, True)
                _validate_scope(rows, batch)
                discovered[kind] = rows
                if kind == "customer_mau":
                    customers = {str(row["tpid"]): row for row in discovered["customer_totals"]}
                    for row in rows:
                        key = str(row["tpid"])
                        if key not in customers:
                            customers[key] = {"tpid": row["tpid"], "cu_hours": None}
                            output["customer_totals"].append(customers[key])
                        customers[key]["fabric_core_mau"] = row.get("fabric_core_mau")
                else:
                    output[kind].extend(rows)
                if progress:
                    progress({
                        "phase": kind, "progress": int(index / len(batches) * 90),
                        "message": f"Batch {index + 1}/{len(batches)}: loaded {kind}.",
                    })
            for kind, summary, query_builder, report in [
                ("workloads", "workload_totals", build_workload_query, WORKLOAD_REPORT_ID),
                ("trends", "capacities", build_capacity_query, CAPACITY_REPORT_ID),
            ]:
                ids = sorted({row["capacity_id"] for row in discovered[summary]
                              if row.get("capacity_id")})
                # An explicit empty source query still checks family completeness;
                # nonempty families are bounded by discovered capacities.
                slices = [ids[i:i + CAPACITY_CHUNK_SIZE]
                          for i in range(0, len(ids), CAPACITY_CHUNK_SIZE)] or [[]]
                for capacity_ids in slices:
                    query = (query_builder(batch, as_of, True) if kind == "workloads"
                             else query_builder(batch, True))
                    if capacity_ids:
                        query["Where"].append(_members(
                            "cap" if kind == "workloads" else "f",
                            "Capacity Id", capacity_ids,
                        ))
                    rows = _query_scoped(
                        reader, query, report, None,
                        "cap" if kind == "workloads" else "f", "Capacity Id", capacity_ids,
                    ) if capacity_ids else reader.query(query, report)
                    _validate_scope(rows, batch)
                    if capacity_ids and any(
                            row.get("capacity_id") not in capacity_ids for row in rows):
                        raise FabricPullError(
                            "Fabric returned a capacity outside the requested scope."
                        )
                    output[kind].extend(rows)
                    if progress:
                        progress({
                            "phase": kind, "progress": int(index / len(batches) * 90),
                            "message": (
                                f"Batch {index + 1}/{len(batches)}: "
                                f"loaded {kind} for {len(capacity_ids)} capacities."
                            ),
                        })
            if progress:
                progress({
                    "phase": "pull", "progress": int((index + 1) / len(batches) * 90),
                    "message": f"Loaded {index + 1}/{len(batches)} Fabric account batches.",
                })
    finally:
        if client is None:
            reader.close()
    output["metadata"] = {
        "dataset_id": DATASET_ID, "workload_report_id": WORKLOAD_REPORT_ID,
        "capacity_report_id": CAPACITY_REPORT_ID, "source_timezone": SOURCE_TIMEZONE,
        "report_display_timezone": "America/Los_Angeles",
        "calendar_timezone": "UTC",
        "workload_calendar_start": (as_of - timedelta(days=364)).isoformat(),
        "workload_calendar_end": as_of.isoformat(), "workload_window_days": 28,
        "capacity_window": "source-retained NRT history",
        "requested_tpids": tpids, "complete": True,
        "revenue": _revenue_metadata(tpids, as_of),
    }
    validate_revenue_payload({
        "metadata": output["metadata"]["revenue"],
        **{kind: output[kind] for kind in REVENUE_FIELDS},
    }, set(tpids))
    return output


def _validate_scope(rows: list[dict], tpids: list[int]) -> None:
    """Reject unscoped source rows before any family is accumulated."""
    scope = {str(tpid) for tpid in tpids}
    if any(str(row.get("tpid")) not in scope for row in rows):
        raise FabricPullError("Fabric returned an account outside the requested scope.")


def _query_scoped(reader: FabricQueryClient, query: dict, report: str, extension: dict | None,
                  source: str, field: str, members: list, numeric: bool = False) -> list[dict]:
    """Bisect resource-heavy source queries without dropping any requested member."""
    try:
        return reader.query(query, report, extension)
    except FabricPullError as exc:
        retryable = any(code in str(exc) for code in (
            "rsQueryTimeoutExceeded", "rsQueryMemoryLimitExceeded", "rsResourceGovernance",
        ))
        if not retryable or len(members) < 2:
            raise
        rows: list[dict] = []
        for subset in (members[:len(members) // 2], members[len(members) // 2:]):
            scoped = dict(query)
            scoped["Where"] = [*query["Where"], (
                _tpids(subset) if numeric else _members(source, field, subset)
            )]
            rows.extend(_query_scoped(reader, scoped, report, extension, source, field,
                                      subset, numeric))
        return rows
