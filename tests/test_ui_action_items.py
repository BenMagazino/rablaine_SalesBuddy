"""Local action queue presentation, raw sorting and original host parity."""

from datetime import date
from types import SimpleNamespace

from bs4 import BeautifulSoup
from flask import render_template


def test_action_queue_native_frame_and_shared_dependencies(client):
    """The page owns reading, while shared dialogs and sorting load only once."""
    soup = BeautifulSoup(client.get("/action-items").data, "html.parser")
    assert "sb-page-frame" in soup.body["class"]
    assert soup.select_one(".sb-actions-reading[data-sb-page-body]")
    assert soup.select_one(".sb-page-status")
    for asset in ("ui-table-sort.js", "ui-dialog.js", "ui-milestone-preview.js"):
        assert len(soup.select(f'script[src="/static/js/{asset}"]')) == 1
    assert soup.select_one("#actionItemsEngagementModal #aiEngFullLink")
    assert soup.select_one("dialog#actionItemDetailModal")
    assert not soup.select(".sb-actions .card, .sb-actions [onclick], [data-actions-hub] .badge")
    assert len(soup.select(".sb-actions-nav a")) == 5
    cells = soup.select(".sb-actions-queue > .sb-actions-cell-body")
    assert len(cells) == 5
    assert len({cell["id"] for cell in cells}) == 5
    assert all(cell["tabindex"] == "0" and cell["aria-label"] for cell in cells)


def test_action_queues_keep_saved_before_generated_and_raw_fields(app, sample_data):
    """All task contexts remain present without replacing provider ordering."""
    from app.models import ActionItem, Engagement, Project, db

    with app.app_context():
        engagement = Engagement(title="Queue engagement", customer_id=sample_data["customer1_id"])
        project = Project(title="Queue project")
        saved_project = Project(title="Pinned suggestions", project_type="copilot_saved")
        db.session.add_all([engagement, project, saved_project])
        db.session.flush()
        tasks = [
            ActionItem(title="Engagement follow-up", engagement_id=engagement.id,
                       source="engagement", due_date=date(2026, 1, 2), contact="Owner",
                       priority="high"),
            ActionItem(title="Pinned task", project_id=saved_project.id, source="project"),
            ActionItem(title="Generated task", source="copilot"),
            ActionItem(title="Project follow-up", project_id=project.id, source="project"),
        ]
        db.session.add_all(tasks)
        db.session.commit()
        with app.test_request_context("/action-items"):
            app.preprocess_request()
            html = render_template(
                "partials/_action_items_hub.html", engagement_tasks=[tasks[0]],
                saved_tasks=[tasks[1]], copilot_tasks=[tasks[2]], project_tasks=[tasks[3]],
                stale_milestones=[], hygiene_tasks=[], sellers=[],
            )
        soup = BeautifulSoup(html, "html.parser")
        assert [row["data-action-id"] for row in soup.select("#actions-copilot tbody tr")] == [
            str(tasks[1].id), str(tasks[2].id),
        ]
        row = soup.select_one("#actions-engagement tbody tr")
        assert row.find_parent("table")["class"] == [
            "sb-actions-table", "sb-actions-compact-table", "sb-actions-task-table",
        ]
        assert [label.get_text() for label in row.select(".sb-actions-field-label")] == [
            "Contact", "Due", "Priority", "Status",
        ]
        assert row.select_one('[data-sb-sort-value="2026-01-02"]')
        assert row.select_one('[data-sb-sort-value="Owner"]')
        assert row.select_one(f'a[href="/engagement/{engagement.id}"]')
        assert row.select_one(f'a[href="/customer/{engagement.customer_id}"]')
        assert soup.select_one(f'a[href="/project/{project.id}"]')
        project_table = soup.select_one("#actions-project table")
        assert [header["data-export-label"] for header in
                project_table.select("th[data-sb-sort-type]")] == ["Action item", "Project"]
        assert project_table["data-sb-sort-key"] == "actions-project-visible-0000"
        project_row = project_table.select_one("tbody tr")
        assert "sb-actions-project-task-row" in project_row["class"]
        assert len(project_row.select("td")) == 6
        assert len(project_row.select("[data-action-preview]")) == 1
        assert project_row.select_one("button[aria-haspopup=dialog]")
        assert "View / Edit" not in project_row.get_text()
        for table in soup.select("table"):
            headers = table.select("th")
            assert all(header.get("data-export-label") for header in headers)
            assert all(header.get("data-sb-sort-type") or
                       header.get("data-export-label") == "Open" or
                       "sb-actions-unsortable-heading" in header.get("class", [])
                       for header in headers)


