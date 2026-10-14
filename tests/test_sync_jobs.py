"""Isolated acceptance tests for one durable sync admission/execution/observation path."""
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
import requests

from app.models import Customer, Job, JobEvent, SyncStatus, db
from app.services import job_queue, sync_jobs


@pytest.fixture
def executor(monkeypatch):
    """Replace remote work, not admission or persistence, with measurable test execution."""
    seen = []

    def run(operation, options):
        seen.append((operation, options))
        sync_jobs.publish_progress({
            'phase': 'fetching', 'current': 1, 'total': 2,
            'progress': 50, 'message': 'One of two test units stored.',
        })
        return {'success': True, 'items_synced': 2}

    monkeypatch.setattr(sync_jobs, '_execute_operation', run)
    return seen


def test_catalog_is_read_only_and_includes_all_regular_syncs(client):
    """Opening the test surface cannot start a sync or fabricate a worker."""
    response = client.get('/api/jobs')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data['operations']) == len(sync_jobs.OPERATIONS)
    assert {row['operation'] for row in data['operations']} == set(sync_jobs.OPERATIONS)
    assert data['worker']['alive'] is False
    assert Job.query.count() == 0
    assert client.get('/admin/sync-console').status_code == 200


def test_start_close_reopen_observes_same_job(client, app, executor):
    """The accepted job exists before response consumption and survives a new browser client."""
    start = client.post('/api/jobs/start/favicons', json={})
    assert start.status_code == 202
    data = start.get_json()
    job_id = data['job_id']
    assert data['job']['state'] == 'waiting_for_worker'
    assert executor == []
    start.close()
    reopened = app.test_client()
    assert reopened.get(data['status_url']).get_json()['job']['id'] == job_id
    job_queue.process_one('test-worker', app=app, with_heartbeat=True)
    observed = reopened.get(data['status_url']).get_json()
    assert observed['job']['id'] == job_id
    assert observed['job']['status'] == 'done'
    assert observed['job']['progress']['percent'] == 100
    assert observed['job']['result']['items_synced'] == 2
    assert any(json.loads(event['data']).get('progress') == 50 for event in observed['events'])
    assert len(executor) == 1


def test_manual_and_headless_duplicate_share_identity(client):
    """Both launchers use identical options and the same atomically protected resource."""
    response = client.post('/api/jobs/start/favicons', json={})
    manual_id = response.get_json()['job_id']
    headless = sync_jobs.admit_sync('favicons', initiator='scheduled')
    assert headless.id == manual_id
    assert Job.query.count() == 1


def test_different_active_options_are_rejected(client):
    """A conflicting request never reuses a run with the wrong captured options."""
    first = client.post('/api/jobs/start/favicons', json={'missing_only': True})
    assert first.status_code == 202
    second = client.post('/api/jobs/start/favicons', json={'missing_only': False})
    assert second.status_code == 409
    assert Job.query.count() == 1


def test_idempotency_key_recovers_completed_run(client, executor):
    """A lost POST response cannot duplicate an already completed operation."""
    headers = {'Idempotency-Key': 'lost-response'}
    first = client.post('/api/jobs/start/favicons', json={}, headers=headers)
    job_queue.process_one('test-worker')
    repeated = client.post('/api/jobs/start/favicons', json={}, headers=headers)
    assert repeated.get_json()['job_id'] == first.get_json()['job_id']
    assert Job.query.count() == 1


@pytest.mark.parametrize('payload', [[], 'bad', {'arbitrary_handler': 'danger'}, {'missing_only': 1}])
def test_invalid_options_do_not_admit_work(client, payload):
    """The allowlist cannot be bypassed with client-selected handler names or bad types."""
    response = client.post('/api/jobs/start/favicons', json=payload)
    assert response.status_code == 400
    assert Job.query.count() == 0


