"""Atomic manual Fabric imports and report reads, with no scheduler registration."""
from __future__ import annotations

import json
import logging
import math
import threading
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable

from flask import current_app
from sqlalchemy.orm import joinedload

from app.models import Customer, FabricConsumptionImport, FabricConsumptionRecord, SyncStatus, db
from app.services.fabric_consumption_pull import (
    FabricPullError, pull_fabric_consumption, pull_fabric_revenue, validate_revenue_payload,
)

logger = logging.getLogger(__name__)
SYNC_TYPE = "fabric_consumption"
HEARTBEAT_INTERVAL_SECONDS = min(20, SyncStatus.HEARTBEAT_ALIVE_SECONDS / 3)
_IMPORT_LOCK = threading.Lock()
REVENUE_SYNC_TYPE = "fabric_revenue"
_REVENUE_KINDS = {"revenue_summary": "revenue_summary", "revenue_months": "revenue_month"}
_KINDS = {
    "customer_totals": "customer", "workload_totals": "workload_total",
    "customer_workloads": "workload_summary",
    "workloads": "workload", "capacities": "capacity", "trends": "trend",
    **_REVENUE_KINDS,
}
_DIMENSIONS = {
    "tpid", "tenant_id", "capacity_id", "sku", "observed_at",
    "workload", "artifact_kind", "operation",
    "fiscal_month", "fiscal_month_id", "reporting_fiscal_month_id",
}


def _current_tpids(customers: list) -> list[int]:
    """Use exact positive TPIDs; never truncate a malformed fractional account identifier."""
    values = []
    for customer in customers:
        value = customer.tpid
        if value is None or isinstance(value, int) and not isinstance(value, bool) and value <= 0:
            continue
        if isinstance(value, bool) or not str(value).isdigit():
            raise FabricPullError("A local customer has an invalid TPID. Correct it before importing.")
        if int(value) > 0:
            values.append(int(value))
    return sorted(set(values))


def _number(value: Any) -> float | None:
    """Keep missing/non-finite values null rather than inventing zero usage."""
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def _percentage(numerator: Any, denominator: Any) -> float | None:
    """Compute a percent only with a positive, known denominator."""
    value, total = _number(numerator), _number(denominator)
    return value / total * 100 if value is not None and total is not None and total > 0 else None


