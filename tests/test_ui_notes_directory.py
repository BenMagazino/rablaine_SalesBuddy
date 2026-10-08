"""Standalone Notes directory contracts, using only the isolated test database."""

from datetime import datetime, timedelta

import pytest
from bs4 import BeautifulSoup
from jinja2.filters import do_striptags, do_truncate

from app.models import Engagement, Note, Opportunity, Partner, UserPreference, db


def directory(client, url="/notes"):
    """Return the actual rendered directory and its shell."""
    response = client.get(url)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-notes-directory]"), soup


def test_empty_native_directory_keeps_existing_picker_and_zero_scope(client):
    """No new form, autosave, export or sorting surface is invented."""
    root, soup = directory(client)
    assert "No notes yet." in root.get_text()
    assert root.select_one("[data-sb-dialog]")["data-sb-dialog"] == "quickNoteModal"
    assert soup.select_one("#quickNoteModal").name == "dialog"
    assert soup.select_one("#navNewNote")["data-sb-dialog"] == "quickNoteModal"
    assert "Showing 0-0 of 0 notes" in soup.select_one(".sb-page-status").get_text()
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")["tabindex"] == "0"
    assert not root.select("table,form,dialog,.btn,.badge,.list-group,[onclick]")
    assert not root.select("[data-bs-toggle],[data-sb-sortable]")
    for asset in ("ui-notes-directory.js", "ui-dialog.js", "ui-table-sort.js"):
        scripts = soup.select(f'script[src="/static/js/{asset}"]')
        assert len(scripts) == 1
        assert scripts[0].has_attr("defer")
    assert [a.get_text() for a in root.select(".notes-filters a")] == [
        "All", "Customer", "General",
    ]
    assert [o["value"] for o in root.select("option")] == ["25", "50", "100", "200"]
    assert root.select_one("option[selected]")["value"] == "50"


def test_all_original_identity_dates_excerpts_relationships_and_links(
    app, client, sample_data,
):
    """Keep full names, role links, TPID, favicon, truncation and opportunity state."""
    with app.app_context():
        note = db.session.get(Note, sample_data["call1_id"])
        note.call_date = datetime(2026, 10, 7, 15, 38)
        note.content = "<p>" + "Escaped &amp; <strong>formatted</strong> content " * 20 + "</p>"
        note.customer.favicon_b64 = "aGVsbG8="
        note.customer.tpid_url = "https://example.invalid/account"
        partner = Partner(name='Partner "<linked>"')
        engagement = Engagement(title="Complete engagement title", customer_id=note.customer_id)
        opp = Opportunity(name="A long opportunity name that exceeds thirty characters",
                          msx_opportunity_id="notes-directory-86",
                          customer_id=note.customer_id, state="Won")
        note.partners.append(partner)
        note.engagements.append(engagement)
        note.opportunities.append(opp)
        db.session.commit()
        identity = note.id
        expected_links = {
            f"/note/{note.id}", f"/customer/{note.customer_id}", note.customer.tpid_url,
            f"/seller/{note.seller.id}", f"/territory/{note.territory.id}",
            f"/topic/{note.topics[0].id}", f"/partners/{partner.id}",
            f"/engagement/{engagement.id}", f"/opportunity/{opp.id}",
        }
        excerpt = do_truncate(app.jinja_env, do_striptags(note.content), 200, True)
        opportunity_name = opp.name
    root, _ = directory(client)
    row = root.select_one(f'[data-note-id="{identity}"]')
    assert row["data-note-href"] == f"/note/{identity}"
    assert {a["href"] for a in row.select("a")} == expected_links
    assert row.select_one(".notes-excerpt").get_text() == excerpt
    assert row.select_one("time")["datetime"] == "2026-10-07T15:38:00"
    assert row.select_one("time").get_text() == "Oct 07, 2026 03:38 PM"
    assert row.select_one(".customer-favicon")["src"] == "data:image/png;base64,aGVsbG8="
    assert row.select_one('.notes-tpid a')["target"] == "_blank"
    assert row.select_one(f'a[title="{opportunity_name}"]').get_text(" ", strip=True).endswith(
        opportunity_name[:30] + "... (Won)"
    )
    assert 'Partner "<linked>"' in row.get_text()
    assert not row.select("strong,script,.stretched-link")


def seed_chronology(app, sample_data, count=53):
    """Create mixed dated notes independently of the sample customer notes."""
    with app.app_context():
        for note in Note.query.all():
            db.session.delete(note)
        db.session.flush()
        notes = [
            Note(content=f"<p>Chronology {i:03}</p>",
                 customer_id=sample_data["customer1_id"] if i % 2 else None,
                 call_date=datetime(2026, 10, 1) + timedelta(days=i))
            for i in range(count)
        ]
        db.session.add_all(notes)
        db.session.commit()
        return [str(n.id) for n in reversed(notes)]


