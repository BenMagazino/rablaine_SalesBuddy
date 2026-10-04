"""Home workbench composition and original dashboard information parity."""

from datetime import date, timedelta
from itertools import product
from types import SimpleNamespace

import pytest
from bs4 import BeautifulSoup
from flask import Flask, render_template, url_for
from flask.testing import FlaskClient


def render_home(app: Flask, **overrides: object) -> BeautifulSoup:
    """Render isolated Home branches without changing live records or preferences."""
    context: dict[str, object] = {
        "open_tasks": [], "upcoming_milestones": [], "stale_milestones": [],
        "hygiene_tasks": [], "revenue_alerts": [], "has_milestones": False,
        "has_engagements": False, "engagement_count": 0, "has_projects": False,
        "project_count": 0, "task_due_count": 0, "has_revenue": False, "pref": None,
    }
    context.update(overrides)
    with app.test_request_context("/"):
        app.preprocess_request()
        return BeautifulSoup(render_template("index.html", **context), "html.parser")


@pytest.mark.parametrize("preference", [
    "copilot_actions_enabled", "show_stale_milestones", "show_hygiene_tasks",
])
def test_dashboard_preferences_confirm_and_persist(
    app: Flask, client: FlaskClient, preference: str,
) -> None:
    """The native controls retain the immediate-save contract and reload values."""
    from app.models import UserPreference

    for enabled in (False, True):
        response = client.post("/api/preferences/dashboard-toggle", json={preference: enabled})
        assert response.status_code == 200
        assert response.json["success"] is True
        assert response.json[preference] is enabled
        with app.app_context():
            pref = UserPreference.query.first()
            assert getattr(pref, preference) is enabled
            soup = render_home(app, pref=pref)
            field = soup.select_one(f'[data-preference="{preference}"]')
            assert field.has_attr("checked") is enabled


@pytest.mark.parametrize("engagements,projects,tasks", list(product([False, True], repeat=3)))
def test_home_frame_and_tabs_exist_in_every_conditional_branch(
    app: Flask, engagements: bool, projects: bool, tasks: bool,
) -> None:
    """The rail and controller are never trapped inside an optional activity tab."""
    soup = render_home(
        app, has_engagements=engagements, has_projects=projects, task_due_count=int(tasks),
    )
    root = soup.select_one("#main-content > .sb-home-page[data-sb-home]")
    assert root.find(id="homeMeetingNotices").parent == root
    workspace = root.select_one(".sb-home-workspace")
    assert [child.name for child in workspace.find_all(recursive=False)] == ["section", "aside"]
    assert len(workspace.select(".sb-home-rail > .sb-home-panel")) == 3
    assert [h.get_text(" ", strip=True) for h in workspace.select(".sb-home-rail h2")] == [
        "Action Items", "Milestones Due", "Revenue Alerts",
    ]
    assert not workspace.select(".sb-home-rail .card, .sb-home-rail .row")
    assert not root.select("#noteViewTabs [data-bs-toggle], #noteViewTabs [data-bs-target]")
    tabs = root.select('#noteViewTabs [role="tab"]')
    assert len(tabs) == 1 + engagements + projects + tasks
    for tab in tabs:
        panel = root.find(id=tab["aria-controls"])
        assert panel["aria-labelledby"] == tab["id"]
        selected = tab["id"] == "calendar-tab"
        assert tab["aria-selected"] == str(selected).lower()
        assert tab["tabindex"] == ("0" if selected else "-1")
        assert panel.has_attr("hidden") is not selected
    scripts = soup.select('script[src="/static/js/ui-home.js"]')
    assert len(scripts) == 1
    assert scripts[0].parent["id"] == "main-content"
    assert len(soup.select('script[src="/static/js/ui-home-summary.js"]')) == 1
    assert len(soup.select('script[src="/static/js/ui-home-calendar.js"]')) == 1
    assert soup.select_one('link[href="/static/css/ui-home-calendar.css"]')
    assert soup.select_one('link[href="/static/css/ui-home.css"]')
    assert not soup.find("script", src="/static/js/ui-home.js").find_parent(role="tabpanel")
    toolbar = root.select_one(".sb-home-activity-header")
    for element_id in ("calendarTitle", "todayBtn", "prevMonthBtn", "nextMonthBtn", "noteViewTabs"):
        assert toolbar.find(id=element_id)
        assert len(root.select(f"#{element_id}")) == 1


