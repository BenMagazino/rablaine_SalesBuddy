"""Territory workbench population, consumer and preference parity in the isolated DB."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, Note, POD, Seller, SolutionEngineer, Territory, UserPreference, db
from app.routes.main import territory_view_preference


def test_account_note_headers_and_counts_align_at_the_reading_edge() -> None:
    """Both account groups align Notes right without changing roster or date columns."""
    css = (Path(__file__).parents[1] / "static" / "css" /
           "ui-territory-detail.css").read_text(encoding="utf-8")
    assert (
        '.sb-territory-detail[data-td-mode="accounts"] .td-work '
        '.td-table :is(th, td):last-child { text-align: right; }'
    ) in css
    assert ".td-table :is(th, td) { padding: 7px 18px; text-align: left;" in css


def detail(client, id_):
    """Render the actual standalone consumer and return its native content."""
    response = client.get(f"/territory/{id_}")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-sb-territory-detail]"), soup


@pytest.mark.parametrize("accounts", [False, True])
def test_empty_frame_original_commands_preference_and_shared_helpers(app, client, accounts):
    """Both modes keep empty text, exact control names and the sole Edit command."""
    with app.app_context():
        territory = Territory(name='Territory <"safe">')
        db.session.add(territory)
        UserPreference.query.first().territory_view_accounts = accounts
        db.session.commit()
        id_ = territory.id
    root, soup = detail(client, id_)
    assert 'sb-directory-frame' in root['class']
    assert 'sb-directory-frame-wide' in root['class']
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")
    assert root["data-td-mode"] == ("accounts" if accounts else "notes")
    assert root.select_one(f'a[href="/territory/{id_}/edit"]')
    assert not root.select_one(".td-pod")
    assert "No sellers in this territory yet." in root.get_text()
    assert ("No accounts in this territory yet." if accounts else
            "No recent notes in this territory.") in root.get_text()
    radios = root.select('input[name="territoryViewToggle"]')
    assert [radio["id"] for radio in radios] == ["viewCalls", "viewAccounts"]
    assert root.select_one("input[checked]")["id"] == (
        "viewAccounts" if accounts else "viewCalls"
    )
    assert root.select_one('[data-td-notice][role="alert"]')
    assert root.select_one('[data-td-status][role="status"]')
    assert "0 sellers" in soup.select_one(".sb-page-status").get_text()
    assert not root.select(".card,.badge,.list-group,[onclick],[data-bs-toggle]")
    for name in ("ui-territory-detail.js", "ui-table-sort.js", "ui-dialog.js"):
        assert len(soup.select(f'script[src="/static/js/{name}"]')) == 1
    assert 'Territory &lt;&#34;safe&#34;&gt;' in str(soup) or '<"safe">' in root.get_text()


def test_account_scope_groups_lifetime_counts_default_order_and_seller_coverage(app, client):
    """Accounts follow seller territories, not direct customer territory or personal role."""
    with app.app_context():
        pod = POD(name="Linked POD")
        territory = Territory(name="Target", pod=pod)
        outside = Territory(name="Elsewhere")
        growth = Seller(name="Z Growth", seller_type="Growth", territories=[territory])
        acquisition = Seller(name="A Acquisition", seller_type="Acquisition",
                             territories=[territory, outside])
        unknown = Seller(name="Other type", seller_type="Other", territories=[territory])
        unrelated = Seller(name="Unassigned", seller_type="Growth", territories=[outside])
        customers = [
            Customer(name="Two notes", tpid=1, seller=growth, territory=outside),
            Customer(name="Twelve notes", tpid=2, seller=growth),
            Customer(name="Acquisition account", tpid=3, seller=acquisition),
            Customer(name="Unknown type", tpid=4, seller=unknown, territory=territory),
            Customer(name="Direct only", tpid=5, seller=unrelated, territory=territory),
            Customer(name="Zero notes", tpid=6, seller=growth),
        ]
        db.session.add_all(customers)
        db.session.flush()
        for customer, count in zip(customers[:2], [2, 12]):
            for _ in range(count):
                db.session.add(Note(customer=customer, call_date=datetime(2025, 1, 1),
                                    content="Old note"))
        pref = UserPreference.query.first()
        pref.territory_view_accounts = True
        pref.user_role = "dss"
        pref.my_seller_id = unrelated.id
        db.session.commit()
        id_, pod_id = territory.id, pod.id
        ids = [customer.id for customer in customers]
        seller_ids = [acquisition.id, unknown.id, growth.id]
    root, soup = detail(client, id_)
    assert root.select_one(f'a[href="/pod/{pod_id}"]')
    assert [int(row["data-seller-id"]) for row in root.select("[data-seller-id]")] == (
        seller_ids
    )
    assert [int(row["data-customer-id"]) for row in root.select("[data-customer-id]")] == (
        [ids[1], ids[0], ids[5], ids[2]]
    )
    counts = root.select('[data-seller-id] td:last-child')
    assert [cell["data-sb-sort-value"] for cell in counts] == ["1", "1", "3"]
    growth_table = root.select_one(f'[data-sb-sort-key="territory-{id_}-growth"]')
    assert [cell["data-sb-sort-value"] for cell in growth_table.select("td:last-child")] == (
        ["12", "2", "0"]
    )
    for customer_id in (ids[0], ids[1], ids[2], ids[5]):
        assert root.select_one(f'a[href="/customer/{customer_id}"]')
    assert len(root.select("[data-sb-sortable]")) == 3
    assert len(root.select("th[data-sb-sort-type]")) == 6
    assert [h["data-export-label"] for h in growth_table.select("th")] == ["Name", "Notes"]
    assert not root.select("[data-sb-sort-default-column]")
    assert "3 sellers · 4 accounts" in soup.select_one(".sb-page-status").get_text()


def test_recent_notes_exact_boundary_direct_scope_local_times_and_raw_keys(app, client):
    """Seven-day inclusion uses the original UTC threshold and local note-date display."""
    now = datetime(2026, 10, 7, 17, 0, tzinfo=timezone.utc)
    boundary = (now - timedelta(days=7)).replace(tzinfo=None)
    with app.app_context():
        territory = Territory(name="Target")
        other = Territory(name="Other")
        seller = Seller(name="Shared seller", territories=[territory])
        direct = Customer(name="Direct", tpid=1, seller=seller, territory=territory)
        indirect = Customer(name="Seller only", tpid=2, seller=seller, territory=other)
        rows = [
            Note(customer=direct, content="Boundary", call_date=boundary),
            Note(customer=direct, content="Earlier", call_date=boundary - timedelta(seconds=1)),
            Note(customer=direct, content="Midnight", call_date=datetime(2026, 10, 7)),
            Note(customer=direct, content="Time", call_date=datetime(2026, 10, 7, 12, 5)),
            Note(customer=indirect, content="Not direct", call_date=datetime(2026, 10, 7, 13)),
        ]
        db.session.add_all(rows)
        db.session.commit()
        id_, note_ids = territory.id, [row.id for row in rows]
    with patch("app.routes.territories.utc_now", return_value=now):
        root, soup = detail(client, id_)
    assert [int(row["data-note-id"]) for row in root.select("[data-note-id]")] == (
        [note_ids[3], note_ids[2], note_ids[0]]
    )
    dates = root.select("[data-note-id] td:last-child")
    assert dates[0].get_text(strip=True) == "Oct 07, 2026 12:05 PM"
    assert dates[1].get_text(strip=True) == "Oct 07, 2026"
    assert float(dates[0]["data-sb-sort-value"]) > float(dates[1]["data-sb-sort-value"])
    assert root.select_one(f'a[href="/note/{note_ids[3]}"]')
    assert "3 recent notes" in soup.select_one(".sb-page-status").get_text()
    assert [h["data-sb-sort-type"] for h in root.select(".td-work th")] == ["text", "number"]


def test_actual_embedded_and_standalone_link_consumers(app, client, sample_data):
    """Existing note fragment, customer, seller and directories keep canonical detail links."""
    id_ = sample_data["territory1_id"]
    with app.app_context():
        UserPreference.query.first().customer_view_grouped = True
        db.session.commit()
    paths = [
        "/territories", "/sellers", "/customers", "/notes",
        f'/seller/{sample_data["seller1_id"]}',
        f'/customer/{sample_data["customer1_id"]}',
        f'/note/{sample_data["call1_id"]}',
        f'/api/note/{sample_data["call1_id"]}/detail',
        f'/topic/{sample_data["topic1_id"]}',
    ]
    for path in paths:
        response = client.get(path)
        assert response.status_code == 200, path
        soup = BeautifulSoup(response.data, "html.parser")
        assert soup.select_one(f'a[href="/territory/{id_}"]'), path
    assert client.get("/territory/999999").status_code == 404


def test_pod_and_engineer_consumers_keep_original_territory_destinations(app, client):
    """POD and SE detail links still target the same page without redesigning their surfaces."""
    with app.app_context():
        pod = POD(name="Original POD")
        territory = Territory(name="Original territory", pod=pod)
        engineer = SolutionEngineer(name="Original SE", specialty="Azure Data", pods=[pod])
        db.session.add_all([territory, engineer])
        db.session.commit()
        id_, pod_id, engineer_id = territory.id, pod.id, engineer.id
    for path in (f"/pod/{pod_id}", f"/solution-engineer/{engineer_id}"):
        response = client.get(path)
        assert response.status_code == 200
        soup = BeautifulSoup(response.data, "html.parser")
        assert soup.select_one(f'a[href="/territory/{id_}"]')
    root, _ = detail(client, id_)
    assert root.select_one(f'a[href="/pod/{pod_id}"]')


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_detail_is_not_narrowed_by_personal_seller_context(app, client, sample_data, role):
    """Saved account mode retains org-wide territory ownership for every existing role."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.territory_view_accounts = True
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, _ = detail(client, sample_data["territory2_id"])
    assert root.select_one(f'[data-seller-id="{sample_data["seller2_id"]}"]')
    assert root.select_one(f'[data-customer-id="{sample_data["customer2_id"]}"]')


