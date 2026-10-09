"""Native POD directory parity on isolated roster and role populations."""

import pytest
from bs4 import BeautifulSoup

from app.models import POD, Seller, SolutionEngineer, Territory, UserPreference, db


def directory(client):
    """Read the unchanged all-POD provider into its native standalone consumer."""
    response = client.get("/pods")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-pods-directory]"), soup


def test_empty_directory_has_no_invented_actions(client):
    """Keep the empty message, frame and one copy of shared helpers without creation."""
    root, soup = directory(client)
    assert 'sb-directory-frame' in root['class']
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")
    assert "No PODs yet." in root.get_text()
    assert not root.select("a,form,button,.card,.badge,[onclick],[data-bs-toggle]")
    assert "0 PODs" in soup.select_one(".sb-page-status").get_text()
    for name in ("ui-pods-directory.js", "ui-table-sort.js"):
        assert len(soup.select(f'script[src="/static/js/{name}"]')) == 1


def test_complete_roster_counts_and_original_destinations(app, client):
    """Unique sellers span territories; SEs count only direct POD assignments."""
    with app.app_context():
        first, last = POD(name="A POD <coverage>"), POD(name="Z POD")
        seller_a, seller_z = Seller(name="A Seller"), Seller(name="Z Seller")
        first.territories = [
            Territory(name="One", sellers=[seller_z, seller_a]),
            Territory(name="Two", sellers=[seller_a]),
        ]
        first.solution_engineers = [
            SolutionEngineer(name="Z SE"), SolutionEngineer(name="A SE"),
        ]
        first.territories[0].solution_engineers = [
            SolutionEngineer(name="Territory-only SE"),
        ]
        db.session.add_all([last, first])
        db.session.commit()
        first_id, last_id = first.id, last.id
    root, soup = directory(client)
    rows = root.select("tbody tr")
    assert [int(row["data-pod-id"]) for row in rows] == [first_id, last_id]
    row = rows[0]
    assert row["data-pod-href"] == f"/pod/{first_id}"
    assert row.select_one("a")["aria-label"] == "View A POD <coverage>"
    assert row.select_one("a").get_text(strip=True) == "A POD <coverage>"
    assert [cell["data-sb-sort-value"] for cell in row.select(".sb-pod-count")] == [
        "2", "2",
    ]
    assert [e.get_text(strip=True) for e in row.select(".sb-pod-seller")] == [
        "A Seller", "Z Seller",
    ]
    assert [e.get_text(strip=True) for e in row.select(".sb-pod-se")] == ["A SE", "Z SE"]
    assert "Territory-only SE" not in root.get_text()
    assert len(row.select("a")) == 1
    assert [cell["data-sb-sort-value"] for cell in rows[1].select(".sb-pod-count")] == [
        "0", "0",
    ]
    assert not rows[1].select(".sb-pod-seller,.sb-pod-se")
    assert [h["data-sb-sort-type"] for h in root.select("th")] == [
        "text", "number", "number", "text", "text",
    ]
    assert [h["data-export-label"] for h in root.select("th")] == [
        "Name", "Territories", "SEs", "Sellers", "Solution Engineers",
    ]
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert "2 PODs" in soup.select_one(".sb-page-status").get_text()


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_all_pods_scope_independent_of_role(app, client, sample_data, role):
    """Personal and impersonated seller scope must never narrow this directory."""
    with app.app_context():
        db.session.add_all([POD(name="Unassigned"), POD(name="Other")])
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        count = POD.query.count()
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, _ = directory(client)
    assert len(root.select("[data-pod-id]")) == count
