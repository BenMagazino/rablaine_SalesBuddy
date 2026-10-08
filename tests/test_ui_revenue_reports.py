"""Native revenue reports retain provider values, grouping, links and export contracts."""

from datetime import date
from typing import TypedDict

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


class SynapseCustomer(TypedDict):
    """Complete report-provider shape shared by new and current modes."""

    customer_name: str
    seller_name: str | None
    first_usage_date: date | None
    first_usage_fiscal: str | None
    total_revenue: float
    latest_month_revenue: float
    avg_4mo_revenue: float
    customer_id: int | None
    tpid_url: str | None


@pytest.fixture
def synapse_rows(monkeypatch: pytest.MonkeyPatch) -> list[SynapseCustomer]:
    """Stub only report providers; rendering still uses the isolated application."""
    rows: list[SynapseCustomer] = [
        {
            "customer_name": "Literal <customer & team>", "seller_name": "R&D <seller>",
            "first_usage_date": date(2026, 1, 1), "first_usage_fiscal": "FY26-Jan",
            "total_revenue": 100.49, "latest_month_revenue": -0.25,
            "avg_4mo_revenue": 3.75, "customer_id": 17,
            "tpid_url": "https://example.test/account?TPID=123",
        },
        {
            "customer_name": "Unmatched", "seller_name": "R&D <seller>",
            "first_usage_date": date(2025, 12, 1), "first_usage_fiscal": "FY26-Dec",
            "total_revenue": -2.75, "latest_month_revenue": 1.49,
            "avg_4mo_revenue": 0.0, "customer_id": None, "tpid_url": None,
        },
        {
            "customer_name": "Unknown date", "seller_name": None,
            "first_usage_date": None, "first_usage_fiscal": None,
            "total_revenue": 0.0, "latest_month_revenue": 0.0,
            "avg_4mo_revenue": -1.0, "customer_id": None, "tpid_url": None,
        },
    ]
    monkeypatch.setattr("app.services.revenue_sync.has_revenue_data", lambda: True)
    monkeypatch.setattr("app.services.revenue_import.get_new_product_users",
                        lambda product, months_lookback: [dict(row) for row in rows])
    monkeypatch.setattr("app.services.revenue_import.get_current_product_users",
                        lambda product: [dict(row) for row in rows])
    monkeypatch.setattr("app.services.revenue_import.get_months_in_database", lambda: [
        {"month_date": date(2025, 12, 1), "fiscal_month": "FY26-Dec"},
        {"month_date": date(2025, 11, 1), "fiscal_month": "FY26-Nov"},
    ])
    return rows


