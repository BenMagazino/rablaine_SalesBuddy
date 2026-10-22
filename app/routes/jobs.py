"""Admission and read-only status APIs for detached sync jobs."""
import logging
import uuid
from datetime import timezone

from flask import Blueprint, Response, jsonify, render_template, request, stream_with_context
from sqlalchemy.exc import SQLAlchemyError

from app.models import Job, JobEvent, db
from app.services.sync_jobs import (
    OPERATIONS, SyncAdmissionError, admit_sync, job_snapshot, observe_job_stream,
    operation_runs, operation_schedules, operation_snapshots,
)

bp = Blueprint('jobs', __name__)
logger = logging.getLogger(__name__)

CONSOLE_OPTION_HELP = {
    'accounts': {
        'source': 'Use "default" to follow your alignment override when active, otherwise '
                  'your MSX account teams. Choose "alignment" or "accountteams" to select explicitly.',
        'skip_aura': 'Set true to skip the follow-up meeting sync after importing accounts.',
    },
    'accounts-selected': {
        'accounts': 'Required, non-empty list of account objects. Each needs "tpid" and "name"; '
                    'include "territory_name" and "seller_name" when available. '
                    'Example: [{"tpid": 12345, "name": "Contoso"}].',
        'territories': 'Optional list of territory objects with "name" and, when available, '
                       '"seller_name". Leave [] if no territories need importing.',
    },
    'customer-milestones': {
        'customer_id': 'Required positive integer: the local customer ID from the customer page '
                       'URL, not its TPID. The customer must have an MSX account link.',
        'picker_only': 'Set true to reload all milestone choices for the note editor without '
                       'importing customer data. Leave false for the full customer milestone sync.',
    },
    'customer-data': {
        'customer_id': 'Required positive integer: the local customer ID from the customer page '
                       'URL, not its TPID. The customer must have an MSX account link.',
    },
    'revenue': {
        'fiscal_years': 'Use null for the current fiscal year and the two prior years, or a '
                        'list of up to 10 fiscal years, such as ["FY26", "FY27"].',
        'run_analysis': 'Set true to recalculate revenue trends after importing. '
                        'Set false to import without running trend analysis.',
    },
    'u2c': {
        'force': 'Set true to refresh the official MSXI baseline even if it is not due yet. '
                 'Set false to refresh only when due. Both re-match saved local milestones.',
    },
    'meetings': {
        'date': 'Calendar date to refresh, in YYYY-MM-DD format. Use null for today.',
    },
    'meeting-aura': {
        'anchor': 'Starting date in YYYY-MM-DD format. Use null for today. '
                  'Weekend dates move forward to the next weekday.',
        'days_ahead': 'Number of additional business days after the starting date, '
                      'from 0 to 9. Set 4 for five business days in total.',
    },
    'favicons': {
        'missing_only': 'Set true to fetch only missing website icons. '
                        'Set false to refresh icons even when one is already saved.',
    },
    'calendar-population': {
        'through': 'Populate fiscal-year weekdays through this date (YYYY-MM-DD), '
                   'resuming from the saved checkpoint. Use null for today.',
    },
    'meeting-preparation': {
        'force': 'Set false to prepare only eligible meetings not yet prepared or needing retry. '
                 'Set true to redo all eligible meetings, clearing existing milestone selections, '
                 'draft activity fields and enrichment results first. '
                 'Only current fiscal-year customer meetings through today that are not '
                 'dismissed or linked to an activity are eligible.',
    },
}


