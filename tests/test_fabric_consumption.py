"""Tests for manually imported Fabric snapshots and complete scoped Power BI queries."""
from datetime import date, datetime, timezone
from unittest.mock import Mock

import pytest

from app.models import Customer, FabricConsumptionImport, FabricConsumptionRecord, SyncStatus, db
from app.services import fabric_consumption as service
from app.services import fabric_consumption_pull as pull


@pytest.fixture
def fabric_accounts(app):
    """Provide isolated accounts and remove imported Fabric snapshots after each test."""
    with app.app_context():
        first = Customer(name="Fabric Test Account", tpid=98910001)
        empty = Customer(name="Fabric No Data", tpid=98910002)
        db.session.add_all([first, empty])
        db.session.commit()
        ids = (first.id, empty.id)
        yield first, empty
        FabricConsumptionRecord.query.delete()
        FabricConsumptionImport.query.delete()
        SyncStatus.query.filter_by(sync_type=service.SYNC_TYPE).delete()
        Customer.query.filter(Customer.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()


def _payload(tpids):
    """Build a complete source payload containing null and zero numeric values."""
    tpid = tpids[0]
    grain = {"tpid": str(tpid), "tenant_id": "tenant-test", "capacity_id": "capacity-test"}
    return {
        "metadata": {"complete": True, "requested_tpids": tpids, "source_timezone": "UTC"},
        "customer_totals": [{"tpid": str(tpid), "cu_hours": 100,
                             "direct_lake_cu_hours": 25, "fabric_core_mau": None}],
        "customer_workloads": [
            {"tpid": str(tpid), "workload": "Power BI", "cu_hours": 30},
            {"tpid": str(tpid), "workload": "SQLDb", "cu_hours": 70},
        ],
        "workload_totals": [{**grain, "cu_hours": 100}],
        "workloads": [
            {**grain, "workload": "Power BI", "artifact_kind": "Report",
             "operation": "Query", "cu_hours": 30},
            {**grain, "workload": "SQLDb", "artifact_kind": "Database",
             "operation": "Execute", "cu_hours": 70},
        ],
        "capacities": [{
            **grain, "sku": "F64", "latest_utilization_ratio": 1.4,
            "max_30s_utilization_ratio": None, "throttling_seconds": 0,
            "interactive_cu_seconds": 20, "background_cu_seconds": 80,
            "available_cu_seconds": 100, "autoscale_cu_seconds": 50,
        }],
        "trends": [{
            **grain, "sku": "F64", "observed_at": 1791230400000,
            "interactive_cu_seconds": 20, "background_cu_seconds": 80,
            "available_cu_seconds": 100, "autoscale_cu_seconds": 50,
            "failed_operations": None, "successful_operations": 0,
        }],
    }


def test_manual_import_and_read_preserve_nulls_and_true_denominator(fabric_accounts, monkeypatch):
    """Import all accounts and retain nulls, capacity detail, and UTC series."""
    first, empty = fabric_accounts
    fake = Mock(side_effect=lambda tpids, progress: _payload(tpids))
    monkeypatch.setattr(service, "pull_fabric_consumption", fake)
    events = []
    result = service.sync_fabric_consumption(progress=events.append)
    assert result["success"] is True
    assert set(fake.call_args.args[0]) == {first.tpid, empty.tpid}
    report = service.get_fabric_report(first.id)
    account = report["customer"]
    assert account["direct_lake_pct"] == 25
    assert {r["workload"]: r["usage_pct"] for r in account["workloads"]} == {
        "Power BI": 30, "SQLDb": 70,
    }
    assert {r["workload"]: r["share_pct"] for r in account["workloads"]} == {
        "Power BI": 30, "SQLDb": 70,
    }
    capacity = account["capacities"][0]
    assert capacity["latest_utilization_pct"] == 140
    assert capacity["max_30s_utilization_pct"] is None
    assert capacity["utilization_pct"] == pytest.approx(100 / 150 * 100)
    assert capacity["throttling_seconds"] == 0
    assert account["fabric_core_mau"] is None
    point = capacity["points"][0]
    assert point["time"] == "2026-10-05T20:00:00+00:00"
    assert point["successful"] == 0
    assert point["failed"] is None
    assert point["sku"] == "F64"
    assert capacity["peak_utilization_pct"] is None
    assert account["workloads"][0]["details"][0]["usage_pct"] == 30
    missing = next(c for c in report["customers"] if c["id"] == empty.id)
    assert missing["status"] == "no_data"
    assert missing["total_cu_hours"] is None
    assert report["totals"]["cu_hours"] is None
    assert events[-1]["progress"] == 100
    assert service.has_fabric_data()
    assert SyncStatus.get_status(service.SYNC_TYPE)["state"] == "complete"
    assert len(service.get_fabric_report(first.id)["customers"]) == 2
    assert report["snapshot"]["capacity_as_of"] == "2026-10-05T20:00:00+00:00"
    assert report["snapshot"]["workload_as_of"] is None
    assert service.get_fabric_report()["customer"] is None


@pytest.mark.parametrize("failure", [
    "network", "partial", "foreign", "empty", "denominator", "workload_detail", "trend_detail",
])
def test_failed_import_preserves_last_success(fabric_accounts, monkeypatch, failure):
    """No incomplete or unscoped pull can supersede a prior successful snapshot."""
    monkeypatch.setattr(service, "pull_fabric_consumption",
                        lambda tpids, progress: _payload(tpids))
    successful = service.sync_fabric_consumption()
    before = service.get_fabric_report()

    def broken(tpids, progress):
        """Return a malformed result or simulate a connection failure."""
        if failure == "network":
            raise pull.FabricPullError("Network failed.")
        payload = _payload(tpids)
        if failure == "partial":
            payload["metadata"]["complete"] = False
        elif failure == "foreign":
            payload["capacities"][0]["tpid"] = 12345
        elif failure == "empty":
            for kind in service._KINDS:
                payload[kind] = []
        elif failure == "denominator":
            payload["workload_totals"] = []
        elif failure == "workload_detail":
            payload["workloads"].pop()
        elif failure == "trend_detail":
            payload["trends"] = []
        return payload

    monkeypatch.setattr(service, "pull_fabric_consumption", broken)
    assert service.sync_fabric_consumption()["success"] is False
    assert SyncStatus.get_status(service.SYNC_TYPE)["state"] == "failed"
    assert service.get_fabric_report() == before
    assert FabricConsumptionImport.query.count() == 1
    assert successful["import_id"] == before["snapshot"]["id"]


def test_capacity_overview_preserves_grain_and_periods(fabric_accounts, monkeypatch):
    """Every capacity gets its native utilization and repeated customer workload shares."""
    first, empty = fabric_accounts
    monkeypatch.setattr(service, "pull_fabric_consumption", lambda tpids, progress: _payload(tpids))
    assert service.sync_fabric_consumption()["success"]
    original = FabricConsumptionRecord.query.filter_by(kind="capacity").one()
    db.session.add(FabricConsumptionRecord(
        import_id=original.import_id, customer_id=first.id, tpid=first.tpid, kind="capacity",
        capacity_id="second-capacity", sku="F8",
        metrics_json={**original.metrics_json, "tenant_id": "second-tenant",
                      "utilization_pct": 12.5, "unsmoothed_cu_hours": 0},
    ))
    db.session.commit()
    report = service.get_fabric_capacity_overview()
    rows = [row for row in report["rows"] if row["id"] == first.id]
    assert len(rows) == 2
    assert [(row["capacity_index"], row["capacity_total"]) for row in rows] == [(1, 2), (2, 2)]
    assert {row["capacity"]["capacity_id"] for row in rows} == {
        "capacity-test", "second-capacity",
    }
    assert all(row["workload_shares"] == {"Power BI": 30, "SQLDb": 70} for row in rows)
    assert rows[0]["capacity"]["latest_utilization_pct"] == 140
    assert rows[0]["capacity"]["utilization_pct"] == pytest.approx(100 / 150 * 100)
    missing = next(row for row in report["rows"] if row["id"] == empty.id)
    assert missing["capacity"] is None
    assert all(value is None for value in missing["workload_shares"].values())
    assert "points" not in rows[0]["capacity"]
    detail = service.get_fabric_report(first.id)["customer"]["capacities"]
    assert [(row["capacity_id"], row["capacity_index"], row["capacity_total"]) for row in detail] == [
        (row["capacity"]["capacity_id"], row["capacity_index"], row["capacity_total"])
        for row in rows
    ]
    assert missing["capacity_index"] is None
    assert missing["capacity_total"] == 0


def test_capacity_numbering_is_stable_with_shared_capacity_ids():
    """Tenant identity breaks ties without depending on query/insertion order."""
    capacities = [
        {"tenant_id": "tenant-z", "capacity_id": "same"},
        {"tenant_id": "tenant-a", "capacity_id": "same"},
        {"tenant_id": "tenant-z", "capacity_id": "first"},
    ]
    assert service._order_capacities(capacities) == [
        capacities[2], capacities[1], capacities[0],
    ]


def test_overview_absent_workload_zero_requires_reconciliation(fabric_accounts, monkeypatch):
    """A missing workload can mean zero only when the customer's measured total is complete."""
    first, empty = fabric_accounts
    monkeypatch.setattr(service, "pull_fabric_consumption", lambda tpids, progress: _payload(tpids))
    assert service.sync_fabric_consumption()["success"]
    sql = FabricConsumptionRecord.query.filter_by(kind="workload_summary").all()
    power = next(row for row in sql if row.metrics_json["workload"] == "Power BI")
    other = next(row for row in sql if row.metrics_json["workload"] == "SQLDb")
    other.metrics_json = {**other.metrics_json, "workload": "Other", "cu_hours": 0}
    power.metrics_json = {**power.metrics_json, "cu_hours": 100}
    db.session.add(FabricConsumptionRecord(
        import_id=power.import_id, customer_id=empty.id, tpid=empty.tpid,
        kind="workload_summary", metrics_json={"workload": "Absent", "cu_hours": None},
    ))
    db.session.commit()
    row = next(row for row in service.get_fabric_capacity_overview()["rows"]
               if row["id"] == first.id)
    assert row["workload_shares"] == {"Power BI": 100, "Other": 0, "Absent": 0}
    power.metrics_json = {**power.metrics_json, "cu_hours": None}
    db.session.commit()
    row = next(row for row in service.get_fabric_capacity_overview()["rows"]
               if row["id"] == first.id)
    assert row["workload_shares"]["Power BI"] is None
    assert row["workload_shares"]["Absent"] is None


def test_transaction_failure_preserves_snapshot(fabric_accounts, monkeypatch):
    """A write failure rolls back records as well as the import header."""
    monkeypatch.setattr(service, "pull_fabric_consumption",
                        lambda tpids, progress: _payload(tpids))
    assert service.sync_fabric_consumption()["success"]
    before = service.get_fabric_report()
    monkeypatch.setattr(db.session, "commit", Mock(side_effect=RuntimeError("write failed")))
    assert not service.sync_fabric_consumption()["success"]
    assert service.get_fabric_report() == before
    monkeypatch.undo()


def test_successful_reimport_atomically_replaces_snapshot(fabric_accounts, monkeypatch):
    """Repeated manual imports replace the previous snapshot rather than growing forever."""
    monkeypatch.setattr(service, "pull_fabric_consumption",
                        lambda tpids, progress: _payload(tpids))
    first = service.sync_fabric_consumption()
    second = service.sync_fabric_consumption()
    assert first["import_id"] != second["import_id"]
    assert FabricConsumptionImport.query.count() == 1
    assert service.get_fabric_report()["snapshot"]["id"] == second["import_id"]


def test_progress_notification_failure_does_not_report_committed_import_failed(
        fabric_accounts, monkeypatch):
    """A disconnected progress consumer does not change a committed import's result."""
    monkeypatch.setattr(service, "pull_fabric_consumption",
                        lambda tpids, progress: _payload(tpids))
    def notify(event):
        """Fail only the post-commit notification, not a pre-commit progress event."""
        if event["phase"] == "complete":
            raise RuntimeError("closed")

    result = service.sync_fabric_consumption(progress=notify)
    assert result["success"] is True
    assert service.has_fabric_data()


def test_prior_period_only_operation_does_not_hide_current_workload_usage(
        fabric_accounts, monkeypatch):
    """Blank current CU on a prior-only operation remains null without hiding reported totals."""
    def source(tpids, progress):
        """Include a legitimate prior-period operation with no current CU hours."""
        payload = _payload(tpids)
        payload["workloads"].append({
            **payload["workloads"][0], "operation": "Prior only",
            "cu_hours": None, "mom_change_ratio": -1,
        })
        return payload

    monkeypatch.setattr(service, "pull_fabric_consumption", source)
    assert service.sync_fabric_consumption()["success"]
    first = service.get_fabric_report(fabric_accounts[0].id)["customer"]["workloads"][0]
    assert first["cu_hours"] == 30
    assert first["usage_pct"] == 30
    assert first["details"][-1]["cu_hours"] is None


def test_preclaimed_route_does_not_claim_twice(fabric_accounts, monkeypatch):
    """The route's successful atomic claim is reused by its background worker."""
    assert SyncStatus.try_mark_started(service.SYNC_TYPE)
    claim = Mock(side_effect=AssertionError("second claim"))
    monkeypatch.setattr(SyncStatus, "try_mark_started", claim)
    monkeypatch.setattr(service, "pull_fabric_consumption",
                        lambda tpids, progress: _payload(tpids))
    assert service.sync_fabric_consumption(claimed=True)["success"]
    claim.assert_not_called()
    assert SyncStatus.get_status(service.SYNC_TYPE)["state"] == "complete"


def test_cross_process_live_claim_prevents_direct_import(fabric_accounts, monkeypatch):
    """A direct CLI invocation respects another process's live persisted claim."""
    assert SyncStatus.try_mark_started(service.SYNC_TYPE)
    source = Mock()
    monkeypatch.setattr(service, "pull_fabric_consumption", source)
    assert not service.sync_fabric_consumption()["success"]
    source.assert_not_called()
    assert SyncStatus.get_status(service.SYNC_TYPE)["state"] == "in_progress"


def test_heartbeat_continues_during_network_wait(fabric_accounts, monkeypatch):
    """A request without batch callbacks cannot let the import lease expire."""
    import time

    monkeypatch.setattr(service, "HEARTBEAT_INTERVAL_SECONDS", 0.01)
    beat = Mock(wraps=SyncStatus.update_heartbeat)
    monkeypatch.setattr(SyncStatus, "update_heartbeat", beat)

    def slow_pull(tpids, progress):
        """Simulate a slow network response without invoking a progress callback."""
        time.sleep(0.08)
        return _payload(tpids)

    monkeypatch.setattr(service, "pull_fabric_consumption", slow_pull)
    assert service.sync_fabric_consumption()["success"]
    assert beat.call_count >= 2
    assert SyncStatus.get_status(service.SYNC_TYPE)["state"] == "complete"


def test_no_snapshot_and_concurrent_import(fabric_accounts):
    """Empty report shape is stable and a second import cannot overlap the first."""
    assert service.get_fabric_report()["snapshot"] is None
    assert not service.has_fabric_data()
    service._IMPORT_LOCK.acquire()
    try:
        assert service.sync_fabric_consumption()["success"] is False
    finally:
        service._IMPORT_LOCK.release()


def test_directory_before_import_and_unknown_selection(fabric_accounts):
    """The selector is available before importing and selection never hides other accounts."""
    first, empty = fabric_accounts
    report = service.get_fabric_report(first.id)
    assert report["snapshot"] is None
    assert {row["id"] for row in report["customers"]} == {first.id, empty.id}
    assert report["customer"]["id"] == first.id
    assert report["customer"]["status"] == "no_data"
    assert report["customer"]["workloads"] == []
    assert service.get_fabric_report(-1)["customer"] is None


def test_overloaded_capacity_is_not_clamped_to_one_hundred(fabric_accounts, monkeypatch):
    """Percent units preserve real overload rather than inventing a capped value."""
    def source(tpids, progress):
        """Provide the report-native latest-hour peak with utilization above 100 percent."""
        payload = _payload(tpids)
        payload["capacities"][0]["max_30s_utilization_ratio"] = 1.8
        return payload

    monkeypatch.setattr(service, "pull_fabric_consumption", source)
    assert service.sync_fabric_consumption()["success"]
    capacity = service.get_fabric_report(fabric_accounts[0].id)["customer"]["capacities"][0]
    assert capacity["peak_utilization_pct"] == 180
    assert capacity["peak_period"] == "Latest available hour, peak 30-second interval"


def test_source_datetime_matches_har_utc_and_missing_values():
    """Captured Unix milliseconds match the report's 20:00 UTC as-of label."""
    assert service._source_datetime(1791230400000) == datetime(
        2026, 10, 5, 20, tzinfo=timezone.utc,
    )
    assert service._source_datetime("2026-10-05T20:00:00Z").hour == 20
    assert service._source_datetime(None) is None
    assert service._percentage(0, 0) is None
    assert service._number("NaN") is None
    assert service._number("0") == 0


def test_queries_keep_har_context_without_top500():
    """Numeric TPID scoping and full grain replace HAR's capped account subquery."""
    query = pull.build_workload_query([123], date(2026, 10, 8), True)
    assert "Top" not in query
    assert all("Expression" not in source for source in query["From"])
    assert query["Where"][0]["Condition"]["In"]["Values"] == [
        [{"Literal": {"Value": "123L"}}],
    ]
    assert query["Where"][0]["Condition"]["In"]["Expressions"][0]["Column"]["Property"] == "TPID"
    fields = {s["Name"] for s in query["Select"]}
    assert {"tenant_id", "capacity_id", "workload", "artifact_kind", "operation"} <= fields
    serialized = str(query)
    assert "2025-10-09T00:00:00" in serialized
    assert "PROD" in serialized and "MSIT" in serialized
    assert query["Where"][3]["Condition"]["Between"]["Expression"]["Column"]["Property"] == (
        "Calendar Date"
    )
    capacity = pull.build_capacity_query([123], True)
    assert all("Schema" not in source for source in capacity["From"])
    assert {"successful_operations", "failed_operations", "rejected_operations",
            "available_cu_seconds", "autoscale_cu_seconds", "observed_at"} <= {
        s["Name"] for s in capacity["Select"]
    }
    assert "SVG" not in str(pull._capacity_extension())


def test_chunking_every_tpid_and_all_query_families():
    """Each chunk runs every family before the pull confirms completeness."""
    reader = Mock()
    reader.query.return_value = []
    events = []
    payload = pull.pull_fabric_consumption(
        [1, 2, 3], chunk=2, client=reader, progress=events.append,
        as_of=date(2026, 10, 8),
    )
    assert reader.query.call_count == 14
    assert payload["metadata"]["requested_tpids"] == [1, 2, 3]
    assert payload["metadata"]["complete"] is True
    assert events[-1]["progress"] == 90
    reader.close.assert_not_called()


def test_high_volume_detail_is_scoped_to_capacity_subchunks():
    """Large account batches cannot create an unbounded NRT time-series query."""
    reader = Mock()
    summary = [{"tpid": 1, "capacity_id": f"capacity-{i}"} for i in range(26)]

    def respond(query, report, extension=None):
        """Return discovered capacities and no detail for this transport-only test."""
        fields = {s["Name"] for s in query["Select"]}
        if "latest_users" in fields or (
                "capacity_id" in fields and "workload" not in fields
                and "observed_at" not in fields):
            return summary
        return []

    reader.query.side_effect = respond
    pull.pull_fabric_consumption([1], client=reader)
    trend_queries = [call.args[0] for call in reader.query.call_args_list
                     if "observed_at" in {s["Name"] for s in call.args[0]["Select"]}]
    assert len(trend_queries) == 2
    assert len(trend_queries[0]["Where"][-1]["Condition"]["In"]["Values"]) == 25
    assert len(trend_queries[1]["Where"][-1]["Condition"]["In"]["Values"]) == 1


def test_resource_limit_adaptively_bisects_without_skipping_accounts():
    """A resource-heavy batch retries smaller scopes and returns every member."""
    reader = Mock()
    reader.query.side_effect = [
        pull.FabricPullError("Fabric source query error: rsQueryTimeoutExceeded."),
        [{"tpid": 1}], [{"tpid": 2}],
    ]
    rows = pull._query_scoped(
        reader, {"Select": [], "Where": []}, pull.WORKLOAD_REPORT_ID, None,
        "a", "TPID", [1, 2], True,
    )
    assert rows == [{"tpid": 1}, {"tpid": 2}]
    assert reader.query.call_count == 3


def test_scoped_pull_rejects_foreign_rows():
    """RLS or malformed query responses cannot write another customer's data."""
    reader = Mock()
    reader.query.return_value = [{"tpid": "999"}]
    with pytest.raises(pull.FabricPullError, match="outside"):
        pull.pull_fabric_consumption([1], client=reader)


def test_pagination_deduplicates_boundary_and_detects_repeated_cursor():
    """All pages must finish and duplicate boundary rows are not double-counted."""
    reader = pull.FabricQueryClient(Mock())
    reader._page = Mock(side_effect=[
        ([{"tpid": "1", "cu_hours": 2}], ["cursor"]),
        ([{"tpid": "1", "cu_hours": 2}, {"tpid": "2", "cu_hours": 3}], None),
    ])
    assert len(reader.query({}, pull.WORKLOAD_REPORT_ID)) == 2
    reader._page = Mock(return_value=([], ["cursor"]))
    with pytest.raises(pull.FabricPullError, match="repeated"):
        reader.query({}, pull.WORKLOAD_REPORT_ID)


def test_truncated_response_without_cursor_is_rejected(monkeypatch):
    """An incomplete source response cannot masquerade as a successful empty query."""
    session = Mock()
    session.post.return_value.ok = True
    session.post.return_value.status_code = 200
    session.post.return_value.text = (
        '{"results":[{"result":{"data":{"dsr":{"DS":[{"IC":false}]}}}}]}'
    )
    reader = pull.FabricQueryClient(session)
    monkeypatch.setattr(reader, "_mint", lambda report: "not-a-real-token")
    with pytest.raises(pull.FabricPullError, match="truncated"):
        reader.query({"Select": []}, pull.WORKLOAD_REPORT_ID)


def test_missing_completion_flag_is_rejected(monkeypatch):
    """A response without the protocol's completion flag is not safe to persist."""
    session = Mock()
    session.post.return_value.ok = True
    session.post.return_value.status_code = 200
    session.post.return_value.text = (
        '{"results":[{"result":{"data":{"dsr":{"DS":[{}]}}}}]}'
    )
    reader = pull.FabricQueryClient(session)
    monkeypatch.setattr(reader, "_mint", lambda report: "not-a-real-token")
    with pytest.raises(pull.FabricPullError, match="completeness"):
        reader.query({"Select": []}, pull.WORKLOAD_REPORT_ID)
