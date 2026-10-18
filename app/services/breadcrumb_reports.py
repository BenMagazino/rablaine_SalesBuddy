"""Canonical report and revenue ancestry from the page's render context."""

from collections.abc import Mapping

from app.models import Customer, Seller
from app.services.breadcrumb_types import (
    Breadcrumb, current, customer_path, home, link, page_label, seller_path,
)


REPORT_ENDPOINTS = {
    "reports.report_manager_one_on_one",
    "reports.report_activity_coverage",
    "reports.report_one_on_one",
    "reports.report_workload",
    "reports.report_hygiene",
    "reports.report_whats_new",
    "reports.report_whitespace",
    "reports.report_msx_workspace",
    "reports.report_marketing_insights",
    "reports.report_fabric_consumption",
    "reports.report_ptof",
    "reports.report_u2c",
    "reports.report_connect_impact",
    "revenue.reports_list",
    "revenue.report_synapse_customers",
}

HANDLED_ENDPOINTS = REPORT_ENDPOINTS | {
    "reports.dashboards_hub",
    "reports.dashboard_view",
    "reports.dashboard_edit",
    "reports.reports_hub",
    "reports.whitespace_pillar_products",
    "revenue.revenue_dashboard",
    "revenue.revenue_import",
    "revenue.revenue_config",
    "revenue.revenue_customer_view",
    "revenue.revenue_bucket_products",
    "revenue.revenue_seller_view",
    "revenue.revenue_seller_products",
    "revenue.revenue_seller_product_view",
    "revenue.revenue_products_list",
    "revenue.revenue_product_view",
}


def _report_path() -> list[Breadcrumb]:
    """Return the real reporting hub ancestry."""
    return [home(), link("Reports", "reports.reports_hub")]


def _analyzer_path() -> list[Breadcrumb]:
    """Return reporting ancestry through the revenue analyzer."""
    return [*_report_path(), link("Revenue Analyzer", "revenue.revenue_dashboard")]


def _seller_revenue_path(context: Mapping[str, object]) -> list[Breadcrumb]:
    """Use actual seller ownership, or reporting for unmatched imported names."""
    seller = context.get("seller")
    if isinstance(seller, Seller):
        return [
            *seller_path(seller),
            link("Revenue", "revenue.revenue_seller_view", seller_name=seller.name),
        ]
    seller_name = context.get("seller_name")
    result = _analyzer_path()
    if isinstance(seller_name, str) and seller_name:
        result.append(link(
            f"{seller_name} Revenue", "revenue.revenue_seller_view",
            seller_name=seller_name,
        ))
    return result


def get_report_breadcrumbs(
    context: Mapping[str, object], endpoint: str,
) -> list[Breadcrumb] | None:
    """Resolve owned read pages without consulting referrers or analysis records."""
    if endpoint not in HANDLED_ENDPOINTS:
        return None
    if endpoint == "reports.reports_hub":
        return [home(), current("Reports")]
    if endpoint == "reports.dashboards_hub":
        return [home(), current("Manage Dashboards")]
    if endpoint == "reports.dashboard_edit":
        dashboard = context["dashboard"]
        return [
            home(), link("Manage Dashboards", "reports.dashboards_hub"),
            current(f"Edit {dashboard['name']}"),
        ]
    if endpoint == "reports.dashboard_view":
        return [home(), current(str(context["dashboard"]["name"]))]
    if endpoint == "reports.whitespace_pillar_products":
        return [*_report_path(), link("Whitespace Analysis", "reports.report_whitespace"),
                current(f"{context['bucket']} Products")]
    if endpoint in REPORT_ENDPOINTS:
        return [*_report_path(), current(page_label(context))]
    if endpoint == "revenue.revenue_dashboard":
        return [*_report_path(), current("Revenue Analyzer")]
    if endpoint in {"revenue.revenue_customer_view", "revenue.revenue_bucket_products"}:
        customer = context.get("customer")
        ancestry = customer_path(customer) if isinstance(customer, Customer) else _analyzer_path()
        if endpoint == "revenue.revenue_customer_view":
            return [*ancestry, current("Revenue")]
        if isinstance(customer, Customer):
            ancestry.append(link(
                "Revenue", "revenue.revenue_customer_view", customer_id=customer.id,
            ))
        return [*ancestry, current(f"{context['bucket']} Products")]
    if endpoint == "revenue.revenue_seller_view":
        seller = context.get("seller")
        if isinstance(seller, Seller):
            return [*seller_path(seller), current("Revenue")]
        return [*_analyzer_path(), current(f"{context['seller_name']} Revenue")]
    if endpoint in {"revenue.revenue_seller_products", "revenue.revenue_seller_product_view"}:
        ancestry = _seller_revenue_path(context)
        if endpoint == "revenue.revenue_seller_products":
            return [*ancestry, current("Products")]
        seller = context.get("seller")
        seller_name = seller.name if isinstance(seller, Seller) else context.get("seller_name")
        if isinstance(seller_name, str) and seller_name:
            ancestry.append(link(
                "Products", "revenue.revenue_seller_products", seller_name=seller_name,
            ))
        return [*ancestry, current(str(context["product"]))]
    if endpoint == "revenue.revenue_products_list":
        return [*_analyzer_path(), current("Products")]
    if endpoint == "revenue.revenue_product_view":
        return [
            *_analyzer_path(), link("Products", "revenue.revenue_products_list"),
            current(str(context["product"])),
        ]
    return [*_analyzer_path(), current(page_label(context))]
