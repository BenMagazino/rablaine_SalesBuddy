"""Manual Fabric report routing and read-tool integration without remote calls."""

from unittest.mock import Mock

import pytest

from app.models import Customer, SyncStatus, db


@pytest.fixture
def fabric_customer(app):
    """Create a customer only in the isolated pytest database."""
    with app.app_context():
        customer = Customer(name='Fabric route customer', tpid=456789)
        db.session.add(customer)
        db.session.commit()
        customer_id = customer.id
    yield customer_id
    with app.app_context():
        db.session.delete(db.session.get(Customer, customer_id))
        db.session.commit()


def test_page_is_read_only_and_accessible(client, monkeypatch):
    """Opening the report never starts an import or requests remote measurements."""
    from app.services import fabric_consumption

    sync = Mock(side_effect=AssertionError('Page must not import data'))
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption', sync)
    response = client.get('/reports/fabric-consumption')
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'Import from MSXi' in html
    assert 'data-fabric-report' in html
    assert 'Share of consumed CU hours, not SKU utilization' in html
    assert 'Manual import only; no scheduled refresh' in html
    assert 'Reload saved data' not in html
    assert 'aria-label="Capacity utilization history"' in html
    assert 'data-fabric-capacity-context' not in html
    assert 'data-fabric-revenue' in html
    assert 'ui-fabric-revenue.js' in html
    assert 'not capacity reservation coverage' in html
    assert "the report's non-RI" in html
    sync.assert_not_called()


def test_monthly_revenue_split_starts_open_with_accessible_percentage_chart(client):
    """Monthly revenue amounts and their 100% mix are visible without expanding a panel."""
    from bs4 import BeautifulSoup

    page = BeautifulSoup(client.get('/reports/fabric-consumption').data, 'html.parser')
    monthly = page.select_one('[data-revenue-monthly]')
    assert monthly.has_attr('open')
    assert monthly.select_one('[data-revenue-chart]')['aria-label'] == (
        'Monthly RI and PAYG revenue percentages')
    assert monthly.select_one('[data-revenue-months]')
    assert monthly.select_one('[data-revenue-month-headings]')
    assert monthly.select_one('.sb-fabric-revenue-table-region')
    assert 'Reserved instance (RI)' in monthly.select_one('.sb-fabric-revenue-legend').text


def test_fabric_endpoint_contract_is_limited_to_saved_telemetry_and_import(app):
    """The release registers only the telemetry page, saved reads, status and import."""
    registered = {
        rule.endpoint for rule in app.url_map.iter_rules()
        if rule.endpoint.startswith(('reports.fabric_', 'reports.report_fabric_'))
    }
    assert registered == {
        'reports.report_fabric_consumption',
        'reports.fabric_capacity_overview_data',
        'reports.fabric_consumption_data',
        'reports.fabric_consumption_status',
        'reports.fabric_consumption_import',
    }


def test_timestamp_sorting_uses_numeric_utc_keys(client):
    """Hourly ISO timestamps must not enter the shared date-only calendar parser."""
    from bs4 import BeautifulSoup

    page = BeautifulSoup(client.get('/reports/fabric-consumption').data, 'html.parser')
    header = page.select_one('[data-fabric-series] th')
    assert header['data-sb-sort-type'] == 'number'
    assert header.text == 'Time (UTC)'
    script = client.get('/static/js/ui-fabric-consumption.js').get_data(as_text=True)
    assert "sortValue: row => row.time ? Date.parse(row.time) : ''" in script


