"""App-wide breadcrumb coverage, markup, root navigation and error contracts."""

import ast
import inspect
import textwrap
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient
from jinja2 import nodes

from app.services.breadcrumb_types import Breadcrumb
from app.services.breadcrumbs import SYSTEM_ENDPOINTS, normalize_title


def inherits_base(app: Flask, template: str) -> bool:
    """Resolve static template inheritance rather than guessing from route prefixes."""
    source, _, _ = app.jinja_env.loader.get_source(app.jinja_env, template)
    tree = app.jinja_env.parse(source)
    for node in tree.find_all(nodes.Extends):
        if isinstance(node.template, nodes.Const):
            parent = node.template.value
            if parent == "base.html":
                return True
            return inherits_base(app, parent)
    return False


def test_all_base_page_endpoints_have_declared_ancestry(app: Flask) -> None:
    """Every statically rendered full page has a canonical path, including edit forms."""
    from app.services.breadcrumb_entities import HANDLED_ENDPOINTS as entities
    from app.services.breadcrumb_reports import HANDLED_ENDPOINTS as reports

    declared = SYSTEM_ENDPOINTS | entities | reports
    pages = set()
    for endpoint, function in app.view_functions.items():
        if endpoint == "static":
            continue
        tree = ast.parse(textwrap.dedent(inspect.getsource(function)))
        for call in ast.walk(tree):
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name):
                continue
            if call.func.id != "render_template" or not call.args:
                continue
            template = call.args[0]
            if isinstance(template, ast.Constant) and isinstance(template.value, str):
                if inherits_base(app, template.value):
                    pages.add(endpoint)
    assert len(pages) >= 90
    assert not pages - declared, f"Missing canonical breadcrumb paths: {sorted(pages - declared)}"


@pytest.mark.parametrize("path, labels", [
    ("/", ["Home"]),
    ("/search", ["Home", "Search Notes"]),
    ("/preferences", ["Home", "Settings"]),
    ("/templates/new", ["Home", "Settings", "New Template"]),
    ("/admin/ai-logs", ["Home", "Admin Panel", "AI Query Logs"]),
    ("/reports", ["Home", "Reports"]),
])
def test_root_and_system_page_breadcrumbs(
    client: FlaskClient, path: str, labels: list[str],
) -> None:
    """Ancestors link, the current location does not, and only one trail is emitted."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    bars = soup.select('nav.sb-context-bar[aria-label="Breadcrumb"]')
    assert len(bars) == 1
    bar = bars[0]
    items = bar.select(".sb-context-breadcrumb > li")
    if path == "/":
        assert bar.select_one('[aria-current="page"]').get_text(strip=True) == "Home"
        assert not bar.select("a, .sb-context-separator")
        assert bar.select_one("#homeDraftsButton")
    else:
        actual = [
            (item.select_one("a") or item.select_one("span[title]")).get_text(strip=True)
            for item in items
        ]
        assert actual == labels
        assert [a["href"] for a in items[0].select("a")] == ["/"]
        assert all(item.select_one("a") for item in items[:-1])
        assert not items[-1].select("a")
        assert items[-1]["aria-current"] == "page"
        assert all(s["aria-hidden"] == "true" for s in bar.select(".sb-context-separator"))
        assert not bar.find_parent("main")
        assert not soup.select('#main-content nav[aria-label="breadcrumb"]')


@pytest.mark.parametrize("path", ["/search?embed=1", "/preferences?embed=1"])
def test_embedded_system_pages_have_no_outer_trail(client: FlaskClient, path: str) -> None:
    """Embedded views do not grow a second navigation frame."""
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    assert not soup.select(".sb-context-bar")


def test_shared_renderer_escapes_labels_and_keeps_native_links(app: Flask) -> None:
    """Literal imported names cannot become markup or JavaScript."""
    with app.test_request_context("/"):
        html = app.jinja_env.get_template("partials/_breadcrumbs.html").render(page_breadcrumbs=[
            Breadcrumb('Home <literal>', "/"), Breadcrumb('<img src=x onerror="bad()">'),
        ])
    soup = BeautifulSoup(html, "html.parser")
    assert not soup.find("img")
    assert soup.select_one('[aria-current="page"]').get_text(" ", strip=True).endswith(
        '<img src=x onerror="bad()">'
    )
    assert soup.select_one("a")["href"] == "/"
    assert not soup.select("[onclick], [data-bs-toggle]")


def test_title_normalization_preserves_literal_names() -> None:
    """Undo template escaping exactly once and remove only the application suffix."""
    assert normalize_title(" A &amp; B - Sales Buddy ") == "A & B"
    assert normalize_title("Sales Buddy customer - Sales Buddy") == "Sales Buddy customer"
    with pytest.raises(ValueError, match="non-empty"):
        normalize_title(" ")


def test_unregistered_page_logs_explicitly(app: Flask, caplog: pytest.LogCaptureFixture) -> None:
    """A newly introduced page must not silently claim a registered canonical hierarchy."""
    with app.test_request_context("/not-registered"):
        html = app.jinja_env.from_string(
            "{{ get_breadcrumbs('Unknown page - Sales Buddy')[-1].label }}"
        ).render()
    assert html == "Unknown page"
    assert "No canonical breadcrumb path registered" in caplog.text


def test_no_page_templates_keep_legacy_inline_breadcrumb_navigation(app: Flask) -> None:
    """Old breadcrumb components cannot survive below the centralized shell bar."""
    root = Path(app.template_folder)
    offenders = []
    for template in root.rglob("*.html"):
        source = template.read_text(encoding="utf-8")
        if 'class="breadcrumb"' in source or 'class="breadcrumb-item' in source:
            offenders.append(template.name)
    assert not offenders, f"Legacy breadcrumb components remain: {offenders}"
