"""Native POD detail parity on the isolated database."""

from bs4 import BeautifulSoup

from app.models import POD, Seller, SolutionEngineer, Territory, TerritoryDSSSelection, db


def test_detail_preserves_rosters_roles_and_destinations(app, client):
    """Distinct territories, unique sellers and POD engineers retain their original scope."""
    with app.app_context():
        seller = Seller(name="Seller <test>", alias="seller", seller_type="Growth")
        cloud = SolutionEngineer(name="Cloud SE", alias="cloud", specialty="Azure Data")
        dss = SolutionEngineer(name="Single DSS", specialty="Security")
        a = Territory(name="A Territory", sellers=[seller], solution_engineers=[cloud, dss])
        z = Territory(name="Z Territory", sellers=[seller])
        pod = POD(name="POD <test>", territories=[z, a], solution_engineers=[cloud])
        db.session.add(pod)
        db.session.commit()
        ids = pod.id, seller.id, cloud.id, a.id, z.id
    response = client.get(f"/pod/{ids[0]}")
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-pod-detail]")
    assert 'sb-directory-frame' in root['class']
    assert 'sb-directory-frame-wide' in root['class']
    assert response.status_code == 200
    assert "sb-page-frame" in soup.body["class"]
    assert "POD <test>" in root.h1.text
    assert not root.select(".card,.badge,[onclick],[onchange]")
    assert len(root.select("[data-seller-id]")) == 1
    assert [int(row["data-territory-id"]) for row in root.select("[data-territory-id]")] == [
        ids[3], ids[4],
    ]
    assert root.select_one("[data-seller-id] a")["href"] == f"/seller/{ids[1]}"
    assert root.select_one("[data-se-id] a")["href"] == f"/solution-engineer/{ids[2]}"
    assert "seller@microsoft.com" in root.text
    assert "cloud@microsoft.com" in root.text
    assert root.select_one(".pd-role")["data-type"] == "growth"
    assert "Cloud SE" not in root.select_one(".pd-specialists").text
    assert "Single DSS" in root.select_one(".pd-specialists").text
    assert root.select_one(".pd-header a")["href"] == f"/pod/{ids[0]}/edit"
    assert len(root.select("table[data-sb-sortable] th[data-sb-sort-type]")) == 9
    assert all(th.get("data-export-label") for th in root.select("th"))
    assert len(root.select("[data-pd-scroll]")) == 2
    with app.app_context():
        assert TerritoryDSSSelection.query.count() == 0


def test_assignment_selected_single_and_unselected_paths(app, client):
    """Only unselected multi-specialist assignments are changeable on detail."""
    with app.app_context():
        a = SolutionEngineer(name="A DSS", specialty="Security")
        z = SolutionEngineer(name="Z DSS", specialty="Security")
        single = SolutionEngineer(name="Single", specialty="Modern Work")
        territory = Territory(name="Territory", solution_engineers=[z, a, single])
        pod = POD(name="Choices", territories=[territory])
        db.session.add(pod)
        db.session.commit()
        pod_id, territory_id, a_id, z_id = pod.id, territory.id, a.id, z.id
    path = f"/pod/{pod_id}"
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    select = soup.select_one("[data-dss-territory]")
    assert select["data-dss-territory"] == str(territory_id)
    assert select["data-dss-specialty"] == "Security"
    assert [(option["value"], option.text) for option in select.select("option")][1:] == [
        (str(a_id), "A DSS"), (str(z_id), "Z DSS"),
    ]
    assert select.select_one("option")["disabled"] == ""
    assert not soup.select_one("option").get("value")
    assert client.post(f"/territory/{territory_id}/dss-selection", json={
        "specialty": "Security", "solution_engineer_id": str(a_id),
    }).json == {"success": True, "solution_engineer_id": a_id}
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    assert not soup.select("[data-dss-territory]")
    assert "A DSS" in soup.select_one(".pd-specialists").text
    assert "Z DSS" not in soup.select_one(".pd-specialists").text


def test_empty_detail_and_missing_record(client, app):
    """All original roster empty states render without a nonexistent DSS disclosure."""
    with app.app_context():
        pod = POD(name="Empty")
        db.session.add(pod)
        db.session.commit()
        pod_id = pod.id
    soup = BeautifulSoup(client.get(f"/pod/{pod_id}").data, "html.parser")
    for text in ["No territories in this POD yet.", "No sellers in this POD yet.",
                 "No solution engineers in this POD yet."]:
        assert text in soup.text
    assert not soup.select("#podDssToggle,#dssCardBody,table[data-sb-sortable]")
    assert client.get("/pod/999999").status_code == 404
