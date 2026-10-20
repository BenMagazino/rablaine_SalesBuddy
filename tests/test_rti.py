"""RTI discovery eligibility, source windows and report-backed dashboard integration."""
from datetime import date, datetime, timezone

from bs4 import BeautifulSoup
import pytest

from app.models import (
    Customer, FabricConsumptionImport, FabricConsumptionRecord, ProductRevenueData,
    RevenueImport, Seller, db,
)
from app.services import rti
from app.services.dashboards import get_widget_preview
from app.services.salesiq_tools import execute_tool
from tests.test_fabric_renewal_widgets import render_widget


REFERENCE = date(2026, 10, 20)


@pytest.fixture
def rti_rows(app):
    """Save source-grain measurements only in the isolated test database."""
    with app.app_context():
        imported = RevenueImport(filename='rti-test')
        snapshot = FabricConsumptionImport(
            customer_count=0, workload_row_count=0, capacity_row_count=0, trend_row_count=0,
        )
        seller = Seller(name='RTI owner')
        db.session.add_all([imported, snapshot, seller])
        db.session.flush()

        def add(name, *, product=None, amount=400, month=date(2026, 9, 1),
                hours=None, total=100, capacities=0):
            """Add a customer and optional native workload or monthly product record."""
            customer = Customer.query.filter_by(name=name).first()
            if customer is None:
                customer = Customer(name=name, tpid=80000 + Customer.query.count(), seller=seller)
                db.session.add(customer)
                db.session.flush()
            if product:
                db.session.add(ProductRevenueData(
                    customer_id=customer.id, customer_name=name, bucket='Analytics',
                    product=product, revenue=amount, month_date=month,
                    fiscal_month=f'FY27-{month.month}', last_import_id=imported.id,
                ))
            if hours is not None:
                for kind, metrics in (
                    ('customer', {'cu_hours': total}),
                    ('workload_summary', {'workload': rti.RTI_WORKLOAD, 'cu_hours': hours}),
                ):
                    db.session.add(FabricConsumptionRecord(
                        import_id=snapshot.id, customer_id=customer.id, tpid=customer.tpid,
                        kind=kind, metrics_json=metrics,
                    ))
            for index in range(capacities):
                db.session.add(FabricConsumptionRecord(
                    import_id=snapshot.id, customer_id=customer.id, tpid=customer.tpid,
                    kind='capacity', capacity_id=f'cap-{index}', sku='F64', metrics_json={},
                ))
            db.session.flush()
            return customer

        yield add


@pytest.mark.parametrize(('product', 'family'), [
    ('Event Hubs', 'event_hubs'), ('Event Hubs Dedicated', 'event_hubs'),
    ('Stream Analytics', 'stream_analytics'), ('IoT Hub', 'iot'),
    ('IoT Hub Device Provisioning', 'iot'), ('Device Update for IoT Hub', 'iot'),
    ('Event Grid', None), ('Streaming Units', None), ('Event HubsX', None),
    ('Fabric Capacity', None),
])
def test_exact_product_families(product, family):
    """Use complete source product names and do not invent adjacent-service mappings."""
    assert rti._product_family(product) == family


def test_union_windows_net_amounts_and_no_capacity_double_count(rti_rows):
    """Either source qualifies, with three complete months and independent RTI usage."""
    add = rti_rows
    both = add('Both', product='Event Hubs', hours=25, capacities=3)
    add('Both', product='IoT Hub', amount=80, month=date(2026, 7, 1))
    add('Both', product='Stream Analytics', amount=-40, month=date(2026, 8, 1))
    add('Both', product='Event Hubs', amount=90000, month=date(2026, 6, 1))
    add('Both', product='Event Hubs', amount=90000, month=date(2026, 11, 1))
    for product in ('Event Hubs', 'Stream Analytics', 'IoT Hub'):
        add('Both', product=product, amount=90000, month=date(2026, 10, 1))
    add('Current month only', product='Event Hubs', amount=90000, month=date(2026, 10, 1))
    rti_only = add('RTI only', hours=0.00001, total=10)
    azure_only = add('Azure only', product='Stream Analytics', amount=0.00001)
    add('Credit only', product='IoT Hub', amount=-400)
    add('Not relevant', product='Event Grid')
    add('Zero', hours=0, product='Event Hubs', amount=0)
    result = rti.get_rti_report(REFERENCE)
    assert result['months'] == ['2026-07-01', '2026-08-01', '2026-09-01']
    assert result['period_label'] == 'Jul 2026 through Sep 2026'
    assert result['count'] == 3
    assert result['rti_customer_count'] == 2
    rows = {row['id']: row for row in result['rows']}
    assert set(rows) == {both.id, rti_only.id, azure_only.id}
    assert rows[both.id]['rti_cu_hours'] == 25
    assert rows[both.id]['rti_share_pct'] == 25
    assert rows[both.id]['monthly_spend'] == pytest.approx({
        'event_hubs': 400 / 3, 'stream_analytics': -40 / 3, 'iot': 80 / 3,
    })
    assert rows[both.id]['monthly_acr'] == pytest.approx(440 / 3)
    assert rows[azure_only.id]['rti_cu_hours'] is None
    assert rows[azure_only.id]['rti_share_pct'] is None
    assert rows[rti_only.id]['monthly_acr'] == 0
    assert result['monthly_acr'] == pytest.approx((440 + 0.00001) / 3)
    widget = rti.get_rti_widget(REFERENCE)
    assert widget['details']['rows'] == result['rows']
    assert widget['monthly_acr'] == result['monthly_acr']
    assert sum(len(group['rows']) for group in result['seller_groups']) == 3


