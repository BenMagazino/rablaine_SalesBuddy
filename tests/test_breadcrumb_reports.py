"""Isolated canonical ancestry checks for report and revenue read pages."""

from pathlib import Path

import pytest
from flask import url_for

from app.models import Customer, Seller
from app.services.breadcrumb_reports import HANDLED_ENDPOINTS, get_report_breadcrumbs


REPORT_PAGES = [
    ("reports.report_manager_one_on_one", "Initiative Tracker"),
    ("reports.report_activity_coverage", "Activity Coverage"),
    ("reports.report_one_on_one", "1:1 Report"),
    ("reports.report_workload", "Workload Report"),
    ("reports.report_hygiene", "Engagement / Milestone Hygiene"),
    ("reports.report_whats_new", "What's New"),
    ("reports.report_whitespace", "Whitespace Analysis"),
    ("reports.report_msx_workspace", "MSX Workspace"),
    ("reports.report_marketing_insights", "Marketing Insights"),
    ("reports.report_connect_goals", "Connect Goals"),
    ("reports.report_u2c", "U2C Attainment"),
    ("reports.report_connect_impact", "Connect Impact"),
    ("revenue.reports_list", "Revenue Reports"),
    ("revenue.report_synapse_customers", "Synapse Customers"),
]


@pytest.fixture
def breadcrumb_context(app):
    """Supply transient ownership objects and a real, isolated app URL map."""
    seller = Seller(id=731, name="Actual Seller")
    customer = Customer(id=941, name="Actual Customer", seller=seller)
    with app.test_request_context("/", headers={"Referer": "/seller/999"}):
        yield {
            "seller": seller,
            "customer": customer,
            "seller_name": "Stale Import Seller",
            "customer_name": "Stale Import Customer",
            "breadcrumb_title": "Actual template title",
        }


def _assert_trail(trail, labels: list[str], urls: list[str]) -> None:
    """Check ancestor URLs and enforce that only the final item is unlinked."""
    assert trail is not None
    assert [item.label for item in trail] == labels
    assert [item.url for item in trail] == [*urls, None]


def test_report_hub_and_analyzer(breadcrumb_context):
    """Reports and Analyzer use the reporting root, not seller-mode ownership."""
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "reports.reports_hub"),
        ["Home", "Reports"], [url_for("main.index")],
    )
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_dashboard"),
        ["Home", "Reports", "Revenue Analyzer"],
        [url_for("main.index"), url_for("reports.reports_hub")],
    )


@pytest.mark.parametrize(("endpoint", "label"), REPORT_PAGES)
@pytest.mark.parametrize("mode", ["new", "current"])
def test_report_pages_use_normalized_title(breadcrumb_context, endpoint, label, mode):
    """Report variants remain reports even with seller/customer context."""
    breadcrumb_context.update(breadcrumb_title=label, mode=mode)
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, endpoint),
        ["Home", "Reports", label],
        [url_for("main.index"), url_for("reports.reports_hub")],
    )


def test_seller_revenue_uses_actual_hub(breadcrumb_context):
    """Seller-wide revenue never acquires a customer from incidental context."""
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_seller_view"),
        ["Home", "Actual Seller", "Revenue"],
        [url_for("main.index"), "/seller/731"],
    )


@pytest.mark.parametrize("assigned", [True, False])
def test_customer_revenue_uses_actual_assignment(breadcrumb_context, assigned):
    """Customer ownership wins over referrers and stale seller/analysis values."""
    customer = breadcrumb_context["customer"]
    if not assigned:
        customer.seller = None
    breadcrumb_context["analysis"] = {"seller_name": "Wrong Analysis Owner"}
    labels = ["Home", *(['Actual Seller'] if assigned else []), "Actual Customer", "Revenue"]
    urls = [url_for("main.index"), *(["/seller/731"] if assigned else []), "/customer/941"]
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_customer_view"),
        labels, urls,
    )


@pytest.mark.parametrize("bucket", ["Data & AI", "Infra: Compute", "Storage"])
@pytest.mark.parametrize("assigned", [True, False])
def test_customer_bucket_extends_real_revenue(breadcrumb_context, bucket, assigned):
    """Bucket labels retain their names and their actual customer Revenue link."""
    customer = breadcrumb_context["customer"]
    if not assigned:
        customer.seller = None
    breadcrumb_context["bucket"] = bucket
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_bucket_products"),
        [
            "Home", *(["Actual Seller"] if assigned else []),
            "Actual Customer", "Revenue", f"{bucket} Products",
        ],
        [
            url_for("main.index"), *(["/seller/731"] if assigned else []),
            "/customer/941",
            url_for("revenue.revenue_customer_view", customer_id=941),
        ],
    )


@pytest.mark.parametrize("product", ["Azure Synapse Analytics", "Compute / GPU", "A&B"])
@pytest.mark.parametrize("matched", [True, False])
def test_seller_products_extend_revenue(breadcrumb_context, product, matched):
    """Actual sellers get hub ancestry; unmatched import names stay in reporting."""
    breadcrumb_context["product"] = product
    if matched:
        name = "Actual Seller"
        labels = ["Home", name, "Revenue"]
        urls = [url_for("main.index"), "/seller/731"]
    else:
        breadcrumb_context["seller"] = None
        name = "Stale Import Seller"
        labels = ["Home", "Reports", "Revenue Analyzer", f"{name} Revenue"]
        urls = [
            url_for("main.index"), url_for("reports.reports_hub"),
            url_for("revenue.revenue_dashboard"),
        ]
    urls.append(url_for("revenue.revenue_seller_view", seller_name=name))
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_seller_products"),
        [*labels, "Products"], urls,
    )
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_seller_product_view"),
        [*labels, "Products", product],
        [*urls, url_for("revenue.revenue_seller_products", seller_name=name)],
    )


