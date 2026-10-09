"""Shared content-surface palette and desktop paired-region regression contracts."""

import re
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from flask.testing import FlaskClient


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("name,token", [
    ("sb-bg", "surface"),
    ("sb-card", "surface"),
    ("sb-navbar", "header"),
    ("sb-border", "line"),
    ("sb-text", "ink"),
    ("sb-text-muted", "muted"),
])
def test_application_aliases_use_the_shared_theme(name: str, token: str) -> None:
    """Application aliases resolve from native tokens in either theme mode."""
    source = (ROOT / "static" / "css" / "ui-base.css").read_text(encoding="utf-8")
    declarations = re.findall(rf"--{name}:\s*([^;]+);", source)
    assert declarations == [f"var(--sb-ui-{token})"]


def test_native_palette_preserves_distinct_semantic_states() -> None:
    """Warning and danger retain distinct colors without restoring utility overrides."""
    source = (ROOT / "static" / "css" / "ui-tokens.css").read_text(encoding="utf-8")
    for token in ("warning", "danger", "warning-bg", "danger-bg"):
        assert len(re.findall(rf"--sb-ui-{token}:\s*[^;]+;", source)) == 2
    shell = (ROOT / "templates" / "base.html").read_text(encoding="utf-8")
    assert "--bs-card-bg" not in shell
    assert "--bs-list-group-action-hover-bg" not in shell


def test_shared_revenue_reading_background_is_not_the_outer_canvas() -> None:
    """Queue/table workareas and opaque sticky headers share the reading surface."""
    source = (ROOT / "static" / "css" / "ui-revenue-detail.css").read_text(
        encoding="utf-8",
    )
    assert "background: var(--sb-ui-canvas);" not in source
    for selector in [
        ".sb-revenue-workspace",
        ".sb-page-frame .sb-revenue-workarea > .sb-revenue-alerts",
        ".sb-page-frame .sb-revenue-workarea .sb-revenue-alerts-table thead th",
    ]:
        rule = re.search(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", source)
        assert rule is not None
        assert "background: var(--sb-ui-surface);" in rule.group(1)
    assert "tbody tr:hover { background: var(--sb-ui-raised); }" in source


@pytest.mark.parametrize("route,paired", [
    ("/admin", True),
    ("/analytics", True),
    ("/preferences", False),
    ("/connect-export", False),
    ("/admin/ai-logs", True),
    ("/admin/favicons", False),
])
@pytest.mark.parametrize("embedded", [False, True])
def test_native_wide_width_is_explicit_and_standalone_only(
    client: FlaskClient, route: str, paired: bool, embedded: bool,
) -> None:
    """Paired workspaces and dense logs widen without narrowing embedded consumers."""
    response = client.get(route + ("?embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    surface = soup.select_one("[data-sb-page-surface]")
    assert surface is not None
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    if embedded:
        assert not soup.select(".sb-app-bar, .sb-context-bar, body > footer.sb-page-status")
    else:
        assert "sb-directory-frame" in surface.get("class", [])
        assert ("sb-directory-frame-wide" in surface.get("class", [])) == paired


def test_native_wide_rule_has_no_embed_side_effects() -> None:
    """Only standalone wide roots receive the wider reading-region cap."""
    source = (ROOT / "static" / "css" / "ui-page-frame.css").read_text(encoding="utf-8")
    selector = (
        ".sb-page-frame #main-content > [data-sb-page-surface]"
        ".sb-directory-frame.sb-directory-frame-wide"
    )
    rule = re.search(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", source)
    assert rule is not None
    assert "max-width: 1344px;" in rule.group(1)
    assert "min-width:" not in rule.group(1)


def test_shared_gutters_preserve_native_reading_surfaces() -> None:
    """Canvas belongs outside the reading root, including bounded and full-width pages."""
    source = (ROOT / "static" / "css" / "ui-page-frame.css").read_text(encoding="utf-8")
    outer = re.search(r"\.sb-page-frame #main-content\s*\{([^}]+)\}", source)
    reading = re.search(
        r"\.sb-page-frame #main-content > \[data-sb-page-surface\]\s*\{([^}]+)\}", source,
    )
    assert outer is not None and reading is not None
    assert "background: var(--sb-ui-canvas);" in outer.group(1)
    assert "background: var(--sb-ui-surface);" in reading.group(1)


def test_legacy_gutters_require_the_standalone_shell() -> None:
    """Legacy centered containers share the canvas without tinting shell-free embeds."""
    source = (ROOT / "static" / "css" / "ui-navigation.css").read_text(encoding="utf-8")
    selector = "body:not(.sb-page-frame):has(> .sb-app-bar)"
    outer = re.search(rf"{re.escape(selector)}\s*\{{([^}}]+)\}}", source)
    reading = re.search(
        rf"{re.escape(selector)} > #main-content\s*\{{([^}}]+)\}}", source,
    )
    assert outer is not None and reading is not None
    assert "background: var(--sb-ui-canvas);" in outer.group(1)
    assert "background: var(--sb-ui-surface);" in reading.group(1)
