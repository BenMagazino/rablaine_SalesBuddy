"""Explicit desktop reading-width policy and shared-shell scoping contracts."""

import re
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_WIDTHS = {
    "action_items_hub.html": 1344,
    "engagements_hub.html": 1344,
    "engagement_form.html": 1344,
    "fill_my_day.html": 1152,
    "milestone_form.html": 1152,
    "milestone_tracker.html": 1344,
    "milestones_list.html": 1152,
    "note_template_form.html": 1152,
    "notes_list.html": 1152,
    "one_on_one_hub.html": 1344,
    "project_form.html": 1152,
    "search.html": 1152,
    "partials/_engagement_view_content.html": 1344,
    "partials/milestone_view_content.html": 1344,
    "partials/one_on_one_workspace_content.html": 1344,
    "partials/opportunity_view_content.html": 1344,
    "partials/project_view_content.html": 1344,
}
SURFACE_WIDTHS: dict[str, int | None] = {
    **WORKFLOW_WIDTHS,
    **dict.fromkeys([
        "customers_list.html", "sellers_list.html", "customer_form.html",
        "partners_list.html", "partner_form.html", "topics_list.html",
        "topic_form.html", "topic_view.html", "specialties_list.html", "specialty_form.html",
        "specialty_view.html", "territories_list.html", "pods_list.html",
        "solution_engineers_list.html", "solution_engineer_form.html",
        "internal_contacts_list.html", "internal_contact_form.html",
        "report_activity_coverage.html", "report_hygiene.html",
        "report_u2c.html",
        "revenue_seller_product_view.html", "revenue_reports_list.html",
        "revenue_report_synapse_customers.html",
    ], 1152),
    **dict.fromkeys([
        "partner_view.html", "report_connect_impact.html",
        "report_workload.html", "revenue_products_list.html", "revenue_product_view.html",
        "partials/customer_view_content.html", "partials/territory_view_content.html",
        "partials/solution_engineer_view_content.html", "seller_form.html", "territory_form.html",
        "reports_hub.html", "report_connect_goals.html", "report_msx_workspace.html",
        "report_one_on_one.html", "revenue_config.html",
        "partials/pod_view_content.html", "pod_form.html",
        "revenue_customer_view.html",
        "report_manager_one_on_one.html",
        "revenue_seller_alerts.html", "revenue_import.html",
    ], 1344),
    **dict.fromkeys([
        "report_marketing_insights.html", "report_whats_new.html", "report_whitespace.html",
        "partials/seller_view_content.html",
        "revenue_bucket_products.html", "revenue_dashboard.html",
    ], None),
}
SURFACE_DECLARATION = r"<[a-z][a-z0-9-]*\b[^>]*\bdata-sb-page-surface\b"


@pytest.mark.parametrize("template,width", SURFACE_WIDTHS.items())
def test_surface_has_explicit_reading_width(template: str, width: int | None) -> None:
    """Each native root has an explicit bounded or genuine-wide composition decision."""
    source = (ROOT / "templates" / template).read_text(encoding="utf-8")
    surfaces = re.findall(SURFACE_DECLARATION, source)
    assert surfaces
    for surface in surfaces:
        assert ("sb-directory-frame" in surface) == (width is not None)
        assert ("sb-directory-frame-wide" in surface) == (width == 1344)


def test_native_surface_inventory_is_exhaustive() -> None:
    """New roots require a policy decision; JavaScript selector mentions are not roots."""
    template_root = ROOT / "templates"
    actual = {
        template.relative_to(template_root).as_posix()
        for template in template_root.rglob("*.html")
        if re.search(SURFACE_DECLARATION, template.read_text(encoding="utf-8"))
    }
    assert actual == set(SURFACE_WIDTHS)
    inherited = (template_root / "revenue_seller_products.html").read_text(encoding="utf-8")
    assert '{% extends "revenue_products_list.html" %}' in inherited


def test_width_rules_only_match_standalone_roots() -> None:
    """The cap cannot narrow dialogs, embedded fragments or full-width shell bands."""
    source = (ROOT / "static" / "css" / "ui-page-frame.css").read_text(encoding="utf-8")
    selector = ".sb-page-frame #main-content > [data-sb-page-surface].sb-directory-frame"
    rules = dict(re.findall(r"([^{}]+)\{([^{}]*)\}", source))
    normal = rules[next(key for key in rules if key.strip() == selector)]
    wider = rules[next(
        key for key in rules if key.strip() == selector + ".sb-directory-frame-wide"
    )]
    assert "max-width: 1152px;" in normal
    assert "margin-inline: auto;" in normal
    assert "max-width: 1344px;" in wider
    assert all(
        key.strip().startswith(selector)
        for key in rules if "sb-directory-frame" in key
    )


def test_search_history_wraps_within_the_reading_region() -> None:
    """Recent-entity groups wrap instead of stretching or clipping at the new cap."""
    source = (ROOT / "static" / "css" / "ui-search.css").read_text(encoding="utf-8")
    groups = re.search(r"\.search-history-groups\s*\{([^}]*)\}", source)
    group = re.search(r"\.search-history-group\s*\{([^}]*)\}", source)
    assert groups is not None and group is not None
    assert "flex-wrap: wrap;" in groups.group(1)
    assert "flex: 1 1 280px;" in group.group(1)
    assert "min-width: 0;" in group.group(1)


def test_engagement_count_headers_keep_whole_words() -> None:
    """Count columns reserve space for complete labels and their sort indicators."""
    source = (ROOT / "static" / "css" / "ui-engagements-directory.css").read_text(
        encoding="utf-8",
    )
    assert ".sb-eng-table :is(th,td):nth-child(n+8) { padding-inline: 8px; }" in source
    assert (
        ".sb-eng-table th:nth-child(n+8) .sb-table-sort-button { white-space: nowrap; }"
        in source
    )


def test_bounded_tracker_retains_its_single_filter_line() -> None:
    """Standalone slots leave room for Reset without changing shared-panel dimensions."""
    source = (ROOT / "static" / "css" / "ui-milestone-tracker.css").read_text(
        encoding="utf-8",
    )
    assert (
        ".sb-milestone-tracker.sb-directory-frame-wide .mt-customer-slot { width: 150px; }"
        in source
    )
    assert (
        ".sb-milestone-tracker.sb-directory-frame-wide .mt-seller-slot { width: 135px; }"
        in source
    )
    for role, width in [
        ("quarterDropdown", 125), ("statusDropdownBtn", 110), ("areaDropdownBtn", 100),
    ]:
        assert (
            f'.sb-milestone-tracker.sb-directory-frame-wide .mt-picker:has([data-role="{role}"])'
            f" > summary {{ min-width: {width}px; max-width: {width}px; }}"
            in source
        )
