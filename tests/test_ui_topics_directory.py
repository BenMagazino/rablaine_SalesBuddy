"""Native Topics directory parity using isolated topic and note records."""

from pathlib import Path
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup

from app.models import Note, Topic, UserPreference, db


def test_both_topic_table_shapes_fill_the_reading_pane() -> None:
    """Brief and description-bearing topics use the pane rather than a second width cap."""
    css = (Path(__file__).parents[1] / "static" / "css" /
           "ui-topics-directory.css").read_text(encoding="utf-8")
    assert ".topics-table { width: 100%;" in css
    assert ".topics-table-brief { width:" not in css
    assert "width: min(100%," not in css


def directory(client):
    """Read the actual standalone provider and directory consumer."""
    response = client.get("/topics")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-topics-directory]"), soup


def test_empty_native_directory_and_original_commands(client):
    """Retain original empty guidance, creation destination and saved default command."""
    root, soup = directory(client)
    assert 'sb-directory-frame' in root['class']
    assert "No topics yet." in root.get_text()
    assert [a["href"] for a in root.select("a")] == ["/topic/new", "/topic/new"]
    assert root["data-default-by-notes"] == "false"
    assert root.select_one("#sortLabel").get_text() == "Alphabetical"
    assert "0 Topics" in soup.select_one(".sb-page-status").get_text()
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")
    assert not root.select("table,.card,.badge,.btn,.list-group,[onclick],[data-bs-toggle]")
    assert not root.select("input,select,form")
    for script in ("ui-topics-directory.js", "ui-table-sort.js"):
        assert len(soup.select(f'script[src="/static/js/{script}"]')) == 1


@pytest.mark.parametrize("by_notes", [False, True])
def test_all_fields_raw_counts_description_and_original_default(app, client, by_notes):
    """Preserve default tie ordering, zero counts, full raw data and escaped identities."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.topic_sort_by_calls = by_notes
        first = Topic(name='alpha "<topic>"', description="Description " * 25)
        most = Topic(name="Zulu", description=None)
        tied = Topic(name="Beta", description="Beta description")
        notes = [Note(content="Isolated note") for _ in range(12)]
        most.notes.extend(notes)
        tied.notes.extend(notes)
        db.session.add_all([most, tied, first])
        db.session.commit()
        first_id, most_id, tied_id = first.id, most.id, tied.id
    root, soup = directory(client)
    rows = root.select("tbody tr")
    assert [int(row["data-topic-id"]) for row in rows] == (
        [tied_id, most_id, first_id] if by_notes else [first_id, tied_id, most_id]
    )
    first_row = root.select_one(f'[data-topic-id="{first_id}"]')
    assert first_row.select_one("a")["href"] == f"/topic/{first_id}"
    assert first_row["data-topic-href"] == f"/topic/{first_id}"
    assert first_row.select_one("td")["data-sb-sort-value"] == 'alpha "<topic>"'
    description = first_row.select("td")[1]
    assert description["data-sb-sort-value"] == "Description " * 25
    assert description.select_one("span")["title"] == "Description " * 25
    assert len(description.get_text(strip=True)) <= 150
    assert first_row.select("td")[2]["data-sb-sort-value"] == "0"
    assert root.select_one(f'[data-topic-id="{most_id}"] td:last-child')[
        "data-sb-sort-value"
    ] == "12"
    assert root.select_one(f'[data-topic-id="{most_id}"] td:nth-child(2)').get_text() == ""
    assert [th["data-export-label"] for th in root.select("th")] == [
        "Name", "Description", "Notes",
    ]
    assert [th["data-sb-sort-type"] for th in root.select("th")] == [
        "text", "text", "number",
    ]
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert root["data-default-by-notes"] == str(by_notes).lower()
    assert root.select_one("#sortLabel").get_text() == (
        "By Notes" if by_notes else "Alphabetical"
    )
    assert "3 Topics" in soup.select_one(".sb-page-status").get_text()
    assert not root.select(".card,.badge,.btn,.list-group,[onclick],[data-bs-toggle]")


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_original_topic_scope_is_all_notes_and_all_topics(app, client, sample_data, role):
    """Seller impersonation and role preferences do not narrow topics or note counts."""
    with app.app_context():
        db.session.add(Topic(name="No notes"))
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        expected = {str(topic.id): len(topic.notes) for topic in Topic.query.all()}
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, _ = directory(client)
    assert {row["data-topic-id"]: int(row.select("td")[-1]["data-sb-sort-value"])
            for row in root.select("tbody tr")} == expected


def test_empty_description_column_is_omitted_without_losing_counts(app, client):
    """No unused description axis is imposed on a directory of name-only topics."""
    with app.app_context():
        db.session.add_all([Topic(name="One"), Topic(name="Two", description="")])
        db.session.commit()
    root, _ = directory(client)
    assert root.select_one("table")["data-sb-sort-key"] == "topics-directory-brief"
    assert [th["data-export-label"] for th in root.select("th")] == ["Name", "Notes"]
    assert all(len(row.select("td")) == 2 for row in root.select("tbody tr"))
    assert all(row.select("td")[-1]["data-sb-sort-value"] == "0"
               for row in root.select("tbody tr"))


def test_explicit_default_save_exact_payload_and_failure_rollback(app, client):
    """The existing explicit preference POST stays atomic and returns real failure."""
    response = client.post("/api/preferences/topic-sort", json={"topic_sort_by_calls": True})
    assert response.status_code == 200
    assert response.json == {"topic_sort_by_calls": True}
    with patch("app.routes.main.db.session.commit", side_effect=RuntimeError("isolated")):
        response = client.post("/api/preferences/topic-sort",
                               json={"topic_sort_by_calls": False})
    assert response.status_code == 503
    assert response.json == {"error": "Could not save the default topic order."}
    with app.app_context():
        assert UserPreference.query.first().topic_sort_by_calls is True
    root, _ = directory(client)
    assert root["data-default-by-notes"] == "true"


def test_preference_missing_uses_alphabetical(app, client):
    """A missing preference retains the original alphabetical fallback."""
    with app.app_context():
        UserPreference.query.delete()
        db.session.commit()
    root, _ = directory(client)
    assert root["data-default-by-notes"] == "false"
    with app.app_context():
        # The shared app request lifecycle initializes a missing preference.
        assert UserPreference.query.first().topic_sort_by_calls is False
