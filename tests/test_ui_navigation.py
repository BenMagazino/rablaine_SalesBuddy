"""Parity checks for the redesigned shared desktop navigation."""

import re
from pathlib import Path
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from flask import flash, render_template


def render_navigation(
    app, *, flashes: list[tuple[str, str]] | None = None, **context: object
) -> BeautifulSoup:
    """Render base navigation with explicit conditional states, without changing preferences."""
    with app.test_request_context("/"):
        app.preprocess_request()
        for category, message in flashes or []:
            flash(message, category)
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
    assert soup.select_one("#navNewNote")["data-sb-dialog"] == "quickNoteModal"
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
    for dialog_id in ("pageHelpModal", "keyboardShortcutsModal",
                      "quickNoteModal", "quickEngagementModal", "imageZoomModal"):
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


@pytest.mark.parametrize(
    ("dialog_id", "input_id", "results_id"),
    [("quickNoteModal", "customerSearch", "customerResults"),
     ("quickEngagementModal", "engagementCustomerSearch", "engagementCustomerResults")],
)
def test_customer_picker_owned_markup(app, dialog_id, input_id, results_id) -> None:
    """Customer selection retains its original IDs and uses the native dialog controls."""
    soup = render_navigation(app)
    dialog = soup.find(id=dialog_id)
    assert dialog.name == "dialog"
    assert dialog["data-sb-backdrop-close"] == "true"
    assert soup.find(id=dialog["aria-labelledby"])
    field = dialog.find(id=input_id)
    assert field["autocomplete"] == "off"
    assert field.has_attr("autofocus")
    assert field["aria-controls"] == results_id
    assert dialog.find(id=results_id)["role"] == "region"
    assert dialog.select_one("label")["for"] == input_id
    assert len(dialog.select("[data-sb-dialog-close]")) == 2
    assert not dialog.select(".modal, .form-control, .list-group, [data-bs-dismiss]")


@pytest.mark.parametrize(
    ("url", "dialog_id"), [("/notes", "quickNoteModal"), ("/engagements", "quickEngagementModal")]
)
def test_customer_picker_page_launchers(client, url, dialog_id) -> None:
    """Empty notes and the engagements hub no longer launch removed Bootstrap modals."""
    soup = BeautifulSoup(client.get(url).data, "html.parser")
    trigger = soup.select_one(f'main button[data-sb-dialog="{dialog_id}"]')
    assert trigger
    assert trigger["type"] == "button"
    assert trigger["aria-controls"] == dialog_id
    assert not trigger.has_attr("data-bs-toggle")


def test_calendar_customer_picker_retains_legacy_host_and_date_hook(client) -> None:
    """The third shared picker stays available until the separate homepage checkpoint."""
    soup = BeautifulSoup(client.get("/").data, "html.parser")
    calendar_picker = soup.find(id="quickCreateModal")
    assert calendar_picker.name == "div"
    assert "modal" in calendar_picker["class"]
    assert calendar_picker.select_one("#quickCreateSearch")
    assert calendar_picker.select_one("#quickCreateCustomerList")
    assert any("_quickCreateUpdateDate" in (script.string or "") for script in soup.find_all("script"))


def test_image_viewer_owned_markup(app) -> None:
    """The shared image host preserves its IDs and uses native, accessible controls."""
    soup = render_navigation(app)
    dialog = soup.find(id="imageZoomModal")
    assert dialog.name == "dialog"
    assert dialog["data-sb-backdrop-close"] == "true"
    assert soup.find(id=dialog["aria-labelledby"]).get_text(strip=True) == "Image preview"
    assert dialog.select_one("#imageZoomImg").has_attr("alt")
    assert dialog.select_one("#imageZoomPreview")["aria-describedby"] == "imageZoomImg"
    assert dialog.select_one("#imageZoomStatus")["role"] == "status"
    assert dialog.select_one("#imageZoomError")["role"] == "alert"
    assert dialog.select_one("#imageZoomRetry")["type"] == "button"
    assert len(dialog.select("[data-sb-dialog-close]")) == 3
    assert not dialog.select(".modal, .modal-dialog, .modal-content, [data-bs-dismiss], [onclick]")
    scripts = [script.get("src", "") for script in soup.select("script[src]")]
    assert scripts.index("/static/js/ui-dialog.js") < scripts.index("/static/js/ui-image-viewer.js")


@pytest.mark.parametrize(
    ("category", "tone", "label", "icon"),
    [("danger", "danger", "Error", "exclamation-circle"),
     ("error", "danger", "Error", "exclamation-circle"),
     ("warning", "warning", "Warning", "exclamation-triangle"),
     ("success", "success", "Success", "check-circle"),
     ("info", "info", "Information", "info-circle"),
     ("message", "neutral", "Notice", "chat-square"),
     ("custom", "neutral", "Notice", "chat-square")],
)
def test_flash_notices_preserve_categories_and_use_owned_controls(
    app, category, tone, label, icon
) -> None:
    """Known categories retain meaning and custom categories remain neutral, not successful."""
    soup = render_navigation(app, flashes=[(category, "An example notification.")])
    notice = soup.select_one(".sb-notice")
    assert notice["data-sb-category"] == category
    assert notice["data-sb-tone"] == tone
    assert notice["role"] == "alert"
    assert notice["aria-label"] == f"{label} notification"
    assert notice.select_one(f".bi-{icon}")["aria-hidden"] == "true"
    assert notice.select_one(".sb-notice-body").get_text() == "An example notification."
    dismiss = notice.select_one("[data-sb-notice-dismiss]")
    assert dismiss["type"] == "button"
    assert dismiss["aria-label"] == "Dismiss notification"
    assert not notice.select(".alert, .btn-close, [data-bs-dismiss]")
    assert soup.select_one("#main-content")["tabindex"] == "-1"
    assert soup.select_one('script[src="/static/js/ui-feedback.js"]')
    assert soup.select_one('link[href="/static/css/ui-feedback.css"]')


def test_flash_notices_preserve_order_full_text_and_escaping(app) -> None:
    """Notifications do not truncate, reorder or interpret ordinary message strings."""
    messages = [("success", "First message"), ("warning", "LongToken" * 80),
                ("error", '<script>alert("customer")</script> & <example>')]
    soup = render_navigation(app, flashes=messages)
    notices = soup.select(".sb-notice")
    assert [notice.select_one(".sb-notice-body").get_text() for notice in notices] == [
        message for _, message in messages
    ]
    assert not soup.select(".sb-notice script")
    assert "&lt;script&gt;" in str(notices[-1])


def test_flash_notices_are_consumed_once_by_the_existing_flask_flow(client) -> None:
    """A redirect message remains request-scoped and does not become persistent UI state."""
    with client.session_transaction() as session:
        session["_flashes"] = [("warning", "One request only")]
    first = BeautifulSoup(client.get("/notes").data, "html.parser")
    second = BeautifulSoup(client.get("/notes").data, "html.parser")
    assert first.select_one(".sb-notice-body").get_text() == "One request only"
    assert not second.select(".sb-notice")


def test_empty_flash_stack_retains_layout_without_an_empty_alert(app) -> None:
    """The shared spacing wrapper survives without manufacturing a notification."""
    soup = render_navigation(app)
    assert soup.select_one(".sb-flash-stack")
    assert not soup.select(".sb-flash-stack .sb-notice")
