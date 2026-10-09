"""Read-only refresh metadata consumed by the Home freshness strip."""

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.models import SyncStatus


@pytest.mark.parametrize("sync_type", ["milestones", "revenue_sync", "accounts", "u2c_import"])
@pytest.mark.parametrize("success", [True, False])
def test_home_freshness_status_serializes_real_attempt_without_starting_refresh(
    app: Flask, client: FlaskClient, sync_type: str, success: bool,
) -> None:
    """The status API reads stored completion time/state and leaves them unchanged."""
    with app.app_context():
        SyncStatus.mark_started(sync_type)
        SyncStatus.mark_completed(sync_type, success=success, items_synced=7)
        record = SyncStatus.query.filter_by(sync_type=sync_type).one()
        before = (record.started_at, record.completed_at, record.success)
        expected_timestamp = record.completed_at.isoformat()

    response = client.get(f"/api/admin/sync-status/{sync_type}")
    assert response.status_code == 200
    assert response.json == {
        "state": "complete" if success else "failed",
        "completed_at": expected_timestamp,
        "items_synced": 7,
    }
    with app.app_context():
        record = SyncStatus.query.filter_by(sync_type=sync_type).one()
        assert (record.started_at, record.completed_at, record.success) == before


@pytest.mark.parametrize("sync_type", ["milestones", "revenue_sync", "accounts", "u2c_import"])
def test_home_freshness_no_history_is_not_a_success(
    app: Flask, client: FlaskClient, sync_type: str,
) -> None:
    """No history remains explicitly never-run and the GET creates no sync row."""
    response = client.get(f"/api/admin/sync-status/{sync_type}")
    assert response.status_code == 200
    assert response.json == {"state": "never_run", "completed_at": None, "items_synced": None}
    with app.app_context():
        assert SyncStatus.query.filter_by(sync_type=sync_type).first() is None


def test_home_freshness_acr_honors_legacy_file_import(app: Flask, client: FlaskClient) -> None:
    """Existing ACR loaded from files has a real refresh timestamp, not never-run."""
    with app.app_context():
        SyncStatus.mark_started("revenue_import")
        SyncStatus.mark_completed("revenue_import", success=True, items_synced=3)
        record = SyncStatus.query.filter_by(sync_type="revenue_import").one()
        expected = record.completed_at.isoformat()
    response = client.get("/api/admin/sync-status/revenue_sync")
    assert response.status_code == 200
    assert response.json["state"] == "complete"
    assert response.json["completed_at"] == expected
    with app.app_context():
        assert SyncStatus.query.filter_by(sync_type="revenue_sync").first() is None


def test_home_freshness_acr_does_not_hide_failed_api_refresh(
    app: Flask, client: FlaskClient,
) -> None:
    """A successful old file import cannot mask a failed newer API refresh."""
    with app.app_context():
        SyncStatus.mark_started("revenue_import")
        SyncStatus.mark_completed("revenue_import", success=True)
        SyncStatus.mark_started("revenue_sync")
        SyncStatus.mark_completed("revenue_sync", success=False)
    response = client.get("/api/admin/sync-status/revenue_sync")
    assert response.status_code == 200
    assert response.json["state"] == "failed"


def test_home_freshness_unknown_sync_type_still_rejected(client: FlaskClient) -> None:
    """Extending the known read types does not make arbitrary sync records public."""
    response = client.get("/api/admin/sync-status/not-a-sync")
    assert response.status_code == 400
    assert response.json == {"error": "Unknown sync type"}
