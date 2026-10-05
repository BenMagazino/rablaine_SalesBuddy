"""Seller product browsers preserve scope, monthly comparisons and native contracts."""

from typing import TypedDict
from urllib.parse import parse_qs, quote, urlsplit

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


class SellerProductContext(TypedDict):
    """Literal identities and matched account for isolated seller comparisons."""

    seller: str
    product: str
    customer: int


@pytest.fixture
def seller_product_context(app: Flask) -> SellerProductContext:
    """Seed scoped pairs, unmatched/nonpositive entries and consolidated overlap."""
    from app.models import Customer, ProductRevenueData, RevenueAnalysis, RevenueImport, Seller, db
    from app.services.revenue_import import fiscal_month_to_date

    seller_name, product = 'Scoped <seller & team>', 'SQL/Compute <literal & name>'
    with app.app_context():
        seller = Seller(name=seller_name)
        db.session.add(seller)
        db.session.flush()
        customer = Customer(name="Repeated customer", tpid=45678, seller_id=seller.id)
        db.session.add(customer)
        imported = RevenueImport(filename="isolated-seller-product", record_count=9)
        db.session.add(imported)
        db.session.flush()
        for name, owner in [
            ("Repeated customer", seller_name), ("Zero customer", seller_name),
            ("Negative customer", seller_name), ("Outside customer", "Other seller"),
        ]:
            db.session.add(RevenueAnalysis(
                customer_name=name, seller_name=owner, bucket="Data",
                category="VOLATILE", recommended_action="MONITOR", avg_revenue=10,
                latest_revenue=10, priority_score=20, months_analyzed=2, confidence="HIGH",
            ))
        records = [
            (product, "Repeated customer", "Data", "FY26-Jul", 100),
            (product, "Repeated customer", "Data", "FY26-Aug", -20),
            (product, "Repeated customer", "Infra", "FY26-Jul", 30),
            (product, "Zero customer", "Data", "FY26-Jul", 0),
            (product, "Negative customer", "Data", "FY26-Jul", -50),
            (product, "Outside customer", "Data", "FY26-Jul", 5000),
            ("Azure Synapse Analytics SQL", "Repeated customer", "Data", "FY26-Jul", 200),
            ("Azure Synapse Analytics Spark", "Repeated customer", "Data", "FY26-Jul", 150),
            ("Azure Synapse Analytics Outside", "Outside customer", "Data", "FY26-Jul", 9000),
        ]
        for sku, name, bucket, month, revenue in records:
            db.session.add(ProductRevenueData(
                product=sku, customer_name=name, bucket=bucket, fiscal_month=month,
                month_date=fiscal_month_to_date(month), revenue=revenue,
                customer_id=customer.id if name == customer.name else None,
                last_import_id=imported.id,
            ))
        db.session.commit()
        return {"seller": seller_name, "product": product, "customer": customer.id}


def seller_path(context: SellerProductContext, product: str | None = None) -> str:
    """Build literal seller paths, retaining the existing path converter for SKUs."""
    prefix = "/revenue/seller/" + quote(context["seller"], safe="")
    return prefix + ("/product/" + quote(product) if product is not None else "/products")


@pytest.mark.parametrize("embedded", [False, True])
@pytest.mark.parametrize("sort", ["revenue", "customers", "invalid"])
def test_seller_directory_reuses_native_browser_and_preserves_sort_urls(
    client: FlaskClient, seller_product_context: SellerProductContext, embedded: bool, sort: str,
) -> None:
    """Original sort links remain valid while every native column becomes sortable."""
    response = client.get(seller_path(seller_product_context), query_string={
        "sort": sort, **({"embed": "1"} if embedded else {}),
    })
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-products-directory]")
    assert root["data-seller-name"] == seller_product_context["seller"]
    assert root.select_one("h1").get_text(strip=True) == (
        seller_product_context["seller"] + "'s Products"
    )
    assert not root.select(".card, .btn, .table, .container-fluid")
    rows = root.select("[data-sb-directory-product]")
    assert [r.select_one("th").get_text(strip=True) for r in rows] == [
        "Azure Synapse Analytics", seller_product_context["product"],
    ]
    assert [[c.text for c in r.select("td")] for r in rows] == [["2", "$350"], ["2", "$110"]]
    assert all("/revenue/seller/" in r.find("a")["href"] for r in rows)
    assert root.select_one("table")["data-sb-sort-default-column"] == (
        "1" if sort == "customers" else "2"
    )
    assert len(root.select("thead [data-sb-sort-type]")) == 3
    assert "Outside customer" not in root.text
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select("footer [data-sb-products-count]")) is not embedded
    assert bool(root.select("[data-sb-products-count]")) is embedded
    assert root.select_one('[href$="/products"]') is None