def _source_datetime(value: Any) -> datetime | None:
    """Read UTC NRT timestamps, verified against the HAR's UTC/Pacific as-of label."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Power BI datetime DSR uses Unix milliseconds.
        parsed = datetime.fromtimestamp(value / 1000, timezone.utc)
    elif isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise FabricPullError("Fabric returned an invalid source timestamp.") from exc
    else:
        raise FabricPullError("Fabric returned an unsupported source timestamp.")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _metrics(row: dict, kind: str) -> dict:
    """Normalize numeric metrics, retaining dimensions and ratio semantics."""
    metrics = {
        name: (value if name in _DIMENSIONS or name == "autoscale" else _number(value))
        for name, value in row.items() if name not in {"tpid", "observed_at"}
    }
    for name in ("latest_utilization_ratio", "max_30s_utilization_ratio", "mom_change_ratio"):
        if name in metrics:
            metrics[name.replace("_ratio", "_pct")] = (
                metrics[name] * 100 if metrics[name] is not None else None
            )
    if kind in _REVENUE_KINDS.values():
        metrics["reservation_share_pct"] = (
            metrics["reservation_share_ratio"] * 100
            if metrics.get("reservation_share_ratio") is not None else None
        )
        for field in ("fiscal_month_id", "reporting_fiscal_month_id"):
            if field in metrics and metrics[field] is not None:
                metrics[field] = int(metrics[field])
    if kind in ("capacity", "trend"):
        interactive = _number(row.get("interactive_cu_seconds"))
        background = _number(row.get("background_cu_seconds"))
        available = _number(row.get("available_cu_seconds"))
        autoscale = _number(row.get("autoscale_cu_seconds"))
        consumed = (
            interactive + background
            if interactive is not None and background is not None else None
        )
        denominator = (
            available + autoscale if available is not None and autoscale is not None else None
        )
        metrics["utilization_pct"] = _percentage(consumed, denominator)
        metrics["smoothed_cu_hours"] = consumed / 3600 if consumed is not None else None
        metrics["interactive_usage_pct"] = _percentage(interactive, consumed)
        metrics["background_usage_pct"] = _percentage(background, consumed)
    return metrics


def _validate_pull(payload: dict, tpids: set[int]) -> None:
    """Reject incomplete, foreign, malformed, or contradictory result sets."""
    metadata = payload.get("metadata") or {}
    if metadata.get("complete") is not True or set(metadata.get("requested_tpids", [])) != tpids:
        raise FabricPullError("Fabric pull did not confirm the full requested account scope.")
    for name in _KINDS:
        if not isinstance(payload.get(name), list):
            raise FabricPullError(f"Fabric pull omitted its {name} result set.")
        for row in payload[name]:
            try:
                tpid = int(row["tpid"])
            except (KeyError, TypeError, ValueError) as exc:
                raise FabricPullError("Fabric returned a row without a valid TPID.") from exc
            if tpid not in tpids:
                raise FabricPullError("Fabric returned an account outside the requested scope.")
            if (name not in ("customer_totals", "customer_workloads", *_REVENUE_KINDS)
                    and not row.get("capacity_id")):
                raise FabricPullError("Fabric returned a row without its capacity grain.")
            if name == "trends" and row.get("observed_at") is None:
                raise FabricPullError("Fabric returned a trend without its timestamp.")
    validate_revenue_payload({
        "metadata": metadata.get("revenue"),
        **{name: payload[name] for name in _REVENUE_KINDS},
    }, tpids)
    if not any(payload[name] for name in _KINDS if name not in _REVENUE_KINDS):
        raise FabricPullError(
            "Fabric returned no consumption data. The previous import is retained."
        )
    totals = {(int(r["tpid"]), r.get("tenant_id"), r.get("capacity_id"))
              for r in payload["workload_totals"]}
    for row in payload["workloads"]:
        if (int(row["tpid"]), row.get("tenant_id"), row.get("capacity_id")) not in totals:
            raise FabricPullError("Fabric workload rows have no matching capacity denominator.")
    capacities = {(int(r["tpid"]), r.get("tenant_id"), r.get("capacity_id"))
                  for r in payload["capacities"]}
    for row in payload["trends"]:
        if (int(row["tpid"]), row.get("tenant_id"), row.get("capacity_id")) not in capacities:
            raise FabricPullError("Fabric trend rows have no matching capacity summary.")
    workloads_by_customer: dict[int, list] = defaultdict(list)
    summaries_by_customer: dict[int, list] = defaultdict(list)
    trends_by_capacity: dict[tuple, list] = defaultdict(list)
    for row in payload["workloads"]:
        workloads_by_customer[int(row["tpid"])].append(row.get("cu_hours"))
    for row in payload["customer_workloads"]:
        summaries_by_customer[int(row["tpid"])].append(row.get("cu_hours"))
    for row in payload["trends"]:
        trends_by_capacity[
            (int(row["tpid"]), row.get("tenant_id"), row.get("capacity_id"))
        ].append(row)
    for summary in payload["customer_totals"]:
        total = _number(summary.get("cu_hours"))
        detail = workloads_by_customer[int(summary["tpid"])]
        if total is not None and total > 0:
            # MoM can produce a row for an operation with only prior-period
            # usage. Its current CU measure is legitimately blank.
            actual = _known_sum([value for value in detail if value is not None])
            if actual is None or not math.isclose(actual, total, rel_tol=1e-6, abs_tol=0.001):
                raise FabricPullError(
                    "Fabric workload detail does not reconcile to customer CU hours."
                )
            measured = _known_sum([
                value for value in summaries_by_customer[int(summary["tpid"])] if value is not None
            ])
            if measured is None or not math.isclose(measured, total, rel_tol=1e-6, abs_tol=0.001):
                raise FabricPullError(
                    "Fabric workload summaries do not reconcile to customer CU hours."
                )
    for summary in payload["capacities"]:
        identity = (int(summary["tpid"]), summary.get("tenant_id"), summary.get("capacity_id"))
        detail = trends_by_capacity[identity]
        for metric in ("interactive_cu_seconds", "background_cu_seconds", "unsmoothed_cu_hours"):
            total = _number(summary.get(metric))
            if total is not None and total > 0:
                actual = _known_sum([row[metric] for row in detail if row.get(metric) is not None])
                if actual is None or not math.isclose(actual, total, rel_tol=1e-6, abs_tol=0.001):
                    raise FabricPullError(
                        "Fabric capacity time series is missing consumption detail."
                    )


def sync_fabric_consumption(
        progress: Callable | None = None, *, claimed: bool = False) -> dict:
    """Import every DB customer's TPID atomically, only when explicitly called.

    Set ``claimed=True`` only after the route has atomically claimed SyncStatus.
    Heartbeats continue during network waits. Empty, partial, and failed pulls
    never supersede a successful snapshot.
    """
    if not _IMPORT_LOCK.acquire(blocking=False):
        return {"success": False, "error": "A Fabric import is already running."}
    owns_claim = False
    claim_started_at = None
    heartbeat_stop = threading.Event()
    heartbeat_thread = None
    try:
        if not claimed:
            if not SyncStatus.try_mark_started(SYNC_TYPE):
                return {"success": False, "error": "A Fabric import is already running."}
            owns_claim = True
        status = SyncStatus.query.filter_by(sync_type=SYNC_TYPE).first()
        if (status is None or status.started_at is None or status.completed_at is not None
                or status.success is not None
                or SyncStatus.get_status(SYNC_TYPE)["state"] != "in_progress"):
            raise FabricPullError("A full Fabric import requires an active telemetry import claim.")
        claim_started_at = status.started_at
        owns_claim = True
        flask_app = current_app._get_current_object()

        def heartbeat() -> None:
            """Keep the cross-process claim alive even during a slow QES request."""
            while not heartbeat_stop.wait(HEARTBEAT_INTERVAL_SECONDS):
                try:
                    with flask_app.app_context():
                        status = SyncStatus.query.filter_by(
                            sync_type=SYNC_TYPE, started_at=claim_started_at,
                            completed_at=None, success=None,
                        ).first()
                        if status is not None:
                            SyncStatus.update_heartbeat(SYNC_TYPE)
                except Exception:
                    logger.exception("Could not update Fabric import heartbeat")

        def report_progress(event: dict) -> None:
            """Persist progress for polling clients without committing snapshot writes."""
            if event.get("sync_type", SYNC_TYPE) != SYNC_TYPE:
                raise FabricPullError("Revenue-only progress cannot update telemetry import status.")
            status = SyncStatus.query.filter_by(
                sync_type=SYNC_TYPE, started_at=claim_started_at,
                completed_at=None, success=None,
            ).first()
            if status is None:
                raise FabricPullError("The full Fabric import no longer owns its telemetry claim.")
            status.details = json.dumps(event)
            status.heartbeat_at = datetime.now(timezone.utc)
            db.session.commit()
            if progress:
                progress(event)

        heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
        heartbeat_thread.start()
        customers = Customer.query.order_by(Customer.id).all()
        _current_tpids(customers)
        mapping = {int(customer.tpid): customer.id for customer in customers
                   if customer.tpid and customer.tpid > 0}
        if not mapping:
            raise FabricPullError("No customers with a TPID found. Import accounts first.")
        payload = pull_fabric_consumption(list(mapping), progress=report_progress)
        _validate_pull(payload, set(mapping))
        report_progress({
            "phase": "saving", "progress": 95, "message": "Saving Fabric consumption snapshot.",
        })
        snapshot = FabricConsumptionImport(
            imported_at=datetime.now(timezone.utc), customer_count=len(mapping),
            workload_row_count=len(payload["workloads"]),
            capacity_row_count=len(payload["capacities"]), trend_row_count=len(payload["trends"]),
            metadata_json=payload["metadata"],
        )
        db.session.add(snapshot)
        db.session.flush()
        observed: list[datetime] = []
        for name, kind in _KINDS.items():
            if name in _REVENUE_KINDS:
                continue
            for row in payload[name]:
                stamp = _source_datetime(row.get("observed_at"))
                if stamp:
                    observed.append(stamp)
                db.session.add(FabricConsumptionRecord(
                    import_id=snapshot.id, customer_id=mapping[int(row["tpid"])],
                    tpid=int(row["tpid"]), kind=kind, capacity_id=row.get("capacity_id"),
                    sku=row.get("sku"), observed_at=stamp, metrics_json=_metrics(row, kind),
                ))
        _stage_revenue(snapshot, {
            "metadata": payload["metadata"]["revenue"],
            **{name: payload[name] for name in _REVENUE_KINDS},
        }, customers, snapshot.imported_at)
        snapshot.source_as_of = max(observed) if observed else None
        # Replacement and insertion share one transaction: a failed write keeps
        # the previous complete snapshot and avoids unbounded time-series storage.
        FabricConsumptionRecord.query.filter(
            FabricConsumptionRecord.import_id != snapshot.id,
        ).delete(synchronize_session=False)
        FabricConsumptionImport.query.filter(
            FabricConsumptionImport.id != snapshot.id,
        ).delete(synchronize_session=False)
        result = {
            "success": True, "import_id": snapshot.id, "customer_count": snapshot.customer_count,
            "workload_row_count": snapshot.workload_row_count,
            "capacity_row_count": snapshot.capacity_row_count,
            "trend_row_count": snapshot.trend_row_count,
        }
        status = SyncStatus.query.filter_by(
            sync_type=SYNC_TYPE, started_at=claim_started_at, completed_at=None, success=None,
        ).first()
        if status is None:
            raise FabricPullError("The full Fabric import no longer owns its telemetry claim.")
        status.completed_at = datetime.now(timezone.utc)
        status.success = True
        status.items_synced = snapshot.customer_count
        status.details = json.dumps({"phase": "complete", "progress": 100, **result})
        db.session.commit()
        if progress:
            try:
                progress({"phase": "complete", "progress": 100, **result})
            except Exception:
                logger.warning("Fabric import completed but progress notification failed")
        return result
    except Exception as exc:
        db.session.rollback()
        logger.exception("Manual Fabric consumption import failed")
        message = str(exc) if isinstance(exc, FabricPullError) else (
            "Fabric import failed. Your previous successful import is unchanged."
        )
        if owns_claim and claim_started_at is not None:
            try:
                SyncStatus.query.filter_by(
                    sync_type=SYNC_TYPE, started_at=claim_started_at,
                    completed_at=None, success=None,
                ).update({
                    "completed_at": datetime.now(timezone.utc), "success": False,
                    "details": json.dumps({"phase": "failed", "success": False, "error": message}),
                }, synchronize_session=False)
                db.session.commit()
            except Exception:
                db.session.rollback()
                logger.exception("Could not persist failed Fabric import status")
        return {"success": False, "error": message}
    finally:
        heartbeat_stop.set()
        if heartbeat_thread and heartbeat_thread.is_alive():
            heartbeat_thread.join()
        _IMPORT_LOCK.release()


def _stage_revenue(snapshot, payload: dict, customers: list, stamp: datetime) -> None:
    """Stage exact-TPID revenue alongside telemetry without rewriting its original timestamps."""
    mapping = defaultdict(list)
    for customer in customers:
        if customer.tpid and customer.tpid > 0:
            mapping[int(customer.tpid)].append(customer.id)
    for name, kind in _REVENUE_KINDS.items():
        for row in payload[name]:
            for customer_id in mapping[int(row["tpid"])]:
                db.session.add(FabricConsumptionRecord(
                    import_id=snapshot.id, customer_id=customer_id, tpid=int(row["tpid"]),
                    kind=kind, metrics_json=_metrics(row, kind),
                ))
    snapshot.metadata_json = {
        **snapshot.metadata_json,
        "revenue": {
            **payload["metadata"], "imported_at": _iso(stamp), "refreshed_at": _iso(stamp),
            "summary_row_count": len(payload["revenue_summary"]),
            "month_row_count": len(payload["revenue_months"]),
        },
    }


def refresh_fabric_revenue(progress: Callable | None = None) -> dict:
    """Enrich the existing snapshot for all current TPIDs, never pulling capacity histories."""
    if not _IMPORT_LOCK.acquire(blocking=False):
        return {"success": False, "error": "A Fabric import is already running."}
    claimed = False
    heartbeat_stop = threading.Event()
    heartbeat_thread = None
    try:
        if SyncStatus.get_status(SYNC_TYPE)["state"] == "in_progress":
            raise FabricPullError("A Fabric import is already running.")
        if not SyncStatus.try_mark_started(REVENUE_SYNC_TYPE):
            raise FabricPullError("A Fabric revenue refresh is already running.")
        claimed = True
        flask_app = current_app._get_current_object()

        def heartbeat() -> None:
            """Keep the independent revenue claim alive through slow source requests."""
            while not heartbeat_stop.wait(HEARTBEAT_INTERVAL_SECONDS):
                try:
                    with flask_app.app_context():
                        SyncStatus.update_heartbeat(REVENUE_SYNC_TYPE)
                except Exception:
                    logger.warning("Could not update Fabric revenue heartbeat")

        heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
        heartbeat_thread.start()
        snapshot = FabricConsumptionImport.query.order_by(
            FabricConsumptionImport.imported_at.desc(), FabricConsumptionImport.id.desc(),
        ).first()
        if snapshot is None:
            raise FabricPullError("Import Fabric telemetry before refreshing its revenue.")
        snapshot_id = snapshot.id
        customers = Customer.query.order_by(Customer.id).all()
        tpids = _current_tpids(customers)
        if not tpids:
            raise FabricPullError("No customers with a TPID found.")

        def report_progress(event: dict) -> None:
            """Keep the maintenance claim alive before any source records are staged."""
            SyncStatus.update_heartbeat(REVENUE_SYNC_TYPE)
            if progress:
                progress(event)

        payload = pull_fabric_revenue(tpids, progress=report_progress)
        validate_revenue_payload(payload, set(tpids))
        db.session.expire_all()
        latest = FabricConsumptionImport.query.order_by(
            FabricConsumptionImport.imported_at.desc(), FabricConsumptionImport.id.desc(),
        ).first()
        if latest is None or latest.id != snapshot_id:
            raise FabricPullError("Fabric telemetry changed during the revenue refresh. Retry.")
        FabricConsumptionRecord.query.filter(
            FabricConsumptionRecord.import_id == snapshot_id,
            FabricConsumptionRecord.kind.in_(_REVENUE_KINDS.values()),
        ).delete(synchronize_session=False)
        _stage_revenue(latest, payload, customers, datetime.now(timezone.utc))
        result = {
            "success": True, "import_id": snapshot_id, "customer_count": len(tpids),
            "summary_row_count": len(payload["revenue_summary"]),
            "month_row_count": len(payload["revenue_months"]),
            "revenue_imported_at": latest.metadata_json["revenue"]["imported_at"],
        }
        # mark_completed commits the staged revenue and its status in the same transaction.
        SyncStatus.mark_completed(
            REVENUE_SYNC_TYPE, success=True, items_synced=len(tpids), details=json.dumps(result),
        )
        if progress:
            try:
                progress({
                    "sync_type": REVENUE_SYNC_TYPE, "scope": "revenue_only",
                    "phase": "complete", "progress": 100, **result,
                })
            except Exception:
                logger.warning("Fabric revenue refreshed but progress notification failed")
        return result
    except Exception as exc:
        db.session.rollback()
        logger.warning("Fabric revenue refresh failed (%s)", type(exc).__name__)
        message = str(exc) if isinstance(exc, FabricPullError) else (
            "Fabric revenue refresh failed. Previous revenue and telemetry are unchanged."
        )
        if claimed:
            try:
                SyncStatus.mark_completed(
                    REVENUE_SYNC_TYPE, success=False, details=json.dumps({"error": message}),
                )
            except Exception:
                db.session.rollback()
                logger.warning("Could not persist Fabric revenue failure status")
        return {"success": False, "error": message}
    finally:
        heartbeat_stop.set()
        if heartbeat_thread and heartbeat_thread.is_alive():
            heartbeat_thread.join()
        _IMPORT_LOCK.release()


def _customer_revenue(snapshot, records: list, tpid: int | None, *, months: bool = True) -> dict:
    """Read independent account-level revenue provenance, preserving missing and credit values."""
    metadata = dict((snapshot.metadata_json if snapshot else {}).get("revenue") or {})
    scope = set(metadata.pop("requested_tpids", []))
    records = [record for record in records if record.tpid == tpid]
    summary = dict.fromkeys((
        "total_revenue_ytd", "reservation_revenue_ytd",
        "paygo_revenue_ytd", "reservation_share_pct",
    ))
    values = []
    reporting_id = None
    for record in records:
        metrics = record.metrics_json
        if record.kind == "revenue_summary":
            summary.update({field: metrics.get(field) for field in summary})
            reporting_id = metrics.get("reporting_fiscal_month_id")
        else:
            values.append({field: metrics.get(field) for field in (
                "fiscal_month", "fiscal_month_id", "reservation_revenue", "paygo_revenue",
                "total_revenue", "reservation_share_pct",
            )})
    values.sort(key=lambda row: row["fiscal_month_id"])
    measured = any(value is not None for value in summary.values()) or any(
        row.get(field) is not None for row in values
        for field in ("reservation_revenue", "paygo_revenue", "total_revenue")
    )
    state = (
        "not_imported" if not metadata or tpid not in scope else
        "available" if measured else "no_data"
    )
    latest_label = next(
        (row["fiscal_month"] for row in values if row["fiscal_month_id"] == reporting_id), None,
    )
    fiscal_year_label = None
    if latest_label and metadata.get("fiscal_year_end") == "June 30":
        try:
            reported_month = datetime.strptime(latest_label, "%B, %Y")
            ending_year = reported_month.year + (reported_month.month > 6)
            fiscal_year_label = f"FY{ending_year}"
        except ValueError:
            pass
    metadata.update(
        latest_reporting_fiscal_month_id=reporting_id,
        latest_reporting_month=latest_label, latest_month_label=latest_label,
        fiscal_year_label=fiscal_year_label,
        fiscal_year_label_basis=(
            "Source reporting month label and captured DATESYTD June 30 fiscal-year end."
            if fiscal_year_label else None
        ),
        unit_label="Source revenue (CD)" if metadata.get("reported_units") == "CD" else None,
        months_loaded=months,
    )
    return {"state": state, "summary": summary, "months": values if months else [],
            "metadata": metadata}


def has_fabric_data() -> bool:
    """Return whether a complete Fabric snapshot has been imported."""
    return FabricConsumptionImport.query.first() is not None


def _iso(value: datetime | None) -> str | None:
    """Serialize SQLite's UTC-naive stored timestamps with an explicit UTC suffix."""
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def _known_sum(values: list[Any]) -> float | None:
    """Return null when any contributing value is missing, including empty groups."""
    parsed = [_number(value) for value in values]
    return sum(parsed) if parsed and all(value is not None for value in parsed) else None


