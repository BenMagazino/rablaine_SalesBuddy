"""Solution Engineer directory parity using isolated identities and scopes."""

import pytest
from bs4 import BeautifulSoup

from app.models import POD, SolutionEngineer, Territory, UserPreference, db


def directory(client):
    """Read the unchanged all-engineer provider and native consumer."""
    response = client.get("/solution-engineers")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-se-directory]"), soup


def test_empty_directory_preserves_message_and_no_creation(client):
    """Keep original empty state without inventing New SE or writes."""
    root, soup = directory(client)
    assert 'sb-directory-frame' in root['class']
    assert "No solution engineers yet." in root.get_text()
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")
    assert not root.select("a,form,button,.card,.badge,[onclick],[data-bs-toggle]")
    assert "0 Solution Engineers" in soup.select_one(".sb-page-status").get_text()
    for name in ("ui-se-directory.js", "ui-table-sort.js"):
        assert len(soup.select(f'script[src="/static/js/{name}"]')) == 1


def test_original_fields_order_links_and_missing_values(app, client):
    """Preserve name order, optional metadata, sorted direct PODs and exact actions."""
    with app.app_context():
        first = SolutionEngineer(name="A Engineer <identity>", alias="a_alias",
                                 specialty="Azure Apps and AI")
        first.pods = [POD(name="Z POD"), POD(name="A POD")]
        first.territories = [Territory(name="Territory only")]
        last = SolutionEngineer(name="Z Engineer")
        db.session.add_all([last, first])
        db.session.commit()
        first_id, last_id = first.id, last.id
    root, soup = directory(client)
    rows = root.select("tbody tr")
    assert [int(row["data-se-id"]) for row in rows] == [first_id, last_id]
    first = rows[0]
    assert first["data-se-href"] == f"/solution-engineer/{first_id}"
    assert [a["href"] for a in first.select("a")] == [
        f"/solution-engineer/{first_id}", f"/solution-engineer/{first_id}/edit",
    ]
    assert first.select_one("a")["aria-label"] == "View A Engineer <identity>"
    assert first.select_one(".sb-se-edit")["aria-label"] == "Edit A Engineer <identity>"
    assert [c["data-sb-sort-value"] for c in first.select("td")[:4]] == [
        "A Engineer <identity>", "a_alias@microsoft.com", "Azure Apps and AI", "A POD, Z POD",
    ]
    assert [p.get_text(strip=True) for p in first.select(".sb-se-pod")] == ["A POD", "Z POD"]
    assert "Territory only" not in root.get_text()
    assert not rows[1].select(".sb-se-email,.sb-se-specialty")
    assert rows[1].select_one(".sb-se-unassigned").get_text() == "No POD assigned"
    assert [c["data-sb-sort-value"] for c in rows[1].select("td")[1:4]] == ["", "", ""]
    assert [h["data-export-label"] for h in root.select("th")] == [
        "Name", "Email", "Specialty", "PODs", "Actions",
    ]
    assert len(root.select("th[data-sb-sort-type]")) == 4
    assert not root.select_one("th:last-child").has_attr("data-sb-sort-type")
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert "2 Solution Engineers" in soup.select_one(".sb-page-status").get_text()
    assert not root.select("form,.card,.badge,[data-bs-toggle]")


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_directory_scope_independent_of_role(app, client, sample_data, role):
    """Personal or impersonated seller scope never narrows this existing directory."""
    with app.app_context():
        db.session.add_all([SolutionEngineer(name="Unassigned"), SolutionEngineer(name="Other")])
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        count = SolutionEngineer.query.count()
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, _ = directory(client)
    assert len(root.select("[data-se-id]")) == count