def test_seller_comparison_is_scoped_and_preserves_nonpositive_entries(
    client: FlaskClient, seller_product_context: SellerProductContext,
) -> None:
    """Preview semantics match the old seller detail query, not the global positive-only query."""
    response = client.get(seller_path(seller_product_context, seller_product_context["product"]),
                          query_string={"comparison": "1"})
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-products-comparison]")
    assert root["data-sb-products-seller"] == seller_product_context["seller"]
    assert not soup.select("html, script, canvas")
    rows = root.select("tbody tr")
    assert [r["data-customer-name"] for r in rows] == [
        "Repeated customer", "Repeated customer", "Zero customer", "Negative customer",
    ]
    assert [r.select("td")[-1]["data-sb-sort-value"] for r in rows] == [
        "80.0", "30.0", "0", "-50.0",
    ]
    assert "Outside customer" not in root.text
    for row in rows:
        destination = urlsplit(row.select_one("th a")["href"])
        assert "/revenue/seller/" in destination.path
        assert parse_qs(destination.query) == {
            "customer": [row["data-customer-name"]], "bucket": [row["data-bucket"]],
        }
    assert [m.text for m in root.select("[data-sb-product-metric]")] == ["4", "$60", "$15"]


def test_seller_monthly_matrix_uses_distinct_customer_bucket_history_and_matched_links(
    client: FlaskClient, seller_product_context: SellerProductContext,
) -> None:
    """Repeated names never leak another bucket's monthly values into the selected entry."""
    response = client.get(seller_path(seller_product_context, seller_product_context["product"]))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-seller-product]")
    table = root.select_one("[data-sb-sortable]")
    assert not root.select(".card, .btn, .table, .container-fluid")
    assert [h.text for h in table.select("thead th")] == [
        "Customer", "Bucket", "FY26-Jul", "FY26-Aug", "Total",
    ]
    assert len(table.select("thead [data-sb-sort-type]")) == 5
    rows = table.select("tbody tr")
    assert [[c.get_text(strip=True) for c in r.select("th, td")] for r in rows[:2]] == [
        ["Repeated customer", "Data", "$100", "$-20", "$80"],
        ["Repeated customer", "Infra", "$30", "-", "$30"],
    ]
    assert rows[0].select("td")[2].select_one('[data-tone="danger"]')
    assert rows[1].select("td")[2]["data-sb-sort-value"] == ""
    assert rows[2].select("td")[1]["data-sb-sort-value"] == "0.0"
    assert rows[0].select_one("th a")["href"] == (
        f'/customer/{seller_product_context["customer"]}/revenue'
    )
    assert rows[0].select_one("td a")["href"].endswith("/revenue/bucket/Data")
    assert not rows[2].select("a")
    assert soup.select_one("footer [data-sb-seller-product-count]").text == (
        "4 of 4 customer entries shown"
    )
    assert len(root.select(".sb-revenue-page-header a")) == 2


@pytest.mark.parametrize("embedded", [False, True])
def test_seller_consolidated_detail_preserves_members_and_full_totals(
    client: FlaskClient, seller_product_context: SellerProductContext, embedded: bool,
) -> None:
    """Consolidation is scoped and deduplicated in detail, without changing directory counts."""
    soup = BeautifulSoup(client.get(seller_path(
        seller_product_context, "Azure Synapse Analytics",
    ), query_string={"embed": "1"} if embedded else {}).data, "html.parser")
    assert [li.text for li in soup.select(".sb-product-members li")] == [
        "Azure Synapse Analytics SQL", "Azure Synapse Analytics Spark",
    ]
    assert [m.text for m in soup.select("[data-sb-product-metric]")] == ["1", "$350", "$350"]
    assert soup.select_one("tbody tr").select("td")[-1]["data-sb-sort-value"] == "350.0"
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-app-bar, .sb-context-bar, footer")) is not embedded
    assert bool(soup.select("[data-sb-seller-product] [data-sb-seller-product-count]")) is embedded