def test_home_live_route_keeps_calendar_and_empty_destinations(client: FlaskClient) -> None:
    """Actual route rendering retains month controls, empty states and launchers."""
    response = client.get("/")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-home]")
    for element_id in ("calendarBody", "calendarTable", "calendarTitle",
                       "prevMonthBtn", "nextMonthBtn", "todayBtn", "draftsSection", "draftsList"):
        assert root.find(id=element_id)
    rail = root.select_one(".sb-home-rail")
    assert rail.select_one('a[href="/action-items"]')
    assert rail.select_one('button[data-sb-dialog="dashboardSettingsModal"]')
    settings = soup.find("dialog", id="dashboardSettingsModal")
    assert settings["data-sb-backdrop-close"] == "true"
    assert len(settings.select("[data-sb-dialog-close]")) == 2
    assert not settings.select(".modal, .form-check, .btn, [data-bs-dismiss]")
    assert [field["data-preference"] for field in settings.select("[data-preference]")] == [
        "copilot_actions_enabled", "show_stale_milestones", "show_hygiene_tasks",
    ]
    assert soup.select_one('script[src="/static/js/ui-dashboard-settings.js"][defer]')
    assert soup.find(id="quickCreateModal")
    assert soup.find(id="homeNoteDetailModal")
    assert b"new bootstrap.Tab" not in response.data
    assert b"function triggerDaySync(dateStr, wrapEl)" in response.data
    assert b"function openQuickCreateModal(dateStr, meetingId = null)" in response.data
    assert not soup.select("body > footer")
    assert root.select_one('nav[aria-label="Breadcrumb"] [aria-current="page"]').text == "Activity"
    notices = root.find(id="homeMeetingNotices")
    assert notices.parent == root
    assert "sb-home-meeting-notices" in notices["class"]
    assert not notices.find_all()
    breadcrumb = root.select_one('nav[aria-label="Breadcrumb"]')
    assert [child.name for child in breadcrumb.find_all(recursive=False)] == ["div", "button"]
    status = root.select_one('footer[aria-label="Workspace status"]')
    assert root.find_all(recursive=False)[-1] == status
    assert [child["id"] for child in status.find_all(recursive=False)] == [
        "homeViewSummary", "homeCurrentDate", "homeFreshnessToggle", "homeFreshnessPopover",
    ]
    assert status.find(id="homeViewSummary")["aria-live"] == "polite"
    assert not status.find(id="homeViewSummary").find_all()
    assert status.find(id="homeCurrentDate").name == "time"
    freshness = root.select_one(".sb-home-freshness")
    popover = freshness.find_parent(id="homeFreshnessPopover")
    assert popover["popover"] == "auto"
    assert popover["role"] == "region"
    assert popover["aria-labelledby"] == "homeFreshnessToggle"
    toggle = root.find(id="homeFreshnessToggle")
    assert toggle["popovertarget"] == "homeFreshnessPopover"
    assert toggle["aria-expanded"] == "false"
    assert toggle.get_text(" ", strip=True) == "Refresh status"
    assert root.find(id="homeFreshnessRefresh").find_parent(id="homeFreshnessPopover")
    assert len(freshness.select("a")) == 4
    assert all(not link.has_attr("class") for link in freshness.select("a"))
    assert [span["id"] for span in freshness.select('[aria-live="polite"]')] == [
        "homeMilestonesFreshness", "homeACRFreshness", "homeMeetingsFreshness",
        "homeU2CFreshness", "homeAccountsFreshness",
    ]
    assert root.find(id="homeMeetingsFreshness").find_parent("a") is None
    assert root.find(id="homeMilestonesFreshness").find_parent("a")["href"] == (
        "/admin#milestoneSyncStatus"
    )
    assert root.find(id="homeAccountsFreshness").find_parent("a")["href"] == (
        "/admin#accountsSyncStatus"
    )
    with client.application.test_request_context():
        assert root.find(id="homeACRFreshness").find_parent("a")["href"] == url_for(
            "revenue.revenue_dashboard",
        )
        assert root.find(id="homeU2CFreshness").find_parent("a")["href"] == url_for(
            "reports.report_u2c",
        )
    assert root.find(id="homeFreshnessRefresh")["type"] == "button"
    assert soup.select_one('script[src="/static/js/ui-home-freshness.js"][defer]')
    assert root.select_one(".sb-home-activity-header")
    assert root.select_one("#calendarTable thead tr")
    legend = root.select_one('footer[aria-label="Calendar indicator legend"]')
    for icon in ("calendar-event", "question-circle", "diagram-3"):
        assert legend.select_one(f".bi-{icon}")
    assert [rail["data-work-status"] for rail in legend.select(".sb-home-rail-swatch")] == [
        "milestone", "task", "hva",
    ]
    assert not root.select_one("#calendarTable").has_attr("style")
    assert "table" not in root.select_one("#calendarTable")["class"]
    draft_button = root.find(id="homeDraftsButton")
    assert draft_button["data-sb-dialog"] == "homeDraftsDialog"
    assert draft_button.has_attr("hidden")
    draft_dialog = root.find("dialog", id="homeDraftsDialog")
    assert draft_dialog["aria-labelledby"] == "homeDraftsHeading"
    assert root.find(id="draftsSection").find_parent("dialog") == draft_dialog
    assert draft_dialog.select_one('[data-sb-dialog-close][autofocus]')


