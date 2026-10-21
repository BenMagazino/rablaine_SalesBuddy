"""
U2C (Uncommitted to Committed) snapshot service.

Mirrors the official MSX Insights "Uncommitted to Committed" report so
attainment is measured against the same baseline the field is measured on.

MSXi exposes dated publications and a current payload that can differ from those
publications. Daily refreshes preserve published history and explicitly dated
observations when the publication date is unknown. Historical source access is
not guaranteed, so rollover preserves the last saved quarter when necessary.
"""
import json
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import selectinload

from app.models import (
    Customer, Milestone, Opportunity, U2CSnapshot, U2CSnapshotItem,
    U2CSnapshotVersion, U2CSnapshotVersionItem, db,
)

logger = logging.getLogger(__name__)
U2C_TARGET = 40.0
OBSERVED_VERSION_PREFIX = 'observed:'


def current_fiscal_quarter(ref_date: date | None = None) -> str:
    """Return the fiscal quarter label for a given date (default: today).

    Microsoft FY starts July 1.
    Returns e.g. 'FY26 Q4' for April 2026.
    """
    d = ref_date or date.today()
    month = d.month
    year = d.year
    if month >= 7:
        fy = year + 1
        q = 1 if month <= 9 else 2
    else:
        fy = year
        q = 3 if month <= 3 else 4
    return f"FY{fy % 100:02d} Q{q}"


def fiscal_quarter_date_range(fq_label: str) -> tuple[date, date]:
    """Return (start_date, end_date) for a fiscal quarter label like 'FY26 Q4'.

    Args:
        fq_label: Fiscal quarter label, e.g. 'FY26 Q4'.

    Returns:
        Tuple of (first day of quarter, last day of quarter).
    """
    parts = fq_label.replace('FY', '').split(' Q')
    fy = int(parts[0]) + 2000
    q = int(parts[1])
    # Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
    quarter_starts = {1: (7, fy - 1), 2: (10, fy - 1), 3: (1, fy), 4: (4, fy)}
    start_month, start_year = quarter_starts[q]
    start = date(start_year, start_month, 1)
    end_month = start_month + 3
    end_year = start_year
    if end_month > 12:
        end_month -= 12
        end_year += 1
    end = date(end_year, end_month, 1) - timedelta(days=1)
    return start, end


def previous_fiscal_quarter(fq_label: str) -> str:
    """Return the fiscal quarter label immediately before the given one.

    Args:
        fq_label: Fiscal quarter label, e.g. 'FY27 Q1'.

    Returns:
        The preceding quarter, e.g. 'FY26 Q4'.
    """
    parts = fq_label.replace('FY', '').split(' Q')
    fy = int(parts[0])
    q = int(parts[1])
    if q == 1:
        return f"FY{(fy - 1) % 100:02d} Q4"
    return f"FY{fy % 100:02d} Q{q - 1}"





def _resolve_local_records(row: dict) -> tuple[Milestone | None, Customer | None,
                                               Opportunity | None]:
    """Match an MSXi U2C row to our local milestone / customer / opportunity.

    Matching is by MSX business key (milestone number, opportunity number) and
    falls back to an exact case-insensitive customer-name match, since the MSXi
    report covers every milestone in the territory - including ones on accounts
    we have never synced.

    Args:
        row: One row from ``u2c_pull.pull_u2c_milestones``.

    Returns:
        Tuple of (milestone, customer, opportunity); any element may be None.
    """
    milestone = None
    if row.get('milestone_number'):
        milestone = (
            Milestone.query
            .filter_by(milestone_number=row['milestone_number'])
            .order_by(Milestone.id.desc())
            .first()
        )

    opportunity = None
    if row.get('opportunity_number'):
        opportunity = (
            Opportunity.query
            .filter_by(opportunity_number=row['opportunity_number'])
            .first()
        )
    if opportunity is None and milestone is not None:
        opportunity = milestone.opportunity

    customer = milestone.customer if milestone else None
    if customer is None and opportunity is not None:
        customer = opportunity.customer
    if customer is None and row.get('customer_name'):
        customer = Customer.query.filter(
            db.func.lower(Customer.name) == row['customer_name'].strip().lower()
        ).first()

    return milestone, customer, opportunity


