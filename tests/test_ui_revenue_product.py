"""Product comparison, shared monthly history and native workbench rendering."""

import json

from typing import TypedDict
from urllib.parse import parse_qs, quote, urlsplit

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


class ProductContext(TypedDict):
    """Identities for isolated matched and unmatched product revenue."""

    product: str
    customer: int
    customer_name: str
    unmatched_name: str


@pytest.fixture
def product_context(app: Flask) -> ProductContext:
    """Seed complete monthly history and an unmatched customer without live data."""
    from app.models import Customer, ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    product = 'SQL/Test <literal>'
    customer_name = '<Product & Customer>'
    unmatched_name = 'Unmatched <literal>'
    with app.app_context():
        customer = Customer(name=customer_name, tpid=76413)
        imported = RevenueImport(filename="isolated-product-ui", record_count=9)
        db.session.add_all([customer, imported])
        db.session.flush()
        months = ["FY26-Jul", "FY26-Aug", "FY26-Sep", "FY26-Oct",
                  "FY26-Nov", "FY26-Dec", "FY26-Jan", "FY26-Feb"]
        for month, revenue in zip(months, [100, 90, 80, 88, 100, 0, -20, 40]):
            db.session.add(ProductRevenueData(
                customer_name=customer_name, customer_id=customer.id, bucket="Databases",
                product=product, fiscal_month=month, month_date=fiscal_month_to_date(month),
                revenue=revenue, last_import_id=imported.id,
            ))
        db.session.add(ProductRevenueData(
            customer_name=unmatched_name, bucket="Fabric", product=product,
            fiscal_month="FY26-Jul", month_date=fiscal_month_to_date("FY26-Jul"),
            revenue=25, last_import_id=imported.id,
        ))
        db.session.commit()
        return {"product": product, "customer": customer.id, "customer_name": customer_name,
                "unmatched_name": unmatched_name}


