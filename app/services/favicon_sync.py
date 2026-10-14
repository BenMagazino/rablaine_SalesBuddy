"""Worker-owned favicon refresh using existing fetch behavior."""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.models import Customer, SyncStatus, db
logger = logging.getLogger(__name__)

def sync_favicons(progress, *, missing_only: bool = False):
    """Re-fetch ALL favicons, including ones already fetched.

    Uses 4 parallel workers. Useful when favicon quality improves or domains change.
    """
    from app.routes.admin import fetch_favicon_for_domain

    try:
        SyncStatus.mark_started('favicons')

        query = Customer.query.filter(
            Customer.website.isnot(None),
            Customer.website != '',
        )
        if missing_only:
            query = query.filter(db.or_(Customer.favicon_b64.is_(None), Customer.favicon_b64 == ''))
        customers = query.all()

        if not customers:
            SyncStatus.mark_completed('favicons', success=True, items_synced=0,
                                      details='No customers with websites')
            return {
                'success': True,
                'message': 'No customers with websites.',
                'fetched': 0, 'failed': 0,
            }

        work = [(c.id, c.website) for c in customers]

        results: dict[int, str | None] = {}
        with ThreadPoolExecutor(max_workers=4) as pool:
            future_to_id = {
                pool.submit(fetch_favicon_for_domain, domain): cid
                for cid, domain in work
            }
            for future in as_completed(future_to_id):
                cid = future_to_id[future]
                results[cid] = future.result()
                progress({'phase': 'fetching', 'current': len(results), 'total': len(work),
                          'progress': 100 * len(results) / max(len(work), 1),
                          'message': 'Refreshing customer favicons.'})

        fetched = 0
        failed = 0
        for cid, b64 in results.items():
            cust = db.session.get(Customer, cid)
            if not cust:
                continue
            if b64:
                cust.favicon_b64 = b64
                fetched += 1
            else:
                cust.favicon_b64 = None
                failed += 1

        db.session.commit()
        SyncStatus.mark_completed(
            'favicons', success=True, items_synced=fetched,
            details=f'{fetched} refreshed, {failed} unavailable',
        )
        return {
            'success': True,
            'message': f'Refreshed {fetched} favicons, {failed} unavailable.',
            'fetched': fetched,
            'failed': failed,
            'skipped': 0,
        }
    except Exception as e:
        db.session.rollback()
        SyncStatus.mark_completed('favicons', success=False, details=str(e))
        return {'success': False, 'error': str(e)}