def import_official_snapshot(fq_label: str | None = None,
                             territories: list[str] | None = None,
                             replace: bool = False,
                             version: str | None = None) -> dict:
    """Import the official MSX Insights U2C baseline for a fiscal quarter.

    Pulls the same milestone detail table the MSXi "Uncommitted to Committed"
    report shows, scoped to the territories configured in Sales Buddy, and
    stores it as the snapshot for that quarter.  The baseline comes from the
    report's "starting" columns, so a re-import reproduces the same baseline and
    only refreshes MSXi's current view of each milestone.

    Args:
        fq_label: Fiscal quarter to import (e.g. 'FY27 Q1').  Defaults to the
            current fiscal quarter.
        territories: Sales territory codes to scope to.  Defaults to the
            territories configured in Sales Buddy.
        replace: Replace an existing snapshot for this quarter.  Required when
            one already exists, so a manual snapshot is never silently dropped.
        version: MSXi snapshot version to import.  Defaults to the newest
            retained load.  Pass an explicit ``yyyymmdd`` member to import a
            specific weekly version, which is how a rolled-over quarter gets
            closed out.

    Returns:
        Dict with 'success' plus snapshot totals, or 'error' on failure.
    """
    from app.services.u2c_pull import (
        CURRENT_VERSION, U2CPullError, pull_u2c_milestones,
    )

    fq = fq_label or current_fiscal_quarter()
    pull_version = version or CURRENT_VERSION

    existing = U2CSnapshot.query.filter_by(fiscal_quarter=fq).first()
    if existing and not replace:
        return {
            'success': False,
            'error': f'Snapshot already exists for {fq}',
            'snapshot_id': existing.id,
            'existing_source': existing.source,
            'needs_replace': True,
        }

    try:
        rows = pull_u2c_milestones(fq, territories=territories,
                                   version=pull_version)
    except U2CPullError as exc:
        logger.warning("Official U2C import for %s failed: %s", fq, exc)
        return {'success': False, 'error': str(exc)}

    if not rows:
        return {
            'success': False,
            # An empty pull is never destructive - we return here, before the
            # existing snapshot is touched. The automated refresh relies on
            # that, so keep this check above the delete.
            'error': (
                f'MSXi returned no uncommitted milestones for {fq}. '
                'Check that the quarter and your territories are correct.'
            ),
            'empty': True,
        }

    resolved = _resolve_version_label(fq, rows, pull_version, territories)

    if existing:
        # Keep the quarter header so its permanent weekly history remains
        # attached. Only the current item set is replaced below.
        snapshot = existing
        snapshot.snapshot_date = datetime.now(timezone.utc)
        snapshot.source = U2CSnapshot.SOURCE_MSXI
    else:
        snapshot = U2CSnapshot(
            fiscal_quarter=fq,
            snapshot_date=datetime.now(timezone.utc),
            source=U2CSnapshot.SOURCE_MSXI,
        )
        db.session.add(snapshot)
        db.session.flush()  # Get snapshot.id

    matched, total_acr = _write_snapshot_items(snapshot, rows)
    _stamp_snapshot_pull(snapshot, rows, resolved)
    _record_snapshot_history(snapshot, rows, resolved)
    db.session.commit()

    logger.info(
        "Official MSXi U2C snapshot imported for %s (version %s): %d milestones "
        "(%d matched locally), $%.2f total monthly ACR",
        fq, resolved or pull_version, len(rows), matched, total_acr,
    )

    return {
        'success': True,
        'snapshot_id': snapshot.id,
        'fiscal_quarter': fq,
        'source': snapshot.source,
        'msxi_version': resolved,
        'total_items': len(rows),
        'matched_locally': matched,
        'unmatched': len(rows) - matched,
        'total_monthly_acr': round(total_acr, 2),
        'replaced': bool(existing),
    }


def _resolve_version_label(fq: str, rows: list[dict], pull_version: str,
                           territories: list[str] | None) -> str | None:
    """Turn the version we asked for into the dated member we actually got.

    Only an identical dated publication establishes a publication date.
    An unmatched current payload is saved as a dated observation instead.
    """
    from app.services.u2c_pull import (
        CURRENT_VERSION, U2CPullError, resolve_current_version,
    )

    if pull_version != CURRENT_VERSION:
        return pull_version
    try:
        return resolve_current_version(fq, territories=territories,
                                       current_rows=rows)
    except U2CPullError as exc:
        logger.warning("Could not resolve MSXi version for %s: %s", fq, exc)
        return None


def _write_snapshot_items(snapshot: U2CSnapshot,
                          rows: list[dict]) -> tuple[int, float]:
    """Replace a snapshot's items with the given MSXi rows.

    Args:
        snapshot: The snapshot to populate. Existing items are removed first.
        rows: Rows from ``u2c_pull.pull_u2c_milestones``.

    Returns:
        Tuple of (milestones matched to local records, total starting ACR).
    """
    U2CSnapshotItem.query.filter_by(snapshot_id=snapshot.id).delete()
    db.session.flush()

    total_acr = 0.0
    matched = 0
    for row in rows:
        milestone, customer, opportunity = _resolve_local_records(row)
        if milestone:
            matched += 1

        acr = float(row.get('starting_acr') or 0.0)
        due = row.get('starting_due_date')
        item = U2CSnapshotItem(
            snapshot_id=snapshot.id,
            milestone_id=milestone.id if milestone else None,
            customer_id=customer.id if customer else None,
            customer_name=row.get('customer_name') or 'Unknown',
            milestone_title=(
                row.get('milestone_name') or row.get('milestone_number') or 'Untitled'
            ),
            milestone_number=row.get('milestone_number'),
            # MSXi classifies every row, including milestones we've never
            # synced. Local workload is only a fallback - relying on it meant
            # unmatched rows had no workload at all and silently vanished from
            # any filtered view.
            workload=row.get('workload') or (milestone.workload if milestone else None),
            due_date=datetime.combine(due, datetime.min.time()) if due else None,
            monthly_acr=acr,
            opportunity_name=(
                opportunity.name if opportunity
                else (milestone.opportunity_name if milestone else None)
            ),
            msx_status=row.get('starting_status'),
            opportunity_number=row.get('opportunity_number'),
            owner_alias=row.get('owner_alias'),
            msxi_commitment=row.get('current_commitment'),
            msxi_status=row.get('current_status'),
            msxi_converted_acr=float(row.get('converted_acr') or 0.0),
        )
        db.session.add(item)
        total_acr += acr

    snapshot.total_items = len(rows)
    snapshot.total_monthly_acr = round(total_acr, 2)
    return matched, total_acr


