"""Tests for the MSX Account Teams health probe."""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import msx_health_probe
from app.services.msx_health_probe import _classify_failure, run_probe


class TestClassifyFailure:
    def test_outage_signature_via_code(self):
        assert _classify_failure("0x80040224 something") == ('outage', '0x80040224')

    def test_outage_signature_via_text(self):
        result, code = _classify_failure(
            "Both header name and value should be specified"
        )
        assert result == 'outage'
        assert code == '0x80040224'

    def test_no_token(self):
        assert _classify_failure("Not authenticated. Run 'az login' first.") == (
            'skipped_no_token', None,
        )

    def test_vpn_blocked(self):
        assert _classify_failure(
            "IP address is blocked - connect to VPN and retry."
        ) == ('skipped_no_vpn', None)

    def test_timeout_treated_as_vpn(self):
        assert _classify_failure("Request timed out.") == ('skipped_no_vpn', None)

    def test_connection_error_treated_as_vpn(self):
        assert _classify_failure("Connection error: oops") == (
            'skipped_no_vpn', None,
        )

    def test_other_falls_back_to_error(self):
        result, _ = _classify_failure("HTTP 500: weird")
        assert result == 'error'


class TestRunProbe:
    """Each test mocks the MSX dependencies and checks the queued result."""

    def setup_method(self):
        # Reset the shipper dedupe so each test is independent.
        from app.services import telemetry_shipper as ts
        with ts._msx_probe_dedupe_lock:
            ts._msx_probe_last_hour.clear()
        with ts._buffer_lock:
            ts._buffer.clear()

    def test_no_token_emits_skipped(self):
        with patch('app.services.msx_auth.get_msx_token', return_value=None), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'skipped_no_token'
            mock_q.assert_called_once_with('skipped_no_token', error_code=None)

    def test_success_emits_ok(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_api.query_entity', return_value={
                 'success': True, 'records': [], 'count': 0,
             }), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'ok'
            mock_q.assert_called_once_with('ok', error_code=None)

    def test_outage_signature_emits_outage(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_api.query_entity', return_value={
                 'success': False,
                 'error': "HTTP 400: error code 0x80040224",
             }), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'outage'
            mock_q.assert_called_once_with('outage', error_code='0x80040224')

    def test_vpn_blocked_emits_skipped(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_api.query_entity', return_value={
                 'success': False,
                 'error': "IP address is blocked - connect to VPN and retry.",
                 'vpn_blocked': True,
             }), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'skipped_no_vpn'
            mock_q.assert_called_once_with('skipped_no_vpn', error_code=None)

    def test_query_raises_emits_error(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_api.query_entity', side_effect=RuntimeError('boom')), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'error'
            mock_q.assert_called_once()
            args, kwargs = mock_q.call_args
            assert args[0] == 'error'
            assert kwargs['error_code'] == 'RuntimeError'

    def test_records_last_probe(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_api.query_entity', return_value={
                 'success': True, 'records': [], 'count': 0,
             }):
            run_probe()
        snapshot = msx_health_probe.get_last_probe()
        assert snapshot['result'] == 'ok'
        assert snapshot['time'] is not None
