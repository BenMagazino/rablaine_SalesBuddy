"""
Opportunity comment tracking service (DSS mode).

Posts call-summary comments to MSX opportunities for notes that are linked
to opportunities. Mirrors the behavior of milestone_tracking.track_note_on_milestones
but writes to the opportunity entity instead of milestones.

- One comment per note-opportunity link, matched/upserted by ref tag (e.g. "note-42").
- AI-summarized via the same gateway endpoint, including only new info not
  already present in the opportunity's existing comments.
- Gated by the same ``msx_auto_writeback`` user preference as milestone writeback.
- Runs in a background thread so the user isn't blocked.
"""
import logging
import threading
from datetime import timezone

from app.services.milestone_tracking import (
    _NOTE_REF,
    _add_footer,
    _ai_summarize_note,
    _notify_error,
    _strip_html,
    is_auto_writeback_enabled,
)

logger = logging.getLogger(__name__)


def _refresh_cached_opportunity_comments(msx_opportunity_id: str, app=None) -> None:
    """Re-read comments from MSX and update the local Opportunity cache."""
    try:
        from app.services.msx_api import get_opportunity_comments
        from app.models import Opportunity, db
        import json as _json
        result = get_opportunity_comments(msx_opportunity_id)
        if not result or not result.get("success"):
            return
        comments_json = _json.dumps(result.get("comments", []))

        def _update_db():
            opp = Opportunity.query.filter_by(
                msx_opportunity_id=msx_opportunity_id
            ).first()
            if opp:
                opp.cached_comments_json = comments_json
                db.session.commit()
                print(f"[opportunity-tracking] refreshed cached comments for {msx_opportunity_id}")

        if app:
            with app.app_context():
                _update_db()
        else:
            _update_db()
    except Exception as e:
        logger.debug(f"Failed to refresh cached comments for opportunity {msx_opportunity_id}: {e}")


def _upsert_to_msx_opportunity(
    msx_opportunity_id: str,
    content: str,
    ref_tag: str,
    comment_date: str | None = None,
) -> dict | None:
    """Upsert a comment on an MSX opportunity. Logs to diag log."""
    if not msx_opportunity_id:
        return None
    try:
        from app.services.msx_api import upsert_opportunity_comment
        result = upsert_opportunity_comment(
            msx_opportunity_id, content, ref_tag, comment_date=comment_date,
        )
        if not result.get("success"):
            logger.warning(
                f"MSX comment upsert failed for opportunity {msx_opportunity_id}: "
                f"{result.get('error')}"
            )
        try:
            from app.services.diagnostic_log import diag_log
            diag_log('writeback',
                     opportunity_id=msx_opportunity_id,
                     ref_tag=ref_tag,
                     content=content,
                     success=result.get('success'),
                     error=result.get('error'))
        except Exception:
            pass
        return result
    except Exception as e:
        logger.warning(f"MSX comment upsert failed for opportunity {msx_opportunity_id}: {e}")
        try:
            from app.services.diagnostic_log import diag_log
            diag_log('writeback',
                     opportunity_id=msx_opportunity_id,
                     ref_tag=ref_tag,
                     content=content,
                     success=False,
                     error=str(e))
        except Exception:
            pass
        return {"success": False, "error": str(e)}


