"""Topic detail parity and deletion isolation on the actual route."""

from datetime import datetime
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, Note, Partner, Topic, UserPreference, db


def detail(client, topic_id):
    """Read the standalone detail consumer."""
    response = client.get(f"/topic/{topic_id}")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-topic-detail]"), soup


def test_empty_native_detail_original_commands_and_missing(client, app):
    """Retain empty guidance, count, edit/delete destinations and native lifecycle."""
    with app.app_context():
        topic = Topic(name='Empty "<tag>"')
        db.session.add(topic)
        db.session.commit()
        topic_id = topic.id
    root, soup = detail(client, topic_id)
    assert 'sb-directory-frame' in root['class']
    assert 'Empty "<tag>"' in root.h1.get_text()
    assert "No notes tagged with this topic yet." in root.get_text()
    assert root.select_one("a")["href"] == f"/topic/{topic_id}/edit"
    assert root.select_one("form")["action"] == f"/topic/{topic_id}/delete"
    assert root.select_one("form")["method"] == "POST"
    assert root.select_one("dialog [autofocus]").get_text() == "Cancel"
    assert not root.select(".topic-description,table,.card,.badge,.btn,[data-bs-toggle]")
    assert "0 notes" in soup.select_one(".sb-page-status").get_text()
    assert "0 accounts" in soup.select_one(".sb-page-status").get_text()
    assert not root.select("[data-topic-account]")
    assert "sb-page-frame" in soup.body["class"]
    for script in ("ui-topic-detail.js", "ui-table-sort.js", "ui-dialog.js"):
        assert len(soup.select(f'script[src^="/static/js/{script}"]')) == 1
    assert client.get("/topic/999999").status_code == 404


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_original_fields_relationships_and_unrestricted_scope(app, client, sample_data, role):
    """Show all topic notes, exact previews, local times and every original relationship."""
    topic_id = sample_data["topic1_id"]
    with app.app_context():
        topic = db.session.get(Topic, topic_id)
        topic.description = "Full description\n" * 30
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        call = db.session.get(Note, sample_data["call1_id"])
        call.call_date = datetime(2026, 1, 2, 13, 30)
        call.content = "<b>Original excerpt</b> &amp; content"
        call.topics.append(db.session.get(Topic, sample_data["topic2_id"]))
        partner = Partner(name='Partner "<name>"')
        call.partners.append(partner)
        general = Note(content="General tagged note", call_date=datetime(2026, 2, 3))
        other = db.session.get(Note, sample_data["call2_id"])
        other.call_date = datetime(2025, 1, 1)
        topic.notes.extend([general, other])
        db.session.commit()
        general_id, partner_id = general.id, partner.id
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, soup = detail(client, topic_id)
    assert root.select_one(".topic-description p").get_text() == "Full description\n" * 30
    flat = root.select_one("[data-topic-flat]")
    rows = flat.select("tbody tr")
    assert [int(row["data-note-id"]) for row in rows] == [
        general_id, sample_data["call1_id"], sample_data["call2_id"],
    ]
    assert "3 notes" in soup.select_one(".sb-page-status").get_text()
    assert "3 note(s)" in root.select_one("dialog").get_text()
    row = rows[1]
    expected_links = [
        f'/note/{sample_data["call1_id"]}',
        f'/customer/{sample_data["customer1_id"]}',
        f'/seller/{sample_data["seller1_id"]}',
        f'/territory/{sample_data["territory1_id"]}',
        f'/topic/{topic_id}', f'/topic/{sample_data["topic2_id"]}',
        f'/partners/{partner_id}',
    ]
    assert [a["href"] for a in row.select("a")] == expected_links
    assert row.select_one(".topic-excerpt").get_text() == "Original excerpt & content"
    assert row["data-topic-note-href"] == f'/note/{sample_data["call1_id"]}'
    assert "01:30 PM" in row.select_one(".topic-date").get_text()
    assert float(row.select("td")[1]["data-sb-sort-value"]) == datetime(
        2026, 1, 2, 13, 30).timestamp()
    assert rows[0].select("td")[0]["data-sb-sort-value"] == ""
    assert "No Customer" in rows[0].get_text()
    assert "AM" not in rows[0].select_one(".topic-date").get_text()
    assert [th["data-export-label"] for th in flat.select("th")] == [
        "Name", "Note date", "Seller", "Territory", "Topics", "Partners",
    ]
    assert [th["data-sb-sort-type"] for th in flat.select("th")] == [
        "text", "number", "text", "text", "text", "text",
    ]
    assert not root.select("script,.card,.badge,.btn,[onclick],[data-bs-toggle]")
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")


