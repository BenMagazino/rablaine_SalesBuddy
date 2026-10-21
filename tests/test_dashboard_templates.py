"""Starter dashboard installation, user ownership, and explicit template recreation."""
from unittest.mock import Mock, patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Dashboard, DashboardTemplateInstallation, db
from app.services.dashboard_templates import (
    DASHBOARD_TEMPLATES, create_dashboard_from_template, initialize_dashboard_templates,
    get_template_dashboard_url,
)
from tests.test_dashboards import BASE


@pytest.mark.parametrize('key', DASHBOARD_TEMPLATES)
def test_starter_is_installed_once_without_calculating_metrics(app, monkeypatch, key):
    """Startup creates ordinary editable placements, independently of annual setup."""
    from app.services import connect_goals

    provider = Mock(side_effect=AssertionError('Startup must not calculate widget values'))
    monkeypatch.setattr(connect_goals, 'get_setup_state', provider)
    with app.app_context():
        initialize_dashboard_templates()
        template = DASHBOARD_TEMPLATES[key]
        installation = db.session.get(DashboardTemplateInstallation, key)
        first = installation.dashboard
        first_id = first.id
        assert installation.dashboard_id == first_id
        assert installation.version == 1
        assert first.name == template['name']
        assert first.content_width == 'wide'
        assert first.display_style == template['display_style']
        assert [
            (w.widget_key, w.variant_key, w.layout_column,
             w.layout_row, w.column_span, w.row_span) for w in first.widgets
        ] == list(template['widgets'])
        first.name = 'My priorities'
        first.subtitle = 'Keep my edits'
        first.widgets[0].row_span = 6
        db.session.commit()
        initialize_dashboard_templates()
        db.session.remove()
        assert Dashboard.query.count() == len(DASHBOARD_TEMPLATES)
        saved = db.session.get(Dashboard, first_id)
        assert saved.name == 'My priorities'
        assert saved.subtitle == 'Keep my edits'
        assert saved.widgets[0].row_span == 6
    provider.assert_not_called()


@pytest.mark.parametrize('key', DASHBOARD_TEMPLATES)
def test_exact_existing_prerelease_dashboard_is_adopted_without_touching_it(app, key):
    """The creator's manually finished layout is reused, not duplicated or rewritten."""
    with app.app_context():
        original = create_dashboard_from_template(key)
        original.layout_revision = 8
        db.session.commit()
        before = (original.id, original.updated_at, [widget.id for widget in original.widgets])
        initialize_dashboard_templates()
        assert Dashboard.query.count() == len(DASHBOARD_TEMPLATES)
        installation = db.session.get(DashboardTemplateInstallation, key)
        assert installation.dashboard_id == before[0]
        assert original.updated_at == before[1]
        assert original.layout_revision == 8
        assert [widget.id for widget in original.widgets] == before[2]


@pytest.mark.parametrize('key', DASHBOARD_TEMPLATES)
def test_similarly_named_custom_dashboard_is_never_overwritten(app, key):
    """Only an exact copy is adopted; a name alone is not template identity."""
    with app.app_context():
        original = Dashboard(name=DASHBOARD_TEMPLATES[key]['name'], subtitle='My custom view')
        db.session.add(original)
        db.session.commit()
        original_id = original.id
        initialize_dashboard_templates()
        assert Dashboard.query.count() == len(DASHBOARD_TEMPLATES) + 1
        assert db.session.get(Dashboard, original_id).subtitle == 'My custom view'
        assert db.session.get(
            DashboardTemplateInstallation, key,
        ).dashboard_id != original_id


@pytest.mark.parametrize('key', DASHBOARD_TEMPLATES)
def test_deleted_starter_stays_deleted_after_reinitialization_and_reads(client, app, key):
    """A persistent marker survives deletion and prevents surprise recreation."""
    with app.app_context():
        initialize_dashboard_templates()
        starter_id = db.session.get(DashboardTemplateInstallation, key).dashboard_id
    assert client.post(f'{BASE}/{starter_id}/delete', json={}).status_code == 200
    with app.app_context():
        db.session.remove()
        assert db.session.get(DashboardTemplateInstallation, key).dashboard_id is None
        initialize_dashboard_templates()
        assert Dashboard.query.count() == len(DASHBOARD_TEMPLATES) - 1
        destination = get_template_dashboard_url(key)
    assert destination == f'/reports/dashboards?template={key}'
    hub = BeautifulSoup(client.get(destination).data, 'html.parser')
    assert hub.select_one('.db-template-notice')
    assert hub.select_one(f'[data-dashboard-template="{key}"]')
    with app.app_context():
        assert Dashboard.query.count() == len(DASHBOARD_TEMPLATES) - 1


