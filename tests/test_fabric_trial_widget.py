"""Distinct trial customer counts and saved-history engagement queues."""
from datetime import datetime, timedelta, timezone

from bs4 import BeautifulSoup
import pytest

from app.models import Customer, FabricConsumptionImport, FabricConsumptionRecord, db
from app.services import fabric_consumption
from app.services.salesiq_tools import execute_tool
from tests.test_fabric_renewal_widgets import render_widget, set_capacities


def trial_rows() -> list[dict]:
    """Include duplicate capacities, overlapping cohorts and unrelated SKU families."""
    skus = {
        1: ["FTL64", "FTL4", "P1", "F64", "F64"],
        2: [" ftl4 ", " p2 "],
        3: ["FTL64", " f4 "],
        4: ["FTL4"],
        5: ["P1", "F64"],
        6: ["FTL640", "P0", "F0", "F64X", "PP1", None],
        7: [None],
    }
    return [
        {
            "id": customer_id, "name": f"Customer {customer_id}",
            "capacity_index": index, "capacity_total": len(values),
            "capacity": {"sku": sku, "tenant_id": "tenant", "capacity_id": f"cap-{index}"},
        }
        for customer_id, values in skus.items() for index, sku in enumerate(values, start=1)
    ] + [{"id": 8, "capacity": None}]


@pytest.mark.parametrize(("scope", "counts"), [
    (None, (4, 2, 2)),
    ((1,), (1, 1, 1)),
    ((2, 3), (2, 1, 1)),
    ((4, 5, 6, 7, 8), (1, 0, 0)),
    ((), (0, 0, 0)),
])
def test_trial_counts_use_distinct_customers_and_intersections(monkeypatch, scope, counts):
    """Scope before counting, exclude trials from F-SKUs, and allow P/F overlap."""
    reader = set_capacities(monkeypatch, trial_rows(), {"id": 1})
    result = fabric_consumption.get_fabric_trial_conversion_widget(customer_ids=scope)
    reader.assert_called_once_with()
    assert tuple(result["counts"].values()) == counts
    assert result["destination"] == (
        "/reports/fabric-consumption?view=overview&mode=trials&customers=true"
    )
    soup = BeautifulSoup(render_widget("fabric_trial_conversion", result, "metric"), "html.parser")
    assert [int(node.text) for node in soup.select("dd")] == list(counts)
    assert "groups can overlap" in soup.text


@pytest.mark.parametrize("snapshot", [None, {"id": 1}])
def test_trial_missing_snapshot_is_not_zero(monkeypatch, snapshot):
    """Distinguish no saved data from a saved snapshot with no observed trials."""
    set_capacities(monkeypatch, [], snapshot)
    result = fabric_consumption.get_fabric_trial_conversion_widget()
    soup = BeautifulSoup(render_widget("fabric_trial_conversion", result, "metric"), "html.parser")
    assert bool(soup.select("dd")) is bool(snapshot)
    assert ("No saved Fabric snapshot" in soup.text) is (snapshot is None)
    assert result["counts"] == {
        "customers_with_trials": 0, "customers_with_p_and_trials": 0,
        "customers_with_f_and_trials": 0,
    }


def test_trial_widget_catalog_preview_and_read_tools(client, monkeypatch):
    """Expose both variants through the library and reuse the tool provider."""
    reader = set_capacities(monkeypatch, trial_rows(), {"id": 1})
    catalog = client.get("/api/reports/dashboards").json["catalog"]
    definition = next(row for row in catalog if row["key"] == "fabric.trial_conversion")
    assert [variant["key"] for variant in definition["variants"]] == ["metric", "detailed"]
    assert definition["supported_filters"] == ["customer_ids", "seller_ids", "group_by_seller"]
    response = client.get("/api/reports/dashboards/widget-preview", query_string={
        "key": "fabric.trial_conversion", "variant": "metric", "width": 6,
    })
    assert response.status_code == 200
    assert "Customers with trials" in response.json["html"]
    result = execute_tool("report_fabric_trial_conversion", {})
    assert result["counts"]["customers_with_trials"] == 4
    assert reader.call_count == 2
    created = client.post("/api/reports/dashboards", json={"name": "Trial dashboard"})
    dashboard_id = created.json["id"]
    added = client.post(f"/api/reports/dashboards/{dashboard_id}/widgets", json={
        "key": "fabric.trial_conversion",
    })
    assert added.status_code == 200
    saved = client.get(f"/api/reports/dashboards/{dashboard_id}").json["dashboard"]
    assert saved["widgets"][0]["variant_key"] == "detailed"


@pytest.fixture
def trial_history(app, monkeypatch):
    """Seed source-timestamped hourly trial data in the isolated test database."""
    with app.app_context():
        customer = Customer(name="Trial history customer", tpid=123)
        snapshot = FabricConsumptionImport(
            customer_count=1, workload_row_count=0, capacity_row_count=1, trend_row_count=1,
            source_as_of=datetime(2026, 10, 14, 20, tzinfo=timezone.utc),
        )
        db.session.add_all([customer, snapshot])
        db.session.flush()
        source = {
            "id": customer.id, "name": customer.name, "capacity_index": 1, "capacity_total": 1,
            "capacity": {"sku": "FTL64", "tenant_id": "tenant", "capacity_id": "trial"},
        }
        header = {"id": snapshot.id, "capacity_as_of": "2026-10-14T20:00:00+00:00"}
        set_capacities(monkeypatch, [source], header)
        yield customer, snapshot, source, header


