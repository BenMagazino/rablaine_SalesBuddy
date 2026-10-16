"""Copilot daily action items service.

Queries WorkIQ for the user's top action items based on emails, chats, and
meetings. Parses the markdown response into structured action items and
stores them in the ActionItem table with source='copilot'.

Lifecycle:
- On sync, all existing copilot action items are deleted (completed or not)
- New items from the WorkIQ response replace them
- Sync runs at 6 AM local time daily, or on first startup after 6 AM
"""
import json
import logging
import re
import threading
from datetime import datetime, date, time, timedelta, timezone

from app.models import db, ActionItem, UserPreference, Project, DismissedCopilotTask

logger = logging.getLogger(__name__)


def get_copilot_project() -> Project:
    """Get or create the built-in copilot saved tasks project.

    This project holds tasks the user saved from Copilot suggestions
    and completed Copilot tasks. Hidden from the projects list UI.

    Must be called inside an app context.
    """
    project = Project.query.filter_by(project_type='copilot_saved').first()
    if not project:
        project = Project(
            title='Copilot Saved Tasks',
            project_type='copilot_saved',
            status='Active',
        )
        db.session.add(project)
        db.session.commit()
        logger.info("Created built-in copilot_saved project (id=%d)", project.id)
    return project

_COPILOT_PROMPT_BASE = (
    "Look through all my emails, chats, and meetings from the last 7 days, "
    "and let me know the top three things I still need to get done. "
    "Only include items that are still unresolved or have not been responded to yet. "
    "{exclusions}"
    "Return ONLY a JSON array with objects containing: "
    '"title", "description", "source_url" (a Teams or Outlook link if available), '
    '"last_activity_date" (YYYY-MM-DD of the most recent email/chat/meeting about this). '
    "No markdown, no explanation, just the JSON array. "
    "Start with '[' and end with ']'. Use [] if nothing remains. "
    "Do not use numbered lists."
)

_NUMBERED_ITEM = re.compile(
    r'^(?P<indent>[ \t]*)\d+[.)][ \t]+(?P<title>\S[^\r\n]*)', re.MULTILINE,
)
_SOURCE_URL = re.compile(
    r'https?://[^\s<>()\[\]]+(?:\([^\s<>()\[\]]*\)[^\s<>()\[\]]*)*',
)

# Hour (local time) when the daily sync fires
SYNC_HOUR = 6

# Prevent concurrent syncs (startup + scheduler race)
_sync_lock = threading.Lock()


def _build_prompt() -> str:
    """Build the Copilot prompt, excluding completed, saved, and dismissed items.

    Excludes:
    - Copilot tasks completed in the last 7 days
    - Tasks saved to the copilot_saved project (user chose to keep them)
    - Dismissed tasks (user didn't want to act on them)

    Also includes negative feedback examples so the AI avoids similar suggestions.
    """
    exclusions = ""
    try:
        exclude_titles = []

        # Completed copilot tasks from last 7 days
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        completed = ActionItem.query.filter(
            ActionItem.source == 'copilot',
            ActionItem.status == 'completed',
            ActionItem.completed_at >= cutoff,
        ).all()
        exclude_titles.extend(item.title for item in completed)

        # Saved copilot tasks (on the copilot_saved project)
        copilot_proj = Project.query.filter_by(project_type='copilot_saved').first()
        if copilot_proj:
            saved = ActionItem.query.filter(
                ActionItem.project_id == copilot_proj.id,
                ActionItem.status == 'open',
            ).all()
            exclude_titles.extend(item.title for item in saved)

        # Dismissed tasks (don't resurface)
        dismissed_all = DismissedCopilotTask.query.all()
        exclude_titles.extend(item.title for item in dismissed_all)

        if exclude_titles:
            exclusions = (
                "Do NOT include these items because I already completed, saved, or dismissed them: "
                + "; ".join(exclude_titles) + ". "
            )

        # Negative feedback - tell the AI what kinds of suggestions aren't useful
        not_useful = [item for item in dismissed_all if item.reason == 'not_useful']
        if not_useful:
            exclusions += (
                "The user marked these suggestions as not useful, "
                "so do not generate suggestions like these: "
                + "; ".join(item.title for item in not_useful) + ". "
            )
    except Exception:
        logger.debug("Could not query exclusion items for prompt", exc_info=True)

    return _COPILOT_PROMPT_BASE.format(exclusions=exclusions)


