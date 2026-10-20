"""Topic detail parity and deletion isolation on the actual route."""

from datetime import date, datetime, timedelta
from time import perf_counter
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy import event
from sqlalchemy.exc import SQLAlchemyError

from app.models import (
    Customer, Milestone, Note, Opportunity, Partner, Seller, Territory, Topic, UserPreference, db,
)
from app.services.topic_excerpts import build_topic_excerpt, highlight_note_content


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
    accounts = root.select_one("[data-topic-accounts]")
    assert accounts["data-sb-sort-default-column"] == "3"
    assert accounts["data-sb-sort-default-direction"] == "descending"
    assert not flat.select_one("table").has_attr("data-sb-sort-default-column")


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
            Note(customer=first, content="Newest", call_date=datetime(2026, 4, 1, 15, 45)),
        ]
        topic.notes.extend(notes)
        db.session.add(topic)
        db.session.add(Note(
            customer=first, content="Not tagged", call_date=datetime(2030, 1, 1),
        ))
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
    summary = root.select_one("[data-topic-accounts]")
    assert summary.name == "table"
    assert summary.has_attr("data-sb-sort-groups")
    headings = summary.select_one("thead").select("th")
    assert [heading.get_text() for heading in headings] == [
        "Customer", "Seller", "Territory", "Latest", "Number of notes",
    ]
    assert [heading["data-sb-sort-type"] for heading in headings] == [
        "text", "text", "text", "number", "number",
    ]
    for group, count in zip(groups, [2, 1, 1]):
        assert group.name == "tbody"
        cells = group.select_one(".topic-account-header").find_all("td", recursive=False)
        assert len(cells) == 5
        assert cells[4]["data-sb-sort-value"] == str(count)
        assert group.select_one("[data-topic-account-body] > td")["colspan"] == "5"
    for group, latest in zip(groups, [
        datetime(2026, 4, 1, 15, 45), datetime(2026, 3, 1), datetime(2026, 2, 1),
    ]):
        cell = group.select_one(".topic-account-header").find_all("td", recursive=False)[3]
        assert float(cell["data-sb-sort-value"]) == latest.timestamp()
        assert cell.time["datetime"] == latest.isoformat()
        assert cell.get_text(strip=True) == latest.strftime("%b %d, %Y")
        assert cell.time["title"] == f"Latest tagged note: {latest.strftime('%b %d, %Y')}"
    assert groups[0].select_one(".topic-account-header td")["data-sb-sort-value"] == (
        'Same "<account>"'
    )
    assert all(
        cell["data-sb-sort-value"] == ""
        for cell in groups[1].select_one(".topic-account-header").select("td")[:3]
    )
    assert all(not group.has_attr("open") and not group.has_attr("name") for group in groups)
    assert 'Same "<account>"' in groups[0].select_one(".topic-account-header").get_text()
    assert groups[0].select_one(".topic-account-header account") is None
    assert not root.select(".topic-account-link")
    assert groups[0].select_one(".topic-account-name")["href"] == f"/customer/{first_id}"
    assert groups[0].select_one("[data-topic-toggle]")["aria-expanded"] == "false"
    assert groups[0].select_one("[data-topic-account-body]").has_attr("hidden")
    assert not groups[1].select("a.topic-account-name")
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
    assert {row["data-note-id"] for row in grouped_rows} == {
        row["data-note-id"] for row in flat_rows}
    assert all(not row.select(".topic-customer,.topic-seller,.topic-territory")
               for row in grouped_rows)
    date_link = grouped_rows[0].select_one("[data-topic-preview='note']")
    assert date_link["href"] == f"/note/{expected[0]}"
    assert "Apr 01, 2026" in date_link.get_text()
    assert [int(row["data-note-id"]) for row in groups[0].select("[data-note-id]")] == [
        expected[0], expected[-1],
    ]
    keys = [table["data-sb-sort-key"] for table in root.select("table")]
    assert len(keys) == len(set(keys)) == 5
    assert len(soup.select("#topicNotePreview,#topicAccountPreview")) == 2
    assert root.select("[data-sb-sortable]") == [summary]


