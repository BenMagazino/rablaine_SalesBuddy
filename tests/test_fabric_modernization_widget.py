"""Report-backed modernization candidates, seller presentation and dashboard integration."""
from copy import deepcopy
from datetime import date
from unittest.mock import Mock

from bs4 import BeautifulSoup
import pytest

from app.models import Customer, Seller, db
from app.services import dashboards, fabric_modernization
from app.services.salesiq_tools import execute_tool
from tests.test_dashboard_drafts import draft_payload
from tests.test_fabric_renewal_widgets import render_widget


def candidate_row(customer_id: int | None, key: str, source: float, fabric: float,
                  seller: dict | None = None) -> dict:
    """Supply the real report row shape without manufacturing capacity or adoption data."""
    return {
        'customer_id': customer_id, 'row_key': key, 'customer_name': f'Customer {key}',
        'source_revenue': source,
        'spend': {'synapse': source, 'aas': 0, 'adx': 0, 'databricks': 0, 'fabric': fabric},
        'monthly_spend': {
            'synapse': source / 3, 'aas': 0, 'adx': 0, 'databricks': 0, 'fabric': fabric / 3,
        },
        'monthly_source_revenue': source / 3,
        'seller': seller, 'seller_name': seller['name'] if seller else None,
        'coverage_complete': True,
    }


@pytest.fixture
def saved_report(monkeypatch):
    """Replace only the shared report read, preserving real widget calculation."""
    rows = [
        candidate_row(1, 'first', 200, 100, {'id': 1, 'name': 'Alex'}),
        candidate_row(2, 'equal', 100, 100, {'id': 1, 'name': 'Alex'}),
        candidate_row(3, 'above-fabric', 100.0001, 100, {'id': 2, 'name': 'Alex'}),
        candidate_row(4, 'fabric-led', 100, 200),
        candidate_row(None, 'unlinked', 70, 0),
    ]
    report = {
        'rows': rows, 'has_revenue_data': True,
        'period_label': 'Jul 2026 through Sep 2026', 'url': '/reports/fabric-modernization',
        'seller_groups': [
            {'seller': rows[0]['seller'], 'name': 'Alex', 'rows': rows[:2]},
            {'seller': rows[2]['seller'], 'name': 'Alex', 'rows': [rows[2]]},
            {'seller': None, 'name': None, 'rows': rows[3:]},
        ],
    }
    reader = Mock(return_value=report)
    monkeypatch.setattr(fabric_modernization, 'get_fabric_modernization_report', reader)
    return reader


@pytest.mark.parametrize(('scope', 'expected'), [
    (None, ['first', 'above-fabric', 'unlinked']),
    ((), []), ((1,), ['first']), ((2,), []), ((3, 4), ['above-fabric']), ((999,), []),
])
def test_candidate_scope_and_grouping_reuse_report_without_mutation(saved_report, scope, expected):
    """Filter the full report before count and grouping, never guessing unlinked identity."""
    original = deepcopy(saved_report.return_value)
    result = fabric_modernization.get_fabric_modernization_widget(
        date(2026, 10, 20), customer_ids=scope,
    )
    saved_report.assert_called_once_with(date(2026, 10, 20))
    assert saved_report.return_value == original
    assert [row['row_key'] for row in result['details']['rows']] == expected
    assert result['count'] == len(expected)
    assert result['other_analytics_revenue'] == pytest.approx(sum(
        row['source_revenue'] for row in original['rows'] if row['row_key'] in expected
    ))
    assert result['monthly_other_analytics_revenue'] == pytest.approx(
        result['other_analytics_revenue'] / 3
    )
    assert sum(len(group['rows']) for group in result['details']['seller_groups']) == len(expected)
    assert all(group['rows'] for group in result['details']['seller_groups'])
    assert result['destination'] == '/reports/fabric-modernization'
    if scope is None:
        assert [group['seller']['id'] if group['seller'] else None
                for group in result['details']['seller_groups']] == [1, 2, None]
        assert result['details']['rows'][0]['destination'] == '/customer/1/revenue'
        assert result['details']['rows'][-1]['destination'] is None