def _stamp_snapshot_pull(snapshot: U2CSnapshot, rows: list[dict],
                         version: str | None) -> None:
    """Record which MSXi load a snapshot's items came from."""
    from app.services.u2c_pull import fingerprint_rows

    snapshot.content_fingerprint = fingerprint_rows(rows)
    snapshot.last_refreshed_at = datetime.now(timezone.utc)
    snapshot.msxi_version = version


def _record_snapshot_history(snapshot: U2CSnapshot, rows: list[dict],
                             version: str | None) -> None:
    """Preserve an unmatched payload under its observation date, not a guessed publish date."""
    key = version or f'{OBSERVED_VERSION_PREFIX}{date.today():%Y%m%d}'
    record_version_totals(snapshot, key, rows)


def record_version_totals(snapshot: U2CSnapshot, version: str,
                          rows: list[dict]) -> U2CSnapshotVersion | None:
    """Store a publication or update the latest observation for one local day.

    Published history stays unchanged once complete. Observation keys carry
    an explicit prefix and never claim to be a source publication identifier.
    """
    from app.services.u2c_pull import version_to_date

    observed = version.startswith(OBSERVED_VERSION_PREFIX)
    version_date = version_to_date(version.removeprefix(OBSERVED_VERSION_PREFIX))
    if version_date is None:
        logger.warning("Skipping invalid U2C history version %r", version)
        return None
    start, end = fiscal_quarter_date_range(snapshot.fiscal_quarter)
    if not start <= version_date <= end:
        logger.info("Skipping U2C history %s outside %s", version, snapshot.fiscal_quarter)
        return None

    entry = U2CSnapshotVersion.query.filter_by(
        snapshot_id=snapshot.id, msxi_version=version,
    ).first()
    if entry is not None and not observed and _version_is_complete(entry):
        return None  # fully stored; dated MSXi versions never change

    if entry is None:
        entry = U2CSnapshotVersion(
            snapshot_id=snapshot.id,
            msxi_version=version,
            version_date=version_date,
        )
        db.session.add(entry)
    else:
        # Completing a version stored before a field existed: clear the old
        # rows first, or the re-pull doubles every per-item total.
        U2CSnapshotVersionItem.query.filter_by(version_id=entry.id).delete()
        db.session.flush()

    if observed:
        entry.captured_at = datetime.now(timezone.utc)
    entry.total_items = len(rows)
    entry.total_starting_acr = round(
        sum(float(r.get('starting_acr') or 0.0) for r in rows), 2)
    entry.total_committed_acr = round(
        sum(float(r.get('starting_acr') or 0.0)
            for r in rows if _row_is_committed(r)), 2)
    entry.total_converted_acr = round(
        sum(float(r.get('converted_acr') or 0.0) for r in rows), 2)
    db.session.flush()  # need entry.id for the item rows

    for row in rows:
        db.session.add(U2CSnapshotVersionItem(
            version_id=entry.id,
            milestone_number=row.get('milestone_number'),
            workload=row.get('workload'),
            starting_acr=float(row.get('starting_acr') or 0.0),
            converted_acr=float(row.get('converted_acr') or 0.0),
            commitment=row.get('current_commitment'),
            status=row.get('current_status'),
        ))
    return entry


def _row_is_committed(row: dict) -> bool:
    """Whether MSXi considered a pulled row committed.

    Mirrors the ``is_committed`` rule ``get_attainment`` applies, so the trend
    and the report's cards agree on what counts.
    """
    return (row.get('current_commitment') == 'Committed'
            or row.get('current_status') == 'Completed')


def _version_is_complete(version: U2CSnapshotVersion) -> bool:
    """Whether a stored version has everything the trend needs.

    Versions written before a field existed are treated as incomplete so they
    get re-pulled while MSXi still retains them, rather than silently answering
    filtered questions with missing data.
    """
    if not version.items.count():
        return False
    return not version.items.filter(
        U2CSnapshotVersionItem.commitment.is_(None)).count()


def backfill_version_history(snapshot: U2CSnapshot,
                             territories: list[str] | None = None,
                             weeks: int | None = None) -> int:
    """Store every retained weekly version we don't already have.

    MSXi keeps roughly seven weeks of loads, so calling this the first time we
    see a quarter recovers most of its attainment trend immediately.

    Only versions whose per-milestone detail is already stored are skipped.  A
    version recorded as totals alone - which is how versions were stored before
    the trend became filterable - is re-pulled so its detail can be filled in
    while MSXi still retains it.

    Returns:
        Number of version rows stored or completed.
    """
    from app.services.u2c_pull import (
        DEFAULT_HISTORY_WEEKS, U2CPullError, pull_version_series,
    )

    complete = {
        v.msxi_version for v in
        U2CSnapshotVersion.query.filter_by(snapshot_id=snapshot.id).all()
        if _version_is_complete(v)
    }
    try:
        series = pull_version_series(
            snapshot.fiscal_quarter,
            territories=territories,
            weeks=weeks or DEFAULT_HISTORY_WEEKS,
            skip=complete,
        )
    except U2CPullError as exc:
        logger.warning("U2C version backfill for %s failed: %s",
                       snapshot.fiscal_quarter, exc)
        return 0

    stored = 0
    for version, rows in series:
        if record_version_totals(snapshot, version, rows) is not None:
            stored += 1
    if stored:
        db.session.commit()
    logger.info("Backfilled %d weekly U2C versions for %s",
                stored, snapshot.fiscal_quarter)
    return stored


