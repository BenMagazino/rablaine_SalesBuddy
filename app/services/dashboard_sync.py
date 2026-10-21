"""Read dashboard source readiness and admit missing sources through the job queue."""
from __future__ import annotations

import json
from datetime import date
from typing import Any

from app.models import (
    Customer, CustomerRevenueData, FabricConsumptionImport, Job, Milestone, PToFImport,
    ProductRevenueData, RevenueAnalysis, RevenueImport, StrategicPillarRevenueData,
    SyncStatus, U2CSnapshot,
)
from app.services.sync_jobs import ACTIVE_STATES, OPERATIONS, admit_sync, job_snapshot, operation_runs


WIDGET_SOURCES = {
    'connect_goals.u2c': ('milestones', 'u2c'),
    'connect_goals.team_coverage': ('milestones',),
    'connect_goals.hva_coverage': ('milestones',),
    'connect_goals.whitespace': ('revenue',),
    'hygiene.gaps': ('milestones',),
    'activity_coverage.meetings': ('milestones', 'calendar-population', 'activity-reconciliation'),
    'revenue.attention': ('revenue-analysis',),
    'database.expansion': ('revenue-analysis',),
    'ptof.upcoming_renewals': ('ptof',),
    'fabric.acquisition': ('pillars',),
    'database.whitespace': ('pillars',),
    'fabric.modernization': ('products',),
    'fabric.rti': ('products', 'fabric'),
    'fabric.expansion': ('fabric',),
    'fabric.trial_conversion': ('fabric',),
    'fabric.capacity_pressure': ('fabric',),
}

SOURCE_OPERATIONS = {
    'pillars': 'revenue', 'products': 'revenue', 'ptof': 'fabric',
}
SOURCE_MODELS = {
    'accounts': Customer, 'milestones': Milestone, 'revenue': CustomerRevenueData,
    'pillars': StrategicPillarRevenueData, 'products': ProductRevenueData,
    'fabric': FabricConsumptionImport, 'ptof': PToFImport, 'revenue-analysis': RevenueAnalysis,
}


def _completed(operation: str, reference: date, source: str | None = None) -> bool:
    """Retain successful empty imports, excluding skipped or differently scoped work."""
    start = None
    if operation == 'u2c':
        from app.services.connect_goals import current_fiscal_quarter, fiscal_quarter_date_range
        start, _ = fiscal_quarter_date_range(current_fiscal_quarter(reference))
    query = Job.query.filter_by(job_type=f'sync:{operation}', status=Job.STATUS_DONE)
    for job in query.order_by(Job.id.desc()):
        result = json.loads(job.result or '{}')
        if result.get('skipped'):
            continue
        if start is not None:
            if not job.finished_at or job.finished_at.date() < start:
                continue
        return True
    legacy_key = None if source == 'ptof' else OPERATIONS[operation].legacy_status
    legacy = SyncStatus.query.filter_by(sync_type=legacy_key).first() if legacy_key else None
    return bool(legacy and legacy.success and legacy.completed_at and (
        start is None or legacy.completed_at.date() >= start
    ))


def _has_source(source: str, reference: date) -> bool:
    """Check source imports, never a filtered widget's result count."""
    if source == 'u2c':
        from app.services.connect_goals import current_fiscal_quarter
        return U2CSnapshot.query.filter_by(
            fiscal_quarter=current_fiscal_quarter(reference),
        ).first() is not None
    if source == 'calendar-population':
        from app.services.activity_coverage import get_population_status
        return get_population_status(reference)['pending_count'] == 0
    model = SOURCE_MODELS.get(source)
    if model and model.query.first() is not None:
        return True
    return source == 'revenue' and RevenueImport.query.first() is not None


def get_source_sync(
    sources: tuple[str, ...], reference: date | None = None,
) -> dict[str, Any] | None:
    """Return the first missing dependency without starting work from a GET."""
    reference = reference or date.today()
    for source in sources:
        operation = SOURCE_OPERATIONS.get(source, source)
        if _has_source(source, reference) or (
            source != 'calendar-population' and _completed(operation, reference, source)
        ):
            continue
        if source == 'revenue-analysis':
            revenue = get_source_sync(('revenue',), reference)
            if revenue:
                return revenue
        job, _ = operation_runs(operation)
        if job and job.status in ACTIVE_STATES:
            return _state(operation, job)
        if OPERATIONS[operation].needs_customers:
            from app.services.revenue_pull import get_customer_tpids
            has_customers = bool(get_customer_tpids()) if operation in (
                'fabric', 'revenue',
            ) else Customer.query.first() is not None
            if not has_customers:
                if not _completed('accounts', reference):
                    account_job, _ = operation_runs('accounts')
                    return _state('accounts', account_job)
                return _state(operation, error=(
                    'No eligible accounts are available. Review your account alignment '
                    'in Sync Status, then retry.'
                ))
        return _state(operation, job)
    return None


def _state(operation: str, job: Job | None = None, *, error: str | None = None) -> dict:
    """Build a serializable progress or retry state for the shared widget body."""
    snapshot = job_snapshot(job) if job else None
    if job and job.status == Job.STATUS_FAILED:
        error = job.last_error or 'The sync failed. Retry when you are ready.'
    elif job and job.status == Job.STATUS_DONE:
        error = error or 'The sync finished without the required data. Review Sync Status and retry.'
    return {
        'operation': operation, 'name': OPERATIONS[operation].name,
        'job': snapshot, 'error': error,
    }


def start_widget_sync(state: dict, *, retry: bool = False) -> dict:
    """Join an active operation regardless of options; do not auto-retry failures."""
    operation = state['operation']
    job, _ = operation_runs(operation)
    if job and job.status in ACTIVE_STATES:
        return _state(operation, job)
    if state['error'] and not retry:
        return state
    job = admit_sync(operation, initiator='dashboard')
    return _state(operation, job)