def _get_raw_fabric_report(customer_id: int | None = None) -> dict:
    """Read the latest complete import, grouped for the report and customer drilldown."""
    snapshot = FabricConsumptionImport.query.order_by(
        FabricConsumptionImport.imported_at.desc(), FabricConsumptionImport.id.desc(),
    ).first()
    base = {"last_import": None, "customers": [], "totals": {}, "metadata": {}}
    if snapshot is None:
        return base
    customers_query = Customer.query.order_by(Customer.name)
    if customer_id is not None:
        customers_query = customers_query.filter(Customer.id == customer_id)
    customers = customers_query.all()
    query = FabricConsumptionRecord.query.filter_by(import_id=snapshot.id)
    query = query.filter(~FabricConsumptionRecord.kind.in_(_REVENUE_KINDS.values()))
    if customer_id is not None:
        query = query.filter_by(customer_id=customer_id)
    groups: dict[int, list] = defaultdict(list)
    for record in query.all():
        groups[record.customer_id].append(record)
    requested = set(snapshot.metadata_json.get("requested_tpids", []))
    for customer in customers:
        records = groups[customer.id]
        account = {
            "customer_id": customer.id, "tpid": customer.tpid, "name": customer.get_display_name(),
            "workloads": [], "capacities": [], "trends": [], "workload_totals": [],
            "cu_hours": None, "direct_lake_cu_hours": None, "direct_lake_pct": None,
            "fabric_core_mau": None, "mom_change_pct": None,
            "data_status": "no_data" if customer.tpid in requested else "not_imported",
        }
        workload_groups: dict[str, list[dict]] = defaultdict(list)
        workload_summaries: dict[str, dict] = {}
        capacity_denominators: dict[tuple, Any] = {}
        for record in records:
            if record.kind == "workload_total":
                capacity_denominators[
                    (record.metrics_json.get("tenant_id"), record.capacity_id)
                ] = record.metrics_json.get("cu_hours")
        for record in records:
            metrics = dict(record.metrics_json)
            metrics["capacity_id"] = record.capacity_id
            metrics["sku"] = record.sku
            if record.kind == "customer":
                account.update(metrics)
                account["direct_lake_pct"] = _percentage(
                    metrics.get("direct_lake_cu_hours"), metrics.get("cu_hours"),
                )
            elif record.kind == "workload":
                metrics["usage_pct"] = _percentage(
                    metrics.get("cu_hours"),
                    capacity_denominators.get((metrics.get("tenant_id"), record.capacity_id)),
                )
                workload_groups[metrics.get("workload") or "Unknown"].append(metrics)
            elif record.kind == "workload_summary":
                workload_summaries[metrics.get("workload") or "Unknown"] = metrics
            elif record.kind == "workload_total":
                account["workload_totals"].append(metrics)
            elif record.kind == "capacity":
                account["capacities"].append(metrics)
            elif record.kind == "trend":
                metrics["observed_at"] = _iso(record.observed_at)
                account["trends"].append(metrics)
        if records:
            account["data_status"] = "available"
        for workload in sorted(workload_summaries.keys() | workload_groups.keys()):
            rows = workload_groups[workload]
            summary = workload_summaries.get(workload, {})
            hours = summary.get("cu_hours")
            account["workloads"].append({
                "workload": workload, "cu_hours": hours,
                "usage_pct": _percentage(hours, account["cu_hours"]), "details": rows,
                "mom_change_pct": summary.get("mom_change_pct"),
            })
        account["capacities"].sort(key=lambda row: (row.get("capacity_id") or ""))
        account["trends"].sort(key=lambda row: (row.get("capacity_id") or "",
                                               row.get("observed_at") or ""))
        base["customers"].append(account)
    base["last_import"] = {
        "id": snapshot.id, "imported_at": _iso(snapshot.imported_at),
        "source_as_of": _iso(snapshot.source_as_of), "customer_count": snapshot.customer_count,
        "workload_row_count": snapshot.workload_row_count,
        "capacity_row_count": snapshot.capacity_row_count,
        "trend_row_count": snapshot.trend_row_count,
    }
    base["metadata"] = dict(snapshot.metadata_json)
    base["totals"] = {
        "customer_count": len(base["customers"]),
        "customers_with_data": sum(c["data_status"] == "available" for c in base["customers"]),
        "capacity_count": sum(len(c["capacities"]) for c in base["customers"]),
        "cu_hours": _known_sum([c["cu_hours"] for c in base["customers"]]),
    }
    return base


