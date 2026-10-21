"""Database motion presets reuse saved Revenue Analyzer signals and scope."""
from bs4 import BeautifulSoup
import pytest

from app.models import Customer, Seller, UserPreference, db
from app.services.revenue_analysis import (
    get_database_expansion_analyses, get_database_expansion_widget,
    get_revenue_attention_widget,
)
from app.services.salesiq_tools import execute_tool
from tests.test_dashboard_drafts import draft_payload
from tests.test_dashboard_signal_widgets import add_analysis


@pytest.fixture
def signals(app):
    """Create saved risk and growth recommendations, including deliberately noisy rows."""
    with app.app_context():
        seller = Seller(name='Owner')
        risk_customer = Customer(name='Risk <customer>', tpid=99101, seller=seller)
        growth_customer = Customer(
            name='Growth customer', tpid=99102, seller=Seller(name='Other owner'),
        )
        risk = add_analysis(risk_customer, 'Databases', priority_score=80)
        growth = add_analysis(
            growth_customer, 'Databases', recommended_action='EXPANSION OUTREACH',
            category='EXPANSION_OPPORTUNITY', dollars_at_risk=0, dollars_opportunity=4000,
            review_status='to_be_reviewed', priority_score=60,
        )
        for index, changes in enumerate((
            {'recommended_action': 'MONITOR'},
            {'recommended_action': 'NO ACTION'},
            {'recommended_action': 'WELCOME CALL'},
            {'priority_score': 19},
            {'review_status': 'reviewed'},
            {'review_status': 'actioned'},
            {'review_status': 'dismissed'},
        )):
            customer = Customer(name=f'Excluded {index}', tpid=99200 + index)
            add_analysis(customer, 'Databases', **changes)
        add_analysis(risk_customer, 'Fabric', priority_score=99)
        db.session.commit()
        yield risk, growth


def test_motion_reuses_priority_action_review_and_impact(signals):
    """Do not count all consumers, monitors or previously handled alerts as outreach."""
    risk, growth = signals
    data = get_database_expansion_widget()
    assert [row['id'] for row in data['rows']] == [risk.id, growth.id]
    assert [a.id for a in get_database_expansion_analyses()] == [risk.id, growth.id]
    assert (data['risk_count'], data['growth_count'], data['pending_count']) == (1, 1, 2)
    assert (data['at_risk'], data['opportunity']) == (2000, 4000)
    assert data['destination'] == '/reports/revenue?view=database-expansion'
    assert data['database_motion']
    assert data['has_analysis']
    assert execute_tool('report_database_expansion', {}) == data
    assert execute_tool('report_dashboard_signals', {
        'widget_key': 'database.expansion',
    }) == data
    assert get_revenue_attention_widget()['pending_count'] > data['pending_count']
    growth.review_status = 'actioned'
    db.session.commit()
    updated = get_database_expansion_widget()
    assert (updated['growth_count'], updated['opportunity']) == (0, 0)
    assert updated['pending_count'] == 1


def test_report_preserves_motion_and_ignores_normal_browser_bucket_preferences(client, signals):
    """The preset renders the identical queue and never runs the global bucket picker."""
    risk, growth = signals
    response = client.get('/reports/revenue?view=database-expansion')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, 'html.parser')
    assert soup.h1.text == 'Revenue Analyzer: Database Expansion'
    assert [int(row['data-analysis-id']) for row in soup.select('tr[data-analysis-id]')] == [
        risk.id, growth.id,
    ]
    assert {row['data-bucket'] for row in soup.select('tr[data-analysis-id]')} == {'Databases'}
    assert not soup.select('#bucketFilterContainer, script[src*="revenue-bucket-filter"]')
    assert 'RevenueBucketFilter.init' not in response.text
    assert soup.select_one('.sb-revenue-list-header a[href="/reports/revenue"]').text == (
        'All revenue alerts'
    )
    assert soup.select_one('#reportExportBtnGroup')
    assert all(
        h['data-export-label'] == h.text
        for h in soup.select('#alertsTable thead th')
    )
    assert len(soup.select('.review-action-btn')) == 2
    assert '<customer>' in soup.select_one('tr[data-analysis-id] td:nth-child(2)').text
    assert not soup.select('customer')
    assert soup.select_one('[data-category=DECLINING] .sb-revenue-category-count').text == '1'
    normal = BeautifulSoup(client.get('/reports/revenue').data, 'html.parser')
    assert normal.h1.text == 'Revenue Analyzer'
    assert normal.select_one('#bucketFilterContainer')
    assert normal.select_one('script[src*="revenue-bucket-filter"]')


