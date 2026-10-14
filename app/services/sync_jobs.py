"""Single admission and observation contract for worker-owned data syncs."""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

import requests
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Customer, Job, JobEvent, SyncStatus, db
from app.services import job_queue

logger = logging.getLogger(__name__)
EVENT_LIMIT = 200
ACTIVE_STATES = (Job.STATUS_PENDING, Job.STATUS_RUNNING)


class SyncAdmissionError(ValueError):
    """Invalid options, unmet prerequisites, or a conflicting admitted operation."""

    def __init__(self, message: str, status: int = 400) -> None:
        """Keep the user-facing validation message and its HTTP status."""
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Operation:
    """Allowlisted operation contract; execution never depends on an HTTP request."""

    name: str
    description: str
    resource: str
    defaults: dict[str, Any]
    needs_customers: bool = False
    recovery_safe: bool = False
    legacy_status: str | None = None


OPERATIONS = {
    'accounts': Operation('Accounts', 'MSX account discovery and territory alignment.',
                          'accounts', {'source': 'default', 'skip_aura': False},
                          legacy_status='accounts'),
    'accounts-selected': Operation('Selected accounts', 'Import a captured account selection.',
                                   'accounts', {'accounts': [], 'territories': []}),
    'milestones': Operation('Milestones', 'All customers, opportunities, tasks and comments.',
                            'milestones', {}, True, legacy_status='milestones'),
    'customer-milestones': Operation('Customer milestones', 'Milestones for one customer.',
                                     'milestones', {'customer_id': None}, True),
    'customer-data': Operation('Customer MSX data', 'Opportunities, milestones and comments.',
                               'milestones', {'customer_id': None}, True),
    'revenue': Operation('ACR', 'MSXI revenue, bucket reconciliation and trend analysis.',
                         'revenue', {'fiscal_years': None, 'run_analysis': True}, True,
                         True, 'revenue_sync'),
    'revenue-analysis': Operation('Revenue analysis', 'Recalculate saved revenue trends.',
                                  'revenue', {}, legacy_status='revenue_analysis'),
    'u2c': Operation('U2C', 'Official MSXI baseline and local milestone matching.',
                     'u2c', {'force': True}, legacy_status='u2c_import'),
    'marketing': Operation('Marketing', 'Customer summaries, interactions and contacts.',
                           'marketing', {}, True, legacy_status='marketing'),
    'fabric': Operation('Fabric 360', 'Workloads, capacities, utilization and revenue.',
                        'fabric', {}, True, True, 'fabric_consumption'),
    'fabric-revenue': Operation('Fabric revenue', 'Refresh only saved Fabric revenue.',
                                'fabric', {}, True, True),
    'meetings': Operation('Meetings for a date', 'WorkIQ calendar and attendee cache.',
                          'meetings', {'date': None}, recovery_safe=True),
    'meeting-aura': Operation('Meeting aura', 'Today and the next four business days.',
                              'meetings', {'anchor': None, 'days_ahead': 4}, recovery_safe=True),
    'copilot-actions': Operation('Copilot actions', 'Refresh suggested daily action items.',
                                 'copilot-actions', {}),
    'favicons': Operation('Customer favicons', 'Refresh icons for configured websites.',
                          'favicons', {'missing_only': False}, recovery_safe=True,
                          legacy_status='favicons'),
    'milestone-dates': Operation('Milestone audit dates', 'Committed and completed MSX dates.',
                                 'milestones', {}),
    'activity-reconciliation': Operation('Activity reconciliation',
                                         'Refresh MSX activities and match saved meetings.',
                                         'milestones', {}),
    'calendar-population': Operation('Fiscal-year calendar',
                                     'Resume calendar population from its saved checkpoint.',
                                     'meetings', {'through': None}, recovery_safe=True),
    'meeting-preparation': Operation('Meeting preparation',
                                     'WorkIQ summaries and suggested milestone matches.',
                                     'meeting-preparation', {'force': False}),
}


