"""Native tracker presentation preserves the existing cache and shared detail contracts."""

from datetime import datetime
from pathlib import Path
import shutil
import subprocess
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from app.models import Milestone, db
from app.services.milestone_sync import get_milestone_tracker_data


@pytest.fixture
def tracker_records(app, sample_data) -> list[int]:
    """Create isolated records with raw precision, missing fields and distinct order keys."""
    records = [
        Milestone(
            title="Smaller milestone", url="https://example.test/small",
            customer_id=sample_data["customer1_id"], monthly_usage=1200.75,
            due_date=datetime(2026, 10, 20), msx_status="On Track",
            customer_commitment="Committed", on_my_team=True, workload="Data: Fabric",
        ),
        Milestone(
            title="Larger milestone", url="https://example.test/large",
            customer_id=sample_data["customer2_id"], monthly_usage=9000.25,
            due_date=datetime(2026, 12, 2), msx_status="Blocked",
            customer_commitment="Uncommitted", workload="Infra: Windows",
        ),
        Milestone(
            title="Undated milestone", url="https://example.test/undated",
            customer_id=sample_data["customer1_id"], msx_status="At Risk",
        ),
    ]
    db.session.add_all(records)
    db.session.commit()
    return [record.id for record in records]


def test_native_tracker_preserves_provider_order_and_every_raw_key(
    client, tracker_records,
) -> None:
    """Sorting is opt-in without changing default population, values, dates or destinations."""
    expected = get_milestone_tracker_data()["milestones"]
    soup = BeautifulSoup(client.get("/reports/milestone-tracker").data, "html.parser")
    root = soup.select_one("[data-sb-page-surface]")
    assert "sb-page-frame" in soup.body["class"]
    assert not root.select(".card, .table-responsive, [data-bs-toggle]")
    table = root.find(id="msListTable")
    assert table.has_attr("data-sb-sortable")
    assert not table.has_attr("data-sb-sort-default-column")
    rows = table.select("tbody .milestone-row")
    assert [row.select_one("td")["data-sb-sort-value"] for row in rows] == [
        record["title"] for record in expected
    ]
    for row, record in zip(rows, expected):
        cells = row.select("td")
        assert cells[5]["data-sb-sort-value"] == (
            record["due_date"].strftime("%Y-%m-%d") if record["due_date"] else ""
        )
        assert cells[6]["data-sb-sort-value"] == (
            str(record["monthly_usage"]) if record["monthly_usage"] is not None else ""
        )
        assert cells[0]["data-export-url"] == record["url"]
        assert row["data-commitment"] == (record["customer_commitment"] or "")
    headers = table.select("th[data-sb-sort-type]")
    assert len(headers) == 8
    assert all(h["data-export-label"] == h.get_text(strip=True) for h in headers)
    assert not any(h.has_attr("data-sb-sort-type") for h in table.select("th")[-2:])
    assert len(soup.select('script[src="/static/js/ui-table-sort.js"]')) == 1
    assert soup.select_one("footer.sb-page-status #trackerStatus")
    assert soup.select_one(".milestone-tracker-instance > .mt-reading > .mt-list")
    assert soup.find(id="milestonePreviewDialog").name == "dialog"
    assert soup.find(id="reportExportNoticeTemplate")


def test_tracker_alias_and_locked_seller_contract(client, tracker_records, sample_data) -> None:
    """The original alias and seller lock retain routing and filtered membership."""
    response = client.get("/milestone-tracker")
    assert response.status_code == 301
    assert response.headers["Location"].endswith("/reports/milestone-tracker")
    with patch(
        "app.routes.milestones.get_seller_mode_seller_id",
        return_value=sample_data["seller1_id"],
    ):
        soup = BeautifulSoup(client.get("/reports/milestone-tracker").data, "html.parser")
    assert not soup.select_one('[data-role="sellerFilter"]')
    assert len(soup.select("th[data-sb-sort-type]")) == 7
    assert all(row["data-customer-id"] == str(sample_data["customer1_id"])
               for row in soup.select(".milestone-row"))
    seller = BeautifulSoup(
        client.get(f'/seller/{sample_data["seller1_id"]}').data, "html.parser"
    )
    assert seller.select_one(".milestone-tracker-instance > .mt-reading")
    assert len(seller.select('script[src="/static/js/ui-milestone-tracker-actions.js"]')) == 1


def test_tracker_empty_scope_retains_commands_and_calendar(client) -> None:
    """An empty cache can still sync, inspect scope and switch to the calendar."""
    soup = BeautifulSoup(client.get("/reports/milestone-tracker").data, "html.parser")
    assert soup.find(id="syncBtn")
    assert soup.find(id="syncBtnEmpty")
    assert soup.find(id="msCalendarWrap")
    assert soup.select_one('[data-role="noResults"][hidden]')


def test_tracker_filters_share_one_toolbar_and_keep_reset(client, tracker_records) -> None:
    """Both filter groups share a toolbar, while the count leaves room for active Reset."""
    soup = BeautifulSoup(client.get("/reports/milestone-tracker").data, "html.parser")
    toolbar = soup.select_one(".mt-scope > .mt-filter-row")
    assert toolbar is not None
    for role in (
        "searchFilter", "customerDropdownBtn", "sellerFilter", "quarterDropdown",
        "myTeamFilter", "statusDropdownBtn", "commitmentFilter", "urgencyFilter",
        "favoritesOnlyBtn", "resetFiltersBtn",
    ):
        assert toolbar.select_one(f'[data-role="{role}"]')
    assert soup.select_one('.mt-summary [data-role="filteredCount"]')
    assert not toolbar.select_one('[data-role="filteredCount"]')


def test_tracker_shared_controller_has_no_bootstrap_dependency() -> None:
    """Loaded seller fragments use native pickers and the one globally loaded sorter."""
    partial = (Path(__file__).parents[1] / "templates" / "partials"
               / "milestone_tracker_content.html").read_text(encoding="utf-8")
    assert "bootstrap." not in partial
    assert "SBTableSort.mount(container)" in partial
    assert "sortTable(" not in partial
    assert "SBMilestonePreview.open(msId, msTitle, msStatus, msUrl)" in partial


def test_rendered_tracker_scripts_parse_without_generated_files(client, tracker_records) -> None:
    """The actual Jinja output parses as JavaScript, including original calendar and sync."""
    node = shutil.which("node")
    assert node is not None
    soup = BeautifulSoup(client.get("/reports/milestone-tracker").data, "html.parser")
    for script in soup.find_all("script", src=False):
        result = subprocess.run(
            [node, "--check"], input=script.get_text(), text=True, capture_output=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
