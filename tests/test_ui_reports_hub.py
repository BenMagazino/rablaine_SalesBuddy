"""Native Reports directory preserves the canonical report registry and contexts."""

from pathlib import Path
import re

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


GROUPS = [
    ("Planning & Reviews", ["connect-goals", "initiative-tracker", "one-on-one", "connect-impact"]),
    ("Execution & Coverage", ["u2c-attainment", "milestone-tracker", "activity-coverage", "whitespace"]),
    ("Pipeline Health", ["hygiene-report", "msx-workspace", "whats-new"]),
    ("Account Insights", ["revenue-analyzer", "workload-report", "fabric-consumption", "marketing-insights",
                          "synapse-customers"]),
]


@pytest.mark.parametrize("embedded", [False, True])
@pytest.mark.parametrize("role", ["se", "dss"])
def test_directory_preserves_order_accessibility_and_context(
    app: Flask, client: FlaskClient, embedded: bool, role: str,
) -> None:
    """Full/embed and both roles keep all sixteen actual destinations and descriptions."""
    from app.models import UserPreference, db

    with app.app_context():
        UserPreference.query.first().user_role = role
        db.session.commit()
    response = client.get("/reports", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-reports-hub]")
    assert ("sb-directory-frame" in root.get("class", [])) is not embedded
    assert ("sb-directory-frame-wide" in root.get("class", [])) is not embedded
    assert root["data-sb-report-key"] == "reports-hub"
    assert root["data-sb-report-embedded"] == str(embedded).lower()
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-page-status")) is not embedded
    assert not root.select(".card, .btn, .row, .container-fluid, table")
    groups = root.select("[data-sb-report-group]")
    assert [group["data-sb-report-group"] for group in groups] == [name for name, _ in GROUPS]
    for group, (name, ids) in zip(groups, GROUPS):
        assert group.select_one("h2").text.strip() == name
        rows = group.select("[data-sb-report-entry]")
        assert [row["data-report-id"] for row in rows] == ids
        for row in rows:
            link = row.select_one("a")
            assert root.select_one("#" + link["aria-labelledby"]) == row.select_one("h3")
            assert root.select_one("#" + link["aria-describedby"]) == row.select_one("p")
            assert row.select_one("p").text.strip()
            assert all(icon["aria-hidden"] == "true" for icon in row.select("i"))
            assert link["href"].startswith("/reports/")
    assert len(root.select("a.sb-reports-entry")) == 16
    assert "16 reports across 4 groups" in soup.select_one("[data-sb-reports-count]").text
    search = root.select_one("#findReport")
    assert search["type"] == "search" and search["aria-controls"] == "reportsDirectory"
    assert root.select_one('label[for="findReport"]')
    assert root.select_one("[data-sb-reports-clear]").has_attr("disabled")
    assert root.select_one("[data-sb-reports-empty]").has_attr("hidden")
    scripts = [script.get("src", "") for script in soup.select("script[src]")]
    own = next(value for value in scripts if value.endswith("/ui-reports-hub.js"))
    reading = next(value for value in scripts if value.endswith("/ui-revenue-reports.js"))
    assert scripts.index(own) < scripts.index(reading)


def test_report_directory_help_matches_filter_and_back(client: FlaskClient) -> None:
    """Help explains directory navigation without implying report data is filtered."""
    source = client.get("/static/js/page-help.js").get_data(as_text=True)
    section = source.split("title: 'Reports',", 1)[1].split("`},", 1)[0]
    assert "filtering does not change report data" in section
    assert "Back restores your filter and reading position" in section
    assert "Embedded directories keep their filter local" in section