@pytest.mark.parametrize("prefix", ["/product", "/revenue/product"])
@pytest.mark.parametrize("embedded", [False, True])
def test_product_workbench_preserves_aliases_links_and_stacked_fallback(
    client: FlaskClient, product_context: ProductContext, prefix: str, embedded: bool,
) -> None:
    """The searchable comparison retains all original destinations and fallback history."""
    path = f'{prefix}/{quote(product_context["product"])}'
    response = client.get(path + ("?embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="product"][data-sb-page-surface]')
    assert root.select_one("h1").get_text(" ", strip=True) == product_context["product"]
    assert root.select_one("a.sb-revenue-command")["href"] == "/products"
    assert root.select_one('#productCustomerSearch[type="search"]')
    assert len(soup.select("#productCustomerSearch")) == 1
    assert not root.select("#customerSearch")
    assert root.select_one('label[for="productCustomerSearch"]')
    assert not root.select("[onkeyup], .card, .btn, .badge, .table, .row, .alert")
    assert not root.has_attr("data-sb-product-enhanced")
    rows = root.select("#customersTable tbody tr")
    assert [header.text for header in root.select("#customersTable thead th")] == [
        "Customer", "Bucket", "Total Revenue",
    ]
    assert all(len(row.select("th, td")) == 3 for row in rows)
    assert all(len(row.select("[data-sb-product-search-value]")) == 3 for row in rows)
    assert root.select_one("#productCustomerSearch")["placeholder"] == "Customer, bucket or total"
    assert len(rows) == 2
    assert rows[0].find("a")["href"] == f'/customer/{product_context["customer"]}/revenue'
    assert rows[0].select_one(".sb-product-hub")["href"] == (
        f'/customer/{product_context["customer"]}'
    )
    assert not rows[1].find("a")
    assert rows[1].find("th").get_text(strip=True) == product_context["unmatched_name"]
    assert all(row.select_one("[data-sb-product-select][hidden]") for row in rows)
    panels = root.select("[data-sb-product-history]")
    assert len(panels) == 2
    assert all(not panel.has_attr("hidden") for panel in panels)
    assert "<Product & Customer>" not in str(root)
    assert soup.select_one('script[src="/static/js/ui-revenue-product.js"][defer]')
    assert [metric.text for metric in root.select("[data-sb-product-metric]")] == [
        "2", "$503", "$252",
    ]
    if embedded:
        assert not root.select("[data-sb-product-trend]")
        assert not soup.select('script[src="/static/js/vendor/chart.umd.min.js"]')
        assert "sb-page-frame" not in soup.body.get("class", [])
        assert not soup.select(".sb-app-bar, .sb-context-bar, footer")
    else:
        trends = root.select("[data-sb-product-trend][hidden]")
        assert len(trends) == 2
        points = json.loads(trends[0].select_one("[data-sb-product-trend-data]").text)
        assert [point["revenue"] for point in points] == [100, 90, 80, 88, 100, 0, -20, 40]
        assert points[0]["month"] == "2025-07-01"
        assert points[-1]["month"] == "2026-02-01"
        assert soup.select_one('script[src="/static/js/vendor/chart.umd.min.js"][defer]')
        assert soup.select_one('script[src="/static/js/ui-revenue-product-trend.js"][defer]')
        assert "sb-page-frame" in soup.body["class"]
        assert soup.select_one("[data-sb-product-status]").text == (
            "2 of 2 customer entries shown"
        )
        assert "all entries and all imported months" in soup.select_one("footer").text
        assert soup.select_one(".sb-context-bar [aria-current='page'] > span[title]").text == (
            product_context["product"]
        )


def test_product_monthly_history_preserves_every_row_change_and_zero_semantics(
    client: FlaskClient, product_context: ProductContext,
) -> None:
    """Shared rendering preserves negative/zero amounts and exact change boundaries."""
    soup = BeautifulSoup(client.get(
        f'/product/{quote(product_context["product"])}'
    ).data, "html.parser")
    history = soup.select_one("[data-sb-product-history] table")
    assert [header.text for header in history.select("thead th")] == [
        "Month", "Revenue", "Change",
    ]
    rows = history.select("tbody tr")
    assert [row.find("th").text for row in rows] == [
        "FY26-Feb", "FY26-Jan", "FY26-Dec", "FY26-Nov",
        "FY26-Oct", "FY26-Sep", "FY26-Aug", "FY26-Jul",
    ]
    assert [row.select("td")[0].text for row in rows] == [
        "$40", "$-20", "$0", "$100", "$88", "$80", "$90", "$100",
    ]
    assert [row.select("td")[1].get_text(strip=True) for row in rows] == [
        "-", "-", "-100.0%", "+13.6%", "+10.0%", "-11.1%", "-10.0%", "-",
    ]
    assert rows[2].select_one('[data-tone="danger"]')
    assert rows[3].select_one('[data-tone="positive"]')
    assert not rows[4].select_one("[data-tone]")
    assert not rows[6].select_one("[data-tone]")
    assert history.find("caption")
    assert all(header["scope"] == "row" for header in history.select("tbody th"))


def test_product_entries_and_existing_name_grouping_remain_distinct(
    app: Flask, client: FlaskClient, product_context: ProductContext,
) -> None:
    """Multiple bucket rows retain the existing route's single name-keyed history."""
    from app.models import ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    with app.app_context():
        imported = RevenueImport(filename="isolated-duplicate-bucket", record_count=1)
        db.session.add(imported)
        db.session.flush()
        db.session.add(ProductRevenueData(
            customer_name=product_context["customer_name"],
            customer_id=product_context["customer"], bucket="Fabric",
            product=product_context["product"], fiscal_month="FY26-Jul",
            month_date=fiscal_month_to_date("FY26-Jul"), revenue=50,
            last_import_id=imported.id,
        ))
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/product/{quote(product_context["product"])}'
    ).data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="product"]')
    assert len(root.select("[data-sb-product-entry]")) == 3
    assert len({row["id"] for row in root.select("[data-sb-product-entry]")}) == 3
    assert len(root.select("[data-sb-product-history]")) == 2
    assert [m.text for m in root.select("[data-sb-product-metric]")] == [
        "3", "$553", "$184",
    ]
    assert root.select_one("[data-sb-product-history] tbody td").text == "$50"


