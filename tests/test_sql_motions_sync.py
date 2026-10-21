"""Atomic SQL import and durable operation/scheduler integration acceptance tests."""
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
import requests

from app.models import (
    Customer, Job, JobEvent, SqlArcVersion, SqlMotionImport, SqlRenewal, UserPreference, db,
)
from app.services import job_queue, scheduled_sync, sql_motions_sync as sync, sync_jobs
from app.services.fabric_consumption_pull import FabricPullError
from app.services.sql_motions_pull import SqlMotionsPullError
from tests.test_sql_motions_pull import arc, metadata, renewal


@pytest.fixture
def sql_customers(app):
    """Keep all writes isolated to the test database and restore specialty settings."""
    with app.app_context():
        pref = UserPreference.query.first()
        original = pref.user_role, pref.se_specialty
        pref.user_role, pref.se_specialty = 'dss', 'infra'
        active = Customer(name='SQL active', tpid=1001)
        stale = Customer(name='SQL stale', tpid=1002, stale_since=datetime.now(timezone.utc))
        missing = Customer(name='SQL missing TPID', tpid=0)
        db.session.add_all([active, stale, missing])
        db.session.commit()
        yield active, stale, missing
        db.session.rollback()
        SqlArcVersion.query.delete()
        SqlRenewal.query.delete()
        SqlMotionImport.query.delete()
        ids = [job.id for job in Job.query.filter_by(job_type='sync:sql-motions')]
        JobEvent.query.filter(JobEvent.job_id.in_(ids)).delete(synchronize_session=False)
        Job.query.filter(Job.id.in_(ids)).delete(synchronize_session=False)
        for customer in (active, stale, missing):
            db.session.delete(customer)
        pref.user_role, pref.se_specialty = original
        db.session.commit()


def payload(tpids=None, *, empty=False) -> dict:
    """Create a complete pair of source result sets for persistence-boundary tests."""
    return {
        'metadata': metadata(tpids or [1001]),
        'renewals': [] if empty else [renewal()],
        'arc_versions': [] if empty else [arc(), arc(discovery_type='Enterprise')],
    }


def test_complete_pair_commit_and_prior_snapshot_retention(sql_customers, monkeypatch):
    """Both result types reference the same committed import, newest by import id."""
    old = SqlMotionImport()
    db.session.add(old)
    db.session.commit()
    mock = Mock(return_value=payload())
    monkeypatch.setattr(sync, 'pull_sql_motions', mock)
    result = sync.sync_sql_motions()
    assert result['success']
    assert result['renewal_count'] == 1
    assert result['arc_version_count'] == 2
    assert result['customer_count'] == result['requested_customer_count'] == 1
    snapshot = SqlMotionImport.query.order_by(SqlMotionImport.id.desc()).first()
    assert snapshot.id > old.id
    assert SqlMotionImport.query.count() == 2
    assert snapshot.renewals[0].customer_id == sql_customers[0].id
    assert snapshot.renewals[0].expiration_amount == 1250.5
    assert len(snapshot.arc_versions) == 2
    assert json.loads(snapshot.source_metadata)['complete']
    mock.assert_called_once_with([1001], progress_callback=None)


def test_second_source_failure_preserves_old_snapshot(sql_customers, monkeypatch):
    """A failure after migration reads leaves no partial new import or record."""
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=payload()))
    previous = sync.sync_sql_motions()['import_id']
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(side_effect=FabricPullError('ADS failed')))
    with pytest.raises(FabricPullError, match='ADS failed'):
        sync.sync_sql_motions()
    assert [row.id for row in SqlMotionImport.query.all()] == [previous]
    assert SqlRenewal.query.count() == 1
    assert SqlArcVersion.query.count() == 2


def test_atomic_rollback_on_database_failure(sql_customers, monkeypatch):
    """A failed final commit rolls back both source tables and the import marker."""
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=payload()))
    previous = sync.sync_sql_motions()['import_id']
    monkeypatch.setattr(db.session, 'commit', Mock(side_effect=RuntimeError('commit failed')))
    with pytest.raises(RuntimeError, match='commit failed'):
        sync.sync_sql_motions()
    assert [row.id for row in SqlMotionImport.query.all()] == [previous]
    assert SqlRenewal.query.count() == 1
    assert SqlArcVersion.query.count() == 2
    monkeypatch.undo()


def test_successful_empty_pair_is_a_new_complete_snapshot(sql_customers, monkeypatch):
    """An authoritative empty result is fresh, persisted and distinguishable from failure."""
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=payload()))
    previous = sync.sync_sql_motions()['import_id']
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=payload(empty=True)))
    result = sync.sync_sql_motions()
    assert result['import_id'] > previous
    assert result['customer_count'] == result['renewal_count'] == result['arc_version_count'] == 0
    assert SqlMotionImport.query.order_by(SqlMotionImport.id.desc()).first().renewals == []
    assert not scheduled_sync._sql_motions_sync_due()


@pytest.mark.parametrize('tpid', [1002, 9999])
def test_stale_and_unknown_source_tpids_cannot_persist(sql_customers, monkeypatch, tpid):
    """Explicit active scope applies independently of whether a customer exists locally."""
    data = payload()
    data['arc_versions'][0]['tpid'] = tpid
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=data))
    with pytest.raises(SqlMotionsPullError, match='outside'):
        sync.sync_sql_motions()
    assert SqlMotionImport.query.count() == 0