# ---------------------------------------------------------------------------
# Automated daily refresh
# ---------------------------------------------------------------------------
# Outcomes reported by refresh_official_snapshot(). These are the four things
# MSXi's behaviour can mean, and they must stay distinguishable: MSXi answers
# "quarter hasn't rolled over", "gap week", and "the model changed under us"
# all with the same empty result set.
OUTCOME_IMPORTED = 'imported'            # new data stored
OUTCOME_UNCHANGED = 'unchanged'          # same weekly load we already had
OUTCOME_NOT_ROLLED_OVER = 'not_rolled_over'  # still publishing the prior quarter
OUTCOME_BROKEN = 'broken'                # auth, territories, or schema problem


def refresh_official_snapshot(territories: list[str] | None = None) -> dict:
    """Refresh the official U2C baseline. The daily automation entry point.

    Pulls the current fiscal quarter from MSXi. Because MSXi only ever serves
    whichever quarter is current *to it*, an empty result is meaningful rather
    than an error, and rollover needs no calendar arithmetic: the outgoing
    quarter is finished exactly when it stops returning rows, which is the same
    moment the new one starts returning them.

    Args:
        territories: Territory codes to scope to. Defaults to the configured ones.

    Returns:
        Dict with 'success', 'outcome' (one of the ``OUTCOME_*`` constants),
        and outcome-specific detail.
    """
    from app.services.u2c_pull import (
        CURRENT_VERSION, U2CPullError, fingerprint_rows, pull_u2c_milestones,
    )

    fq = current_fiscal_quarter()
    try:
        rows = pull_u2c_milestones(fq, territories=territories)
    except U2CPullError as exc:
        logger.warning("U2C refresh for %s failed: %s", fq, exc)
        return {'success': False, 'outcome': OUTCOME_BROKEN,
                'fiscal_quarter': fq, 'error': str(exc)}

    if not rows:
        return _refresh_previous_quarter(fq, territories)

    existing = U2CSnapshot.query.filter_by(fiscal_quarter=fq).first()

    if existing and existing.content_fingerprint == fingerprint_rows(rows):
        # Same weekly load. Note that we looked, but don't churn the items.
        resolved = _resolve_version_label(fq, rows, CURRENT_VERSION, territories)
        _stamp_snapshot_pull(existing, rows, resolved)
        _record_snapshot_history(existing, rows, resolved)
        db.session.commit()
        result = {
            'success': True,
            'outcome': OUTCOME_UNCHANGED,
            'fiscal_quarter': fq,
            'snapshot_id': existing.id,
            'msxi_version': existing.msxi_version,
            'total_items': existing.total_items,
        }
        closed_out = _close_previous_quarter(fq, territories)
        if closed_out is not None:
            result['closed_out'] = closed_out
        return result

    result = import_official_snapshot(
        fq, territories=territories, replace=True, version=CURRENT_VERSION,
    )
    if not result.get('success'):
        result['outcome'] = OUTCOME_BROKEN
        return result

    result['outcome'] = OUTCOME_IMPORTED
    snapshot = U2CSnapshot.query.get(result['snapshot_id'])

    if snapshot:
        # Backfill on every import, not just the first sight of a quarter. A
        # version can come back empty transiently (observed: 20260901 returned
        # nothing on one probe and full data an hour later), and since we only
        # skip versions already stored, re-probing lets those gaps heal. Imports
        # only happen when the content actually changed - roughly weekly - so
        # this costs a handful of queries per week, not per day.
        result['versions_backfilled'] = backfill_version_history(
            snapshot, territories=territories)

    if snapshot:
        closed_out = _close_previous_quarter(fq, territories)
        if closed_out is not None:
            result['closed_out'] = closed_out

    return result


def _close_previous_quarter(fq: str, territories: list[str] | None) -> dict | None:
    """Retry unfinished finalization even if the new quarter was already imported."""
    previous = previous_fiscal_quarter(fq)
    snapshot = U2CSnapshot.query.filter_by(fiscal_quarter=previous).first()
    if snapshot is None or snapshot.is_final:
        return None
    return close_out_quarter(previous, territories=territories)


def _refresh_previous_quarter(fq: str, territories: list[str] | None) -> dict:
    """Handle an empty current-quarter pull.

    Either MSXi hasn't rolled over yet - in which case the previous quarter is
    still live and worth refreshing, which keeps its eventual final numbers
    accurate - or something is broken and we must not touch stored data.
    """
    from app.services.u2c_pull import U2CPullError, pull_u2c_milestones

    prev_fq = previous_fiscal_quarter(fq)
    try:
        prev_rows = pull_u2c_milestones(prev_fq, territories=territories)
    except U2CPullError as exc:
        logger.warning("U2C fallback pull for %s failed: %s", prev_fq, exc)
        return {'success': False, 'outcome': OUTCOME_BROKEN,
                'fiscal_quarter': fq, 'error': str(exc)}

    if not prev_rows:
        # Neither quarter has data. MSXi does not distinguish "no rows" from
        # "you asked for something that no longer exists", so this is as close
        # as we get to an error signal - surface it instead of failing quietly.
        logger.error(
            "U2C refresh found no data for %s or %s - check az login, VPN, "
            "configured territories, and whether the MSXi model changed.",
            fq, prev_fq,
        )
        return {
            'success': False,
            'outcome': OUTCOME_BROKEN,
            'fiscal_quarter': fq,
            'error': (
                f'MSXi returned no U2C data for {fq} or {prev_fq}. Check that '
                "you're signed in and on VPN, that your territories are "
                'configured, and that the MSXi report still works in the portal.'
            ),
        }

    logger.info("MSXi hasn't rolled over to %s yet - refreshing %s instead",
                fq, prev_fq)
    result = import_official_snapshot(prev_fq, territories=territories,
                                      replace=True)
    result['outcome'] = (OUTCOME_NOT_ROLLED_OVER if result.get('success')
                         else OUTCOME_BROKEN)
    result['awaiting_quarter'] = fq
    return result


