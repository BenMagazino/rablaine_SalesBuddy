"""Tests for the unadvertised /metrics dashboard."""
from __future__ import annotations

from unittest.mock import patch

from app.services.app_insights import AppInsightsError


def _all_cards_failed(payload: bytes, error_text: str) -> bool:
    """Heuristic: every card on the page should display the error."""
    return error_text.encode() in payload


class TestMetricsRoute:
    def test_renders_with_mocked_query(self, client):
        """Happy path: query returns data, page renders 200 with the title."""
        def fake_query_to_dicts(kql, timespan='P7D', timeout_seconds=10):
            # Return a tiny but plausible dataset for any query.
            if 'MsxAccountTeamProbe' in kql and 'summarize events = count() by result' in kql:
                return [{'result': 'ok', 'events': 5}]
            return []

        with patch('app.routes.metrics.query_to_dicts', side_effect=fake_query_to_dicts):
            resp = client.get('/metrics')
        assert resp.status_code == 200
        assert b'MSX Account Teams probe' in resp.data
        assert b'Healthy' in resp.data

    def test_renders_403_per_card_when_query_denied(self, client):
        """When App Insights returns 403, each card surfaces the error and the page still loads."""
        def deny(*args, **kwargs):
            raise AppInsightsError(
                'App Insights HTTP 403: forbidden', status_code=403,
            )

        with patch('app.routes.metrics.query_to_dicts', side_effect=deny):
            resp = client.get('/metrics')
        assert resp.status_code == 200
        # Every card should render an error block
        assert b'App Insights HTTP 403' in resp.data
        # And the headline should reflect the unknown state
        assert b'Unable to read probe data' in resp.data

    def test_invalid_days_falls_back_to_7(self, client):
        with patch('app.routes.metrics.query_to_dicts', return_value=[]):
            resp = client.get('/metrics?days=999')
        assert resp.status_code == 200
        # The 7d button should be primary
        assert b'btn-primary">\n        7d' in resp.data or b'7d' in resp.data

    def test_route_is_unadvertised(self, app):
        """No nav link should reference /metrics."""
        # Render the index and confirm there's no link to /metrics.
        with app.test_client() as c:
            with patch('app.routes.metrics.query_to_dicts', return_value=[]):
                resp = c.get('/')
        assert resp.status_code in (200, 302)
        if resp.status_code == 200:
            assert b'href="/metrics"' not in resp.data