@pytest.mark.parametrize("payload, expected", [
    ({"territory_view_accounts": True}, True),
    ({"territory_view_accounts": False}, False),
    ({}, False),
])
def test_saved_preference_exact_payload_response_and_population(app, client, sample_data,
                                                               payload, expected):
    """The original explicit POST persists its single boolean and reloads the saved mode."""
    response = client.post("/api/preferences/territory-view", json=payload)
    assert response.status_code == 200
    assert response.json == {"territory_view_accounts": expected}
    with app.app_context():
        assert UserPreference.query.first().territory_view_accounts is expected
    root, _ = detail(client, sample_data["territory1_id"])
    assert root["data-td-mode"] == ("accounts" if expected else "notes")


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_preference_creation_when_missing(app, client, method):
    """Retain the original create-on-read/write behavior without loading it during live QA."""
    with app.app_context():
        UserPreference.query.delete()
        db.session.commit()
    with app.test_request_context("/api/preferences/territory-view", method=method,
                                  json={"territory_view_accounts": True}
                                  if method == "POST" else None):
        response, status = territory_view_preference()
    assert status == 200
    assert response.json == {"territory_view_accounts": method == "POST"}
    with app.app_context():
        assert UserPreference.query.count() == 1


@pytest.mark.parametrize("method, missing", [("POST", False), ("POST", True), ("GET", True)])
def test_preference_failure_rolls_back_and_returns_honest_json(app, client, method, missing):
    """Commit failure cannot leave a changed preference or silently reload another mode."""
    with app.app_context():
        if missing:
            UserPreference.query.delete()
            db.session.commit()
    with app.test_request_context("/api/preferences/territory-view", method=method,
                                  json={"territory_view_accounts": True}
                                  if method == "POST" else None):
        with patch.object(db.session, "commit", side_effect=SQLAlchemyError("Unavailable")), \
                patch.object(db.session, "rollback", wraps=db.session.rollback) as rollback:
            response, status = territory_view_preference()
        rollback.assert_called_once()
    assert status == 500
    assert "Could not" in response.json["error"]
    with app.app_context():
        pref = UserPreference.query.first()
        assert pref is None if missing else pref.territory_view_accounts is False


@pytest.mark.parametrize("payload", [None, [], "invalid"])
def test_invalid_preference_bodies_do_not_write(client, payload):
    """Malformed object shapes have a useful error rather than a route exception."""
    response = client.post("/api/preferences/territory-view", data=json.dumps(payload),
                           content_type="application/json")
    assert response.status_code == 400
    assert "object" in response.json["error"]
