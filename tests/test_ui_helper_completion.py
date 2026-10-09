"""Residual helper contracts for the Bootstrap-free desktop workbench."""

from pathlib import Path
import re

from bs4 import BeautifulSoup
import pytest


ROOT = Path(__file__).parents[1]
HELPER_TEMPLATES = (
    "milestone_tracker.html",
    "report_manager_one_on_one.html",
    "report_msx_workspace.html",
    "revenue_import.html",
    "partials/_project_form_fields.html",
    "partials/customer_view_content.html",
    "partials/engagements_panel.html",
    "partials/milestone_tracker_content.html",
    "partials/milestone_view_content.html",
    "partials/one_on_one_workspace_content.html",
)


@pytest.mark.parametrize("template", HELPER_TEMPLATES)
def test_native_helpers_do_not_emit_legacy_utilities(template: str) -> None:
    """Both server markup and generated HTML use owned component styling."""
    source = (ROOT / "templates" / template).read_text(encoding="utf-8")
    assert "d-none" not in source
    assert "--bs-" not in source
    assert "bootstrap." not in source
    assert ".bs.modal" not in source
    assert "forecast_workbench" not in source
    assert "COMMENT_WORKBENCH" not in source
    for classes in re.findall(r"""className\s*=\s*['"]([^'"]*)['"]""", source):
        assert not set(classes.split()) & {
            "badge", "d-none", "spinner-border", "text-muted",
        }, (template, classes)
    for classes in re.findall(r'class="([^"]*)"', source):
        assert not set(classes.split()) & {
            "badge", "btn", "card", "row", "col", "alert", "small",
            "spinner-border", "form-control", "form-select", "text-muted",
            "text-center", "text-decoration-none", "fw-semibold", "fw-bold",
        }, (template, classes)


def test_native_partial_consumers_have_no_obsolete_fallback() -> None:
    """Already migrated project and engagement callers cannot render a legacy branch."""
    panel = (ROOT / "templates/partials/engagements_panel.html").read_text(
        encoding="utf-8"
    )
    fields = (ROOT / "templates/partials/_project_form_fields.html").read_text(
        encoding="utf-8"
    )
    assert "eng_native" not in panel
    assert "partials/engagements_directory.html" in panel
    assert "native_project_form" not in fields
    assert "request.form.getlist('note_ids')" in fields
    assert "request.form.get('title'" in fields
    assert 'name="status"' in fields


def test_tracker_loading_visibility_and_progress_are_native(client) -> None:
    """Initial alerts, search-empty feedback and progress wait for their own controller."""
    soup = BeautifulSoup(
        client.get("/reports/milestone-tracker").data, "html.parser"
    )
    for element_id in ("syncAlert", "syncBrainrotToggle", "syncProgressWrap"):
        assert "sb-hidden" in soup.find(id=element_id)["class"]
    assert "sb-hidden" in soup.select_one('[data-role="customerNoMatches"]')["class"]
    assert "mt-progress-bar" in soup.find(id="syncProgressBar")["class"]
    source = (ROOT / "templates/partials/milestone_tracker_content.html").read_text(
        encoding="utf-8"
    )
    css = (ROOT / "static/css/ui-milestone-tracker.css").read_text(encoding="utf-8")
    assert "classList.toggle('sb-hidden', !match)" in source
    assert "classList.toggle('is-favorites', favoritesOnly)" in source
    assert ".mt-command.is-favorites" in css
    assert "mt-notice is-success" in str(soup)


@pytest.mark.parametrize("stylesheet", (
    "ui-milestone-tracker.css", "ui-customer-detail.css", "ui-milestone.css",
    "ui-initiative-tracker.css", "ui-msx-workspace.css", "ui-revenue-import.css",
))
def test_helper_styles_are_scoped_without_legacy_visibility_shims(stylesheet: str) -> None:
    """Native helper styling no longer recreates Bootstrap's utility vocabulary."""
    css = (ROOT / "static/css" / stylesheet).read_text(encoding="utf-8")
    assert ".d-none" not in css
    assert "--bs-" not in css
    assert ".badge" not in css
    assert ".spinner-border" not in css


@pytest.mark.parametrize("stylesheet, selector", (
    ("ui-customer-detail.css", ".cd-tag"),
    ("ui-milestone-tracker.css", ".mt-seller"),
))
def test_native_seller_identity_palette_retains_every_color(
    stylesheet: str, selector: str,
) -> None:
    """Seller-specific colors remain available on native tags in both theme modes."""
    css = (ROOT / "static/css" / stylesheet).read_text(encoding="utf-8")
    for color in range(1, 11):
        assert f'{selector}.seller-color-{color} ' in css
        assert f'[data-sb-mode="light"] {selector}.seller-color-{color} ' in css