def get_fabric_report(customer_id: int | None = None) -> dict:
    """Return a lightweight account directory plus the selected customer's full detail.

    Percentage fields use percent units, not fractions, without clamping valid
    overload values above 100. A native workload as-of is not inferred from the
    report's calendar filter end.
    """
    snapshot = FabricConsumptionImport.query.order_by(
        FabricConsumptionImport.imported_at.desc(), FabricConsumptionImport.id.desc(),
    ).first()
    customers = Customer.query.options(joinedload(Customer.seller)).order_by(Customer.name).all()
    totals_by_customer: dict[int, dict] = {}
    counts_by_customer: dict[int, int] = {}
    available_customers: set[int] = set()
    revenue_by_customer: dict[int, list] = defaultdict(list)
    if snapshot:
        for record in FabricConsumptionRecord.query.filter(
            FabricConsumptionRecord.import_id == snapshot.id,
            FabricConsumptionRecord.kind.in_(_REVENUE_KINDS.values()),
        ).all():
            revenue_by_customer[record.customer_id].append(record)
        for record in FabricConsumptionRecord.query.filter_by(
                import_id=snapshot.id, kind="customer").all():
            totals_by_customer[record.customer_id] = record.metrics_json
        counts_by_customer = dict(
            db.session.query(
                FabricConsumptionRecord.customer_id, db.func.count(FabricConsumptionRecord.id),
            ).filter_by(import_id=snapshot.id, kind="capacity")
            .group_by(FabricConsumptionRecord.customer_id).all()
        )
        available_customers = {
            row[0] for row in db.session.query(FabricConsumptionRecord.customer_id)
            .filter_by(import_id=snapshot.id)
            .filter(~FabricConsumptionRecord.kind.in_(_REVENUE_KINDS.values()))
            .group_by(FabricConsumptionRecord.customer_id).all()
        }
    directory = []
    for account in customers:
        valid_tpid = account.tpid is not None and account.tpid > 0
        directory.append({
            "id": account.id, "name": account.get_display_name(), "tpid": account.tpid,
            "account_name": account.name, "nickname": account.nickname,
            "seller": {"id": account.seller.id, "name": account.seller.name}
            if account.seller else None,
            "status": (
                "missing_tpid" if not valid_tpid else
                "available" if account.id in available_customers else "no_data"
            ),
            "capacity_count": counts_by_customer.get(account.id, 0),
            "total_cu_hours": totals_by_customer.get(account.id, {}).get("cu_hours"),
            "revenue": _customer_revenue(
                snapshot, revenue_by_customer[account.id], account.tpid, months=False,
            ),
        })
    metadata = dict(snapshot.metadata_json) if snapshot else {}
    header = {
        "id": snapshot.id, "imported_at": _iso(snapshot.imported_at),
        "workload_as_of": metadata.get("workload_as_of"),
        "capacity_as_of": _iso(snapshot.source_as_of),
        "workload_window": "Rolling 28 days (source measure)",
        "capacity_window": metadata.get("capacity_window", "Source-retained NRT history"),
        "customer_count": snapshot.customer_count,
        "workload_row_count": snapshot.workload_row_count,
        "capacity_row_count": snapshot.capacity_row_count,
        "trend_row_count": snapshot.trend_row_count,
    } if snapshot else None
    selected_summary = next((row for row in directory if row["id"] == customer_id), None)
    selected = None
    if selected_summary:
        raw = _get_raw_fabric_report(customer_id)["customers"] if snapshot else []
        selected = _build_customer_detail(selected_summary, raw[0] if raw else {})
        selected["revenue"] = _customer_revenue(
            snapshot, revenue_by_customer[customer_id], selected_summary["tpid"],
        )
    return {
        "snapshot": header, "customers": directory, "customer": selected,
        "metadata": metadata,
        "totals": {
            "customer_count": len(directory),
            "customers_with_data": len(available_customers),
            "capacity_count": sum(counts_by_customer.values()),
            "cu_hours": _known_sum([row["total_cu_hours"] for row in directory]),
        },
    }


