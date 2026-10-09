"""Internal Contacts native directory parity with isolated business records."""

from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup

from app.models import InternalContact, NoteAttendee, UserPreference, db


def directory(client):
    """Read the unchanged all-contact provider and its native consumer."""
    response = client.get("/internal-contacts")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-ic-directory]"), soup


def test_empty_directory_commands_and_native_shell(client):
    """Retain original creation guidance without inventing filters or detail routes."""
    root, soup = directory(client)
    assert 'sb-directory-frame' in root['class']
    assert "No internal contacts yet." in root.get_text()
    assert "created automatically when you add attendees to notes" in root.get_text()
    assert [a["href"] for a in root.select("a")] == [
        "/internal-contacts/new", "/internal-contacts/new",
    ]
    assert "sb-page-frame" in soup.body["class"]
    assert "0 Internal Contacts" in soup.select_one(".sb-page-status").get_text()
    assert root.select_one("[data-sb-page-body]")
    assert not root.select("table,.card,.badge,[onclick],[onsubmit],[data-bs-toggle]")
    assert not root.select("input,select")
    for script in ("ui-internal-contacts-directory.js", "ui-table-sort.js", "ui-dialog.js"):
        assert len(soup.select(f'script[src="/static/js/{script}"]')) == 1


def test_identity_order_fields_actions_and_missing_values(app, client):
    """Preserve identities, raw values, exact routes and original name ordering."""
    with app.app_context():
        first = InternalContact(name='A Person "<identity>"', alias="a_alias",
                                role="DSE - Security")
        last = InternalContact(name="Z Person")
        db.session.add_all([last, first])
        db.session.commit()
        first_id, last_id = first.id, last.id
    root, soup = directory(client)
    rows = root.select("tbody tr")
    assert [int(row["data-ic-id"]) for row in rows] == [first_id, last_id]
    assert rows[0]["data-ic-href"] == f"/internal-contacts/{first_id}/edit"
    assert rows[0].select_one("a")["aria-label"] == 'Edit A Person "<identity>"'
    assert rows[0].select_one("a")["href"] == f"/internal-contacts/{first_id}/edit"
    delete = rows[0].select_one("[data-ic-delete-url]")
    assert delete["data-ic-delete-url"] == f"/internal-contacts/{first_id}/delete"
    assert delete["data-ic-delete-name"] == 'A Person "<identity>"'
    assert delete["type"] == "button"
    assert [c["data-sb-sort-value"] for c in rows[0].select("td")[:3]] == [
        'A Person "<identity>"', "a_alias@microsoft.com", "DSE - Security",
    ]
    assert [c["data-sb-sort-value"] for c in rows[1].select("td")[1:3]] == ["", ""]
    assert rows[1].select_one(".ic-unset").get_text() == "Not set"
    assert not rows[1].select(".ic-role")
    assert [h["data-export-label"] for h in root.select("th")] == [
        "Name", "Alias", "Role", "Actions",
    ]
    assert len(root.select("th[data-sb-sort-type]")) == 3
    assert not root.select_one("th:last-child").has_attr("data-sb-sort-type")
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert "2 Internal Contacts" in soup.select_one(".sb-page-status").get_text()
    dialog = root.select_one("dialog")
    assert dialog.select_one("form")["method"] == "post"
    assert "note attendee references will be converted to external attendees" in dialog.get_text()
    assert len(root.select("dialog")) == 1
    assert not root.select(".card,.badge,[onsubmit],[data-bs-toggle]")


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_directory_retains_all_contacts_in_every_scope(app, client, sample_data, role):
    """Roles and seller impersonation never narrow the existing provider."""
    with app.app_context():
        db.session.add_all([InternalContact(name="Other"), InternalContact(name="Unassigned")])
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        count = InternalContact.query.count()
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, _ = directory(client)
    assert len(root.select("[data-ic-id]")) == count


def test_failed_delete_rolls_back_contact_and_attendee(app, client, sample_data):
    """Failed writes retain original identity and references with an honest response."""
    with app.app_context():
        contact = InternalContact(name="Keep Person", alias="keep", role="DAE")
        db.session.add(contact)
        db.session.flush()
        attendee = NoteAttendee(note_id=sample_data["call1_id"], internal_contact_id=contact.id)
        db.session.add(attendee)
        db.session.commit()
        contact_id, attendee_id = contact.id, attendee.id
    with patch("app.routes.internal_contacts.db.session.commit",
               side_effect=RuntimeError("isolated commit failure")):
        response = client.post(f"/internal-contacts/{contact_id}/delete")
    assert response.status_code == 503
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one(f'[data-ic-id="{contact_id}"]')
    assert b"Could not delete this internal contact" in response.data
    assert soup.select_one('[aria-current="page"]').get_text(strip=True).endswith(
        "Internal Contacts"
    )
    with app.app_context():
        assert db.session.get(InternalContact, contact_id).name == "Keep Person"
        attendee = db.session.get(NoteAttendee, attendee_id)
        assert attendee.internal_contact_id == contact_id
        assert attendee.external_name is None
        assert attendee.external_email is None


def test_delete_is_post_only(client):
    """No live read or accidental navigation can delete a contact."""
    assert client.get("/internal-contacts/99999/delete").status_code == 405
