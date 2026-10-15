"""Read the published P-to-F renewal assessments and subscription-detail grains."""
from __future__ import annotations

from datetime import date
from typing import Callable

from app.services import revenue_pull
from app.services.fabric_consumption_pull import FabricQueryClient

DATASET_ID = "9de04ab0-f2d4-46ec-aabb-894827b3496f"
REPORT_ID = "7f2070e7-0ebf-4e95-a788-3eb59d0ed833"
MODEL_ID = 6259815
SUMMARY_TABLE = "\u25e6 Fabric WCS"
DETAIL_TABLE = "\u25e6 Fabric WCS (Detail)"
MEASURES_TABLE = "\u25e6 Measure"
CHUNK_SIZE = 100
SUMMARY_COLUMNS = {
    "renewal_status": "Renewal Status",
    "renewal_status_group": "Renewal Status Group",
    "psku_renewal_ratio": "PSKU Renewal %",
    "fsku_renewal_ratio": "FSKU Renewal %",
    "fsku_paygo_annualized": "FSKU PayGo ACR Annualized",
}
SUMMARY_SUMS = {
    "sa_expiration_amount": "SA Expiration Amount",
    "psku_renewal_amount": "PSKU Renewal Amount",
    "fsku_ri_annualized": "FSKU RI ACR Annualized",
}
DETAIL_COLUMNS = {
    "expiration_date": "Expiration Date",
    "subscription_status": "Subscription Status",
    "product_family": "Product Family",
}
DETAIL_SUMS = {
    "sa_expiration_amount": "SA Expiration Amount",
    "psku_renewal_amount": "PSKU Renewal Amount",
}


def fiscal_years(today: date | None = None) -> list[str]:
    """Match the capture's two prior, current, and next fiscal years."""
    today = today or date.today()
    current = today.year + (today.month >= 7)
    return [f"FY{year % 100:02}" for year in range(current - 2, current + 2)]


def _aggregate(field: str, name: str, function: int = 0) -> dict:
    """Aggregate a source column without changing the visual's grouping grain."""
    return {
        "Aggregation": {
            "Expression": {"Column": revenue_pull._col("t", field, name)["Column"]},
            "Function": function,
        },
        "Name": name,
    }


def build_query(tpids: list[int], years: list[str], *, detail: bool) -> dict:
    """Reproduce each visual's source fields with a complete, local TPID scope."""
    columns = DETAIL_COLUMNS if detail else SUMMARY_COLUMNS
    sums = DETAIL_SUMS if detail else SUMMARY_SUMS
    select = [
        revenue_pull._col("t", "TPID", "tpid"),
        revenue_pull._col("a", "TopParent", "source_customer_name"),
        *[revenue_pull._col("t", field, name) for name, field in columns.items()],
        *[_aggregate(field, name) for name, field in sums.items()],
    ]
    if not detail:
        select.extend([
            _aggregate("Expiration Date", "earliest_expiration", 3),
            _aggregate("Expiration Date", "latest_expiration", 4),
            revenue_pull._mea("m", "# of EA Total", "ea_count"),
            revenue_pull._mea("m", "# of EA Renewed", "renewed_ea_count"),
        ])
    return {
        "Version": 2,
        "From": [
            {"Name": "t", "Entity": DETAIL_TABLE if detail else SUMMARY_TABLE, "Type": 0},
            {"Name": "a", "Entity": "2) Account", "Type": 0},
            {"Name": "c", "Entity": "1) Calendar", "Type": 0},
            {"Name": "m", "Entity": MEASURES_TABLE, "Type": 0},
        ],
        "Select": select,
        "Where": [
            revenue_pull._in("t", "TPID", [f"{tpid}L" for tpid in tpids]),
            revenue_pull._in("c", "Fiscal Year", [f"'{year}'" for year in years]),
            revenue_pull._not_in("a", "FieldArea", ["'US Federal'"]),
            revenue_pull._not_in("a", "SubSegment", ["null"]),
        ],
    }


def pull_ptof(tpids: list[int], progress: Callable | None = None,
              client: FabricQueryClient | None = None) -> dict:
    """Read both visuals completely before any local snapshot can be replaced."""
    if not tpids or any(isinstance(tpid, bool) or not isinstance(tpid, int) or tpid <= 0
                        for tpid in tpids):
        raise ValueError("P to F requires positive integer TPIDs.")
    tpids = sorted(set(tpids))
    years = fiscal_years()
    owned = client is None
    client = client or FabricQueryClient(dataset_id=DATASET_ID, model_id=MODEL_ID)
    payload = {"summary": [], "details": [], "metadata": {
        "complete": True, "requested_tpids": tpids, "fiscal_years": years,
        "dataset_id": DATASET_ID, "report_id": REPORT_ID,
        "source_filters": "Excludes US Federal and blank account SubSegment.",
        "status_source": "Published model; statuses are not recalculated locally.",
    }}
    chunks = [tpids[i:i + CHUNK_SIZE] for i in range(0, len(tpids), CHUNK_SIZE)]
    try:
        total = len(chunks) * 2
        done = 0
        for kind in ("summary", "details"):
            for chunk in chunks:
                if progress:
                    progress({"phase": kind, "progress": 5 + 80 * done / total,
                              "message": f"Reading P to F {kind} ({done + 1}/{total})."})
                payload[kind].extend(client.query(
                    build_query(chunk, years, detail=kind == "details"), REPORT_ID,
                ))
                done += 1
        payload["metadata"]["model_id"] = client.model_id
        return payload
    finally:
        if owned:
            client.close()
