"""Source-defined pillar import, transactional safety and whitespace parity."""

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import IntegrityError

from app.models import (
    Customer, CustomerRevenueData, RevenueImport, StrategicPillarRevenueData, db,
)
from app.services import revenue_pull
from app.services.revenue_sync import _write_rows, sync_revenue
from app.services.whitespace import STRATEGIC_PILLARS, prepare_pillar_rows


@pytest.fixture
def pillar_customer(app):
    """Create a real model identity in the isolated test database."""
    customer = Customer(name='Pillar Customer', tpid=12345)
    db.session.add(customer)
    db.session.commit()
    return customer


def source_row(**changes):
    """Build source-shaped test data without deriving pillars from bucket labels."""
    return {'tpid': 12345, 'name': 'Pillar Customer', 'fm': 'FY27-Aug',
            'bucket': 'Fabric', 'product': 'Azure Synapse Analytics',
            'pillar': 'Analytics', 'acr': 100.0, **changes}


def save_rows(customer, rows):
    """Persist all three grains with the same writer used by the ACR job."""
    return _write_rows([source_row()], [source_row()], [(customer.tpid, customer.name)],
                       pillar_rows=rows)


def test_query_uses_official_pillar_column_and_existing_scope():
    """The HAR's field, measure and dataset filters are reused, not a bucket mapping."""
    query = revenue_pull._pillar_query([12345], ['FY27'])
    columns = {entry['Name']: entry.get('Column', {}).get('Property')
               for entry in query['Select']}
    assert columns == {'tpid': 'TPID', 'name': 'TPAccountName', 'fm': 'FiscalMonth',
                       'pillar': 'SuperStrategicPillar', 'product': 'ServiceLevel4', 'acr': None}
    assert query['From'] == revenue_pull._acr_from()
    assert query['Where'] == revenue_pull._acr_where([12345], ['FY27'], 'SuperStrategicPillar')
    assert query['Select'][-1]['Measure']['Property'] == '$ ACR'
    assert 'ServiceCompGrouping' not in str(query)


def test_normalization_is_tpid_based_and_aggregates_trimmed_source_rows(pillar_customer):
    """Duplicate names cannot combine unrelated accounts or change pillar attribution."""
    rows = [
        source_row(), source_row(product=' Azure Synapse Analytics ', acr=25),
        source_row(tpid=98765, name=pillar_customer.name, acr=50),
        source_row(pillar='Infra', acr=75),
    ]
    records = prepare_pillar_rows(rows, {12345: pillar_customer.id}, 1)
    assert len(records) == 3
    by_key = {(row.tpid, row.pillar): row for row in records}
    assert by_key[(12345, 'Analytics')].revenue == 125
    assert by_key[(98765, 'Analytics')].revenue == 50
    assert by_key[(98765, 'Analytics')].customer_id is None
    assert by_key[(12345, 'Infra')].revenue == 75


def test_all_seven_source_categories_are_available(client):
    """A never-consumed pillar still belongs to the management whitespace taxonomy."""
    assert client.get('/api/reports/whitespace/pillars').get_json() == list(STRATEGIC_PILLARS)


def test_grid_averages_monthly_pillar_sums_not_product_rows(client, pillar_customer):
    """Product grain must not weight the old monthly-average whitespace rule."""
    save_rows(pillar_customer, [
        source_row(acr=100), source_row(product='Fabric', acr=200),
        source_row(fm='FY27-Sep', acr=300),
    ])
    result = client.get('/api/reports/whitespace?buckets=Analytics&show_all=1').get_json()
    assert result['customers'][0]['buckets'] == {'Analytics': 300}
    assert CustomerRevenueData.query.one().bucket == 'Fabric'
    assert StrategicPillarRevenueData.query.count() == 3


def test_zero_net_month_is_not_pillar_coverage(client, pillar_customer):
    """Credits cannot create a false consuming pillar from positive product rows."""
    save_rows(pillar_customer, [
        source_row(acr=100), source_row(product='Credit', acr=-100),
    ])
    assert client.get('/api/reports/whitespace?buckets=Analytics&show_all=1').get_json()[
        'customers'] == []
    reverse = client.get(f'/api/reports/whitespace/reverse/{pillar_customer.id}').get_json()
    assert 'Analytics' in reverse['missing_buckets']
    penetration = client.get('/api/reports/whitespace/penetration?buckets=Analytics').get_json()
    assert penetration == [{'bucket': 'Analytics', 'customers_with_spend': 0,
                            'total_customers': 1, 'penetration_pct': 0}]


