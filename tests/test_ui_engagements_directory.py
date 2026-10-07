"""Native engagement directory parity without modifying its data provider."""

from datetime import date, datetime, timezone

from bs4 import BeautifulSoup
from flask import render_template


def test_directory_frame_commands_and_single_shared_assets(client):
    """The directory owns reading while creation keeps the canonical picker."""
    response = client.get("/engagements")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert "sb-page-frame" in soup.body["class"]
    assert soup.select_one(".sb-eng-reading[data-sb-page-body]")
    assert soup.select_one(".sb-page-status")
    assert soup.select_one('[data-sb-dialog="quickEngagementModal"]')
    assert soup.select_one("dialog#quickEngagementModal")
    assert not soup.select(".sb-eng-directory .card, .sb-eng-directory .badge")
    assert not soup.select(".sb-eng-directory form")
    assert [button["data-status"] for button in soup.select("[data-status]")] == [
        "", "Active", "On Hold", "Won", "Lost",
    ]
    assert [option["value"] for option in soup.select("#engHubBody_sortSelect option")] == [
        "updated", "updated-asc", "story-asc", "story-desc", "target", "target-desc",
    ]
    for asset in ("ui-dialog.js", "ui-table-sort.js", "ui-engagements-directory.js"):
        assert len(soup.select(f'script[src="/static/js/{asset}"]')) == 1


def test_legacy_home_seller_panel_is_not_silently_migrated(app):
    """The hub opts in without changing existing embed functions or lifecycle."""
    with app.test_request_context("/"):
        app.preprocess_request()
        html = render_template(
            "partials/engagements_panel.html", eng_api_url="/api/seller/5/engagements",
            eng_auto_load=True, eng_show_seller=False, eng_body_id="sellerEngBody",
        )
    assert "engLoad_" in html and "engToggleFav_" in html
    assert "DOMContentLoaded" in html
    assert 'class="card mb-3"' in html
    assert "ui-engagements-directory.js" not in html
    assert "data-eng-directory" not in html


def test_internal_projects_preserve_population_order_and_fields(client, app):
    """Completed projects remain behind open ones and saved Copilot projects stay out."""
    from app.models import Project, db

    with app.app_context():
        projects = [
            Project(title="Newest open", description="Visible description", status="On Hold",
                    updated_at=datetime(2026, 10, 6, tzinfo=timezone.utc),
                    due_date=date(2026, 1, 2)),
            Project(title="Completed later", status="Completed",
                    updated_at=datetime(2026, 10, 7, tzinfo=timezone.utc)),
            Project(title="Hidden saved", project_type="copilot_saved"),
        ]
        db.session.add_all(projects)
        db.session.commit()
        ids = [project.id for project in projects]
    soup = BeautifulSoup(client.get("/engagements").data, "html.parser")
    links = soup.select(".sb-eng-project")
    assert [link["href"] for link in links] == [f"/project/{ids[0]}", f"/project/{ids[1]}"]
    assert "Visible description" in links[0].get_text()
    assert "On Hold" in links[0].get_text()
    assert "Jan 02" in links[0].get_text()
    assert "Completed" in links[1].get_text()
    assert "Hidden saved" not in soup.get_text()


def test_all_provider_keeps_exact_shape_and_default_order(client, app, sample_data):
    """Rendering needs no provider additions or changed scope, dates or money."""
    from app.models import Engagement, db

    with app.app_context():
        entries = [
            Engagement(title="Older", customer_id=sample_data["customer1_id"],
                       status="Lost", estimated_acr=1234.56, target_date=date(2027, 1, 2),
                       updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
            Engagement(title="Newer", customer_id=sample_data["customer1_id"],
                       status="Won", updated_at=datetime(2026, 2, 1, tzinfo=timezone.utc)),
        ]
        db.session.add_all(entries)
        db.session.commit()
        ids = [entry.id for entry in entries]
    data = client.get("/api/engagements/all").get_json()
    assert set(data) == {"success", "count", "engagements"}
    assert data["count"] == 2
    assert [entry["id"] for entry in data["engagements"]] == ids[::-1]
    older = data["engagements"][1]
    assert older["estimated_acr"] == 1234.56
    assert older["target_date"] == "2027-01-02"
    assert set(older) == {
        "id", "title", "status", "customer_name", "customer_nickname", "customer_id",
        "seller_name", "customer_favicon", "estimated_acr", "target_date",
        "story_completeness", "linked_note_count", "opportunity_count", "milestone_count",
        "open_action_item_count", "latest_note_date", "is_favorited",
    }
    won = client.get("/api/engagements/all?status=Won").get_json()
    assert won["count"] == 1 and won["engagements"][0]["id"] == ids[1]


def test_directory_and_api_keep_same_seller_scope(client, app, sample_data, monkeypatch):
    """The existing seller-mode provider limits both statistics and returned records."""
    from app.models import Customer, Engagement, db

    with app.app_context():
        customer = db.session.get(Customer, sample_data["customer1_id"])
        seller_id = customer.seller_id
        other = Customer(name="Other scope", tpid=98222)
        db.session.add(other)
        db.session.flush()
        db.session.add_all([
            Engagement(title="Scoped engagement", customer_id=customer.id),
            Engagement(title="Outside engagement", customer_id=other.id),
        ])
        db.session.commit()
    monkeypatch.setattr("app.routes.engagements.get_seller_mode_seller_id", lambda: seller_id)
    data = client.get("/api/engagements/all").get_json()
    assert data["count"] == 1
    assert data["engagements"][0]["title"] == "Scoped engagement"
    soup = BeautifulSoup(client.get("/engagements").data, "html.parser")
    assert "1 engagements" in soup.select_one(".sb-page-status").get_text()
