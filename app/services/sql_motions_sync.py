"""Atomic SQL motion snapshot imports shared by manual and weekly durable jobs."""
from __future__ import annotations

import json
import logging
from typing import Callable

from app.models import Customer, SqlArcVersion, SqlMotionImport, SqlRenewal, db
from app.services.sql_motions_pull import SqlMotionsPullError, pull_sql_motions, validate_payload

logger = logging.getLogger(__name__)
SYNC_TYPE = 'sql_motions'


def active_customers() -> dict[int, Customer]:
    """Map only explicit active local customer TPIDs, without geography or segment filters."""
    return {int(customer.tpid): customer for customer in Customer.query.filter(
        Customer.stale_since.is_(None), Customer.tpid > 0,
    ).order_by(Customer.id)}


def sync_sql_motions(progress_callback: Callable | None = None) -> dict:
    """Commit both validated sources together, retaining all prior complete snapshots."""
    from app.models import Job
    from app.services.job_queue import CURRENT_JOB_ID
    from app.services.se_specialty import is_data_se

    job_id = CURRENT_JOB_ID.get()
    job = db.session.get(Job, job_id) if job_id is not None else None
    if job is not None and job.initiator == 'scheduled' and not is_data_se():
        return {'success': True, 'skipped': True,
                'message': 'Automatic SQL Motions refresh is for Data SEs and sellers.'}
    try:
        customers = active_customers()
        if not customers:
            raise SqlMotionsPullError('No active customers with valid TPIDs. Import accounts first.')
        payload = validate_payload(pull_sql_motions(
            sorted(customers), progress_callback=progress_callback,
        ), set(customers))
        # Progress writes may commit, so emit before adding any snapshot records.
        if progress_callback:
            progress_callback({'phase': 'saving', 'progress': 95,
                               'message': 'Saving both complete SQL motion sources.'})
        snapshot = SqlMotionImport(
            customer_count=len({row['tpid'] for kind in ('renewals', 'arc_versions')
                                for row in payload[kind]}),
            source_metadata=json.dumps(payload['metadata'], allow_nan=False),
        )
        db.session.add(snapshot)
        for kind, model in (('renewals', SqlRenewal), ('arc_versions', SqlArcVersion)):
            for row in payload[kind]:
                values = {key: value for key, value in row.items() if key != 'tpid'}
                db.session.add(model(
                    snapshot=snapshot, customer_id=customers[row['tpid']].id, **values,
                ))
        db.session.flush()
        result = {
            'success': True, 'import_id': snapshot.id, 'customer_count': snapshot.customer_count,
            'requested_customer_count': len(customers),
            'renewal_count': len(payload['renewals']), 'arc_version_count': len(payload['arc_versions']),
        }
        db.session.commit()
        return result
    except Exception:
        db.session.rollback()
        logger.exception('SQL motions refresh failed; previous complete snapshot retained')
        raise