def rematch_snapshot_items(snapshot: U2CSnapshot) -> int:
    """Re-link a snapshot's items to local milestones without re-pulling MSXi.

    The MSXi report covers every milestone in the territory, including ones on
    accounts we haven't synced yet, so items can start out unmatched. A later
    milestone sync fills those gaps - but MSXi only publishes weekly, so waiting
    for the next import would leave attainment falling back to MSXi's view for
    up to a week. This is a free local pass that closes that window.

    Args:
        snapshot: Snapshot whose items should be re-resolved.

    Returns:
        Number of items that gained a local milestone link.
    """
    newly_matched = 0
    items = U2CSnapshotItem.query.filter_by(snapshot_id=snapshot.id).all()
    for item in items:
        if item.milestone_id:
            continue
        milestone, customer, opportunity = _resolve_local_records({
            'milestone_number': item.milestone_number,
            'opportunity_number': item.opportunity_number,
            'customer_name': item.customer_name,
        })
        if milestone:
            item.milestone_id = milestone.id
            # Only fill workload if MSXi didn't classify the row - MSXi's
            # value is what the U2C report is measured on.
            if not item.workload:
                item.workload = milestone.workload
            newly_matched += 1
        if customer and not item.customer_id:
            item.customer_id = customer.id
        if opportunity and not item.opportunity_name:
            item.opportunity_name = opportunity.name

    if newly_matched:
        db.session.commit()
        logger.info("Re-matched %d previously unmatched U2C items for %s",
                    newly_matched, snapshot.fiscal_quarter)
    return newly_matched


def rematch_current_snapshot() -> int:
    """Re-link the current quarter's snapshot items. No-op if none exists."""
    snapshot = U2CSnapshot.query.filter_by(
        fiscal_quarter=current_fiscal_quarter()).first()
    if snapshot is None:
        return 0
    return rematch_snapshot_items(snapshot)


def close_out_quarter(fq_label: str,
                      territories: list[str] | None = None) -> dict:
    """Capture a rolled-over quarter's final numbers, then freeze it.

    Try retained publications within that quarter, newest first. If the source
    no longer serves them, preserve the last locally saved snapshot. Its age
    depends on the last successful refresh; offline machines can have older data.

    Args:
        fq_label: The quarter that just ended, e.g. 'FY26 Q4'.
        territories: Territory codes, defaulting to the configured ones.

    Returns:
        Dict describing the source used. Storage failures propagate for retry.
    """
    from app.services.u2c_pull import (
        DEFAULT_HISTORY_WEEKS, U2CPullError, quarter_versions,
        pull_u2c_milestones,
    )

    snapshot = U2CSnapshot.query.filter_by(fiscal_quarter=fq_label).first()
    if snapshot is None:
        return {'success': False, 'reason': 'no_snapshot', 'fiscal_quarter': fq_label}
    if snapshot.is_final:
        return {'success': True, 'reason': 'already_final', 'fiscal_quarter': fq_label}

    for version in quarter_versions(fq_label, DEFAULT_HISTORY_WEEKS):
        try:
            rows = pull_u2c_milestones(fq_label, territories=territories,
                                       version=version)
        except U2CPullError as exc:
            logger.warning("Close-out probe %s for %s failed: %s",
                           version, fq_label, exc)
            continue
        if not rows:
            continue

        matched, total_acr = _write_snapshot_items(snapshot, rows)
        _stamp_snapshot_pull(snapshot, rows, version)
        record_version_totals(snapshot, version, rows)
        snapshot.is_final = True
        db.session.commit()
        logger.info(
            "Closed out %s from MSXi version %s: %d milestones, $%.2f ACR",
            fq_label, version, len(rows), total_acr,
        )
        return {
            'success': True,
            'fiscal_quarter': fq_label,
            'msxi_version': version,
            'total_items': len(rows),
            'matched_locally': matched,
            'finalised': True,
        }

    # Nothing retained still resolves. Freeze what we already have.
    snapshot.is_final = True
    db.session.commit()
    logger.info(
        "No retained MSXi version still serves %s - freezing the last captured "
        "snapshot (version %s) as final.",
        fq_label, snapshot.msxi_version or 'unknown',
    )
    return {
        'success': True,
        'fiscal_quarter': fq_label,
        'msxi_version': snapshot.msxi_version,
        'finalised': True,
        'reason': 'no_retained_version',
    }


