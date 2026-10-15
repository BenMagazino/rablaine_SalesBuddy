"""Opportunity detail parity, native consumer contracts and failed-cache recovery."""
import json
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models import Milestone, Opportunity, db


@pytest.fixture
def opportunity_id(app, sample_data) -> int:
    """Create complete cached detail and linked work only in the isolated test database."""
    with app.app_context():
        opportunity = Opportunity(
            name="Complete opportunity", msx_opportunity_id="native-opp-guid",
            customer_id=sample_data["customer1_id"], opportunity_number="7-NATIVE",
            state="Open", statecode=0, status_reason="In Progress", estimated_value=0,
            estimated_close_date="2026-12-01T00:00:00Z", owner_name="Owner <one>",
            compete_threat="Medium", customer_need="Customer need", description="Full description",
            on_deal_team=True, details_fetched_at=datetime.now(timezone.utc),
            cached_comments_json=json.dumps([
                {"comment": "Plain <unsafe>", "userId": "one", "modifiedOn": "2026-10-01"},
                {"comment": "<table><tr><td>Authored table</td></tr></table>",
                 "displayName": "Two", "userId": "two", "modifiedOn": "2026-10-02"},
            ]),
        )
        db.session.add(opportunity)
        db.session.flush()
        for title, status, value, due in (
            ("Alpha", "At Risk", 1200.51, datetime(2026, 10, 1)),
            ("Beta", "Completed", 0, datetime(2026, 9, 1)),
            ("Gamma", None, None, None),
        ):
            db.session.add(Milestone(
                title=title, url="https://example.com/milestone", opportunity=opportunity,
                msx_status=status, monthly_usage=value, workload="Data", due_date=due,
            ))
        db.session.commit()
        return opportunity.id


@pytest.mark.parametrize("fragment", [False, True])
def test_complete_native_opportunity_body(client, opportunity_id: int, fragment: bool) -> None:
    """Standalone and actual modal fragment retain fields, scripts, links and raw sorting."""
    path = (f"/api/opportunity/{opportunity_id}/detail" if fragment
            else f"/opportunity/{opportunity_id}")
    with patch("app.routes.opportunities.get_opportunity") as remote:
        response = client.get(path)
    remote.assert_not_called()
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-opportunity-detail]")
    assert root["data-sb-opportunity-id"] == str(opportunity_id)
    assert root.select_one("script[data-sb-opportunity-controller]").parent == root
    assert not root.select(".card, .btn, .row, .list-group, .modal, [onclick]")
    assert len(root.select(".sb-opp-layout > aside")) == 1
    assert len(root.select(".sb-opp-layout > .sb-opp-work")) == 1
    assert root.select_one(".sb-opp-work #commentsBody")
    assert bool(root.select_one(".sb-opp-header")) is not fragment
    assert root.select_one("#opportunityLeaveTeamDialog form")
    assert root.select_one("#opportunityLeaveTeamDialog [autofocus]").get_text() == "Cancel"
    for text in ("7-NATIVE", "Open", "In Progress", "$0", "2026-12-01", "Owner <one>",
                 "Medium", "Customer need", "Full description", "Alpha", "Beta", "Gamma",
                 "overdue", "Plain <unsafe>", "Authored table", "Last cached", "Source: MSX"):
        assert text in root.get_text()
    assert not root.select("unsafe, one")
    form = root.select_one("#commentFormCached form")
    assert form["action"] == f"/opportunity/{opportunity_id}/comment"
    assert form["method"] == "post"
    assert form.select_one('textarea[name="comment"][required]')
    table = root.select_one("table[data-sb-sortable]")
    assert len(table.select("th[data-sb-sort-type]")) == 5
    assert len(table.select("tbody tr")) == 3
    rows = {row.select_one("td a").get_text(strip=True): row.select("td")
            for row in table.select("tbody tr")}
    assert list(rows) == ["Gamma", "Alpha", "Beta"]
    assert rows["Alpha"][3]["data-sb-sort-value"] == "1200.51"
    assert rows["Gamma"][4]["data-sb-sort-value"] == ""
    assert len(root.select('a[href^="/milestone/"]')) == 3
    if not fragment:
        assert "sb-page-frame" in soup.body["class"]
        assert sum(urlsplit(script['src']).path == '/static/js/ui-opportunity-workflow.js'
                   for script in soup.select('script[src]')) == 1
        assert soup.select_one("#opportunityPageState")