@pytest.mark.parametrize(
    ("content", "name", "opening", "match", "status"),
    [
        ("<p>Hello <b>team</b> &amp; friends.</p><p>Use SRE <b>Agent</b> now.</p>",
         "SRE Agent", "Hello team & friends. Use SRE Agent now.", None, "opening preview"),
        ("<p>SRE Agent overview.</p><p>SRE Agent again.</p>",
         "SRE Agent", "SRE Agent overview. SRE Agent again.", None, "opening preview"),
        ("<p>Different.</p><p>Agents are useful.</p>",
         "Agent", "Different. Agents are useful.", None, "no matching text"),
        ("<p>Intro</p><ul><li>Try sre   agent &amp; learn.</li></ul>",
         "SRE Agent", "Intro Try sre agent & learn.", None, "opening preview"),
        ("<p>&lt;img src=x onerror=alert(1)&gt;</p><p>&lt;script&gt; SRE Agent</p>",
         "SRE Agent", "<img src=x onerror=alert(1)> <script> SRE Agent", None,
         "opening preview"),
        ("<script>SRE Agent</script><p>Safe</p>", "SRE Agent", "Safe", None,
         "no matching text"),
        ("Plain intro\n\nTry C++ today.", "C++", "Plain intro Try C++ today.", None,
         "opening preview"),
        ("<p>One<br>Two</p><p>Azure</p><p>Agent</p>",
         "Azure Agent", "One Two Azure Agent", None, "no matching text"),
    ],
)
def test_given_authored_notes_when_excerpted_then_safe_bounded_context(
        content, name, opening, match, status):
    """Preserve boundaries, literal phrases and escaping without duplicating the opening."""
    result = build_topic_excerpt(content, name)
    preview = BeautifulSoup(str(result.preview), "html.parser")
    assert preview.get_text() == opening
    assert not preview.select("script,img")
    assert status in result.status
    soup = BeautifulSoup(str(result.context), "html.parser")
    if match:
        assert soup.mark.get_text() == match
    else:
        assert not soup.select("mark")
    assert not soup.select("script,img")
    assert len(preview.get_text()) <= 250
    assert len(result.flat_preview) <= 200
    assert len(soup.get_text()) <= 350


def test_given_long_opening_when_topic_is_beyond_preview_then_context_keeps_match():
    """A late first-paragraph match stays visible rather than being suppressed."""
    result = build_topic_excerpt("<p>" + "Opening words. " * 100 + "SRE Agent.</p>",
                                 "SRE Agent")
    assert len(result.preview) <= 250
    assert not result.status
    assert "<mark>SRE Agent</mark>" in result.context
    assert len(BeautifulSoup(str(result.context), "html.parser").get_text()) <= 350


def test_given_embedded_image_when_excerpted_then_image_payload_is_not_rendered():
    """Large embedded image attributes never enter either text presentation."""
    result = build_topic_excerpt(
        '<p>Opening.</p><img src="data:image/png;base64,' + 'A' * 2_000_000
        + '"><p>Discuss SRE Agent.</p>', 'SRE Agent',
    )
    assert result.preview == 'Opening. Discuss <mark>SRE Agent</mark>.'
    assert result.flat_preview == 'Opening.Discuss SRE Agent.'
    assert result.status == 'Topic mentioned in opening preview.'


@pytest.mark.parametrize("separator", ["</p><p>", "<br>", "\n\n"])
def test_given_greeting_when_previewed_then_continues_into_substantive_text(separator):
    """Short greeting blocks must not consume the entire opening preview."""
    content = "<p>Hi Stephen," + separator + "We discussed deployment blockers.</p>"

    result = build_topic_excerpt(content, "SRE Agent")

    assert result.preview == "Hi Stephen, We discussed deployment blockers."


def test_given_topic_after_preview_when_excerpted_then_keeps_paragraph_context():
    """Filling the opening preview does not lose a later topic passage."""
    content = "<p>Hi Stephen,</p><p>" + "Deployment planning. " * 30
    content += "</p><p>Next, evaluate SRE Agent.</p>"

    result = build_topic_excerpt(content, "SRE Agent")

    assert result.preview.startswith("Hi Stephen, Deployment planning.")
    assert len(result.preview) <= 250
    assert result.preview.endswith("...")
    assert result.context == "Next, evaluate <mark>SRE Agent</mark>."