def test_stale_scope_and_returning_account(rti_rows):
    """Neither RTI usage nor explicit scope brings stale accounts back into the queue."""
    current = rti_rows('Current', hours=10)
    stale = rti_rows('Stale', product='Event Hubs', hours=20)
    stale.stale_since = datetime.now(timezone.utc)
    db.session.flush()
    assert rti.get_rti_report(REFERENCE)['count'] == 1
    assert rti.get_rti_widget(REFERENCE, customer_ids=(stale.id,))['count'] == 0
    assert rti.get_rti_widget(REFERENCE, customer_ids=())['count'] == 0
    assert rti.get_rti_widget(REFERENCE, customer_ids=(current.id,))['count'] == 1
    stale.stale_since = None
    db.session.flush()
    assert rti.get_rti_widget(REFERENCE)['count'] == 2


def test_year_boundary_and_no_import_states(rti_rows):
    """Calendar arithmetic crosses years; absent sources are not measured zeros."""
    rti_rows('RTI only', hours=1, total=0)
    result = rti.get_rti_report(date(2027, 1, 15))
    assert result['months'] == ['2026-10-01', '2026-11-01', '2026-12-01']
    assert result['rows'][0]['rti_share_pct'] is None
    assert result['rows'][0]['monthly_acr'] is None
    assert result['monthly_acr'] is None
    db.session.query(FabricConsumptionRecord).delete()
    db.session.query(FabricConsumptionImport).delete()
    result = rti.get_rti_report(REFERENCE)
    assert result['snapshot'] is None
    assert result['count'] == 0


def test_latest_fabric_snapshot_only(rti_rows):
    """Do not carry old RTI measurements into the current saved snapshot."""
    customer = rti_rows('Old RTI', product='Event Hubs', hours=50)
    db.session.add(FabricConsumptionImport(
        customer_count=0, workload_row_count=0, capacity_row_count=0, trend_row_count=0,
    ))
    db.session.flush()
    row = rti.get_rti_report(REFERENCE)['rows'][0]
    assert row['id'] == customer.id
    assert row['rti_cu_hours'] is None
    assert row['has_rti'] is False


@pytest.mark.parametrize('grouped', [False, True])
def test_widget_safe_markup_raw_sorting_and_grouping(rti_rows, grouped):
    """Keep six compact widget columns, percentage hover text and precise sort values."""
    rti_rows('<img src=x onerror=bad()>', product='Event Hubs', amount=0.0001, hours=0.001)
    widget = rti.get_rti_widget(REFERENCE)
    soup = BeautifulSoup(render_widget('rti', widget, group_by_seller=grouped), 'html.parser')
    assert not soup.select('img')
    assert len(soup.select('tr[data-row-key]')) == 1
    assert len(soup.select('thead th')) == 6
    assert soup.select('thead th')[3].text.strip() == 'ASA'
    assert 'Stream Analytics' in soup.select('thead th')[3]['title']
    assert 'RTI %' not in [node.text.strip() for node in soup.select('thead th')]
    assert soup.select_one('table')['data-sb-sort-default-column'] == '5'
    assert float(soup.select('tbody td')[-1]['data-sb-sort-value']) == pytest.approx(0.0001 / 3)
    assert '<0.01' in soup.select('tbody td')[1].text
    assert soup.select('tbody td')[1]['title'] == (
        'RTI share: <0.01% of Fabric CU-hours (rolling 28 days).'
    )
    assert '<$1' in soup.select('tbody td')[-1].text
    assert soup.select('table')[0].parent['tabindex'] == '0'
    assert bool(soup.select('.db-report-seller-heading')) is grouped
    if grouped:
        assert soup.select_one('tbody th')['colspan'] == '6'
    summary = BeautifulSoup(render_widget('rti', widget, 'metric'), 'html.parser')
    assert [node.text for node in summary.select('dd')] == ['1', '1', '<$1']
    assert 'rolling 28 days' in summary.text
    assert 'three complete months' in summary.text
    assert 'current month partial' not in summary.text