def _iso(value: datetime | None) -> str | None:
    """Serialize SQLite naive UTC timestamps without changing their meaning."""
    return value.replace(tzinfo=value.tzinfo or timezone.utc).isoformat() if value else None


def is_transient_failure(error: Exception) -> bool:
    """Recognize typed network failures, including a source wrapper's explicit cause."""
    return any(isinstance(candidate, (requests.Timeout, requests.ConnectionError))
               for candidate in (error, error.__cause__))


def validate_options(operation: str, options: dict | None) -> dict:
    """Capture defaults, validate types and reject unsupported operation options."""
    spec = OPERATIONS.get(operation)
    if spec is None:
        raise SyncAdmissionError('Unknown sync operation.', 404)
    if options is None:
        options = {}
    if not isinstance(options, dict) or options.keys() - spec.defaults.keys():
        raise SyncAdmissionError('Use only the supported options for this sync.')
    result = {**spec.defaults, **options}
    for key in ('force', 'skip_aura', 'run_analysis', 'missing_only'):
        if key in result and not isinstance(result[key], bool):
            raise SyncAdmissionError(f'{key} must be true or false.')
    for key in ('date', 'anchor', 'through'):
        if key in result:
            value = result[key] or date.today().isoformat()
            try:
                result[key] = date.fromisoformat(value).isoformat()
            except (TypeError, ValueError) as exc:
                raise SyncAdmissionError(f'{key} must use YYYY-MM-DD.') from exc
    if 'days_ahead' in result:
        days = result['days_ahead']
        if isinstance(days, bool) or not isinstance(days, int) or not 0 <= days <= 9:
            raise SyncAdmissionError('days_ahead must be an integer from 0 to 9.')
    if 'source' in result:
        if result['source'] not in ('default', 'alignment', 'accountteams'):
            raise SyncAdmissionError('source must be default, alignment or accountteams.')
        if result['source'] == 'default':
            from app.services.alignment import is_override_active
            result['source'] = 'alignment' if is_override_active() else 'accountteams'
    if 'fiscal_years' in result and result['fiscal_years'] is not None:
        years = result['fiscal_years']
        if (not isinstance(years, list) or not years or len(years) > 10
                or any(not isinstance(y, str) or len(y) != 4
                       or not y.startswith('FY') or not y[2:].isdigit() for y in years)):
            raise SyncAdmissionError('fiscal_years must be a list such as ["FY26", "FY27"].')
        result['fiscal_years'] = sorted(set(years))
    if 'customer_id' in result:
        cid = result['customer_id']
        if isinstance(cid, bool) or not isinstance(cid, int) or cid <= 0:
            raise SyncAdmissionError('Choose a customer_id for this sync.')
        customer = db.session.get(Customer, cid)
        if customer is None:
            raise SyncAdmissionError('Customer not found.', 404)
        if not customer.tpid_url:
            raise SyncAdmissionError('This customer has no MSX account link.')
    if operation == 'accounts-selected':
        if not result['accounts']:
            raise SyncAdmissionError('Provide the accounts to import.')
        for key in ('accounts', 'territories'):
            if not isinstance(result[key], list) or any(
                not isinstance(value, dict) for value in result[key]
            ):
                raise SyncAdmissionError(f'{key} must be a list of account/territory objects.')
    if operation in ('fabric', 'fabric-revenue', 'revenue', 'marketing'):
        from app.services.revenue_pull import get_customer_tpids
        if not get_customer_tpids():
            raise SyncAdmissionError('No customers with valid TPIDs. Import your accounts first.')
    elif spec.needs_customers and Customer.query.first() is None:
        raise SyncAdmissionError('Import accounts first.')
    return result


