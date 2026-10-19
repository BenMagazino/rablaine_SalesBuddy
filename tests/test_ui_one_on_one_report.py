"""Native meeting preparation preserves its existing read-only populations and commands."""

from datetime import date, datetime, time, timedelta, timezone

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient

from app.models import (
    Customer, Engagement, Milestone, Note, OneOnOneWorkspace, RevenueAnalysis,
    Seller, Territory, Topic, db,
)


@pytest.fixture
def preparation(app: Flask) -> dict[str, int | str]:
    """Seed isolated recent, active, topic and milestone evidence with reviewed alerts."""
    now = datetime.now(timezone.utc)
    calendar_today = datetime.combine(date.today(), time.min)
    with app.app_context():
        seller = Seller(name="Preparation Seller")
        territory = Territory(name="Preparation Territory")
        customer = Customer(
            name="Preparation Customer", tpid=98123, seller=seller, territory=territory,
        )
        topic = Topic(name="Preparation Topic")
        engagement = Engagement(
            title="Preparation Engagement", customer=customer, status="Active",
            estimated_acr=2500, target_date=now + timedelta(days=2),
        )
        milestone = Milestone(
            title="Preparation Milestone", customer=customer, on_my_team=True,
            monthly_usage=1234.56, msx_status="On Track", workload="Data: SQL",
            committed_at=now - timedelta(days=1), due_date=calendar_today,
            url="https://example.com/preparation",
        )
        engagement.milestones.append(milestone)
        notes = [
            Note(customer=customer, call_date=calendar_today,
                 content=f"Preparation note {index}", topics=[topic])
            for index in range(7)
        ]
        engagement.notes.append(notes[0])
        alerts = [
            RevenueAnalysis(
                customer_name=customer.name, bucket="Azure", category="DECLINING",
                review_status="actioned", reviewed_at=now - timedelta(days=1),
                dollars_at_risk=2500, months_analyzed=6, avg_revenue=5000,
                latest_revenue=2500, recommended_action="CHECK-IN (Urgent)",
                confidence="HIGH", priority_score=80,
            ),
            RevenueAnalysis(
                customer_name=customer.name, bucket="Data", category="EXPANSION_OPPORTUNITY",
                review_status="reviewed", reviewed_at=now - timedelta(days=1),
                dollars_opportunity=1200, months_analyzed=6, avg_revenue=5000,
                latest_revenue=6000, recommended_action="MONITOR",
                confidence="MEDIUM", priority_score=40,
            ),
        ]
        db.session.add_all([engagement, milestone, *notes, *alerts])
        db.session.commit()
        return {
            "customer_id": customer.id, "seller_id": seller.id, "milestone_id": milestone.id,
            "engagement_id": engagement.id, "topic_id": topic.id,
            "date": calendar_today.strftime("%Y-%m-%d"),
        }


@pytest.mark.parametrize("embedded", [False, True])
def test_native_frame_and_sort_contract(
    client: FlaskClient, preparation: dict[str, int | str], embedded: bool,
) -> None:
    """Standalone owns the frame; embeds use the same records without outer history chrome."""
    response = client.get("/reports/one-on-one", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    surface = soup.select_one(".sb-one-on-one")
    assert surface["data-embedded"] == str(embedded).lower()
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select("body > footer.sb-page-status")) is not embedded
    assert len(surface.select("[data-sb-page-body]")) == 1
    assert not surface.select(".card, .badge, .btn, .modal, [data-bs-toggle]")
    assert soup.select_one("script[src^='/static/js/ui-one-on-one-report.js']")
    assert len(soup.select("script[src^='/static/js/ui-table-sort.js']")) == 1
    tables = surface.select("table[data-sb-sortable]")
    assert len(tables) == 4
    assert len({table["data-sb-sort-key"] for table in tables}) == 4
    for table in tables:
        assert len(table.select("th[data-sb-sort-type]")) == 4
        assert len(table.select("tbody tr")) >= 1
        assert all(
            header["data-export-label"] == header.get_text(strip=True)
            for header in table.select("thead th")
        )
    for table_id in ["oneOnOneCommitments", "oneOnOneQuarter"]:
        table = surface.select_one(f"#{table_id}")
        assert [header["data-sb-sort-type"] for header in table.select("th")] == [
            "text", "text", "number", "date",
        ]
        assert table.select_one("td[data-export-url]")["data-export-url"] == (
            "https://example.com/preparation"
        )
        assert table.select_one("td[data-export-url] a")["href"] == (
            f"/milestone/{preparation['milestone_id']}"
        )
        assert table.select_one("tbody tr td:nth-child(3)")["data-sb-sort-value"] == "1234.56"
        assert table.select_one("tbody tr td:nth-child(4)")["data-sb-sort-value"]
    assert surface.select_one(
        "#oneOnOneQuarter tbody tr td:nth-child(4)"
    )["data-sb-sort-value"] == preparation["date"]


