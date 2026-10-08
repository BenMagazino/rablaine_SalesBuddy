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
    ("bs-body-bg", "surface"),
    ("bs-body-color", "ink"),
    ("bs-secondary-bg", "raised"),
    ("bs-tertiary-bg", "context"),
    ("bs-border-color", "line"),
])
def test_legacy_palette_uses_the_shared_theme(name: str, token: str) -> None:
    """Both legacy theme branches follow the selected workbench palette."""
    source = (ROOT / "templates" / "base.html").read_text(encoding="utf-8")
    declarations = re.findall(rf"--{name}:\s*([^;]+);", source)
    assert declarations == [f"var(--sb-ui-{token})"] * 2


def test_legacy_reading_surfaces_preserve_semantic_states() -> None:
    """Neutral cards share the palette without replacing identity or alert fills."""
    source = (ROOT / "templates" / "base.html").read_text(encoding="utf-8")
    assert "--bs-card-bg: var(--sb-ui-surface);" in source
    assert "--bs-card-cap-bg: var(--sb-ui-context);" in source
    assert "--bs-list-group-action-hover-bg: var(--sb-ui-raised);" in source
    assert "background-color: var(--sb-ui-selection);" in source
    assert 'background-color: #997404 !important;' in source
    assert 'background-color: #055160 !important;' in source


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
    ("/admin/ai-logs", False),
    ("/admin/favicons", False),
])
@pytest.mark.parametrize("embedded", [False, True])
def test_legacy_paired_width_is_explicit_and_standalone_only(
    client: FlaskClient, route: str, paired: bool, embedded: bool,
) -> None:
    """Real paired analysis/admin regions widen without narrowing embedded consumers."""
    response = client.get(route + ("?embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert ("sb-legacy-paired" in soup.body.get("class", [])) == (paired and not embedded)


def test_legacy_paired_rule_has_no_native_or_embed_side_effects() -> None:
    """The explicit legacy marker changes only its own main reading region."""
    source = (ROOT / "static" / "css" / "ui-page-frame.css").read_text(encoding="utf-8")
    rule = re.search(r"\.sb-legacy-paired #main-content\s*\{([^}]+)\}", source)
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