def admit_sync(operation: str, options: dict | None = None, *,
               initiator: str = 'manual', request_key: str | None = None) -> Job:
    """Atomically admit one resource owner, or return its identical existing run."""
    options = validate_options(operation, options)
    if request_key is not None and (
        not isinstance(request_key, str) or not 1 <= len(request_key) <= 200
    ):
        raise SyncAdmissionError('Idempotency-Key must contain 1 to 200 characters.')
    spec = OPERATIONS[operation]
    payload = json.dumps(options, sort_keys=True, separators=(',', ':'))
    active_key = f'sync:{spec.resource}'
    job_type = f'sync:{operation}'
    job = Job(job_type=job_type, payload=payload, active_key=active_key,
              request_key=request_key, initiator=initiator,
              max_attempts=3 if spec.recovery_safe else 1)
    previous = Job.query.filter_by(job_type=job_type).order_by(Job.id.desc()).first()
    legacy = SyncStatus.query.filter_by(sync_type=spec.legacy_status).first() \
        if spec.legacy_status else None
    job.last_success_at = (
        previous.finished_at if previous and previous.status == Job.STATUS_DONE
        and not json.loads(previous.result or '{}').get('skipped')
        else previous.last_success_at if previous
        else legacy.completed_at if legacy and legacy.success else None)
    db.session.add(job)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing = None
        if request_key:
            existing = Job.query.filter_by(request_key=request_key).first()
        if existing is None:
            existing = Job.query.filter_by(active_key=active_key).first()
        if existing is None:
            logger.exception('Could not admit sync %s', operation)
            raise
        if existing.job_type != job_type or existing.payload != payload:
            raise SyncAdmissionError(
                f'A conflicting {spec.resource} job already exists (job {existing.id}).', 409)
        return existing
    logger.info('Admitted %s job %s (%s)', operation, job.id, initiator)
    return job


def publish_progress(data: dict, event_type: str = 'progress') -> None:
    """Persist worker progress independently of pending domain writes."""
    job_id = job_queue.CURRENT_JOB_ID.get()
    if job_id is None:
        return
    session = db.session()
    if db.engine.dialect.name == 'sqlite' and session.in_transaction():
        connection = session.connection().connection.driver_connection
        if isinstance(connection, sqlite3.Connection) and connection.in_transaction:
            if 'sync_deferred_progress' not in session.info:
                logger.info('Job %s progress deferred until its atomic SQLite save commits.', job_id)
            session.info['sync_deferred_progress'] = (job_id, dict(data), event_type)
            return
    flush_deferred_progress()
    _write_progress(job_id, data, event_type)


def flush_deferred_progress() -> None:
    """Publish the last measured unit after an atomic domain transaction commits."""
    pending = db.session().info.pop('sync_deferred_progress', None)
    if pending is not None:
        _write_progress(*pending)


def _write_progress(job_id: int, data: dict, event_type: str) -> None:
    """Save measured progress without committing the domain service's transaction."""
    raw = dict(data)
    percent = raw.get('progress')
    if isinstance(percent, (int, float)) and not isinstance(percent, bool):
        percent = max(0, min(99, int(percent)))
    else:
        percent = None
    progress = {
        **raw,
        'phase': raw.get('phase') or raw.get('status') or event_type,
        'message': raw.get('message') or raw.get('customer') or 'Sync running.',
        'percent': percent,
        'processed': raw.get('current'),
        'total': raw.get('total'),
    }
    with Session(db.engine) as session:
        job = session.get(Job, job_id)
        if job is None or job.status != Job.STATUS_RUNNING:
            raise RuntimeError('Progress belongs to a job that is not running.')
        job.progress_json = json.dumps(progress)
        job.progress_at = datetime.now(timezone.utc)
        session.add(JobEvent(job_id=job.id, attempt=job.attempts,
                             event_type=event_type, data_json=json.dumps(raw)))
        session.flush()
        cutoff = session.query(JobEvent.id).filter_by(job_id=job.id).order_by(
            JobEvent.id.desc()).offset(EVENT_LIMIT).limit(1).scalar()
        if cutoff:
            session.query(JobEvent).filter(
                JobEvent.job_id == job.id, JobEvent.id <= cutoff).delete(
                    synchronize_session=False)
        session.commit()


