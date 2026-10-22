"""Owned-HVA browsing and explicitly confirmed completion without live MSX writes."""

import shutil
import subprocess
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, Job, Milestone, MsxTask, PrefetchedMeeting, SyncStatus, db
from app.services.hva_inventory import get_hva_inventory
from app.services.msx_api import TASK_CATEGORIES
from app.services.salesiq_tools import execute_tool


@pytest.fixture
def hva_rows(client):
    """Create linked and unlinked activities across all MSX states in the test DB."""
    category = next(c for c in TASK_CATEGORIES if c["is_hva"])
    customer = Customer(name="Inventory customer", tpid=987654)
    db.session.add(customer)
    db.session.flush()
    milestone = Milestone(
        customer_id=customer.id, title="Inventory milestone",
        msx_milestone_id="inventory-milestone", url="https://example.test/milestone",
    )
    db.session.add(milestone)
    db.session.flush()
    rows = []
    for name, state, linked, created in (
        ("Open session", 0, True, datetime(2026, 10, 1, 9)),
        ("Completed session", 1, True, datetime(2026, 10, 2, 23, 59, 59)),
        ("Canceled session", 2, False, datetime(2020, 1, 1)),
        ("Unknown session", None, False, None),
    ):
        row = MsxTask(
            msx_task_id=f"inventory-{state}", subject=name, task_category=category["value"],
            task_category_name=category["label"], is_hva=True, statecode=state,
            milestone_id=milestone.id if linked else None,
            msx_regarding_name=None if linked else "Outside local inventory",
            msx_created_on=created, due_date=datetime(2026, 10, 3, 23, 59, 59),
            actual_end=datetime(2026, 10, 2, 23, 59, 59) if state == 1 else None,
        )
        db.session.add(row)
        rows.append(row)
    for task_id, is_hva, code, owned in (
        ("not-owned", True, category["value"], False),
        ("not-hva", False, 0, True),
        ("old-category", True, 0, True),
    ):
        db.session.add(MsxTask(
            msx_task_id=task_id, subject=task_id, task_category=code, is_hva=is_hva,
            is_current_owner=owned, milestone_id=milestone.id,
        ))
    db.session.commit()
    return {"rows": rows, "category": category, "customer": customer, "milestone": milestone}


def test_inventory_counts_each_owned_hva_once_including_unlinked_and_old_tasks(hva_rows):
    """No meeting, note, current-FY, active-milestone or local-customer gate hides activities."""
    data = get_hva_inventory(per_page=1)
    assert data["summary"] == {"total": 4, "open": 1, "completed": 1,
                               "canceled": 1, "unknown": 1}
    assert data["pages"] == 4
    assert len(data["rows"]) == 1
    all_rows = get_hva_inventory()["rows"]
    assert len({row["msx_task_id"] for row in all_rows}) == 4
    unknown = next(row for row in all_rows if row["statecode"] is None)
    assert unknown["status"] == "Unknown"
    assert unknown["created"] is None
    assert unknown["milestone_id"] is None
    assert unknown["related"] == "Outside local inventory"
    assert data["complete_inventory"] is False
    SyncStatus.mark_completed("owned_tasks", success=True)
    assert get_hva_inventory()["complete_inventory"] is True


def test_status_customer_category_search_and_inclusive_utc_date_windows(hva_rows):
    """Filters apply to the activity itself and full matching totals, not to its parent date."""
    assert get_hva_inventory(status="completed")["summary"]["total"] == 1
    assert get_hva_inventory(customer_id=hva_rows["customer"].id)["summary"]["total"] == 2
    assert get_hva_inventory(category=hva_rows["category"]["value"])["summary"]["total"] == 4
    assert get_hva_inventory(search="Outside local")["summary"]["total"] == 2
    for field in ("created", "completed"):
        data = get_hva_inventory(date_field=field, date_from="2026-10-02", date_to="2026-10-02")
        assert [row["subject"] for row in data["rows"]] == ["Completed session"]
    assert get_hva_inventory(date_field="due", date_to="2026-10-03")["summary"]["total"] == 4
    assert get_hva_inventory(date_field="due", date_from="2026-10-04")["summary"]["total"] == 0


@pytest.mark.parametrize("sort", ["subject", "status", "category", "customer", "related",
                                 "created", "due", "completed"])
