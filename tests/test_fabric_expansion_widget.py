"""Saved Power BI-led expansion signals, seller grouping, and widget integration."""
from copy import deepcopy

from bs4 import BeautifulSoup
import pytest

from app.models import Customer, Seller, db
from app.services import dashboards, fabric_consumption
from app.services.salesiq_tools import execute_tool
from tests.test_dashboard_drafts import draft_payload
from tests.test_fabric_renewal_widgets import render_widget, set_capacities


WORKLOADS = ["Power BI", "DE and DS", "Data Integration", "Data Warehousing Core"]


def expansion_row(customer_id: int, shares: list, utilization: float | None = 20) -> dict:
    """Keep shares customer-wide and capacity summary utilization independent."""
    return {
        "id": customer_id, "name": f"Customer {customer_id}",
        "capacity": {
            "tenant_id": "tenant", "capacity_id": "cap-1", "sku": "F64",
            "utilization_pct": utilization, "latest_utilization_pct": 999,
        },
        "workload_shares": dict(zip(WORKLOADS, shares)),
    }


def install_overview(monkeypatch, rows: list, snapshot: dict | None = None):
    """Replace the shared overview read and reject remote imports."""
    reader = set_capacities(monkeypatch, rows, snapshot)
    reader.return_value["workloads"] = WORKLOADS
    return reader