@pytest.mark.parametrize('view', ['detail', 'overview'])
def test_fabric_views_share_header_navigation_and_manual_import(client, view):
    """Both URL-backed views share report chrome and one import controller."""
    from bs4 import BeautifulSoup

    url = '/reports/fabric-consumption' + ('?view=overview' if view == 'overview' else '')
    markup = BeautifulSoup(client.get(url).data, 'html.parser')
    assert markup.h1.text == 'Fabric Consumption'
    tabs = markup.select_one('nav[aria-label="Fabric report views"]')
    assert [a.text for a in tabs.select('a')] == [
        'Customer detail', 'Capacity overview',
    ]
    assert tabs.select_one('[aria-current="page"]').text == (
        'Capacity overview' if view == 'overview' else 'Customer detail')
    assert tabs.select('a')[0]['href'] == '/reports/fabric-consumption'
    assert tabs.select('a')[1]['href'] == '/reports/fabric-consumption?view=overview'
    root = markup.select_one('[data-sb-page-surface]')
    assert 'sb-directory-frame' not in root['class']
    assert root['data-import-url'] == '/api/reports/fabric-consumption/import'
    assert root['data-status-url'] == '/api/reports/fabric-consumption/status'
    assert len(markup.select('[data-fabric-import]')) == 1
    assert markup.select_one('[data-fabric-progress][role="status"]')
    assert markup.select_one('.sb-fabric-tab-band [data-fabric-progress]')
    assert markup.select_one('.sb-fabric-import-status') is None
    assert markup.select_one('[data-fabric-import-error][role="alert"]')
    assert markup.select_one('script[src*="ui-fabric-import.js"]')
    assert 'Manual import only; no scheduled refresh' in markup.select_one('.sb-page-status').text
    if view == 'detail':
        assert markup.select_one('h2 [data-fabric-customer-title]').name == 'a'
        assert markup.select_one('[data-fabric-customer-context]') is None
        script = client.get('/static/js/ui-fabric-consumption.js').get_data(as_text=True)
        assert "${customer.name} (${customer.tpid ?? 'TPID unavailable'})" in script
        assert 'Customer profile' not in markup.select_one('[data-fabric-detail]').text


def test_average_preview_reuses_saved_chart_renderer(client):
    """Each average preview uses its own capacity points and the existing chart renderer."""
    script = client.get('/static/js/ui-fabric-consumption.js').get_data(as_text=True)
    assert "function renderChart(points, container = find('capacity-chart'))" in script
    assert "container => renderChart(row.points, container)" in script
    popup = client.get('/static/js/ui-fabric-capacity-label.js').get_data(as_text=True)
    assert "button.addEventListener('pointerenter', show)" in popup
    assert "button.addEventListener('focus', show)" in popup
    assert "chart(graph)" in popup


def test_numeric_headers_align_with_values(client):
    """Numeric headings match their values, while UTC history timestamps stay left aligned."""
    css = client.get('/static/css/ui-fabric-consumption.css').get_data(as_text=True)
    assert '.sb-fabric-table td.sb-fabric-number { text-align: right; }' in css
    assert '.sb-fabric-table th[data-sb-sort-type="number"] { text-align: right; }' in css
    assert '.sb-fabric-table[data-fabric-series] th:first-child { text-align: left; }' in css


def test_pinned_customer_headers_keep_vertical_sticky_anchor(client):
    """Horizontal customer pinning must not let either heading scroll with the data."""
    css = client.get('/static/css/ui-fabric-consumption.css').get_data(as_text=True)
    assert '.sb-fabric-overview-table th:first-child { top: 0;' in css
    assert '.sb-fabric-overview-table thead { z-index: 3; }' in css


