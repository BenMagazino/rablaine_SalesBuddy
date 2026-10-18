"""Shared prerequisites gate widget calculations without changing dashboard state."""
from dataclasses import replace
from datetime import date
from unittest.mock import Mock

from bs4 import BeautifulSoup
import pytest

from app.models import CustomerRevenueData, Dashboard, RevenueImport, db
from app.services import connect_goals, dashboards
from tests.test_dashboards import BASE, add_widget, create_dashboard


@pytest.fixture
def bucket_scope(app):
    """Provide real bucket choices while leaving annual confirmation unset."""
    with app.app_context():
        imported = RevenueImport(filename='widget-requirement-test')
        db.session.add(imported)
        db.session.flush()
        for bucket in ('Databases', 'Fabric'):
            db.session.add(CustomerRevenueData(
                customer_name='Scope Customer', bucket=bucket, fiscal_month='FY27-Jul',
                month_date=date(2026, 7, 1), revenue=1, last_import_id=imported.id,
            ))
        db.session.commit()


@pytest.mark.parametrize('editing', [False, True])
def test_widget_requirements_are_actionable_in_saved_and_editor_views(
    client, monkeypatch, editing, bucket_scope,
):
    """Every blocked widget offers setup in place, not navigation to another report."""
    dashboard_id = create_dashboard(client)
    for key in dashboards.WIDGET_DEFINITIONS:
        add_widget(client, dashboard_id, key)
        spec = dashboards.WIDGET_DEFINITIONS[key]
        monkeypatch.setitem(dashboards.WIDGET_DEFINITIONS, key, replace(
            spec, provider=Mock(side_effect=AssertionError('Blocked calculation')),
        ))
    suffix = '/edit' if editing else ''
    page = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}{suffix}').data, 'html.parser',
    )
    assert len(page.select('.db-widget [data-widget-requirement="compensation_buckets"]')) == 4
    assert len(page.select('.db-widget-body[data-widget-requirements]')) == 4
    assert page.select_one('#dashboardRequirementDialog')
    assert page.select_one('#dashboardRequirementForm')
    assert page.select_one('.db-setup') is None
    assert any('ui-dashboard-requirements.js' in script['src']
               for script in page.select('script[src]'))
    for spec in dashboards.WIDGET_DEFINITIONS.values():
        spec.provider.assert_not_called()


def test_confirmation_unblocks_all_widgets_and_builtin_without_publishing(
    client, app, bucket_scope,
):
    """The existing server preference is the single source of truth across surfaces."""
    dashboard_id = create_dashboard(client)
    for key in dashboards.WIDGET_DEFINITIONS:
        add_widget(client, dashboard_id, key)
    before = client.get(f'{BASE}/{dashboard_id}').json['dashboard']
    response = client.get(f'{BASE}/requirements/compensation_buckets')
    assert response.status_code == 200
    assert response.json['setup']['ready'] is False
    form = BeautifulSoup(response.json['html'], 'html.parser')
    assert [field['value'] for field in form.select('input')] == ['Databases', 'Fabric']
    assert client.post('/api/revenue/compensated-buckets', json={
        'buckets': ['Fabric'], 'confirm_for_fiscal_year': True,
    }).json['success'] is True
    setup = client.get(f'{BASE}/requirements/compensation_buckets').json['setup']
    assert setup['ready'] is True
    assert setup['selected_buckets'] == ['Fabric']
    after = client.get(f'{BASE}/{dashboard_id}').json['dashboard']
    assert all(not widget['requirements'] and widget['data'] for widget in after['widgets'])
    assert after['layout_revision'] == before['layout_revision']
    assert after['updated_at'] == before['updated_at']
    for original, current in zip(before['widgets'], after['widgets']):
        for key in ('id', 'layout_row', 'layout_column', 'column_span', 'row_span', 'variant_key'):
            assert current[key] == original[key]
        preview = client.get(f'{BASE}/widget-preview', query_string={
            'key': current['key'], 'variant': current['variant_key'],
            'width': current['column_span'], 'instance_id': current['id'],
        }).json
        assert 'data-widget-requirement=' not in preview['html']
        assert 'sb-goals-section' in preview['html']
    with app.app_context():
        assert connect_goals.get_setup_state()['selected_buckets'] == ['Fabric']
        assert db.session.get(Dashboard, dashboard_id).layout_revision == before['layout_revision']
    dashboard = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser',
    )
    assert dashboard.select_one('[data-widget-requirement]') is None
    assert len(dashboard.select('.db-widget .sb-connect-goals')) == 4


def test_preview_is_gated_and_unknown_requirement_is_explicit(client, monkeypatch, bucket_scope):
    """The content endpoint cannot bypass prerequisites even for unsaved widgets."""
    spec = dashboards.WIDGET_DEFINITIONS['connect_goals.u2c']
    provider = Mock(side_effect=AssertionError('Blocked calculation'))
    monkeypatch.setitem(dashboards.WIDGET_DEFINITIONS, spec.key, replace(spec, provider=provider))
    result = client.get(f'{BASE}/widget-preview', query_string={
        'key': spec.key, 'variant': 'metric', 'width': 3, 'instance_id': -4,
    })
    assert result.status_code == 200
    assert 'data-widget-requirement="compensation_buckets"' in result.json['html']
    provider.assert_not_called()
    assert client.get(f'{BASE}/requirements/unknown').status_code == 404


def test_widgets_without_requirement_still_render_while_other_widgets_are_blocked(
    client, monkeypatch, bucket_scope,
):
    """Requirements are declared per definition, not a dashboard-wide gate."""
    key = 'connect_goals.team_coverage'
    spec = dashboards.WIDGET_DEFINITIONS[key]
    monkeypatch.setitem(dashboards.WIDGET_DEFINITIONS, key, replace(spec, requirements=()))
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    add_widget(client, dashboard_id, key)
    widgets = client.get(f'{BASE}/{dashboard_id}').json['dashboard']['widgets']
    assert widgets[0]['requirements']
    assert widgets[0]['data'] is None
    assert widgets[1]['requirements'] == []
    assert widgets[1]['data']
