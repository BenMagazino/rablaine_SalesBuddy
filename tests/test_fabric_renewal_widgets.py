"""Saved renewal and Fabric pressure providers and direct widget rendering."""
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup
from flask import Flask, render_template
import pytest

from app.services import fabric_consumption, ptof


REFERENCE = date(2026, 10, 18)


def renewal_row(expiration: str | None, **overrides: object) -> dict:
    """Build one source subscription row, not an account assessment."""
    return {
        "customer_id": 7, "customer_name": "Renewal customer", "tpid": 123,
        "expiration_date": expiration, "subscription_status": "Anniversary",
        "renewal_status": "P-to-F Renewed; Pending Renewal",
        "product_family": "Power BI Premium P1", "sa_expiration_amount": 1200,
        "psku_renewal_amount": None, **overrides,
    }


def capacity_row(capacity_id: str = "cap", tenant_id: str = "tenant", **metrics: object) -> dict:
    """Build one native capacity row with independent percent metrics."""
    return {
        "id": 7, "name": "Fabric customer", "seller": {"id": 3, "name": "Seller"},
        "capacity": {
            "capacity_id": capacity_id, "tenant_id": tenant_id, "sku": "F64",
            "latest_utilization_pct": 20, "max_30s_utilization_pct": 40,
            "throttling_seconds": 0, "utilization_pct": 999, **metrics,
        },
        "capacity_index": 1, "capacity_total": 1,
    }


def set_renewals(monkeypatch: pytest.MonkeyPatch, rows: list, snapshot: dict | None) -> Mock:
    """Supply the existing shared renewal report without remote reads."""
    reader = Mock(return_value={
        "snapshot": snapshot, "summary": [{"sa_expiration_amount": 999999}],
        "details": rows,
    })
    monkeypatch.setattr(ptof, "get_ptof_report", reader)
    monkeypatch.setattr(ptof, "pull_ptof", Mock(side_effect=AssertionError("Remote read")))
    return reader


def set_capacities(monkeypatch: pytest.MonkeyPatch, rows: list, snapshot: dict | None) -> Mock:
    """Supply the existing overview and reject any remote consumption read."""
    reader = Mock(return_value={
        "snapshot": snapshot, "rows": rows, "workloads": [], "totals": {},
    })
    monkeypatch.setattr(fabric_consumption, "get_fabric_capacity_overview", reader)
    monkeypatch.setattr(fabric_consumption, "pull_fabric_consumption",
                        Mock(side_effect=AssertionError("Remote read")))
    return reader


def render_widget(name: str, data: dict, variant: str = "detailed",
                  prefix: str = "first-") -> str:
    """Render a widget directly without central dashboard registration or databases."""
    app = Flask(__name__, template_folder=str(Path(__file__).resolve().parents[1] / "templates"))
    with app.app_context():
        return render_template(
            f"partials/widgets/{name}.html",
            instance=SimpleNamespace(data=data, variant_key=variant), widget_id_prefix=prefix,
        )


def test_renewals_inclusive_window_and_separate_source_grains(monkeypatch):
    """Include today/day 90, preserve renewed assessments, and exclude unknown dates."""
    end = REFERENCE + timedelta(days=90)
    reader = set_renewals(monkeypatch, [
        renewal_row(end.isoformat()),
        renewal_row(REFERENCE.isoformat(), sa_expiration_amount=None),
        renewal_row((REFERENCE - timedelta(days=1)).isoformat()),
        renewal_row((end + timedelta(days=1)).isoformat()),
        renewal_row(None),
        renewal_row("malformed"),
    ], {"imported_at": "2026-10-01T12:00:00+00:00"})
    result = ptof.get_ptof_renewals_widget(REFERENCE)
    reader.assert_called_once_with()
    assert result["scope"] == "all_local_accounts"
    assert result["reference_date"] == REFERENCE.isoformat()
    assert result["window_end"] == end.isoformat()
    assert [row["days_until_expiration"] for row in result["rows"]] == [0, 90]
    assert result["counts"] == {
        "upcoming": 2, "customers": 1, "past": 1, "undated": 2, "later": 1,
        "missing_sa_amount": 1,
    }
    assert result["sa_expiration_amount"] == 1200
    assert not result["sa_amount_complete"]
    assert len({row["row_key"] for row in result["rows"]}) == 2
    assert result["rows"][0]["renewal_status"] == "P-to-F Renewed; Pending Renewal"
    assert result["rows"][0]["destination"] == "/reports/p-to-f?customer_id=7"
    assert result["destination"] == "/reports/p-to-f"