def test_widget_missing_rti_is_zero_without_changing_report(client, rti_rows):
    """Only the widget substitutes zero; report measurements and columns stay unchanged."""
    customer = rti_rows('Azure only', product='Event Hubs')
    db.session.commit()
    widget = rti.get_rti_widget(REFERENCE)
    assert widget['details']['rows'][0]['rti_cu_hours'] is None
    assert widget['details']['rows'][0]['rti_share_pct'] is None
    soup = BeautifulSoup(render_widget('rti', widget), 'html.parser')
    cell = soup.select_one(f'tr[data-row-key="{customer.id}"]').select('td')[1]
    assert cell.text == '0'
    assert cell['data-sb-sort-value'] == '0'
    assert cell['title'] == 'RTI share: 0% of Fabric CU-hours (rolling 28 days).'
    page = BeautifulSoup(client.get('/reports/rti').data, 'html.parser')
    assert len(page.select('.sb-rti-table thead th')) == 7
    assert page.select('.sb-rti-table thead th')[4].text.strip() == 'Stream Analytics'
    assert [cell.text.strip() for cell in page.select('.sb-rti-table tbody td')[1:3]] == [
        'Unavailable', 'Unavailable',
    ]


def test_report_api_tool_catalog_and_saved_dashboard(client, rti_rows, dashboard_sources_ready):
    """All entry points reuse saved measurements, with scope and ordinary widget placement."""
    customer = rti_rows('Integrated', product='Event Hubs', hours=30)
    db.session.commit()
    assert execute_tool('report_rti', {})['count'] == 1
    response = client.get('/api/reports/rti')
    assert response.status_code == 200
    assert response.json['rows'][0]['id'] == customer.id
    page = BeautifulSoup(client.get('/reports/rti').data, 'html.parser')
    assert len(page.select('.sb-rti-table tr[data-row-key]')) == 1
    assert 'RTI owner' in page.text
    assert page.select('a[href="/reports/rti"]')
    assert 'Real-Time Intelligence' in client.get('/reports').text
    definition = next(row for row in client.get('/api/reports/dashboards').json['catalog']
                      if row['key'] == 'fabric.rti')
    assert definition['supported_filters'] == ['customer_ids', 'seller_ids', 'group_by_seller']
    for variant in definition['variants']:
        for width in variant['widths']:
            preview = client.get('/api/reports/dashboards/widget-preview', query_string={
                'key': 'fabric.rti', 'variant': variant['key'], 'width': width,
            })
            assert preview.status_code == 200
            assert 'Real-Time Intelligence' in preview.json['html']
    preview = get_widget_preview(
        'fabric.rti', 'detailed', 6,
        filter_context={'widget': {'seller_ids': [customer.seller_id]}},
    )
    assert preview['data']['count'] == 1
    dashboard_id = client.post('/api/reports/dashboards', json={'name': 'RTI'}).json['id']
    assert client.post(f'/api/reports/dashboards/{dashboard_id}/widgets', json={
        'key': 'fabric.rti',
    }).status_code == 200
    assert 'Real-Time Intelligence' in client.get(f'/reports/dashboards/{dashboard_id}').text


@pytest.mark.parametrize('embedded', [False, True])
def test_report_seller_group_toggle_preserves_all_rows(client, rti_rows, embedded):
    """Grouped and flat views have identical customers, separate sort keys and valid labels."""
    first = rti_rows('First owner', product='Event Hubs')
    second = rti_rows('Unassigned', product='IoT Hub')
    second.seller = None
    db.session.commit()
    query = {'embed': '1'} if embedded else {}
    for grouped in (True, False):
        response = client.get('/reports/rti', query_string={
            **query, 'group_by_seller': str(grouped).lower(),
        })
        assert response.status_code == 200
        page = BeautifulSoup(response.data, 'html.parser')
        checkbox = page.select_one('input[type="checkbox"][name="group_by_seller"]')
        assert checkbox.has_attr('checked') is grouped
        assert page.select_one('input[type="hidden"][name="group_by_seller"]')['value'] == 'false'
        assert bool(page.select('input[name="embed"]')) is embedded
        assert {row['data-row-key'] for row in page.select('.sb-rti-table tr[data-row-key]')} == {
            str(first.id), str(second.id),
        }
        assert len(page.select('.sb-modernization-group-header')) == (2 if grouped else 0)
        assert len(page.select('.sb-rti-table')) == (2 if grouped else 1)
        if not grouped:
            table = page.select_one('.sb-rti-table')
            assert table['data-sb-sort-key'] == 'rti-flat'
            assert table['aria-label'] == 'RTI customers'
            assert not table.has_attr('aria-labelledby')
    assert client.get('/reports/rti?group_by_seller=invalid').status_code == 400


def test_flat_report_empty_state(client, rti_rows):
    """A flat empty queue still offers grouping without rendering an empty result table."""
    page = BeautifulSoup(client.get('/reports/rti?group_by_seller=false').data, 'html.parser')
    assert page.select_one('.sb-revenue-empty')
    assert not page.select('.sb-rti-table')