def consume_stream(stream) -> dict:
    """Consume a domain stream in the worker and translate terminal errors into failure."""
    terminal = None
    for chunk in stream:
        for block in chunk.strip().split('\n\n'):
            lines = block.splitlines()
            event_type = next((line[6:] for line in lines if line.startswith('event:')),
                              'progress').strip()
            data = json.loads('\n'.join(
                line[5:].lstrip() for line in lines if line.startswith('data:')))
            if event_type in ('error', 'vpn_blocked') or data.get('error'):
                publish_progress(data, event_type)
                if data.get('retryable') is True:
                    raise requests.ConnectionError(data.get('error') or 'Transient network failure.')
                raise job_queue.NonRetryableJobError(
                    data.get('error') or data.get('message') or 'Sync failed.',
                    result={'success': False, **data})
            if event_type == 'complete' or data.get('complete'):
                terminal = data
            else:
                publish_progress(data, event_type)
    if terminal is None:
        raise job_queue.NonRetryableJobError('Sync ended without a terminal result.')
    return terminal


def _execute_operation(operation: str, options: dict) -> dict:
    """Thin operation adapters reuse domain services instead of duplicating sync logic."""
    from flask import current_app
    if operation == 'accounts':
        from app.services.account_sync import sync_accounts_stream
        return consume_stream(sync_accounts_stream(**options))
    if operation == 'accounts-selected':
        from app.services.account_sync import import_selected_accounts
        return import_selected_accounts(**options)
    if operation == 'milestones':
        from app.services.milestone_sync import sync_all_customer_milestones_stream
        return consume_stream(sync_all_customer_milestones_stream())
    if operation in ('customer-milestones', 'customer-data'):
        from app.services.milestone_sync import (
            sync_customer_comments, sync_customer_milestones, sync_customer_opportunities,
        )
        customer = db.session.get(Customer, options['customer_id'])
        result = {}
        stages = {}
        functions = [sync_customer_milestones]
        if operation == 'customer-data':
            functions = [sync_customer_opportunities, sync_customer_milestones,
                         sync_customer_comments]
        for index, fn in enumerate(functions):
            publish_progress({'phase': fn.__name__, 'current': index,
                              'total': len(functions), 'progress': 100 * index / len(functions)})
            result = fn(customer)
            result = {key: sorted(value) if isinstance(value, set) else value
                      for key, value in result.items()}
            stages[fn.__name__] = result
            if result.get('success') is False:
                return {**result, 'stages': stages}
            publish_progress({'phase': fn.__name__, 'current': index + 1,
                              'total': len(functions),
                              'progress': 100 * (index + 1) / len(functions),
                              'stage_result': result})
        return {**result, 'stages': stages}
    if operation == 'revenue':
        from app.services.revenue_sync import sync_revenue
        return sync_revenue(**options, progress=publish_progress)
    if operation == 'revenue-analysis':
        from app.services.revenue_analysis import run_analysis_streaming
        for update in run_analysis_streaming():
            if update.get('complete'):
                return {'success': True, **update['stats']}
            update['progress'] = 100 * update['current'] / max(update['total'], 1)
            publish_progress(update)
        raise job_queue.NonRetryableJobError('Analysis ended without a result.')
    if operation == 'marketing':
        from app.services.marketing_sync import sync_marketing_stream
        return consume_stream(sync_marketing_stream())
    if operation == 'u2c':
        from app.services.scheduled_sync import run_u2c_import
        return run_u2c_import(**options) or {
            'success': True, 'skipped': True, 'message': 'Already up to date.'}
    if operation in ('fabric', 'fabric-revenue'):
        from app.services.fabric_consumption import (
            refresh_fabric_revenue, sync_fabric_consumption,
        )
        fn = sync_fabric_consumption if operation == 'fabric' else refresh_fabric_revenue
        return fn(progress=publish_progress)
    if operation == 'copilot-actions':
        from app.services.copilot_actions import sync_copilot_action_items
        return sync_copilot_action_items()
    if operation == 'meetings':
        from app.services.meeting_sync import get_cached_meetings, sync_meetings_for_date
        meetings, error = sync_meetings_for_date(options['date'])
        _, synced_at = get_cached_meetings(options['date'])
        return {'success': not bool(error), 'error': error, 'meetings': meetings,
                'date': options['date'], 'from_cache': False, 'synced_at': _iso(synced_at)}
    if operation == 'meeting-aura':
        from app.services.meeting_sync import ensure_meeting_aura
        counts, errors = ensure_meeting_aura(
            start=date.fromisoformat(options['anchor']), days_ahead=options['days_ahead'])
        return {'success': not bool(errors), 'counts': counts, 'errors': errors,
                'error': '; '.join(errors.values()) if errors else None}
    if operation == 'favicons':
        from app.services.favicon_sync import sync_favicons
        return sync_favicons(publish_progress, **options)
    if operation == 'milestone-dates':
        from app.services.milestone_audit import sync_milestone_audit_dates
        result = sync_milestone_audit_dates(progress_callback=lambda current, total:
            publish_progress({'phase': 'audit', 'current': current - 1, 'total': total,
                              'progress': 100 * (current - 1) / max(total, 1),
                              'message': f'Checking milestone audit {current}/{total}.'}))
        return {**result, 'failed': len(result.get('errors', []))}
    if operation == 'activity-reconciliation':
        from app.services.activity_coverage import _sync_and_reconcile
        return _sync_and_reconcile()
    if operation == 'calendar-population':
        from app.services.activity_coverage import process_population_job
        result = process_population_job(options)
        return {'success': not bool(result.get('error')), **result}
    if operation == 'meeting-preparation':
        from app.services.activity_enrichment import prepare_enrichment, process_enrichment_job
        payload = prepare_enrichment(**options)
        result = process_enrichment_job(payload) if payload['meeting_ids'] else {'total': 0}
        return {'success': not bool(result.get('failed')), **result}
    raise job_queue.NonRetryableJobError('No implementation for this operation.')