@pytest.mark.parametrize(("snapshot", "state"), [(None, "not_imported"), ({}, "empty")])
def test_renewals_snapshot_empty_states(monkeypatch, snapshot, state):
    """Distinguish never imported from a saved snapshot with no subscription rows."""
    set_renewals(monkeypatch, [], snapshot)
    result = ptof.get_ptof_renewals_widget(REFERENCE)
    assert result["snapshot_state"] == state
    assert result["sa_expiration_amount"] is None
    html = render_widget("ptof_renewals", result)
    assert "db-report-empty" in html
    assert "live" not in html


def test_renewals_no_silent_row_cap_and_unknown_amount(monkeypatch):
    """Show every qualifying source subscription, including unknown dollar amounts."""
    set_renewals(monkeypatch, [
        renewal_row(REFERENCE.isoformat(), sa_expiration_amount=None) for _ in range(125)
    ], {"imported_at": None})
    result = ptof.get_ptof_renewals_widget(REFERENCE)
    assert len(result["rows"]) == 125
    assert result["sa_expiration_amount"] is None
    assert result["counts"]["missing_sa_amount"] == 125


def test_pressure_native_signals_priority_overlap_and_tenant_identity(monkeypatch):
    """Throttle wins; peaks remain historical and native overload is not clamped."""
    reader = set_capacities(monkeypatch, [
        capacity_row("calm"),
        capacity_row("spike", max_30s_utilization_pct=130),
        capacity_row("near", latest_utilization_pct=80),
        capacity_row("overload", latest_utilization_pct=145),
        capacity_row("throttle", throttling_seconds=2, latest_utilization_pct=120,
                     max_30s_utilization_pct=200),
        capacity_row("same", "tenant one", latest_utilization_pct=99),
        capacity_row("same", "tenant two", latest_utilization_pct=100),
    ], {"capacity_as_of": "2026-10-01T12:00:00+00:00",
        "capacity_window": "Source-retained NRT history", "imported_at": "2026-10-02"})
    result = fabric_consumption.get_fabric_capacity_pressure_report(REFERENCE)
    reader.assert_called_once_with()
    assert result["rows"][0]["capacity"]["capacity_id"] == "throttle"
    assert [row["priority"] for row in result["rows"]] == [0, 1, 1, 2, 2, 3, 4]
    assert result["counts"] == {
        "capacities": 7, "attention": 6, "throttled": 1, "overloaded": 3,
        "near_limit": 2, "historical_spike": 2, "unknown": 0, "below_threshold": 1,
        "customers_without_capacity": 0,
    }
    assert result["snapshot_age_days"] == 17
    assert result["capacity_as_of"] == "2026-10-01T12:00:00+00:00"
    overloaded = next(
        row for row in result["rows"] if row["capacity"]["capacity_id"] == "overload"
    )
    assert overloaded["latest_utilization_pct"] == 145
    spike = next(row for row in result["rows"] if row["state"] == "historical_spike")
    assert spike["latest_utilization_pct"] == 20
    assert len({row["row_key"] for row in result["rows"]}) == 7
    for row in result["rows"]:
        query = parse_qs(urlparse(row["destination"]).query)
        assert query == {"customer_id": ["7"], "capacity": [row["capacity_key"]]}


def test_pressure_missing_metrics_are_not_healthy_or_zero(monkeypatch):
    """A complete zero differs from missing, non-finite, and partially flagged metrics."""
    set_capacities(monkeypatch, [
        capacity_row("unknown", latest_utilization_pct=None,
                     max_30s_utilization_pct=float("nan"), throttling_seconds=None),
        capacity_row("part", latest_utilization_pct=100, throttling_seconds=None),
        capacity_row("zero", latest_utilization_pct=0,
                     max_30s_utilization_pct=0, throttling_seconds=0),
        {"id": 8, "name": "No capacities", "capacity": None},
    ], {"capacity_as_of": None, "imported_at": "2026-10-01"})
    result = fabric_consumption.get_fabric_capacity_pressure_report(REFERENCE)
    assert result["counts"]["unknown"] == 2
    assert result["counts"]["attention"] == 1
    assert result["counts"]["below_threshold"] == 1
    assert result["counts"]["customers_without_capacity"] == 1
    assert result["snapshot_age_days"] is None
    unknown = next(row for row in result["rows"] if row["state"] == "unknown")
    assert unknown["latest_utilization_pct"] is None
    assert unknown["max_30s_utilization_pct"] is None
    assert unknown["throttling_seconds"] is None
    html = render_widget(
        "fabric_capacity_pressure", fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE),
    )
    assert "date unknown" not in html
    assert "incomplete" not in html
    assert "accounts without capacity data" not in html