def test_database_filter_precedes_existing_global_limit(client, signals):
    """Database signals cannot disappear behind fifty higher-ranked alerts in other buckets."""
    risk, growth = signals
    for index in range(55):
        add_analysis(risk.customer, f'Other bucket {index}', priority_score=99)
    db.session.commit()
    normal = BeautifulSoup(client.get('/reports/revenue').data, 'html.parser')
    assert len(normal.select('tr[data-analysis-id]')) == 50
    assert not normal.select('tr[data-bucket=Databases]')
    motion = BeautifulSoup(
        client.get('/reports/revenue?view=database-expansion').data, 'html.parser',
    )
    assert [int(row['data-analysis-id']) for row in motion.select('tr[data-analysis-id]')] == [
        risk.id, growth.id,
    ]


def test_complete_motion_queue_is_not_capped_at_fifty(client, signals):
    """Counts, estimates and report rows all cover the complete filtered cohort."""
    risk, _ = signals
    for index in range(55):
        customer = Customer(name=f'Database customer {index}', tpid=99300 + index)
        add_analysis(customer, 'Databases', priority_score=80)
    db.session.commit()
    data = get_database_expansion_widget()
    assert data['pending_count'] == 57
    assert data['risk_count'] == 56
    soup = BeautifulSoup(client.get(data['destination']).data, 'html.parser')
    assert len(soup.select('tr[data-analysis-id]')) == 57


@pytest.mark.parametrize('query', [
    'customer_scope=bad', 'customer_ids=0', 'customer_ids=abc', 'seller_ids=-1',
])
def test_motion_rejects_malformed_scope(client, query):
    """Invalid scope returns an explicit error instead of broadening results."""
    response = client.get('/reports/revenue?view=database-expansion&' + query)
    assert response.status_code == 400
    assert response.json['error']


def test_empty_scope_and_missing_analysis_are_not_broad_fallbacks(client, signals):
    """No matching accounts stays empty, distinct from a populated scoped analysis."""
    risk, _ = signals
    assert get_database_expansion_widget(customer_ids=())['pending_count'] == 0
    assert not get_database_expansion_widget(customer_ids=())['has_analysis']
    page = client.get('/reports/revenue?view=database-expansion&customer_scope=1')
    soup = BeautifulSoup(page.data, 'html.parser')
    assert not soup.select('tr[data-analysis-id]')
    assert 'No pending database outreach' in page.text
    assert 'Dashboard scope: 0 customers.' in page.text
    risk.review_status = 'reviewed'
    db.session.commit()
    data = get_database_expansion_widget(customer_ids=(risk.customer_id,))
    assert data['has_analysis'] and data['pending_count'] == 0


@pytest.mark.parametrize(('role', 'specialty', 'allowed'), [
    ('se', 'data', True), ('se', 'infra', False), ('dss', 'infra', True),
])
def test_motion_specialty_gate(client, signals, role, specialty, allowed):
    """Catalog, analyzer preset and SalesIQ have the same Data specialty access boundary."""
    pref = UserPreference.query.first()
    pref.user_role, pref.se_specialty = role, specialty
    db.session.commit()
    assert client.get('/reports/revenue?view=database-expansion').status_code == (
        200 if allowed else 403
    )
    catalog = client.get('/api/reports/dashboards').json['catalog']
    assert any(w['key'] == 'database.expansion' for w in catalog) is allowed
    assert ('error' not in execute_tool('report_database_expansion', {})) is allowed
    assert client.get('/reports/revenue').status_code == 200


def test_widget_scope_survives_report_clickthrough(client, signals, dashboard_sources_ready):
    """Customer and seller intersections carry through the analyzer preset, including empty."""
    risk, _ = signals
    dashboard_id = client.post('/api/reports/dashboards', json={'name': 'Database motion'}).json['id']
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/widgets', json={
        'key': 'database.expansion', 'variant_key': 'detailed', 'column_span': 6,
    }).status_code == 200
    payload = draft_payload(client, dashboard_id)
    payload['filter_config'] = {'live_filters': ['customer_ids', 'seller_ids']}
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/save', json=payload).status_code == 200
    for selected in ({'customer_ids': risk.customer_id}, {'seller_ids': risk.customer.seller_id},
                     {'customer_ids': 999999}):
        widget = client.get(
            f'/api/reports/dashboards/{dashboard_id}', query_string=selected,
        ).json['dashboard']['widgets'][0]
        data = widget['data']
        assert data['report_follows_scope']
        assert 'view=database-expansion&customer_scope=1' in data['destination']
        soup = BeautifulSoup(client.get(data['destination']).data, 'html.parser')
        assert [int(row['data-analysis-id']) for row in soup.select('tr[data-analysis-id]')] == [
            row['id'] for row in data['rows']
        ]