def test_metrics_activity_and_topic_evidence(
    client: FlaskClient, preparation: dict[str, int | str],
) -> None:
    """Recent and open lenses retain engagement links, note limits, FY bars and totals."""
    soup = BeautifulSoup(client.get("/reports/one-on-one").data, "html.parser")
    assert [value.text for value in soup.select(".oo-stat strong")] == [
        "1", "1", "7", "1", "1", "$1,235",
    ]
    assert soup.select_one("#recent-tab")["aria-selected"] == "true"
    assert soup.select_one("#alltime").has_attr("hidden")
    for tab in ["recent", "alltime"]:
        assert soup.select_one(f"#{tab} .oo-customer[open]")
        assert soup.select_one(f"#{tab} a[href='/engagement/{preparation['engagement_id']}']")
        assert soup.select_one(f"#{tab} .oo-tag.is-territory .bi-geo-alt")
    notes = soup.select_one(f"#notes-{preparation['customer_id']}")
    assert not notes.has_attr("open")
    assert len(notes.select(".oo-note")) == 5
    assert "+ 2 more" in notes.get_text()
    assert soup.select_one("#alltime [role='progressbar'][aria-valuenow]")
    topic = soup.select_one("#oneOnOneTopics tbody tr")
    assert topic.select_one("a")["href"] == f"/topic/{preparation['topic_id']}"
    assert topic.select_one("td:nth-child(2)")["data-sb-sort-value"] == "7"
    assert topic.select_one("td:nth-child(3)")["data-sb-sort-value"] == "7"
    assert topic.select_one("td:nth-child(4)")["data-sb-sort-value"] == "1"
    assert any(title.text.endswith(": 7") for title in topic.select("svg title"))


def test_reviewed_alerts_and_all_exports(
    client: FlaskClient, preparation: dict[str, int | str],
) -> None:
    """Keep both risk and opportunity dollar bases and all four exportable highlight tables."""
    response = client.get("/reports/one-on-one")
    soup = BeautifulSoup(response.data, "html.parser")
    rows = soup.select("#oneOnOneRevenue tbody tr")
    assert len(rows) == 2
    assert {row.select_one("td:nth-child(3)")["data-sb-sort-value"] for row in rows} == {
        "2500.0", "1200.0",
    }
    assert {row.select_one("td:nth-child(4)").get_text(strip=True) for row in rows} == {
        "Actioned", "Reviewed",
    }
    assert 'const TABLE_SELECTOR = ".oo-table";' in response.get_data(as_text=True)
    assert len(soup.select("#reportExportBtnGroup button.sb-revenue-command")) == 3
    for action in ["exportReportCSV()", "copyReportForEmail()", "downloadReportEmail()"]:
        assert soup.select_one(f"button[onclick='{action}']")
    assert soup.select_one("#reportExportNoticeTemplate .sb-notice")


def test_launcher_preserves_destinations_and_post_fields(
    client: FlaskClient, preparation: dict[str, int | str], app: Flask,
) -> None:
    """Only the explicit creation form creates a workspace; rendering does not."""
    with app.app_context():
        assert OneOnOneWorkspace.query.count() == 0
    soup = BeautifulSoup(client.get("/reports/one-on-one").data, "html.parser")
    dialog = soup.select_one("dialog#oneOnOneWorkspaceLauncher.sb-dialog")
    assert soup.select_one("[data-sb-dialog='oneOnOneWorkspaceLauncher']")
    assert dialog.select_one(f"option[value='{preparation['seller_id']}']")
    form = dialog.select_one("form")
    assert form["method"] == "post"
    assert form["action"] == "/one-on-one/new"
    assert [option["value"] for option in form.select("[name='person_type'] option")] == [
        "Manager", "Other",
    ]
    name = form.select_one("[name='person_name']")
    assert name.has_attr("required") and name["maxlength"] == "200"
    assert len(dialog.select("[data-sb-dialog-close]")) == 2
    with app.app_context():
        assert OneOnOneWorkspace.query.count() == 0


def test_empty_states_remain_readable(client: FlaskClient) -> None:
    """An empty portfolio renders all report and launcher empty states without fake records."""
    soup = BeautifulSoup(client.get("/reports/one-on-one").data, "html.parser")
    assert not soup.select(".oo-table")
    assert len(soup.select(".oo-empty")) == 6
    assert "Every seller already has a workspace above." in soup.get_text()
