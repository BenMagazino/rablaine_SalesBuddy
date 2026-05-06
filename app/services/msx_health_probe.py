"""
MSX Account Teams health probe.

Runs a tiny background probe against the ``msp_accountteams`` entity and
emits a ``SalesBuddy.MsxAccountTeamProbe`` custom event so the metrics
dashboard can chart real coverage of the recurring 0x80040224 outage.

Cadence: short delay after boot, then once per hour, with a per-instance
random minute-of-hour offset picked at startup. The probe call uses
``top=1`` to keep network/CPU cost negligible.

Result values (see ``telemetry_shipper.queue_msx_outage``):
    - ``ok``                - probe succeeded
    - ``outage``            - 0x80040224 / "header name and value" detected
    - ``skipped_no_token``  - no MSX token cached, can't probe
    - ``skipped_no_vpn``    - VPN blocking detected
    - ``error``             - any other failure
"""
from __future__ import annotations

import logging
import random
import threading
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Default cadence: probe every hour. Boot-time delay before the first
# probe so we don't slow down startup or compete with the initial token
# refresh.
DEFAULT_INTERVAL_SECONDS = 3600
DEFAULT_STARTUP_DELAY_SECONDS = 60

_probe_thread: Optional[threading.Thread] = None
_probe_running = False
_probe_offset_seconds: int = 0  # random minute-of-hour offset, picked at startup

_last_probe: dict = {
    'time': None,        # datetime of last attempt
    'result': None,      # last result string
    'error_code': None,  # last error code (if any)
}
_last_probe_lock = threading.Lock()


def _classify_failure(error_msg: str) -> tuple[str, Optional[str]]:
    """Map an MSX error string to a probe result + optional error code."""
    msg = (error_msg or '').lower()
    if '0x80040224' in msg or 'header name and value' in msg:
        return ('outage', '0x80040224')
    if 'not authenticated' in msg or 'az login' in msg:
        return ('skipped_no_token', None)
    if 'vpn' in msg or 'ip address is blocked' in msg:
        return ('skipped_no_vpn', None)
    if 'timed out' in msg or 'connection error' in msg:
        # Bare network failures look a lot like VPN drops; treat as
        # skipped_no_vpn rather than 'error' so they don't pollute the
        # outage chart.
        return ('skipped_no_vpn', None)
    return ('error', None)


def run_probe() -> str:
    """Run a single probe and emit the resulting telemetry event.

    Returns the result string that was queued (or would have been queued
    if telemetry is disabled).
    """
    # Imports are local so the module loads cheaply at import time and so
    # tests can patch them easily.
    from app.services.msx_auth import get_msx_token
    from app.services.telemetry_shipper import queue_msx_outage

    # Cheap pre-check: no token = nothing to probe with. Don't try to
    # acquire one here -- that's the token refresh job's job.
    token = get_msx_token()
    if not token:
        result, error_code = 'skipped_no_token', None
    else:
        try:
            from app.services.msx_api import query_entity
            response = query_entity(
                'msp_accountteams',
                select=['msp_accountteamid'],
                top=1,
            )
        except Exception as e:  # noqa: BLE001
            logger.exception('MSX probe raised unexpectedly')
            result, error_code = 'error', str(type(e).__name__)[:64]
        else:
            if response.get('success'):
                result, error_code = 'ok', None
            else:
                result, error_code = _classify_failure(response.get('error', ''))

    queue_msx_outage(result, error_code=error_code)

    with _last_probe_lock:
        _last_probe['time'] = datetime.now(timezone.utc)
        _last_probe['result'] = result
        _last_probe['error_code'] = error_code

    logger.info(f'MSX Account Teams probe: {result}')
    return result


def get_last_probe() -> dict:
    """Return a snapshot of the last probe outcome (for diagnostics)."""
    with _last_probe_lock:
        return dict(_last_probe)


def start_probe_thread(
    interval_seconds: int = DEFAULT_INTERVAL_SECONDS,
    startup_delay_seconds: int = DEFAULT_STARTUP_DELAY_SECONDS,
) -> None:
    """Start the background probe loop. Idempotent.

    Args:
        interval_seconds: Time between probes (default 1 hour).
        startup_delay_seconds: Wait this long after start before the first
            probe.
    """
    global _probe_thread, _probe_running, _probe_offset_seconds

    if _probe_running:
        logger.info('MSX Account Teams probe already running')
        return

    # Per-instance random offset. Spreads probes from many installs across
    # the hour rather than hammering MSX on the top of every hour.
    _probe_offset_seconds = random.randint(0, max(0, interval_seconds - 1))

    def _loop() -> None:
        global _probe_running
        _probe_running = True
        logger.info(
            f'MSX Account Teams probe started '
            f'(interval={interval_seconds}s, startup_delay={startup_delay_seconds}s, '
            f'offset={_probe_offset_seconds}s)'
        )

        # Initial delay before the first probe.
        for _ in range(startup_delay_seconds):
            if not _probe_running:
                return
            time.sleep(1)

        # First probe.
        try:
            run_probe()
        except Exception:
            logger.exception('MSX probe failed')

        # Then sleep (interval + per-instance offset) between probes.
        # The offset is added once on the first cycle so subsequent
        # probes land at a consistent minute-of-hour.
        first_cycle = True
        while _probe_running:
            sleep_for = interval_seconds + (_probe_offset_seconds if first_cycle else 0)
            first_cycle = False
            for _ in range(sleep_for):
                if not _probe_running:
                    return
                time.sleep(1)
            try:
                run_probe()
            except Exception:
                logger.exception('MSX probe failed')

    _probe_thread = threading.Thread(target=_loop, daemon=True, name='msx-probe')
    _probe_thread.start()


def stop_probe_thread() -> None:
    """Stop the background probe loop (used by tests)."""
    global _probe_running
    _probe_running = False