def test_seller_mode_is_shared_by_widget_and_report(client, signals):
    """Active seller mode intersects, rather than replaces, a dashboard's customer scope."""
    risk, growth = signals
    with client.session_transaction() as session:
        session['seller_mode_seller_id'] = risk.customer.seller_id
    soup = BeautifulSoup(
        client.get('/reports/revenue?view=database-expansion').data, 'html.parser',
    )
    assert [int(row['data-analysis-id']) for row in soup.select('tr[data-analysis-id]')] == [risk.id]
    empty = client.get('/reports/revenue', query_string={
        'view': 'database-expansion', 'customer_scope': '1', 'customer_ids': growth.customer_id,
    })
    assert not BeautifulSoup(empty.data, 'html.parser').select('tr[data-analysis-id]')


@pytest.mark.parametrize(('variant', 'width'), [
    ('metric', 3), ('metric', 4), ('metric', 6), ('metric', 12),
    ('detailed', 6), ('detailed', 12),
])
def test_existing_widget_template_renders_motion_sizes(
    client, signals, dashboard_sources_ready, variant, width,
):
    """Reuse the revenue presentation while labeling growth and retention recommendations."""
    response = client.get('/api/reports/dashboards/widget-preview', query_string={
        'key': 'database.expansion', 'variant': variant, 'width': width,
    })
    assert response.status_code == 200
    soup = BeautifulSoup(response.json['html'], 'html.parser')
    assert soup.h2.text == 'Database Expansion'
    assert not soup.select('.db-report-seller, .db-report-seller-heading')
    assert 'Other owner' not in soup.text
    assert '1 growth' in soup.text and '1 at risk' in soup.text
    assert soup.select_one('.db-report-heading a')['href'] == (
        '/reports/revenue?view=database-expansion'
    )
    if variant == 'detailed':
        assert len(soup.select('tbody tr')) == 2
        assert 'At risk · CHECK-IN' in soup.text
        assert 'Growth · EXPANSION OUTREACH' in soup.text
        table = soup.select_one('.db-report-table')
        assert [th.text for th in table.select('thead th')] == [
            'Customer / signal', 'At risk/mo', 'Opportunity/mo', 'Priority',
        ]
        assert table['data-sb-sort-default-column'] == '3'
        assert 'revenue-v2-flat' in table['data-sb-sort-key']
        priority = table.select_one('thead th:last-child')
        assert priority['title'] == 'Our analysis ranking, not a measured metric.'
        assert len(priority['title'].split()) <= 7
        assert [td.text for td in table.select('tbody tr td:last-child')] == ['80', '60']
        risk_row, growth_row = table.select('tbody tr')
        assert risk_row.select_one('td:nth-child(2) span')['data-tone'] == 'danger'
        assert growth_row.select_one('td:nth-child(3) span')['data-tone'] == 'positive'
        assert growth_row.select_one('td:nth-child(2) span')['data-tone'] == 'neutral'
    else:
        assert '$2,000' in soup.text and '$4,000' in soup.text
        assert soup.select_one('.db-report-metrics [data-tone="danger"]').text == '$2,000'
        assert soup.select_one('.db-report-metrics [data-tone="positive"]').text == '$4,000'


@pytest.mark.parametrize('key', ['database.expansion', 'revenue.attention'])
def test_sellers_only_appear_as_explicit_groups(client, signals, dashboard_sources_ready, key):
    """Seller scoping never displays identity; only the explicit viewer grouping does."""
    risk, _ = signals
    dashboard_id = client.post('/api/reports/dashboards', json={'name': 'Seller presentation'}).json[
        'id'
    ]
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/widgets', json={
        'key': key, 'variant_key': 'detailed', 'column_span': 6,
    }).status_code == 200
    payload = draft_payload(client, dashboard_id)
    payload['filter_config'] = {'live_filters': ['group_by_seller', 'seller_ids']}
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/save', json=payload).status_code == 200
    for query in ({}, {'seller_ids': risk.customer.seller_id}, {'group_by_seller': 'false'}):
        page = BeautifulSoup(client.get(
            f'/reports/dashboards/{dashboard_id}', query_string=query,
        ).data, 'html.parser')
        widget = page.select_one(f'[data-widget-key="{key}"] .db-report-widget')
        assert not widget.select('.db-report-seller, .db-report-seller-heading')
        assert 'Owner' not in widget.text
        assert 'Other owner' not in widget.text
    grouped = BeautifulSoup(client.get(
        f'/reports/dashboards/{dashboard_id}?group_by_seller=true',
    ).data, 'html.parser').select_one(f'[data-widget-key="{key}"] .db-report-widget')
    assert len(grouped.select('.db-report-seller-heading')) == (
        2 if key == 'database.expansion' else 3
    )
    assert len(grouped.select('.db-report-seller')) == 2
    assert not grouped.select('tr[data-analysis-id] .db-report-seller')
    assert all(th['colspan'] == '4' for th in grouped.select('.db-report-seller-heading th'))
    assert grouped.select_one('thead th:last-child').text == 'Priority'
    assert grouped.select_one('thead th:last-child')['title'] == (
        'Our analysis ranking, not a measured metric.'
    )
    assert grouped.select_one('table')['data-sb-sort-default-column'] == '3'
