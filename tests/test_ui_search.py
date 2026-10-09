"""Search migration parity using the isolated database, never live records."""

from datetime import datetime, timezone
from unittest.mock import patch
from urllib.parse import urlencode

import pytest
from bs4 import BeautifulSoup
from jinja2.filters import do_striptags, do_truncate

from app.models import Note, Partner, UserPreference, db


def search(client, params=None):
    """Read the real Search renderer and its visible result identities."""
    response = client.get("/search", query_string=params or {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-search-workbench]")
    ids = [int(row["data-note-id"]) for row in root.select(".search-result")]
    return root, soup, ids


@pytest.fixture
def search_data(app, sample_data):
    """Mixed ownership, General notes and overlapping topics expose filter semantics."""
    with app.app_context():
        first = db.session.get(Note, sample_data["call1_id"])
        second = db.session.get(Note, sample_data["call2_id"])
        first.content = "<p>Needle &amp; <strong>migration</strong> " + "long " * 65 + "</p>"
        first.call_date = datetime(2026, 10, 2, 15, 30)
        second.content = "<p>NEEDLE storage</p>"
        second.call_date = datetime(2026, 10, 5)
        first.topics.append(second.topics[0])
        first.partners.append(Partner(name='Partner "<test>"'))
        third = Note(customer_id=sample_data["customer3_id"],
                     content="<p>needle architecture</p>", call_date=datetime(2026, 10, 6))
        general = Note(content="<p>needle general</p>", call_date=datetime(2026, 10, 7))
        general.topics.append(first.topics[0])
        db.session.add_all([third, general])
        db.session.commit()
        return {**sample_data, "third": third.id, "general": general.id}


def test_native_empty_contract_and_exact_manual_get_controls(client, sample_data):
    """The owned surface reuses native selects, without invented search features."""
    root, soup, ids = search(client)
    assert ids == []
    form = root.select_one("form")
    assert form["method"] == "GET"
    assert form["action"] == "/search"
    assert [e["name"] for e in form.select("input,select")] == [
        "q", "customer_id", "seller_id", "territory_id", "topic_ids",
    ]
    assert not form.select("[required]")
    assert form.select_one("#q")["type"] == "text"
    assert form.select_one("#topics").has_attr("multiple")
    assert form.select_one("#topics")["size"] == "3"
    assert "Any selected topic" in root.get_text()
    assert form.select_one('a[href="/search"]').get_text() == "Clear Filters"
    for name in ("customer_id", "seller_id", "territory_id"):
        assert form.select_one(f"#{name} option")["value"] == ""
    assert "Acme Corp (1001)" in form.select_one("#customer_id").get_text()
    assert "Enter search text or choose filters" in soup.select_one(".sb-page-status").get_text()
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")["tabindex"] == "0"
    assert not root.select("table,.card,.badge,.btn,.list-group,[data-bs-toggle],[onclick]")
    assert not root.select("[data-sb-sortable],[data-export-label]")
    for asset in ("ui-search.js", "ui-dialog.js", "ui-table-sort.js"):
        scripts = soup.select(f'script[src="/static/js/{asset}"]')
        assert len(scripts) == 1
        assert scripts[0].has_attr("defer")


@pytest.mark.parametrize("criterion,expected", [
    ({"q": "  NeEdLe  "}, {"call1_id", "call2_id", "third", "general"}),
    ({"q": "migration"}, {"call1_id"}),
    ({"q": "Acme Corp"}, set()),
    ({"q": "<strong>"}, {"call1_id"}),
    ({"q": "%"}, {"call1_id", "call2_id", "third", "general"}),
    ({"q": "_"}, {"call1_id", "call2_id", "third", "general"}),
    ({"customer_id": "customer1_id"}, {"call1_id"}),
    ({"seller_id": "seller1_id"}, {"call1_id", "third"}),
    ({"territory_id": "territory1_id"}, {"call1_id", "third"}),
    ({"topic_ids": "topic1_id"}, {"call1_id", "general"}),
    ({"topic_ids": "topic2_id"}, {"call1_id", "call2_id"}),
    ({"topic_ids": ["topic1_id", "topic2_id"]}, {"call1_id", "call2_id", "general"}),
    ({"topic_ids": ["topic1_id", "topic1_id"]}, {"call1_id", "general"}),
    ({"topic_ids": ["invalid", "topic1_id"]}, {"call1_id", "general"}),
    ({"q": "needle", "seller_id": "seller1_id", "territory_id": "territory1_id",
      "topic_ids": "topic2_id"}, {"call1_id"}),
    ({"customer_id": "customer1_id", "seller_id": "seller2_id"}, set()),
    ({"seller_id": "seller1_id", "territory_id": "territory2_id"}, set()),
    ({"customer_id": "999999"}, set()),
    ({"customer_id": "-1"}, set()),
    ({"q": "  "}, set()),
    ({"customer_id": "invalid", "seller_id": "invalid", "topic_ids": "invalid"}, set()),
    ({"keywords": "needle", "topic_id": "topic1_id", "customer": "customer1_id",
      "seller": "seller1_id", "filter": "general", "start_date": "2026-01-01",
      "date_from": "2026-01-01", "date_to": "2026-12-31", "role": "dss"}, set()),
    ({"q": "needle", "page": "999", "per_page": "1", "sort": "relevance",
      "end_date": "1900-01-01", "filter": "general"},
     {"call1_id", "call2_id", "third", "general"}),
])
def test_original_filter_membership_and_ignored_aliases(client, search_data, criterion, expected):
    """Exact recognized GET names, SQL wildcards, ANY topics and conjunctive scopes survive."""
    params = {
        k: [search_data.get(v, v) for v in value] if isinstance(value, list)
        else search_data.get(value, value)
        for k, value in criterion.items()
    }
    _, _, ids = search(client, urlencode(params, doseq=True))
    assert set(ids) == {search_data[key] for key in expected}
    assert len(ids) == len(set(ids))


def test_original_grouping_order_fields_excerpts_and_destinations(app, client, search_data):
    """Seller insertion order follows newest note; customer and note order are unchanged."""
    root, soup, ids = search(client, {"q": "needle"})
    assert ids == [
        search_data["general"], search_data["third"],
        search_data["call1_id"], search_data["call2_id"],
    ]
    assert [g["data-customer-id"] for g in root.select(".search-customer")] == [
        "0", str(search_data["customer3_id"]), str(search_data["customer1_id"]),
        str(search_data["customer2_id"]),
    ]
    assert "No Seller Assigned" in root.get_text()
    assert "No Customer Assigned" in root.get_text()
    assert "Found 4 note(s)" in soup.select_one(".sb-page-status").get_text()
    row = root.select_one(f'[data-note-id="{search_data["call1_id"]}"]')
    with app.app_context():
        note = db.session.get(Note, search_data["call1_id"])
        expected = do_truncate(app.jinja_env, do_striptags(note.content), 200, True)
    assert row.select_one(".search-excerpt").get_text() == expected
    assert row["href"] == f'/note/{search_data["call1_id"]}'
    assert row.select_one("time")["datetime"] == "2026-10-02T15:30:00"
    assert row.select_one("time").get_text() == "Oct 02, 2026 03:30 PM"
    second = root.select_one(f'[data-note-id="{search_data["call2_id"]}"]')
    assert second.select_one("time").get_text() == "Oct 05, 2026"
    assert 'Partner "<test>"' in row.get_text()
    assert "West Region" in row.get_text()
    assert "Azure VM" in row.get_text() and "Storage" in row.get_text()
    assert not row.select("strong,script")
    assert root.select_one('a[href="https://example.com/acme"]')["target"] == "_blank"
    for route, key in (("customer", "customer1_id"), ("seller", "seller1_id")):
        assert root.select_one(f'a[href="/{route}/{search_data[key]}"]')


def test_multiple_notes_keep_newest_customer_order_and_inner_note_order(app, client, search_data):
    """Grouping is not a global relevance ranking or client-side date sort."""
    with app.app_context():
        latest = Note(customer_id=search_data["customer1_id"], content="needle latest",
                      call_date=datetime(2026, 10, 8))
        db.session.add(latest)
        db.session.commit()
        latest_id = latest.id
    root, _, ids = search(client, {"q": "needle"})
    assert ids == [
        latest_id, search_data["call1_id"], search_data["third"],
        search_data["general"], search_data["call2_id"],
    ]
    assert [g["data-customer-id"] for g in root.select(".search-customer")] == [
        str(search_data["customer1_id"]), str(search_data["customer3_id"]),
        "0", str(search_data["customer2_id"]),
    ]
    assert root.select_one(".search-customer h3 small").get_text() == "2 notes"


@pytest.mark.parametrize("role,session_mode,linked", [
    ("se", False, False), ("se", True, False), ("dss", False, True),
    ("dss", True, True), ("dss", False, False),
])
def test_roles_force_original_customer_owned_scope_and_hide_seller(
    app, client, search_data, role, session_mode, linked,
):
    """DSS preference identity wins over session and malicious URL seller overrides."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.user_role = role
        pref.my_seller_id = search_data["seller1_id"] if linked else None
        db.session.commit()
    if session_mode:
        with client.session_transaction() as sess:
            sess["seller_mode_seller_id"] = (
                search_data["seller2_id"] if linked else search_data["seller1_id"]
            )
    scoped = session_mode or linked
    root, _, ids = search(client, {"q": "needle", "seller_id": search_data["seller2_id"]})
    assert set(ids) == (
        {search_data["call1_id"], search_data["third"]} if scoped
        else {search_data["call2_id"]}
    )
    assert bool(root.select_one("#seller_id")) is not scoped
    assert bool(root.select_one(".search-seller-heading")) is not scoped
    _, _, reset_ids = search(client)
    assert set(reset_ids) == (
        {search_data["call1_id"], search_data["third"]} if scoped else set()
    )
    if scoped:
        _, _, conflict = search(client, {"customer_id": search_data["customer2_id"]})
        assert conflict == []


def test_history_fields_links_timestamps_and_criteria_gate(client, search_data):
    """Both existing history providers retain every item and are called only without criteria."""
    moment = datetime(2026, 10, 7, 18, 0, tzinfo=timezone.utc)
    item = {"name": 'History "<name>"', "url": "/customer/123",
            "customer_name": "Complete customer name", "viewed_at": moment,
            "updated_at": moment}
    groups = {"customer": {"label": "Customers", "icon": "bi-building",
                           "color": "info", "items": [item]}}
    with patch("app.routes.main._get_recently_viewed", return_value=groups) as viewed, \
            patch("app.routes.main._get_recently_updated", return_value=groups) as updated:
        root, _, _ = search(client)
        assert viewed.call_count == updated.call_count == 1
        assert [h.get_text() for h in root.select(".search-history h2")] == [
            "Recently Viewed", "Recently Updated",
        ]
        assert [g["data-tone"] for g in root.select(".search-history-group")] == [
            "info", "info",
        ]
        links = root.select(".search-history-link")
        assert len(links) == 2
        for link in links:
            assert link["href"] == "/customer/123"
            assert 'History "<name>"' in link.get_text()
            assert "Complete customer name" in link.get_text()
            assert link.select_one("time")["data-utc"] == "2026-10-07T18:00:00Z"
        root, _, _ = search(client, {"q": "no such notes"})
        assert viewed.call_count == updated.call_count == 1
        assert not root.select(".search-history")
        assert "No notes match your search criteria." in root.get_text()


def test_read_only_get_and_original_error_paths(app, client, search_data):
    """No Search writes exist; provider failures must not become successful empty searches."""
    with app.app_context():
        count = Note.query.count()
    assert client.post("/search", data={"q": "needle"}).status_code == 405
    search(client, {"q": "needle"})
    with app.app_context():
        assert Note.query.count() == count
    with patch("app.routes.main._get_recently_viewed", side_effect=RuntimeError("read failed")):
        with pytest.raises(RuntimeError, match="read failed"):
            client.get("/search")


def test_embed_consumer_keeps_results_without_full_navigation(client, search_data):
    """The existing shared-base embed query remains a read-only renderer."""
    root, soup, ids = search(client, {"q": "needle", "embed": "1"})
    assert set(ids) == {
        search_data["general"], search_data["third"],
        search_data["call1_id"], search_data["call2_id"],
    }
    assert not soup.select(".sb-app-bar,.sb-context-bar")
    assert root.select_one("form")["action"] == "/search"


def test_selected_values_and_exact_topic_list_retention(client, search_data):
    """Repeated topic controls and stripped text re-render from the unchanged provider."""
    params = {"q": "  needle  ", "customer_id": search_data["customer1_id"],
              "seller_id": search_data["seller1_id"],
              "territory_id": search_data["territory1_id"],
              "topic_ids": [search_data["topic1_id"], search_data["topic2_id"]]}
    root, _, _ = search(client, urlencode(params, doseq=True))
    assert root.select_one("#q")["value"] == "needle"
    for name in ("customer_id", "seller_id", "territory_id"):
        assert root.select_one(f"#{name} option[selected]")["value"] == str(params[name])
    assert [o["value"] for o in root.select("#topics option[selected]")] == [
        str(search_data["topic1_id"]), str(search_data["topic2_id"]),
    ]
