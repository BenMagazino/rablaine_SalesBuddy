"""Parity checks for the redesigned shared desktop navigation."""

import re
from pathlib import Path
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from flask import render_template


def render_navigation(app, **context: object) -> BeautifulSoup:
    """Render base navigation with explicit conditional states, without changing preferences."""
    with app.test_request_context("/"):
        app.preprocess_request()
        with patch("app.services.update_checker.get_update_state",
                   return_value={"last_checked": "cached", "available": False}):
            html = render_template("base.html", first_run_modal_dismissed=True, **context)
    return BeautifulSoup(html, "html.parser")


def test_navigation_preserves_report_and_browse_destinations(app):
    """All original static menu destinations remain accessible."""
    soup = render_navigation(app, user_role="se", seller_mode=False)
    reports = {a["href"] for a in soup.select("#reportsMenu a")}
    assert reports == {
        "/reports", "/reports/connect-goals", "/reports/initiative-tracker",
        "/reports/one-on-one", "/reports/connect-impact", "/reports/u2c",
        "/reports/milestone-tracker", "/reports/activity-coverage", "/reports/whitespace",
        "/reports/hygiene", "/reports/msx-workspace", "/reports/whats-new",
        "/reports/revenue", "/reports/workload", "/reports/marketing-insights",
        "/reports/synapse-customers",
    }
    browse = {a["href"] for a in soup.select("#browseMenu a")}
    assert browse == {
        "/customers", "/partners", "/solution-engineers", "/internal-contacts",
        "/notes", "/engagements", "/action-items", "/reports/msx-workspace?tab=opps",
        "/reports/milestone-tracker", "/territories", "/pods", "/topics", "/products",
        "/revenue/import", "/connect-export", "/search", "/analytics",
    }
    assert {a["href"] for a in soup.select("#settingsMenu a")} == {"/preferences", "/admin"}
    assert soup.select_one(".sb-home")["href"] == "/"


@pytest.mark.parametrize(
    ("role", "seller_mode", "customers", "sellers"),
    [("se", False, False, True), ("se", True, False, False),
     ("dss", False, True, False), ("dss", True, True, False)],
)
def test_navigation_role_and_seller_conditions(app, role, seller_mode, customers, sellers):
    """Role-specific entry points and seller-mode suppression are unchanged."""
    soup = render_navigation(app, user_role=role, seller_mode=seller_mode)
    assert bool(soup.select_one("#navCustomers")) is customers
    assert bool(soup.select_one("#navSellers")) is sellers
    browse_paths = {a["href"] for a in soup.select("#browseMenu a")}
    assert ("/sellers" in browse_paths) is (role == "dss")
    assert ("/customers" in browse_paths) is (role != "dss")


def test_navigation_dynamic_sellers_and_menu_labels(app):
    """Seller records and approved nonredundant group labels survive rendering."""
    from types import SimpleNamespace

    soup = render_navigation(app, user_role="se", seller_mode=False,
                             nav_sellers=[SimpleNamespace(id=123, name="Test Seller")])
    assert soup.select_one('#sellersMenu a[href="/seller/123"]').get_text(strip=True) == "Test Seller"
    assert soup.select_one("#sellersMenu .sb-menu-heading").get_text(strip=True) == "Directory"
    assert soup.select_one("#reportsMenu .sb-menu-heading").get_text(strip=True) == "Overview"
    assert soup.select_one("#browseMenu .sb-menu-heading").get_text(strip=True) == "People and accounts"


@pytest.mark.parametrize("update_available", [False, True])
def test_navigation_update_badges_and_modal_entry_points(app, update_available):
    """Update availability and existing dialog actions keep their hooks."""
    soup = render_navigation(app, update_available=update_available)
    for badge_id in ("updateBadge", "updateMenuBadge"):
        assert soup.find(id=badge_id).has_attr("hidden") is not update_available
    assert soup.select_one("#navNewNote")["data-bs-target"] == "#quickNoteModal"
    assert soup.select_one('button[data-sb-dialog="keyboardShortcutsModal"]')
    assert soup.select_one("#navCustomerSearch")["aria-label"] == "Customer search"
    assert soup.select_one("#navQuickLookup kbd").get_text(strip=True) == "/"