@pytest.mark.parametrize("direction", ["asc", "desc"])
def test_sorting_is_global_across_pages_with_stable_ties_and_unknowns_last(
    hva_rows, sort, direction,
):
    """Paging cannot sort only the currently visible records."""
    all_rows = get_hva_inventory(sort=sort, direction=direction)["rows"]
    by_id = sorted(all_rows, key=lambda row: row["id"], reverse=True)
    expected = sorted(
        (row for row in by_id if row[sort] is not None),
        key=lambda row: row[sort].lower(), reverse=direction == "desc",
    ) + [row for row in by_id if row[sort] is None]
    assert [row["id"] for row in all_rows] == [row["id"] for row in expected]
    paged = [
        get_hva_inventory(sort=sort, direction=direction, per_page=1, page=page)["rows"][0]
        for page in range(1, 5)
    ]
    assert [row["id"] for row in paged] == [row["id"] for row in all_rows]
    if sort in ("created", "completed", "customer", "related"):
        values = [row[sort] for row in all_rows]
        if None in values:
            assert values[-1] is None


@pytest.mark.parametrize("query", [
    "status=bogus", "category=0", "category=abc", "customer_id=-1",
    "date_field=call_date", "date_from=not-a-date",
    "date_from=2026-10-03&date_to=2026-10-01",
    "sort=bogus", "direction=random", "page=0", "per_page=101",
])
def test_invalid_inventory_filters_fail_explicitly_without_admitting_work(client, query):
    """Bad inputs never silently widen the report or trigger a sync."""
    response = client.get(f"/api/reports/hvas?{query}")
    assert response.status_code == 400
    assert response.json["success"] is False
    assert response.json["error"]
    assert Job.query.count() == 0


def test_view_discovery_shared_refresh_and_read_tool_match_the_inventory(client, hva_rows):
    """Browse, Reports, breadcrumbs and SalesIQ expose the same read-only activity view."""
    response = client.get("/reports/hvas?status=completed&per_page=25")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one("body.sb-page-frame")
    assert soup.h1.get_text() == "HVAs"
    assert soup.select_one('#navBrowse a[href="/reports/hvas"]')
    assert soup.select_one('#navReports a[href="/reports/hvas"]')
    assert soup.select_one('.sb-context-bar a[href="/reports"]')
    assert len(soup.select("#hvaTable tbody tr")) == 1
    assert soup.select_one("#hvaTable[data-sb-sort-server]")
    assert len(soup.select("#hvaTable th[data-sb-sort-type]")) == 8
    assert soup.select_one('[data-sb-sync-progress="activity-reconciliation"]')
    assert "HVAs" in client.get("/reports").get_data(as_text=True)
    api = client.get("/api/reports/hvas?status=completed&per_page=25").json
    tool = execute_tool("report_hvas", {"status": "completed", "per_page": 25})
    assert api["summary"] == tool["summary"] == {"total": 1, "open": 0, "completed": 1,
                                               "canceled": 0, "unknown": 0}
    assert api["rows"] == tool["rows"]
    assert Job.query.count() == 0


def test_empty_inventory_teaches_refresh_without_sync_on_get(client):
    """An uninitialized report is honest about what has not been imported."""
    soup = BeautifulSoup(client.get("/reports/hvas").data, "html.parser")
    assert "No HVA tasks synced yet" in soup.get_text()
    assert Job.query.count() == 0


def test_custom_valid_page_size_remains_selected_in_the_browser(client, hva_rows):
    """A valid API/tool page size must not disagree with the browser's selected value."""
    soup = BeautifulSoup(client.get("/reports/hvas?per_page=1").data, "html.parser")
    assert soup.select_one("#hvaPageSize option[selected]")["value"] == "1"
    assert len(soup.select("#hvaTable tbody tr")) == 1


def test_completion_controls_are_only_available_for_open_and_unknown_hvas(client, hva_rows):
    """Completed and canceled activities have no action, even when the report is filtered."""
    soup = BeautifulSoup(client.get("/reports/hvas").data, "html.parser")
    actions = soup.select("[data-hva-action]")
    assert len(actions) == 2
    for task in hva_rows["rows"]:
        row = soup.select_one(f'tr[data-task-id="{task.id}"]')
        assert bool(row.select_one("[data-hva-complete]")) == (task.statecode in (0, None))
    assert all(action.select_one("[data-hva-confirmation]").has_attr("hidden")
               for action in actions)