def test_home_footer_override_does_not_remove_other_page_footers(client: FlaskClient) -> None:
    """The full-height Home shell does not change other legacy pages."""
    response = client.get("/customers")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one("body > footer")


def test_home_rail_retains_every_task_source_and_original_preview_options(app: Flask) -> None:
    """Engagement, daily/saved Copilot, project, stale and hygiene groups all survive."""
    customer = SimpleNamespace(name="Workbench customer", seller=None)
    engagement = SimpleNamespace(title="Delivery engagement", customer=customer)
    tasks = []
    for index, source in enumerate(("engagement", "copilot", "project", "project"), 1):
        project = SimpleNamespace(
            title="Pinned work" if index == 3 else "Internal work",
            project_type="copilot_saved" if index == 3 else "general",
        ) if source == "project" else None
        tasks.append(SimpleNamespace(
            id=index, title=f"Task {index}", source=source, project=project,
            engagement=engagement if source == "engagement" else None,
            priority="high", due_date=date.today() - timedelta(days=1), is_overdue=True,
        ))
    stale = SimpleNamespace(
        id=71, title="Stale delivery", opportunity_name="", customer=customer,
        workload="Data", msx_status="On Track", monthly_usage=1200, url="https://example.com/ms",
    )
    hygiene = SimpleNamespace(
        url="/engagement/92", icon="bi-link-45deg", title="Missing link",
        subtitle=customer.name, type="engagement_no_milestone",
    )
    soup = render_home(app, open_tasks=tasks, stale_milestones=[stale], hygiene_tasks=[hygiene])
    panel = soup.select_one('[aria-labelledby="homeActionsHeading"]')
    for task in tasks:
        option = "true" if task.source == "engagement" else "false"
        row = panel.find(onclick=f"viewActionItem({task.id}, {{showEngagementLink: {option}}})")
        assert row["role"] == "button" and row["tabindex"] == "0"
        assert row.select_one(".badge.bg-danger")
    assert "Copilot Suggestions" in panel.get_text()
    assert "Project Tasks" in panel.get_text()
    assert "Stale Milestones" in panel.get_text()
    assert "Hygiene" in panel.get_text()
    assert panel.find(onclick=lambda value: value and "event, 71," in value)
    assert panel.select_one('a[href="/engagement/92"]')
    assert "No open action items yet." not in panel.get_text()


def test_home_milestones_and_revenue_preserve_metadata_filters_and_destinations(app: Flask) -> None:
    """Native panels retain statuses, dates, amounts, bucket keys and preview arguments."""
    milestone = SimpleNamespace(
        id=81, title="Architecture milestone", opportunity_name="",
        customer=SimpleNamespace(name="Workbench customer"), workload="Infra",
        msx_status="Blocked", due_date=date.today(), due_date_urgency="this_week",
        monthly_usage=1500, url="https://example.com/milestone",
    )
    alert = SimpleNamespace(
        id=91, customer_name="Revenue customer", bucket="Data", category="DECLINING",
        recommended_action="CHECK_IN", dollars_at_risk=2200, dollars_opportunity=0,
    )
    soup = render_home(
        app, upcoming_milestones=[milestone], revenue_alerts=[alert], has_revenue=True,
    )
    rail = soup.select_one(".sb-home-rail")
    row = rail.find(onclick=lambda value: value and "event, 81," in value)
    assert row["tabindex"] == "0" and row["role"] == "button"
    assert row.select_one(".text-danger").get_text(strip=True) == "Blocked"
    with app.test_request_context("/"):
        assert rail.select_one(f'a[href="{url_for("milestones.milestone_tracker")}"]')
    revenue = rail.select_one('[data-bucket="Data"]')
    assert "event, 91," in revenue["onclick"]
    assert revenue["role"] == "button"
    assert "$2,200" in revenue.get_text()
    assert rail.find(id="homeBucketFilterContainer")
    with app.test_request_context("/"):
        assert rail.select_one(f'a[href="{url_for("revenue.revenue_dashboard")}"]')


@pytest.mark.parametrize("has_revenue", [False, True])
def test_home_revenue_empty_states_remain_explicit(app: Flask, has_revenue: bool) -> None:
    """No import and no remaining alerts are still distinct and actionable."""
    soup = render_home(app, has_revenue=has_revenue)
    panel = soup.select_one('[aria-labelledby="homeRevenueHeading"]')
    expected = "No unactioned revenue alerts." if has_revenue else "Revenue not imported yet."
    assert expected in panel.get_text()
    assert bool(panel.select_one("a.sb-home-button")) is not has_revenue