def test_given_repeated_accounts_when_grouped_then_counts_identity_and_order(app, client):
    """Group by identity, retain unassigned notes and match the flat presentation."""
    with app.app_context():
        first = Customer(name='Same "<account>"', tpid=900001)
        second = Customer(name='Same "<account>"', tpid=900002)
        topic = Topic(name="Grouped")
        notes = [
            Note(customer=first, content="Older", call_date=datetime(2026, 1, 1)),
            Note(customer=second, content="Other", call_date=datetime(2026, 2, 1)),
            Note(content="Unassigned", call_date=datetime(2026, 3, 1)),
            Note(customer=first, content="Newest", call_date=datetime(2026, 4, 1)),
        ]
        topic.notes.extend(notes)
        db.session.add(topic)
        db.session.commit()
        topic_id, first_id, second_id = topic.id, first.id, second.id
        expected = [notes[i].id for i in (3, 2, 1, 0)]

    root, soup = detail(client, topic_id)
    groups = root.select("[data-topic-account]")
    assert [group["data-topic-account"] for group in groups] == [
        str(first_id), "unassigned", str(second_id),
    ]
    assert [group.select_one(".topic-account-count").get_text() for group in groups] == [
        "2 notes", "1 note", "1 note",
    ]
    assert all(not group.has_attr("open") and not group.has_attr("name") for group in groups)
    assert 'Same "<account>"' in groups[0].summary.get_text()
    assert groups[0].summary.select_one("account") is None
    assert not groups[0].summary.select("a")
    assert groups[0].select_one(".topic-account-link")["href"] == f"/customer/{first_id}"
    assert not groups[1].select(".topic-account-link")
    assert "4 notes" in soup.select_one(".sb-page-status").get_text()
    assert "2 accounts" in soup.select_one(".sb-page-status").get_text()
    assert "2 accounts" in root.select_one(".topic-band").get_text()
    flat = root.select_one("[data-topic-flat]")
    assert flat.has_attr("hidden")
    assert root.select_one("[data-topic-view] option[selected]")["value"] == "account"
    flat_rows = flat.select("[data-note-id]")
    assert [int(row["data-note-id"]) for row in flat_rows] == expected
    grouped_rows = root.select("[data-topic-accounts] [data-note-id]")
    assert len(grouped_rows) == len(flat_rows)
    assert {row["data-note-id"]: str(row) for row in grouped_rows} == {
        row["data-note-id"]: str(row) for row in flat_rows
    }
    assert [int(row["data-note-id"]) for row in groups[0].select("[data-note-id]")] == [
        expected[0], expected[-1],
    ]
    keys = [table["data-sb-sort-key"] for table in root.select("table")]
    assert len(keys) == len(set(keys)) == 4


@pytest.mark.parametrize("fail", [False, True])
def test_delete_retains_notes_and_failure_retains_associations(
        app, client, sample_data, fail):
    """Deletion only removes the topic; failed commits roll back and show honest recovery."""
    topic_id = sample_data["topic1_id"]
    with patch("app.routes.topics.db.session.commit",
               side_effect=SQLAlchemyError("isolated")) if fail else patch(
                   "app.routes.topics.current_app.logger.exception") as logger:
        response = client.post(f"/topic/{topic_id}/delete")
    assert response.status_code == 302
    assert response.headers["Location"].endswith(f"/topic/{topic_id}" if fail else "/topics")
    rendered = client.get(response.headers["Location"]).get_data(as_text=True)
    assert ("Could not delete the topic." if fail else "deleted and removed from 1 note(s)."
            ) in rendered
    with app.app_context():
        note = db.session.get(Note, sample_data["call1_id"])
        assert note is not None
        assert (db.session.get(Topic, topic_id) is not None) is fail
        assert (topic_id in [topic.id for topic in note.topics]) is fail


def test_original_consumers_keep_topic_destinations(client, sample_data):
    """Directory, customer and approved shared note detail still target this detail route."""
    destination = f'/topic/{sample_data["topic1_id"]}'
    for path in ("/topics", f'/customer/{sample_data["customer1_id"]}',
                 f'/note/{sample_data["call1_id"]}'):
        soup = BeautifulSoup(client.get(path).data, "html.parser")
        assert soup.select_one(f'a[href="{destination}"]')
    source = client.get("/static/js/page-help.js").text
    help_text = source.split("title: 'Topic Details',", 1)[1].split("`},", 1)[0]
    for expected in ("all dates", "Back", "Delete", "Cancel", "Partners"):
        assert expected in help_text