def _track_note_opportunity_worker(
    opportunities_data: list[dict],
    plain: str,
    customer_name: str,
    topics: str,
    ref_tag: str,
    call_date_iso: str,
    note_id: int | None = None,
    app=None,
) -> None:
    """Background worker for posting note summaries to opportunities."""
    print(f"[opportunity-tracking] worker started: {ref_tag}, {len(opportunities_data)} opportunity(ies)")

    if app:
        with app.app_context():
            if not is_auto_writeback_enabled():
                print(f"[opportunity-tracking] auto-writeback disabled, skipping {ref_tag}")
                return

    for opp in opportunities_data:
        msx_id = opp["msx_opportunity_id"]
        try:
            from app.services.msx_api import get_opportunity_comments
            print(f"[opportunity-tracking] reading existing comments from {msx_id}")
            read_result = get_opportunity_comments(msx_id)
            raw_comments = (read_result or {}).get("comments", [])
            existing_comments = [c.get("comment", "") for c in raw_comments]

            ref_marker = f"· {ref_tag} ·"
            has_existing_post = any(ref_marker in c for c in existing_comments)

            print(f"[opportunity-tracking] calling AI summarize...")
            ai_summary = _ai_summarize_note(
                plain, customer_name, topics, existing_comments,
                note_id=note_id, log_prefix="opportunity-tracking",
            )
            print(f"[opportunity-tracking] AI result: {'got summary' if ai_summary else 'None (skip MSX write)'}")

            if ai_summary:
                content_with_footer = _add_footer(ai_summary, ref_tag)
                _upsert_to_msx_opportunity(
                    msx_id, content_with_footer, ref_tag,
                    comment_date=call_date_iso,
                )
                _refresh_cached_opportunity_comments(msx_id, app)
                print(f"[opportunity-tracking] AI summary upserted to {msx_id}")
            elif not has_existing_post:
                # First-time sync for this note; AI said no new info but we
                # have never posted for this note before. Create a minimal
                # comment (note body only) so the note is represented on the opportunity.
                print(
                    f"[opportunity-tracking] no AI summary but no existing post "
                    f"for {ref_tag} on {msx_id}, creating initial comment"
                )
                content_with_footer = f"{plain[:500]}\n\n· {ref_tag} ·"
                _upsert_to_msx_opportunity(
                    msx_id, content_with_footer, ref_tag,
                    comment_date=call_date_iso,
                )
                _refresh_cached_opportunity_comments(msx_id, app)
                print(f"[opportunity-tracking] fallback comment created on {msx_id}")
            else:
                print(
                    f"[opportunity-tracking] no AI summary for {ref_tag} on {msx_id}, "
                    "existing post found - no update needed"
                )
        except Exception as e:
            print(f"[opportunity-tracking] EXCEPTION for {msx_id}: {e}")
            _notify_error(
                "Failed to update opportunity comment in MSX.",
                note_id=note_id,
            )


def track_note_on_opportunities(note, background: bool = True) -> list[dict] | None:
    """Post or update a call summary comment on each linked opportunity.

    Mirrors track_note_on_milestones but for opportunities (DSS mode).
    Gated by the same msx_auto_writeback preference.

    Returns:
        None when background=True, or list of result dicts when synchronous.
    """
    if not note.opportunities:
        print(f"[opportunity-tracking] note {note.id}: no opportunities linked, skipping")
        return [] if not background else None

    customer_name = note.customer.name if note.customer else 'General'
    topics = ', '.join(t.name for t in note.topics[:5]) if note.topics else 'None'
    plain = _strip_html(note.content)
    ref_tag = _NOTE_REF.format(id=note.id)

    cd = note.call_date
    if cd.tzinfo is None:
        cd = cd.astimezone()
    call_date_iso = cd.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

    opportunities_data = [
        {"msx_opportunity_id": o.msx_opportunity_id, "opportunity_id": o.id}
        for o in note.opportunities
        if o.msx_opportunity_id
    ]
    print(f"[opportunity-tracking] note {note.id}: {len(opportunities_data)} opportunities with MSX IDs")

    if not opportunities_data:
        if not background:
            return [{"opportunity_id": o.id, "msx_result": None, "ai_used": False}
                    for o in note.opportunities]
        return None

    note_id = note.id

    if background:
        print(f"[opportunity-tracking] note {note_id}: spawning background thread")
        from flask import current_app
        app = current_app._get_current_object()
        thread = threading.Thread(
            target=_track_note_opportunity_worker,
            args=(opportunities_data, plain, customer_name, topics, ref_tag, call_date_iso, note_id, app),
            daemon=True,
        )
        thread.start()
        return None

    _track_note_opportunity_worker(
        opportunities_data, plain, customer_name, topics, ref_tag, call_date_iso, note_id,
    )
    return [{"opportunity_id": o["opportunity_id"], "msx_result": None, "ai_used": False}
            for o in opportunities_data]
