"""Native Products directory preserves imported aggregates and navigation."""

from typing import TypedDict
from urllib.parse import parse_qs, quote, urlsplit

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


class DirectoryContext(TypedDict):
    """Expected literal names and positive-pair totals in isolated data."""

    product: str


@pytest.fixture
def directory_context(app: Flask) -> DirectoryContext:
    """Seed repeated customers, consolidated members and excluded nonpositive pairs."""
    from app.models import ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    product = 'SQL/Compute <literal & name>'
    with app.app_context():
        imported = RevenueImport(filename="isolated-directory-ui", record_count=8)
        db.session.add(imported)
        db.session.flush()
        records = [
            (product, "Same customer", "Data", "FY26-Jul", 100),
            (product, "Same customer", "Data", "FY26-Aug", -20),
            (product, "Same customer", "Infra", "FY26-Jul", 30),
            (product, "Excluded zero", "Data", "FY26-Jul", 0),
            (product, "Excluded negative", "Data", "FY26-Jul", -50),
            ("Azure Synapse Analytics SQL", "Same customer", "Data", "FY26-Jul", 200),
            ("Azure Synapse Analytics Spark", "Same customer", "Data", "FY26-Jul", 150),
            ("Low product", "Other customer", "Data", "FY26-Jul", 10),
        ]
        for name, customer, bucket, month, revenue in records:
            db.session.add(ProductRevenueData(
                product=name, customer_name=customer, bucket=bucket, fiscal_month=month,
                month_date=fiscal_month_to_date(month), revenue=revenue,
                last_import_id=imported.id,
            ))
        db.session.commit()
    return {"product": product}


