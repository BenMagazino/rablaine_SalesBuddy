"""Native revenue review rendering and shared-host integration contracts."""

from datetime import datetime, timezone
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


@pytest.fixture
def review_alert(app: Flask) -> dict[str, int]:
    """Create an isolated revenue alert with matched customer and review history."""
    from app.models import Customer, RevenueAnalysis, RevenueReviewNote, Seller, db

    with app.app_context():
        seller = Seller(name="Review UI Seller")
        db.session.add(seller)
        db.session.flush()
        customer = Customer(name="Review UI Customer", tpid=45123, seller_id=seller.id)
        db.session.add(customer)
        db.session.flush()
        alert = RevenueAnalysis(
            customer_id=customer.id, customer_name=customer.name, seller_name=seller.name,
            bucket="Databases", category="DECLINING", recommended_action="CHECK-IN",
            avg_revenue=5000, latest_revenue=4000, priority_score=70, months_analyzed=6,
            confidence="HIGH", review_status="new", review_notes='<Draft "notes">',
            previous_review_status="reviewed", previous_review_notes="Prior context",
        )
        db.session.add(alert)
        db.session.flush()
        db.session.add(RevenueReviewNote(
            analysis_id=alert.id, review_status="reviewed", review_notes="<Literal history>",
            created_at=datetime.now(timezone.utc),
        ))
        db.session.commit()
        return {"alert": alert.id, "customer": customer.id, "seller": seller.id}


@pytest.mark.parametrize("host", ["home", "dashboard", "customer", "seller_alerts", "seller"])
def test_editor_is_native_in_every_host(
    client: FlaskClient, review_alert: dict[str, int], host: str,
) -> None:
    """All consumers include one editor, one discard dialog and the shared helper."""
    paths = {
        "home": "/", "dashboard": "/reports/revenue",
        "customer": f'/customer/{review_alert["customer"]}/revenue',
        "seller_alerts": "/revenue/seller/Review%20UI%20Seller",
        "seller": f'/seller/{review_alert["seller"]}',
    }
    response = client.get(paths[host])
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    dialog = soup.find("dialog", id="reviewActionModal")
    assert dialog is not None
    assert len(soup.select("#reviewActionModal")) == 1
    assert len(soup.select("#reviewDiscardDialog")) == 1
    assert dialog["aria-labelledby"] == "reviewActionModalLabel"
    assert dialog["data-sb-backdrop-close"] == "true"
    assert not dialog.select(".modal, .btn, .form-control, [data-bs-dismiss], [onclick]")
    assert [field["value"] for field in dialog.select('[name="reviewStatus"]')] == [
        "new", "to_be_reviewed", "reviewed", "actioned", "dismissed",
    ]
    for field in dialog.select('[name="reviewStatus"], #reviewNotes'):
        assert dialog.select_one(f'label[for="{field["id"]}"]')
    assert dialog.find(id="reviewHistoryRetry")
    assert dialog.find(id="reviewResult")["aria-live"] == "polite"
    assert len(soup.select('script[src="/static/js/ui-revenue-review.js"]')) == 1


def test_review_macros_keep_literal_notes_and_identity(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """Imported macros use native controls and safely escaped attributes."""
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    button = soup.select_one(".review-action-btn")
    assert button["data-analysis-id"] == str(review_alert["alert"])
    assert button["data-notes"] == '<Draft "notes">'
    assert button["aria-label"] == "Set review status"
    assert "sb-review-button" in button["class"]
    assert not button.has_attr("onclick")
    assert soup.select_one(".review-badge").get_text(" ", strip=True) == "New"
    assert soup.select_one("[data-review-previous-id]")["data-review-previous-id"] == str(
        review_alert["alert"]
    )
    assert not soup.find("dialog")


def test_history_and_save_contracts_remain_unchanged(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """The existing API returns literal history, canonical notes and confirmed status."""
    alert_id = review_alert["alert"]
    history = client.get(f"/api/revenue/analysis/{alert_id}/review-history")
    assert history.status_code == 200
    assert history.json["history"][0]["review_notes"] == "<Literal history>"
    response = client.patch(f"/api/revenue/analysis/{alert_id}/review", json={
        "review_status": "actioned", "review_notes": '  <Quoted "notes">  ',
    })
    assert response.status_code == 200
    assert response.json["success"] is True
    assert response.json["review_status"] == "actioned"
    assert response.json["review_notes"] == '<Quoted "notes">'
    assert len(response.json["history"]) == 2


@pytest.mark.parametrize("host", [
    "index.html", "revenue_dashboard.html", "revenue_seller_alerts.html", "seller_view.html",
])
def test_preview_refresh_waits_for_confirmed_review_save(host: str) -> None:
    """Opening/cancelling review does not mark a preview dirty and reload its page."""
    template = (Path(__file__).resolve().parents[1] / "templates" / host).read_text("utf-8")
    assert "document.addEventListener('sb:revenue-review-saved'" in template
    assert "if (e.target instanceof Element && e.target.closest(" in template
