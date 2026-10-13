"""Exact captured Fabric account revenue semantics and atomic local enrichment."""

import copy
import json
from datetime import date, datetime, timedelta, timezone
from unittest.mock import Mock

import pytest

from app.models import (
    Customer, FabricConsumptionImport, FabricConsumptionRecord, SyncStatus, db,
)
from app.services import fabric_consumption as service
from app.services import fabric_consumption_pull as pull


def revenue_payload(tpids: list[int], *, total=100, reserved=25, paygo=75, ratio=0.25) -> dict:
    """Return synthetic complete revenue data, never captured customer figures."""
    return {
        "metadata": pull._revenue_metadata(tpids, date(2026, 10, 11)),
        "revenue_summary": [{
            "tpid": tpid, "total_revenue_ytd": total, "reservation_revenue_ytd": reserved,
            "paygo_revenue_ytd": paygo, "reservation_share_ratio": ratio,
            "reporting_fiscal_month_id": 202609,
        } for tpid in tpids],
        "revenue_months": [{
            "tpid": tpid, "fiscal_month": "September, 2026", "fiscal_month_id": 202609,
            "total_revenue": total, "reservation_revenue": reserved, "paygo_revenue": paygo,
            "reservation_share_ratio": ratio,
        } for tpid in tpids],
    }