def test_template_copies_are_independent_and_restore_deleted_starter(client, app):
    """Add from template creates editable copies and only replaces a missing starter link."""
    first = client.post(f'{BASE}/from-template/connect-goals', json={})
    second = client.post(f'{BASE}/from-template/connect-goals', json={})
    assert first.status_code == second.status_code == 201
    first_id, second_id = first.json['id'], second.json['id']
    assert first_id != second_id
    assert client.get('/reports/connect-goals').headers['Location'] == (
        f'/reports/dashboards/{first_id}'
    )
    assert client.post(f'{BASE}/{first_id}', json={'name': 'Renamed goals'}).status_code == 200
    assert client.get('/reports/connect-goals').headers['Location'].endswith(str(first_id))
    assert client.get(f'{BASE}/{second_id}').json['dashboard']['name'] == 'Connect Goals'
    assert client.post(f'{BASE}/{first_id}/delete', json={}).status_code == 200
    restored = client.post(f'{BASE}/from-template/connect-goals', json={})
    assert restored.status_code == 201
    assert client.get('/reports/connect-goals').headers['Location'] == (
        f'/reports/dashboards/{restored.json["id"]}'
    )
    with app.app_context():
        other = db.session.get(Dashboard, second_id)
        replacement = db.session.get(Dashboard, restored.json['id'])
        assert len(other.widgets) == len(replacement.widgets) == 4
        assert {w.id for w in other.widgets}.isdisjoint(w.id for w in replacement.widgets)


def test_template_creation_is_atomic_and_invalid_keys_are_visible(client, app):
    """Failed writes leave neither a partial dashboard nor an installation marker."""
    invalid = client.post(f'{BASE}/from-template/unknown', json={})
    assert invalid.status_code == 400
    assert invalid.json['success'] is False
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('Write failed')):
        failed = client.post(f'{BASE}/from-template/connect-goals', json={})
    assert failed.status_code == 500
    assert failed.json['success'] is False
    with app.app_context():
        assert Dashboard.query.count() == 0
        assert DashboardTemplateInstallation.query.count() == 0


def test_removing_extra_copy_preserves_starter_mapping_and_catalog(client, app):
    """Deleting an extra copy cannot change the starter bookmark or template availability."""
    first = client.post(f'{BASE}/from-template/connect-goals', json={}).json['id']
    extra = client.post(f'{BASE}/from-template/connect-goals', json={}).json['id']
    assert client.post(f'{BASE}/{extra}/delete', json={}).status_code == 200
    assert client.get('/reports/connect-goals').headers['Location'].endswith(f'/{first}')
    page = BeautifulSoup(client.get('/reports/dashboards').data, 'html.parser')
    assert len(page.select('[data-dashboard-template]')) == len(DASHBOARD_TEMPLATES)
    with app.app_context():
        from app.services.dashboard_templates import list_dashboard_templates

        template = list_dashboard_templates()[0]
        assert template['widget_count'] == 4
        assert template['key'] == 'connect-goals'
        assert 'widgets' not in template


def test_templates_are_only_shown_inside_a_dismissible_picker(client):
    """The management list has an explicit opener, not an inline template catalog."""
    page = BeautifulSoup(client.get('/reports/dashboards').data, 'html.parser')
    opener = page.select_one('.db-header [data-sb-dialog="dashboardTemplatePicker"]')
    assert opener.get_text(' ', strip=True) == 'Add from template'
    assert opener['aria-haspopup'] == 'dialog'
    picker = page.select_one('dialog#dashboardTemplatePicker')
    assert not picker.has_attr('open')
    assert picker['data-sb-backdrop-close'] == 'true'
    assert page.find(id=picker['aria-labelledby']).get_text(strip=True) == 'Add from template'
    assert page.find(id=picker['aria-describedby'])
    assert picker.select_one('[data-sb-dialog-close][autofocus]')
    assert picker.select_one('#dashboardTemplateError[role="alert"][tabindex="-1"]')
    assert not page.select('.db-reading [data-dashboard-template], .db-reading .db-template-row')
    assert len(picker.select('[data-dashboard-template="connect-goals"]')) == 1
    assert len(picker.select('[data-dashboard-template="fy27-data-motions"]')) == 1
    assert '4 widgets' in picker.get_text()
    assert '10 widgets' in picker.get_text()
    assert 'Wide' in picker.get_text()
    assert 'Dividers' in picker.get_text()


def test_starter_initialization_rolls_back_partial_installation_and_raises(app):
    """Startup cannot hide a failed install or leave an incomplete starter behind."""
    with app.app_context():
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('Write failed')):
            with pytest.raises(SQLAlchemyError, match='Write failed'):
                initialize_dashboard_templates()
        assert Dashboard.query.count() == 0
        assert DashboardTemplateInstallation.query.count() == 0


