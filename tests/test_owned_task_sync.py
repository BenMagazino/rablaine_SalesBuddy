"""Complete owned-task pulls reuse the existing task stage without live authentication."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.models import Milestone, MsxTask, SyncStatus, db
from app.services import milestone_sync, msx_api


def response(status: int, payload: dict) -> SimpleNamespace:
    """Represent only the HTTP response surfaces used by the MSX task reader."""
    return SimpleNamespace(status_code=status, json=lambda: payload, text="Test response")


def finish_tasks() -> dict:
    """Consume persisted task-stage progress and return its terminal result."""
    generator = milestone_sync._sync_all_tasks()
    try:
        while True:
            next(generator)
    except StopIteration as done:
        return done.value


def test_owner_query_follows_every_page_without_milestone_state_or_date_filters(monkeypatch):
    """The existing reader now supports the complete inventory as well as scoped callers."""
    monkeypatch.setattr(msx_api, "get_current_user_id", lambda: "current-owner")
    raw = {
        "activityid": "owned-task", "subject": "Completed HVA", "statecode": 1,
        "msp_taskcategory": 861980002, "_regardingobjectid_value": "outside-sb",
        "_regardingobjectid_value@Microsoft.Dynamics.CRM.lookuplogicalname": "account",
        "_regardingobjectid_value@OData.Community.Display.V1.FormattedValue": "Related account",
    }
    fetch = Mock(side_effect=[
        response(200, {"value": [raw], "@odata.nextLink": "https://example.test/next"}),
        response(200, {"value": [{**raw, "activityid": "second-task"}]}),
    ])
    monkeypatch.setattr(msx_api, "_msx_request", fetch)
    result = msx_api.get_tasks_for_milestones(None)
    assert result["success"] is True
    assert len(result["tasks"]) == 2
    url = fetch.call_args_list[0].args[1]
    assert "_ownerid_value eq 'current-owner'" in url
    assert "_regardingobjectid_value eq" not in url
    assert "statecode eq" not in url
    assert "createdon ge" not in url
    assert result["tasks"][1]["regarding_type"] == "account"
    assert result["tasks"][1]["regarding_name"] == "Related account"
    assert msx_api.get_tasks_for_milestones([]) == {"success": True, "tasks": []}
    assert fetch.call_count == 2


@pytest.mark.parametrize("last_page", [
    response(403, {}), response(200, {}), response(200, {"value": [{}]}),
    response(200, {"value": [], "@odata.nextLink": "https://example.test/next"}),
])
def test_failed_malformed_or_repeated_page_is_not_a_successful_empty_snapshot(monkeypatch, last_page):
    """Partial results cannot erase ownership membership or claim a complete inventory."""
    monkeypatch.setattr(msx_api, "get_current_user_id", lambda: "current-owner")
    monkeypatch.setattr(msx_api, "_msx_request", Mock(side_effect=[
        response(200, {"value": [{"activityid": "partial"}],
                       "@odata.nextLink": "https://example.test/next"}),
        last_page,
    ]))
    result = msx_api.get_tasks_for_milestones(None)
    assert result["success"] is False
    assert result["tasks"] == []
    assert result["error"]


def test_customer_scoped_reader_keeps_its_milestone_filter(monkeypatch):
    """Existing picker and customer refresh callers do not become owner-wide requests."""
    monkeypatch.setattr(msx_api, "get_current_user_id", lambda: "current-owner")
    fetch = Mock(return_value=response(200, {"value": []}))
    monkeypatch.setattr(msx_api, "_msx_request", fetch)
    assert msx_api.get_tasks_for_milestones(["first-ms", "second-ms"])["success"] is True
    url = fetch.call_args.args[1]
    assert "_ownerid_value eq 'current-owner'" in url
    assert "_regardingobjectid_value eq 'first-ms'" in url
    assert "_regardingobjectid_value eq 'second-ms'" in url


def test_all_owned_stage_preserves_links_imports_unlinked_and_retires_old_ownership(
    monkeypatch, sample_data,
):
    """Refresh updates existing IDs and links without excluding outside-inventory HVAs."""
    milestone = Milestone(title="Local milestone", msx_milestone_id="local-ms",
                          url="https://example.test/ms")
    db.session.add(milestone)
    db.session.flush()
    task = MsxTask(msx_task_id="owned", subject="Old", task_category=861980002,
                   is_hva=True, milestone_id=milestone.id, note_id=sample_data["call1_id"])
    transferred = MsxTask(msx_task_id="transferred", subject="Transferred",
                         task_category=861980002, is_hva=True, milestone_id=milestone.id)
    db.session.add_all([task, transferred])
    db.session.commit()
    task_id, note_id = task.id, task.note_id
    fetch = Mock(return_value={"success": True, "tasks": [
        {"task_id": "owned", "subject": "Updated", "task_category": 861980002,
         "milestone_msx_id": "local-ms", "statecode": 1, "statuscode": 5},
        {"task_id": "outside", "subject": "Outside SB", "task_category": 861980002,
         "milestone_msx_id": "unknown-account", "regarding_type": "account"},
    ]})
    monkeypatch.setattr(milestone_sync, "get_tasks_for_milestones", fetch)
    result = finish_tasks()
    assert result["success"] is True
    assert result["tasks_created"] == 1
    assert result["tasks_updated"] == 1
    fetch.assert_called_once_with(None)
    db.session.expire_all()
    preserved = db.session.get(MsxTask, task_id)
    assert preserved.note_id == note_id
    assert preserved.milestone_id == milestone.id
    assert preserved.subject == "Updated"
    assert preserved.statecode == 1
    assert preserved.is_current_owner is True
    assert db.session.get(MsxTask, transferred.id).is_current_owner is False
    outside = MsxTask.query.filter_by(msx_task_id="outside").one()
    assert outside.milestone_id is None
    assert outside.msx_regarding_id == "unknown-account"
    assert outside.msx_regarding_type == "account"
    assert SyncStatus.get_status("owned_tasks")["state"] == "complete"


def test_no_local_milestones_still_imports_owned_tasks_and_failed_refresh_preserves_them(
    client, monkeypatch,
):
    """A complete inventory does not require first importing a customer or milestone."""
    fetch = Mock(return_value={"success": True, "tasks": [{
        "task_id": "standalone", "subject": "Standalone", "task_category": 861980002,
    }]})
    monkeypatch.setattr(milestone_sync, "get_tasks_for_milestones", fetch)
    assert finish_tasks()["success"] is True
    task = MsxTask.query.filter_by(msx_task_id="standalone").one()
    assert task.milestone_id is None
    completed = SyncStatus.get_status("owned_tasks")["completed_at"]
    for failure in ({"success": False, "error": "Remote unavailable"}, {"success": True}):
        fetch.return_value = failure
        assert finish_tasks()["success"] is False
        db.session.refresh(task)
        assert task.is_current_owner is True
        assert SyncStatus.get_status("owned_tasks")["completed_at"] == completed
    fetch.return_value = {"success": True, "tasks": []}
    assert finish_tasks()["success"] is True
    db.session.refresh(task)
    assert task.is_current_owner is False
    assert MsxTask.query.count() == 1


def test_owned_stage_database_failure_rolls_back_membership_and_new_tasks(client, monkeypatch):
    """Inventory rows and freshness are one transaction, including on commit failures."""
    task = MsxTask(msx_task_id="old-owner-task", subject="Preserve me",
                   task_category=861980002, is_hva=True)
    db.session.add(task)
    db.session.commit()
    monkeypatch.setattr(milestone_sync, "get_tasks_for_milestones", Mock(return_value={
        "success": True, "tasks": [{"task_id": "new", "subject": "Do not partially save"}],
    }))
    monkeypatch.setattr(SyncStatus, "mark_completed", Mock(side_effect=RuntimeError("Disk full")))
    result = finish_tasks()
    assert result["success"] is False
    assert "Disk full" in result["error"]
    assert result["tasks_created"] == 0
    db.session.refresh(task)
    assert task.is_current_owner is True
    assert MsxTask.query.count() == 1
    assert SyncStatus.query.filter_by(sync_type="owned_tasks").first() is None


def test_owned_stage_fetch_exception_reports_failure_without_membership_changes(client, monkeypatch):
    """An unexpected reader exception is observable and cannot clear cached inventory."""
    task = MsxTask(msx_task_id="owned", subject="Keep", task_category=861980002, is_hva=True)
    db.session.add(task)
    db.session.commit()
    monkeypatch.setattr(milestone_sync, "get_tasks_for_milestones",
                        Mock(side_effect=RuntimeError("Connection failed")))
    result = finish_tasks()
    assert result["success"] is False
    assert "Connection failed" in result["error"]
    db.session.refresh(task)
    assert task.is_current_owner is True
