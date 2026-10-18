"""Atomic P to F snapshots and shared report/customer-tab reads."""
from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Callable

from app.models import Customer, PToFImport, PToFRecord, db
from app.services.fabric_consumption import _current_tpids
from app.services.ptof_pull import (
    DETAIL_COLUMNS, DETAIL_SUMS, SUMMARY_COLUMNS, SUMMARY_SUMS, pull_ptof,
)

logger = logging.getLogger(__name__)
DATE_FIELDS = {"expiration_date", "earliest_expiration", "latest_expiration"}
NUMBER_FIELDS = {
    *SUMMARY_SUMS, *DETAIL_SUMS, "psku_renewal_ratio", "fsku_renewal_ratio",
    "fsku_paygo_annualized", "ea_count", "renewed_ea_count",
}


class PToFError(ValueError):
    """A source result cannot safely replace the saved renewal snapshot."""


def _date(value: object) -> str | None:
    """Keep the full source calendar date without applying the user's timezone."""
    if value is None:
        return None
    try:
        if isinstance(value, bool):
            raise ValueError("Boolean date")
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000, timezone.utc).date().isoformat()
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
    except (ValueError, TypeError, OverflowError, OSError) as exc:
        raise PToFError("P to F returned an invalid expiration date.") from exc


def _normalise(row: dict, kind: str, tpids: set[int]) -> dict:
    """Validate complete scope and preserve blanks separately from numeric zero."""
    columns = DETAIL_COLUMNS if kind == "details" else SUMMARY_COLUMNS
    sums = DETAIL_SUMS if kind == "details" else SUMMARY_SUMS
    required = {"tpid", "source_customer_name", *columns, *sums}
    if kind == "summary":
        required.update({"earliest_expiration", "latest_expiration",
                         "ea_count", "renewed_ea_count"})
    if not isinstance(row, dict) or not required <= row.keys():
        raise PToFError(f"P to F returned an incomplete {kind} row.")
    raw_tpid = row["tpid"]
    if isinstance(raw_tpid, bool) or not str(raw_tpid).isdigit() or int(raw_tpid) not in tpids:
        raise PToFError("P to F returned an account outside the requested TPID scope.")
    result = {"tpid": int(raw_tpid)}
    for name in required - {"tpid"}:
        value = row[name]
        if name in DATE_FIELDS:
            value = _date(value)
        elif name in NUMBER_FIELDS and value is not None:
            try:
                if isinstance(value, bool):
                    raise ValueError("Boolean amount")
                value = float(value)
                if not math.isfinite(value):
                    raise ValueError("Non-finite amount")
            except (ValueError, TypeError, OverflowError) as exc:
                raise PToFError(f"P to F returned an invalid {name}.") from exc
        elif name not in NUMBER_FIELDS and value is not None and not isinstance(value, str):
            raise PToFError(f"P to F returned invalid text for {name}.")
        result[name] = value
    return result


def sync_ptof(progress: Callable | None = None) -> dict:
    """Replace the renewal snapshot during the shared Fabric 360 refresh."""
    try:
        tpids = _current_tpids(Customer.query.order_by(Customer.id).all())
        if not tpids:
            raise PToFError("No customers with valid TPIDs. Import accounts first.")
        payload = pull_ptof(tpids, progress=progress)
        metadata = payload.get("metadata") or {}
        if (metadata.get("complete") is not True
                or set(metadata.get("requested_tpids", [])) != set(tpids)):
            raise PToFError("P to F did not confirm the complete requested TPID scope.")
        rows = {}
        for kind in ("summary", "details"):
            if not isinstance(payload.get(kind), list):
                raise PToFError(f"P to F omitted the {kind} result set.")
            rows[kind] = [_normalise(row, kind, set(tpids)) for row in payload[kind]]
        if progress:
            progress({"phase": "saving", "progress": 95,
                      "message": "Saving the complete P to F snapshot."})
        snapshot = PToFImport(
            customer_count=len({row["tpid"] for group in rows.values() for row in group}),
            summary_count=len(rows["summary"]), detail_count=len(rows["details"]),
            metadata_json=metadata,
        )
        db.session.add(snapshot)
        for kind, group in rows.items():
            snapshot.records.extend(PToFRecord(
                tpid=row["tpid"], kind=kind, data_json=row,
            ) for row in group)
        db.session.flush()
        PToFRecord.query.filter(PToFRecord.import_id != snapshot.id).delete(
            synchronize_session=False,
        )
        PToFImport.query.filter(PToFImport.id != snapshot.id).delete(synchronize_session=False)
        result = {"success": True, "import_id": snapshot.id,
                  "customer_count": snapshot.customer_count,
                  "summary_count": snapshot.summary_count, "detail_count": snapshot.detail_count}
        db.session.commit()
        return result
    except Exception:
        db.session.rollback()
        logger.exception("P to F refresh failed; previous complete snapshot retained")
        raise


