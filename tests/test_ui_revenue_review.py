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


def test_preview_refresh_waits_for_confirmed_review_save() -> None:
    """Opening/cancelling review does not mark a preview dirty and reload its page."""
    root = Path(__file__).resolve().parents[1]
    template = (root / "static" / "js" / "ui-revenue-preview.js").read_text("utf-8")
    assert "event.target instanceof Element" in template
    assert "dialog.open && dialog.contains(event.target)" in template
    assert "document.addEventListener('sb:revenue-review-saved'" in template


@pytest.mark.parametrize("host", ["home", "dashboard", "seller_alerts", "seller"])
def test_alert_preview_is_native_and_has_identity_loader_controls(
    client: FlaskClient, review_alert: dict[str, int], host: str,
) -> None:
    """Every preview host uses one identified native frame and the same controller."""
    paths = {
        "home": "/", "dashboard": "/reports/revenue",
        "seller_alerts": "/revenue/seller/Review%20UI%20Seller",
        "seller": f'/seller/{review_alert["seller"]}',
    }
    response = client.get(paths[host])
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    dialog_id = "homeAlertDetailModal" if host == "home" else "alertDetailModal"
    title_id = "homeAlertTitle" if host == "home" else "alertDetailTitle"
    body_id = "homeAlertBody" if host == "home" else "alertDetailBody"
    dialog = soup.find("dialog", id=dialog_id)
    assert dialog is not None
    assert len(soup.select("[data-sb-revenue-preview]")) == 1
    assert dialog["aria-labelledby"] == title_id
    assert not dialog.select(".modal, .btn, [data-bs-dismiss]")
    for field in ["title", "full-link", "loading", "error", "retry", "content", "status"]:
        assert dialog.select_one(f"[data-sb-record-{field}]")
    assert dialog.select_one("[data-sb-record-full-link]")["href"] == "/reports/revenue"
    assert dialog.select_one(f"#{body_id}[data-sb-record-content]")
    assert len(soup.select('script[src="/static/js/ui-revenue-preview.js"][defer]')) == 1
    assert soup.select_one('link[href="/static/css/ui-revenue-detail.css"]')
    if host == "seller":
        assert dialog["data-sb-revenue-parent"] == "revenueModal"
        assert soup.select_one("#revenueModal.modal")
    else:
        assert not dialog.has_attr("data-sb-revenue-parent")


@pytest.mark.parametrize("category,label,tone", [
    ("DECLINING", "Declining", "danger"), ("RECENT_DIP", "Recent Dip", "warning"),
    ("EXPANSION_OPPORTUNITY", "Expansion", "positive"), ("VOLATILE", "Volatile", "neutral"),
    ("HEALTHY", "Healthy", "neutral"), ("NEW_CUSTOMER", "New Customer", "accent"),
    ("CHURNED", "Churned", "neutral"), ("CUSTOM_CATEGORY", "Custom Category", "neutral"),
])
def test_detail_categories_preserve_labels_and_identity(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
    category: str, label: str, tone: str,
) -> None:
    """Every category renders native markup with the requested alert identity."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.category = category
        db.session.commit()
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-revenue-detail]")
    assert root["data-sb-revenue-id"] == str(review_alert["alert"])
    assert not root.select(".card, .badge, .row, .col-6, .table, .btn, .text-danger")
    category_tag = root.select_one(".sb-revenue-category")
    assert category_tag.get_text(strip=True) == label
    assert category_tag["data-tone"] == tone
    assert [d.get_text(strip=True) for d in root.select(".sb-revenue-metrics dt")] == [
        "Avg Revenue", "Latest", "Trend", "Priority",
    ]
    assert [d.get_text(strip=True) for d in root.select(".sb-revenue-metrics dd")][:2] == [
        "$5,000", "$4,000",
    ]
    assert "CHECK-IN" in root.get_text()
    assert "months)" in root.select_one(".sb-revenue-review-meta").get_text()
    assert root.select_one(".review-action-btn")["data-analysis-id"] == str(review_alert["alert"])
    header_meta = root.select_one(".sb-revenue-detail-header .sb-revenue-header-meta")
    assert header_meta.select_one(".sb-revenue-category") == category_tag
    assert header_meta.select_one("[data-review-id]")["data-review-id"] == str(review_alert["alert"])
    assert header_meta.select_one(".sb-revenue-review-meta")
    assert header_meta.select_one(".review-action-btn")
    metadata_items = header_meta.find_all(recursive=False)
    assert len(metadata_items) == 4
    assert "sb-revenue-review-meta" in metadata_items[0]["class"]
    assert metadata_items[1]["data-review-id"] == str(review_alert["alert"])
    assert metadata_items[1].select_one('.sb-review-badge[data-status="new"]')
    assert metadata_items[2] == category_tag
    assert "review-action-btn" in metadata_items[3]["class"]
    assert len(root.select("[data-review-id]")) == 1
    assert len(root.select(".sb-revenue-review-meta")) == 1
    assert not root.select_one(".sb-revenue-products")


@pytest.mark.parametrize("priority,tone", [
    (80, "danger"), (79, "warning"), (60, "warning"), (59, "accent"),
    (40, "accent"), (39, "neutral"),
])
def test_detail_priority_thresholds(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], priority: int, tone: str,
) -> None:
    """Original priority severity thresholds are preserved at their boundaries."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.priority_score = priority
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    assert soup.select(".sb-revenue-metrics dd")[-1]["data-tone"] == tone


