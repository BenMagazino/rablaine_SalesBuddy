"""Covered acquisition calculations, specialty access and shared report/widget surfaces."""

from datetime import date
from dataclasses import replace
import json
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from app.models import (
    Customer, RevenueImport, Seller, StrategicPillarRevenueData, UserPreference, db,
)
from app.services.fabric_acquisition import (
    get_fabric_acquisition_report, get_fabric_acquisition_widget,
)
from app.services.dashboards import WIDGET_DEFINITIONS
from app.services.salesiq_tools import execute_tool

REFERENCE = date(2026, 10, 20)


@pytest.fixture
def acquisition_rows(app):
    """Seed only the isolated database and preserve the user's saved role/specialty."""
    with app.app_context():
        pref = UserPreference.query.first()
        original = pref.user_role, pref.se_specialty
        pref.user_role, pref.se_specialty = 'se', 'data'
        imported = RevenueImport(filename='acquisition-test')
        db.session.add(imported)
        db.session.flush()
        seller = Seller(name='Acquisition owner')
        db.session.add(seller)
        db.session.flush()

        def add(name, pillar='AI', product='Azure OpenAI', amount=30, months=(7, 8, 9)):
            """Append source-defined product/month rows with current customer ownership."""
            customer = Customer.query.filter_by(name=name).first()
            if customer is None:
                customer = Customer(name=name, tpid=10000 + Customer.query.count(), seller=seller)
                db.session.add(customer)
                db.session.flush()
            for month in months:
                db.session.add(StrategicPillarRevenueData(
                    customer_id=customer.id, customer_name=name, tpid=customer.tpid,
                    pillar=pillar, product=product, month_date=date(2026, month, 1),
                    fiscal_month=f'FY27-{month}', revenue=amount, last_import_id=imported.id,
                ))
            db.session.flush()
            return customer

        yield add, pref
        pref.user_role, pref.se_specialty = original
        db.session.commit()


def test_acquisition_splits_fabric_and_preserves_credits_and_period(acquisition_rows):
    """Use one source, a fixed divisor and no current/older-month contamination."""
    add, _ = acquisition_rows
    customer = add('Covered')
    add('Covered', 'Databases', 'Azure SQL Database', 60)
    add('Covered', 'Analytics', 'Azure Synapse Analytics', 90)
    add('Covered', 'Analytics', 'Fabric Capacity', 0)
    add('Covered', 'Analytics', 'Fabric Capacity Regional', -3)
    add('Covered', 'Analytics', 'Fabric CapacityX', 6)
    add('Covered', amount=9000, months=(6, 10, 11))
    paid = add('Paid')
    add('Paid', 'Analytics', 'Fabric Capacity', 10)
    add('Fabric only', 'Analytics', 'Fabric Capacity', 50)
    data = get_fabric_acquisition_report(REFERENCE)
    assert data['months'] == ['2026-07-01', '2026-08-01', '2026-09-01']
    assert data['count'] == 1
    assert data['rows'][0]['customer_id'] == customer.id
    assert data['rows'][0]['monthly_spend'] == {
        'AI': 30, 'Databases': 60, 'Analytics': 96, 'Fabric': -3,
    }
    assert get_fabric_acquisition_report(REFERENCE, customer_ids=())['count'] == 0
    assert get_fabric_acquisition_report(REFERENCE, customer_ids=(paid.id,))['count'] == 0
    assert get_fabric_acquisition_report(
        REFERENCE, customer_ids=(customer.id,),
    )['count'] == 1


def test_missing_months_never_imply_no_fabric(acquisition_rows):
    """Partial relevant customers are unknown, including missing middle months."""
    add, _ = acquisition_rows
    add('Partial', months=(7, 9))
    add('Covered')
    add('Infrastructure only', 'Infra', 'Virtual Machines', 100)
    data = get_fabric_acquisition_report(REFERENCE)
    assert data['count'] == 1
    assert data['unknown_customer_count'] == 1
    assert [row['customer_name'] for row in data['rows']] == ['Covered']