@pytest.mark.parametrize("mode", ["new", "current"])
@pytest.mark.parametrize("embedded", [False, True])
def test_synapse_native_contract_and_exact_values(
    client: FlaskClient, synapse_rows: list[SynapseCustomer], mode: str, embedded: bool,
) -> None:
    """Every column is sortable without changing financial values or report scope."""
    response = client.get("/reports/synapse-customers", query_string={
        "mode": mode, **({"embed": "1"} if embedded else {}),
    })
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(".sb-synapse-report")
    assert ("sb-directory-frame" in root.get("class", [])) is not embedded
    assert root["data-sb-report-key"] == "synapse-" + mode
    assert root["data-sb-report-embedded"] == str(embedded).lower()
    assert soup.select_one('script[src$="/js/ui-revenue-reports.js"]')
    assert not root.select(".card, .btn, .table, .nav-tabs, .container-fluid")
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select("footer.sb-page-status")) is not embedded
    assert root.select_one('[aria-current="page"]').text == (
        "Current Synapse Customers" if mode == "current" else "New Synapse Customers"
    )
    assert len(root.select(".sb-synapse-table")) == 2
    if mode == "current":
        assert "any imported" in root.select_one("header p").text
        assert not root.select(".sb-synapse-period")
    else:
        assert "6 complete imported months" in root.select_one("header p").text
        assert root.select_one(".sb-synapse-period")
    assert len(root.select("tbody tr")) == len(synapse_rows)
    assert root.select_one('[data-export-url]')["data-export-url"] == synapse_rows[0]["tpid_url"]
    assert root.select_one('a[href="/customer/17/revenue"]').text == synapse_rows[0]["customer_name"]
    assert [dd.text for dd in root.select(".sb-synapse-summary dd")] == ["3", "2", "$98", "$1"]
    for table in root.select(".sb-synapse-table"):
        assert table.has_attr("data-sb-sortable")
        assert len(table.select("thead [data-sb-sort-type]")) == 4
        assert all(th.has_attr("data-export-label") for th in table.select("thead th"))
        assert table.select("thead th")[1]["data-sb-sort-type"] == (
            "number" if mode == "current" else "date"
        )
    literal = next(row for row in root.select("tbody tr") if "Literal" in row.text)
    assert literal.select("td")[2]["data-sb-sort-value"] == "100.49"
    assert literal.select("td")[3]["data-sb-sort-value"] == "-0.25"
    assert literal.select("td")[3].get_text(strip=True) == "-"
    if mode == "new":
        assert literal.select("td")[1]["data-sb-sort-value"] == "2026-01-01"
        unknown = root.select("tbody tr")[-1].select("td")[1]
        assert unknown["data-sb-sort-value"] == ""
        assert unknown.text == "Unknown"
    else:
        assert literal.select("td")[1]["data-sb-sort-value"] == "3.75"
        assert root.select_one("table")["data-sb-sort-default-direction"] == "descending"
    assert ("synapse-customers-" + mode).encode() in response.data
    assert b'const TABLE_SELECTOR = ".sb-synapse-table"' in response.data
    assert soup.select_one('script[src$="/js/ui-synapse-mode.js"]')["data-mode"] == mode
    if embedded:
        assert all("embed=1" in a["href"] for a in root.select(".sb-synapse-modes a"))


@pytest.mark.parametrize("mode", ["new", "current"])
def test_synapse_no_data_import_recovery(
    client: FlaskClient, monkeypatch: pytest.MonkeyPatch, mode: str,
) -> None:
    """Both modes offer the real import destination rather than a broken command."""
    monkeypatch.setattr("app.services.revenue_sync.has_revenue_data", lambda: False)
    response = client.get("/reports/synapse-customers?mode=" + mode)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one('.sb-revenue-empty a')["href"] == "/revenue/import"
    assert not soup.select(".sb-synapse-summary, .sb-synapse-table")


@pytest.mark.parametrize("mode", ["new", "current", "invalid"])
def test_synapse_empty_results_and_mode_fallback(
    client: FlaskClient, synapse_rows: list[SynapseCustomer], mode: str,
) -> None:
    """Existing invalid-mode normalization and distinct empty explanations remain."""
    synapse_rows.clear()
    response = client.get("/reports/synapse-customers?mode=" + mode)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert not soup.select(".sb-synapse-table")
    expected = "current" if mode == "current" else "new"
    assert soup.select_one(".sb-revenue-empty h2").text == f"No {expected} Synapse customers"
    assert soup.select_one('script[src$="/js/ui-synapse-mode.js"]')["data-mode"] == expected


def test_revenue_reports_hub_retains_real_destinations(client: FlaskClient) -> None:
    """One actual report is a purposeful native row, not a fabricated card grid."""
    response = client.get("/reports/revenue-reports")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(".sb-revenue-reports")
    assert "sb-directory-frame" in root["class"]
    assert root.select_one('h1').text == "Revenue Reports"
    assert not root.select(".card, .btn")
    assert len(root.select(".sb-revenue-report-entry")) == 1
    assert root.select_one(".sb-revenue-report-entry")["href"] == "/reports/synapse-customers"
    assert root.select_one(".sb-revenue-command")["href"] == "/reports/revenue"


def test_report_contextual_help_describes_actual_scope(app: Flask) -> None:
    """Dedicated F1 help covers modes, grouping, sorting and export scope."""
    with app.test_client() as client:
        response = client.get("/static/js/page-help.js")
    assert response.status_code == 200
    assert b"title: 'Synapse Customers'" in response.data
    assert b"all seller tables" in response.data