def parse_action_items(response: str) -> list[dict]:
    """Parse JSON first, then recover numbered markdown without another WorkIQ call."""
    if not response or not response.strip():
        logger.warning("WorkIQ action-items response is empty")
        return []

    text = response.strip('\r\n')
    items = _parse_json_items(text)
    if items is not None:
        return items

    from app.services.telemetry_shipper import queue_workiq_call

    items = _parse_markdown_items(text)
    if items:
        logger.info("Recovered %d Copilot action items from numbered markdown", len(items))
        queue_workiq_call(
            'copilot_actions', 'parse_recovered',
            failure_type='parse_fell_back_to_markdown',
        )
    else:
        logger.warning("Could not parse Copilot action items as JSON or numbered markdown")
        queue_workiq_call(
            'copilot_actions', 'parse_failed', failure_type='parse_copilot_actions_json',
        )
    return items


def _parse_json_items(text: str) -> list[dict] | None:
    """Return validated JSON items, or None when the format is not usable."""
    from app.services.workiq_service import repair_json_control_chars

    code_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL)
    if code_match:
        text = code_match.group(1)

    arr_start = text.find('[')
    arr_end = text.rfind(']')
    if arr_start == -1 or arr_end == -1 or arr_end <= arr_start:
        return None

    try:
        items = json.loads(repair_json_control_chars(text[arr_start:arr_end + 1]))
    except (json.JSONDecodeError, ValueError):
        return None

    if not isinstance(items, list):
        return None
    if not items:
        return []

    result = []
    for item in items:
        if not isinstance(item, dict):
            logger.warning("Skipping non-object Copilot action item")
            continue
        title = item.get('title')
        optional_fields = [item.get('description'), item.get('source_url')]
        if (not isinstance(title, str) or not title.strip()
                or any(value is not None and not isinstance(value, str)
                       for value in optional_fields)):
            logger.warning("Skipping Copilot action item with invalid fields")
            continue
        result.append({
            'title': title.strip()[:300],
            'description': (item.get('description') or '').strip() or None,
            'source_url': (item.get('source_url') or '').strip() or None,
        })

    return result or None


def _parse_markdown_items(text: str) -> list[dict]:
    """Read top-level numbered titles and their indented or bulleted context."""
    matches = list(_NUMBERED_ITEM.finditer(text))
    if not matches:
        return []
    indent = min(len(match['indent'].expandtabs(4)) for match in matches)
    matches = [match for match in matches if len(match['indent'].expandtabs(4)) == indent]
    result = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        title = re.sub(r'\[([^\]]+)\]\(https?://[^\s]+\)', r'\1', match['title'])
        title = re.sub(r'\*\*|__|`', '', title).strip()
        if not title:
            continue
        description = []
        for line in text[match.end():end].splitlines():
            stripped = line.strip()
            if not stripped:
                description.append('')
                continue
            depth = len(line) - len(line.lstrip(' \t'))
            depth = len(line[:depth].expandtabs(4))
            if depth <= indent and not re.match(r'[-*+][ \t]+', stripped):
                break
            description.append(stripped)
        source = _SOURCE_URL.search('\n'.join([match['title'], *description]))
        result.append({
            'title': title[:300],
            'description': '\n'.join(description).strip() or None,
            'source_url': source.group().rstrip('.,;:!?') if source else None,
        })
    return result


def sync_copilot_action_items(app=None) -> dict:
    """Run the Copilot daily action items sync.

    1. Query WorkIQ for top action items
    2. Parse the response
    3. Delete all existing copilot action items
    4. Create new ones from the parsed response
    5. Update last_copilot_sync timestamp

    Args:
        app: Flask app instance (required for background thread context).

    Returns:
        Dict with success, items_created, and optional error.
    """
    if not _sync_lock.acquire(blocking=False):
        logger.info("Copilot sync already in progress, skipping")
        return {"success": False, "error": "Sync already in progress"}

    from app.services.workiq_service import query_workiq

    def _do_sync():
        from app.services.sync_jobs import publish_progress
        logger.info("Starting Copilot action items sync")
        try:
            # Build prompt with exclusions from recently completed items
            prompt = _build_prompt()
            logger.info("Copilot prompt: %s", prompt[:200])

            # Query WorkIQ (this takes ~30-60 seconds)
            publish_progress({'phase': 'query', 'message': 'Reading WorkIQ action suggestions.'})
            response = query_workiq(prompt, timeout=120,
                                    operation='copilot_actions')
            if not response or not response.strip():
                logger.warning("WorkIQ returned empty response for Copilot action items")
                return {"success": False, "error": "Empty response from WorkIQ"}

            # Parse response
            parsed = parse_action_items(response)
            if not parsed:
                logger.warning("Could not parse any action items from WorkIQ response. "
                               "First 500 chars: %s", response[:500])
                return {"success": False, "error": "No action items parsed"}

            publish_progress({'phase': 'saving', 'total': len(parsed),
                              'message': f'Saving {len(parsed)} parsed action suggestions.'})
            # Delete open copilot items (keep completed ones for exclusion list)
            deleted = ActionItem.query.filter_by(source='copilot', status='open').delete()
            # Also clean up completed copilot items older than 7 days
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            stale_completed = ActionItem.query.filter(
                ActionItem.source == 'copilot',
                ActionItem.status == 'completed',
                ActionItem.completed_at < cutoff,
            ).delete()
            logger.info("Deleted %d open + %d stale completed copilot items", deleted, stale_completed)

            # Create new ones
            for item in parsed:
                ai = ActionItem(
                    title=item['title'],
                    description=item['description'],
                    source='copilot',
                    source_url=item.get('source_url'),
                    status='open',
                    priority='normal',
                )
                db.session.add(ai)

            # Update sync timestamp
            pref = UserPreference.query.first()
            if pref:
                pref.last_copilot_sync = datetime.now(timezone.utc)

            db.session.commit()
            logger.info("Copilot action items sync complete: %d items created", len(parsed))
            return {"success": True, "items_created": len(parsed)}

        except Exception as e:
            db.session.rollback()
            logger.exception("Copilot action items sync failed")
            return {"success": False, "error": str(e)}

    if app:
        with app.app_context():
            try:
                return _do_sync()
            finally:
                _sync_lock.release()
    else:
        try:
            return _do_sync()
        finally:
            _sync_lock.release()