def add_point(
    customer, snapshot, value, stamp=None, tenant="tenant", sku="FTL64", capacity_id="trial",
):
    """Append a known or missing hourly observation without changing source inventory."""
    db.session.add(FabricConsumptionRecord(
        import_id=snapshot.id, customer_id=customer.id, tpid=customer.tpid,
        kind="trend", capacity_id=capacity_id, sku=sku,
        observed_at=stamp or snapshot.source_as_of,
        metrics_json={"tenant_id": tenant, "utilization_pct": value},
    ))


def test_trial_grouping_preserves_both_queues_and_customer_seller_metadata(
    trial_history, monkeypatch,
):
    """Group each engagement queue independently while keeping trial rollup and totals."""
    customer, snapshot, source, header = trial_history
    sources = [
        {**source, "seller": {"id": 2, "name": "Alex"}},
        {**source, "id": customer.id + 1, "name": "Second trial",
         "seller": {"id": 1, "name": "Alex"}},
        {**source, "id": customer.id + 2, "name": "Unassigned trial", "seller": None},
        {**source, "id": customer.id + 3, "name": "Momentum trial",
         "seller": {"id": 2, "name": "Alex"}},
    ]
    set_capacities(monkeypatch, sources, header)
    for index, row in enumerate(sources):
        other = customer if not index else Customer(
            id=row["id"], name=row["name"], tpid=customer.tpid + index,
        )
        if index:
            db.session.add(other)
            db.session.flush()
        add_point(other, snapshot, 0.2 if index == 3 else 0.05)
    result = fabric_consumption.get_fabric_trial_conversion_widget()
    assert next(
        row for row in result["details"]["cohorts"]["low"] if row["id"] == customer.id
    )["seller"]["id"] == 2
    grouped = BeautifulSoup(render_widget(
        "fabric_trial_conversion", result, group_by_seller=True,
    ), "html.parser")
    low = grouped.select_one('[data-trial-cohort="low"]')
    high = grouped.select_one('[data-trial-cohort="high"]')
    assert len(low.select("tbody")) == 3
    assert len(high.select("tbody")) == 1
    assert len(grouped.select("tr[data-row-key]")) == 4
    assert len(grouped.select("tr[data-sb-sort-fixed]")) == 4
    assert [node["href"] for node in low.select(".db-report-seller")] == [
        "/seller/1", "/seller/2",
    ]
    assert "No seller assigned" in low.select("tbody")[-1].text
    assert [node["value"] for node in grouped.select('input[type="radio"]')] == ["low", "high"]
    assert render_widget("fabric_trial_conversion", result, "metric") == render_widget(
        "fabric_trial_conversion", result, "metric", group_by_seller=True,
    )
    assert fabric_consumption.get_fabric_trial_conversion_widget(customer_ids=())[
        "details"
    ]["seller_groups"] == {"low": [], "high": [], "unknown": []}
    db.session.flush()


@pytest.mark.parametrize(("value", "cohort"), [
    (0, "low"), (0.00001, "low"), (0.099999, "low"), (0.1, "high"),
    (0.2, "high"), (150, "high"), (None, "unknown"),
])
def test_trial_detail_exact_cutoff_zero_missing_and_overload(trial_history, value, cohort):
    """Use exact raw percentages, keep zero, and never put missing data in low usage."""
    customer, snapshot, _, _ = trial_history
    add_point(customer, snapshot, value)
    result = fabric_consumption.get_fabric_trial_conversion_widget()
    details = result["details"]
    assert details["counts"] == {key: int(key == cohort) for key in ("low", "high", "unknown")}
    row = details["cohorts"][cohort][0]
    assert row["average_utilization_pct"] == value
    assert row["observed_hours"] == int(value is not None)
    assert row["observed_days"] == int(value is not None)
    soup = BeautifulSoup(render_widget("fabric_trial_conversion", result), "html.parser")
    assert not soup.select(".db-trial-metrics")
    assert len(soup.select('input[type="radio"]')) == 2
    assert soup.select_one('input[value="low"]').has_attr("checked")
    assert soup.select_one(".db-report-heading .db-trial-switch")
    assert "15-day window ending" not in soup.text
    assert "Trial SKU" not in soup.text
    assert not soup.select("tbody small")
    if value is None:
        assert "excluded from both groups" in soup.text
        assert not soup.select("table")
    else:
        assert float(soup.select_one('tbody td:nth-child(3)')["data-sb-sort-value"]) == value
        assert "customer_id=" in soup.select_one("tbody a")["href"]
        assert "capacity=" not in soup.select_one("tbody a")["href"]
        assert soup.select_one(".db-trial-table-scroll table")
        assert "equal weight" in soup.select("th")[2]["title"]
        assert "across all" in soup.select("th")[3]["title"]
        if 0 < value < 0.001:
            assert "<0.001%" in soup.text
        if value == 0.099999:
            assert "<0.1%" in soup.text