def test_simultaneous_admission_is_atomic_across_sessions(app):
    """Separate callers must not race through a check-then-insert dedupe."""
    barrier = threading.Barrier(4)

    def start():
        with app.app_context():
            barrier.wait(timeout=10)
            return sync_jobs.admit_sync('favicons').id

    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(lambda _: start(), range(4)))
    assert len(set(ids)) == 1
    assert Job.query.count() == 1


def test_domain_failure_is_terminal_not_success_or_blind_retry(monkeypatch):
    """A returned success:false must be failed even for a repeatable operation."""
    monkeypatch.setattr(sync_jobs, '_execute_operation',
                        lambda operation, options: {'success': False, 'error': 'Sign in first.'})
    job = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    db.session.refresh(job)
    assert job.status == 'failed'
    assert job.attempts == 1
    assert 'Sign in first' in job.last_error
    assert job.active_key is None
    assert sync_jobs.job_snapshot(job)['progress'].get('percent') != 100


def test_safe_transient_failure_has_bounded_backoff(monkeypatch):
    """Only explicitly safe, typed transient failures qualify for automatic retry."""
    def fail(operation, options):
        raise requests.Timeout('temporary network failure')

    monkeypatch.setattr(sync_jobs, '_execute_operation', fail)
    job = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    db.session.refresh(job)
    assert job.status == 'pending'
    assert job.attempts == 1
    assert job.available_at > job_queue._now()
    assert job.active_key == 'sync:favicons'


def test_last_success_survives_a_failed_new_attempt(monkeypatch, executor):
    """The active/latest attempt cannot erase the last successful refresh."""
    first = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    success_at = next(row['last_success_at']
                      for row in sync_jobs.operation_snapshots()['operations']
                      if row['operation'] == 'favicons')
    monkeypatch.setattr(sync_jobs, '_execute_operation',
                        lambda operation, options: {'success': False, 'error': 'Failed.'})
    second = sync_jobs.admit_sync('favicons')
    assert second.id != first.id
    job_queue.process_one('test-worker')
    row = next(row for row in sync_jobs.operation_snapshots()['operations']
               if row['operation'] == 'favicons')
    assert row['latest']['status'] == 'failed'
    assert row['last_success_at'] == success_at


def test_stream_error_without_terminal_success_fails_job(monkeypatch):
    """A VPN/error event cannot be reported as a completed sync."""
    db.session.add(Customer(name='ACME', tpid=123))
    db.session.commit()

    def fail(operation, options):
        return sync_jobs.consume_stream(iter([
            'event: vpn_blocked\ndata: {"message": "Connect to VPN"}\n\n',
        ]))

    monkeypatch.setattr(sync_jobs, '_execute_operation', fail)
    job = sync_jobs.admit_sync('marketing')
    job_queue.process_one('test-worker')
    db.session.refresh(job)
    assert job.status == 'failed'
    assert 'Connect to VPN' in job.last_error


def test_legacy_sse_disconnect_does_not_remove_admitted_work(client, executor):
    """Legacy SSE readers observe the same job; closing the response is not cancellation."""
    response = client.post('/api/admin/refresh-favicons',
                           headers={'Accept': 'text/event-stream'}, buffered=False)
    assert response.status_code == 200
    assert b'accepted' in next(iter(response.response))
    response.close()
    job = Job.query.one()
    assert job.status == 'pending'
    job_queue.process_one('test-worker')
    assert db.session.get(Job, job.id).status == 'done'


def test_progress_events_are_bounded_and_measured(monkeypatch):
    """Progress must not reach 100 before the terminal job commit."""
    def run(operation, options):
        for count in range(205):
            sync_jobs.publish_progress({'progress': count, 'current': count, 'total': 205})
        assert Job.query.one().status == 'running'
        assert json.loads(Job.query.one().progress_json)['percent'] == 99
        return {'success': True}

    monkeypatch.setattr(sync_jobs, '_execute_operation', run)
    sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    assert JobEvent.query.count() == sync_jobs.EVENT_LIMIT


def test_two_workers_cannot_claim_concurrent_syncs():
    """Even multiple consumers preserve serial data-sync execution."""
    sync_jobs.admit_sync('favicons')
    sync_jobs.admit_sync('copilot-actions')
    assert job_queue.claim_next('worker-one') is not None
    assert job_queue.claim_next('worker-two') is None