@pytest.mark.parametrize("route,selector", [
    ("/reports/connect-goals", ".sb-connect-goals"),
    ("/reports/msx-workspace", ".sb-msx-workspace"),
    ("/reports/one-on-one", ".sb-one-on-one"),
    ("/reports", ".sb-reports-hub"),
    ("/revenue/config", ".sb-revenue-config"),
])
@pytest.mark.parametrize("embedded", [False, True])
def test_review_wider_roots_preserve_embedded_scope(
    client: FlaskClient, route: str, selector: str, embedded: bool,
) -> None:
    """Requested wider standalone pages never impose their width on embedded consumers."""
    response = client.get(route, query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    root = BeautifulSoup(response.data, "html.parser").select_one(selector)
    assert ("sb-directory-frame-wide" in root.get("class", [])) is not embedded


def test_wider_revenue_config_expands_the_actual_form() -> None:
    """The wider shell removes the standalone form cap while retaining the embedded rule."""
    css = (Path(__file__).parents[1] / "static" / "css" /
           "ui-revenue-config.css").read_text(encoding="utf-8")
    assert ".sb-revenue-config-apply-note { max-width: 1120px; }" in css
    assert ".sb-revenue-config.sb-directory-frame-wide .sb-revenue-config-reading > form," in css
    assert (
        ".sb-revenue-config.sb-directory-frame-wide "
        ".sb-revenue-config-apply-note { max-width: none; }"
    ) in css


def test_report_dividers_only_follow_visible_rows(client: FlaskClient) -> None:
    """Hidden preceding entries must not add a divider above a group's first match."""
    source = client.get("/static/css/ui-reports-hub.css").get_data(as_text=True)
    assert ".sb-reports-list li:not([hidden]) ~ li:not([hidden])" in source
    assert ".sb-reports-list li + li" not in source


@pytest.mark.parametrize("template,bounded", [
    ("reports_hub.html", True),
    ("report_activity_coverage.html", True),
    ("report_connect_goals.html", True),
    ("report_hygiene.html", True),
    ("report_msx_workspace.html", True),
    ("report_one_on_one.html", True),
    ("report_u2c.html", True),
    ("report_workload.html", True),
    ("revenue_config.html", True),
    ("revenue_products_list.html", True),
    ("revenue_product_view.html", True),
    ("revenue_seller_product_view.html", True),
    ("revenue_reports_list.html", True),
    ("revenue_report_synapse_customers.html", True),
    ("report_connect_impact.html", True),
    ("revenue_bucket_products.html", False),
    ("revenue_customer_view.html", True),
    ("report_manager_one_on_one.html", True),
    ("revenue_dashboard.html", False),
    ("revenue_import.html", True),
    ("revenue_seller_alerts.html", True),
    # Side-by-side comparison matrices and substantial inspectors retain their working width.
    ("report_marketing_insights.html", False),
    ("report_whats_new.html", False),
    ("report_whitespace.html", False),
])
def test_report_and_revenue_standalone_width_dispositions(
    template: str, bounded: bool,
) -> None:
    """All standalone roots explicitly choose readable width or a dense workspace exemption."""
    templates = Path(__file__).parents[1] / "templates"
    source = (templates / template).read_text(encoding="utf-8")
    surface = re.search(r'<(?:section|div)\b[^>]*\bdata-sb-page-surface[^>]*>', source)
    assert surface is not None
    assert ("sb-directory-frame" in surface.group()) is bounded
    assert ("sb-directory-frame-wide" in surface.group()) is (
        template in {
            "reports_hub.html", "report_connect_goals.html", "report_msx_workspace.html",
            "report_one_on_one.html", "revenue_config.html", "report_connect_impact.html",
            "revenue_customer_view.html",
            "report_manager_one_on_one.html",
            "revenue_import.html", "revenue_seller_alerts.html",
            "report_workload.html", "revenue_products_list.html", "revenue_product_view.html",
        }
    )
    if bounded:
        assert "{% if not " in surface.group()
    inherited = (templates / "revenue_seller_products.html").read_text(encoding="utf-8")
    assert '{% extends "revenue_products_list.html" %}' in inherited


def test_bounded_comparison_tracks_remove_only_coupled_minimums() -> None:
    """Narrow catalog/history panes preserve all columns without inherited table overflow."""
    css = Path(__file__).parents[1] / "static" / "css"
    product = (css / "ui-revenue-product.css").read_text(encoding="utf-8")
    directory = (css / "ui-revenue-products.css").read_text(encoding="utf-8")
    workspace = (css / "ui-msx-workspace.css").read_text(encoding="utf-8")
    coverage = (css / "ui-activity-coverage.css").read_text(encoding="utf-8")
    impact = (css / "ui-impact.css").read_text(encoding="utf-8")
    assert (
        '.sb-revenue-product[data-sb-product-enhanced="true"] '
        '.sb-product-customers { min-width: 0; }'
    ) in product
    assert '.sb-products-consumption .sb-product-customers { min-width: 0; }' in directory
    assert 'grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr)' in directory
    assert '.sb-msx-workspace.sb-directory-frame .msx-table td:not(' in workspace
    assert 'overflow-wrap: anywhere' in workspace
    assert '.sb-directory-frame .milestone-coverage-columns' in coverage
    assert '.sb-directory-frame .prepared-meeting-task' in coverage
    assert (
        '.sb-impact.sb-directory-frame-wide .sb-impact-list-pane th:first-child '
        '{ width: 64px; }'
    ) in impact
