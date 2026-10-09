"""Connect Impact workbench rendering and unchanged commitment scope."""

from datetime import date, datetime, timezone

from bs4 import BeautifulSoup
import pytest

from app.models import Customer, Milestone, db
from app.routes.reports import _get_connect_impact_date_presets


@pytest.mark.parametrize("reference, fiscal_year, starts", [
    (date(2026, 6, 30), "FY26", ["2025-07-01", "2025-10-01", "2026-01-01", "2026-04-01"]),
    (date(2026, 7, 1), "FY27", ["2026-07-01", "2026-10-01", "2027-01-01", "2027-04-01"]),
    (date(2026, 12, 31), "FY27", ["2026-07-01", "2026-10-01", "2027-01-01", "2027-04-01"]),
    (date(2027, 1, 1), "FY27", ["2026-07-01", "2026-10-01", "2027-01-01", "2027-04-01"]),
    (date(2027, 4, 1), "FY27", ["2026-07-01", "2026-10-01", "2027-01-01", "2027-04-01"]),
])
def test_current_fiscal_year_shortcut_dates(reference, fiscal_year, starts):
    """Use July-June fiscal years across both fiscal and calendar-year boundaries."""
    presets = _get_connect_impact_date_presets(reference)
    assert [preset["since"] for preset in presets] == starts
    assert all(preset["label"].startswith(fiscal_year) for preset in presets)
    assert "start / Q1" in presets[0]["label"]
    assert "Q4 start" in presets[-1]["label"]


@pytest.fixture
def impact_data(app):
    """Seed date boundaries, excluded records, null amounts and execution statuses."""
    with app.app_context():
        first = Customer(name="Full Name", nickname="Impact Alias", tpid=123)
        second = Customer(name="Second Account", tpid=124)
        db.session.add_all([first, second])
        db.session.flush()
        boundary = datetime(2026, 5, 1, tzinfo=timezone.utc)
        defaults = dict(
            customer_id=first.id, on_my_team=True, customer_commitment="Committed",
            committed_at=boundary, due_date=datetime(2027, 1, 1, tzinfo=timezone.utc),
            msx_status="On Track", monthly_usage=10.49, workload="Data: Fabric",
        )
        variations = [
            ("Boundary", {}),
            ("Completed included", {"msx_status": "Completed", "monthly_usage": 20.51}),
            ("Cancelled included", {"msx_status": "Cancelled", "monthly_usage": None}),
            ("Unknown included", {"msx_status": None, "workload": None, "due_date": None}),
            ("Second account", {"customer_id": second.id, "monthly_usage": 100.25}),
            ("Before boundary", {"committed_at": datetime(2026, 4, 30, 23, 59, 59,
                                                          tzinfo=timezone.utc)}),
            ("No commitment date", {"committed_at": None}),
            ("Off team", {"on_my_team": False}),
            ("Uncommitted", {"customer_commitment": "Uncommitted"}),
            ("Customerless", {"customer_id": None}),
        ]
        for title, changes in variations:
            db.session.add(Milestone(
                title=title, url=f"https://example.test/{title}", **(defaults | changes),
            ))
        db.session.commit()
        return first.id, second.id


@pytest.mark.parametrize("embedded", [False, True])
def test_native_ranking_and_milestone_panes(client, impact_data, embedded):
    """Keep ranking and milestone fields on native full-page or embedded surfaces."""
    response = client.get("/reports/connect-impact?since=2026-05-01"
                          + ("&embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-impact]")
    for frame in ("sb-directory-frame", "sb-directory-frame-wide"):
        assert (frame in root.get("class", [])) is not embedded
    assert root["data-since"] == "2026-05-01"
    assert root["data-embedded"] == str(embedded).lower()
    options = root.select("#impactDatePreset option")
    assert [option["value"] for option in options] == [
        "", *[preset["since"] for preset in _get_connect_impact_date_presets(date.today())],
    ]
    assert bool(soup.select_one("body.sb-page-frame")) is not embedded
    assert bool(soup.select_one("footer.sb-page-status")) is not embedded
    assert not root.select(".card, .badge, .table-responsive, [onclick], [data-bs-toggle]")
    assert all(th.has_attr("data-sb-sort-type") for th in root.select("thead th"))
    first, second = impact_data
    rows = root.select("#impactCustomers tbody tr")
    assert [row["data-customer-id"] for row in rows] == [str(second), str(first)]
    assert [row.select("td")[0].get_text(strip=True) for row in rows] == ["1", "2"]
    assert root.select_one(".sb-impact-total strong").get_text(strip=True) == "$142/mo"
    assert rows[0].select("td")[2]["data-sb-sort-value"] == "100.25"
    assert rows[1].select("td")[3]["data-sb-sort-value"] == "4"
    detail = root.select_one(f'[data-impact-customer="{first}"]')
    assert detail.select_one("h2 a")["href"] == f"/customer/{first}"
    assert detail.select_one("h2 a").get_text(strip=True) == "Impact Alias"
    table = detail.select_one("[data-impact-table]")
    assert table["data-sb-sort-default-column"] == "3"
    assert table["data-sb-sort-default-direction"] == "descending"
    assert not table.has_attr("data-sb-sortable")
    milestones = table.select("tbody tr")
    assert len(milestones) == 4
    assert [node.get_text(strip=True) for node in detail.select("[data-impact-preview]")] == [
        "Boundary", "Completed included", "Cancelled included", "Unknown included",
    ]
    assert milestones[0].select("td")[3]["data-sb-sort-value"] == "10.49"
    assert milestones[2].select("td")[3]["data-sb-sort-value"] == "0"
    assert milestones[3].select("td")[1]["data-sb-sort-value"] == ""
    assert milestones[3].select("td")[2].get_text(strip=True) == "Unknown"
    assert milestones[3].select("td")[4]["data-sb-sort-value"] == ""
    assert milestones[0].select("td")[4]["data-sb-sort-value"] == "2027-01-01"
    for title in ["Before boundary", "No commitment date", "Off team", "Uncommitted",
                  "Customerless"]:
        assert title not in root.get_text()
    assert "ui-impact.js" in response.text


def test_empty_and_invalid_date_render_authoritative_scope(client):
    """Keep the server's five-month fallback and useful empty guidance."""
    response = client.get("/reports/connect-impact?since=2026-02-31")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-impact]")
    assert root["data-since"] == root.select_one("#impactSinceDate")["value"]
    assert root["data-since"] != "2026-02-31"
    assert not root.select_one("#impactCustomers")
    assert "No committed on-team milestones since" in root.get_text()
    assert "run an MSX sync" in root.get_text()
    assert root.select_one(".sb-impact-total strong").get_text(strip=True) == "$0/mo"


def test_matching_shortcut_selected_and_no_quarter_end_filter(client, app):
    """Preset selection reflects the effective date and remains an open-ended since filter."""
    presets = _get_connect_impact_date_presets(date.today())
    start = date.fromisoformat(presets[0]["since"])
    with app.app_context():
        customer = Customer(name="Fiscal Account", tpid=125)
        db.session.add(customer)
        db.session.flush()
        db.session.add(Milestone(
            title="Committed after Q1", url="https://example.test/fiscal",
            customer_id=customer.id, on_my_team=True, customer_commitment="Committed",
            committed_at=datetime(start.year, 10, 1, tzinfo=timezone.utc),
            monthly_usage=123,
        ))
        db.session.commit()
    response = client.get(f"/reports/connect-impact?since={start.isoformat()}")
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one("#impactDatePreset option[selected]")["value"] == start.isoformat()
    assert "Committed after Q1" in soup.select_one("[data-sb-impact]").get_text()
