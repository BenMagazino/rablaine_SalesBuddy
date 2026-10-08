"""Shared milestone workbench body and forecast presentation parity."""

from datetime import datetime, timezone
import json
from pathlib import Path

from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient
import pytest

from app.models import Engagement, Milestone, MsxTask, Note, Opportunity, Seller, Topic, db


COMMENTS = [
    {"comment": "Earlier <plain> · note-12 ·", "displayName": "Seller <One>",
     "modifiedOn": "2026-10-01T13:00:00Z", "userId": "one"},
    {"comment": "<table><tr><td>Architecture</td></tr></table>",
     "displayName": "Seller Two", "modifiedOn": "2026-10-02T13:00:00Z", "userId": "two"},
]


def test_standalone_context_width_preserves_embedded_geometry() -> None:
    """Give standalone context more room without widening embedded milestone previews."""
    css = (Path(__file__).resolve().parents[1] / "static" / "css" / "ui-milestone.css")
    styles = css.read_text(encoding="utf-8")
    standalone = styles.split(
        ".sb-ms-page[data-sb-milestone-page] .sb-ms-layout {", 1,
    )[1].split("}", 1)[0]
    assert "grid-template-columns: 352px minmax(0, 1fr);" in standalone
    assert ".sb-ms-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr);" in styles


@pytest.fixture
def body_milestone(app: Flask, sample_data: dict[str, int]) -> dict[str, int]:
    """Populate all linked fields in the isolated database, including a general note."""
    with app.app_context():
        seller = db.session.get(Seller, sample_data["seller1_id"])
        opportunity = Opportunity(
            name="Native body opportunity", msx_opportunity_id="body-opportunity",
            customer_id=sample_data["customer1_id"],
        )
        engagement = Engagement(
            title="Native body engagement", customer_id=sample_data["customer1_id"],
        )
        milestone = Milestone(
            title="Native body milestone", url="https://example.com/milestone",
            msx_milestone_id="body-milestone", customer_id=sample_data["customer1_id"],
            opportunity=opportunity, owner_name=seller.name, on_my_team=True,
            msx_status="At Risk", customer_commitment="Uncommitted",
            milestone_number="7-BODY", workload="Data: Architecture", dollar_value=15000,
            monthly_usage=2500, due_date=datetime(2026, 10, 6, tzinfo=timezone.utc),
            cached_comments_json=json.dumps(COMMENTS),
        )
        milestone.engagements.append(engagement)
        note = db.session.get(Note, sample_data["call1_id"])
        note.call_date = datetime(2026, 10, 3, 10, 30)
        note.topics = [Topic(name=f"Native milestone topic {i}") for i in range(4)]
        general = Note(content="General linked note", call_date=datetime(2026, 10, 2))
        milestone.notes.extend([note, general])
        db.session.add(milestone)
        db.session.flush()
        task = MsxTask(
            milestone=milestone, note=note, subject="Native architecture task",
            msx_task_id="body-task", msx_task_url="https://example.com/task",
            task_category=1, task_category_name="Architecture Design Session", is_hva=True,
            due_date=datetime(2026, 10, 7, tzinfo=timezone.utc),
        )
        db.session.add(task)
        db.session.commit()
        return {
            "milestone": milestone.id, "opportunity": opportunity.id,
            "engagement": engagement.id, "note": note.id, "general": general.id,
            "seller": seller.id, "customer": milestone.customer_id,
        }