def should_sync() -> bool:
    """Check if a Copilot action items sync is needed.

    Returns True if:
    - Never synced before, OR
    - Last sync was before 6 AM today (local time)

    Must be called inside an app context.
    """
    pref = UserPreference.query.first()
    if not pref or not pref.last_copilot_sync:
        return True

    now = datetime.now()
    today_sync_time = datetime.combine(now.date(), time(SYNC_HOUR, 0))

    # If it's before 6 AM, the sync window hasn't opened yet today
    if now < today_sync_time:
        return False

    # last_copilot_sync is stored as UTC - convert to local for comparison
    last_sync = pref.last_copilot_sync
    if last_sync.tzinfo:
        last_sync_local = last_sync.astimezone().replace(tzinfo=None)
    else:
        # Stored as naive UTC - assume UTC and convert
        last_sync_local = last_sync.replace(tzinfo=timezone.utc).astimezone().replace(tzinfo=None)

    return last_sync_local < today_sync_time


def start_copilot_sync_background(app) -> None:
    """Trigger a Copilot action items sync in a background thread.

    Checks should_sync() first. Does nothing if sync is not needed.

    Args:
        app: Flask app instance.
    """
    with app.app_context():
        from app.models import SyncStatus
        if not SyncStatus.is_complete('accounts'):
            logger.debug("Skipping copilot sync - first account sync not yet completed")
            return
        pref = UserPreference.query.first()
        if pref and not pref.copilot_actions_enabled:
            logger.debug("Copilot action items disabled in settings")
            return
        if not should_sync():
            logger.debug("Copilot action items sync not needed")
            return

    logger.info("Copilot action items sync needed, starting background thread")
    with app.app_context():
        from app.services.sync_jobs import admit_sync
        admit_sync('copilot-actions', initiator='scheduled')


def start_daily_scheduler(app) -> None:
    """Start a background thread that fires the Copilot sync at SYNC_HOUR daily.

    Runs in a loop, sleeping until the next sync window. Safe to call once
    at app startup.

    Args:
        app: Flask app instance.
    """
    import time as _time

    def _scheduler():
        logger.info("Copilot daily scheduler started (sync hour: %d:00 local)", SYNC_HOUR)
        last_sync_date = None

        while True:
            try:
                now = datetime.now()
                today = now.date()

                if now.hour >= SYNC_HOUR and last_sync_date != today:
                    with app.app_context():
                        from app.models import SyncStatus
                        if not SyncStatus.is_complete('accounts'):
                            _time.sleep(300)
                            continue
                        pref = UserPreference.query.first()
                        if pref and not pref.copilot_actions_enabled:
                            last_sync_date = today
                            continue
                        if should_sync():
                            logger.info("Daily scheduler triggering Copilot sync")
                            from app.services.sync_jobs import admit_sync
                            admit_sync('copilot-actions', initiator='scheduled')
                    last_sync_date = today

                # Sleep 5 minutes between checks
                _time.sleep(300)
            except Exception:
                logger.exception("Error in Copilot daily scheduler")
                _time.sleep(300)

    thread = threading.Thread(target=_scheduler, daemon=True)
    thread.start()