def get_fabric_capacity_overview() -> dict:
    """Read capacity rows with explicitly customer-wide rolling workload shares.

    Operation-grain measures can be null and are not a complete per-workload
    capacity summary. Reuse the native customer workload measures instead.
    """
    report = get_fabric_report()
    snapshot = report["snapshot"]
    capacities: dict[int, list[dict]] = defaultdict(list)
    workloads: dict[int, dict[str, Any]] = defaultdict(dict)
    if snapshot:
        records = FabricConsumptionRecord.query.filter(
            FabricConsumptionRecord.import_id == snapshot["id"],
            FabricConsumptionRecord.kind.in_(["capacity", "workload_summary"]),
        ).all()
        for record in records:
            if record.kind == "capacity":
                capacities[record.customer_id].append({
                    **record.metrics_json, "capacity_id": record.capacity_id, "sku": record.sku,
                })
            else:
                workloads[record.customer_id][
                    record.metrics_json.get("workload") or "Unknown"
                ] = record.metrics_json.get("cu_hours")
    names = sorted({name for values in workloads.values() for name in values})
    rows = []
    for customer in report["customers"]:
        values = workloads[customer["id"]]
        measured = _known_sum(list(values.values()))
        total = _number(customer["total_cu_hours"])
        complete = (
            measured is not None and total is not None and total > 0
            and math.isclose(measured, total, rel_tol=1e-6, abs_tol=0.001)
        )
        shares = {
            name: _percentage(values.get(name, 0 if complete else None), total)
            for name in names
        }
        ordered = _order_capacities(capacities[customer["id"]])
        for index, capacity in enumerate(ordered or [None], start=1):
            rows.append({
                **customer, "capacity": capacity, "workload_shares": shares,
                "capacity_index": index if capacity else None,
                "capacity_total": len(ordered),
                "workload_scope": "Customer-wide rolling 28 days, repeated per capacity",
            })
    return {
        "snapshot": snapshot, "rows": rows, "workloads": names, "totals": report["totals"],
    }