@pytest.mark.parametrize("cache", [None, "invalid", "[]"])
def test_opportunity_comment_cache_branches(client, app, opportunity_id, cache) -> None:
    """Uncached/malformed/empty populations retain original availability distinctions."""
    with app.app_context():
        db.session.get(Opportunity, opportunity_id).cached_comments_json = cache
        db.session.commit()
    root = BeautifulSoup(
        client.get(f"/api/opportunity/{opportunity_id}/detail").data, "html.parser",
    ).select_one("[data-sb-opportunity-detail]")
    assert bool(root.select_one("#commentFormCached form")) is (cache == "[]")
    assert root.select_one("#commentsCached")["style"] == "display:none;"


def test_cache_failure_is_explicit_and_rollback_allows_retry(
    client, app, opportunity_id,
) -> None:
    """Fresh details are usable without pretending a failed local cache was saved."""
    result = {"success": True, "opportunity": {"name": "Fresh", "comments": []}}
    with patch("app.routes.opportunities.get_opportunity", return_value=result):
        with patch.object(db.session, "commit", side_effect=SQLAlchemyError("disk full")):
            response = client.get(f"/api/opportunity/{opportunity_id}/msx-details")
        data = response.get_json()
        assert data["success"] and data["cache_saved"] is False
        assert "could not be saved" in data["cache_error"]
        with app.app_context():
            assert db.session.get(Opportunity, opportunity_id).name == "Complete opportunity"
        retry = client.get(f"/api/opportunity/{opportunity_id}/msx-details").get_json()
        assert retry["cache_saved"] is True
        with app.app_context():
            assert db.session.get(Opportunity, opportunity_id).name == "Fresh"


def test_favorite_failure_and_retry(client, opportunity_id) -> None:
    """Favorite persistence failures report honestly and leave the original record intact."""
    with patch("app.routes.opportunities.Favorite.toggle", side_effect=SQLAlchemyError("disk")):
        response = client.post(f"/api/opportunity/{opportunity_id}/favorite")
    assert response.status_code == 500
    assert response.get_json()["success"] is False
    assert client.post(f"/api/opportunity/{opportunity_id}/favorite").get_json() == {
        "success": True, "is_favorited": True,
    }


@pytest.mark.parametrize("action,service,expected", [
    ("join", "add_user_to_deal_team", True),
    ("leave", "remove_user_from_deal_team", False),
])
def test_team_remote_failure_cache_rollback_and_retry(
    client, app, opportunity_id, action, service, expected,
) -> None:
    """Team writes preserve GUID/payloads and distinguish remote success from cache failure."""
    path = f"/api/msx/{action}-deal-team"
    with patch(f"app.services.msx_api.{service}") as remote:
        remote.return_value = {"success": False, "error": "Remote refused"}
        assert client.post(path, json={"opportunity_id": opportunity_id}).get_json() == {
            "success": False, "error": "Remote refused",
        }
        remote.assert_called_with("native-opp-guid")
        remote.return_value = {"success": True}
        with patch.object(db.session, "commit", side_effect=SQLAlchemyError("disk")):
            failed = client.post(path, json={"opportunity_id": opportunity_id})
        assert failed.status_code == 500
        assert failed.get_json()["remote_changed"] is True
        assert failed.get_json()["success"] is False
        assert "Check MSX before retrying" in failed.get_json()["error"]
        with app.app_context():
            assert db.session.get(Opportunity, opportunity_id).on_deal_team is True
        assert client.post(path, json={"opportunity_id": opportunity_id}).get_json()["success"]
        with app.app_context():
            assert db.session.get(Opportunity, opportunity_id).on_deal_team is expected
