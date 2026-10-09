"""Engagement dossier parity for full pages, fragments and tightly coupled editors."""

import json
import shutil
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from app.models import (
    ActionItem, Engagement, EngagementContact, Milestone, Note, Opportunity,
    Partner, PartnerRecommendation, Topic, db,
)


@pytest.fixture
def dossier(app, sample_customer):
    """Populate the isolated database with every engagement detail population."""
    with app.app_context():
        topic = Topic(name="Dossier topic")
        partner = Partner(name="Dossier partner")
        recent = Note(customer_id=sample_customer.id, content="<h2>Recent note</h2>",
                      call_date=datetime(2026, 10, 1, 13, 30), topics=[topic])
        older = Note(customer_id=sample_customer.id, content="<p>Older note</p>",
                     call_date=datetime(2026, 9, 1))
        unassigned = Note(customer_id=sample_customer.id, content="<p>Unassigned note</p>",
                          call_date=datetime(2026, 8, 1))
        opportunity = Opportunity(customer_id=sample_customer.id, name="Dossier opportunity",
                                  msx_opportunity_id="dossier-opportunity")
        milestone = Milestone(customer_id=sample_customer.id, title="Dossier milestone",
                              url="https://example.com/msx", msx_status="At Risk",
                              workload="Data: Fabric", monthly_usage=1234.56,
                              due_date=datetime(2027, 1, 2), msx_milestone_id="dossier-msx")
        engagement = Engagement(
            customer_id=sample_customer.id, title='Dossier "title" <literal>', status="On Hold",
            technical_problem="Original\nproblem", business_impact="Original impact",
            solution_resources="Original resources", business_outcome="Original outcome",
            estimated_acr=12345, target_date=date(2027, 2, 3),
            notes=[older, recent], opportunities=[opportunity], milestones=[milestone],
            contacts=[EngagementContact(external_name="Outside <person>",
                                        external_email="outside@example.com")],
        )
        db.session.add_all([engagement, partner, unassigned])
        db.session.flush()
        task = ActionItem(
            engagement_id=engagement.id, title="Open rich task", priority="high", contact="Owner",
            due_date=date(2025, 1, 1), note_id=recent.id, sort_order=2,
            source_url="https://example.com/source",
            description='<h2>Rich task</h2><img src="/image.png"><table><tr><td>Cell</td></tr></table>',
        )
        first = ActionItem(engagement_id=engagement.id, title="First task", sort_order=1)
        completed = ActionItem(engagement_id=engagement.id, title="Completed task",
                               status="completed", completed_at=datetime.now(timezone.utc))
        recommendation = PartnerRecommendation(engagement_id=engagement.id, partner_id=partner.id,
                                               rank=1, fit_score=80, reason="Saved fit rationale")
        db.session.add_all([task, first, completed, recommendation])
        db.session.commit()
        return {"engagement": engagement.id, "task": task.id, "first": first.id,
                "completed": completed.id, "recent": recent.id, "older": older.id,
                "unassigned": unassigned.id, "milestone": milestone.id,
                "opportunity": opportunity.id, "customer": sample_customer.id}


@pytest.mark.parametrize("fragment", [False, True])
def test_complete_native_dossier_inventory(client, app, dossier, fragment):
    """Standalone and embedded consumers retain complete values, actions and child scripts."""
    path = f"/api/engagement/{dossier['engagement']}/detail" if fragment else (
        f"/engagement/{dossier['engagement']}"
    )
    with app.app_context():
        engagement = db.session.get(Engagement, dossier["engagement"])
        before = (engagement.updated_at, engagement.technical_problem,
                  [note.id for note in engagement.notes], ActionItem.query.count())
    response = client.get(path)
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-engagement-detail]")
    assert response.status_code == 200
    assert root["data-sb-engagement-detail"] == str(dossier["engagement"])
    assert not root.select(".card, .btn, .badge, .form-control, [data-bs-toggle], [data-bs-dismiss]")
    for value in ["Original\nproblem", "Original impact", "Original resources",
                  "Original outcome", "$12,345/mo", "Feb 03, 2027", "Outside <person>",
                  "100% complete", "Saved fit rationale", "80% fit", "Data: Fabric",
                  "$1,235/mo", "Open rich task", "Owner", "(overdue)", "Completed task"]:
        assert value in root.get_text()
    for identity in ["storyReviewModal", "taskEditModal", "actionItemDetailModal", "aiDiscardDialog"]:
        assert root.select_one(f"dialog#{identity}.sb-dialog")
    assert root.select_one("#completedTasks[hidden]")
    assert root.select_one("#msEditMode[hidden] .ms-checkbox[checked]")["value"] == (
        str(dossier["milestone"])
    )
    assert [row["data-task-id"] for row in root.select("#sortableTaskList .task-item")] == [
        str(dossier["first"]), str(dossier["task"]),
    ]
    assert [link["href"] for link in root.select(".sb-eng-note")] == [
        f"/note/{dossier['recent']}", f"/note/{dossier['older']}",
    ]
    assert root.select_one(f'a[href="/milestone/{dossier["milestone"]}"]')
    assert root.select_one(f'a[href="/opportunity/{dossier["opportunity"]}"]')
    assert len(root.select('script[src$="ui-engagement-detail.js"]')) == 1
    assert "const ENGAGEMENT_ID =" in response.text
    assert "SBEngagementDetail.document(root)" in response.text
    assert "SBEngagementDetail.mount(root)" in response.text
    if fragment:
        assert not soup.select("html, body, footer, [data-sb-page-surface], [data-story-field]")
        assert not root.select("input[name=note_ids], #engFavoriteBtn")
    else:
        assert "sb-page-frame" in soup.body["class"]
        assert soup.select_one(".sb-page-status")
        assert len(root.select("[data-story-field]")) == 6
        assert root.select_one('form[method="POST"] input[name="note_ids"]')["value"] == (
            str(dossier["unassigned"])
        )
        assert len(soup.select('script[src$="ui-table-sort.js"]')) == 1
    with app.app_context():
        engagement = db.session.get(Engagement, dossier["engagement"])
        assert (engagement.updated_at, engagement.technical_problem,
                [note.id for note in engagement.notes], ActionItem.query.count()) == before