@pytest.mark.parametrize('grouped', [False, True])
def test_details_sortable_columns_and_exact_amounts(saved_report, grouped):
    """Group labels stay fixed, source sorts raw values and duplicate instances stay isolated."""
    saved_report.return_value['rows'][0]['customer_name'] = '<img src=x onerror=bad()>'
    result = fabric_modernization.get_fabric_modernization_widget()
    soup = BeautifulSoup(render_widget(
        'fabric_modernization', result, group_by_seller=grouped,
    ), 'html.parser')
    table = soup.select_one('table')
    assert not soup.select('img')
    assert len(table.select('tr[data-row-key]')) == 3
    assert [th.text for th in table.select('thead th')] == [
        'Customer', 'Other Analytics', 'Fabric',
    ]
    assert all(len(row.select('td')) == 3 for row in table.select('tr[data-row-key]'))
    assert table['data-sb-sort-default-column'] == '1'
    assert 'modernization-v2-' in table['data-sb-sort-key']
    assert table['data-sb-sort-default-direction'] == 'descending'
    assert table.parent['tabindex'] == '0'
    if grouped:
        assert len(table.select('tbody')) == 3
        assert len(table.select('tr[data-sb-sort-fixed]')) == 3
        assert all(th['colspan'] == '3' for th in table.select('tbody th'))
        assert 'No seller assigned' in table.select('tbody')[-1].text
    else:
        assert not table.select('.db-report-seller')
    assert table.select('thead th')[1]['data-sb-sort-type'] == 'number'
    cells = table.select_one('tr[data-row-key="above-fabric"]').select('td')
    assert float(cells[-2]['data-sb-sort-value']) == pytest.approx(100.0001 / 3)
    assert float(cells[-1]['data-sb-sort-value']) == pytest.approx(100 / 3)
    assert 'Avg monthly ACR' in soup.text
    assert table.select_one('a[href="/customer/1/revenue"]')
    assert bool(table.select_one('.badge.bg-primary .bi-person')) == grouped
    second = BeautifulSoup(render_widget(
        'fabric_modernization', result, prefix='second-', group_by_seller=grouped,
    ), 'html.parser')
    assert table['data-sb-sort-key'] != second.select_one('table')['data-sb-sort-key']


def test_no_data_empty_and_summary_states(saved_report):
    """No import is not an observed zero, and both variants use the exact same candidates."""
    result = fabric_modernization.get_fabric_modernization_widget()
    summary = BeautifulSoup(render_widget('fabric_modernization', result, 'metric'), 'html.parser')
    assert summary.select_one('dd').text == '3'
    assert summary.select_one('.db-modernization-revenue').text == '$123/mo'
    assert summary.select_one('.db-modernization-revenue')['title'] == '$123.33 average monthly ACR'
    assert 'Other Analytics / month' in summary.text
    assert 'Other Analytics-led customers' in summary.text
    result['has_revenue_data'] = False
    for variant in ('metric', 'detailed'):
        soup = BeautifulSoup(render_widget('fabric_modernization', result, variant), 'html.parser')
        assert 'No saved product revenue' in soup.text
        assert not soup.select('dd, table')
    result = fabric_modernization.get_fabric_modernization_widget(customer_ids=())
    assert result['other_analytics_revenue'] == 0
    empty_summary = BeautifulSoup(
        render_widget('fabric_modernization', result, 'metric'), 'html.parser',
    )
    assert [node.text for node in empty_summary.select('dd')] == ['0', '$0/mo']
    soup = BeautifulSoup(render_widget('fabric_modernization', result), 'html.parser')
    assert 'No customers meeting the report cutoffs' in soup.text
    assert not soup.select('table')


def test_partial_coverage_and_source_only_seller_name(saved_report):
    """Keep unknown Fabric visible and source seller names literal without an invented link."""
    row = saved_report.return_value['rows'][-1]
    row.update(coverage_complete=False, seller_name='Source <seller>')
    row['monthly_spend'] = dict.fromkeys(row['monthly_spend'])
    row['monthly_source_revenue'] = None
    saved_report.return_value['seller_groups'][-1]['name'] = 'Source <seller>'
    result = fabric_modernization.get_fabric_modernization_widget()
    assert result['partial_customer_count'] == 1
    assert result['monthly_other_analytics_revenue'] is None
    summary = BeautifulSoup(render_widget('fabric_modernization', result, 'metric'), 'html.parser')
    assert summary.select_one('dd').text == '3'
    assert summary.select_one('.db-modernization-revenue').text == 'Unavailable'
    scoped = fabric_modernization.get_fabric_modernization_widget(customer_ids=(1,))
    assert scoped['count'] == 1
    assert scoped['monthly_other_analytics_revenue'] == pytest.approx(200 / 3)
    flat = BeautifulSoup(render_widget('fabric_modernization', result), 'html.parser')
    last = flat.select_one('tr[data-row-key="unlinked"]')
    assert last.select('td')[-1]['data-sb-sort-value'] == ''
    assert last.select('td')[-1].text == 'Unavailable'
    assert last.select('td')[-2]['data-sb-sort-value'] == ''
    assert not last.select('a')
    grouped = BeautifulSoup(render_widget(
        'fabric_modernization', result, group_by_seller=True,
    ), 'html.parser')
    assert 'Source <seller>' in grouped.select('tbody')[-1].select_one('th').text
    assert not grouped.select('tbody')[-1].select_one('th').select('a')
    assert not grouped.select('seller')