@pytest.mark.parametrize(("shares", "eligible", "known"), [
    ([80, 20, 0, 0], True, True),
    ([79.999, 20.001, 0, 0], False, True),
    ([0, 99, 1, 0], False, True),
    ([0.999, 98.002, 0.999, 0], False, True),
    ([1, 98, 1, 0], False, True),
    ([50, 20, 20, 10], False, True),
    ([None, 100, 0, 0], False, False),
    ([80, 10, 0, 0], False, False),
    ([0, 0, 0, 0], False, False),
    ([float("nan"), 100, 0, 0], False, False),
    ([float("inf"), 100, 0, 0], False, False),
    ([True, 99, 0, 0], False, False),
    ([-5, 105, 0, 0], False, False),
])
def test_expansion_exact_threshold_and_unknown_mix(monkeypatch, shares, eligible, known):
    """Use the unrounded 80% cutoff and exclude unavailable or unreconciled mixes."""
    install_overview(monkeypatch, [expansion_row(1, shares)], {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget()
    assert result["counts"] == {
        "customers_with_capacities": 1, "pbi_led": int(eligible), "unknown": int(not known),
    }
    assert len(result["details"]["rows"]) == int(eligible)
    profile = fabric_consumption._expansion_workload_profile(dict(zip(WORKLOADS, shares)), WORKLOADS)
    assert profile["is_pbi_led"] is eligible
    assert profile["workload_mix_available"] is known
    assert all(workload["share_pct"] > 1 for workload in profile["above_threshold_workloads"])
    if shares[0] is None:
        assert all(
            workload["name"] != "Power BI" for workload in profile["above_threshold_workloads"]
        )


@pytest.mark.parametrize(("scope", "expected"), [
    (None, (4, 1, 1)), ((1,), (1, 1, 0)), ((2, 4), (2, 0, 1)),
    ((5,), (0, 0, 0)), ((), (0, 0, 0)),
])
def test_expansion_customer_rollup_scope_and_single_queue(monkeypatch, scope, expected):
    """Scope all metrics before filtering the single customer queue."""
    first = expansion_row(1, [95, 0, 5, 0], 10)
    second = deepcopy(first)
    second["capacity"] = {**first["capacity"], "capacity_id": "cap-2", "utilization_pct": 30}
    missing = deepcopy(first)
    missing["capacity"] = {**first["capacity"], "tenant_id": "other", "utilization_pct": None}
    rows = [
        first, first, second, missing, expansion_row(2, [0.5, 99.5, 0, 0]),
        expansion_row(3, [50, 20, 20, 10]), expansion_row(4, [None, None, None, None]),
        {"id": 5, "name": "No capacities", "capacity": None},
    ]
    before = deepcopy(rows)
    reader = install_overview(monkeypatch, rows, {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget(customer_ids=scope)
    assert tuple(result["counts"].values()) == expected
    assert rows == before
    reader.assert_called_once_with()
    assert result["destination"] == (
        "/reports/fabric-consumption?view=overview&mode=f&customers=true"
    )
    if scope is None or scope == (1,):
        row = result["details"]["rows"][0]
        assert row["id"] == 1
        assert row["average_utilization_pct"] == 20
        assert row["capacity_count"] == 3
        assert row["measured_capacity_count"] == 2
        assert row["pbi_share_pct"] == 95
    else:
        assert result["details"] == {"rows": [], "seller_groups": []}


@pytest.mark.parametrize("snapshot", [None, {"id": 1}])
def test_expansion_no_snapshot_is_not_an_observed_zero(monkeypatch, snapshot):
    """Distinguish no import from a valid snapshot without qualifying customers."""
    install_overview(monkeypatch, [], snapshot)
    result = fabric_consumption.get_fabric_expansion_widget()
    for variant in ("metric", "detailed"):
        soup = BeautifulSoup(render_widget("fabric_expansion", result, variant), "html.parser")
        assert ("No saved Fabric snapshot" in soup.text) is (snapshot is None)
        if variant == "metric":
            assert bool(soup.select("dd")) is bool(snapshot)
        else:
            assert not soup.select("table")


def test_expansion_rendering_sort_keys_and_single_summary_metric(monkeypatch):
    """Keep a single queue, no tabs or footer, and safe customer links with raw values."""
    first = expansion_row(1, [80, 20, 0, 0], 0.0001)
    first["name"] = '<img src=x onerror="bad()">'
    install_overview(monkeypatch, [
        first, expansion_row(2, [None, 100, 0, 0], None), expansion_row(3, [90, 10, 0, 0], None),
    ], {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget()
    soup = BeautifulSoup(render_widget("fabric_expansion", result), "html.parser")
    assert not soup.select('input[type="radio"], .db-report-notice, img')
    assert not soup.select('input[type="checkbox"], .db-report-seller-heading')
    rows = soup.select('tbody tr')
    assert len(rows) == 2
    first_row = soup.select_one('tr[data-row-key="1"]')
    assert first_row.select_one("td a")["href"].endswith("customer_id=1")
    assert first_row.select("td")[2]["data-sb-sort-value"] == "0.0001"
    assert "<0.01%" in first_row.text
    assert rows[0].select("td")[2]["data-sb-sort-value"] == ""
    assert [node.text for node in soup.select("table")[0].select("thead th")] == [
        "Customer", "SKU", "Used %", "PBI %", "Above 1%",
    ]
    assert "equally weighted" in soup.select("th")[2]["title"]
    assert all(table.parent.get("tabindex") == "0" for table in soup.select("table"))
    assert len(soup.select("table")) == 1
    second = BeautifulSoup(render_widget("fabric_expansion", result, prefix="second-"), "html.parser")
    keys = {table["data-sb-sort-key"] for table in soup.select("table")}
    assert keys.isdisjoint(table["data-sb-sort-key"] for table in second.select("table"))
    summary = BeautifulSoup(render_widget("fabric_expansion", result, "metric"), "html.parser")
    assert [int(node.text) for node in summary.select("dd")] == [2]
    assert "Power BI-led customers" in summary.text
    assert not summary.select("table, input")


def test_expansion_catalog_preview_tool_and_saved_widget(client, monkeypatch):
    """Wire both variants, all widths, shared read tools, and normal placement."""
    install_overview(monkeypatch, [expansion_row(1, [90, 10, 0, 0])], {"id": 1})
    catalog = client.get("/api/reports/dashboards").json["catalog"]
    definition = next(row for row in catalog if row["key"] == "fabric.expansion")
    assert definition["supported_filters"] == ["customer_ids", "seller_ids", "group_by_seller"]
    for variant in definition["variants"]:
        for width in variant["widths"]:
            response = client.get("/api/reports/dashboards/widget-preview", query_string={
                "key": "fabric.expansion", "variant": variant["key"], "width": width,
            })
            assert response.status_code == 200
            assert "Fabric expansion" in response.json["html"]
    result = execute_tool("report_fabric_expansion", {})
    assert result["counts"]["pbi_led"] == 1
    assert execute_tool("report_dashboard_signals", {
        "widget_key": "fabric.expansion",
    })["counts"] == result["counts"]
    dashboard_id = client.post("/api/reports/dashboards", json={"name": "Expansion"}).json["id"]
    assert client.post(f"/api/reports/dashboards/{dashboard_id}/widgets", json={
        "key": "fabric.expansion",
    }).status_code == 200
    widget = client.get(f"/api/reports/dashboards/{dashboard_id}").json["dashboard"]["widgets"][0]
    assert widget["variant_key"] == "detailed"
    assert widget["row_span"] == 5
    payload = draft_payload(client, dashboard_id)
    payload["filter_config"] = {"live_filters": ["group_by_seller"]}
    assert client.post(
        f"/api/reports/dashboards/{dashboard_id}/save", json=payload,
    ).status_code == 200
    page = client.get(f"/reports/dashboards/{dashboard_id}?group_by_seller=true")
    assert b"ui-dashboard-filters.js" in page.data
    assert b'data-widget-filters=' in page.data
    rendered = BeautifulSoup(page.data, "html.parser")
    assert len(rendered.select(".db-report-seller-heading")) == 1
    assert len(rendered.select("tr[data-row-key]")) == 1


def test_expansion_display_is_strictly_above_one(monkeypatch):
    """Exclude subthreshold and exact-one shares while preserving source-precision hover."""
    install_overview(monkeypatch, [expansion_row(1, [97.9999, 1, 1.0001, 0])], {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget()
    assert [workload["name"] for workload in result["details"]["rows"][0][
        "above_threshold_workloads"
    ]] == ["Power BI", "Data Integration"]
    soup = BeautifulSoup(render_widget("fabric_expansion", result), "html.parser")
    badges = soup.select('.db-expansion-workload')
    assert [node.text for node in badges] == ["PBI", "DI"]
    assert badges[1]["title"] == "Data Integration: 1.0001%"


@pytest.mark.parametrize(("skus", "expected", "units", "has_p", "has_trial"), [
    (["F8", "F64", "F16"], "F64", 64, False, False),
    (["F512", "F1024", "F64"], "F1024", 1024, False, False),
    (["P1", "F32"], "F32", 32, True, False),
    (["P2", "F64"], "F64", 64, True, False),
    (["P3", "P4", "P5", "F512"], "F512", 512, True, False),
    (["FTL4", "FTL64", "F8"], "F8", 8, False, True),
    (["FTL64", "P1", " f64 "], "F64", 64, True, True),
    (["FTL64", "P1"], None, None, True, True),
    (["P1"], None, None, True, False),
    (["FTL4"], None, None, False, True),
    (["Future-SKU", "F8", None], "F8", 8, False, False),
    (["F0", "F64X", "FTL640", "PP1", "P0", None], None, None, False, False),
])
def test_expansion_largest_paid_f_sku_and_context(monkeypatch, skus, expected, units,
                                               has_p, has_trial):
    """Only paid F-SKUs qualify and determine size; P and trials stay contextual."""
    rows = []
    for index, sku in enumerate(skus):
        row = expansion_row(1, [90, 10, 0, 0])
        row["capacity"].update(sku=sku, capacity_id=f"cap-{index}")
        rows.append(row)
    install_overview(monkeypatch, rows, {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget()
    if expected is None:
        assert result["counts"]["customers_with_capacities"] == 0
        assert result["details"] == {"rows": [], "seller_groups": []}
        return
    row = result["details"]["rows"][0]
    assert row["largest_sku"] == expected
    assert row["largest_sku_cu"] == units
    assert row["has_p_sku"] is has_p
    assert row["has_trial_sku"] is has_trial
    soup = BeautifulSoup(render_widget("fabric_expansion", result), "html.parser")
    cell = soup.select_one('tbody td:nth-child(2)')
    assert cell.select_one(".db-trial-f-sku").text == expected
    assert cell["data-sb-sort-value"] == str(units)
    assert bool(cell.select(".db-trial-p-sku")) is has_p
    assert bool(cell.select(".db-expansion-trial-sku")) is has_trial


def test_expansion_excludes_conversion_only_customers_before_all_counts(monkeypatch):
    """Keep P-only and trial-only customers out even when they have Power BI-led usage."""
    rows = []
    for customer_id, skus in enumerate([
        ["P1", "FTL64"], ["P2"], ["FTL4"], ["P1", "F8", "FTL64"],
    ], start=1):
        for index, sku in enumerate(skus):
            row = expansion_row(customer_id, [90, 10, 0, 0], 10 * (index + 1))
            row["capacity"].update(sku=sku, capacity_id=f"cap-{index}")
            rows.append(row)
    install_overview(monkeypatch, rows, {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget()
    assert result["counts"] == {"customers_with_capacities": 1, "pbi_led": 1, "unknown": 0}
    row = result["details"]["rows"][0]
    assert row["id"] == 4
    assert row["largest_sku"] == "F8"
    assert row["capacity_count"] == 3
    assert row["average_utilization_pct"] == 20
    scoped = fabric_consumption.get_fabric_expansion_widget(customer_ids=(1, 2, 3))
    assert scoped["counts"]["customers_with_capacities"] == 0


def test_expansion_seller_groups_are_distinct_and_headers_fixed(monkeypatch):
    """Keep duplicate seller names separate, unassigned last, and group rows intact."""
    rows = []
    for customer_id, seller in enumerate([
        None, {"id": 3, "name": "Zed"}, {"id": 2, "name": "Alex"},
        {"id": 1, "name": "Alex"}, {"id": 1, "name": "Alex"},
    ], start=1):
        rows.append({**expansion_row(customer_id, [90, 10, 0, 0]), "seller": seller})
    install_overview(monkeypatch, rows, {"id": 1})
    result = fabric_consumption.get_fabric_expansion_widget()
    groups = result["details"]["seller_groups"]
    assert [group["seller"]["id"] if group["seller"] else None for group in groups] == [
        1, 2, 3, None,
    ]
    assert [row["id"] for row in groups[0]["rows"]] == [4, 5]
    soup = BeautifulSoup(render_widget(
        "fabric_expansion", result, group_by_seller=True,
    ), "html.parser")
    grouped = soup.select_one("table")
    assert len(grouped.select("tbody")) == 4
    assert len(grouped.select("tr[data-sb-sort-fixed]")) == 4
    assert len(grouped.select('tr[data-row-key]')) == 5
    assert "No seller assigned" in grouped.select("tbody")[-1].text
    assert all(th["scope"] == "rowgroup" for th in grouped.select("tbody th"))
    assert grouped.select_one(".badge.bg-primary .bi-person")


def test_expansion_seller_scope_and_empty_intersection(app, monkeypatch):
    """Resolve dashboard seller filters before both the flat and grouped calculations."""
    with app.app_context():
        seller = Seller(name="Expansion owner")
        first = Customer(name="Scoped expansion", seller=seller, tpid=990001)
        second = Customer(name="Other expansion", tpid=990002)
        db.session.add_all([seller, first, second])
        db.session.commit()
        install_overview(monkeypatch, [
            {**expansion_row(first.id, [80, 20, 0, 0]),
             "seller": {"id": seller.id, "name": seller.name}},
            expansion_row(second.id, [0, 100, 0, 0]),
        ], {"id": 1})
        preview = dashboards.get_widget_preview("fabric.expansion", "detailed", 6, filter_context={
            "widget": {"seller_ids": [seller.id]},
        })
        assert preview["data"]["counts"]["customers_with_capacities"] == 1
        assert preview["data"]["counts"]["pbi_led"] == 1
        assert preview["data"]["details"]["seller_groups"][0]["seller"]["id"] == seller.id
        assert preview["data"]["report_follows_scope"] is False
        empty = dashboards.get_widget_preview("fabric.expansion", "metric", 6, filter_context={
            "widget": {"seller_ids": [seller.id], "customer_ids": [second.id]},
        })
        assert empty["data"]["counts"]["customers_with_capacities"] == 0