def test_data_motions_upgrade_preserves_existing_starter_and_installs_approved_layout(app):
    """Existing installations receive all ten motions without changing their other dashboards."""
    with app.app_context():
        existing = create_dashboard_from_template('connect-goals')
        existing.name = 'My customized goals'
        db.session.add(DashboardTemplateInstallation(
            key='connect-goals', version=1, dashboard=existing,
        ))
        db.session.commit()
        existing_id = existing.id
        initialize_dashboard_templates()
        installed = db.session.get(DashboardTemplateInstallation, 'fy27-data-motions')
        dashboard = installed.dashboard
        assert installed.version == 1
        assert Dashboard.query.count() == 2
        assert db.session.get(Dashboard, existing_id).name == 'My customized goals'
        assert dashboard.name == 'FY27 Data Motions'
        assert dashboard.subtitle == (
            'Track and action your FY27 goals and proactively engage your customers'
        )
        assert dashboard.content_width == 'wide'
        assert dashboard.display_style == 'cards'
        assert dashboard.filter_config == {
            'scope': {'customer_ids': [], 'seller_ids': []},
            'live_filters': ['seller_ids', 'group_by_seller'],
        }
        assert [
            (w.widget_key, w.variant_key, w.layout_column,
             w.layout_row, w.column_span, w.row_span) for w in dashboard.widgets
        ] == [
            ('fabric.modernization', 'detailed', 0, 0, 6, 5),
            ('fabric.acquisition', 'detailed', 6, 0, 6, 5),
            ('fabric.expansion', 'detailed', 0, 5, 6, 5),
            ('fabric.trial_conversion', 'detailed', 6, 5, 6, 5),
            ('ptof.upcoming_renewals', 'detailed', 0, 10, 6, 5),
            ('fabric.rti', 'detailed', 6, 10, 6, 5),
            ('database.whitespace', 'detailed', 0, 15, 6, 5),
            ('database.expansion', 'detailed', 6, 15, 6, 5),
            ('sql.eos', 'detailed', 0, 20, 6, 8),
            ('sql.renewals', 'detailed', 6, 20, 6, 8),
        ]


@pytest.mark.parametrize('scope_location', ['dashboard', 'widget'])
def test_scoped_data_motions_copy_is_not_adopted_as_unrestricted_starter(app, scope_location):
    """A matching layout with personal scope is still a custom dashboard."""
    with app.app_context():
        original = create_dashboard_from_template('fy27-data-motions')
        if scope_location == 'dashboard':
            original.filter_config = {
                'scope': {'seller_ids': [123]},
                'live_filters': ['seller_ids', 'group_by_seller'],
            }
        else:
            original.widgets[0].filters = {'seller_ids': [123]}
        db.session.commit()
        original_id = original.id
        initialize_dashboard_templates()
        installed = db.session.get(DashboardTemplateInstallation, 'fy27-data-motions')
        assert installed.dashboard_id != original_id
        assert Dashboard.query.count() == len(DASHBOARD_TEMPLATES) + 1
        saved = db.session.get(Dashboard, original_id)
        filters = saved.filter_config['scope'] if scope_location == 'dashboard' else (
            saved.widgets[0].filters
        )
        assert filters['seller_ids'] == [123]


def test_data_motions_template_copies_keep_independent_filter_configuration(app):
    """Mutating a copy cannot mutate the template definition or another user's starting layout."""
    with app.app_context():
        first = create_dashboard_from_template('fy27-data-motions')
        second = create_dashboard_from_template('fy27-data-motions')
        first.filter_config['scope']['seller_ids'].append(123)
        first.filter_config['live_filters'].clear()
        assert second.filter_config == DASHBOARD_TEMPLATES['fy27-data-motions']['filter_config']
        assert second.filter_config['scope']['seller_ids'] == []
        assert second.filter_config['live_filters'] == ['seller_ids', 'group_by_seller']


def test_data_motions_can_be_recreated_from_picker_without_resetting_an_existing_copy(client, app):
    """Explicit template copies remain independent and can restore a deleted starter."""
    first = client.post(f'{BASE}/from-template/fy27-data-motions', json={})
    assert first.status_code == 201
    first_id = first.json['id']
    assert client.post(f'{BASE}/{first_id}', json={'name': 'My data priorities'}).status_code == 200
    second = client.post(f'{BASE}/from-template/fy27-data-motions', json={})
    assert second.status_code == 201
    second_id = second.json['id']
    assert first_id != second_id
    with app.app_context():
        assert db.session.get(Dashboard, first_id).name == 'My data priorities'
        copy = db.session.get(Dashboard, second_id)
        assert copy.name == 'FY27 Data Motions'
        assert len(copy.widgets) == 10
        assert get_template_dashboard_url('fy27-data-motions').endswith(f'/{first_id}')
    assert client.post(f'{BASE}/{first_id}/delete', json={}).status_code == 200
    restored = client.post(f'{BASE}/from-template/fy27-data-motions', json={})
    assert restored.status_code == 201
    with app.app_context():
        assert get_template_dashboard_url('fy27-data-motions').endswith(
            f'/{restored.json["id"]}',
        )
        assert len(db.session.get(Dashboard, second_id).widgets) == 10