@pytest.mark.parametrize("debug", [False, True])
def test_navigation_debug_chat_and_role_control(app, debug, monkeypatch):
    """Debug-only controls are conditional, not lost or exposed in production."""
    monkeypatch.setitem(app.config, "DEBUG", debug)
    soup = render_navigation(app, is_debug=debug)
    assert bool(soup.select_one("#navCopilotChat")) is debug
    assert bool(soup.select_one(".sb-role-toggle")) is debug


def test_navigation_owns_menus_and_embed_mode_has_no_header(app):
    """Menus no longer use Bootstrap dropdown/collapse, and embeds remain unbranded."""
    soup = render_navigation(app)
    assert soup.select_one(".sb-app-bar")
    assert not soup.select(".sb-app-bar .dropdown-menu, .sb-app-bar .navbar-toggler")
    for trigger in soup.select("[data-sb-menu]"):
        menu = soup.find(id=trigger["data-sb-menu"])
        assert menu["popover"] == "manual"
        assert menu["role"] == "menu"
        assert menu["aria-labelledby"] == trigger["id"]
        assert trigger["aria-controls"] == menu["id"]
        assert trigger["aria-expanded"] == "false"
        assert not trigger.has_attr("data-bs-toggle")
    with app.test_request_context("/?embed=1"):
        app.preprocess_request()
        html = render_template("base.html", first_run_modal_dismissed=True)
    assert not BeautifulSoup(html, "html.parser").select_one(".sb-app-bar")


@pytest.mark.parametrize("debug", [False, True])
def test_help_dialogs_preserve_shortcuts_and_use_owned_components(app, debug, monkeypatch):
    """Help content and conditional shortcuts survive native-dialog migration."""
    monkeypatch.setitem(app.config, "DEBUG", debug)
    soup = render_navigation(app)
    for dialog_id in ("pageHelpModal", "keyboardShortcutsModal"):
        dialog = soup.find(id=dialog_id)
        assert dialog.name == "dialog"
        assert "sb-dialog" in dialog["class"]
        assert dialog["data-sb-backdrop-close"] == "true"
        assert soup.find(id=dialog["aria-labelledby"])
        assert dialog.select_one("[data-sb-dialog-close][autofocus]")
        assert dialog.select_one('.sb-dialog-body[tabindex="0"][role="region"]')
        assert not dialog.select("[data-bs-dismiss], .modal-content, .table")
    rows = soup.select("#keyboardShortcutsModal tr")
    assert [row.select_one("td:last-child").get_text(strip=True) for row in rows] == [
        "Page help", "Customer search", "Create new note", "Submit form",
        "Close modal / go back", "Show this help",
    ] + (["Toggle SalesIQ Chat"] if debug else [])
    scripts = [script.get("src", "") for script in soup.select("script[src]")]
    assert scripts.index("/static/js/ui-dialog.js") < scripts.index("/static/js/page-help.js")


def test_help_dialog_source_has_balanced_shells() -> None:
    """Do not rely on browser repair to close dialog shell wrappers."""
    source = Path(__file__).resolve().parents[1].joinpath("templates", "base.html").read_text(
        encoding="utf-8"
    )
    for dialog_id in ("pageHelpModal", "keyboardShortcutsModal"):
        match = re.search(
            rf'<dialog\b[^>]*\bid="{dialog_id}"[^>]*>.*?</dialog>', source, re.DOTALL
        )
        assert match
        stack: list[str] = []
        for closing, tag in re.findall(r"<(/?)([a-z][a-z0-9]*)\b[^>]*>", match.group()):
            if closing:
                assert stack and stack.pop() == tag
            elif tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input",
                             "link", "meta", "param", "source", "track", "wbr"}:
                stack.append(tag)
        assert not stack