@pytest.mark.parametrize("status", ["Active", "On Hold", "Won", "Lost"])
def test_status_empty_and_ai_story_defaults(client, app, dossier, status):
    """All status tones, AI-only drafts and empty populations retain original visibility."""
    with app.app_context():
        engagement = db.session.get(Engagement, dossier["engagement"])
        engagement.status = status
        engagement.technical_problem = None
        engagement.ai_technical_problem = "AI-only proposed problem"
        engagement.estimated_acr = None
        engagement.ai_estimated_acr = 5000
        engagement.target_date = None
        engagement.ai_target_date = date(2028, 2, 3)
        engagement.notes.clear()
        engagement.opportunities.clear()
        engagement.milestones.clear()
        db.session.commit()
    soup = BeautifulSoup(client.get(f"/engagement/{dossier['engagement']}").data, "html.parser")
    assert soup.select_one(".sb-engagement-header [data-status]")["data-status"] == status
    assert "AI-only proposed problem" in soup.select_one('[data-story-field="technical_problem"]').text
    assert soup.select_one('[data-story-field="estimated_acr"]')["data-story-value"] == "5000"
    assert soup.select_one('[data-story-field="target_date"]')["data-story-value"] == "2028-02-03"
    assert not soup.select("#generateStoryBtn, #storyReviewModal")
    assert "No notes linked yet" in soup.text and "No milestones linked" in soup.text


def test_original_rich_task_api_round_trip(client, app, dossier):
    """Existing GET/PUT keep rich HTML, image-only descriptions and all editable payload fields."""
    identity = dossier["task"]
    before = client.get(f"/action-item/{identity}").get_json()["task"]
    assert "<table>" in before["description"] and before["source_url"] == "https://example.com/source"
    payload = {"title": "Retained task", "description": '<img src="/image-only.png">',
               "due_date": "2027-03-04", "priority": "normal", "contact": "New owner"}
    response = client.put(f"/action-item/{identity}", json=payload)
    assert response.status_code == 200 and response.get_json()["success"]
    task = client.get(f"/action-item/{identity}").get_json()["task"]
    for key, value in payload.items():
        assert task[key] == value
    assert task["engagement_id"] == dossier["engagement"] and task["note_id"] == dossier["recent"]


def test_full_and_fragment_inline_javascript_parses(client, dossier):
    """Every preserved controller parses as shipped, including native task scripts and AI review."""
    node = shutil.which("node")
    assert node, "Node is required for engagement controller syntax verification."
    for path in [f"/engagement/{dossier['engagement']}",
                 f"/api/engagement/{dossier['engagement']}/detail"]:
        soup = BeautifulSoup(client.get(path).data, "html.parser")
        scripts = [script.get_text() for script in soup.select("[data-sb-engagement-detail] script")
                   if not script.get("src")]
        result = subprocess.run([node, "-e",
                                 "JSON.parse(require('fs').readFileSync(0,'utf8'))"
                                 ".forEach(s=>new Function(s));"],
                                input=json.dumps(scripts), text=True, capture_output=True)
        assert result.returncode == 0, result.stderr


def test_note_task_consumer_keeps_native_dialog_and_original_payload(client, dossier):
    """The note editor's deferred rich task consumer migrates without touching its note editor."""
    soup = BeautifulSoup(client.get(f"/note/new?customer_id={dossier['customer']}").data, "html.parser")
    dialog = soup.select_one("dialog#engTaskFlyout.sb-dialog")
    assert dialog and not dialog.select(".offcanvas, .btn, .form-control, [data-bs-dismiss]")
    for identity in ["engTaskTitle", "engTaskTarget", "engTaskDue", "engTaskPriority",
                     "engTaskContact", "engTaskDescriptionEditor", "engTaskCreateBtn", "engTaskSaveBtn"]:
        assert dialog.select_one(f"#{identity}")
    source = Path("templates/note_form.html").read_text(encoding="utf-8")
    assert "if (_engTaskEditId) saveEngTask();" in source
    assert "_engTaskQuill.root.querySelector('img, table, video')" in source
    assert "note_id: noteId" in source
    assert "quill.insertText(pos, linkText, 'link', linkUrl, 'user')" in source
    assert "new bootstrap.Offcanvas(document.getElementById('engTaskFlyout'))" not in source