@pytest.mark.parametrize(
    ("name", "text", "matches"),
    [
        ("SRE Agent", "Hi, sre agent and SRE Agent, not SRE Agents.", ["sre agent", "SRE Agent"]),
        ("C++", "Try C++ & compare <options>.", ["C++"]),
        ("Azure AI", "Azure <b>AI</b> discussion.", ["Azure AI"]),
    ],
)
def test_given_topic_in_preview_when_rendered_then_matches_are_safely_highlighted(
        name, text, matches):
    """Opening highlights preserve authored casing, phrase boundaries and escaped text."""
    result = build_topic_excerpt("<p>" + text.replace("<options>", "&lt;options&gt;") + "</p>",
                                 name)

    preview = BeautifulSoup(str(result.preview), "html.parser")
    assert [mark.get_text() for mark in preview.select("mark")] == matches
    assert not preview.select("options,b,script")
    assert len(preview.get_text()) <= 250


def test_given_customer_when_previewed_then_reuses_info_and_pipeline(client, sample_data):
    """Read-only account preview is separate from the full workspace and JSON contract."""
    customer_id = sample_data["customer1_id"]
    original = client.get(f"/api/customer/{customer_id}/info")
    assert original.is_json and original.json["id"] == customer_id
    response = client.get(f"/api/customer/{customer_id}/info?view=preview")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-topic-customer-detail]")
    assert root["data-topic-customer-detail"] == str(customer_id)
    assert "TPID" in root.get_text()
    assert not soup.select("html,script,form")
    assert client.get("/api/customer/999999/info?view=preview").status_code == 404


def test_account_preview_preserves_pipeline_metadata_and_json_contract(
        app, client, sample_data) -> None:
    """Render real pipeline relationships and due dates without changing the JSON flyout."""
    customer_id = sample_data["customer1_id"]
    due_date = datetime.combine(date.today() + timedelta(days=7), datetime.min.time())
    with app.app_context():
        customer = db.session.get(Customer, customer_id)
        customer.nickname = 'Nickname "<test>"'
        customer.dae_name = "Account executive"
        opportunities = [
            Opportunity(customer=customer, name=name, msx_opportunity_id=f"preview-{index}")
            for index, name in enumerate(["Zulu pipeline", "Alpha pipeline"])
        ]
        db.session.add_all(opportunities)
        db.session.flush()
        milestone = Milestone(
            customer=customer, opportunity=opportunities[0], title='Milestone "<test>"',
            url="https://example.com/milestone", due_date=due_date,
            msx_status="At Risk", monthly_usage=1234, workload="Data: Fabric",
        )
        db.session.add(milestone)
        db.session.commit()
        opportunity_ids = [opportunity.id for opportunity in reversed(opportunities)]
        milestone_id = milestone.id

    response = client.get(f"/api/customer/{customer_id}/info?view=preview")
    assert response.status_code == 200
    assert response.mimetype == "text/html"
    soup = BeautifulSoup(response.data, "html.parser")
    assert [int(row["data-opportunity-id"]) for row in soup.select("[data-opportunity-id]")] == (
        opportunity_ids
    )
    row = soup.select_one(f'[data-milestone-id="{milestone_id}"]')
    assert row["data-status"] == "At Risk"
    assert row.select_one("a")["href"] == f"/milestone/{milestone_id}"
    for expected in (
            'Milestone "<test>"', "Data: Fabric", "$1,234/mo", due_date.strftime("%b %d, %Y")):
        assert expected in row.get_text()
    metadata = soup.select_one(".topic-customer-metadata")
    assert 'Nickname "<test>"' in metadata.get_text()
    assert "Account executive" in metadata.get_text()
    assert metadata.select_one(f'a[href="/seller/{sample_data["seller1_id"]}"]')
    assert metadata.select_one(f'a[href="/territory/{sample_data["territory1_id"]}"]')
    assert not soup.select("test,script,form")
    original = client.get(f"/api/customer/{customer_id}/info")
    assert original.is_json and original.json["id"] == customer_id
    assert len(original.json["opportunities"]) == 2


