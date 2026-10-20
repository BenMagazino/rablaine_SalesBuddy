"""Parity contracts for native note previews and shared quick-action editors."""

from datetime import datetime, timezone

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient

from app.models import ActionItem, Engagement, Note, db


@pytest.fixture
def preview_note(app: Flask, sample_data: dict[str, int]) -> tuple[int, int]:
    """Link an existing test note to an engagement without touching the dev database."""
    with app.app_context():
        note = db.session.get(Note, sample_data["call1_id"])
        assert note is not None
        note.content = '<p>Preview content with <strong>formatting</strong>.</p><img src="/test.png">'
        note.call_date = datetime(2026, 10, 2, 10, 30)
        note.updated_at = datetime(2026, 10, 2, 18, 0, tzinfo=timezone.utc)
        engagement = Engagement(title="Preview Engagement", customer_id=note.customer_id)
        db.session.add(engagement)
        db.session.flush()
        note.engagements.append(engagement)
        db.session.commit()
        return note.id, engagement.id


def test_home_note_host_preserves_launcher_links_and_native_loading_controls(
    client: FlaskClient,
) -> None:
    """Calendar note launches retain the existing function and full-page destination surface."""
    response = client.get("/")
    soup = BeautifulSoup(response.data, "html.parser")
    dialog = soup.find(id="homeNoteDetailModal")
    assert dialog.name == "dialog"
    assert "sb-dialog-record" in dialog["class"]
    assert dialog["aria-labelledby"] == "homeNoteTitle"
    assert dialog["data-sb-backdrop-close"] == "true"
    assert dialog.find(id="homeNoteBody").has_attr("data-sb-record-content")
    assert dialog.find(id="homeNoteFullLink").get_text(strip=True) == "Full Page"
    assert dialog.select_one("[data-sb-record-retry]")["type"] == "button"
    assert dialog.select_one("[data-sb-record-error]").has_attr("hidden")
    assert not dialog.select(".modal-dialog, .modal-content, [data-bs-dismiss]")
    assert "window.openHomeNoteDetail" in response.text
    assert "openHomeNoteDetail(log.id, log.customer_name)" in response.text


def test_note_fragment_retains_context_content_dates_images_and_action_fields(
    client: FlaskClient, preview_note: tuple[int, int], sample_data: dict[str, int],
) -> None:
    """The current note information and linked navigation are not lost during shell migration."""
    note_id, engagement_id = preview_note
    response = client.get(f"/api/note/{note_id}/detail")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-note-detail]")
    assert root["data-sb-note-id"] == str(note_id)
    assert "October 02, 2026" in root.get_text()
    assert "10:30 AM" in root.get_text()
    assert root.select_one(".call-content strong").get_text() == "formatting"
    assert root.select_one(".call-content img")["src"] == "/test.png"
    assert root.select_one(f'a[href="/customer/{sample_data["customer1_id"]}"]')
    assert root.select_one(f'a[href="/seller/{sample_data["seller1_id"]}"]')
    assert root.select_one(f'a[href="/territory/{sample_data["territory1_id"]}"]')
    assert root.select_one(f'a[href="/topic/{sample_data["topic1_id"]}"]')
    assert root.select_one(f'a[href="/engagement/{engagement_id}"]')
    assert len(root.select(".local-datetime[data-utc]")) == 2
    assert not root.select(".btn-share, #deleteModal")
    assert not root.select("script")
    editor = root.select_one("[data-sb-note-actions]")
    assert editor.name == "details"
    assert not editor.has_attr("open")
    assert editor["data-sb-note-id"] == str(note_id)
    assert editor.find(id="noteTaskTitle")["maxlength"] == "300"
    assert editor.find(id="noteTaskTitle").has_attr("required")
    assert editor.find(id="noteTaskDue")["type"] == "date"
    assert editor.select_one(f'option[value="{engagement_id}"]')
    assert editor.select_one('button[type="submit"]')
    assert not editor.select("[data-bs-toggle], .collapse, [onclick]")


def test_full_note_page_retains_edit_delete_share_and_same_editor(
    client: FlaskClient, preview_note: tuple[int, int],
) -> None:
    """Full-page commands remain, while the quick action uses the same initializer."""
    note_id, _ = preview_note
    soup = BeautifulSoup(client.get(f"/note/{note_id}").data, "html.parser")
    assert soup.select_one(f'a[href^="/note/{note_id}/edit"]')
    assert soup.select_one(".btn-share")
    assert soup.find(id="deleteModal")
    assert soup.select_one("[data-sb-note-actions]")
    scripts = [script["src"].split("?", 1)[0] for script in soup.select("script[src]")]
    assert "/static/js/ui-note-actions.js" in scripts, scripts
    assert "/static/js/ui-local-datetime.js" in scripts, scripts


def test_general_note_fragment_has_no_manufactured_engagement_editor(
    client: FlaskClient, app: Flask,
) -> None:
    """General notes stay valid without customer/engagement-dependent controls."""
    with app.app_context():
        note = Note(content="<p>General context</p>", call_date=datetime(2026, 10, 2, 9, 0))
        db.session.add(note)
        db.session.commit()
        note_id = note.id
    soup = BeautifulSoup(client.get(f"/api/note/{note_id}/detail").data, "html.parser")
    assert "General Note" in soup.get_text()
    assert "General context" in soup.get_text()
    assert not soup.select("[data-sb-note-actions]")


def test_note_preview_missing_record_remains_a_real_404(client: FlaskClient) -> None:
    """A missing note never returns a success-shaped fallback fragment."""
    assert client.get("/api/note/2147483647/detail").status_code == 404


def test_note_action_post_keeps_existing_payload_association_and_due_date(
    client: FlaskClient, app: Flask, preview_note: tuple[int, int],
) -> None:
    """The unchanged local write endpoint saves the fields used by the shared editor."""
    note_id, engagement_id = preview_note
    response = client.post(
        f"/engagement/{engagement_id}/action-items",
        json={"title": "Follow up on design", "due_date": "2026-10-05", "note_id": note_id},
    )
    assert response.status_code == 201
    assert response.json["success"] is True
    with app.app_context():
        task = db.session.get(ActionItem, response.json["task"]["id"])
        assert task is not None
        assert task.note_id == note_id
        assert task.engagement_id == engagement_id
        assert task.title == "Follow up on design"
        assert task.due_date.isoformat() == "2026-10-05"


@pytest.mark.parametrize(
    "payload",
    [{"title": " "}, {"title": "Follow up", "due_date": "not-a-date"}],
)
def test_invalid_note_action_does_not_create_a_task(
    client: FlaskClient, app: Flask, preview_note: tuple[int, int], payload: dict[str, str],
) -> None:
    """Validation failures remain real failures and do not leave partial records."""
    _, engagement_id = preview_note
    response = client.post(f"/engagement/{engagement_id}/action-items", json=payload)
    assert response.status_code == 400
    assert response.json["success"] is False
    with app.app_context():
        assert db.session.query(ActionItem).count() == 0