@pytest.fixture
def revenue_accounts(app):
    """Use only isolated local test data and preserve the normal telemetry generation."""
    with app.app_context():
        FabricConsumptionRecord.query.delete()
        FabricConsumptionImport.query.delete()
        customers = [
            Customer(name="Synthetic Revenue One", tpid=98720001),
            Customer(name="Synthetic Revenue Two", tpid=98720002),
        ]
        db.session.add_all(customers)
        snapshot = FabricConsumptionImport(
            customer_count=2, workload_row_count=0, capacity_row_count=1, trend_row_count=0,
            metadata_json={"complete": True, "requested_tpids": [98720001, 98720002],
                           "capture": "Synthetic telemetry provenance"},
        )
        db.session.add(snapshot)
        db.session.flush()
        db.session.add(FabricConsumptionRecord(
            import_id=snapshot.id, customer_id=customers[0].id, tpid=customers[0].tpid,
            kind="capacity", capacity_id="synthetic-capacity", sku="F64",
            metrics_json={"unsmoothed_cu_hours": 17},
        ))
        db.session.commit()
        ids = [customer.id for customer in customers]
        yield customers, snapshot
        FabricConsumptionRecord.query.delete()
        FabricConsumptionImport.query.delete()
        SyncStatus.query.filter(SyncStatus.sync_type.in_(
            [service.SYNC_TYPE, service.REVENUE_SYNC_TYPE],
        )).delete(synchronize_session=False)
        Customer.query.filter(Customer.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()


def test_captured_extension_preserves_source_revenue_meaning():
    """Use CD amounts, precise RI classes and native MaxMonthId/June30 date measures."""
    measures = {row["Name"]: row["Expression"]
                for row in pull.revenue_extension()["Entities"][0]["Measures"]}
    assert pull.RI_PRICING_LEVELS == (
        "EA RI", "MCA Partner-Led RI", "MCA Field-Led RI", "MCA Customer-Led RI",
        "Direct RI", "MCA Inside Sales - DR RI", "CSP - RI",
    )
    for period in ("MTD", "YTD"):
        expression = measures[f"Fabric Revenue {period}"]
        assert "Local.Revenue.MaxMonthId()" in expression
        assert "Revenue[BilledRevenueCD] + Revenue[AzureConsumedRevenueCD]" in expression
        assert "'Product Master'[Product] IN {\"Fabric\", \"F SKU\"}" in expression
        assert "'Product Master'[Product Group] IN {\"Fabric\", \"Fabric Platform\"}" in expression
        assert measures[f"Fabric Revenue {period} Pay-as-you-go"] \
            == f"[Fabric Revenue {period}] - [Fabric Revenue {period} Reserved Instance RI]"
    assert 'DATESYTD(\'Calendar\'[Calendar Date], "6-30")' in measures["Fabric Revenue YTD"]
    assert "DATESMTD('Calendar'[Calendar Date])" in measures["Fabric Revenue MTD"]
    assert "ALL ( 'Product Master' )" not in measures["Fabric Revenue YTD"]


def test_direct_numeric_scope_and_captured_context():
    """No summary-key/account-display filter or invented environment constraint is introduced."""
    query = pull.build_revenue_query([17, 29], date(2026, 10, 11), monthly=True)
    serialized = json.dumps(query)
    assert "AggregatedAzureServiceBilling" not in serialized
    assert "Account TPID" not in serialized
    assert "Environment" not in serialized
    assert query["Where"][0] == pull._tpids([17, 29])
    assert query["Where"][1] == pull._calendar_filter(date(2026, 10, 11))
    assert {row["Name"] for row in query["Select"]} == {
        "tpid", "fiscal_month", "fiscal_month_id", "total_revenue",
        "reservation_revenue", "paygo_revenue", "reservation_share_ratio",
    }
    assert "Power BI Premium" in serialized and "Fabric Capacity 360" in serialized


def test_revenue_only_pull_queries_all_accounts_in_bounded_chunks():
    """Each batch runs the monthly and YTD families, with no capacity history query."""
    reader = Mock()

    def respond(query, report, extension=None):
        """Return synthetic rows for exactly the numeric query TPID members."""
        values = query["Where"][0]["Condition"]["In"]["Values"]
        tpids = [int(row[0]["Literal"]["Value"][:-1]) for row in values]
        key = "revenue_months" if "fiscal_month" in {row["Name"] for row in query["Select"]} \
            else "revenue_summary"
        return revenue_payload(tpids)[key]

    reader.query.side_effect = respond
    result = pull.pull_fabric_revenue([3, 1, 2, 1], client=reader, chunk=2)
    assert reader.query.call_count == 4
    assert result["metadata"]["requested_tpids"] == [1, 2, 3]
    assert [row["tpid"] for row in result["revenue_summary"]] == [1, 2, 3]
    assert result["metadata"]["currency"] is None
    assert result["metadata"]["reported_units"] == "CD"
    assert "ownership" in result["metadata"]["scope"]
    reader.close.assert_not_called()


@pytest.mark.parametrize("mutation", [
    "foreign", "fractional_tpid", "boolean_tpid", "missing_field", "nonfinite",
    "duplicate_month", "bad_total", "bad_ratio", "zero_ratio", "missing_family", "partial",
])
def test_revenue_validation_rejects_unsafe_or_incomplete_results(mutation):
    """Malformed data is an explicit failure, never a zero or partial-success import."""
    payload = revenue_payload([1])
    month = payload["revenue_months"][0]
    if mutation == "foreign":
        month["tpid"] = 2
    elif mutation == "fractional_tpid":
        month["tpid"] = 1.5
    elif mutation == "boolean_tpid":
        month["tpid"] = True
    elif mutation == "missing_field":
        month.pop("reservation_revenue")
    elif mutation == "nonfinite":
        month["reservation_revenue"] = float("nan")
    elif mutation == "duplicate_month":
        payload["revenue_months"].append(copy.deepcopy(month))
    elif mutation == "bad_total":
        month["total_revenue"] = 111
    elif mutation == "bad_ratio":
        month["reservation_share_ratio"] = 0.5
    elif mutation == "zero_ratio":
        month.update(total_revenue=0, reservation_revenue=0, paygo_revenue=0,
                     reservation_share_ratio=0)
    elif mutation == "missing_family":
        payload.pop("revenue_summary")
    else:
        payload["metadata"]["complete"] = False
    with pytest.raises(pull.FabricPullError):
        pull.validate_revenue_payload(payload, {1})


@pytest.mark.parametrize(("total", "reserved", "paygo", "ratio", "share"), [
    (None, None, None, None, None), (0, 0, 0, None, None),
    (-100, 25, -125, -0.25, -25), (100, None, 100, None, None),
])
def test_null_zero_negative_and_source_ratios_are_faithful(total, reserved, paygo, ratio, share):
    """No credits are clamped, unknown RI is not zero and zero denominators do not invent ratios."""
    payload = revenue_payload([1], total=total, reserved=reserved, paygo=paygo, ratio=ratio)
    pull.validate_revenue_payload(payload, {1})
    metrics = service._metrics(payload["revenue_months"][0], "revenue_month")
    assert metrics["total_revenue"] == total
    assert metrics["reservation_revenue"] == reserved
    assert metrics["paygo_revenue"] == paygo
    assert metrics["reservation_share_pct"] == share


def test_refresh_preserves_telemetry_and_separates_customer_revenue(revenue_accounts, monkeypatch):
    """Maintenance replaces only revenue, preserving CU data, import timestamp and source."""
    customers, snapshot = revenue_accounts
    stamp = snapshot.imported_at
    metadata = copy.deepcopy(snapshot.metadata_json)
    source = FabricConsumptionRecord.query.filter_by(kind="capacity").one()
    source_before = source.id, copy.deepcopy(source.metrics_json)
    def returned(tpids, progress):
        """Distinguish the two account payloads without importing any captured figures."""
        payload = revenue_payload(tpids)
        for family in ("revenue_summary", "revenue_months"):
            for row in payload[family]:
                if row["tpid"] == customers[1].tpid:
                    suffix = "_ytd" if family == "revenue_summary" else ""
                    row.update({
                        "total_revenue" + suffix: 200,
                        "reservation_revenue" + suffix: 50, "paygo_revenue" + suffix: 150,
                    })
        return payload

    fake = Mock(side_effect=returned)
    monkeypatch.setattr(service, "pull_fabric_revenue", fake)
    monkeypatch.setattr(service, "pull_fabric_consumption", Mock(
        side_effect=AssertionError("Capacity histories must not be pulled"),
    ))
    result = service.refresh_fabric_revenue()
    assert result["success"]
    assert set(fake.call_args.args[0]) == {customer.tpid for customer in customers}
    db.session.refresh(snapshot)
    assert snapshot.imported_at == stamp
    assert {key: snapshot.metadata_json[key] for key in metadata} == metadata
    source = FabricConsumptionRecord.query.filter_by(kind="capacity").one()
    assert (source.id, source.metrics_json) == source_before
    report = service.get_fabric_report(customers[0].id)
    revenue = report["customer"]["revenue"]
    assert revenue["state"] == "available"
    assert revenue["summary"]["reservation_share_pct"] == 25
    assert revenue["months"][0]["reservation_revenue"] == 25
    assert revenue["metadata"]["latest_reporting_month"] == "September, 2026"
    assert revenue["metadata"]["latest_month_label"] == "September, 2026"
    assert revenue["metadata"]["fiscal_year_label"] == "FY2027"
    assert revenue["metadata"]["unit_label"] == "Source revenue (CD)"
    assert revenue["metadata"]["currency"] is None
    assert report["snapshot"]["imported_at"] == service._iso(stamp)
    assert next(row for row in report["customers"] if row["id"] == customers[1].id)["status"] \
        == "no_data"
    other = service.get_fabric_report(customers[1].id)["customer"]["revenue"]
    assert other["state"] == "available"
    assert other["summary"]["total_revenue_ytd"] == 200
    assert other["months"][0]["reservation_revenue"] == 50
    assert all(row.capacity_id is None for row in FabricConsumptionRecord.query.filter(
        FabricConsumptionRecord.kind.in_(service._REVENUE_KINDS.values()),
    ))


def test_failed_refresh_preserves_previous_revenue_and_telemetry(revenue_accounts, monkeypatch):
    """A source failure after a valid refresh cannot erase either data family."""
    customers, _ = revenue_accounts
    monkeypatch.setattr(service, "pull_fabric_revenue",
                        lambda tpids, progress: revenue_payload(tpids))
    assert service.refresh_fabric_revenue()["success"]
    before = service.get_fabric_report(customers[0].id)
    monkeypatch.setattr(service, "pull_fabric_revenue",
                        Mock(side_effect=pull.FabricPullError("Synthetic source failure.")))
    result = service.refresh_fabric_revenue()
    assert result["success"] is False
    assert "source failure" in result["error"]
    assert service.get_fabric_report(customers[0].id) == before


def test_legacy_and_empty_revenue_states_are_explicit(revenue_accounts, monkeypatch):
    """Telemetry-only snapshots remain readable, while successful empty revenue is no_data."""
    customers, _ = revenue_accounts
    assert service.get_fabric_report(customers[0].id)["customer"]["revenue"]["state"] \
        == "not_imported"
    monkeypatch.setattr(service, "pull_fabric_revenue", lambda tpids, progress: {
        "metadata": pull._revenue_metadata(tpids, date(2026, 10, 11)),
        "revenue_summary": [], "revenue_months": [],
    })
    assert service.refresh_fabric_revenue()["success"]
    assert service.get_fabric_report(customers[0].id)["customer"]["revenue"]["state"] == "no_data"


def test_revenue_reader_uses_complete_pagination():
    """The existing stateless client follows all pages and rejects repeating/truncated cursors."""
    reader = pull.FabricQueryClient(Mock())
    reader._page = Mock(side_effect=[
        ([{"tpid": 1}], ["next"]), ([{"tpid": 2}], None),
    ])
    assert reader.query(pull.build_revenue_query([1, 2], date(2026, 10, 11)),
                        pull.WORKLOAD_REPORT_ID, pull.revenue_extension()) \
        == [{"tpid": 1}, {"tpid": 2}]


def test_normal_full_sync_enriches_revenue_and_preserves_prior_on_failure(
    revenue_accounts, monkeypatch,
):
    """A normal telemetry import stages revenue too and rejects partial revenue atomically."""
    from tests.test_fabric_consumption import _payload

    customers, _ = revenue_accounts

    def returned(tpids, progress):
        """Build one complete synthetic telemetry plus revenue result."""
        payload = _payload(tpids)
        revenue = revenue_payload(tpids)
        payload.update({name: revenue[name] for name in pull.REVENUE_FIELDS})
        payload["metadata"]["revenue"] = revenue["metadata"]
        return payload

    monkeypatch.setattr(service, "pull_fabric_consumption", returned)
    assert service.sync_fabric_consumption()["success"]
    before = service.get_fabric_report(customers[0].id)
    assert before["customer"]["revenue"]["summary"]["reservation_revenue_ytd"] == 25
    assert FabricConsumptionRecord.query.filter_by(kind="revenue_summary").count() == 2

    def broken(tpids, progress):
        """Simulate missing source-family completeness without dropping telemetry."""
        payload = returned(tpids, progress)
        payload["metadata"]["revenue"]["complete"] = False
        return payload

    monkeypatch.setattr(service, "pull_fabric_consumption", broken)
    result = service.sync_fabric_consumption()
    assert result["success"] is False
    assert "complete account scope" in result["error"]
    assert service.get_fabric_report(customers[0].id) == before


def test_failed_revenue_write_rolls_back_family_replacement(revenue_accounts, monkeypatch):
    """A failure after deletion still restores the entire previous revenue family."""
    customers, _ = revenue_accounts
    monkeypatch.setattr(service, "pull_fabric_revenue",
                        lambda tpids, progress: revenue_payload(tpids))
    assert service.refresh_fabric_revenue()["success"]
    before = service.get_fabric_report(customers[0].id)
    monkeypatch.setattr(service, "_stage_revenue",
                        Mock(side_effect=pull.FabricPullError("Synthetic write failure.")))
    assert service.refresh_fabric_revenue()["success"] is False
    assert service.get_fabric_report(customers[0].id) == before


def test_equivalent_month_identifiers_cannot_duplicate_rows():
    """Numeric and string representations of one source month remain one identity."""
    payload = revenue_payload([1])
    duplicate = copy.deepcopy(payload["revenue_months"][0])
    duplicate["fiscal_month_id"] = str(duplicate["fiscal_month_id"])
    payload["revenue_months"].append(duplicate)
    with pytest.raises(pull.FabricPullError, match="duplicate"):
        pull.validate_revenue_payload(payload, {1})


def test_invalid_local_tpid_is_not_truncated_and_queried():
    """A malformed SQLite identifier must fail before any customer-source request."""
    from types import SimpleNamespace

    with pytest.raises(pull.FabricPullError, match="invalid TPID"):
        service._current_tpids([SimpleNamespace(tpid=1.5)])
    assert service._current_tpids([
        SimpleNamespace(tpid=None), SimpleNamespace(tpid=0), SimpleNamespace(tpid=-1),
        SimpleNamespace(tpid=17),
    ]) == [17]


@pytest.mark.parametrize(("label", "fiscal_year"), [
    ("June, 2026", "FY2026"), ("July, 2026", "FY2027"),
    ("January, 2027", "FY2027"), ("Unspecified source month", None),
])
def test_period_labels_use_source_month_and_native_year_end_only(
    revenue_accounts, monkeypatch, label, fiscal_year,
):
    """Reporting IDs are opaque; never use wallclock or assume they encode YYYYMM."""
    customers, _ = revenue_accounts

    def returned(tpids, progress):
        """Use a source-provided month label with an intentionally opaque month identifier."""
        payload = revenue_payload(tpids)
        for row in payload["revenue_summary"]:
            row["reporting_fiscal_month_id"] = 447
        for row in payload["revenue_months"]:
            row.update(fiscal_month=label, fiscal_month_id=447)
        return payload

    monkeypatch.setattr(service, "pull_fabric_revenue", returned)
    assert service.refresh_fabric_revenue()["success"]
    metadata = service.get_fabric_report(customers[0].id)["customer"]["revenue"]["metadata"]
    assert metadata["latest_month_label"] == label
    assert metadata["fiscal_year_label"] == fiscal_year


def _status_record_values(status) -> dict:
    """Capture every stored status field, including timestamps and original failure details."""
    db.session.refresh(status)
    return {column.name: getattr(status, column.name) for column in SyncStatus.__table__.columns}


@pytest.mark.parametrize("existing_success", [True, False])
@pytest.mark.parametrize("revenue_success", [True, False])
def test_revenue_refresh_preserves_exact_telemetry_status(
    revenue_accounts, monkeypatch, existing_success, revenue_success,
):
    """Revenue-only success/failure never claims, completes or overwrites telemetry status."""
    now = datetime.now(timezone.utc)
    telemetry = SyncStatus(
        sync_type=service.SYNC_TYPE, started_at=now - timedelta(hours=3),
        completed_at=now - timedelta(hours=2), heartbeat_at=now - timedelta(hours=2),
        success=existing_success, items_synced=209,
        details=json.dumps({"phase": "complete" if existing_success else "failed",
                            "message": "Original telemetry result"}),
    )
    db.session.add(telemetry)
    db.session.commit()
    before = _status_record_values(telemetry)
    if revenue_success:
        monkeypatch.setattr(service, "pull_fabric_revenue",
                            lambda tpids, progress: revenue_payload(tpids))
    else:
        monkeypatch.setattr(service, "pull_fabric_revenue",
                            Mock(side_effect=pull.FabricPullError("Synthetic revenue failure.")))
    events = []
    result = service.refresh_fabric_revenue(progress=events.append)
    assert result["success"] is revenue_success
    assert _status_record_values(telemetry) == before
    assert all(event["sync_type"] == service.REVENUE_SYNC_TYPE for event in events)
    revenue_status = SyncStatus.query.filter_by(sync_type=service.REVENUE_SYNC_TYPE).one()
    assert revenue_status.success is revenue_success
    assert revenue_status.completed_at is not None


@pytest.mark.parametrize("existing", [False, True])
def test_raw_revenue_probe_without_callback_never_writes_status(revenue_accounts, existing):
    """A raw read cannot leave a telemetry claim running or replace any active owner's fields."""
    telemetry = None
    if existing:
        now = datetime.now(timezone.utc)
        telemetry = SyncStatus(
            sync_type=service.SYNC_TYPE, started_at=now, heartbeat_at=now,
            details=json.dumps({"phase": "workloads", "progress": 40}),
        )
        db.session.add(telemetry)
        db.session.commit()
        before = _status_record_values(telemetry)
    reader = Mock()

    def returned(query, report, extension=None):
        """Return one synthetic revenue family with no default progress emitter."""
        fields = {row["Name"] for row in query["Select"]}
        return revenue_payload([17])["revenue_months" if "fiscal_month" in fields
                                     else "revenue_summary"]

    reader.query.side_effect = returned
    assert pull.pull_fabric_revenue([17], client=reader)["metadata"]["complete"]
    if telemetry is None:
        assert SyncStatus.query.filter_by(sync_type=service.SYNC_TYPE).count() == 0
    else:
        assert _status_record_values(telemetry) == before


def test_full_import_cannot_use_an_unowned_or_completed_claim(revenue_accounts, monkeypatch):
    """A caller saying claimed=True cannot mutate a previous genuine telemetry failure."""
    now = datetime.now(timezone.utc)
    telemetry = SyncStatus(
        sync_type=service.SYNC_TYPE, started_at=now - timedelta(hours=3),
        completed_at=now - timedelta(hours=2), success=False,
        details="Original genuine failure", items_synced=11,
    )
    db.session.add(telemetry)
    db.session.commit()
    before = _status_record_values(telemetry)
    remote = Mock(side_effect=AssertionError("An unowned caller must not read sources"))
    monkeypatch.setattr(service, "pull_fabric_consumption", remote)
    result = service.sync_fabric_consumption(claimed=True)
    assert result["success"] is False
    assert "active telemetry import claim" in result["error"]
    assert _status_record_values(telemetry) == before
    remote.assert_not_called()


def test_revenue_only_progress_cannot_be_routed_to_full_import_status(
    revenue_accounts, monkeypatch,
):
    """A wrongly reused progress sink fails explicitly instead of impersonating telemetry work."""
    def wrong_reader(tpids, progress):
        """Simulate a revenue-only probe mistakenly passed the full-import progress sink."""
        progress({"sync_type": service.REVENUE_SYNC_TYPE, "scope": "revenue_only",
                  "phase": "revenue_summary", "progress": 0})

    monkeypatch.setattr(service, "pull_fabric_consumption", wrong_reader)
    result = service.sync_fabric_consumption()
    assert result["success"] is False
    assert "Revenue-only progress cannot update telemetry" in result["error"]
    status = SyncStatus.query.filter_by(sync_type=service.SYNC_TYPE).one()
    assert status.completed_at is not None
    assert status.success is False
    assert json.loads(status.details)["phase"] == "failed"
