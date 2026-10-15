"""Weekly Fabric scheduling and customer-tab coverage using only the isolated database."""

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
from bs4 import BeautifulSoup

from app.models import (
    Customer, FabricConsumptionImport, Job, PToFImport, SyncStatus, UserPreference, db,
)
from app.services import fabric_consumption, scheduled_sync


@pytest.fixture
def fabric_user(app):
    """Provide a Data SE and a customer, preserving the user's original settings."""
    with app.app_context():
        pref = UserPreference.query.first()
        original = pref.user_role, pref.se_specialty, pref.milestone_auto_sync
        pref.user_role, pref.se_specialty, pref.milestone_auto_sync = 'se', 'data', False
        customer = Customer(name='Weekly Fabric customer', tpid=987654321)
        db.session.add(customer)
        db.session.commit()
        yield pref, customer
        pref.user_role, pref.se_specialty, pref.milestone_auto_sync = original
        FabricConsumptionImport.query.delete()
        PToFImport.query.delete()
        SyncStatus.query.filter_by(sync_type=fabric_consumption.SYNC_TYPE).delete()
        db.session.delete(customer)
        db.session.commit()


def add_snapshot(imported_at: datetime) -> None:
    """Save a successful full snapshot with no fabricated remote measurements."""
    db.session.add(FabricConsumptionImport(
        imported_at=imported_at, customer_count=1, workload_row_count=0,
        capacity_row_count=0, trend_row_count=0, metadata_json={},
    ))
    db.session.add(PToFImport(
        imported_at=imported_at, customer_count=0, summary_count=0, detail_count=0,
    ))
    db.session.commit()


@pytest.mark.parametrize(('role', 'specialty', 'visible'), [
    ('se', 'data', True), (None, 'data', True), ('se', 'infra', False),
    ('se', 'apps_ai', False), ('se', 'other', False), ('dss', 'data', False),
])
def test_customer_fabric_tab_visibility(client, fabric_user, monkeypatch, role, specialty, visible):
    """Only Data SEs get a pinned, lazy-loaded tab; page rendering never imports."""
    pref, customer = fabric_user
    pref.user_role, pref.se_specialty = role, specialty
    db.session.commit()
    sync = Mock(side_effect=AssertionError('Rendering must not import'))
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_360', sync)
    page = BeautifulSoup(client.get(f'/customer/{customer.id}').data, 'html.parser')
    assert bool(page.select_one('#cdFabricTab')) is visible
    panel = page.select_one('#cdFabric')
    assert bool(panel) is visible
    if visible:
        assert panel.has_attr('hidden')
        root = panel.select_one('[data-fabric-report]')
        assert root['data-fabric-customer-id'] == str(customer.id)
        assert root['data-report-url'] == '/api/reports/fabric-consumption'
        assert not root.select('[data-fabric-customers], .sb-fabric-tabs')
        assert root.select_one('[data-fabric-capacities]')
        assert not root.select('[data-fabric-workloads], [data-fabric-operations], '
                               '[data-fabric-operations-prev], [data-fabric-operations-next]')
        assert root.select_one('[data-fabric-workload-chart]')
        assert not root.select('[data-fabric-workload-context], [data-fabric-overview]')
        assert root.select_one('[data-fabric-revenue]')
        assert not root.select('[data-fabric-import], [data-fabric-progress], '
                               '[data-fabric-freshness], [data-sb-sync-progress]')
        assert not panel.select('script[src*="ui-fabric-import.js"]')
    sync.assert_not_called()


@pytest.mark.parametrize('specialty', ['infra', 'apps_ai', 'other', 'unknown'])
def test_non_data_specialties_never_start_automatic_import(app, fabric_user, monkeypatch, specialty):
    """The scheduler rechecks the specialty on every cycle without touching remote data."""
    pref, _ = fabric_user
    pref.se_specialty = specialty
    db.session.commit()
    sync = Mock()
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_360', sync)
    assert scheduled_sync.run_fabric_sync_if_due(app) is None
    sync.assert_not_called()


def test_dss_does_not_sync_saved_data_specialty(app, fabric_user, monkeypatch):
    """Switching to DSS pauses automation without erasing the saved Data specialty."""
    pref, _ = fabric_user
    pref.user_role = 'dss'
    db.session.commit()
    sync = Mock()
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_360', sync)
    assert scheduled_sync.run_fabric_sync_if_due(app) is None
    sync.assert_not_called()


def test_no_valid_tpids_skips_import(app, fabric_user, monkeypatch):
    """A configured specialty alone cannot trigger an empty remote import."""
    query = Mock()
    query.filter.return_value.first.return_value = None
    monkeypatch.setattr(Customer, 'query', query)
    sync = Mock()
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_360', sync)
    assert scheduled_sync.run_fabric_sync_if_due(app) is None
    sync.assert_not_called()


@pytest.mark.parametrize('specialty', ['data', 'infra'])
def test_report_explains_current_sync_schedule(client, fabric_user, specialty):
    """Both Fabric views accurately describe the specialty-gated automatic schedule."""
    pref, _ = fabric_user
    pref.se_specialty = specialty
    db.session.commit()
    for suffix in ('', '?view=overview'):
        page = BeautifulSoup(client.get('/reports/fabric-consumption' + suffix).data,
                             'html.parser')
        footer = page.select_one('.sb-page-status').text
        assert ('Refreshes weekly' in footer) is (specialty == 'data')
        assert ('available in SE Mode with the Data SE specialty' in footer) is (
            specialty != 'data')