def test_all_candidates_are_returned_without_top_n_limit(saved_report):
    """Details is the complete qualifying queue, not a limited top-five summary."""
    rows = [candidate_row(index, str(index), 200 + index, 100) for index in range(30)]
    saved_report.return_value.update(rows=rows, seller_groups=[
        {'seller': None, 'name': None, 'rows': rows},
    ])
    result = fabric_modernization.get_fabric_modernization_widget()
    assert result['count'] == 30
    assert result['other_analytics_revenue'] == sum(200 + index for index in range(30))
    soup = BeautifulSoup(render_widget('fabric_modernization', result), 'html.parser')
    assert len(soup.select('tbody tr')) == 30


def test_catalog_preview_tools_and_saved_viewer(client, saved_report):
    """Wire Summary/Details widths, saved placement, and the shared live grouping control."""
    definition = next(row for row in client.get('/api/reports/dashboards').json['catalog']
                      if row['key'] == 'fabric.modernization')
    assert definition['supported_filters'] == ['customer_ids', 'seller_ids', 'group_by_seller']
    for variant in definition['variants']:
        for width in variant['widths']:
            response = client.get('/api/reports/dashboards/widget-preview', query_string={
                'key': 'fabric.modernization', 'variant': variant['key'], 'width': width,
            })
            assert response.status_code == 200
            assert 'Fabric modernization' in response.json['html']
    result = execute_tool('report_fabric_modernization_candidates', {})
    assert result['count'] == 3
    assert execute_tool('report_dashboard_signals', {
        'widget_key': 'fabric.modernization',
    })['count'] == result['count']
    dashboard_id = client.post('/api/reports/dashboards', json={'name': 'Modernization'}).json['id']
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/widgets', json={
        'key': 'fabric.modernization',
    }).status_code == 200
    widget = client.get(f'/api/reports/dashboards/{dashboard_id}').json['dashboard']['widgets'][0]
    assert widget['variant_key'] == 'detailed'
    assert widget['row_span'] == 5
    payload = draft_payload(client, dashboard_id)
    payload['filter_config'] = {'live_filters': ['group_by_seller']}
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/save', json=payload).status_code == 200
    page = BeautifulSoup(client.get(
        f'/reports/dashboards/{dashboard_id}?group_by_seller=true',
    ).data, 'html.parser')
    assert len(page.select('.db-modernization-table .db-report-seller-heading')) == 3
    assert len(page.select('.db-modernization-table tr[data-row-key]')) == 3


def test_current_seller_scope_and_empty_intersection(app, saved_report):
    """Use dashboard customer/seller intersection consistently before both presentations."""
    with app.app_context():
        seller = Seller(name='Current owner')
        owned = Customer(name='Owned', tpid=990001, seller=seller)
        other = Customer(name='Other', tpid=990002)
        db.session.add_all([owned, other])
        db.session.flush()
        saved_report.return_value['rows'][0]['customer_id'] = owned.id
        preview = dashboards.get_widget_preview(
            'fabric.modernization', 'detailed', 6,
            filter_context={'widget': {'seller_ids': [seller.id]}},
        )
        assert preview['data']['count'] == 1
        assert preview['data']['report_follows_scope'] is False
        empty = dashboards.get_widget_preview(
            'fabric.modernization', 'metric', 6,
            filter_context={'widget': {'seller_ids': [seller.id], 'customer_ids': [other.id]}},
        )
        assert empty['data']['count'] == 0
        assert empty['data']['monthly_other_analytics_revenue'] == 0