@pytest.mark.parametrize("prefix", ["/products", "/revenue/products"])
@pytest.mark.parametrize("embedded", [False, True])
def test_products_aliases_preserve_all_values_links_and_native_boundaries(
    client: FlaskClient, directory_context: DirectoryContext, prefix: str, embedded: bool,
) -> None:
    """All aliases retain aggregate/order semantics, escaping and original destinations."""
    response = client.get(prefix + ("?embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-products-directory][data-sb-page-surface]")
    assert root.select_one("h1").get_text(strip=True) == "Products"
    assert root.select_one('label[for="directoryProductSearch"]')
    assert len(soup.select("#directoryProductSearch")) == 1
    assert root.select_one('#directoryProductSearch[type="search"]:not([disabled])')
    assert not root.select("[onkeyup], .card, .btn, .badge, .table, .container-fluid")
    assert soup.select_one('script[src="/static/js/ui-revenue-products.js"][defer]')
    assert [cell.text for cell in root.select("#productsTable thead th")] == [
        "Product", "Usage entries", "Total Revenue",
    ]
    rows = root.select("[data-sb-directory-product]")
    assert [row.select_one("th").get_text(strip=True) for row in rows] == [
        "Azure Synapse Analytics", directory_context["product"], "Low product",
    ]
    assert [[cell.text for cell in row.select("td")] for row in rows] == [
        ["2", "$350"], ["2", "$110"], ["1", "$10"],
    ]
    assert all(len(row.select("[data-sb-directory-value]")) == 3 for row in rows)
    assert all(row.select_one('th[scope="row"] a') for row in rows)
    assert rows[0].find("a")["href"] == "/product/Azure%20Synapse%20Analytics"
    literal_link = rows[1].find("a")
    assert literal_link.text == directory_context["product"]
    assert literal_link["href"] == "/product/SQL/Compute%20%3Cliteral%20&%20name%3E"
    assert "<literal & name>" not in str(root)
    assert root.select_one("[data-sb-products-no-matches][hidden]")
    assert "customer/bucket pairs" in root.text
    assert "Consolidated products add their member counts" in root.text
    assert soup.select_one("[data-sb-products-count]").text == "3 of 3 products shown"
    if embedded:
        assert "sb-page-frame" not in soup.body.get("class", [])
        assert not soup.select(".sb-app-bar, .sb-context-bar, footer")
        assert root.select_one("[data-sb-products-count]")
    else:
        assert "sb-page-frame" in soup.body["class"]
        assert soup.select_one("footer [data-sb-products-count]")
        assert not root.select("[data-sb-products-count]")
        assert [item.get_text(" ", strip=True).lstrip("> ") for item in
                soup.select(".sb-context-bar li")] == [
            "Home", "Reports", "Revenue Analyzer", "Products",
        ]


@pytest.mark.parametrize("embedded", [False, True])
def test_empty_products_directory_keeps_import_recovery(
    client: FlaskClient, embedded: bool,
) -> None:
    """A genuine empty directory disables search and retains the original import action."""
    soup = BeautifulSoup(client.get(
        "/products" + ("?embed=1" if embedded else "")
    ).data, "html.parser")
    root = soup.select_one("[data-sb-products-directory]")
    assert root.select_one("#directoryProductSearch[disabled]")
    assert not root.select("table, [data-sb-directory-product]")
    assert "No product data yet" in root.text
    assert root.select_one(".sb-revenue-page-empty a")["href"] == "/revenue/import"
    assert soup.select_one("[data-sb-products-count]").text == "0 of 0 products shown"


@pytest.mark.parametrize("prefix", ["/product", "/revenue/product"])
@pytest.mark.parametrize("consolidated", [False, True])
def test_product_comparison_fragment_reuses_exact_rollup_and_deep_links(
    client: FlaskClient, directory_context: DirectoryContext, prefix: str, consolidated: bool,
) -> None:
    """Both aliases share totals and exact customer/bucket identities without a history app."""
    product = "Azure Synapse Analytics" if consolidated else directory_context["product"]
    path = f"{prefix}/{quote(product)}"
    full = BeautifulSoup(client.get(path).data, "html.parser")
    response = client.get(path, query_string={"comparison": "1"})
    assert response.status_code == 200
    preview = BeautifulSoup(response.data, "html.parser")
    assert preview.select_one("[data-sb-products-comparison]")[
        "data-sb-products-comparison"
    ] == product
    assert not preview.select("html, script, canvas, [data-sb-product-history]")
    assert [m.text for m in preview.select("[data-sb-product-metric]")] == [
        m.text for m in full.select("[data-sb-product-metric]")
    ]
    original = full.select("#customersTable tbody tr")
    rows = preview.select("#directoryCustomersTable tbody tr")
    assert [[cell.get_text(strip=True) for cell in row.select("th, td")] for row in rows] == [
        [cell.get_text(strip=True) for cell in row.select("th, td")] for row in original
    ]
    assert len(rows) == (1 if consolidated else 2)
    assert not preview.select("[data-sb-product-select]")
    for row in rows:
        destination = urlsplit(row.select_one("th a")["href"])
        params = parse_qs(destination.query)
        assert params == {
            "customer": [row["data-customer-name"]], "bucket": [row["data-bucket"]],
        }
        detail = client.get(row.select_one("th a")["href"])
        assert detail.status_code == 200
        assert BeautifulSoup(detail.data, "html.parser").select_one(
            f'[data-bucket="{row["data-bucket"]}"]'
        )
    if not consolidated:
        assert [row["data-bucket"] for row in rows] == ["Data", "Infra"]


def test_comparison_only_does_not_query_monthly_history(
    client: FlaskClient, directory_context: DirectoryContext, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The lightweight read returns before full-history queries and rendering."""
    def history_query(*args: object, **kwargs: object) -> None:
        """Fail if comparison rendering requests history models from the route."""
        raise AssertionError("Comparison must not query monthly history")

    monkeypatch.setattr("app.routes.revenue.ProductRevenueData", type(
        "HistoryForbidden", (), {"query": property(history_query)},
    )())
    response = client.get(
        f'/product/{quote(directory_context["product"])}', query_string={"comparison": "1"},
    )
    assert response.status_code == 200


def test_empty_comparison_retains_an_explicit_empty_state(client: FlaskClient) -> None:
    """An empty product has real zero summaries and no invented customers."""
    preview = BeautifulSoup(
        client.get("/product/Unavailable?comparison=1").data, "html.parser",
    )
    assert preview.select_one("[data-sb-products-customer-scroll]")
    assert "No customers found" in preview.text
    assert [metric.text for metric in preview.select("[data-sb-product-metric]")] == [
        "0", "$0", "$0",
    ]