@pytest.mark.parametrize("state", [0, None, 99])
def test_completion_updates_msx_and_cache_without_deleting_activity_links(
    client, hva_rows, sample_data, monkeypatch, state,
):
    """The remote write uses the existing client and preserves all historical relationships."""
    task = hva_rows["rows"][0]
    now = datetime.now(timezone.utc)
    meeting = PrefetchedMeeting(
        workiq_id="hva-completion-meeting", subject="HVA completion meeting",
        meeting_date=date.today(), start_time=now, end_time=now + timedelta(minutes=30),
        expires_at=now + timedelta(days=1),
    )
    db.session.add(meeting)
    db.session.flush()
    task.statecode = state
    task.note_id = sample_data["call1_id"]
    task.meeting_id = meeting.id
    db.session.commit()
    before = (task.id, task.milestone_id, task.note_id, task.meeting_id)
    close = Mock(return_value={"success": True})
    monkeypatch.setattr("app.services.msx_api.close_task", close)
    response = client.post(f"/api/reports/hvas/{task.id}/complete")
    assert response.status_code == 200
    assert response.json["success"] is True
    close.assert_called_once_with(task.msx_task_id)
    db.session.refresh(task)
    assert (task.id, task.milestone_id, task.note_id, task.meeting_id) == before
    assert task.statecode == 1
    assert task.statuscode == 5
    assert now <= task.actual_end.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc)
    assert MsxTask.query.count() == 7
    assert get_hva_inventory()["summary"]["completed"] == 2
    assert get_hva_inventory(status="open")["summary"]["total"] == 0
    completed = task.actual_end
    assert client.post(f"/api/reports/hvas/{task.id}/complete").json["already_completed"]
    assert close.call_count == 1
    db.session.refresh(task)
    assert task.actual_end == completed


def test_completion_supports_unknown_tasks_outside_local_milestones(client, hva_rows, monkeypatch):
    """Completing an unlinked owned HVA must not require inventing a local milestone."""
    task = hva_rows["rows"][3]
    close = Mock(return_value={"success": True})
    monkeypatch.setattr("app.services.msx_api.close_task", close)
    assert client.post(f"/api/reports/hvas/{task.id}/complete").json["success"] is True
    db.session.refresh(task)
    assert task.milestone_id is None
    assert task.statecode == 1


@pytest.mark.parametrize("task_name, expected_status", [
    ("Canceled session", 409), ("not-owned", 404), ("not-hva", 404), ("old-category", 404),
])
def test_ineligible_completion_is_rejected_without_an_msx_write(
    client, hva_rows, monkeypatch, task_name, expected_status,
):
    """The canceled policy and ownership/category gates are enforced server-side."""
    task = MsxTask.query.filter_by(subject=task_name).one()
    original_state = task.statecode
    close = Mock()
    monkeypatch.setattr("app.services.msx_api.close_task", close)
    response = client.post(f"/api/reports/hvas/{task.id}/complete")
    assert response.status_code == expected_status
    assert response.json["success"] is False
    assert response.json["error"]
    close.assert_not_called()
    db.session.refresh(task)
    assert task.statecode == original_state


def test_msx_completion_failure_keeps_cached_status_and_reports_error(client, hva_rows, monkeypatch):
    """Remote failures must never look like completed activities."""
    task = hva_rows["rows"][0]
    monkeypatch.setattr("app.services.msx_api.close_task", Mock(return_value={
        "success": False, "error": "Access denied in MSX",
    }))
    response = client.post(f"/api/reports/hvas/{task.id}/complete")
    assert response.status_code == 502
    assert response.json["error"] == "Access denied in MSX"
    db.session.refresh(task)
    assert task.statecode == 0
    assert task.actual_end is None


def test_completion_cache_failure_exposes_successful_remote_change(client, hva_rows, monkeypatch):
    """A failed cache commit explicitly advises reconciliation rather than repeating the write."""
    task = hva_rows["rows"][0]
    monkeypatch.setattr("app.services.msx_api.close_task", Mock(return_value={"success": True}))
    monkeypatch.setattr(db.session, "commit", Mock(side_effect=SQLAlchemyError("Disk full")))
    response = client.post(f"/api/reports/hvas/{task.id}/complete")
    assert response.status_code == 500
    assert response.json["remote_changed"] is True
    assert "Refresh MSX tasks" in response.json["error"]
    db.session.refresh(task)
    assert task.statecode == 0


def test_completion_is_post_only_and_unknown_id_is_explicit(client, monkeypatch):
    """Merely reading the report or following a URL cannot complete an activity."""
    close = Mock()
    monkeypatch.setattr("app.services.msx_api.close_task", close)
    assert client.get("/api/reports/hvas/12345/complete").status_code == 405
    response = client.post("/api/reports/hvas/12345/complete")
    assert response.status_code == 404
    assert response.json["error"]
    close.assert_not_called()


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is required for JS tests")
def test_hva_browser_controls():
    """Validate filtered navigation and the existing shared-sync completion contract."""
    test_file = Path(__file__).parent / "js" / "ui_hvas.test.cjs"
    result = subprocess.run(
        ["node", "--test", str(test_file)], capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
