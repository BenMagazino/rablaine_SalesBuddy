"""Solution Engineer detail parity and deletion on the isolated database."""

from unittest.mock import patch

from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, Milestone, Note, NoteAttendee, POD, Seller
from app.models import SolutionEngineer, Territory, db


def test_identity_coverage_scope_and_complete_partial(app, client):
    """Shared POD coverage deduplicates territories, retaining their full customer counts."""
    with app.app_context():
        seller = Seller(name="Seller")
        a = Territory(name="A territory")
        z = Territory(name="Z territory")
        direct = Territory(name="Direct only")
        pods = [POD(name="Z POD", territories=[z, a]), POD(name="A POD", territories=[a])]
        se = SolutionEngineer(name="Engineer <test>", alias="alias", specialty="Azure Data",
                              pods=pods, territories=[direct])
        customers = [Customer(name=f"Customer {index}", tpid=9000 + index,
                              territory=a, seller=seller)
                     for index in range(12)]
        db.session.add_all([se, *customers])
        db.session.commit()
        se_id, a_id, z_id = se.id, a.id, z.id
        original = se.created_at
    response = client.get(f"/solution-engineer/{se_id}")
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-se-detail]")
    assert 'sb-directory-frame' in root['class']
    assert 'sb-directory-frame-wide' in root['class']
    assert response.status_code == 200
    assert "sb-page-frame" in soup.body["class"]
    assert root.h1.text == "Engineer <test>"
    assert root.select_one('a[href="mailto:alias@microsoft.com"]')
    assert root.select_one(".sed-specialty").text == "Azure Data"
    assert [int(row["data-territory-id"]) for row in root.select("[data-territory-id]")] == [
        a_id, z_id,
    ]
    assert [cell["data-sb-sort-value"] for cell in root.select(
        ".sed-territories tbody tr td:nth-child(2)"
    )] == ["12", "0"]
    assert "Direct only" not in root.text
    assert "12 customers" in root.text
    assert [row.a.text.strip() for row in root.select("[data-pod-id]")] == ["A POD", "Z POD"]
    assert not root.select(".card,.badge,.btn,[onclick],[data-bs-toggle]")
    assert len(root.select("th[data-sb-sort-type]")) == 3
    assert all(th.get("data-export-label") for th in root.select("th"))
    assert root.select_one('a[href$="/edit"]')["href"] == f"/solution-engineer/{se_id}/edit"
    assert root.select_one("form")["action"] == f"/solution-engineer/{se_id}/delete"
    assert root.select_one("form")["method"] == "POST"
    assert root.select_one("[autofocus]").text == "Cancel"
    assert len(soup.select('script[src$="ui-se-detail.js"]')) == 1
    assert len(soup.select('script[src$="ui-table-sort.js"]')) == 1
    assert len(soup.select('script[src$="ui-dialog.js"]')) == 1
    with app.app_context():
        se = db.session.get(SolutionEngineer, se_id)
        with app.test_request_context():
            fragment = BeautifulSoup(app.jinja_env.get_template(
                "partials/solution_engineer_view_content.html"
            ).render(solution_engineer=se,
                pods=sorted(se.pods, key=lambda pod: pod.name),
                territories=[db.session.get(Territory, a_id), db.session.get(Territory, z_id)],
            ), "html.parser")
        assert fragment.select_one("[data-se-detail]").decode() == root.decode()
        assert fragment.select_one('script[src$="ui-se-detail.js"]')
        assert se.created_at == original
        assert [territory.name for territory in se.territories] == ["Direct only"]
        assert Customer.query.count() == 12 and Seller.query.count() == 1


def test_original_empty_states(client, app):
    """No PODs and assigned PODs without territories remain distinct empty states."""
    with app.app_context():
        se = SolutionEngineer(name="Empty")
        pod_se = SolutionEngineer(name="POD only", pods=[POD(name="Empty POD")])
        db.session.add_all([se, pod_se])
        db.session.commit()
        ids = se.id, pod_se.id
    soup = BeautifulSoup(client.get(f"/solution-engineer/{ids[0]}").data, "html.parser")
    assert len(soup.select(".sed-empty")) == 2
    assert not soup.select_one("[data-se-detail]").select(".sed-identity,table")
    assert "Not assigned to any PODs" in soup.text
    assert "No territories in assigned PODs" in client.get(
        f"/solution-engineer/{ids[1]}"
    ).text
    assert client.get("/solution-engineer/999999").status_code == 404
    assert client.get(f"/solution-engineer/{ids[0]}/delete").status_code == 405


def test_delete_success_and_failed_commit_preserve_associations(app, client):
    """A failed delete rolls back all relationships; a successful retry keeps related records."""
    with app.app_context():
        pod = POD(name="POD")
        territory = Territory(name="Direct")
        se = SolutionEngineer(name="Delete me", pods=[pod], territories=[territory])
        other = SolutionEngineer(name="Keep me", pods=[pod])
        db.session.add_all([se, other])
        db.session.commit()
        se_id, pod_id, territory_id = se.id, pod.id, territory.id
    path = f"/solution-engineer/{se_id}/delete"
    with patch.object(db.session, "commit", side_effect=SQLAlchemyError("isolated failure")):
        response = client.post(path)
    assert response.status_code == 500
    assert "No changes were saved. Try again." in response.text
    assert BeautifulSoup(response.data, "html.parser").select_one("form")["action"] == path
    with app.app_context():
        se = db.session.get(SolutionEngineer, se_id)
        assert [pod.id for pod in se.pods] == [pod_id]
        assert [territory.id for territory in se.territories] == [territory_id]
        assert SolutionEngineer.query.count() == 2
    response = client.post(path)
    assert response.status_code == 302
    assert response.headers["Location"] == "/solution-engineers"
    with app.app_context():
        assert db.session.get(SolutionEngineer, se_id) is None
        assert SolutionEngineer.query.one().name == "Keep me"
        assert POD.query.count() == Territory.query.count() == 1


def test_actual_note_and_milestone_consumers(app, client, sample_data):
    """Full and loaded note/milestone owner contexts retain the same native detail destination."""
    with app.app_context():
        se = SolutionEngineer(name="Matched engineer", alias="matched")
        milestone = Milestone(title="Owned", owner_name="Matched engineer",
                              url="https://example.com/milestone")
        db.session.add_all([se, milestone])
        db.session.flush()
        note = db.session.get(Note, sample_data["call1_id"])
        note.attendees.append(NoteAttendee(solution_engineer_id=se.id))
        db.session.commit()
        target, milestone_id, note_id = f"/solution-engineer/{se.id}", milestone.id, note.id
    for path in [f"/note/{note_id}", f"/api/note/{note_id}/detail",
                 f"/milestone/{milestone_id}", f"/api/milestone/{milestone_id}/detail"]:
        response = client.get(path)
        assert response.status_code == 200, path
        assert BeautifulSoup(response.data, "html.parser").select_one(f'a[href="{target}"]'), path
    assert BeautifulSoup(client.get(target).data, "html.parser").select_one("[data-se-detail]")
