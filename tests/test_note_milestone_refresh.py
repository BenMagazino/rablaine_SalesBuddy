"""Durable, read-only note milestone refresh and browser controller regressions."""

import json
import shutil
import subprocess
from pathlib import Path
from unittest.mock import Mock

import pytest

from app.models import Customer, Job, Milestone, Note, db
from app.services import job_queue, sync_jobs


@pytest.fixture
def picker_customer():
    """Create an isolated linked customer without touching development data."""
    customer = Customer(
        name="Picker customer",
        tpid=12345,
        tpid_url="https://microsoftsales.crm.dynamics.com/main.aspx?"
                 "id=12345678-1234-1234-1234-123456789abc",
    )
    db.session.add(customer)
    db.session.commit()
    return customer


def test_picker_loads_join_one_durable_job_and_new_refresh_reads_fresh_choices(
    client, app, monkeypatch, picker_customer,
):
    """Initial and manual launches share the worker, without importing or saving notes."""
    fetch = Mock(side_effect=[
        {"success": True, "milestones": [{"id": "old", "name": "Existing milestone"}]},
        {"success": True, "milestones": [
            {"id": "old", "name": "Existing milestone"},
            {"id": "new", "name": "Created during the call", "status": "On Track"},
        ]},
    ])
    team = Mock(return_value={"success": True, "milestone_ids": {"new"}})
    monkeypatch.setattr("app.services.milestone_picker.get_milestones_by_account", fetch)
    monkeypatch.setattr("app.services.milestone_picker.get_my_milestone_team_ids", team)
    notes_before, milestones_before = Note.query.count(), Milestone.query.count()
    url = f"/api/msx/milestones-for-customer/{picker_customer.id}"
    receipt = client.post(url).json
    assert receipt["accepted"] is True
    job_id = receipt["job_id"]
    assert receipt["job"]["operation"] == "customer-milestones"
    assert client.post(url).json["job_id"] == job_id
    central = client.post("/api/jobs/start/customer-milestones", json={
        "customer_id": picker_customer.id, "picker_only": True,
    })
    assert central.json["job_id"] == job_id
    fetch.assert_not_called()
    team.assert_not_called()

    for expected_ids in (["old"], ["old", "new"]):
        job_queue.process_one("picker-test-worker", app=app, with_heartbeat=True)
        job = client.get(f"/api/jobs/{job_id}").json["job"]
        assert job["status"] == "done"
        assert [row["id"] for row in job["result"]["milestones"]] == expected_ids
        if len(expected_ids) == 1:
            refresh = client.post(url)
            assert refresh.status_code == 202
            assert refresh.json["job_id"] != job_id
            job_id = refresh.json["job_id"]
    assert job["result"]["milestones"][1]["on_my_team"] is True
    assert "local_milestone_id" in job["result"]["milestones"][0]
    assert fetch.call_count == 2
    for call in fetch.call_args_list:
        assert call.args == ("12345678-1234-1234-1234-123456789abc",)
        assert call.kwargs == {}  # Picker retains closed and out-of-year milestone choices.
    assert Note.query.count() == notes_before
    assert Milestone.query.count() == milestones_before
    assert Job.query.count() == 2


def test_picker_worker_failure_is_persisted_and_retryable(client, monkeypatch, picker_customer):
    """A failed remote read never yields a completed job or changes milestone data."""
    monkeypatch.setattr("app.services.milestone_picker.get_milestones_by_account",
                        lambda account: {"success": False, "error": "MSX unavailable"})
    url = f"/api/msx/milestones-for-customer/{picker_customer.id}"
    first = client.post(url).json
    job_queue.process_one("picker-test-worker")
    job = client.get(first["status_url"]).json["job"]
    assert job["status"] == "failed"
    assert "MSX unavailable" in job["error"]
    assert job["result"]["success"] is False
    assert client.post(url).json["job_id"] != first["job_id"]


@pytest.mark.parametrize("customer_id", [None, 999999])
def test_picker_setup_errors_do_not_queue_jobs(client, picker_customer, customer_id):
    """An unlinked or nonexistent customer retains the existing setup response."""
    picker_customer.tpid_url = None
    db.session.commit()
    response = client.post(
        f"/api/msx/milestones-for-customer/{customer_id or picker_customer.id}",
    )
    assert response.json["success"] is False
    assert Job.query.count() == 0
    if customer_id is None:
        assert response.json["needs_tpid"] is True


def test_picker_option_is_validated_without_changing_regular_sync_defaults(picker_customer):
    """The console exposes a strict boolean while existing syncs keep their full behavior."""
    options = sync_jobs.validate_options("customer-milestones", {
        "customer_id": picker_customer.id,
    })
    assert options["picker_only"] is False
    for value in ("true", 1, None, []):
        with pytest.raises(sync_jobs.SyncAdmissionError, match="picker_only"):
            sync_jobs.validate_options("customer-milestones", {
                **options, "picker_only": value,
            })
    full_sync = sync_jobs.admit_sync("customer-milestones", options)
    picker = sync_jobs.admit_sync("customer-milestones", {**options, "picker_only": True})
    assert picker.id != full_sync.id
    assert json.loads(picker.payload)["picker_only"] is True


def test_note_milestone_refresh_controller():
    """Execute actual note-template controller code with deterministic requests and time."""
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is required for note milestone refresh controller tests.")
    subprocess.run(
        [node, "--test", r"tests\js\note_milestone_refresh.test.cjs"],
        cwd=Path(__file__).parents[1], check=True,
    )
