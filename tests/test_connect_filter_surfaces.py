"""Filter capabilities are exposed consistently through dashboard reads and previews."""
from datetime import date
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from app.services import connect_goals
from app.services.salesiq_tools import execute_tool
from tests.test_connect_goal_filters import scoped_snapshot


@pytest.mark.parametrize('key', [
    'connect_goals.u2c', 'connect_goals.team_coverage',
    'connect_goals.hva_coverage', 'connect_goals.whitespace',
])
def test_scoped_connect_previews_allow_both_filters(client, app, scoped_snapshot, key):
    """Each presentation accepts customer and seller selectors through the real API."""
    _, customer_id, _, seller_id = scoped_snapshot
    context = {
        'dashboard': {'scope': {'seller_ids': [seller_id]}, 'live_filters': ['customer_ids']},
        'widget': {'customer_ids': [customer_id]},
        'live': {'customer_ids': [customer_id]},
    }
    import json

    ready = connect_goals.get_setup_state
    with patch.object(connect_goals, 'get_setup_state', side_effect=lambda reference=None: ready(
        date(2026, 8, 15),
    )):
        for variant in ('metric', 'detailed'):
            response = client.get('/api/reports/dashboards/widget-preview', query_string={
                'key': key, 'variant': variant, 'width': 6,
                'filter_context': json.dumps(context),
            })
            assert response.status_code == 200
            page = BeautifulSoup(response.json['html'], 'html.parser')
            assert page.select_one('.db-filter-scope')
            assert not page.select_one('.db-filter-exception')
        with app.app_context():
            data = execute_tool('report_dashboard_signals', {
                'widget_key': key,
                'filters': {'customer_ids': [customer_id], 'seller_ids': [seller_id]},
            })
            assert data['key'] == key.removeprefix('connect_goals.')
            assert data['report_follows_scope'] is False