@pytest.mark.parametrize("preview", [False, True])
def test_shared_body_keeps_metadata_links_counts_and_native_structure(
    client: FlaskClient, body_milestone: dict[str, int], preview: bool,
) -> None:
    """Full and fragment bodies retain all information and nested controller ancestry."""
    milestone_id = body_milestone["milestone"]
    path = f"/api/milestone/{milestone_id}/detail" if preview else f"/milestone/{milestone_id}"
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(".sb-milestone-view[data-sb-milestone-detail]")
    assert root["data-sb-milestone-id"] == str(milestone_id)
    layout = root.select_one(".sb-ms-layout")
    assert [child.name for child in layout.find_all(recursive=False)] == ["aside", "section"]
    assert root.select_one("script[data-sb-milestone-controller]").parent == root
    assert not root.select(".card, .card-header, .card-body, .row, .list-group, .btn, .modal")
    assert bool(root.select_one(".sb-ms-page-header")) is not preview
    assert not root.select(".sb-ms-section > h3")
    labels = {label.get_text() for label in root.select(".sb-ms-meta-row > .sb-ms-label")}
    assert labels == {
        "Status", "Owner", "Commitment", "Number", "Workload", "Value", "Monthly Usage",
        "Due Date", "Milestone Team", "Created", "Last Updated",
    }
    text = root.get_text()
    for value in ("7-BODY", "Data: Architecture", "$15,000", "$2,500", "Oct 06, 2026",
                  "Uncommitted", "Native architecture task", "HVA",
                  "Architecture Design Session", "Oct 07", "10:30 AM", "General Note", "+1"):
        assert value in text
    for key, prefix in (
        ("customer", "customer"), ("opportunity", "opportunity"), ("engagement", "engagement"),
        ("note", "note"), ("general", "note"), ("seller", "seller"),
    ):
        assert root.select_one(f'a[href="/{prefix}/{body_milestone[key]}"]')
    owner = root.select_one("#ownerValue a")
    assert {"badge", "bg-primary", "sb-record-badge"} <= set(owner["class"])
    assert root.select_one("#statusValue .sb-record-tag")["data-status"] == "At Risk"
    assert root.select_one("#leaveMilestoneTeamBtn")
    assert root.select_one('a[href="https://example.com/task"]')["target"] == "_blank"
    note_links = root.select(".sb-ms-note-link")
    assert [link["href"] for link in note_links] == [
        f'/note/{body_milestone["note"]}', f'/note/{body_milestone["general"]}',
    ]
    new_note = root.select_one('a[aria-label="New note for this milestone"]')
    assert f"customer_id={body_milestone['customer']}" in new_note["href"]
    assert f"milestone_id={milestone_id}" in new_note["href"]
    assert root.select_one(".sb-ms-task a[title='Linked Note']")
    assert "COMMENT_WORKBENCH = true" in response.text
    if not preview:
        assert soup.select_one('link[href="/static/css/ui-milestone.css"]')


@pytest.mark.parametrize("preview", [False, True])
def test_standalone_frame_keeps_embed_shell_free(
    client: FlaskClient, body_milestone: dict[str, int], preview: bool,
) -> None:
    """Only full details own the native frame, persistent commands and reading history."""
    milestone_id = body_milestone["milestone"]
    path = f"/api/milestone/{milestone_id}/detail" if preview else f"/milestone/{milestone_id}"
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    root = soup.select_one("[data-sb-milestone-detail]")
    if preview:
        assert not root.has_attr("data-sb-page-surface")
        assert not root.select("[data-sb-ms-reading], [data-sb-ms-page-notice]")
        assert not soup.select(".sb-page-status, .sb-ms-page-header")
        return
    assert "sb-page-frame" in soup.body["class"]
    assert root.has_attr("data-sb-page-surface")
    assert root.has_attr("data-sb-milestone-page")
    assert root.select_one(".sb-ms-page-header").has_attr("data-sb-page-band")
    assert root.select_one(".sb-ms-layout").has_attr("data-sb-page-body")
    assert [pane["data-sb-ms-reading"] for pane in root.select("[data-sb-ms-reading]")] == [
        "context", "forecast",
    ]
    assert all(pane["tabindex"] == "0" for pane in root.select("[data-sb-ms-reading]"))
    assert root.select_one('nav[aria-label="Milestone commands"]')
    assert root.select_one(f'a[href="/milestone/{milestone_id}/edit"]')
    assert root.select_one('a[href="https://example.com/milestone"]')
    footer = soup.select_one('footer[aria-label="Milestone detail status"]')
    assert "2 linked notes" in footer.get_text()
    assert "1 task" in footer.get_text()
    assert soup.select_one("#milestonePageState")["role"] == "status"
    assert len(soup.select('script[src="/static/js/ui-table-sort.js"]')) == 1