def test_progress_never_commits_pending_domain_writes(monkeypatch):
    """SQLite save progress is deferred, preserving the domain's rollback boundary."""
    def run(operation, options):
        db.session.add(Customer(name='Must roll back', tpid=987))
        db.session.flush()
        sync_jobs.publish_progress({'progress': 50, 'message': 'Atomic save underway.'})
        assert JobEvent.query.filter_by(event_type='progress').count() == 0
        raise RuntimeError('Save failed')

    monkeypatch.setattr(sync_jobs, '_execute_operation', run)
    first = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    assert Customer.query.filter_by(tpid=987).first() is None
    assert db.session.get(Job, first.id).status == 'failed'
    monkeypatch.setattr(sync_jobs, '_execute_operation', lambda *args: {'success': True})
    second = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    assert db.session.get(Job, second.id).status == 'done'


def test_committed_atomic_save_flushes_latest_progress(monkeypatch):
    """After the save commits, the measured unit becomes durable without a lock conflict."""
    def run(operation, options):
        db.session.add(Customer(name='Saved', tpid=988))
        db.session.flush()
        sync_jobs.publish_progress({'progress': 80, 'current': 8, 'total': 10})
        db.session.commit()
        return {'success': True}

    monkeypatch.setattr(sync_jobs, '_execute_operation', run)
    job = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    assert db.session.get(Job, job.id).status == 'done'
    assert json.loads(JobEvent.query.filter_by(event_type='progress').one().data_json)['current'] == 8


def test_nested_dependency_uses_same_worker_and_retains_child_identity(monkeypatch, app):
    """An admitted dependency cannot deadlock behind its parent in a serial queue."""
    seen = []

    def run(operation, options):
        seen.append(operation)
        if operation == 'copilot-actions':
            sync_jobs.run_dependency('favicons')
        return {'success': True}

    monkeypatch.setattr(sync_jobs, '_execute_operation', run)
    parent = sync_jobs.admit_sync('copilot-actions')
    job_queue.process_one('test-worker', app=app, with_heartbeat=True)
    child = Job.query.filter_by(job_type='sync:favicons').one()
    assert seen == ['copilot-actions', 'favicons']
    assert child.initiator == f'job:{parent.id}'
    assert child.claimed_by == parent.claimed_by
    assert child.status == parent.status == 'done'


def test_legacy_status_projects_pending_owner_not_previous_completion(client):
    """Old UI polling cannot mistake a newly queued job for yesterday's completed run."""
    SyncStatus.mark_started('favicons')
    SyncStatus.mark_completed('favicons', success=True, items_synced=4)
    client.post('/api/jobs/start/favicons', json={})
    projected = SyncStatus.get_status('favicons')
    assert projected['state'] == 'in_progress'
    assert projected['completed_at'] is None


def test_marketing_worker_exception_propagates_without_waiting_for_done(monkeypatch):
    """A crashed source future cannot leave the stream blocked on a missing sentinel."""
    from app.services import marketing_sync

    db.session.add(Customer(name='Marketing', tpid=989))
    db.session.commit()

    def fail(*args):
        raise RuntimeError('Remote fetch crashed')

    monkeypatch.setattr(marketing_sync, '_fetch_worker', fail)
    with pytest.raises(RuntimeError, match='Remote fetch crashed'):
        list(marketing_sync.sync_marketing_stream())


def test_safe_retry_stops_after_three_attempts(monkeypatch):
    """Retryable work cannot loop forever or release its ownership between attempts."""
    def fail(*args):
        raise requests.Timeout('Temporary source outage')

    monkeypatch.setattr(sync_jobs, '_execute_operation', fail)
    job = sync_jobs.admit_sync('favicons')
    for attempt in range(1, 4):
        job_queue.process_one('test-worker')
        db.session.refresh(job)
        assert job.attempts == attempt
        if attempt < 3:
            assert job.status == 'pending'
            assert job.active_key == 'sync:favicons'
            job.available_at = job_queue._now() - timedelta(seconds=1)
            db.session.commit()
    assert job.status == 'failed'
    assert job.active_key is None