def get_attainment(
    snapshot_id: int, workload_prefix: str | None = None, *,
    customer_ids: tuple[int, ...] | None = None,
    workloads: list[str] | None = None,
) -> dict:
    """Calculate U2C attainment for a snapshot.

    Checks the current status of each snapshotted milestone to see if it
    has moved to Committed or Completed since the snapshot was taken.

    Args:
        snapshot_id: ID of the U2CSnapshot to analyze.
        workload_prefix: Optional workload prefix filter (e.g. 'Data:' to
                         filter to Data milestones only).
        customer_ids: Optional customer IDs from the frozen snapshot population.
            An empty tuple matches no items. Current milestone ownership never
            changes which customer's baseline an item belongs to.
        workloads: Exact detailed workload names, OR within the selection.
            None or an empty list means all workloads.

    Returns:
        Dict with attainment stats and item details.
    """
    from app.services.workload_filters import normalize_workloads

    workloads = normalize_workloads(workloads)
    snapshot = U2CSnapshot.query.get(snapshot_id)
    if not snapshot:
        return {'success': False, 'error': 'Snapshot not found'}

    items_query = U2CSnapshotItem.query.options(
        selectinload(U2CSnapshotItem.customer).selectinload(Customer.seller),
    ).filter_by(snapshot_id=snapshot_id)
    if customer_ids is not None:
        items_query = items_query.filter(U2CSnapshotItem.customer_id.in_(customer_ids))
    if workload_prefix:
        items_query = items_query.filter(
            U2CSnapshotItem.workload.like(f'{workload_prefix}%')
        )
    if workloads is not None:
        items_query = items_query.filter(
            db.func.trim(db.func.coalesce(U2CSnapshotItem.workload, '')).in_(workloads),
        )
    items = items_query.all()
    milestone_ids = {item.milestone_id for item in items if item.milestone_id}
    live_milestones = {
        milestone.id: milestone
        for milestone in (
            Milestone.query
            .options(selectinload(Milestone.engagements))
            .filter(Milestone.id.in_(milestone_ids))
            .all()
        )
    } if milestone_ids else {}

    # Also filter by due date within the snapshot's fiscal quarter
    q_start, q_end = fiscal_quarter_date_range(snapshot.fiscal_quarter)
    from datetime import time as _time
    q_start_dt = datetime.combine(q_start, _time.min)
    q_end_dt = datetime.combine(q_end, _time(23, 59, 59))

    target_total = 0.0
    committed_total = 0.0
    attainment_total = 0.0
    committed_items = []
    remaining_items = []

    for item in items:
        # Only include milestones due within the snapshot's fiscal quarter
        if not item.due_date or not (q_start_dt <= item.due_date <= q_end_dt):
            continue

        target_total += item.monthly_acr

        # Check current live milestone status
        live_ms = live_milestones.get(item.milestone_id)
        is_committed = False
        current_status = item.msx_status  # fallback to snapshot status
        current_commitment = 'Uncommitted'
        live_acr = item.monthly_acr  # fallback to snapshot ACR
        source = 'snapshot'

        if live_ms:
            source = 'live'
            current_status = live_ms.msx_status
            current_commitment = live_ms.customer_commitment or 'Uncommitted'
            live_acr = live_ms.monthly_usage or 0.0
            is_committed = (
                current_commitment == 'Committed'
                or current_status in ('Completed',)
            )
        elif item.msxi_commitment or item.msxi_status:
            # Official import with no local milestone (an account we don't sync):
            # fall back to MSXi's own view of where the milestone landed.
            source = 'msxi'
            current_status = item.msxi_status or item.msx_status
            current_commitment = item.msxi_commitment or 'Uncommitted'
            is_committed = (
                current_commitment == 'Committed'
                or current_status in ('Completed',)
            )
            if is_committed and item.msxi_converted_acr:
                live_acr = item.msxi_converted_acr

        # Look up seller via customer relationship
        seller_name = None
        seller_id = None
        if item.customer and item.customer.seller:
            seller_name = item.customer.seller.name
            seller_id = item.customer.seller_id

        item_data = {
            'id': item.id,
            'milestone_id': item.milestone_id,
            'customer_name': item.customer_name,
            'customer_id': item.customer_id,
            'seller_name': seller_name,
            'seller_id': seller_id,
            'milestone_title': item.milestone_title,
            'milestone_number': item.milestone_number,
            'workload': item.workload,
            'due_date': item.due_date.isoformat() if item.due_date else None,
            'monthly_acr': item.monthly_acr,
            'live_acr': live_acr,
            'opportunity_name': item.opportunity_name,
            'owner_alias': item.owner_alias,
            'snapshot_status': item.msx_status,
            'current_status': current_status,
            'current_commitment': current_commitment,
            'status_source': source,
            'is_committed': is_committed,
            'engagements': [
                {
                    'id': engagement.id,
                    'title': engagement.title,
                    'status': engagement.status,
                }
                for engagement in live_ms.engagements
            ] if live_ms else [],
        }

        if is_committed:
            committed_total += item.monthly_acr   # snapshot ACR for U2C%
            attainment_total += live_acr           # live ACR for Attainment%
            committed_items.append(item_data)
        else:
            remaining_items.append(item_data)

    # Sort remaining by monthly ACR descending (highest value first)
    remaining_items.sort(key=lambda x: x['monthly_acr'], reverse=True)

    u2c_pct = round((committed_total / target_total * 100), 1) if target_total > 0 else 0.0
    attainment_pct = round(
        (attainment_total / target_total * 100), 1
    ) if target_total > 0 else 0.0

    return {
        'success': True,
        'fiscal_quarter': snapshot.fiscal_quarter,
        'snapshot_date': snapshot.snapshot_date.isoformat(),
        'source': snapshot.source,
        'msxi_version': snapshot.msxi_version,
        'is_final': snapshot.is_final,
        'target_total': round(target_total, 2),
        'committed_total': round(committed_total, 2),
        'attainment_total': round(attainment_total, 2),
        'u2c_pct': u2c_pct,
        'attainment_pct': attainment_pct,
        'committed_count': len(committed_items),
        'remaining_count': len(remaining_items),
        'total_in_scope': len(committed_items) + len(remaining_items),
        'committed_items': committed_items,
        'remaining_items': remaining_items,
    }