def test_capacity_overview_is_saved_data_only(client, app, monkeypatch):
    """The overview route and SalesIQ use the same lightweight saved-data service."""
    from app.services import fabric_consumption
    from app.services.salesiq_tools import execute_tool

    payload = {'snapshot': None, 'rows': [], 'workloads': [], 'totals': {}}
    read = Mock(return_value=payload)
    monkeypatch.setattr(fabric_consumption, 'get_fabric_capacity_overview', read)
    sync = Mock(side_effect=AssertionError('Overview must not import'))
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption', sync)
    page = client.get('/reports/fabric-consumption?view=overview')
    assert page.status_code == 200
    assert 'Reload saved data' not in page.get_data(as_text=True)
    assert 'data-fabric-overview' in page.get_data(as_text=True)
    from bs4 import BeautifulSoup

    markup = BeautifulSoup(page.data, 'html.parser')
    assert markup.select_one('[data-overview-table] th')
    assert not markup.select_one('[data-overview-table]').has_attr('data-sb-sortable')
    assert markup.select_one('script[src*="ui-fabric-capacity-label.js"]')
    assert markup.select_one('details') is None
    assert markup.select_one('.sb-fabric-import-band [data-overview-status]')
    assert 'Workload mix is customer-wide, repeated per capacity' not in markup.text
    assert markup.select_one('[data-overview-workload]') is None
    assert markup.select_one('[data-overview-exclusive]') is None
    assert len(markup.select('[data-overview-mode] button')) == 4
    assert markup.select_one('[data-overview-mode] [data-mode="capacities"]').text == (
        'Only customers with capacities')
    assert markup.select_one('[data-overview-data-only]') is None
    assert markup.select_one('script[src*="ui-fabric-preferences.js"]')
    assert client.get('/api/reports/fabric-consumption/overview').json['rows'] == []
    with app.app_context():
        assert execute_tool('report_fabric_consumption', {'overview': True}) == payload
    sync.assert_not_called()


def test_customer_detail_discloses_secondary_data(client):
    """Core charts stay visible, while full measurements remain available on demand."""
    from bs4 import BeautifulSoup

    markup = BeautifulSoup(client.get('/reports/fabric-consumption').data, 'html.parser')
    for selector in ['[data-fabric-workloads]', '[data-fabric-series]',
                     '[data-fabric-capacity-metrics]']:
        disclosure = markup.select_one(selector).find_parent('details')
        assert disclosure is not None
        assert not disclosure.has_attr('open')
    assert markup.select_one('[data-fabric-capacity-chart]').find_parent('details') is None
    assert markup.select_one('[data-fabric-capacity-summary]')
    assert markup.select_one('script[src*="ui-fabric-preferences.js"]')
    capacities = markup.select_one('[data-fabric-capacities]')
    assert 'sb-fabric-capacity-list' in capacities.parent['class']
    assert capacities.select('th')[0].text == 'Capacity / SKU'
    average = capacities.select('th')[1]
    assert average.text == 'Avg. utilization'
    assert average['data-sb-sort-type'] == 'number'


def test_directory_preserves_names_for_search(app, fabric_customer):
    """Nickname presentation must not hide the underlying account name from search."""
    from app.services.fabric_consumption import get_fabric_report

    with app.app_context():
        customer = db.session.get(Customer, fabric_customer)
        customer.nickname = 'Friendly Fabric'
        db.session.commit()
        row = next(row for row in get_fabric_report()['customers'] if row['id'] == fabric_customer)
        assert row['name'] == 'Friendly Fabric'
        assert row['account_name'] == 'Fabric route customer'
        assert row['nickname'] == 'Friendly Fabric'


def test_customer_seller_is_shared_by_detail_and_capacity_overview(app, fabric_customer):
    """Hover data uses the current local seller assignment even without an imported snapshot."""
    from app.models import Seller
    from app.services.fabric_consumption import get_fabric_capacity_overview, get_fabric_report

    with app.app_context():
        assert get_fabric_report(fabric_customer)['customer']['seller'] is None
        seller = Seller(name='Fabric test seller')
        db.session.add(seller)
        customer = db.session.get(Customer, fabric_customer)
        customer.seller = seller
        db.session.commit()
        try:
            expected = {'id': seller.id, 'name': seller.name}
            assert get_fabric_report(fabric_customer)['customer']['seller'] == expected
            rows = get_fabric_capacity_overview()['rows']
            assert next(row for row in rows if row['id'] == fabric_customer)['seller'] == expected
        finally:
            customer.seller = None
            db.session.delete(seller)
            db.session.commit()


@pytest.mark.parametrize('value', ['abc', '', '-1', '0', '1.5'])
def test_invalid_customer_filter_is_explicit(client, value):
    """Bad filters return validation errors rather than defaulting to all customers."""
    response = client.get('/api/reports/fabric-consumption', query_string={'customer_id': value})
    assert response.status_code == 400
    assert response.json['success'] is False


