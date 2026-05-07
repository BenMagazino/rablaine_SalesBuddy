"""Tests for the MSX Account Teams health probe."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import requests

from app.services import msx_health_probe
from app.services.msx_health_probe import (
    _classify_exception,
    _classify_response,
    run_probe,
)


def _fake_response(status: int, body: str = '') -> MagicMock:
    """Build a stand-in for ``requests.Response`` for classifier tests."""
    r = MagicMock(spec=requests.Response)
    r.status_code = status
    r.text = body
    return r


def _lookup_response(account_id: str = 'aaaa-bbbb') -> MagicMock:
    """Successful response from the accounts-by-tpid lookup."""
    r = MagicMock(spec=requests.Response)
    r.status_code = 200
    r.text = ''
    r.json.return_value = {'value': [{'accountid': account_id}]}
    return r


class TestClassifyResponse:
    def test_200_is_ok(self):
        assert _classify_response(_fake_response(200, '{"value": []}')) == ('ok', None)

    def test_401_is_skipped_no_token(self):
        assert _classify_response(_fake_response(401, 'unauth')) == (
            'skipped_no_token', None,
        )

    def test_403_with_ip_blocked_marker_is_skipped_no_vpn(self):
        body = '{"error": {"code": "0x80095ffe", "message": "blocked"}}'
        assert _classify_response(_fake_response(403, body)) == (
            'skipped_no_vpn', None,
        )

    def test_403_without_ip_marker_falls_to_error(self):
        result, code = _classify_response(_fake_response(403, 'forbidden'))
        assert result == 'error'
        assert code == 'HTTP_403'

    def test_outage_signature_via_code_in_body(self):
        body = '{"error": {"code": "0x80040224", "message": "boom"}}'
        assert _classify_response(_fake_response(400, body)) == (
            'outage', '0x80040224',
        )

    def test_outage_signature_via_text_in_body(self):
        body = 'Both header name and value should be specified'
        assert _classify_response(_fake_response(500, body)) == (
            'outage', '0x80040224',
        )

    def test_500_without_outage_marker_is_error(self):
        result, code = _classify_response(_fake_response(500, 'gateway boom'))
        assert result == 'error'
        assert code == 'HTTP_500'


class TestClassifyException:
    def test_timeout_is_error_not_vpn(self):
        # Regression: timeouts used to be filed as skipped_no_vpn, which
        # masked real MSX hangs. They must be `error` now.
        result, code = _classify_exception(requests.exceptions.Timeout('slow'))
        assert result == 'error'
        assert code == 'Timeout'

    def test_connection_error_is_error_not_vpn(self):
        result, code = _classify_exception(
            requests.exceptions.ConnectionError('refused')
        )
        assert result == 'error'
        assert code == 'ConnectionError'


class TestRunProbe:
    """Each test mocks the MSX dependencies and checks the queued result."""

    def setup_method(self):
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

    def test_vpn_already_blocked_short_circuits(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=True), \
             patch('requests.get') as mock_get, \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'skipped_no_vpn'
            mock_get.assert_not_called()
            mock_q.assert_called_once_with('skipped_no_vpn', error_code=None)

    def test_success_emits_ok(self):
        # First requests.get = account lookup, second = team query.
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=False), \
             patch('app.services.msx_health_probe._pick_probe_account_id',
                   return_value=('aaaa-bbbb', None)), \
             patch('requests.get', return_value=_fake_response(200, '{"value": []}')), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'ok'
            mock_q.assert_called_once_with('ok', error_code=None)

    def test_outage_signature_emits_outage(self):
        body = '{"error":{"code":"0x80040224","message":"boom"}}'
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=False), \
             patch('app.services.msx_health_probe._pick_probe_account_id',
                   return_value=('aaaa-bbbb', None)), \
             patch('requests.get', return_value=_fake_response(400, body)), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'outage'
            mock_q.assert_called_once_with('outage', error_code='0x80040224')

    def test_timeout_emits_error(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=False), \
             patch('app.services.msx_health_probe._pick_probe_account_id',
                   return_value=('aaaa-bbbb', None)), \
             patch('requests.get', side_effect=requests.exceptions.Timeout('slow')), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'error'
            mock_q.assert_called_once_with('error', error_code='Timeout')

    def test_unexpected_exception_emits_error(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=False), \
             patch('app.services.msx_health_probe._pick_probe_account_id',
                   return_value=('aaaa-bbbb', None)), \
             patch('requests.get', side_effect=RuntimeError('boom')), \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'error'
            args, kwargs = mock_q.call_args
            assert args[0] == 'error'
            assert kwargs['error_code'] == 'RuntimeError'

    def test_pick_account_bail_propagates(self):
        # If we can't resolve a target account, the bail tuple becomes
        # the probe result.
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=False), \
             patch('app.services.msx_health_probe._pick_probe_account_id',
                   return_value=(None, ('error', 'no_customer'))), \
             patch('requests.get') as mock_get, \
             patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            assert run_probe() == 'error'
            mock_get.assert_not_called()
            mock_q.assert_called_once_with('error', error_code='no_customer')

    def test_records_last_probe(self):
        with patch('app.services.msx_auth.get_msx_token', return_value='tok'), \
             patch('app.services.msx_auth.is_vpn_blocked', return_value=False), \
             patch('app.services.msx_health_probe._pick_probe_account_id',
                   return_value=('aaaa-bbbb', None)), \
             patch('requests.get', return_value=_fake_response(200, '{}')):
            run_probe()
        snapshot = msx_health_probe.get_last_probe()
        assert snapshot['result'] == 'ok'
        assert snapshot['time'] is not None


class TestPickProbeAccountId:
    """Cover the account-id lookup branch separately so we don't have to
    stand up DB fixtures in every TestRunProbe case."""

    def test_no_customer_returns_bail(self):
        from app.services.msx_health_probe import _pick_probe_account_id
        # No app context here -> Customer.query will raise. Patch the
        # query chain to mimic an empty DB.
        with patch('app.models.Customer') as mock_customer:
            mock_customer.query.filter.return_value.first.return_value = None
            account_id, bail = _pick_probe_account_id('tok')
        assert account_id is None
        assert bail == ('error', 'no_customer')

    def test_lookup_success_returns_account_id(self):
        from app.services.msx_health_probe import _pick_probe_account_id
        fake_customer = MagicMock(tpid=12345)
        with patch('app.models.Customer') as mock_customer, \
             patch('requests.get', return_value=_lookup_response('the-guid')):
            mock_customer.query.filter.return_value.first.return_value = fake_customer
            account_id, bail = _pick_probe_account_id('tok')
        assert account_id == 'the-guid'
        assert bail is None

    def test_lookup_no_match_bails(self):
        from app.services.msx_health_probe import _pick_probe_account_id
        empty = MagicMock(spec=requests.Response)
        empty.status_code = 200
        empty.text = ''
        empty.json.return_value = {'value': []}
        fake_customer = MagicMock(tpid=12345)
        with patch('app.models.Customer') as mock_customer, \
             patch('requests.get', return_value=empty):
            mock_customer.query.filter.return_value.first.return_value = fake_customer
            account_id, bail = _pick_probe_account_id('tok')
        assert account_id is None
        assert bail == ('error', 'lookup_no_match')

    def test_lookup_timeout_bails_with_error(self):
        from app.services.msx_health_probe import _pick_probe_account_id
        fake_customer = MagicMock(tpid=12345)
        with patch('app.models.Customer') as mock_customer, \
             patch('requests.get', side_effect=requests.exceptions.Timeout('slow')):
            mock_customer.query.filter.return_value.first.return_value = fake_customer
            account_id, bail = _pick_probe_account_id('tok')
        assert account_id is None
        assert bail == ('error', 'Timeout')


class TestRecordMspAccountteamsCall:
    """Free-probe helper used by real msp_accountteams call sites."""

    def setup_method(self):
        from app.services import telemetry_shipper as ts
        with ts._msx_probe_dedupe_lock:
            ts._msx_probe_last_hour.clear()

    def test_success_emits_ok(self):
        from app.services.msx_health_probe import record_msp_accountteams_call
        with patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            record_msp_accountteams_call({'success': True, 'records': []})
            mock_q.assert_called_once_with('ok', error_code=None)

    def test_outage_signature_emits_outage(self):
        from app.services.msx_health_probe import record_msp_accountteams_call
        with patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            record_msp_accountteams_call({
                'success': False,
                'error': 'HTTP 400: error code 0x80040224',
            })
            mock_q.assert_called_once_with('outage', error_code='0x80040224')

    def test_vpn_blocked_emits_skipped(self):
        from app.services.msx_health_probe import record_msp_accountteams_call
        with patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            record_msp_accountteams_call({
                'success': False,
                'error': 'IP address is blocked - connect to VPN and retry.',
                'vpn_blocked': True,
            })
            mock_q.assert_called_once_with('skipped_no_vpn', error_code=None)

    def test_no_token_emits_skipped(self):
        from app.services.msx_health_probe import record_msp_accountteams_call
        with patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            record_msp_accountteams_call({
                'success': False,
                'error': "Not authenticated. Run 'az login' first.",
            })
            mock_q.assert_called_once_with('skipped_no_token', error_code=None)

    def test_other_error_emits_error(self):
        from app.services.msx_health_probe import record_msp_accountteams_call
        with patch('app.services.telemetry_shipper.queue_msx_outage') as mock_q:
            record_msp_accountteams_call({
                'success': False,
                'error': 'HTTP 500 Internal Server Error',
            })
            mock_q.assert_called_once_with('error', error_code=None)

    def test_telemetry_failure_does_not_raise(self):
        from app.services.msx_health_probe import record_msp_accountteams_call
        with patch(
            'app.services.telemetry_shipper.queue_msx_outage',
            side_effect=RuntimeError('boom'),
        ):
            # Caller must never see an exception from telemetry.
            record_msp_accountteams_call({'success': True})