def get_attainment_trend(snapshot_id: int,
                         workload_prefix: str | None = None, *,
                         include_live: bool = False,
                         reference: date | None = None,
                         customer_ids: tuple[int, ...] | None = None,
                         workloads: list[str] | None = None) -> list[dict]:
    """Return a quarter's weekly attainment points, oldest first.

    Sourced from our own stored copies of MSXi's weekly versions, so the series
    keeps growing past MSXi's ~7-week retention and covers the whole quarter by
    the time it ends.

    ``committed_acr`` is how much of the frozen starting baseline had committed
    by that week, which is what the report's "Committed ACR" card shows.  MSXi's
    own converted-pipeline measure is returned alongside it as
    ``msxi_converted_acr`` but is deliberately not the headline: a milestone can
    convert for more than it started at (one $2,000 baseline converting at
    $5,600), so that measure can exceed the target and wouldn't reconcile with
    the cards.

    Nothing is smoothed or clamped: MSXi restates conversions downward between
    loads, so the line legitimately dips.

    Args:
        snapshot_id: ID of the U2CSnapshot to chart.
        workload_prefix: Optional workload prefix (e.g. 'Data') to scope the
            series to, matching the report's workload filter. Weeks recorded
            before per-milestone detail was stored are skipped when filtering,
            since they can only answer the territory-wide question.
        include_live: Append a separate Today point using current commitment
            status and dollars from the latest imported snapshot. Only applies
            to the current, non-final quarter. Every weekly publish is retained,
            including a publish on the same date as Today.
        reference: Date for the live endpoint, defaulting to today.
        customer_ids: Optional frozen snapshot customer scope, applied through
            milestone numbers to the stored per-version details. Totals-only
            weeks are omitted because their customer breakdown is unknown.
        workloads: Exact detailed workload OR selection; empty means unrestricted.

    Returns:
        List of dicts with 'date', 'label', 'items', 'starting_acr',
        'committed_acr', 'msxi_converted_acr' and 'u2c_pct'. The live point has
        source='live' and no historical MSXi converted-pipeline measure.
    """
    from app.services.workload_filters import normalize_workloads

    workloads = normalize_workloads(workloads)
    versions = (
        U2CSnapshotVersion.query
        .filter_by(snapshot_id=snapshot_id)
        .order_by(U2CSnapshotVersion.version_date)
        .all()
    )
    snapshot = db.session.get(U2CSnapshot, snapshot_id)
    if snapshot is None:
        return []
    start, end = fiscal_quarter_date_range(snapshot.fiscal_quarter)

    committed_sum = db.func.sum(
        db.case(
            (db.or_(U2CSnapshotVersionItem.commitment == 'Committed',
                    U2CSnapshotVersionItem.status == 'Completed'),
             U2CSnapshotVersionItem.starting_acr),
            else_=0.0,
        )
    )

    points = []
    for version in versions:
        if not start <= version.version_date <= end:
            continue
        if workload_prefix or customer_ids is not None or workloads is not None:
            if not version.items.count():
                continue  # totals-only week: can't answer a filtered question
            query = (
                db.session.query(
                    db.func.count(U2CSnapshotVersionItem.id),
                    db.func.coalesce(
                        db.func.sum(U2CSnapshotVersionItem.starting_acr), 0.0),
                    db.func.coalesce(committed_sum, 0.0),
                    db.func.coalesce(
                        db.func.sum(U2CSnapshotVersionItem.converted_acr), 0.0),
                )
                .filter(
                    U2CSnapshotVersionItem.version_id == version.id,
                )
            )
            if workload_prefix:
                query = query.filter(
                    U2CSnapshotVersionItem.workload.like(f'{workload_prefix}%'),
                )
            if workloads is not None:
                query = query.filter(
                    db.func.trim(db.func.coalesce(
                        U2CSnapshotVersionItem.workload, '',
                    )).in_(workloads),
                )
            if customer_ids is not None:
                numbers = db.select(U2CSnapshotItem.milestone_number).where(
                    U2CSnapshotItem.snapshot_id == snapshot_id,
                    U2CSnapshotItem.customer_id.in_(customer_ids),
                    U2CSnapshotItem.due_date >= datetime.combine(start, datetime.min.time()),
                    U2CSnapshotItem.due_date <= datetime.combine(end, datetime.max.time()),
                )
                query = query.filter(U2CSnapshotVersionItem.milestone_number.in_(numbers))
            count, starting, committed, converted = query.one()
        else:
            count = version.total_items
            starting = version.total_starting_acr
            committed = version.total_committed_acr
            converted = version.total_converted_acr

        points.append(_historical_attainment_point(version, count, starting, committed, converted))
    if include_live:
        scope: dict = {'customer_ids': customer_ids} if customer_ids is not None else {}
        if workloads is not None:
            scope['workloads'] = workloads
        return _append_live_attainment_point(
            points, snapshot_id, workload_prefix, reference or date.today(), **scope)
    return points


def _historical_attainment_point(
    version: U2CSnapshotVersion, count: int, starting: float, committed: float, converted: float,
) -> dict:
    """Keep weekly labels and percentage calculations identical for every workload scope."""
    observed = version.msxi_version.startswith(OBSERVED_VERSION_PREFIX)
    label = version.version_date.strftime('%b %d')
    return {
        'version_id': version.id,
        'date': version.version_date.isoformat(),
        'label': f'{label} (observed)' if observed else label,
        'source': 'observed' if observed else 'published',
        'items': count,
        'starting_acr': round(starting, 2),
        'committed_acr': round(committed, 2),
        'msxi_converted_acr': round(converted, 2),
        'u2c_pct': round((committed / starting) * 100, 1) if starting else 0.0,
    }