def test_footprint_uses_unrounded_monthly_values(acquisition_rows):
    """Include Analytics using exact values without subtracting Fabric twice."""
    add, _ = acquisition_rows
    add('Fractional', amount=0.49)
    add('Fractional', 'Databases', 'Azure SQL Database', 0.49)
    add('Fractional', 'Analytics', 'Azure Synapse Analytics', 100)
    data = get_fabric_acquisition_report(REFERENCE)
    assert [column['key'] for column in data['columns']] == [
        'AI', 'Databases', 'Analytics',
    ]
    assert data['rows'][0]['revenue'] == pytest.approx(100.98)


@pytest.mark.parametrize(('ai', 'databases', 'analytics', 'fabric', 'included'), [
    (1999.9999, 0, 0, 0, False),
    (2000, 0, 0, 0, True),
    (2000.0001, 0, 0, 0, True),
    (1000, 600, 400, 0, True),
    (1000, 600, 399.9999, 0, False),
    (1999.99, 0, 0, -100, False),
    (2500, 0, -600, 0, False),
])
def test_widget_only_monthly_minimum(
    acquisition_rows, ai, databases, analytics, fabric, included,
):
    """Apply the unrounded monthly threshold only to widget counts, rows and groups."""
    add, _ = acquisition_rows
    customer = add('Threshold prospect', amount=ai)
    add(customer.name, 'Databases', 'Azure SQL Database', databases)
    add(customer.name, 'Analytics', 'Azure Synapse Analytics', analytics)
    add(customer.name, 'Analytics', 'Fabric Capacity', fabric)
    assert get_fabric_acquisition_report(REFERENCE)['count'] == 1
    widget = get_fabric_acquisition_widget(REFERENCE)
    assert widget['count'] == int(included)
    assert len(widget['rows']) == int(included)
    assert sum(len(group['rows']) for group in widget['seller_groups']) == int(included)
    assert get_fabric_acquisition_widget(REFERENCE, customer_ids=())['count'] == 0
    assert get_fabric_acquisition_widget(
        REFERENCE, customer_ids=(customer.id,),
    )['count'] == int(included)


def test_positive_fabric_month_cannot_be_hidden_by_later_credit(acquisition_rows):
    """A net-zero quarter still has observed paid Fabric when one month is positive."""
    add, _ = acquisition_rows
    add('Credited Fabric')
    add('Credited Fabric', 'Analytics', 'Fabric Capacity', 30, months=(7,))
    add('Credited Fabric', 'Analytics', 'Fabric Capacity', -30, months=(8,))
    assert get_fabric_acquisition_report(REFERENCE)['count'] == 0


def test_covered_zero_months_use_fixed_divisor(acquisition_rows):
    """Other pillar observations cover months with no positive target-product rows."""
    add, _ = acquisition_rows
    add('Sparse AI', 'Infra', 'Virtual Machines', 100, months=(7, 8))
    add('Sparse AI', amount=30, months=(9,))
    data = get_fabric_acquisition_report(REFERENCE)
    assert data['count'] == 1
    assert data['unknown_customer_count'] == 0
    assert data['rows'][0]['monthly_spend']['AI'] == 10


def test_three_complete_months_cross_calendar_year(acquisition_rows):
    """A January reference uses October through December without including January."""
    add, _ = acquisition_rows
    add('New year prospect', months=(10, 11, 12))
    data = get_fabric_acquisition_report(date(2027, 1, 15))
    assert data['months'] == ['2026-10-01', '2026-11-01', '2026-12-01']
    assert data['count'] == 1
    assert data['rows'][0]['monthly_spend']['AI'] == 30