def test_legacy_bucket_data_is_not_used_as_pillar_data(client, pillar_customer):
    """Upgraded installations explicitly require an import instead of synthesizing pillars."""
    _write_rows([source_row()], [source_row()], [(pillar_customer.tpid, pillar_customer.name)])
    response = client.get('/reports/whitespace')
    assert b'No strategic pillar data yet' in response.data
    assert b'/revenue/import' in response.data
    assert client.get('/api/reports/whitespace?buckets=Analytics&show_all=1').get_json()[
        'customers'] == []


def test_pillar_products_share_native_full_and_embedded_history(client, pillar_customer):
    """The preview uses pillar data even when a similarly named revenue bucket differs."""
    save_rows(pillar_customer, [source_row(product='Pillar-only product', acr=75)])
    url = f'/reports/whitespace/customer/{pillar_customer.id}/pillar/Analytics'
    for suffix in ('', '?embed=1'):
        response = client.get(url + suffix)
        assert response.status_code == 200
        assert b'data-sb-pillar-products' in response.data
        assert b'Pillar-only product' in response.data
        assert b'Full Product History' in response.data
        assert b'Azure Synapse Analytics' not in response.data
        if not suffix:
            trail = BeautifulSoup(response.data, 'html.parser').select_one(
                'nav[aria-label="Breadcrumb"]')
            assert [link['href'] for link in trail.select('a')] == [
                '/', '/reports', '/reports/whitespace',
            ]
    assert client.get(url.replace('Analytics', 'Fabric')).status_code == 404


@pytest.mark.parametrize('failure', ['pull', 'empty', 'invalid', 'write'])
def test_failed_pillar_import_preserves_all_previous_revenue(
        pillar_customer, monkeypatch, failure):
    """The additional source pull and writes are part of the original atomic replacement."""
    save_rows(pillar_customer, [source_row(acr=42)])
    monkeypatch.setattr(revenue_pull, 'pull_acr_for_customers',
                        lambda *args, **kwargs: [source_row(acr=300)])
    monkeypatch.setattr(revenue_pull, 'pull_products_for_customers',
                        lambda *args, **kwargs: [source_row(acr=300)])

    def pull_pillars(*args, **kwargs):
        """Inject representative third-source failures without a network request."""
        if failure == 'pull':
            raise revenue_pull.RevenuePullError('Pillar source unavailable')
        if failure == 'empty':
            return []
        return [source_row(pillar='Unknown' if failure == 'invalid' else 'Analytics', acr=300)]

    monkeypatch.setattr(revenue_pull, 'pull_pillars_for_customers', pull_pillars)
    if failure == 'write':
        original = db.session.bulk_save_objects

        def fail_pillar_write(records):
            """Fail after the original revenue inserts but before the shared commit."""
            if records and isinstance(records[0], StrategicPillarRevenueData):
                raise IntegrityError('pillar insert', {}, ValueError('write failed'))
            return original(records)

        monkeypatch.setattr(db.session, 'bulk_save_objects', fail_pillar_write)
    result = sync_revenue(['FY27'], run_analysis=False)
    assert result['success'] is False
    assert result['error']
    assert RevenueImport.query.count() == 1
    assert CustomerRevenueData.query.one().revenue == 100
    assert StrategicPillarRevenueData.query.one().revenue == 42


def test_pillar_tools_use_same_monthly_totals(pillar_customer):
    """Both the report tool and the new entity tool read the source-defined saved data."""
    from app.services.salesiq_tools import execute_tool
    save_rows(pillar_customer, [source_row(), source_row(product='Fabric', acr=200)])
    coverage = execute_tool('report_whitespace', {'customer_id': pillar_customer.id})
    assert coverage['pillars_with_spend'] == ['Analytics']
    assert 'AI' in coverage['missing_pillars']
    history = execute_tool('get_strategic_pillar_revenue', {'customer_id': pillar_customer.id})
    assert history['rows'] == [{'pillar': 'Analytics', 'month': '2026-08-01', 'revenue': 300}]


def test_clear_revenue_removes_pillar_rows_before_import_logs(client, pillar_customer):
    """Admin clearing includes the new cache and does not leave invalid import references."""
    save_rows(pillar_customer, [source_row()])
    response = client.post('/api/admin/clear-revenue')
    assert response.status_code == 200
    assert response.get_json()['success']
    assert StrategicPillarRevenueData.query.count() == RevenueImport.query.count() == 0


def test_merge_keeps_pillar_history_linked_to_surviving_customer(pillar_customer):
    """Customer merges retain source TPID provenance while moving the local relationship."""
    from app.services.customer_merge import merge_customer
    destination = Customer(name='Surviving Customer', tpid=67890)
    db.session.add(destination)
    db.session.commit()
    save_rows(pillar_customer, [source_row()])
    result = merge_customer(pillar_customer.id, destination.id)
    assert result['success']
    assert result['migrated']['pillar_revenue'] == 1
    record = StrategicPillarRevenueData.query.one()
    assert record.customer_id == destination.id
    assert record.tpid == 12345
