"""Tests for the unadvertised /metrics dashboard."""
from __future__ import annotations

from unittest.mock import patch

from app.services.app_insights import AppInsightsError


def _all_cards_failed(payload: bytes, error_text: str) -> bool:
    """Heuristic: every card on the page should display the error."""
    return error_text.encode() in payload


class TestMetricsRoute:
    def test_renders_shell_without_calling_app_insights(self, client):
        """Page renders immediately as a shell - no App Insights queries on initial load."""
        with patch('app.routes.metrics.query_to_dicts') as mock_q:
            resp = client.get('/metrics')
        assert resp.status_code == 200
        assert b'MSX Account Teams probe' in resp.data
        # Shell must not block on App Insights
        mock_q.assert_not_called()
        # Cards have placeholders that JS will hydrate
        assert b'data-card="probe_status"' in resp.data
        assert b'data-card="dau"' in resp.data

    def test_invalid_days_falls_back_to_7(self, client):
        resp = client.get('/metrics?days=999')
        assert resp.status_code == 200
        assert b'7d' in resp.data

    def test_route_is_unadvertised(self, app):
        """No nav link should reference /metrics."""
        with app.test_client() as c:
            resp = c.get('/')
        assert resp.status_code in (200, 302)
        if resp.status_code == 200:
            assert b'href="/metrics"' not in resp.data


class TestMetricsCardApi:
    def test_card_returns_rows_as_json(self, client):
        with patch('app.routes.metrics.query_to_dicts', return_value=[{'result': 'ok', 'events': 5}]):
            resp = client.get('/api/metrics/card/probe_status?days=7')
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['card_id'] == 'probe_status'
        assert body['rows'] == [{'result': 'ok', 'events': 5}]
        assert body['error'] is None
        # probe_status uniquely returns a derived banner summary
        assert body['summary']['state'] == 'healthy'

    def test_card_surfaces_app_insights_error_in_json(self, client):
        def deny(*args, **kwargs):
            raise AppInsightsError('App Insights HTTP 403: forbidden', status_code=403)

        with patch('app.routes.metrics.query_to_dicts', side_effect=deny):
            resp = client.get('/api/metrics/card/dau?days=7')
        assert resp.status_code == 200  # error returned in body, not status
        body = resp.get_json()
        assert body['error'] is not None
        assert '403' in body['error']
        assert body['status_code'] == 403
        assert body['rows'] == []

    def test_unknown_card_404s(self, client):
        resp = client.get('/api/metrics/card/does_not_exist?days=7')
        assert resp.status_code == 404

    def test_card_invalid_days_falls_back_to_7(self, client):
        with patch('app.routes.metrics.query_to_dicts', return_value=[]) as mock_q:
            resp = client.get('/api/metrics/card/dau?days=abc')
        assert resp.status_code == 200
        # Confirm the call happened (so the route accepted the request)
        assert mock_q.called

    def test_403_sets_auth_required_flag(self, client):
        """A 403 surfaces auth_required so the UI can show the sign-in button."""
        def deny(*args, **kwargs):
            raise AppInsightsError(
                'App Insights HTTP 403: insufficient access',
                status_code=403,
            )
        with patch('app.routes.metrics.query_to_dicts', side_effect=deny):
            resp = client.get('/api/metrics/card/dau?days=7')
        body = resp.get_json()
        assert body['auth_required'] is True

    def test_500_does_not_set_auth_required(self, client):
        """A non-auth error keeps auth_required False so we don't show the button."""
        def boom(*args, **kwargs):
            raise AppInsightsError('App Insights HTTP 500: server error', status_code=500)
        with patch('app.routes.metrics.query_to_dicts', side_effect=boom):
            resp = client.get('/api/metrics/card/dau?days=7')
        body = resp.get_json()
        assert body['auth_required'] is False


class TestMetricsSignIn:
    def test_sign_in_spawns_az_login_and_clears_cache(self, client):
        with patch('app.routes.metrics.subprocess.Popen') as mock_popen, \
             patch('app.routes.metrics.shutil.which', return_value='C:\\fake\\az.cmd'), \
             patch('app.routes.metrics.reset_token_cache') as mock_reset:
            resp = client.post('/api/metrics/sign-in')
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['success'] is True
        # We spawned az login pinned to the BlaineCorp tenant
        called_args = mock_popen.call_args[0][0]
        assert 'login' in called_args
        assert '--tenant' in called_args
        assert '96d12531-723e-46c1-842b-0480739c7419' in called_args
        # And we dropped the in-process token cache
        mock_reset.assert_called_once()

    def test_sign_in_reports_missing_az(self, client):
        with patch('app.routes.metrics.shutil.which', return_value=None):
            resp = client.post('/api/metrics/sign-in')
        assert resp.status_code == 500
        assert 'not found' in resp.get_json()['error'].lower()