@pytest.mark.parametrize(('role', 'specialty', 'allowed'), [
    ('se', 'data', True), ('se', 'infra', False), ('se', 'apps_ai', False),
    ('dss', 'infra', True), ('dss', 'other', True),
])
def test_role_gates_tab_api_catalog_and_tool(client, acquisition_rows, role, specialty, allowed):
    """Every surface includes sellers independently of their stored SE specialty."""
    add, pref = acquisition_rows
    add('Prospect')
    pref.user_role, pref.se_specialty = role, specialty
    db.session.commit()
    result = get_fabric_acquisition_report(REFERENCE)
    with patch('app.services.fabric_acquisition.get_fabric_acquisition_report', return_value=result):
        page = client.get('/reports/whitespace')
        assert page.status_code == 200
        soup = BeautifulSoup(page.data, 'html.parser')
        assert bool(soup.select_one('#acquisition-tab')) is allowed
        deep = client.get('/reports/whitespace?view=fabric-acquisition')
        assert deep.status_code == (200 if allowed else 403)
        if allowed:
            assert BeautifulSoup(deep.data, 'html.parser').select_one(
                '[data-initial-mode="acquisition"]',
            )
        api = client.get('/api/reports/whitespace/fabric-acquisition')
        assert api.status_code == (200 if allowed else 403)
        tool = execute_tool('report_fabric_acquisition', {})
        assert ('error' not in tool) is allowed
    catalog = client.get('/api/reports/dashboards').json['catalog']
    assert any(item['key'] == 'fabric.acquisition' for item in catalog) is allowed
    assert pref.se_specialty == specialty


def test_report_widget_and_tool_share_source_and_grouping(client, acquisition_rows, monkeypatch):
    """Keep the report unfiltered while applying the widget-only minimum at every width."""
    add, _ = acquisition_rows
    add('<Prospect>', amount=2000)
    add('Below widget minimum', amount=1999.9999)
    add('Incomplete prospect', months=(7, 9))
    data = get_fabric_acquisition_report(REFERENCE)
    assert data['unknown_customer_count'] == 1
    monkeypatch.setitem(WIDGET_DEFINITIONS, 'fabric.acquisition', replace(
        WIDGET_DEFINITIONS['fabric.acquisition'],
        provider=lambda reference=None, customer_ids=None: get_fabric_acquisition_widget(
            REFERENCE, customer_ids=customer_ids,
        ),
    ))
    with patch('app.services.fabric_acquisition.get_fabric_acquisition_report', return_value=data):
        page = BeautifulSoup(client.get(
            '/reports/whitespace?view=fabric-acquisition',
        ).data, 'html.parser')
        assert page.select_one('#fabricAcquisitionTable')
        assert len(page.select('#fabricAcquisitionTable thead th')) == 4
        assert 'excluded because monthly coverage' not in page.text
        assert len(page.select('#fabricAcquisitionTable tr[data-row-key]')) == data['count']
        assert page.select_one('#fabricAcquisitionTable th:nth-child(4)').text == (
            'Other Analytics'
        )
        assert execute_tool('report_fabric_acquisition', {})['rows'] == data['rows']
    context = {
        'dashboard': {'live_filters': ['group_by_seller']},
        'live': {'group_by_seller': True},
    }
    for variant, widths in [('metric', (3, 4, 6, 12)), ('detailed', (6, 12))]:
        for width in widths:
            response = client.get('/api/reports/dashboards/widget-preview', query_string={
                'key': 'fabric.acquisition', 'variant': variant, 'width': width,
                'filter_context': json.dumps(context),
            })
            assert response.status_code == 200
            widget = BeautifulSoup(response.json['html'], 'html.parser')
            assert 'excluded because monthly coverage' not in widget.text
            assert widget.select_one('a[href="/reports/whitespace?view=fabric-acquisition"]')
            if variant == 'detailed':
                assert len(widget.select('thead th')) == 4
                assert widget.select_one('thead th:last-child').text == 'Other Analytics'
                assert widget.select_one('.db-report-seller-heading th')['colspan'] == '4'
                assert widget.select_one('.db-report-seller')
                assert len(widget.select('tr[data-row-key]')) == 1
                assert '<Prospect>' in widget.text
                assert not widget.select('prospect')
                assert 'Below widget minimum' not in widget.text
            else:
                assert widget.select_one('.db-acquisition-count').text == '1'


def test_empty_import_and_disabled_widget_are_distinct(client, acquisition_rows):
    """An empty observation set is not evidence of no Fabric adoption."""
    _, pref = acquisition_rows
    data = get_fabric_acquisition_report(REFERENCE)
    assert not data['has_revenue_data']
    assert data['count'] == 0
    pref.user_role, pref.se_specialty = 'se', 'infra'
    db.session.commit()
    response = client.get('/api/reports/dashboards/widget-preview', query_string={
        'key': 'fabric.acquisition', 'variant': 'metric', 'width': 3,
    })
    assert 'Available for Data SEs and sellers' in response.json['html']