def get_ptof_report(customer_id: int | None = None) -> dict:
    """Join source TPIDs to current customer names without making remote queries."""
    customers = Customer.query.filter(Customer.tpid > 0)
    if customer_id is not None:
        customers = customers.filter(Customer.id == customer_id)
    mapping = {int(customer.tpid): customer for customer in customers.order_by(Customer.id)}
    snapshot = PToFImport.query.order_by(PToFImport.imported_at.desc(), PToFImport.id.desc()).first()
    result = {"snapshot": None, "summary": [], "details": []}
    if snapshot is None:
        return result
    result["snapshot"] = {
        "id": snapshot.id,
        "imported_at": snapshot.imported_at.replace(tzinfo=timezone.utc).isoformat(),
        "customer_count": snapshot.customer_count, **snapshot.metadata_json,
    }
    records = PToFRecord.query.filter(
        PToFRecord.import_id == snapshot.id, PToFRecord.tpid.in_(mapping),
    ).order_by(PToFRecord.tpid, PToFRecord.id)
    for record in records:
        customer = mapping[record.tpid]
        result[record.kind].append({
            **record.data_json, "customer_id": customer.id, "customer_name": customer.name,
        })
    statuses: dict[int, set[str]] = {}
    for row in result["summary"]:
        if row["renewal_status"]:
            statuses.setdefault(row["tpid"], set()).add(row["renewal_status"])
    for row in result["details"]:
        row["renewal_status"] = "; ".join(sorted(statuses.get(row["tpid"], set()))) or None
    return result


def get_ptof_renewals_widget(reference: date | None = None) -> dict:
    """Read subscription expirations in an inclusive 90-day saved-snapshot window.

    Account assessments are context only. Subscription rows remain a separate
    grain, with no inferred renewal completion or summary/detail dollar mixing.
    """
    reference = reference or date.today()
    end = reference + timedelta(days=90)
    report = get_ptof_report()
    rows = []
    counts = {"upcoming": 0, "past": 0, "undated": 0, "later": 0}
    for index, source in enumerate(report["details"]):
        raw_date = source.get("expiration_date")
        try:
            expiration = date.fromisoformat(raw_date) if raw_date else None
        except (ValueError, TypeError):
            expiration = None
        if expiration is None:
            counts["undated"] += 1
        elif expiration < reference:
            counts["past"] += 1
        elif expiration > end:
            counts["later"] += 1
        else:
            rows.append({
                **source, "row_key": f"ptof-{source['customer_id']}-{index}",
                "days_until_expiration": (expiration - reference).days,
                "destination": f"/reports/p-to-f?customer_id={source['customer_id']}",
            })
    rows.sort(key=lambda row: (
        row["expiration_date"], row["customer_name"].casefold(), row["row_key"],
    ))
    counts["upcoming"] = len(rows)
    counts["customers"] = len({row["customer_id"] for row in rows})
    amounts = [row.get("sa_expiration_amount") for row in rows]
    known = [amount for amount in amounts if amount is not None]
    counts["missing_sa_amount"] = len(amounts) - len(known)
    snapshot = report["snapshot"]
    return {
        "snapshot": snapshot,
        "snapshot_state": (
            "not_imported" if snapshot is None else "available" if report["details"] else "empty"
        ),
        "scope": "all_local_accounts", "destination": "/reports/p-to-f",
        "reference_date": reference.isoformat(), "window_end": end.isoformat(),
        "window_days": 90, "rows": rows, "counts": counts,
        "sa_expiration_amount": sum(known) if known else None,
        "sa_amount_complete": not counts["missing_sa_amount"],
        "amount_basis": "Annual SA expiration amount, not monthly ACR",
        "status_basis": (
            "Renewal assessment is account-level source context, not subscription status"
        ),
    }