def test_missing_seller_has_valid_reporting_fallback(breadcrumb_context):
    """An imported seller name must never manufacture a seller hub URL."""
    breadcrumb_context["seller"] = None
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_seller_view"),
        ["Home", "Reports", "Revenue Analyzer", "Stale Import Seller Revenue"],
        [
            url_for("main.index"), url_for("reports.reports_hub"),
            url_for("revenue.revenue_dashboard"),
        ],
    )


@pytest.mark.parametrize("product", ["Azure Synapse Analytics", "Compute / GPU", "A&B"])
def test_generic_products_use_real_products_parent(breadcrumb_context, product):
    """Global products belong to the analyzer, never incidental owner objects."""
    breadcrumb_context["product"] = product
    urls = [
        url_for("main.index"), url_for("reports.reports_hub"),
        url_for("revenue.revenue_dashboard"),
    ]
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_products_list"),
        ["Home", "Reports", "Revenue Analyzer", "Products"], urls,
    )
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, "revenue.revenue_product_view"),
        ["Home", "Reports", "Revenue Analyzer", "Products", product],
        [*urls, url_for("revenue.revenue_products_list")],
    )


@pytest.mark.parametrize(("endpoint", "label"), [
    ("revenue.revenue_import", "Import Revenue Data"),
    ("revenue.revenue_config", "Revenue Analysis Configuration"),
])
def test_import_and_config_extend_analyzer(breadcrumb_context, endpoint, label):
    """Analyzer settings and imports preserve their normalized template labels."""
    breadcrumb_context["breadcrumb_title"] = label
    _assert_trail(
        get_report_breadcrumbs(breadcrumb_context, endpoint),
        ["Home", "Reports", "Revenue Analyzer", label],
        [
            url_for("main.index"), url_for("reports.reports_hub"),
            url_for("revenue.revenue_dashboard"),
        ],
    )


@pytest.mark.parametrize(("path", "endpoint"), [
    ("/reports/manager-one-on-one", "reports.report_manager_one_on_one"),
    ("/reports/initiative-tracker", "reports.report_manager_one_on_one"),
    ("/customer/941/revenue", "revenue.revenue_customer_view"),
    ("/revenue/customer/941", "revenue.revenue_customer_view"),
    ("/customer/941/revenue/bucket/Data", "revenue.revenue_bucket_products"),
    ("/revenue/customer/941/bucket/Data", "revenue.revenue_bucket_products"),
    ("/products", "revenue.revenue_products_list"),
    ("/revenue/products", "revenue.revenue_products_list"),
    ("/product/Azure%20Synapse", "revenue.revenue_product_view"),
    ("/revenue/product/Azure%20Synapse", "revenue.revenue_product_view"),
])
def test_read_aliases_share_declared_endpoint(app, path, endpoint):
    """Every direct read alias enters the same declared hierarchy handler."""
    with app.test_request_context(path):
        matched_endpoint, _ = app.url_map.bind("localhost").match(path)
        assert matched_endpoint == endpoint
        assert endpoint in HANDLED_ENDPOINTS


@pytest.mark.parametrize("endpoint", [
    "revenue._redirect_revenue_dashboard",
    "revenue._redirect_new_synapse_users",
    "revenue._redirect_new_synapse_users_short",
    "revenue._redirect_reports_list",
    "revenue._redirect_revenue_import",
    "revenue.revenue_seller_export",
    "revenue.revenue_sync",
    "revenue.revenue_analyze",
    "revenue.api_get_analysis_detail",
    "reports.api_whitespace",
    "reports.manager_one_on_one_data",
    "customers.customer_view",
])
def test_non_page_endpoints_are_unhandled(endpoint):
    """Redirects, exports, APIs, writes, fragments and other domains are excluded."""
    assert get_report_breadcrumbs({}, endpoint) is None
    assert endpoint not in HANDLED_ENDPOINTS


def test_declared_pages_have_real_get_destinations(app):
    """The declaration covers precisely the owned, rendered page endpoint set."""
    expected = {endpoint for endpoint, _ in REPORT_PAGES} | {
        "reports.reports_hub", "revenue.revenue_dashboard", "revenue.revenue_import",
        "revenue.revenue_config", "revenue.revenue_customer_view",
        "revenue.revenue_bucket_products", "revenue.revenue_seller_view",
        "revenue.revenue_seller_products", "revenue.revenue_seller_product_view",
        "revenue.revenue_products_list", "revenue.revenue_product_view",
    }
    assert HANDLED_ENDPOINTS == expected
    get_endpoints = {rule.endpoint for rule in app.url_map.iter_rules() if "GET" in rule.methods}
    assert HANDLED_ENDPOINTS <= get_endpoints


@pytest.mark.parametrize("template", [
    "report_whitespace", "revenue_bucket_products", "revenue_config",
    "revenue_customer_view", "revenue_import", "revenue_product_view",
    "revenue_reports_list", "revenue_seller_products", "revenue_seller_product_view",
    "revenue_dashboard", "revenue_seller_alerts",
])
def test_owned_templates_inherit_shared_breadcrumbs(template):
    """Page content has no duplicate bar or fragment-injected legacy navigation."""
    root = Path(__file__).resolve().parents[1]
    source = (root / "templates" / f"{template}.html").read_text(encoding="utf-8")
    assert '<nav aria-label="breadcrumb"' not in source
    assert "{% block context_bar %}" not in source