def start_response(operation: str, options: dict | None = None):
    """Compatibility starts only admit work; SSE is a persisted-state observer."""
    try:
        job = admit_sync(operation, options, request_key=request.headers.get('Idempotency-Key'))
    except SyncAdmissionError as exc:
        logger.info('Rejected %s sync start: %s', operation, exc)
        return jsonify(success=False, error=str(exc)), exc.status
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception('Could not persist %s sync admission', operation)
        return jsonify(success=False, error='Could not save this sync job. Try again.'), 500
    if 'text/event-stream' in request.headers.get('Accept', ''):
        return Response(stream_with_context(observe_job_stream(job.id)),
                        mimetype='text/event-stream',
                        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
    return jsonify(success=True, accepted=True, started=True, async_import=True,
                   job_id=job.id, status_url=f'/api/jobs/{job.id}', job=job_snapshot(job)), 202


@bp.route('/admin/sync-console')
def sync_console():
    """Desktop Sync Status page for observing and triggering every regular data sync."""
    groups = (
        ('Core app syncs', 'Start with accounts, then milestones, then revenue. '
         'Daily meeting and action refreshes follow.',
         ('accounts', 'milestones', 'revenue', 'meeting-aura',
          'meetings', 'copilot-actions')),
        ('Report syncs', 'Refresh the data behind individual reports.',
         ('u2c', 'fabric', 'sql-motions', 'marketing', 'activity-reconciliation',
          'meeting-preparation', 'milestone-dates')),
        ('Specific use case syncs', 'Target a selection, refresh part of a dataset, '
         'or run occasional maintenance.',
         ('accounts-selected', 'customer-milestones', 'customer-data',
          'revenue-analysis', 'fabric-revenue', 'calendar-population', 'favicons')),
    )
    report_endpoints = {
        'u2c': 'reports.report_u2c',
        'fabric': 'reports.report_fabric_consumption',
        'sql-motions': 'reports.report_sql_renewals',
        'marketing': 'reports.report_marketing_insights',
        'activity-reconciliation': 'reports.report_activity_coverage',
        'meeting-preparation': 'reports.report_activity_coverage',
        'milestone-dates': 'reports.report_one_on_one',
    }
    related_pages = {
        'milestones': ('milestones.milestone_tracker', 'Milestone Tracker'),
        'revenue': ('revenue.revenue_dashboard', 'Revenue Analyzer'),
        'meeting-aura': ('main.index', 'Home'),
    }
    return render_template('sync_console.html', operations=OPERATIONS, groups=groups,
                           option_help=CONSOLE_OPTION_HELP, schedules=operation_schedules(),
                           report_endpoints=report_endpoints, related_pages=related_pages)


@bp.route('/api/jobs')
def list_jobs():
    """Read operation states and worker liveness without triggering any operation."""
    return jsonify(success=True, **operation_snapshots())


@bp.route('/api/jobs/start/<operation>', methods=['POST'])
def start_job(operation: str):
    """Accept validated options and return a stable, durable job identity promptly."""
    if request.data and not request.is_json:
        return jsonify(success=False, error='Send job options as a JSON object.'), 400
    options = request.get_json(silent=True)
    if request.data and options is None:
        return jsonify(success=False, error='Job options contain invalid JSON.'), 400
    return start_response(operation, options)


@bp.route('/api/jobs/operations/<operation>')
def get_operation(operation: str):
    """Read one operation's active/latest run without admitting or changing work."""
    if operation not in OPERATIONS:
        return jsonify(success=False, error='Unknown sync operation.'), 404
    job, _ = operation_runs(operation)
    return jsonify(success=True, job=job_snapshot(job) if job else None)


@bp.route('/api/jobs/<int:job_id>')
def get_job(job_id: int):
    """Read one persisted job and a bounded attempt/event history."""
    job = db.get_or_404(Job, job_id)
    from app.services import sync_runtime
    live = sync_runtime.read(job)
    events = JobEvent.query.filter_by(job_id=job_id).order_by(JobEvent.id.desc()).limit(200).all()
    return jsonify(success=True, job=job_snapshot(job), events=live['events'] if live else [
        {'id': event.id, 'attempt': event.attempt, 'type': event.event_type,
         'data': event.data_json, 'created_at': event.created_at.replace(
             tzinfo=timezone.utc).isoformat()}
        for event in reversed(events)
    ])


@bp.route('/api/jobs/write-status')
def write_status():
    """Read the proven background writer without acquiring a SQLite transaction."""
    from app.services.sync_runtime import save_status, write_owner
    owner = write_owner()
    token = request.args.get('save_id')
    try:
        if token:
            uuid.UUID(token)
    except ValueError:
        return jsonify(success=False, error='Use a valid save request ID.'), 400
    save = save_status(token) if token else None
    return jsonify(success=True, writer=owner, save=save)


@bp.errorhandler(OSError)
@bp.errorhandler(ValueError)
def status_unavailable(error):
    """Do not disguise an unreadable live status file as a healthy or idle run."""
    logger.exception('Sync status unavailable')
    return jsonify(success=False, error='Live sync status is unavailable. Check backend logs.'), 503
