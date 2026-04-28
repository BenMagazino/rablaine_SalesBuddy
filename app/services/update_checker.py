"""
Update checker service for Sales Buddy.

Periodically checks if new commits are available on the remote main branch
and caches the result. Used to show an update notification in the UI.

Also fetches CHANGELOG.md from the remote and caches parsed entries so the
admin panel can show "what's new" before and after applying an update.
"""
import re
import subprocess
import threading
import time
import logging
from datetime import datetime, timezone, date

import requests

logger = logging.getLogger(__name__)

CHANGELOG_URL = (
    'https://raw.githubusercontent.com/rablaine/SalesBuddy/refs/heads/main/CHANGELOG.md'
)

# Cached update state (module-level singleton)
_update_state = {
    'available': False,
    'local_commit': None,
    'remote_commit': None,
    'commits_behind': 0,
    'last_checked': None,
    'error': None,
}

# Cached changelog state
_changelog_state = {
    'entries': [],          # list of {'date': 'YYYY-MM-DD', 'bullets': [str, ...]}
    'last_fetched': None,
    'error': None,
}

_lock = threading.Lock()


def get_update_state() -> dict:
    """Return the current cached update state."""
    with _lock:
        return dict(_update_state)


def check_for_updates() -> dict:
    """
    Run git fetch and compare local HEAD to origin/main.
    Updates the cached state and returns it.
    """
    try:
        # git fetch origin main (quiet, timeout after 15 seconds)
        subprocess.run(
            ['git', 'fetch', 'origin', 'main', '--quiet'],
            capture_output=True, text=True, timeout=15,
            cwd=_get_repo_root()
        )

        repo_root = _get_repo_root()

        # Get local HEAD commit
        local = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            capture_output=True, text=True, timeout=5, cwd=repo_root
        ).stdout.strip()

        # Get remote commit
        remote = subprocess.run(
            ['git', 'rev-parse', 'origin/main'],
            capture_output=True, text=True, timeout=5, cwd=repo_root
        ).stdout.strip()

        # Count commits behind
        behind = 0
        if local != remote:
            result = subprocess.run(
                ['git', 'rev-list', '--count', f'{local}..{remote}'],
                capture_output=True, text=True, timeout=5, cwd=repo_root
            )
            behind = int(result.stdout.strip()) if result.stdout.strip() else 0

        with _lock:
            _update_state['available'] = local != remote and behind > 0
            _update_state['local_commit'] = local[:7] if local else None
            _update_state['remote_commit'] = remote[:7] if remote else None
            _update_state['commits_behind'] = behind
            _update_state['last_checked'] = datetime.now(timezone.utc).isoformat()
            _update_state['error'] = None

    except subprocess.TimeoutExpired:
        logger.warning("Update check timed out (git fetch)")
        with _lock:
            _update_state['error'] = 'timeout'
            _update_state['last_checked'] = datetime.now(timezone.utc).isoformat()
    except FileNotFoundError:
        logger.warning("Git not found -- update checking disabled")
        with _lock:
            _update_state['error'] = 'git_not_found'
            _update_state['last_checked'] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        logger.warning(f"Update check failed: {e}")
        with _lock:
            _update_state['error'] = str(e)
            _update_state['last_checked'] = datetime.now(timezone.utc).isoformat()

    return get_update_state()


def _get_repo_root() -> str:
    """Get the repository root directory."""
    import os
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ---------------------------------------------------------------------------
# Changelog
# ---------------------------------------------------------------------------

_DATE_HEADING_RE = re.compile(r'^##\s+(\d{4}-\d{2}-\d{2})\s*$')
_BULLET_RE = re.compile(r'^\s*[-*]\s+(.+?)\s*$')


def parse_changelog(text: str) -> list:
    """Parse CHANGELOG.md into a list of {date, bullets} entries.

    Recognized format:
        ## YYYY-MM-DD
        - bullet one
        - bullet two

    Anything outside of date sections (intro paragraphs, etc.) is ignored.
    Empty sections are dropped. Entries are returned newest-first based on
    the order they appear in the source (the file convention is newest first).
    """
    entries = []
    current = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        m = _DATE_HEADING_RE.match(line)
        if m:
            if current and current['bullets']:
                entries.append(current)
            current = {'date': m.group(1), 'bullets': []}
            continue
        if current is None:
            continue
        bm = _BULLET_RE.match(line)
        if bm:
            current['bullets'].append(bm.group(1))
            continue
        # Continuation lines (indented under a bullet) get appended to the
        # last bullet to preserve multi-line entries.
        if line.strip() and current['bullets'] and line.startswith(' '):
            current['bullets'][-1] += ' ' + line.strip()
    if current and current['bullets']:
        entries.append(current)
    return entries


def fetch_changelog() -> dict:
    """Fetch CHANGELOG.md from the remote and update the cached state."""
    try:
        resp = requests.get(CHANGELOG_URL, timeout=10)
        resp.raise_for_status()
        entries = parse_changelog(resp.text)
        with _lock:
            _changelog_state['entries'] = entries
            _changelog_state['last_fetched'] = datetime.now(timezone.utc).isoformat()
            _changelog_state['error'] = None
    except Exception as e:
        logger.warning(f"Changelog fetch failed: {e}")
        with _lock:
            _changelog_state['error'] = str(e)
            _changelog_state['last_fetched'] = datetime.now(timezone.utc).isoformat()
    return get_changelog_state()


def get_changelog_state() -> dict:
    """Return the cached changelog state (copy)."""
    with _lock:
        return {
            'entries': list(_changelog_state['entries']),
            'last_fetched': _changelog_state['last_fetched'],
            'error': _changelog_state['error'],
        }


def get_local_head_date() -> str | None:
    """Return the commit date (YYYY-MM-DD) of the local HEAD, or None."""
    try:
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%cs', 'HEAD'],
            capture_output=True, text=True, timeout=5, cwd=_get_repo_root()
        )
        out = (result.stdout or '').strip()
        return out or None
    except Exception:
        return None


def entries_newer_than(entries: list, cutoff_date: str | None) -> list:
    """Return entries whose date is strictly greater than cutoff_date.

    If cutoff_date is None, all entries are returned.
    """
    if not cutoff_date:
        return list(entries)
    return [e for e in entries if e.get('date', '') > cutoff_date]


def _check_loop(interval_seconds: int) -> None:
    """Background loop that checks for updates periodically."""
    # Small delay to let the app finish starting up, then check immediately
    time.sleep(5)
    while True:
        try:
            check_for_updates()
        except Exception as e:
            logger.error(f"Update check loop error: {e}")
        try:
            fetch_changelog()
        except Exception as e:
            logger.error(f"Changelog fetch loop error: {e}")
        time.sleep(interval_seconds)


def start_update_checker(interval_seconds: int = 3600) -> None:
    """
    Start the background update checker thread.

    Args:
        interval_seconds: How often to check (default: 3600 = 1 hour)
    """
    thread = threading.Thread(
        target=_check_loop,
        args=(interval_seconds,),
        daemon=True,
        name='update-checker'
    )
    thread.start()
    logger.info(f"Update checker started (every {interval_seconds // 3600}h)")