def _append_live_attainment_point(
    points: list[dict], snapshot_id: int, workload_prefix: str | None, reference: date,
    *, customer_ids: tuple[int, ...] | None = None, workloads: list[str] | None = None,
) -> list[dict]:
    """Append Today without replacing any published snapshot point."""
    snapshot = db.session.get(U2CSnapshot, snapshot_id)
    if (snapshot is None or snapshot.is_final
            or snapshot.fiscal_quarter != current_fiscal_quarter(reference)):
        return points
    live_date = reference.isoformat()
    scope: dict = {}
    if customer_ids is not None:
        scope['customer_ids'] = customer_ids
    if workloads is not None:
        scope['workloads'] = workloads
    attainment = get_attainment(snapshot_id, workload_prefix, **scope)
    live_point = {
        'date': live_date,
        'label': f"Today ({reference.strftime('%b %d')}, live)",
        'source': 'live',
        'items': attainment['total_in_scope'],
        'starting_acr': attainment['target_total'],
        'committed_acr': attainment['committed_total'],
        'msxi_converted_acr': None,
        'u2c_pct': attainment['u2c_pct'],
    }
    return points + [live_point]


def get_attainment_trend_by_workload(
    snapshot_id: int, *, include_live: bool = False, detailed: bool = False,
) -> dict[str, list[dict]]:
    """Return the trend per workload plus the overall series.

    Prefix mode serves existing grouped consumers. Detailed mode scopes each
    full workload independently so multi-selection can sum dollar bases, not percentages.
    ``''`` holds the unfiltered series. Detailed series use JSON-encoded keys to
    distinguish a missing workload from that overall series.
    """
    series = {'': get_attainment_trend(snapshot_id, include_live=include_live)}
    if detailed:
        return _get_detailed_workload_trends(snapshot_id, series)
    for prefix in get_workload_prefixes(snapshot_id):
        series[prefix] = get_attainment_trend(
            snapshot_id, prefix, include_live=include_live)
    return series


def _get_detailed_workload_trends(snapshot_id: int, series: dict[str, list[dict]]) -> dict:
    """Batch full-workload history and live totals without one calculation per workload."""
    snapshot = db.session.get(U2CSnapshot, snapshot_id)
    if snapshot is None:
        return series
    start, end = fiscal_quarter_date_range(snapshot.fiscal_quarter)
    versions = U2CSnapshotVersion.query.filter(
        U2CSnapshotVersion.snapshot_id == snapshot_id,
        U2CSnapshotVersion.version_date >= start,
        U2CSnapshotVersion.version_date <= end,
    ).order_by(U2CSnapshotVersion.version_date).all()
    details = U2CSnapshotVersionItem.query.filter(
        U2CSnapshotVersionItem.version_id.in_([version.id for version in versions]),
    ).all()
    names = {
        (name or '').strip() for name, in db.session.query(U2CSnapshotItem.workload)
        .filter(U2CSnapshotItem.snapshot_id == snapshot_id).distinct()
    }
    history: dict[int, dict[str, tuple[int, float, float, float]]] = {}
    for item in details:
        name = (item.workload or '').strip()
        names.add(name)
        version_totals = history.setdefault(item.version_id, {})
        count, starting, committed, converted = version_totals.get(name, (0, 0.0, 0.0, 0.0))
        committed_delta = item.starting_acr if item.is_committed else 0.0
        version_totals[name] = (
            count + 1, starting + item.starting_acr,
            committed + committed_delta, converted + item.converted_acr,
        )
    live_template = next((point for point in series[''] if point['source'] == 'live'), None)
    live_totals: dict[str, tuple[int, float, float]] = {}
    if live_template is not None:
        attainment = get_attainment(snapshot_id)
        for row in attainment['remaining_items'] + attainment['committed_items']:
            name = (row['workload'] or '').strip()
            count, starting, committed = live_totals.get(name, (0, 0.0, 0.0))
            live_totals[name] = (
                count + 1, starting + row['monthly_acr'],
                committed + (row['monthly_acr'] if row['is_committed'] else 0.0),
            )
    for name in sorted(names):
        points = [
            _historical_attainment_point(
                version, *history[version.id].get(name, (0, 0.0, 0.0, 0.0)),
            )
            for version in versions if version.id in history
        ]
        if live_template is not None:
            count, starting, committed = live_totals.get(name, (0, 0.0, 0.0))
            points.append({
                **live_template, 'items': count,
                'starting_acr': round(starting, 2), 'committed_acr': round(committed, 2),
                'u2c_pct': round(committed / starting * 100, 1) if starting else 0.0,
            })
        series[json.dumps(name, ensure_ascii=False)] = points
    return series


def get_workload_prefixes(snapshot_id: int) -> list[str]:
    """Return distinct workload prefixes for a snapshot's items.

    Extracts the part before the first colon (e.g. 'Data' from 'Data: Fabric').
    """
    items = U2CSnapshotItem.query.filter_by(snapshot_id=snapshot_id).all()
    prefixes = set()
    for item in items:
        if item.workload and ':' in item.workload:
            prefixes.add(item.workload.split(':')[0].strip())
    return sorted(prefixes)