@pytest.mark.parametrize('mutation', ['incomplete', 'wrong_scope', 'missing_source', 'bad_row'])
def test_all_payloads_validated_before_new_import(sql_customers, monkeypatch, mutation):
    """No persistent replacement happens until every required source result validates."""
    data = payload()
    if mutation == 'incomplete':
        data['metadata']['complete'] = False
    elif mutation == 'wrong_scope':
        data['metadata']['requested_tpids'] = [1001, 1002]
    elif mutation == 'missing_source':
        del data['metadata']['sources']['ads_accelerate']
    else:
        data['arc_versions'][0]['discovered_count'] = 'NaN'
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=data))
    with pytest.raises(SqlMotionsPullError):
        sync.sync_sql_motions()
    assert SqlMotionImport.query.count() == 0


def test_registered_worker_handler_executes_shared_sync(sql_customers, monkeypatch):
    """The durable allowlist executes the real atomic importer and passes progress."""
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(return_value=payload()))
    operation = sync_jobs.OPERATIONS['sql-motions']
    assert (operation.name, operation.resource, operation.needs_customers,
            operation.recovery_safe, operation.legacy_status) == (
                'SQL Motions', 'sql-motions', True, True, 'sql_motions',
            )
    job = sync_jobs.admit_sync('sql-motions')
    assert job_queue.claim_next('sql-test-worker').id == job.id
    job_queue._execute(job, with_heartbeat=False)
    db.session.refresh(job)
    assert job.status == Job.STATUS_DONE
    assert json.loads(job.result)['renewal_count'] == 1
    assert SqlMotionImport.query.count() == 1
    assert sync_jobs.operation_schedules()['sql-motions']['label'] == 'Every 7 days'


def test_console_exposes_one_shared_sql_operation(client, sql_customers):
    """One console row owns both SQL report sources, not a separate sync per report."""
    response = client.get('/admin/sync-console')
    assert response.status_code == 200
    assert response.data.count(b'data-sync-operation="sql-motions"') == 1
    assert b'/reports/sql-renewals' in response.data


def test_wrapped_network_failure_remains_retryable(sql_customers, monkeypatch):
    """Existing QES network wrappers retain safe worker retry semantics."""
    error = FabricPullError('SQL QES connection failed')
    error.__cause__ = requests.Timeout('test network timeout')
    monkeypatch.setattr(sync, 'pull_sql_motions', Mock(side_effect=error))
    with pytest.raises(requests.ConnectionError, match='retry is safe'):
        sync_jobs._execute_operation('sql-motions', {})


@pytest.mark.parametrize(('role', 'specialty', 'skipped'), [
    ('se', 'infra', True), ('se', 'apps_ai', True), ('se', 'other', True),
    ('dss', 'infra', False), ('dss', 'data', False),
    ('dss', 'apps_ai', False), ('dss', 'other', False),
])
def test_scheduled_worker_rechecks_specialty_before_source_reads(
    sql_customers, monkeypatch, role, specialty, skipped,
):
    """A queued scheduled import does not bypass a subsequent specialty change."""
    job = sync_jobs.admit_sync('sql-motions', initiator='scheduled')
    assert job_queue.claim_next('sql-test-worker').id == job.id
    pref = UserPreference.query.first()
    pref.user_role, pref.se_specialty = role, specialty
    db.session.commit()
    reader = Mock(return_value=payload())
    monkeypatch.setattr(sync, 'pull_sql_motions', reader)
    job_queue._execute(job, with_heartbeat=False)
    db.session.refresh(job)
    assert job.status == Job.STATUS_DONE
    assert bool(json.loads(job.result).get('skipped')) is skipped
    if skipped:
        reader.assert_not_called()
        assert SqlMotionImport.query.count() == 0
    else:
        reader.assert_called_once()
        assert SqlMotionImport.query.count() == 1


@pytest.mark.parametrize(('role', 'specialty', 'due'), [
    ('dss', 'data', True), ('dss', 'infra', True), ('dss', 'apps_ai', True),
    ('dss', 'other', True),
    ('se', 'data', True), ('se', 'infra', False), ('se', 'apps_ai', False),
    ('se', 'other', False), (None, 'data', True),
])
def test_weekly_specialty_access(sql_customers, role, specialty, due):
    """All sellers inherit weekly SQL sync regardless of their saved SE specialty."""
    pref = UserPreference.query.first()
    pref.user_role, pref.se_specialty = role, specialty
    db.session.commit()
    assert scheduled_sync._sql_motions_sync_due() is due


def test_weekly_admission_deduplicates_and_failed_attempt_backoff(app, sql_customers):
    """The scheduler shares manual admission and does not hot-loop failed imports."""
    result = scheduled_sync.run_sql_motions_sync_if_due(app)
    assert result['accepted']
    assert scheduled_sync.run_sql_motions_sync_if_due(app) is None
    job = db.session.get(Job, result['job_id'])
    job.status = Job.STATUS_FAILED
    job.finished_at = datetime.now(timezone.utc)
    job.active_key = None
    db.session.commit()
    assert not scheduled_sync._sql_motions_sync_due()
    assert scheduled_sync._sql_motions_sync_due(datetime.now(timezone.utc) + timedelta(hours=2))


def test_no_active_tpid_rejects_admission_and_schedule(sql_customers):
    """Stale-only portfolios cannot trigger either manual or automatic SQL source reads."""
    sql_customers[0].stale_since = datetime.now(timezone.utc)
    db.session.commit()
    assert not scheduled_sync._sql_motions_sync_due()
    with pytest.raises(sync_jobs.SyncAdmissionError, match='No active customers'):
        sync_jobs.admit_sync('sql-motions')