@pytest.mark.parametrize("trend,tone", [
    (-3.1, "danger"), (-3.0, "neutral"), (3.0, "neutral"), (3.1, "positive"),
])
def test_detail_trend_thresholds(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], trend: float, tone: str,
) -> None:
    """Monthly trend semantics remain unchanged, including exact neutral thresholds."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.trend_slope = trend
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    field = soup.select(".sb-revenue-metrics dd")[2]
    assert field["data-tone"] == tone
    assert field.get_text(strip=True) == f"{trend:+.1f}%/mo"


@pytest.mark.parametrize("risk,opportunity,expected", [
    (200, 100, "$200/mo at risk"), (0, 100, "$100/mo opportunity"), (0, 0, None),
])
def test_detail_no_action_keeps_impact_without_inventing_guidance(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
    risk: int, opportunity: int, expected: str | None,
) -> None:
    """No-action alerts still show dollar impact and preserve risk-before-opportunity."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.recommended_action = "NO ACTION"
        alert.dollars_at_risk = risk
        alert.dollars_opportunity = opportunity
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    guidance = soup.select_one(".sb-revenue-guidance")
    assert not soup.find("strong")
    if expected:
        assert guidance.get_text(strip=True) == expected
    else:
        assert guidance is None
        assert soup.select_one(".sb-revenue-summary")["data-guidance"] == "false"


def test_unmatched_detail_is_an_identified_empty_state_and_missing_is_404(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """A valid unmatched alert is distinct from missing/error HTML in the native loader."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.customer_id = None
        db.session.commit()
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one("[data-sb-revenue-id]")["data-sb-revenue-id"] == str(review_alert["alert"])
    assert soup.select_one('[role="status"]').get_text(strip=True) == (
        "No matched customer for this alert."
    )
    assert not soup.select(".sb-revenue-metrics, .review-action-btn")
    assert client.get("/api/revenue/analysis/999999/detail").status_code == 404


def test_product_breakdown_preserves_recent_seven_months_totals_links_and_change_colors(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """The real detail API retains monthly, zero, negative and all-history total semantics."""
    from app.models import CustomerRevenueData, ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    months = ["FY26-Jul", "FY26-Aug", "FY26-Sep", "FY26-Oct",
              "FY26-Nov", "FY26-Dec", "FY26-Jan", "FY26-Feb"]
    revenues = [100, 90, 80, 88, 100, 0, -20, 40]
    product = '<SQL & "test">'
    with app.app_context():
        imported = RevenueImport(filename="isolated-detail-test", record_count=8)
        db.session.add(imported)
        db.session.flush()
        for month, revenue in zip(months, revenues):
            common = {
                "customer_name": "Review UI Customer", "customer_id": review_alert["customer"],
                "bucket": "Databases", "fiscal_month": month,
                "month_date": fiscal_month_to_date(month), "revenue": revenue,
                "last_import_id": imported.id,
            }
            db.session.add(CustomerRevenueData(**common))
            db.session.add(ProductRevenueData(product=product, **common))
        db.session.commit()
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    table = soup.select_one(".sb-revenue-table")
    assert [h.get_text(strip=True) for h in table.select("thead th")] == [
        "Product", *months[1:], "Total",
    ]
    assert table.find("caption")
    assert all(h["scope"] == "col" for h in table.select("thead th"))
    assert all(h["scope"] == "row" for h in table.select("tbody th"))
    rows = table.select("tbody tr")
    assert len(rows) == 2
    for row in rows:
        cells = row.select("td")
        assert [c.get_text(strip=True) for c in cells] == [
            "$90", "$80", "$88", "$100", "-", "$-20", "$40", "$478",
        ]
        assert cells[1].select_one('[data-tone="danger"]')
        assert not cells[2].select_one("[data-tone]")
        assert cells[3].select_one('[data-tone="positive"]')
        assert not cells[5].select_one("[data-tone]")
    assert rows[1].find("a").get_text(strip=True) == product
    assert "<SQL" not in str(rows[1])
    assert soup.select_one(".sb-revenue-products-header a")["href"] == (
        f'/customer/{review_alert["customer"]}/revenue'
    )