def test_trial_history_window_identity_sku_and_mean(trial_history):
    """Use source time, exclude other tenants/SKUs, and average known observations only."""
    customer, snapshot, source, header = trial_history
    end = snapshot.source_as_of
    add_point(customer, snapshot, 0, end - timedelta(days=15) + timedelta(hours=1))
    add_point(customer, snapshot, 0.2, end)
    add_point(customer, snapshot, None, end - timedelta(hours=1))
    add_point(customer, snapshot, 80, end - timedelta(days=15))
    add_point(customer, snapshot, 80, end + timedelta(hours=1))
    add_point(customer, snapshot, 80, end, tenant="other-tenant")
    add_point(customer, snapshot, 80, end, sku="F64")
    details = fabric_consumption.get_fabric_trial_conversion_widget()["details"]
    row = details["cohorts"]["high"][0]
    assert row["average_utilization_pct"] == pytest.approx(0.1)
    assert (row["observed_hours"], row["observed_days"]) == (2, 2)
    assert details["window_end"] == header["capacity_as_of"]
    assert details["counts"] == {"low": 0, "high": 1, "unknown": 0}
    empty = fabric_consumption.get_fabric_trial_conversion_widget(customer_ids=())["details"]
    assert empty["counts"] == {"low": 0, "high": 0, "unknown": 0}


def test_trial_detail_instances_have_independent_controls(trial_history):
    """Duplicate widget instances use separate radio names and sorting history keys."""
    customer, snapshot, _, _ = trial_history
    add_point(customer, snapshot, 0.05)
    result = fabric_consumption.get_fabric_trial_conversion_widget()
    soup = BeautifulSoup(
        render_widget("fabric_trial_conversion", result, prefix="one-")
        + render_widget("fabric_trial_conversion", result, prefix="two-"), "html.parser",
    )
    assert {node["name"] for node in soup.select("input")} == {"one-cohort", "two-cohort"}
    assert len({node["data-sb-sort-key"] for node in soup.select("table")}) == 2


@pytest.mark.parametrize(("paid_skus", "label"), [
    ([], "Neither"), (["P1"], "P-SKU"), (["F64"], "F-SKU"), (["P1", "F64"], "P + F"),
])
def test_trial_customer_rollup_equal_capacity_weight_and_paid_context(
    trial_history, monkeypatch, paid_skus, label,
):
    """One customer row averages capacity means and history days, not pooled hours."""
    customer, snapshot, source, header = trial_history
    second = {**source, "capacity": {
        "sku": "FTL4", "tenant_id": "other", "capacity_id": "second",
    }}
    paid = [{**source, "capacity": {"sku": sku}} for sku in paid_skus]
    set_capacities(monkeypatch, [source, source, second, *paid], header)
    add_point(customer, snapshot, 0, snapshot.source_as_of - timedelta(days=1))
    add_point(customer, snapshot, 0.2)
    add_point(customer, snapshot, 0.4, tenant="other", sku="FTL4", capacity_id="second")
    result = fabric_consumption.get_fabric_trial_conversion_widget()
    details = result["details"]
    assert details["counts"] == {"low": 0, "high": 1, "unknown": 0}
    row = details["cohorts"]["high"][0]
    assert row["average_utilization_pct"] == pytest.approx(0.25)
    assert row["observed_days"] == 1.5
    assert row["trial_count"] == 2
    assert row["other_skus"] == label
    soup = BeautifulSoup(render_widget("fabric_trial_conversion", result), "html.parser")
    assert len(soup.select("tbody tr")) == 1
    context = soup.select("tbody td")[1]
    assert context["data-sb-sort-value"] == label
    assert bool(context.select(".db-trial-p-sku")) is ("P1" in paid_skus)
    assert bool(context.select(".db-trial-f-sku")) is ("F64" in paid_skus)
    assert [td.text for td in soup.select("tbody td")][2:] == ["0.25%", "1.5d"]
    assert soup.select_one("tbody td:last-child")["data-sb-sort-value"] == "1.5"


def test_trial_customer_partial_history_is_explicit_without_inventing_zero(
    trial_history, monkeypatch,
):
    """A trial without data lowers observed-day coverage, not known utilization."""
    customer, snapshot, source, header = trial_history
    second = {**source, "capacity": {
        "sku": "FTL4", "tenant_id": "other", "capacity_id": "second",
    }}
    set_capacities(monkeypatch, [source, second], header)
    add_point(customer, snapshot, 0.15)
    result = fabric_consumption.get_fabric_trial_conversion_widget()
    row = result["details"]["cohorts"]["high"][0]
    assert row["average_utilization_pct"] == pytest.approx(0.15)
    assert row["observed_days"] == 0.5
    assert row["missing_history_count"] == 1
    soup = BeautifulSoup(render_widget("fabric_trial_conversion", result), "html.parser")
    assert "1 without usable history excluded" in soup.select_one("td[title]")["title"]
