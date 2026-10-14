"""Admission and read-only status APIs for detached sync jobs."""
import logging
from datetime import timezone

from flask import Blueprint, Response, jsonify, render_template, request, stream_with_context
from sqlalchemy.exc import SQLAlchemyError

from app.models import Job, JobEvent, db
from app.services.sync_jobs import (
    OPERATIONS, SyncAdmissionError, admit_sync, job_snapshot, observe_job_stream,
    operation_snapshots,
)

bp = Blueprint('jobs', __name__)
logger = logging.getLogger(__name__)


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
    """Desktop test surface for observing and triggering every regular data sync."""
    return render_template('sync_console.html', operations=OPERATIONS)


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


@bp.route('/api/jobs/<int:job_id>')
def get_job(job_id: int):
    """Read one persisted job and a bounded attempt/event history."""
    job = db.get_or_404(Job, job_id)
    events = JobEvent.query.filter_by(job_id=job_id).order_by(JobEvent.id.desc()).limit(200).all()
    return jsonify(success=True, job=job_snapshot(job), events=[
        {'id': event.id, 'attempt': event.attempt, 'type': event.event_type,
         'data': event.data_json, 'created_at': event.created_at.replace(
             tzinfo=timezone.utc).isoformat()}
        for event in reversed(events)
    ])


@bp.route('/api/jobs/<int:job_id>/retry', methods=['POST'])
def retry_job(job_id: int):
    """Explicit retries create a new run; old failures and their history remain intact."""
    import json

    job = db.get_or_404(Job, job_id)
    if job.status not in (Job.STATUS_DONE, Job.STATUS_FAILED):
        return jsonify(success=False, error='This job is still active.'), 409
    return start_response(job.job_type.removeprefix('sync:'), json.loads(job.payload or '{}'))