@pytest.mark.parametrize(("snapshot", "state"), [(None, "not_imported"), ({}, "empty")])
def test_pressure_snapshot_empty_states(monkeypatch, snapshot, state):
    """Never characterize absent capacity data as a clean bill of health."""
    set_capacities(monkeypatch, [], snapshot)
    result = fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE)
    assert result["snapshot_state"] == state
    assert result["counts"]["capacities"] == 0
    assert "db-report-empty" in render_widget("fabric_capacity_pressure", result)


def test_widget_details_raw_sort_values_unique_ids_and_safe_text(monkeypatch):
    """Detailed native tables preserve raw numbers and escape source text."""
    widget = "ptof_renewals"
    set_renewals(monkeypatch, [
        renewal_row(REFERENCE.isoformat(), customer_name="<script>bad()</script>"),
    ], {"imported_at": "2026-10-01"})
    data = ptof.get_ptof_renewals_widget(REFERENCE)
    html = render_widget(widget, data, prefix="one-") + render_widget(
        widget, data, prefix="two-",
    )
    soup = BeautifulSoup(html, "html.parser")
    assert not soup.find("script")
    tables = soup.select("table[data-sb-sortable]")
    assert len(tables) == 2
    assert len({table["data-sb-sort-key"] for table in tables}) == 2
    assert len({heading["id"] for heading in soup.select("h2")}) == 2
    assert soup.select_one('td[data-sb-sort-value="1200"]')
    assert not BeautifulSoup(render_widget(widget, data, "metric"), "html.parser").find("table")


def test_pressure_no_silent_row_cap_or_cross_customer_dedup(monkeypatch):
    """All capacities remain visible; identical source IDs can belong to different accounts."""
    rows = [capacity_row(str(index)) for index in range(125)]
    other = capacity_row("0")
    other.update(id=8, name="Other customer")
    rows.extend([other, rows[0]])
    set_capacities(monkeypatch, rows, {"capacity_as_of": None})
    result = fabric_consumption.get_fabric_capacity_pressure_report(REFERENCE)
    assert result["counts"]["capacities"] == 126
    assert len({row["row_key"] for row in result["rows"]}) == 126


def test_provider_default_reference_is_local_calendar_date(monkeypatch):
    """Date-only dashboard windows follow date.today without mocking datetime."""
    set_renewals(monkeypatch, [], None)
    set_capacities(monkeypatch, [], None)
    assert ptof.get_ptof_renewals_widget()["reference_date"] == date.today().isoformat()
    assert fabric_consumption.get_fabric_capacity_pressure_widget()["reference_date"] == (
        date.today().isoformat()
    )


@pytest.mark.parametrize("as_of", [None, "", "invalid", {}, 10**50])
def test_pressure_unknown_source_time_does_not_crash_or_imply_freshness(monkeypatch, as_of):
    """Missing or malformed snapshot timestamps remain unknown without hiding capacity rows."""
    set_capacities(monkeypatch, [capacity_row()], {"capacity_as_of": as_of})
    data = fabric_consumption.get_fabric_capacity_pressure_report(REFERENCE)
    assert data["capacity_as_of"] is None
    assert data["snapshot_age_days"] is None
    assert len(data["rows"]) == 1
    assert "date unknown" not in render_widget(
        "fabric_capacity_pressure", fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE),
    )


@pytest.mark.parametrize("widget", ["ptof_renewals", "fabric_capacity_pressure"])
def test_widget_metric_markup_keeps_horizontal_name_value_groups(monkeypatch, widget):
    """Each metric exposes a grouped name/value pair for shared horizontal flex styling."""
    if widget == "ptof_renewals":
        set_renewals(monkeypatch, [renewal_row(REFERENCE.isoformat())], {})
        data = ptof.get_ptof_renewals_widget(REFERENCE)
    else:
        set_capacities(monkeypatch, [capacity_row()], {})
        data = fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE)
    soup = BeautifulSoup(render_widget(widget, data, "metric"), "html.parser")
    groups = soup.select(".db-report-metrics > div")
    assert groups
    for group in groups:
        assert [child.name for child in group.find_all(recursive=False)] == ["dt", "dd"]
    assert not soup.find("table")
