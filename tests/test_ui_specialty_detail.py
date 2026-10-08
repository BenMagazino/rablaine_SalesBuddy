"""Specialty detail parity, actual consumers and isolated relationship-safe deletion."""

from pathlib import Path
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Note, Partner, PartnerContact, Specialty, UserPreference, db


def detail(client, identity):
    """Read the standalone specialty detail."""
    response = client.get(f"/specialties/{identity}")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-specialty-detail]"), soup


def test_partner_table_fills_the_bounded_reading_pane() -> None:
    """Partner rows use the content pane rather than a redundant inner table cap."""
    css = (Path(__file__).parents[1] / "static" / "css" /
           "ui-specialty-detail.css").read_text(encoding="utf-8")
    assert ".specialty-table { width: 100%;" in css
    assert "width: min(100%," not in css


def records(app, sample_data):
    """Create associated partners with real note/contact/rating context in isolation."""
    with app.app_context():
        specialty = Specialty(name='Specialty "<name>"', description="Full description\n" * 30)
        other = Specialty(name="Other")
        partners = [Partner(name="Zulu", rating=0), Partner(name="alpha", rating=None),
                    Partner(name='Beta "<partner>"', rating=5, favicon_b64="aGVsbG8=")]
        specialty.partners.extend(partners)
        other.partners.append(partners[0])
        partners[0].contacts.extend([PartnerContact(name=f"Contact {i}") for i in range(12)])
        partners[1].contacts.append(PartnerContact(name="One contact"))
        partners[0].notes.append(db.session.get(Note, sample_data["call1_id"]))
        db.session.add_all([specialty, other])
        db.session.commit()
        return specialty.id, other.id, [partner.id for partner in partners]


def test_empty_commands_and_native_owned_surface(app, client):
    """Preserve empty state, title, exact routes and one copy of shared native scripts."""
    with app.app_context():
        specialty = Specialty(name='Empty "<specialty>"')
        db.session.add(specialty)
        db.session.commit()
        identity = specialty.id
    root, soup = detail(client, identity)
    assert 'sb-directory-frame' in root['class']
    assert 'Empty "<specialty>"' in root.h1.get_text()
    assert "No partners have this specialty yet" in root.get_text()
    assert root.select_one("a")["href"] == f"/specialties/{identity}/edit"
    assert root.select_one("form")["action"] == f"/specialties/{identity}/delete"
    assert root.select_one("form")["method"] == "post"
    assert root.select_one("dialog [autofocus]").get_text() == "Cancel"
    assert "will not delete the partners themselves" in root.select_one("dialog").get_text()
    assert not root.select("table,.specialty-description,.card,.badge,.btn,[data-bs-toggle]")
    assert "0 Partners" in soup.select_one(".sb-page-status").get_text()
    assert "sb-page-frame" in soup.body["class"]
    for script in ("ui-specialty-detail.js", "ui-table-sort.js", "ui-dialog.js"):
        assert len(soup.select(f'script[src="/static/js/{script}"]')) == 1
    assert client.get("/specialties/999999").status_code == 404
    assert client.get(f"/specialties/{identity}/delete").status_code == 405


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_original_scope_name_order_values_and_relationships(app, client, sample_data, role):
    """Keep all partners regardless of role, full description and raw count sort keys."""
    identity, _, ids = records(app, sample_data)
    with app.app_context():
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, soup = detail(client, identity)
    assert root.select_one(".specialty-description p").get_text() == "Full description\n" * 30
    rows = root.select("tbody tr")
    assert [int(row["data-partner-id"]) for row in rows] == [ids[1], ids[2], ids[0]]
    assert [th["data-export-label"] for th in root.select("th")] == [
        "Name", "Contacts", "Notes",
    ]
    assert [th["data-sb-sort-type"] for th in root.select("th")] == [
        "text", "number", "number",
    ]
    assert "3 Partners" in soup.select_one(".sb-page-status").get_text()
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert not root.select(".card,.badge,.btn,[onclick],[data-bs-toggle]")
    for row, count, notes in zip(rows, [1, 0, 12], [0, 0, 1]):
        cells = row.select("td")
        destination = f'/partners/{row["data-partner-id"]}'
        assert row["data-specialty-partner-href"] == destination
        assert cells[0].a["href"] == destination
        assert cells[1]["data-sb-sort-value"] == str(count)
        assert cells[2]["data-sb-sort-value"] == str(notes)
    assert rows[0].select("td")[1].get_text() == "1 contact"
    assert rows[1].select("td")[1].get_text() == ""
    assert rows[2].select("td")[1].get_text() == "12 contacts"
    assert rows[1].select_one("img")["src"] == "data:image/png;base64,aGVsbG8="


@pytest.mark.parametrize("failure", [None, "delete", "commit"])
def test_delete_success_and_failures_preserve_partner_records(
        app, client, sample_data, failure):
    """Rollback preserves every association; success removes only this specialty."""
    identity, other_id, ids = records(app, sample_data)
    with patch("app.routes.partners.logger.exception") as logger:
        if failure:
            with patch(f"app.routes.partners.db.session.{failure}",
                       side_effect=SQLAlchemyError("isolated failure")):
                response = client.post(f"/specialties/{identity}/delete")
            logger.assert_called_once()
        else:
            response = client.post(f"/specialties/{identity}/delete")
            logger.assert_not_called()
    assert response.status_code == 302
    assert response.headers["Location"] == (
        f"/specialties/{identity}" if failure else "/specialties")
    rendered = client.get(response.headers["Location"]).text
    assert ("Could not delete the specialty." if failure else "deleted successfully") in rendered
    with app.app_context():
        assert (db.session.get(Specialty, identity) is not None) is bool(failure)
        for partner_id in ids:
            partner = db.session.get(Partner, partner_id)
            assert partner is not None
            assert (identity in [s.id for s in partner.specialties]) is bool(failure)
        partner = db.session.get(Partner, ids[0])
        assert [s.id for s in partner.specialties if s.id != identity] == [other_id]
        assert len(partner.contacts) == 12
        assert partner.notes[0].id == sample_data["call1_id"]
        assert partner.rating == 0
        assert db.session.get(Partner, ids[2]).rating == 5


def test_actual_directory_detail_forms_and_breadcrumb_consumers(app, client, sample_data):
    """Preserve source links, partner rating context and exact successful form redirects."""
    identity, _, ids = records(app, sample_data)
    destination = f"/specialties/{identity}"
    for path in ("/specialties", "/partners", f"/partners/{ids[0]}"):
        soup = BeautifulSoup(client.get(path).data, "html.parser")
        assert soup.select_one(f'a[href="{destination}"]')
    _, soup = detail(client, identity)
    trail = soup.select_one(".sb-context-bar")
    assert [a["href"] for a in trail.select("a")] == ["/", "/partners", "/specialties"]
    response = client.post(f"/specialties/{identity}/edit",
                           data={"name": "Updated", "description": "Kept"})
    assert response.headers["Location"] == destination
    assert "Updated" in client.get(destination).text
    response = client.post("/specialties/new", data={"name": "New", "description": ""})
    assert response.status_code == 302
    assert BeautifulSoup(client.get(response.headers["Location"]).data,
                         "html.parser").select_one("[data-specialty-detail]")