def _run_operation(operation: str, options: dict) -> dict:
    """Recheck prerequisites and allow retry only for typed, transient, safe failures."""
    try:
        options = validate_options(operation, options)
        publish_progress({'phase': 'starting', 'message': 'Worker started this sync.'}, 'start')
        result = _execute_operation(operation, options)
        if result.get('success') is False:
            if result.get('retryable') is True and OPERATIONS[operation].recovery_safe:
                raise requests.ConnectionError(result.get('error') or 'Transient network failure.')
            raise job_queue.NonRetryableJobError(result.get('error') or
                                                 'Sync reported failed or partial results.',
                                                 result=result)
        flush_deferred_progress()
        if operation == 'milestones':
            from app.services.scheduled_sync import _revenue_sync_due
            for followup, followup_options in (
                ('marketing', {}), ('revenue', {}) if _revenue_sync_due() else (None, {}),
                ('u2c', {'force': False}),
            ):
                if followup:
                    try:
                        admit_sync(followup, followup_options, initiator='followup')
                    except SyncAdmissionError as exc:
                        logger.warning('Follow-up %s not admitted: %s', followup, exc)
                        publish_progress({'phase': 'followup', 'message': str(exc)}, 'warning')
        if result.get('failed'):
            result['warnings'] = [f"{result['failed']} unit(s) failed; inspect the result details."]
        return {'success': True, **result}
    except (requests.Timeout, requests.ConnectionError):
        if OPERATIONS[operation].recovery_safe:
            raise
        raise job_queue.NonRetryableJobError('Network error; explicit retry required.')
    except job_queue.NonRetryableJobError:
        raise
    except SQLAlchemyError as exc:
        logger.exception('Could not save %s sync results', operation)
        raise job_queue.NonRetryableJobError(
            'Sync could not save its results. Some earlier changes may already be saved. '
            'Check backend logs before retrying.') from exc
    except Exception as exc:
        raise job_queue.NonRetryableJobError(str(exc)) from exc


def register_handlers() -> None:
    """Register the allowlist in both the web and worker process."""
    for operation in OPERATIONS:
        job_queue.register_handler(
            f'sync:{operation}', lambda options, key=operation: _run_operation(key, options))