def test_account_preview_without_pipeline_or_ownership_has_explicit_empty_state(
        app, client) -> None:
    """Optional ownership fields never prevent inspection of an otherwise empty account."""
    with app.app_context():
        customer = Customer(name='Unassigned "<account>"', tpid=900099)
        db.session.add(customer)
        db.session.commit()
        customer_id = customer.id

    response = client.get(f"/api/customer/{customer_id}/info?view=preview")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert 'Unassigned "<account>"' in soup.h3.get_text()
    assert "No opportunities for this account." in soup.get_text()
    assert [term.get_text() for term in soup.select("dt")] == ["TPID"]
    assert not soup.select("account,script,form,[data-opportunity-id]")


def test_grouped_rows_render_bounded_context_and_missing_text_states(app, client) -> None:
    """Both previews, literal highlights and honest no-match states reach actual table cells."""
    with app.app_context():
        topic = Topic(name="C++")
        contents = [
            "<p>Opening discussion. " + "Planning details. " * 30 + "</p><p>Evaluate c++.</p>",
            "<p>Try C++ today.</p>",
            "<p>Tagged for follow-up only.</p>",
            '<img src="data:image/png;base64,AAAA" alt="C++">',
        ]
        notes = [
            Note(content=content, call_date=datetime(2026, 10, index + 1))
            for index, content in enumerate(contents)
        ]
        topic.notes.extend(notes)
        db.session.add(topic)
        db.session.commit()
        topic_id = topic.id
        note_ids = [note.id for note in notes]

    root, soup = detail(client, topic_id)
    assert "0 accounts" in soup.select_one(".sb-page-status").get_text()
    group = root.select_one('[data-topic-account="unassigned"]')
    assert group.select_one(".topic-account-count").get_text() == "4 notes"
    for index, note_id in enumerate(note_ids):
        row = group.select_one(f'[data-note-id="{note_id}"]')
        cells = row.select("td")
        assert len(cells[1].get_text(strip=True)) <= 250
        assert len(cells[2].get_text(strip=True)) <= 350
        if index == 0:
            assert cells[1].get_text(strip=True).endswith("...")
            assert cells[2].mark.get_text() == "c++"
        elif index == 1:
            assert cells[1].mark.get_text() == "C++"
            assert cells[2].get_text(strip=True) == "Topic mentioned in opening preview."
        else:
            assert cells[2].get_text(strip=True) == "Topic tagged; no matching text found."
        assert not row.select("img")
    assert "No text preview available." in group.select_one(
        f'[data-note-id="{note_ids[-1]}"]'
    ).get_text()


@pytest.mark.parametrize("topic_id", ["", "invalid", "-1", "2147483647"])
def test_topic_note_preview_rejects_missing_or_invalid_topic(client, sample_data, topic_id) -> None:
    """An invalid highlight context produces a real 404, not a successful unmarked preview."""
    response = client.get(f'/api/note/{sample_data["call1_id"]}/detail?topic_id={topic_id}')
    assert response.status_code == 404


@pytest.mark.parametrize("builder", [build_topic_excerpt, highlight_note_content])
@pytest.mark.parametrize("topic_name", ["", " \t\n "])
def test_topic_text_helpers_reject_empty_phrases(builder, topic_name) -> None:
    """Empty highlight phrases fail explicitly rather than marking every text boundary."""
    with pytest.raises(ValueError, match="nonempty topic name"):
        builder("<p>Authored note.</p>", topic_name)


