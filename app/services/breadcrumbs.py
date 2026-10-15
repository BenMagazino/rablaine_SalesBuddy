"""Resolve canonical page ancestry independently of browsing history."""

from html import unescape

from flask import current_app, request
from jinja2 import pass_context
from jinja2.runtime import Context

from app.services.breadcrumb_types import Breadcrumb, current, home, link


SYSTEM_ENDPOINTS = {
    "main.index", "main.search", "main.preferences", "main.template_create",
    "main.template_edit", "main.template_save", "main.template_update",
    "main.analytics", "main.action_items_hub",
    "admin.admin_panel", "admin.admin_ai_logs", "admin.admin_favicon_gallery",
    "metrics.metrics_dashboard", "connect_export.connect_export_page",
    "jobs.sync_console",
}


def normalize_title(title: str) -> str:
    """Remove the window brand suffix and undo one template-escaping layer."""
    label = unescape(str(title)).strip()
    suffix = " - Sales Buddy"
    if label.endswith(suffix):
        label = label[:-len(suffix)].rstrip()
    if not label:
        raise ValueError("Page breadcrumbs require a non-empty title.")
    return label


def system_breadcrumbs(endpoint: str, label: str) -> list[Breadcrumb] | None:
    """Resolve app-level pages that do not belong to an entity blueprint."""
    if endpoint not in SYSTEM_ENDPOINTS:
        return None
    if endpoint == "main.index":
        return [current("Home")]
    ancestors = [home()]
    if endpoint in {
        "main.template_create", "main.template_edit", "main.template_save",
        "main.template_update",
    }:
        ancestors.append(link("Settings", "main.preferences"))
    elif endpoint.startswith("admin.") and endpoint != "admin.admin_panel":
        ancestors.append(link("Admin Panel", "admin.admin_panel"))
    elif endpoint == "metrics.metrics_dashboard":
        ancestors.append(link("Admin Panel", "admin.admin_panel"))
    elif endpoint == "jobs.sync_console":
        ancestors.append(link("Admin Panel", "admin.admin_panel"))
    elif endpoint in {"main.analytics", "connect_export.connect_export_page"}:
        ancestors.append(link("Reports", "reports.reports_hub"))
    if endpoint == "admin.admin_ai_logs":
        label = "AI Query Logs"
    return [*ancestors, current(label)]


@pass_context
def get_breadcrumbs(context: Context, title: str) -> list[Breadcrumb]:
    """Use page-owned records and declared routes, never referrer/session history."""
    from app.services.breadcrumb_entities import get_entity_breadcrumbs
    from app.services.breadcrumb_reports import get_report_breadcrumbs

    endpoint = request.endpoint or ""
    label = normalize_title(title)
    values = dict(context.get_all())
    values["breadcrumb_title"] = label
    result = system_breadcrumbs(endpoint, label)
    if result is None:
        result = get_report_breadcrumbs(values, endpoint)
    if result is None:
        result = get_entity_breadcrumbs(values, endpoint)
    if result is None:
        current_app.logger.warning(
            "No canonical breadcrumb path registered for endpoint %r (%s).",
            endpoint, request.path,
        )
        result = [home(), current(label)]
    if not result or result[-1].url is not None:
        raise ValueError(f"Breadcrumb path must end with an unlinked page: {endpoint}")
    if any(item.url is None for item in result[:-1]):
        raise ValueError(f"Breadcrumb ancestors must be real links: {endpoint}")
    return result