@pytest.mark.parametrize(('age', 'due'), [
    (timedelta(days=7) - timedelta(microseconds=1), False),
    (timedelta(days=7), True),
    (timedelta(days=8), True),
])
def test_weekly_boundary_uses_last_successful_full_snapshot(fabric_user, age, due):
    """SQLite-naive UTC timestamps retain an exact seven-day threshold."""
    now = datetime.now(timezone.utc)
    add_snapshot(now - age)
    assert scheduled_sync._fabric_sync_due(now) is due


@pytest.mark.parametrize(('fabric_age', 'renewal_age', 'due'), [
    (None, timedelta(days=1), True),
    (timedelta(days=1), None, True),
    (timedelta(days=1), timedelta(days=7), True),
    (timedelta(days=7), timedelta(days=1), True),
    (timedelta(days=1), timedelta(days=7) - timedelta(microseconds=1), False),
    (timedelta(days=1), timedelta(days=1), False),
])
def test_shared_catchup_checks_both_sources(fabric_user, fabric_age, renewal_age, due):
    """A recent first source must never hide missing or stale renewal data."""
    now = datetime.now(timezone.utc)
    add_snapshot(now)
    for model, age in ((FabricConsumptionImport, fabric_age), (PToFImport, renewal_age)):
        snapshot = model.query.one()
        if age is None:
            db.session.delete(snapshot)
        else:
            snapshot.imported_at = now - age
    db.session.commit()
    assert scheduled_sync._fabric_sync_due(now) is due


@pytest.mark.parametrize(('state', 'age', 'due'), [
    ('in_progress', timedelta(hours=2), False),
    ('failed', timedelta(hours=1) - timedelta(microseconds=1), False),
    ('failed', timedelta(hours=1), True),
    ('incomplete', timedelta(minutes=20), False),
    ('incomplete', timedelta(hours=2), True),
])
def test_failed_and_interrupted_imports_have_retry_backoff(fabric_user, monkeypatch, state, age, due):
    """Active imports are left alone and failed attempts cannot create retry storms."""
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(SyncStatus, 'get_status', Mock(return_value={
        'state': state, 'started_at': (now - age).replace(tzinfo=None),
        'completed_at': None,
    }))
    assert scheduled_sync._fabric_sync_due(now) is due


def test_recent_snapshot_is_not_invalidated_by_failed_manual_refresh(fabric_user, monkeypatch):
    """A failed manual attempt does not advance or reset the weekly successful-import clock."""
    now = datetime.now(timezone.utc)
    add_snapshot(now - timedelta(days=2))
    monkeypatch.setattr(SyncStatus, 'get_status', Mock(return_value={
        'state': 'failed', 'started_at': now - timedelta(hours=3),
        'completed_at': now - timedelta(hours=2),
    }))
    assert not scheduled_sync._fabric_sync_due(now)


def test_boot_catchup_reuses_claiming_import_and_respects_preference_changes(
    app, fabric_user, monkeypatch,
):
    """Never-imported Data SEs catch up even with milestone auto-sync off."""
    pref, _ = fabric_user
    result = {'success': True, 'customer_count': 1}
    sync = Mock(return_value=result)
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_360', sync)
    accepted = scheduled_sync.run_fabric_sync_if_due(app)
    assert accepted['accepted'] is True
    sync.assert_not_called()
    from app.services.job_queue import process_one
    process_one('test-worker')
    assert db.session.get(Job, accepted['job_id']).status == 'done'
    pref.se_specialty = 'infra'
    db.session.commit()
    assert scheduled_sync.run_fabric_sync_if_due(app) is None
    sync.assert_called_once()


def test_scheduler_runs_immediately_and_rechecks_after_wait(app, monkeypatch):
    """A single worker-owned daemon catches up at boot, then checks every five minutes."""
    events = []
    thread = Mock()
    monkeypatch.setattr(scheduled_sync.threading, 'Thread', Mock(return_value=thread))
    monkeypatch.setattr(scheduled_sync, 'run_fabric_sync_if_due',
                        lambda current_app: events.append(current_app))

    def stop_after_cycle(seconds: int) -> None:
        """End the bounded scheduler harness after its first wait."""
        events.append(seconds)
        raise InterruptedError('Test scheduler complete')

    monkeypatch.setattr(scheduled_sync.time, 'sleep', stop_after_cycle)
    assert scheduled_sync.start_fabric_sync_scheduler(app) is thread
    thread.start.assert_called_once()
    arguments = scheduled_sync.threading.Thread.call_args.kwargs
    assert arguments['daemon'] is True
    assert arguments['name'] == 'fabric-sync'
    with pytest.raises(InterruptedError, match='Test scheduler complete'):
        arguments['target']()
    assert events == [app, 300]


def test_failed_automatic_import_is_logged(app, fabric_user, monkeypatch, caplog):
    """Failures surface through normal Fabric status and contextual scheduler logs."""
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_360',
                        Mock(return_value={'success': False, 'error': 'Source unavailable'}))
    result = scheduled_sync.run_fabric_sync_if_due(app)
    assert result['accepted'] is True
    from app.services.job_queue import process_one
    process_one('test-worker')
    assert db.session.get(Job, result['job_id']).status == 'failed'
    assert 'Source unavailable' in caplog.text