def test_seller_scope_navigation_keeps_product_and_exact_customer_context(
    client: FlaskClient, seller_product_context: SellerProductContext,
) -> None:
    """Return and broaden commands retain the identities rather than selecting another entry."""
    soup = BeautifulSoup(client.get(seller_path(
        seller_product_context, seller_product_context["product"],
    ), query_string={"customer": "Repeated customer", "bucket": "Infra"}).data, "html.parser")
    links = soup.select(".sb-revenue-page-header a")
    broader = urlsplit(links[0]["href"])
    assert broader.path.startswith("/product/")
    assert parse_qs(broader.query) == {"customer": ["Repeated customer"], "bucket": ["Infra"]}
    assert parse_qs(urlsplit(links[1]["href"]).query) == {
        "product": [seller_product_context["product"]],
    }


def test_seller_comparison_skips_monthly_history(
    client: FlaskClient, seller_product_context: SellerProductContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Panel reads stop before the full detail's monthly data queries."""
    from app.models import ProductRevenueData
    from flask_sqlalchemy.query import Query

    query_class = type(ProductRevenueData.query)
    original = query_class.filter_by

    def forbid_history(query: Query, **kwargs: object) -> Query:
        """Reject model history reads while allowing the seller-membership subquery."""
        if any(d.get("entity") is ProductRevenueData for d in query.column_descriptions):
            raise AssertionError("comparison queried monthly history")
        return original(query, **kwargs)

    monkeypatch.setattr(query_class, "filter_by", forbid_history)
    assert client.get(seller_path(
        seller_product_context, seller_product_context["product"],
    ), query_string={"comparison": "1"}).status_code == 200


def test_seller_recent_seven_months_keep_all_history_totals(
    client: FlaskClient, app: Flask, seller_product_context: SellerProductContext,
) -> None:
    """Visible months remain chronological and do not narrow the all-history total."""
    from app.models import ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    months = [
        "FY25-May", "FY25-Jun", "FY26-Jul", "FY26-Aug", "FY26-Sep",
        "FY26-Oct", "FY26-Nov", "FY26-Dec", "FY26-Jan",
    ]
    with app.app_context():
        imported = RevenueImport(filename="long-seller-history", record_count=9)
        db.session.add(imported)
        db.session.flush()
        for index, month in enumerate(months):
            db.session.add(ProductRevenueData(
                product="Long history", customer_name="Repeated customer", bucket="Data",
                fiscal_month=month, month_date=fiscal_month_to_date(month),
                revenue=(index + 1) * 10, last_import_id=imported.id,
            ))
        db.session.commit()
    soup = BeautifulSoup(client.get(
        seller_path(seller_product_context, "Long history"),
    ).data, "html.parser")
    assert [h.text for h in soup.select("thead th")] == [
        "Customer", "Bucket", *months[-7:], "Total",
    ]
    cells = soup.select(".sb-seller-product-table tbody tr td")
    assert [float(c["data-sb-sort-value"]) for c in cells[1:-1]] == [
        30, 40, 50, 60, 70, 80, 90,
    ]
    assert float(cells[-1]["data-sb-sort-value"]) == 450
    assert [m.text for m in soup.select("[data-sb-product-metric]")] == ["1", "$450", "$450"]


@pytest.mark.parametrize("detail", [False, True])
def test_empty_seller_products_use_local_scope_and_native_recovery(
    client: FlaskClient, detail: bool,
) -> None:
    """Unknown seller data stays honestly empty rather than falling back to global consumption."""
    path = "/revenue/seller/No%20such%20seller/" + ("product/No%20SKU" if detail else "products")
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    root = soup.select_one("[data-sb-seller-product]" if detail else "[data-sb-products-directory]")
    assert root.select_one('input[type="search"][disabled]')
    assert not root.select("tbody tr")
    assert "No customers found" in root.text if detail else "No product data for this seller" in root.text