@pytest.mark.parametrize('operation,status', [('favicons', 'pending'),
                                             ('copilot-actions', 'failed')])
def test_interrupted_recovery_obeys_operation_safety(operation, status):
    """Stale ownership is recovered only for a safe operation within its attempt bound."""
    job = sync_jobs.admit_sync(operation)
    job_queue.claim_next('dead-worker')
    job.heartbeat_at = job_queue._now() - timedelta(
        seconds=Job.HEARTBEAT_STALE_SECONDS + 1)
    db.session.commit()
    assert sync_jobs.job_snapshot(job)['state'] == 'interrupted'
    assert job_queue.reclaim_stale() == 1
    db.session.refresh(job)
    assert job.status == status
    assert bool(job.active_key) is (status == 'pending')


def test_malformed_payload_fails_without_abandoning_running_ownership(executor):
    """Invalid persisted inputs become terminal failure, not an unreclaimable running job."""
    job = sync_jobs.admit_sync('favicons')
    job.payload = '{'
    db.session.commit()
    job_queue.process_one('test-worker')
    db.session.refresh(job)
    assert job.status == 'failed'
    assert job.attempts == 1
    assert job.active_key is None
    assert executor == []


def test_generic_enqueue_cannot_bypass_canonical_sync_admission():
    """Headless callers cannot bypass validation, ownership or retry policies."""
    with pytest.raises(ValueError, match='admit_sync'):
        job_queue.enqueue('sync:favicons')
    assert Job.query.count() == 0


@pytest.mark.parametrize('operation,legacy', [('u2c', 'u2c_import'),
                                            ('fabric-revenue', 'fabric_consumption')])
def test_domain_guard_does_not_confuse_its_own_job_with_another_sync(
    monkeypatch, operation, legacy,
):
    """A source's cadence/full-import guards must not reject their current queue owner."""
    db.session.add(Customer(name='Guard scope', tpid=991))
    db.session.commit()
    SyncStatus.mark_started(legacy)
    SyncStatus.mark_completed(legacy, success=True)

    def run(*args):
        assert SyncStatus.get_status(legacy)['state'] == 'complete'
        return {'success': True}

    monkeypatch.setattr(sync_jobs, '_execute_operation', run)
    job = sync_jobs.admit_sync(operation)
    assert SyncStatus.get_status(legacy)['state'] == 'in_progress'
    job_queue.process_one('test-worker')
    db.session.refresh(job)
    assert job.status == 'done'


def test_failed_domain_result_retains_partial_counts_and_outcome(monkeypatch):
    """A real failed outcome keeps its structured evidence, not just an error string."""
    result = {'success': False, 'error': 'Partial import', 'outcome': 'broken', 'saved': 3}
    monkeypatch.setattr(sync_jobs, '_execute_operation', lambda *args: result)
    job = sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    db.session.refresh(job)
    assert job.status == 'failed'
    assert json.loads(job.result) == result


def test_skipped_refresh_does_not_advance_the_source_success_clock(monkeypatch, executor):
    """A due-check/no-op cannot masquerade as newly refreshed source data."""
    sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    first = next(row for row in sync_jobs.operation_snapshots()['operations']
                 if row['operation'] == 'favicons')['last_success_at']
    monkeypatch.setattr(sync_jobs, '_execute_operation',
                        lambda *args: {'success': True, 'skipped': True})
    sync_jobs.admit_sync('favicons')
    job_queue.process_one('test-worker')
    row = next(row for row in sync_jobs.operation_snapshots()['operations']
               if row['operation'] == 'favicons')
    assert row['latest']['status'] == 'done'
    assert row['last_success_at'] == first
    third = sync_jobs.admit_sync('favicons')
    assert sync_jobs._iso(third.last_success_at) == first