def test_given_rich_note_when_highlighted_then_preserves_formatting_and_attributes():
    """Highlight inline-spanning phrases, never attribute values or executable text."""
    content = (
        '<p>Try sre <strong>agent</strong> and SRE Agent, not SRE Agents.</p>'
        '<p><a href="https://example.com/SRE-Agent">SRE Agent</a>'
        '<img src="data:image/png;base64,AAAA" alt="SRE Agent"></p>'
        '<script>const text = "SRE Agent";</script>'
        '<p>SRE </p><p>Agent</p><p>&lt;options&gt; &amp; details</p>'
    )

    soup = BeautifulSoup(str(highlight_note_content(content, "SRE Agent")), "html.parser")

    assert [mark.get_text() for mark in soup.select("mark")] == [
        "sre ", "agent", "SRE Agent", "SRE Agent",
    ]
    assert soup.strong.mark.get_text() == "agent"
    assert soup.a["href"] == "https://example.com/SRE-Agent"
    assert soup.img["src"] == "data:image/png;base64,AAAA"
    assert soup.img["alt"] == "SRE Agent"
    assert soup.script.string == 'const text = "SRE Agent";'
    assert not soup.select("options")
    assert soup.select("p")[-1].get_text() == "<options> & details"


def test_given_topic_modal_when_loaded_then_only_requested_preview_is_highlighted(
        app, client, sample_data):
    """Topic highlighting is opt-in and never changes saved content or full pages."""
    note_id = sample_data["call1_id"]
    topic_id = sample_data["topic1_id"]
    with app.app_context():
        note = db.session.get(Note, note_id)
        topic = db.session.get(Topic, topic_id)
        topic.name = "SRE Agent"
        note.content = "<p>Discuss SRE <b>Agent</b> today.</p>"
        original = note.content
        db.session.commit()

    response = client.get(f"/api/note/{note_id}/detail?topic_id={topic_id}")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert len(soup.select(".call-content .topic-note-match")) == 2
    for url in (f"/api/note/{note_id}/detail", f"/note/{note_id}"):
        response = client.get(url)
        assert response.status_code == 200
        assert not BeautifulSoup(response.data, "html.parser").select(".topic-note-match")
    assert client.get(f"/api/note/{note_id}/detail?topic_id=invalid").status_code == 404
    with app.app_context():
        assert db.session.get(Note, note_id).content == original


def test_given_large_topics_when_rendered_then_queries_do_not_grow_per_note(app, client):
    """Measure isolated 50/100/250-note topics with distinct relationship data."""
    counts = []
    for size in (50, 100, 250):
        with app.app_context():
            topic = Topic(name=f"Scale {size}")
            for index in range(size):
                customer = Customer(name=f"Scale account {size}-{index}",
                                    tpid=8000000 + size * 1000 + index,
                                    seller=Seller(name=f"Scale seller {size}-{index}"),
                                    territory=Territory(name=f"Scale territory {size}-{index}"))
                note = Note(
                    customer=customer, call_date=datetime(2026, 1, 1),
                    content="<p>Opening paragraph.</p><p>" + "Meeting context. " * 100
                            + f"Scale {size} discussion.</p>",
                )
                note.partners.append(Partner(name=f"Scale partner {size}-{index}"))
                topic.notes.append(note)
            db.session.add(topic)
            db.session.commit()
            topic_id = topic.id
            queries = []

            def record_query(connection, cursor, statement, parameters, context, executemany):
                """Capture SELECT count without logging customer data."""
                if statement.lstrip().upper().startswith("SELECT"):
                    queries.append(statement)

            event.listen(db.engine, "before_cursor_execute", record_query)
            started = perf_counter()
            try:
                with patch("app.routes.topics.build_topic_excerpt",
                           wraps=build_topic_excerpt) as excerpt_builder:
                    response = client.get(f"/topic/{topic_id}")
                    assert excerpt_builder.call_count == size
            finally:
                event.remove(db.engine, "before_cursor_execute", record_query)
            elapsed = perf_counter() - started
        assert response.status_code == 200
        soup = BeautifulSoup(response.data, "html.parser")
        assert len(soup.select("[data-topic-account]")) == size
        assert len(soup.select(".topic-group-table [data-note-id]")) == size
        assert len(soup.select(".topic-group-table mark")) == size
        counts.append(len(queries))
        print(f"Topic scale: notes={size}, selects={len(queries)}, "
              f"response_ms={elapsed * 1000:.0f}, bytes={len(response.data)}")
    assert max(counts) - min(counts) <= 2


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