def test_server_order_pagination_ranges_and_original_filter_urls(app, client, sample_data):
    """Newest first is provider-wide; paging never sorts a local rich-text stream."""
    expected = seed_chronology(app, sample_data)
    root, soup = directory(client, "/notes?per_page=25&page=2")
    assert [r["data-note-id"] for r in root.select(".notes-entry")] == expected[25:50]
    assert "Showing 26-50 of 53 notes" in soup.select_one(".sb-page-status").get_text()
    assert root.select_one('.notes-pagination a[aria-current]')["href"] == (
        "/notes?per_page=25&page=2"
    )
    assert root.select_one('.notes-filters a[aria-current]')["href"] == "/notes"
    root, soup = directory(client, "/notes?filter=general&per_page=25")
    assert len(root.select(".notes-entry")) == 25
    assert not root.select(".notes-customer,.notes-tpid")
    assert root.select_one('.notes-pagination a[aria-label="Page 2"]')["href"] == (
        "/notes?filter=general&per_page=25&page=2"
    )
    assert "of 27 notes" in soup.select_one(".sb-page-status").get_text()
    root, soup = directory(client, "/notes?filter=customer&per_page=25")
    assert len(root.select(".notes-customer")) == 25
    assert "of 26 notes" in soup.select_one(".sb-page-status").get_text()
    root, soup = directory(client, "/notes?per_page=25&page=3")
    assert len(root.select(".notes-entry")) == 3
    assert "Showing 51-53 of 53 notes" in soup.select_one(".sb-page-status").get_text()
    assert root.select_one('.notes-pagination span[aria-disabled]').get_text() == "Next"


@pytest.mark.parametrize("value,expected", [("0", 10), ("37", 37), ("999", 200),
                                          ("not-a-number", 50)])
def test_provider_page_size_clamps_and_actual_selected_value(
    app, client, sample_data, value, expected,
):
    """The control reflects the provider, including supported direct URL sizes."""
    seed_chronology(app, sample_data)
    root, _ = directory(client, f"/notes?per_page={value}")
    assert root.select_one("option[selected]")["value"] == str(expected)
    assert len(root.select(".notes-entry")) == min(53, expected)


def test_out_of_range_page_keeps_total_without_impossible_range(app, client, sample_data):
    """Empty pages remain real empty results, with existing pagination and total."""
    seed_chronology(app, sample_data)
    root, soup = directory(client, "/notes?per_page=25&page=999")
    assert not root.select(".notes-entry")
    assert "Showing 0-0 of 53 notes" in soup.select_one(".sb-page-status").get_text()
    assert root.select_one(".notes-pagination")


@pytest.mark.parametrize("mode", ["se", "session", "dss"])
def test_modes_keep_customer_based_scope_and_seller_link_visibility(
    app, client, sample_data, mode,
):
    """Seller scope derives from customer ownership, not the note's seller field."""
    with app.app_context():
        note = Note(content="General scope", call_date=datetime(2026, 10, 7))
        db.session.add(note)
        pref = UserPreference.query.first()
        pref.user_role = "dss" if mode == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"] if mode == "dss" else None
        db.session.commit()
        query = Note.query
        if mode != "se":
            query = query.filter(Note.customer.has(seller_id=sample_data["seller1_id"]))
        expected = {str(n.id) for n in query.all()}
    if mode == "session":
        with client.session_transaction() as session:
            session["seller_mode_seller_id"] = sample_data["seller1_id"]
    root, soup = directory(client)
    assert {r["data-note-id"] for r in root.select(".notes-entry")} == expected
    assert bool(root.select(".notes-tag-seller")) is (mode == "se")
    assert ("Seller scope" in soup.select_one(".sb-page-status").get_text()) is (mode != "se")
    root, _ = directory(client, "/notes?filter=general")
    assert bool(root.select(".notes-entry")) is (mode == "se")


def test_midnight_date_unknown_filter_and_read_only_get(app, client):
    """Keep local call dates and unknown filter behavior; GET performs no business commit."""
    with app.app_context():
        note = Note(content="<p>General midnight note</p>", call_date=datetime(2026, 10, 7))
        db.session.add(note)
        db.session.commit()
    root, _ = directory(client, "/notes?filter=unknown&page=-5")
    assert root.select_one("time").get_text() == "Oct 07, 2026"
    assert not root.select_one("time").has_attr("data-utc")
    assert not root.select(".notes-filters [aria-current]")
    assert not root.select("form")


def test_contextual_help_keeps_unique_route_and_actual_controls(client):
    """Remove fictional filters from the existing entry, not add another help route."""
    source = client.get("/static/js/page-help.js").text
    start = source.index("title: 'Notes'")
    entry = source[start:source.index("`}", start)]
    for phrase in ("All, Customer and General", "Per page", "Back restores", "newest first",
                   "Seller mode", "Nothing saves", "not a sortable"):
        assert phrase in entry
    assert source.count("title: 'Notes'") == 1