def _order_capacities(capacities: list[dict]) -> list[dict]:
    """Keep capacity numbering stable across filtering, sorting, and both report views."""
    return sorted(capacities, key=lambda row: (
        row.get("capacity_id") or "", row.get("tenant_id") or "",
    ))


def _build_customer_detail(summary: dict, raw: dict) -> dict:
    """Expose frontend aliases alongside all imported native metrics."""
    selected = {
        **summary, "workloads": [], "capacities": [],
        "direct_lake_cu_hours": raw.get("direct_lake_cu_hours"),
        "direct_lake_pct": raw.get("direct_lake_pct"),
        "fabric_core_mau": raw.get("fabric_core_mau"),
        "mom_change_pct": raw.get("mom_change_pct"),
        "workload_totals": raw.get("workload_totals", []),
    }
    for workload in raw.get("workloads", []):
        selected["workloads"].append({
            **workload, "share_pct": workload.get("usage_pct"),
        })
    points_by_capacity: dict[tuple, list] = defaultdict(list)
    for point in raw.get("trends", []):
        points_by_capacity[(point.get("tenant_id"), point.get("capacity_id"))].append({
            **point, "time": point.get("observed_at"),
            "successful": point.get("successful_operations"),
            "failed": point.get("failed_operations"),
            "cancelled": point.get("cancelled_operations"),
            "rejected": point.get("rejected_operations"),
        })
    capacities = _order_capacities(raw.get("capacities", []))
    for index, capacity in enumerate(capacities, start=1):
        selected["capacities"].append({
            **capacity,
            "capacity_index": index, "capacity_total": len(capacities),
            "peak_utilization_pct": capacity.get("max_30s_utilization_pct"),
            "peak_period": "Latest available hour, peak 30-second interval",
            "users": capacity.get("latest_users"),
            "cu_hours": capacity.get("unsmoothed_cu_hours"),
            "points": points_by_capacity[
                (capacity.get("tenant_id"), capacity.get("capacity_id"))
            ],
        })
    return selected