@pytest.mark.parametrize("preview", [False, True])
def test_native_delete_is_full_page_only_and_keeps_normal_post(
    client: FlaskClient, body_milestone: dict[str, int], preview: bool,
) -> None:
    """Delete remains a labelled confirmation with Cancel autofocus and the original endpoint."""
    milestone_id = body_milestone["milestone"]
    path = f"/api/milestone/{milestone_id}/detail" if preview else f"/milestone/{milestone_id}"
    root = BeautifulSoup(client.get(path).data, "html.parser").select_one(
        "[data-sb-milestone-detail]"
    )
    delete = root.find(id="milestoneDeleteDialog")
    if preview:
        assert delete is None
        assert not root.select("[data-sb-dialog='milestoneDeleteDialog']")
        return
    assert delete.name == "dialog"
    assert delete["aria-labelledby"] == "milestoneDeleteTitle"
    assert delete.select_one("[autofocus][data-sb-dialog-close]").get_text(strip=True) == "Cancel"
    form = delete.select_one("form")
    assert form["method"].lower() == "post"
    assert form["action"] == f"/milestone/{milestone_id}/delete"
    assert delete.select_one('button[type="submit"]')


@pytest.mark.parametrize("cache", [None, "[]", "invalid JSON", json.dumps(COMMENTS)])
def test_cached_empty_and_uncached_forecasts_keep_native_fallbacks(
    client: FlaskClient, app: Flask, body_milestone: dict[str, int], cache: str | None,
) -> None:
    """Cached plain text stays escaped, rich tables survive and the fallback form stays real."""
    milestone_id = body_milestone["milestone"]
    with app.app_context():
        db.session.get(Milestone, milestone_id).cached_comments_json = cache
        db.session.commit()
    response = client.get(f"/api/milestone/{milestone_id}/detail")
    root = BeautifulSoup(response.data, "html.parser").select_one("[data-sb-milestone-detail]")
    form = root.select_one("#commentFormCached form")
    if cache in (None, "invalid JSON"):
        assert form is None
        assert root.select_one("#commentFormCached")["style"] == "display:none;"
    else:
        assert form["method"] == "post"
        assert form["action"] == f"/milestone/{milestone_id}/comment"
        assert form.select_one('textarea[name="comment"][required]')["aria-label"] == "Forecast comment"
    assert root.select_one("#commentsSpinner")["role"] == "status"
    assert root.select_one("#commentsMsx")
    assert root.select_one("#commentsError")
    if cache == json.dumps(COMMENTS):
        assert root.select_one("#cachedCommentsList table td").get_text() == "Architecture"
        assert len(root.select("#cachedCommentsList .sb-comment-item")) == 2
        assert "Earlier <plain>" in root.get_text()
        assert not root.select("#cachedCommentsList plain")
        assert len(root.select(".comment-time[datetime]")) == 2
    elif cache == "[]":
        assert "No forecast comments yet" in root.get_text()
    else:
        assert root.select_one("#commentsCached")["style"] == "display:none;"


def test_local_customerless_body_omits_remote_controls(client: FlaskClient, app: Flask) -> None:
    """No-MSX and no-customer branches retain their explanations and no invented actions."""
    with app.app_context():
        milestone = Milestone(url="https://example.com/local")
        db.session.add(milestone)
        db.session.commit()
        milestone_id = milestone.id
    response = client.get(f"/api/milestone/{milestone_id}/detail")
    root = BeautifulSoup(response.data, "html.parser").select_one("[data-sb-milestone-detail]")
    assert "Not linked to a customer or opportunity." in root.get_text()
    assert "Tasks cannot be created" in root.get_text()
    assert "has no MSX ID" in root.get_text()
    assert not root.select("#commentFormCached, #commentsSpinner, #milestoneTeamRow")
    assert not root.select("#newTaskModal, #milestoneEngagementModal, [data-sb-ms-action]")
    for row in ("statusRow", "ownerRow", "commitmentRow"):
        assert root.find(id=row)["style"] == "display:none;"


@pytest.mark.parametrize("native", [False, True])
def test_forecast_helper_opts_in_without_migrating_opportunity(
    app: Flask, native: bool,
) -> None:
    """The shared forecast helper retains its legacy default for unconverted consumers."""
    with app.test_request_context():
        html = app.jinja_env.get_template("_forecast_comments.html").render(
            cached_comments=COMMENTS,
            comment_form_action="/opportunity/1/comment", entity_label="opportunity",
            show_comments=True, **({"forecast_workbench": True} if native else {}),
        )
    soup = BeautifulSoup(html, "html.parser")
    assert bool(soup.select_one(".sb-ms-comments")) is native
    assert bool(soup.select_one(".card .card-header h5")) is not native
    assert bool(soup.select_one(".input-group .form-control")) is not native
    assert soup.select_one("form")["action"] == "/opportunity/1/comment"
    assert soup.select_one("#cachedCommentsList table")
    assert not soup.select("plain")
