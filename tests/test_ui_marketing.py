"""Marketing workbench rendering and unchanged report-data selection."""

from datetime import datetime, timezone
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from app.models import Customer, MarketingContact, MarketingInteraction, MarketingSummary, db


@pytest.fixture
def marketing_data(app):
    """Seed full details, summary-only data and more than ten contacts."""
    with app.app_context():
        first = Customer(name="Full Account", nickname="Alias", tpid=123)
        second = Customer(name="Summary Account", tpid=124)
        db.session.add_all([first, second])
        db.session.flush()
        stamp = datetime(2026, 10, 5, 1, 2, 3, tzinfo=timezone.utc)
        for customer, count in [(first, 1234), (second, 5)]:
            db.session.add(MarketingSummary(
                customer_id=customer.id, tpid=str(customer.tpid),
                total_interactions=count, content_downloads=11, trials=4,
                engaged_contacts=13, unique_decision_makers=2, last_interaction_date=stamp,
            ))
        for count, date in [(100, stamp), (9, None)]:
            db.session.add(MarketingInteraction(
                customer_id=first.id, tpid="123", composite_key=f"play-{count}",
                solution_area="Data", sales_play=f"Play {count}", all_interactions=count,
                contact_me=5, trial_signups=2, content_downloads=3, events=4,
                last_interaction_date=date,
            ))
        for count in range(13):
            db.session.add(MarketingContact(
                customer_id=first.id, contact_guid=f"guid-{count}", contact_name=f"Person {count}",
                job_title="Architect", mail_interactions=count, meeting_interactions=count * 2,
                engagement_level="High" if count > 10 else "Medium",
                audience_type="Technical", last_solution_area="Data",
            ))
        db.session.commit()
        return first.id, second.id


@pytest.mark.parametrize("embedded", [False, True])
def test_native_customer_and_detail_panes(client, marketing_data, embedded):
    """Render native table/inspection surfaces without the legacy accordion."""
    response = client.get("/reports/marketing-insights" + ("?embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-marketing]")
    assert root["data-embedded"] == str(embedded).lower()
    assert bool(soup.select_one("body.sb-page-frame")) is not embedded
    assert bool(soup.select_one("footer.sb-page-status")) is not embedded
    assert not root.select(".card, .accordion, .badge, [data-bs-toggle]")
    assert len(root.select("#summaryTable tbody tr")) == 2
    assert root.select_one("#summaryTable")["data-export-visible"] == "true"
    assert "#summaryTable[data-export-visible=true]" in response.text
    assert len(root.select("[data-marketing-customer]")) == 2
    assert all(th.has_attr("data-sb-sort-type") for th in root.select("thead th"))
    assert root.select_one('[data-customer-select] .customer-favicon, '
                           '[data-customer-select] i.bi-building')
    assert "ui-marketing.js" in response.text
    assert "Summary data only" in root.get_text()


def test_retained_totals_sort_keys_and_detail_fields(client, marketing_data):
    """Preserve provider ordering, every field and ten highest-interaction contacts."""
    soup = BeautifulSoup(client.get("/reports/marketing-insights").data, "html.parser")
    first, second = marketing_data
    rows = soup.select("#summaryTable tbody tr")
    assert [row["data-customer-id"] for row in rows] == [str(first), str(second)]
    assert rows[0].select_one("td")["data-export-label"]
    assert rows[0].select("td")[1]["data-sb-sort-value"] == "1234"
    assert rows[0].select("td")[1].get_text(strip=True) == "1,234"
    assert [node.get_text(strip=True) for node in soup.select(".sb-marketing-scope dd")] == [
        "2", "1,239", "26",
    ]
    detail = soup.select_one(f'[data-marketing-customer="{first}"]')
    assert [node.get_text(strip=True) for node in detail.select(".sb-marketing-metrics dd")] == [
        "1,234", "11", "4", "13", "2",
    ]
    plays = detail.select('[data-marketing-table="plays"] tbody tr')
    assert [row.select("td")[1].get_text(strip=True) for row in plays] == ["Play 100", "Play 9"]
    assert plays[0].select("td")[-1]["data-sb-sort-value"] == "20261005010203"
    assert plays[0].select_one(".local-datetime")["data-utc"] == "2026-10-05T01:02:03Z"
    assert plays[1].select("td")[-1]["data-sb-sort-value"] == ""
    contacts = detail.select('[data-marketing-table="contacts"] tbody tr')
    assert len(contacts) == 10
    assert [row.select("td")[0].get_text(strip=True) for row in contacts] == [
        f"Person {count}" for count in range(12, 2, -1)
    ]
    assert contacts[0].select_one('[data-tone="positive"]')
    assert contacts[2].select_one('[data-tone="warning"]')
    assert [cell.get_text(strip=True) for cell in contacts[0].select("td")] == [
        "Person 12", "Architect", "12", "24", "High", "Technical", "Data",
    ]
    assert detail.select_one(".sb-marketing-pane-header a")["href"] == f"/customer/{first}"


@pytest.mark.parametrize("state", ["never_run", "in_progress", "complete", "failed", "incomplete"])
def test_sync_states_and_empty_guidance(client, state):
    """Keep all sync outcomes and Admin navigation without initiating a sync."""
    snapshot = {"state": state, "completed_at": None, "items_synced": 0}
    with patch("app.routes.reports.SyncStatus.get_status", return_value=snapshot):
        response = client.get("/reports/marketing-insights")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one(".sb-marketing-sync")["data-state"] == state
    assert "No Marketing Data" in soup.get_text()
    assert soup.select_one('.sb-marketing-empty a[href="/admin"]')
    assert not soup.select("#summaryTable")
    if state == "complete":
        assert "Unknown" in soup.select_one(".sb-marketing-sync").get_text()
        assert "0 customers synced" in soup.select_one(".sb-marketing-sync").get_text()


def test_complete_sync_timestamp_and_help(client):
    """Retain UTC-to-local timestamp markup and explain the export/detail boundary."""
    snapshot = {"state": "complete", "items_synced": 3,
                "completed_at": datetime(2026, 10, 5, 1, 2, 3, tzinfo=timezone.utc)}
    with patch("app.routes.reports.SyncStatus.get_status", return_value=snapshot):
        soup = BeautifulSoup(client.get("/reports/marketing-insights").data, "html.parser")
    assert soup.select_one(".sb-marketing-sync .local-datetime").text == "2026-10-05T01:02:03Z"
    source = client.get("/static/js/page-help.js").text
    assert "title: 'Marketing Insights'" in source
    assert "filtered customer summary" in source
    assert "ten contacts" in source