def test_consolidated_product_preserves_totals_and_exposes_every_member(
    app: Flask, client: FlaskClient, product_context: ProductContext,
) -> None:
    """Prefix consolidation stays server-owned and member labels remain escaped."""
    from app.models import ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    members = ["Azure Synapse Analytics SQL", "Azure Synapse Analytics Spark <literal>"]
    with app.app_context():
        imported = RevenueImport(filename="isolated-consolidated-product", record_count=2)
        db.session.add(imported)
        db.session.flush()
        for member, revenue in zip(members, [10, 20]):
            db.session.add(ProductRevenueData(
                customer_name=product_context["customer_name"],
                customer_id=product_context["customer"], bucket="Analytics",
                product=member, fiscal_month="FY26-Jul",
                month_date=fiscal_month_to_date("FY26-Jul"), revenue=revenue,
                last_import_id=imported.id,
            ))
        db.session.commit()
    soup = BeautifulSoup(client.get("/product/Azure%20Synapse%20Analytics").data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="product"]')
    details = root.select_one("details.sb-product-members")
    assert not details.has_attr("open")
    assert details.find("summary").text == "Consolidated from 2 products"
    assert sorted(item.text for item in details.select("li")) == sorted(members)
    assert "<literal>" not in str(details)
    assert [m.text for m in root.select("[data-sb-product-metric]")] == ["1", "$30", "$30"]
    assert root.select_one("[data-sb-product-history] tbody td").text == "$30"
    points = json.loads(root.select_one("[data-sb-product-trend-data]").text)
    assert points == [{"month": "2025-07-01", "label": "FY26-Jul", "revenue": 30}]


def test_empty_product_has_honest_counts_and_disabled_search(client: FlaskClient) -> None:
    """A valid empty product cannot acquire a fake comparison or selected customer."""
    soup = BeautifulSoup(client.get("/product/No%20product").data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="product"]')
    assert "No customers found" in root.text
    assert [m.text for m in root.select("[data-sb-product-metric]")] == ["0", "$0", "$0"]
    assert root.select_one("#productCustomerSearch[disabled]")
    assert not root.select("table, [data-sb-product-entry], [data-sb-product-history]")
    assert root.select_one("[data-sb-product-reading][hidden]")


def test_consolidated_member_information_remains_available_without_customer_entries(
    client: FlaskClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Consolidation metadata does not disappear when customer summaries are unavailable."""
    monkeypatch.setattr("app.services.revenue_import.get_all_products", lambda: [
        {"product": "Azure Synapse Analytics SQL", "total_revenue": 100, "customer_count": 1},
    ])
    monkeypatch.setattr("app.services.revenue_import.get_customers_using_product", lambda product: [])
    soup = BeautifulSoup(client.get("/product/Azure%20Synapse%20Analytics").data, "html.parser")
    reading = soup.select_one("[data-sb-product-reading]")
    assert not reading.has_attr("hidden")
    assert reading.select_one(".sb-product-members li").text == "Azure Synapse Analytics SQL"


def test_product_missing_history_is_explicit(
    client: FlaskClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Customer summary metadata can remain available without imported detail rows."""
    monkeypatch.setattr("app.services.revenue_import.get_customers_using_product", lambda product: [
        {"customer_name": "No history", "customer_id": None, "bucket": "Data",
         "total_revenue": 100},
    ])
    soup = BeautifulSoup(client.get("/product/No%20history").data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="product"]')
    assert root.select_one("#customersTable tbody td:last-child").text == "$100"
    assert root.select_one("[data-sb-product-fallback-empty]").text == (
        "No revenue history available for this product."
    )
    assert root.select_one("[data-sb-product-missing-history] .sb-revenue-empty").text == (
        "No revenue history available for this customer entry."
    )


def test_product_comparison_links_literal_matched_and_unmatched_customer_names(
    client: FlaskClient, product_context: ProductContext,
) -> None:
    """Imported names stay escaped and navigable even without a matched customer ID."""
    response = client.get(
        f'/product/{quote(product_context["product"])}', query_string={"comparison": "1"},
    )
    soup = BeautifulSoup(response.data, "html.parser")
    rows = soup.select("#directoryCustomersTable tbody tr")
    assert len(rows) == 2
    for row, name in zip(rows, [
        product_context["customer_name"], product_context["unmatched_name"],
    ]):
        link = row.select_one("th a")
        assert link.text == name
        assert parse_qs(urlsplit(link["href"]).query) == {
            "customer": [name], "bucket": [row["data-bucket"]],
        }
        assert client.get(link["href"]).status_code == 200
    assert rows[0].select_one(".sb-product-hub")["href"] == (
        f'/customer/{product_context["customer"]}'
    )
    assert not rows[1].select(".sb-product-hub")
    assert "<Product & Customer>" not in response.get_data(as_text=True)
    assert "Unmatched <literal>" not in response.get_data(as_text=True)