def test_project_sorts_follow_populated_summary_fields_and_hygiene_names(app):
    """Visible metadata becomes sortable; diagnostic gaps never become sort controls."""
    task = SimpleNamespace(
        id=7, title="Follow up", project=SimpleNamespace(title="Project", project_type="general"),
        project_id=3, engagement=None, contact="Owner", due_date=date(2026, 10, 10),
        priority="high", status="blocked", is_overdue=False,
    )
    gap = SimpleNamespace(
        title="Engagement", icon="bi-link", url="/engagement/1", subtitle="Customer",
        type="engagement_no_milestone",
    )
    with app.test_request_context("/action-items"):
        app.preprocess_request()
        html = render_template(
            "partials/_action_items_hub.html", engagement_tasks=[], saved_tasks=[],
            copilot_tasks=[], project_tasks=[task], hygiene_tasks=[gap],
            stale_milestones=[], sellers=[],
        )
    soup = BeautifulSoup(html, "html.parser")
    project = soup.select_one("#actions-project table")
    assert [header["data-export-label"] for header in
            project.select("th[data-sb-sort-type]")] == [
        "Action item", "Project", "Contact", "Due", "Priority", "Status",
    ]
    assert project["data-sb-sort-key"] == "actions-project-visible-1111"
    hygiene = soup.select_one("#actions-hygiene table")
    assert [header["data-export-label"] for header in
            hygiene.select("th[data-sb-sort-type]")] == ["Name", "Customer"]
    assert hygiene.select_one("th[data-export-label=Gap]")["class"] == [
        "sb-actions-unsortable-heading",
    ]
    assert "No milestone linked" in hygiene.get_text()


def test_action_fragment_preserves_five_empty_populations(app):
    """Even empty and preference-disabled queues retain their original messages."""
    with app.test_request_context("/api/action-items-hub"):
        app.preprocess_request()
        html = render_template(
            "partials/_action_items_hub.html", engagement_tasks=[], saved_tasks=[],
            copilot_tasks=[], project_tasks=[], stale_milestones=[], hygiene_tasks=[], sellers=[],
        )
    soup = BeautifulSoup(html, "html.parser")
    assert len(soup.select(".sb-actions-queue")) == 5
    for message in ("No open engagement tasks", "No Copilot suggestions",
                    "No open project tasks", "No hygiene issues", "No stale milestones"):
        assert message in soup.get_text()
    assert not soup.select(".sb-page-status, [data-sb-page-surface]")


def test_stale_columns_keep_raw_money_days_dates_and_seller_scope(app):
    """Rounded labels do not become sorting keys and DSS keeps its provider scope."""
    seller = SimpleNamespace(id=3, name="Queue seller")
    customer = SimpleNamespace(id=7, seller_id=3, seller=seller, name="Queue customer")
    milestone = SimpleNamespace(
        id=5, title="Queue milestone", opportunity_name="", customer=customer, customer_id=7,
        workload="Data", due_date=date(2027, 1, 2), due_date_urgency="soon",
        days_since_comment=19, monthly_usage=1234.56, msx_status="On Track", url="",
    )
    with app.test_request_context("/action-items"):
        app.preprocess_request()
        context = dict(engagement_tasks=[], saved_tasks=[], copilot_tasks=[], project_tasks=[],
                       stale_milestones=[milestone], hygiene_tasks=[],
                       sellers=[seller, SimpleNamespace(id=4, name="Other")])
        soup = BeautifulSoup(render_template("partials/_action_items_hub.html",
                                            user_role="se", **context), "html.parser")
        dss = BeautifulSoup(render_template("partials/_action_items_hub.html",
                                           user_role="dss", **context), "html.parser")
    row = soup.select_one(".stale-ms-item")
    assert row["data-seller-id"] == "3"
    assert row.find_parent("table").has_attr("data-sb-sortable")
    assert "sb-actions-stale-table" in row.find_parent("table")["class"]
    assert [label.get_text() for label in row.select(".sb-actions-field-label")] == [
        "Due", "Days stale", "ACR / mo",
    ]
    for raw in ("2027-01-02", "19", "1234.56"):
        assert row.select_one(f'[data-sb-sort-value="{raw}"]')
    assert row.select_one('a[href="/seller/3"]')
    assert soup.select_one("#staleMilestoneSellerFilter")
    assert not dss.select_one("#staleMilestoneSellerFilter")