def worker_health() -> dict:
    """Distinguish a healthy/busy worker from a missing or stale heartbeat."""
    worker = SyncStatus.query.filter_by(sync_type='worker_process').first()
    beat = worker.heartbeat_at if worker else None
    age = (datetime.now(timezone.utc) - beat.replace(
        tzinfo=beat.tzinfo or timezone.utc)).total_seconds() if beat else None
    alive = age is not None and age < Job.HEARTBEAT_STALE_SECONDS
    return {'alive': alive, 'heartbeat_at': _iso(beat),
            'message': 'Worker healthy. Jobs execute independently of this page.' if alive else
            'Worker unavailable. Queued jobs are saved. A supervised install restarts failed workers. '
            'In development, start or restart scripts\\dev.ps1; review backend logs if it persists.'}


def project_sync_status(sync_type: str) -> dict | None:
    """Keep existing polling surfaces aligned with the durable queue's actual owner."""
    operation = next((key for key, spec in OPERATIONS.items()
                      if spec.legacy_status == sync_type), None)
    if operation is None:
        return None
    active_key = f'sync:{OPERATIONS[operation].resource}'
    job = Job.query.filter_by(active_key=active_key).first()
    if job is None:
        job = Job.query.filter_by(job_type=f'sync:{operation}').order_by(Job.id.desc()).first()
    if job is None:
        return None
    if job.id == job_queue.CURRENT_JOB_ID.get():
        return None
    snapshot = job_snapshot(job)
    state = {
        Job.STATUS_DONE: 'complete', Job.STATUS_FAILED: 'failed',
        Job.STATUS_RUNNING: 'in_progress', Job.STATUS_PENDING: 'in_progress',
    }[job.status]
    result = snapshot['result'] or {}
    last_success = (job.finished_at if job.status == Job.STATUS_DONE and not result.get('skipped')
                    else job.last_success_at)
    return {
        'state': 'incomplete' if snapshot['state'] == 'interrupted' else state,
        'started_at': job.started_at or job.created_at,
        'completed_at': last_success if result.get('skipped') else job.finished_at,
        'last_success_at': last_success,
        'items_synced': next((result[key] for key in (
            'items_synced', 'synced', 'total_items', 'fetched', 'customer_count') if key in result),
            None),
        'details': json.dumps({**result, **snapshot['progress'],
            'progress': snapshot['progress'].get(
            'percent'), 'error': snapshot['error'], 'job_id': job.id,
            'job_state': snapshot['state']}),
        'job_id': job.id,
    }


def job_snapshot(job: Job) -> dict:
    """Read actual persisted progress and outcome, never browser-owned state."""
    state = job.status
    if state == Job.STATUS_PENDING:
        state = 'retry_waiting' if job.attempts else (
            'queued' if worker_health()['alive'] else 'waiting_for_worker')
    elif state == Job.STATUS_RUNNING and job.heartbeat_at:
        age = (datetime.now(timezone.utc) - job.heartbeat_at.replace(
            tzinfo=job.heartbeat_at.tzinfo or timezone.utc)).total_seconds()
        if age >= Job.HEARTBEAT_STALE_SECONDS:
            state = 'interrupted'
    progress = json.loads(job.progress_json) if job.progress_json else {}
    if job.status == Job.STATUS_DONE:
        result = json.loads(job.result or '{}')
        progress = {**progress, 'phase': 'complete', 'percent': 100,
                    'message': 'Sync completed with warnings.' if result.get('warnings')
                    else 'Sync completed.'}
    return {'id': job.id, 'operation': job.job_type.removeprefix('sync:'), 'state': state,
            'status': job.status, 'options': json.loads(job.payload or '{}'),
            'initiator': job.initiator, 'attempt': job.attempts,
            'max_attempts': job.max_attempts, 'progress': progress,
            'created_at': _iso(job.created_at), 'started_at': _iso(job.started_at),
            'finished_at': _iso(job.finished_at), 'heartbeat_at': _iso(job.heartbeat_at),
            'progress_at': _iso(job.progress_at), 'retry_at': _iso(job.available_at),
            'error': job.last_error, 'result': json.loads(job.result) if job.result else None}


