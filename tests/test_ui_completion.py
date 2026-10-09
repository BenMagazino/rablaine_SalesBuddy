"""Native application dependency and final shared-shell contracts."""

from pathlib import Path
import re
from types import SimpleNamespace

from bs4 import BeautifulSoup
from flask import Flask
import pytest


ROOT = Path(__file__).resolve().parents[1]


def test_shell_loads_native_normalization_without_bootstrap_framework(client) -> None:
    """The runtime shell owns normalization without loading the retired UI framework."""
    response = client.get("/sellers")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    styles = [link.get("href", "") for link in soup.select('link[rel="stylesheet"]')]
    scripts = [script.get("src", "") for script in soup.select("script[src]")]
    assert "/static/css/ui-base.css" in styles
    assert "/static/js/ui-shortcuts.js" in scripts
    assert not any(re.search(r"/bootstrap(?:@|/)", url) for url in styles + scripts)
    assert soup.select_one(".sb-app-bar")
    assert soup.select_one(".sb-context-bar")


def test_runtime_sources_have_no_retired_framework_behaviors() -> None:
    """Loaded or dormant first-party consumers cannot require removed widget plugins."""
    pattern = re.compile(
        r"\bbootstrap\.(?:Modal|Offcanvas|Collapse|Tab|Popover|Dropdown|Tooltip"
        r"|Alert|Button|Carousel|Toast|ScrollSpy)"
        r"|(?:show|shown|hide|hidden)\.bs\.(?:modal|offcanvas|collapse|tab|popover|dropdown)"
        r"|data-bs-(?:toggle|dismiss|target|backdrop|keyboard|parent)\s*="
        r"|--bs-[a-z-]+",
    )
    files = list((ROOT / "templates").rglob("*.html"))
    files.extend((ROOT / "static" / "js").glob("*.js"))
    files.extend((ROOT / "static" / "css").glob("*.css"))
    violations = [
        str(path.relative_to(ROOT)) for path in files
        if pattern.search(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_native_browser_defaults_and_visibility_are_application_owned() -> None:
    """Semantic controls, hidden async states and rich text retain browser defaults."""
    source = (ROOT / "static" / "css" / "ui-base.css").read_text(encoding="utf-8")
    for rule in [
        "*, *::before, *::after { box-sizing: border-box; }",
        "[hidden] { display: none !important; }",
        ".sb-hidden { display: none !important; }",
        "button, input, select, textarea { margin: 0; font: inherit; }",
        "table { border-collapse: collapse; caption-side: bottom; }",
        "--sb-bg: var(--sb-ui-surface);",
        "--sb-border: var(--sb-ui-line);",
    ]:
        assert rule in source
    assert "--bs-" not in source


def test_forecast_consumers_share_one_native_presentation() -> None:
    """Forecast defaults cannot silently fall back to removed card/form styles."""
    template = (ROOT / "templates" / "_forecast_comments.html").read_text(encoding="utf-8")
    script = (ROOT / "templates" / "_forecast_comments_js.html").read_text(encoding="utf-8")
    for source in (template, script):
        assert "sb-comment" in source
        assert "btn-primary" not in source
        assert "list-group-item" not in source
        assert "spinner-border" not in source
    assert "commentWorkbench ?" not in script
    assert "native_forecast" not in template


def test_report_export_defaults_to_native_commands_and_feedback(app: Flask) -> None:
    """Every host gets native export controls without an optional presentation branch."""
    with app.app_context():
        fragment = app.jinja_env.get_template("partials/_report_export.html").render(
            export_table_id="#reportTable", export_filename="report", export_title="Report",
        )
    soup = BeautifulSoup(fragment, "html.parser")
    commands = soup.select("#reportExportBtnGroup button")
    assert len(commands) == 3
    assert all(button["class"] == ["sb-revenue-command"] for button in commands)
    assert soup.select_one("#reportExportNoticeTemplate .sb-notice")
    assert soup.select_one("[data-sb-notice-dismiss]")


@pytest.mark.parametrize("name,fallback", [
    ("customer", "bi-building"), ("partner", "bi-briefcase"),
])
def test_favicon_helpers_keep_cached_images_and_identity_fallbacks(
    app: Flask, name: str, fallback: str,
) -> None:
    """Shared identity macros retain decorative cached images and native icon fallbacks."""
    template = (
        f"{{% from 'partials/{name}_favicon.html' import {name}_favicon %}}"
        f"{{{{ {name}_favicon(record, size=24) }}}}"
    )
    encoded = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8"
        "/x8AAwMCAO+aPWkAAAAASUVORK5CYII="
    )
    with app.app_context():
        helper = app.jinja_env.from_string(template)
        image_html = helper.render(record=SimpleNamespace(favicon_b64=encoded))
        fallback_html = helper.render(record=None)
    image = BeautifulSoup(image_html, "html.parser").select_one("img")
    assert image["src"] == f"data:image/png;base64,{encoded}"
    assert image["width"] == image["height"] == "24"
    assert image["alt"] == ""
    assert image["class"] == [f"{name}-favicon"]
    assert "vertical-align: middle;" in image["style"]
    assert BeautifulSoup(fallback_html, "html.parser").select_one(f"i.bi.{fallback}")
