"""POD edit parity and territory-scoped writes on the isolated test database."""

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import POD, SolutionEngineer, Territory, TerritoryDSSSelection, db


@pytest.fixture
def assignments(app):
    """Create sorted, selected, automatic and excluded assignments."""
    with app.app_context():
        a = SolutionEngineer(name="A DSS", specialty="Security")
        z = SolutionEngineer(name="Z DSS", specialty="Security")
        single = SolutionEngineer(name="Single DSS", specialty="Modern Work")
        cloud = SolutionEngineer(name="Cloud SE", specialty="Azure Data")
        territory = Territory(name="A Territory", solution_engineers=[z, single, a, cloud])
        pod = POD(name="POD <test>", territories=[territory], solution_engineers=[cloud])
        db.session.add(pod)
        db.session.commit()
        return {"pod": pod.id, "territory": territory.id, "a": a.id, "z": z.id}


def test_existing_edit_contract(client, assignments):
    """Identity stays synced; only multiple specialist choices are editable."""
    response = client.get(f'/pod/{assignments["pod"]}/edit')
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("#podForm")
    assert 'sb-directory-frame' in root['class']
    assert 'sb-directory-frame-wide' in root['class']
    assert response.status_code == 200
    assert "sb-page-frame" in soup.body["class"]
    assert not root.select("form,input,.card,.badge,[onchange],[onclick]")
    assert "POD <test>" in root.get_text()
    assert "Single DSS" in root.get_text()
    assert "Cloud SE" not in soup.select_one(".pod-edit-assignments").get_text()
    select = root.select_one("select")
    assert select["data-dss-territory"] == str(assignments["territory"])
    assert select["data-dss-specialty"] == "Security"
    assert [(o.get("value"), o.text) for o in select.select("option")] == [
        ("", "None"), (str(assignments["a"]), "A DSS"), (str(assignments["z"]), "Z DSS"),
    ]
    assert root.select_one("[data-pod-back]")["href"] == f'/pod/{assignments["pod"]}'
    assert "Changes save automatically" in root.get_text()
    assert client.post(f'/pod/{assignments["pod"]}/edit').status_code == 405
    assert client.get("/pod/new").status_code == 404


def test_selected_and_single_override_preserved(app, client, assignments):
    """Selected IDs and single explicit choices retain original dropdown behavior."""
    with app.app_context():
        territory = db.session.get(Territory, assignments["territory"])
        single = next(se for se in territory.solution_engineers if se.specialty == "Modern Work")
        db.session.add_all([
            TerritoryDSSSelection(territory_id=territory.id, specialty="Security",
                                  solution_engineer_id=assignments["z"]),
            TerritoryDSSSelection(territory_id=territory.id, specialty="Modern Work",
                                  solution_engineer_id=single.id),
        ])
        db.session.commit()
        single_id = single.id
    soup = BeautifulSoup(client.get(f'/pod/{assignments["pod"]}/edit').data, "html.parser")
    choices = soup.select("#podForm select")
    assert [s["data-dss-specialty"] for s in choices] == ["Modern Work", "Security"]
    assert [s.select_one("option[selected]")["value"] for s in choices] == [
        str(single_id), str(assignments["z"]),
    ]


def test_empty_form_has_safe_disclosure_absence(app, client):
    """No DSS, territory or SE population must not cause initialization errors."""
    with app.app_context():
        pod = POD(name="Empty")
        db.session.add(pod)
        db.session.commit()
        pod_id = pod.id
    soup = BeautifulSoup(client.get(f"/pod/{pod_id}/edit").data, "html.parser")
    assert not soup.select("#podForm select,#podDssToggle")
    assert "No territories assigned." in soup.get_text()
    assert "No solution engineers assigned." in soup.get_text()
    assert "No specialist assignments" in soup.get_text()


@pytest.mark.parametrize("value", ["not-an-id", {}, [], True, 1.5])
def test_invalid_id_honest_error(client, assignments, value):
    """Invalid JSON values fail without writing instead of raising an unhandled error."""
    response = client.post(f'/territory/{assignments["territory"]}/dss-selection',
                           json={"specialty": "Security", "solution_engineer_id": value})
    assert response.status_code == 400
    assert response.json["success"] is False


@pytest.mark.parametrize("payload", [[{"specialty": "Security"}], {"specialty": None},
                                   {"specialty": ["Security"]}])
def test_invalid_payload_honest_error(client, assignments, payload):
    """Wrong JSON shapes and specialty types retain the API error contract."""
    response = client.post(f'/territory/{assignments["territory"]}/dss-selection',
                           json=payload)
    assert response.status_code == 400
    assert response.json["success"] is False


def test_autosave_success_clear_and_failure_rollback(app, client, assignments, monkeypatch):
    """Existing exact API succeeds and failed writes roll back the prior selection."""
    path = f'/territory/{assignments["territory"]}/dss-selection'
    assert client.post(path, json={"specialty": "Security",
                                  "solution_engineer_id": str(assignments["a"])}).json == {
        "success": True, "solution_engineer_id": assignments["a"],
    }
    with app.app_context():
        def fail_commit():
            """Simulate a storage failure after the model assignment."""
            raise SQLAlchemyError("isolated failure")

        with monkeypatch.context() as patch:
            patch.setattr(db.session, "commit", fail_commit)
            response = client.post(path, json={"specialty": "Security",
                                              "solution_engineer_id": str(assignments["z"])})
            assert response.status_code == 500
            assert response.json["success"] is False
        assert TerritoryDSSSelection.query.one().solution_engineer_id == assignments["a"]
    assert client.post(path, json={"specialty": "Security",
                                  "solution_engineer_id": None}).json["success"] is True
    with app.app_context():
        assert TerritoryDSSSelection.query.count() == 0