def operation_snapshots() -> dict:
    """Project active/latest runs and retained successes for every allowlisted sync."""
    operations = []
    for key, spec in OPERATIONS.items():
        query = Job.query.filter_by(job_type=f'sync:{key}')
        latest = query.order_by(Job.id.desc()).first()
        success = query.filter_by(status=Job.STATUS_DONE).order_by(Job.id.desc()).first()
        legacy = SyncStatus.query.filter_by(sync_type=spec.legacy_status).first() \
            if spec.legacy_status else None
        last_success = (success.last_success_at if json.loads(
            success.result or '{}').get('skipped') else success.finished_at) if success else (
            latest.last_success_at if latest else
            legacy.completed_at if legacy and legacy.success else None)
        operations.append({
            'operation': key, 'name': spec.name, 'description': spec.description,
            'defaults': spec.defaults, 'recovery_safe': spec.recovery_safe,
            'latest': job_snapshot(latest) if latest else None,
            'last_success_at': _iso(last_success),
            'legacy_state': SyncStatus.get_status(spec.legacy_status) if spec.legacy_status else None,
        })
    return {'worker': worker_health(), 'operations': operations}


def run_dependency(operation: str, options: dict | None = None) -> dict:
    """Execute an admitted child serially in its parent's worker, without queue deadlock."""
    from flask import current_app

    parent_id = job_queue.CURRENT_JOB_ID.get()
    if parent_id is None:
        raise RuntimeError('Sync dependencies must be executed by the durable worker.')
    parent = db.session.get(Job, parent_id)
    child = admit_sync(operation, options, initiator=f'job:{parent_id}')
    while child.status in ACTIVE_STATES:
        if child.status == Job.STATUS_RUNNING:
            raise job_queue.NonRetryableJobError(f'Dependency job {child.id} is already running.')
        if child.available_at and child.available_at > job_queue._now():
            time.sleep(min(1, (child.available_at - job_queue._now()).total_seconds()))
            db.session.refresh(child)
            continue
        claimed = Job.query.filter_by(id=child.id, status=Job.STATUS_PENDING).update({
            Job.status: Job.STATUS_RUNNING, Job.claimed_by: parent.claimed_by,
            Job.attempts: Job.attempts + 1, Job.started_at: job_queue._now(),
            Job.heartbeat_at: job_queue._now(),
        }, synchronize_session=False)
        db.session.commit()
        if claimed != 1:
            raise job_queue.NonRetryableJobError('Dependency could not be claimed.')
        db.session.refresh(child)
        job_queue._execute(child, app=current_app._get_current_object(), with_heartbeat=True)
        db.session.refresh(child)
    if child.status == Job.STATUS_FAILED:
        raise job_queue.NonRetryableJobError(child.last_error or 'Dependency failed.')
    return json.loads(child.result or '{}')


def observe_job_stream(job_id: int):
    """Legacy SSE observes persisted worker events; disconnection only stops observation."""
    cursor = 0
    yield f'event: accepted\ndata: {json.dumps({"job_id": job_id})}\n\n'
    while True:
        db.session.expire_all()
        events = JobEvent.query.filter(JobEvent.job_id == job_id, JobEvent.id > cursor).order_by(
            JobEvent.id).limit(EVENT_LIMIT).all()
        job = db.session.get(Job, job_id)
        for event in events:
            cursor = event.id
            prefix = '' if job.job_type == 'sync:accounts' else f'event: {event.event_type}\n'
            yield f'{prefix}data: {event.data_json}\n\n'
        if job.status not in ACTIVE_STATES:
            data = json.loads(job.result) if job.result else {
                'success': False, 'error': job.last_error, 'message': job.last_error}
            if job.job_type == 'sync:accounts':
                data['complete'] = job.status == Job.STATUS_DONE
                prefix = ''
            else:
                prefix = f'event: {"complete" if job.status == Job.STATUS_DONE else "error"}\n'
            yield f'{prefix}data: {json.dumps(data)}\n\n'
            return
        yield ': observing\n\n'
        db.session.remove()
        time.sleep(1)