def test_unknown_customer_is_not_found(client):
    """A deleted or unknown customer must not receive another customer's detail."""
    response = client.get('/api/reports/fabric-consumption?customer_id=987654321')
    assert response.status_code == 404


def test_data_and_tool_share_report_service(client, app, monkeypatch, fabric_customer):
    """API and SalesIQ both wrap the saved-data service with the identical customer scope."""
    from app.services import fabric_consumption
    from app.services.salesiq_tools import execute_tool

    read = Mock(return_value={'snapshot': None, 'customers': [], 'customer': None})
    monkeypatch.setattr(fabric_consumption, 'get_fabric_report', read)
    response = client.get(
        '/api/reports/fabric-consumption', query_string={'customer_id': fabric_customer},
    )
    assert response.status_code == 200
    read.assert_called_with(customer_id=fabric_customer)
    with app.app_context():
        result = execute_tool('report_fabric_consumption', {'customer_id': fabric_customer})
    assert result == {'snapshot': None, 'customers': [], 'customer': None}
    read.assert_called_with(customer_id=fabric_customer)


def test_import_requires_customer_tpids(client, monkeypatch):
    """A missing import scope is surfaced before any background work starts."""
    from app.services import revenue_pull

    monkeypatch.setattr(revenue_pull, 'get_customer_tpids', lambda: [])
    response = client.post('/api/reports/fabric-consumption/import')
    assert response.status_code == 400
    assert 'valid TPIDs' in response.json['error']


def test_repeated_import_returns_same_durable_identity(client, monkeypatch):
    """Identical button clicks coalesce instead of creating a second executor."""
    from app.services import revenue_pull

    monkeypatch.setattr(revenue_pull, 'get_customer_tpids', lambda: [(456789, 'Customer')])
    response = client.post('/api/reports/fabric-consumption/import')
    repeated = client.post('/api/reports/fabric-consumption/import')
    assert response.status_code == repeated.status_code == 202
    assert response.json['job_id'] == repeated.json['job_id']


def test_import_starts_background_job_with_claim(client, monkeypatch):
    """The import outlives page navigation and does not double-claim the job."""
    from app.services import fabric_consumption, revenue_pull
    from app.services import job_queue, sync_jobs

    monkeypatch.setattr(revenue_pull, 'get_customer_tpids', lambda: [(456789, 'Customer')])
    monkeypatch.setattr(SyncStatus, 'try_mark_started', lambda key: True)
    sync = Mock(return_value={'success': True, 'trend_row_count': 1})
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption', sync)

    response = client.post('/api/reports/fabric-consumption/import')
    assert response.status_code == 202
    sync.assert_not_called()
    job_queue.process_one('test-worker')
    sync.assert_called_once_with(progress=sync_jobs.publish_progress)
    assert client.get(response.json['status_url']).json['job']['status'] == 'done'


def test_import_without_worker_is_durable_and_visibly_waiting(client, monkeypatch):
    """A missing worker does not discard work or pretend execution succeeded."""
    from app.services import revenue_pull

    monkeypatch.setattr(revenue_pull, 'get_customer_tpids', lambda: [(456789, 'Customer')])
    response = client.post('/api/reports/fabric-consumption/import')
    assert response.status_code == 202
    assert response.json['job']['state'] == 'waiting_for_worker'
    assert response.json['job']['status'] == 'pending'


def test_claim_database_failure_is_visible(client, monkeypatch):
    """A database error must not return a success-shaped import response."""
    from sqlalchemy.exc import SQLAlchemyError
    from app.services import revenue_pull

    monkeypatch.setattr(revenue_pull, 'get_customer_tpids', lambda: [(456789, 'Customer')])
    monkeypatch.setattr(
        'app.routes.jobs.admit_sync', Mock(side_effect=SQLAlchemyError('Unavailable')),
    )
    response = client.post('/api/reports/fabric-consumption/import')
    assert response.status_code == 500
    assert response.json['success'] is False
