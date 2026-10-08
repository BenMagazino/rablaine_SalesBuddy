"""Specialties directory parity using the actual provider and isolated records."""

from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from app.models import Partner, Specialty, UserPreference, db


def directory(client):
    """Read the standalone directory's owned native surface."""
    response = client.get("/specialties")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-specialties-directory]"), soup


def test_empty_directory_retains_original_creation_guidance(client):
    """Keep both original New destinations without adding filters or writes."""
    root, soup = directory(client)
    assert 'sb-directory-frame' in root['class']
    assert "No specialties yet." in root.get_text()
    assert [a["href"] for a in root.select("a")] == [
        "/specialties/new", "/specialties/new",
    ]
    assert "0 Specialties" in soup.select_one(".sb-page-status").get_text()
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")
    assert not root.select("table,form,input,select,dialog,.card,.btn,.badge,[onclick]")
    for script in ("ui-specialties-directory.js", "ui-table-sort.js"):
        assert len(soup.select(f'script[src="/static/js/{script}"]')) == 1
        assert soup.select_one(f'script[src="/static/js/{script}"]').has_attr("defer")
    assert not root.select("[data-bs-toggle],.container-fluid,.table-responsive")


def test_original_sql_order_descriptions_counts_and_actions(app, client):
    """Preserve SQL ordering, exact truncation, escaped identity and all partner counts."""
    with app.app_context():
        specs = [
            Specialty(name="alpha", description=None),
            Specialty(name='Zulu "<specialty>"', description="Long <description> " * 15),
            Specialty(name="Beta", description="Brief"),
        ]
        partners = [Partner(name=f"Partner {i}") for i in range(12)]
        specs[1].partners.extend(partners)
        specs[2].partners.extend(partners[:2])
        db.session.add_all(specs)
        db.session.commit()
        expected = [(s.id, s.name, s.description, len(s.partners))
                    for s in Specialty.query.order_by(Specialty.name).all()]
    root, soup = directory(client)
    rows = root.select("tbody tr")
    assert [int(row["data-specialty-id"]) for row in rows] == [s[0] for s in expected]
    for row, (identity, name, description, count) in zip(rows, expected):
        cells = row.select("td")
        assert cells[0]["data-sb-sort-value"] == name
        assert cells[0].select_one("a")["href"] == f"/specialties/{identity}"
        assert row["data-specialty-href"] == f"/specialties/{identity}"
        assert cells[1]["data-sb-sort-value"] == (description or "")
        assert cells[1].get_text(strip=True) == (
            description[:100] + ("..." if len(description) > 100 else "")
            if description else ""
        )
        if description:
            assert cells[1].select_one("span")["title"] == description
        assert cells[2]["data-sb-sort-value"] == str(count)
        assert cells[2].get_text(strip=True) == str(count)
        assert cells[3].select_one("a")["href"] == f"/specialties/{identity}/edit"
        assert cells[3].select_one("a")["aria-label"] == f"Edit {name}"
    assert [th.get("data-sb-sort-type") for th in root.select("th")] == [
        "text", "text", "number", None,
    ]
    assert [th["data-export-label"] for th in root.select("th[data-export-label]")] == [
        "Name", "Description", "Partners",
    ]
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert "3 Specialties" in soup.select_one(".sb-page-status").get_text()
    assert not root.select(".badge,.btn,.card,[data-bs-toggle]")


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_scope_is_all_specialties_and_all_associated_partners(app, client, sample_data, role):
    """Role, seller mode and unused filter query parameters cannot narrow the provider."""
    with app.app_context():
        empty = Specialty(name="Unassigned")
        used = Specialty(name="Assigned", partners=[Partner(name="No notes or customers")])
        db.session.add_all([empty, used])
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        expected = {str(s.id): len(s.partners) for s in Specialty.query.all()}
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    response = client.get("/specialties?q=missing&seller_id=999&sort=partners")
    root = BeautifulSoup(response.data, "html.parser").select_one("[data-specialties-directory]")
    assert {row["data-specialty-id"]: int(row.select("td")[-2]["data-sb-sort-value"])
            for row in root.select("tbody tr")} == expected
    assert not root.select("input,select,form")


def test_empty_descriptions_omit_only_unused_axis(app, client):
    """Name-only directories keep zero counts and explicit Edit on every row."""
    with app.app_context():
        db.session.add_all([Specialty(name="One"), Specialty(name="Two", description="")])
        db.session.commit()
    root, _ = directory(client)
    assert root.select_one("table")["data-sb-sort-key"] == "specialties-directory-brief"
    assert [th.get_text() for th in root.select("th")] == ["Name", "Partners", "Actions"]
    assert all(len(row.select("td")) == 3 for row in root.select("tbody tr"))
    assert all(row.select("td")[-2]["data-sb-sort-value"] == "0"
               for row in root.select("tbody tr"))


def test_original_navigation_and_form_cancel_consumers(app, client):
    """Existing partner command, form Cancel and canonical ancestry reach the directory."""
    with app.app_context():
        spec = Specialty(name="Navigation")
        db.session.add(spec)
        db.session.commit()
        identity = spec.id
    partners = BeautifulSoup(client.get("/partners").data, "html.parser")
    assert partners.select_one('a[href="/specialties"]')
    for url in ("/specialties/new", f"/specialties/{identity}/edit"):
        soup = BeautifulSoup(client.get(url).data, "html.parser")
        assert soup.select_one('form a[href="/specialties"]').get_text(strip=True) == "Cancel"
    _, soup = directory(client)
    trail = soup.select_one(".sb-context-bar")
    assert trail.select_one('a[href="/"]')
    assert trail.select_one('a[href="/partners"]')
    assert "Specialties" in trail.get_text()


def test_directory_help_documents_only_existing_and_native_actions(client):
    """Context help includes scope, temporary sorts, Back and unchanged initial ordering."""
    source = client.get("/static/js/page-help.js").text
    start = source.index("title: 'Specialties'")
    help_text = source[start:source.index("`}", start)]
    for phrase in ("all specialties", "Description", "Partners", "Back restores",
                   "initial order", "Edit", "New Specialty"):
        assert phrase in help_text


def test_both_table_shapes_fill_the_bounded_reading_pane() -> None:
    """Brief and description-bearing lists use the pane, not a second inner width cap."""
    css = (Path(__file__).parents[1] / "static" / "css" /
           "ui-specialties-directory.css").read_text(encoding="utf-8")
    assert ".specialties-table { width: 100%;" in css
    assert ".specialties-table-brief { width:" not in css
    assert "width: min(100%," not in css
