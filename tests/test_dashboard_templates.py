"""Starter dashboard installation, user ownership, and explicit template recreation."""
from unittest.mock import Mock, patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Dashboard, DashboardTemplateInstallation, db
from app.services.dashboard_templates import (
    DASHBOARD_TEMPLATES, create_dashboard_from_template, initialize_dashboard_templates,
)
from tests.test_dashboards import BASE


def test_starter_is_installed_once_without_calculating_metrics(app, monkeypatch):
    """Startup creates ordinary editable placements, independently of annual setup."""
    from app.services import connect_goals

    provider = Mock(side_effect=AssertionError('Startup must not calculate widget values'))
    monkeypatch.setattr(connect_goals, 'get_setup_state', provider)
    with app.app_context():
        initialize_dashboard_templates()
        first = Dashboard.query.one()
        first_id = first.id
        installation = db.session.get(DashboardTemplateInstallation, 'connect-goals')
        assert installation.dashboard_id == first_id
        assert installation.version == 1
        assert first.name == 'Connect Goals'
        assert first.content_width == 'wide'
        assert first.display_style == 'dividers'
        assert [
            (w.widget_key, w.variant_key, w.layout_column,
             w.layout_row, w.column_span, w.row_span) for w in first.widgets
        ] == list(DASHBOARD_TEMPLATES['connect-goals']['widgets'])
        first.name = 'My priorities'
        first.subtitle = 'Keep my edits'
        first.widgets[0].row_span = 6
        db.session.commit()
        initialize_dashboard_templates()
        db.session.remove()
        assert Dashboard.query.count() == 1
        saved = db.session.get(Dashboard, first_id)
        assert saved.name == 'My priorities'
        assert saved.subtitle == 'Keep my edits'
        assert saved.widgets[0].row_span == 6
    provider.assert_not_called()


def test_exact_existing_prerelease_dashboard_is_adopted_without_touching_it(app):
    """The creator's manually finished layout is reused, not duplicated or rewritten."""
    with app.app_context():
        original = create_dashboard_from_template('connect-goals')
        original.layout_revision = 8
        db.session.commit()
        before = (original.id, original.updated_at, [widget.id for widget in original.widgets])
        initialize_dashboard_templates()
        assert Dashboard.query.count() == 1
        installation = db.session.get(DashboardTemplateInstallation, 'connect-goals')
        assert installation.dashboard_id == before[0]
        assert original.updated_at == before[1]
        assert original.layout_revision == 8
        assert [widget.id for widget in original.widgets] == before[2]


def test_similarly_named_custom_dashboard_is_never_overwritten(app):
    """Only an exact copy is adopted; a name alone is not template identity."""
    with app.app_context():
        original = Dashboard(name='Connect Goals', subtitle='My custom view')
        db.session.add(original)
        db.session.commit()
        original_id = original.id
        initialize_dashboard_templates()
        assert Dashboard.query.count() == 2
        assert db.session.get(Dashboard, original_id).subtitle == 'My custom view'
        assert db.session.get(
            DashboardTemplateInstallation, 'connect-goals',
        ).dashboard_id != original_id


def test_deleted_starter_stays_deleted_after_reinitialization_and_reads(client, app):
    """A persistent marker survives deletion and prevents surprise recreation."""
    with app.app_context():
        initialize_dashboard_templates()
        starter_id = Dashboard.query.one().id
    assert client.post(f'{BASE}/{starter_id}/delete', json={}).status_code == 200
    with app.app_context():
        db.session.remove()
        assert db.session.get(DashboardTemplateInstallation, 'connect-goals').dashboard_id is None
        initialize_dashboard_templates()
        assert Dashboard.query.count() == 0
    response = client.get('/reports/connect-goals')
    assert response.status_code == 302
    assert response.headers['Location'] == '/reports/dashboards?template=connect-goals'
    hub = BeautifulSoup(client.get(response.headers['Location']).data, 'html.parser')
    assert hub.select_one('.db-template-notice')
    assert hub.select_one('[data-dashboard-template="connect-goals"]')
    with app.app_context():
        assert Dashboard.query.count() == 0


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
    assert len(page.select('[data-dashboard-template]')) == 1
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
    assert '4 widgets' in picker.get_text()
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
