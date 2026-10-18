"""Tests for saved dashboards, widget reuse, and report-backed rendering."""
from dataclasses import replace
from datetime import date
from unittest.mock import Mock, patch

from bs4 import BeautifulSoup
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models import Dashboard, DashboardWidget, db
from app.services import connect_goals, dashboards
from app.services.salesiq_tools import execute_tool

BASE = '/api/reports/dashboards'


def create_dashboard(client, name: str = 'Manager 1:1') -> int:
    """Create a saved dashboard through the public write surface."""
    response = client.post(BASE, json={'name': name})
    assert response.status_code == 201
    return response.json['id']


def add_widget(client, dashboard_id: int, key: str = 'connect_goals.u2c') -> int:
    """Append a widget and read its persisted identity."""
    response = client.post(f'{BASE}/{dashboard_id}/widgets', json={'key': key})
    assert response.status_code == 200
    return client.get(f'{BASE}/{dashboard_id}').json['dashboard']['widgets'][-1]['id']


def layout_payload(client, dashboard_id: int) -> dict:
    """Read the complete geometry and revision used for atomic layout edits."""
    data = client.get(f'{BASE}/{dashboard_id}').json['dashboard']
    return {
        'revision': data['layout_revision'], 'content_width': data['content_width'],
        'display_style': data['display_style'],
        'widgets': [{
            key: item[key] for key in (
                'id', 'variant_key', 'layout_column', 'layout_row', 'column_span', 'row_span',
            )
        } for item in data['widgets']],
    }


def test_empty_hub_and_catalog(client):
    """An empty dashboard library explains how to start, without creating sample data."""
    response = client.get('/reports/dashboards')
    assert response.status_code == 200
    assert b'Create dashboard' in response.data
    page = BeautifulSoup(response.data, 'html.parser')
    empty = page.select_one('.db-empty')
    assert empty.select_one('h2').get_text() == (
        'Track the parts of your business you care about.'
    )
    assert ' '.join(empty.get_text(' ', strip=True).split()) == (
        'Track the parts of your business you care about. '
        'Create a dashboard, then add widgets from the library to bring your '
        'metrics and reports together.'
    )
    payload = client.get(BASE).json
    assert payload['dashboards'] == []
    assert [item['key'] for item in payload['catalog']] == list(dashboards.WIDGET_DEFINITIONS)
    assert len(payload['catalog']) == 10


def test_create_rename_multiple_dashboards_and_reload(client, app):
    """Names and independent widget placements survive new database sessions."""
    first = create_dashboard(client, '  Manager 1:1  ')
    second = create_dashboard(client, 'Proactive sales')
    add_widget(client, first)
    add_widget(client, second, 'connect_goals.hva_coverage')
    assert client.post(f'{BASE}/{first}', json={'name': 'Weekly review'}).status_code == 200
    with app.app_context():
        db.session.remove()
        saved = db.session.get(Dashboard, first)
        assert saved.name == 'Weekly review'
        assert saved.created_at is not None and saved.updated_at is not None
        assert [widget.widget_key for widget in saved.widgets] == ['connect_goals.u2c']
        assert db.session.get(Dashboard, second).widgets[0].widget_key == (
            'connect_goals.hva_coverage'
        )
        db.create_all()
        db.create_all()
        assert db.session.get(Dashboard, first).name == 'Weekly review'
    assert len(client.get(BASE).json['dashboards']) == 2


@pytest.mark.parametrize('payload', [
    None, [], {'name': ''}, {'name': ' '}, {'name': 123}, {'name': 'a' * 201},
])
def test_invalid_names_are_rejected_without_writes(client, payload):
    """Malformed and empty names cannot become persisted dashboards."""
    response = client.post(BASE, json=payload)
    assert response.status_code == 400
    assert response.json['success'] is False
    assert '1 to 200' in response.json['error']
    assert client.get(BASE).json['dashboards'] == []


def test_name_is_escaped_and_exact_limit_is_allowed(client):
    """Titles remain text, and the documented length boundary is accepted."""
    dashboard_id = create_dashboard(client, '<img src=x onerror=alert(1)>')
    page = BeautifulSoup(client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser')
    assert page.select_one('#dashboardTitle').get_text() == '<img src=x onerror=alert(1)>'
    assert page.select_one('#dashboardTitle img') is None
    menu_link = page.select_one(f'#dashboardsMenu a[href="/reports/dashboards/{dashboard_id}"]')
    assert menu_link.get_text(strip=True) == '<img src=x onerror=alert(1)>'
    assert menu_link.select_one('img') is None
    assert client.post(f'{BASE}/{dashboard_id}', json={'name': 'a' * 200}).status_code == 200


def test_fixed_positions_remove_duplicates_and_cross_dashboard_ownership(client, app):
    """Instances have independent identities and only their own dashboard can change them."""
    first = create_dashboard(client)
    second = create_dashboard(client, 'Seller 1:1')
    one = add_widget(client, first)
    two = add_widget(client, first)
    assert one != two
    layout = layout_payload(client, first)
    layout['widgets'][0].update(layout_row=8, layout_column=6, column_span=6)
    layout['widgets'][1].update(layout_row=0, column_span=6)
    assert client.post(f'{BASE}/{first}/layout', json=layout).status_code == 200
    widgets = client.get(f'{BASE}/{first}').json['dashboard']['widgets']
    assert [widget['id'] for widget in widgets] == [two, one]
    assert [widget['layout_row'] for widget in widgets] == [0, 8]
    assert client.post(f'{BASE}/{second}/widgets/{one}/remove').status_code == 404
    assert client.post(f'{BASE}/{first}/widgets/{two}/remove').status_code == 200
    assert client.post(f'{BASE}/{first}/delete').status_code == 200
    with app.app_context():
        assert db.session.get(DashboardWidget, one) is None
        assert db.session.get(DashboardWidget, two) is None
        assert db.session.get(Dashboard, second) is not None
    assert client.get(f'/reports/dashboards/{first}').status_code == 404


def test_invalid_widget_actions_do_not_change_layout(client):
    """Reject unknown definitions, malformed directions, and moves beyond either edge."""
    dashboard_id = create_dashboard(client)
    for payload in (None, [], {'key': ['u2c']}, {'key': 'not-a-widget'}):
        assert client.post(f'{BASE}/{dashboard_id}/widgets', json=payload).status_code == 400
    instance = add_widget(client, dashboard_id)
    for direction in ('up', 'down', 'sideways', None, []):
        response = client.post(
            f'{BASE}/{dashboard_id}/widgets/{instance}/move', json={'direction': direction},
        )
        assert response.status_code == 400
        assert response.json['success'] is False
    assert client.post(f'{BASE}/{dashboard_id}/widgets/{instance}/unknown').status_code == 400
    assert len(client.get(f'{BASE}/{dashboard_id}').json['dashboard']['widgets']) == 1


def test_setup_gate_is_shared_and_blocks_calculations(client, monkeypatch):
    """Unconfirmed priorities show a useful setup path rather than fabricated values."""
    dashboard_id = create_dashboard(client)
    provider = Mock(side_effect=AssertionError('A gated widget must not calculate'))
    definition = dashboards.WIDGET_DEFINITIONS['connect_goals.u2c']
    monkeypatch.setitem(
        dashboards.WIDGET_DEFINITIONS, definition.key, replace(definition, provider=provider),
    )
    add_widget(client, dashboard_id)
    response = client.get(f'/reports/dashboards/{dashboard_id}')
    assert response.status_code == 200
    assert b'Confirm your FY27 compensation buckets' in response.data
    assert b'Select compensation buckets' in response.data
    assert b'Open Connect Goals setup' not in response.data
    assert b'<canvas' not in response.data
    provider.assert_not_called()


def test_widgets_reuse_shared_calculations_once_per_definition(app, monkeypatch):
    """Repeated instances use the existing calculation and share one result per read."""
    reference = date(2026, 10, 16)
    monkeypatch.setattr(connect_goals, 'get_setup_state', lambda reference=None: {'ready': True})
    with app.app_context():
        dashboard = Dashboard(name='Goals')
        db.session.add(dashboard)
        for key in dashboards.WIDGET_DEFINITIONS:
            dashboards.add_dashboard_widget(dashboard, key)
        dashboards.add_dashboard_widget(dashboard, 'connect_goals.team_coverage')
        db.session.commit()
        original = dashboards.WIDGET_DEFINITIONS['connect_goals.team_coverage']
        provider = Mock(wraps=original.provider)
        monkeypatch.setitem(
            dashboards.WIDGET_DEFINITIONS, original.key, replace(original, provider=provider),
        )
        data = dashboards.get_dashboard_data(dashboard, reference)
        expected = [
            connect_goals.get_u2c_widget(reference),
            connect_goals.get_team_coverage_widget(reference),
            connect_goals.get_hva_coverage_widget(reference),
            connect_goals.get_whitespace_widget(reference),
        ]
        assert [widget['data'] for widget in data['widgets'][:4]] == expected
        assert data['widgets'][1]['data'] == data['widgets'][-1]['data']
        provider.assert_called_once_with(reference)


def test_duplicate_widget_markup_has_unique_ids_and_scoped_actions(client, monkeypatch):
    """Reusable fragments remain valid when the same widget is placed more than once."""
    monkeypatch.setattr(
        connect_goals, 'get_setup_state', lambda reference=None: {'ready': True},
    )
    dashboard_id = create_dashboard(client)
    for _ in range(2):
        add_widget(client, dashboard_id, 'connect_goals.team_coverage')
    page = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}/edit').data, 'html.parser',
    )
    ids = [element['id'] for element in page.select('.sb-dashboards [id]')]
    assert len(ids) == len(set(ids))
    assert len(page.select('.db-widget')) == 2
    assert len(page.select('.db-widget .sb-goals-section')) == 2
    assert len(page.select('.db-widget script[type="application/json"]')) == 2
    assert len(page.select('[data-drag-handle]')) == 2
    assert len(page.select('[data-resize-handle]')) == 2
    assert page.select_one('dialog#widgetLibrary')
    assert page.select_one('#widgetCatalog') is None
    assert [node.get_text(strip=True).lstrip('>') for node in
            page.select('.sb-context-bar li')] == [
                'Home', 'Manage Dashboards', 'Edit Manager 1:1',
            ]


def test_report_view_has_no_management_markup_and_keeps_widget_content(client, monkeypatch):
    """A dashboard destination is a report, not an editor with hidden commands."""
    monkeypatch.setattr(connect_goals, 'get_setup_state', lambda reference=None: {'ready': True})
    dashboard_id = create_dashboard(client)
    assert client.post(f'{BASE}/{dashboard_id}/widgets', json={
        'key': 'connect_goals.team_coverage', 'variant_key': 'metric', 'column_span': 6,
    }).status_code == 200
    report = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser',
    )
    editor = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}/edit').data, 'html.parser',
    )
    assert report.select_one('#dashboardTitle').get_text() == 'Manager 1:1'
    assert report.select_one('#dashboardCanvas .db-widget')
    assert report.select_one('#dashboardCanvas [data-goals-coverage]')
    for selector in (
        '#openWidgetLibrary', '[data-dashboard-field]',
        '#layoutEditor', '#widgetInspector', '#widgetLibrary', '#dashboardConfig',
        '#previewDashboardDraft', '#exitDashboardDraftPreview', '#dashboardDraftPreviewBar',
        '#undoDashboardEdit', '#redoDashboardEdit',
        '#dashboardPreviewName', '#dashboardPreviewSubtitle',
        '.db-widget[data-drag-handle]', '[data-resize-handle]',
    ):
        assert report.select_one(selector) is None
        assert editor.select_one(selector) is not None
    assert editor.select_one('#dashboardDraftPreviewBar').has_attr('hidden')
    assert editor.select_one('#dashboardDraftPreviewBar').parent['id'] == 'layoutEditor'
    assert editor.select_one('#dashboardPreviewName').has_attr('hidden')
    assert editor.select_one('#dashboardPreviewSubtitle').has_attr('hidden')
    assert editor.select_one('#previewDashboardDraft')['type'] == 'button'
    assert editor.select_one('#undoDashboardEdit').has_attr('disabled')
    assert editor.select_one('#redoDashboardEdit').has_attr('disabled')
    assert editor.select_one('#undoDashboardEdit')['aria-keyshortcuts'] == 'Control+Z'
    add_button = editor.select_one('#openWidgetLibrary')
    assert add_button.parent['id'] == 'widgetInspector'
    assert 'is-primary' in add_button['class']
    assert len(editor.select('#openWidgetLibrary')) == 1
    assert editor.select_one('#widgetInspectorFields #openWidgetLibrary') is None
    assert editor.select_one('.db-editor-canvas-tools #openWidgetLibrary') is None
    widget = editor.select_one('.db-widget')
    assert widget['tabindex'] == '0'
    assert widget['aria-describedby'] == 'dashboardLayoutHelp'
    assert widget.select_one(':scope > header') is None
    assert len(widget.select(':scope > button')) == 1
    assert widget.select_one('button[data-resize-handle]')
    scripts = [script['src'] for script in report.select('script[src]')]
    assert any('ui-dashboard-dividers.js' in src for src in scripts)
    editor_scripts = [script['src'].split('?')[0] for script in editor.select('script[src]')]
    assert editor_scripts.index('/static/js/ui-dashboard-dividers.js') < (
        editor_scripts.index('/static/js/ui-dashboard-layout.js')
    )
    assert not any('ui-dashboard-layout.js' in src or 'ui-dashboard-library.js' in src
                   for src in scripts)
    assert report.select_one('.db-widget-body').get_text(' ', strip=True) == (
        editor.select_one('.db-widget-body').get_text(' ', strip=True)
    )
    assert report.select_one('.db-widget')['style'] == editor.select_one('.db-widget')['style']
    assert editor.select_one('#dashboardSettings') is None
    assert editor.select_one('[data-dashboard-rename]') is None
    assert [node.get_text(strip=True).lstrip('>') for node in
            report.select('.sb-context-bar li')] == ['Home', 'Manager 1:1']


def test_management_hub_has_separate_view_and_edit_destinations(client):
    """Management lists explicit report and editor links, including empty dashboards."""
    dashboard_id = create_dashboard(client)
    hub = BeautifulSoup(client.get('/reports/dashboards').data, 'html.parser')
    assert hub.select_one('h1').get_text() == 'Manage Dashboards'
    assert hub.select_one('[data-dashboard-create] input[name="subtitle"]')
    assert not hub.select_one('input[name="subtitle"]').has_attr('required')
    row = hub.select_one('.db-list-row')
    assert {link['href'] for link in row.select('a[href]')} == {
        f'/reports/dashboards/{dashboard_id}', f'/reports/dashboards/{dashboard_id}/edit',
    }
    delete_button = row.select_one('button[data-db-delete]')
    assert delete_button['data-db-delete'] == str(dashboard_id)
    assert delete_button['data-dashboard-name'] == 'Manager 1:1'
    assert delete_button['aria-label'] == 'Delete Manager 1:1'
    assert delete_button.get_text(strip=True) == 'Delete'
    report = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser',
    )
    assert 'No widgets yet.' in report.select_one('main').get_text()
    assert report.select_one('[data-sb-dialog="widgetLibrary"]') is None
    assert client.get(f'/reports/dashboards/{dashboard_id + 1000}/edit').status_code == 404


def test_inline_dashboard_details_preserve_layout_and_support_optional_subtitle(client):
    """The partial metadata API preserves other fields and existing widget geometry."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    original_layout = layout_payload(client, dashboard_id)
    assert client.get(f'{BASE}/{dashboard_id}').json['dashboard']['subtitle'] == ''
    response = client.post(f'{BASE}/{dashboard_id}', json={'subtitle': '  Business priorities  '})
    assert response.status_code == 200
    assert response.json['name'] == 'Manager 1:1'
    assert response.json['subtitle'] == 'Business priorities'
    response = client.post(f'{BASE}/{dashboard_id}', json={'name': '  Seller view  '})
    assert response.json['name'] == 'Seller view'
    assert response.json['subtitle'] == 'Business priorities'
    assert layout_payload(client, dashboard_id) == original_layout
    editor = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}/edit').data, 'html.parser',
    )
    assert editor.select_one('h1 input[name="name"]')['value'] == 'Seller view'
    assert editor.select_one('header input[name="subtitle"]')['value'] == 'Business priorities'
    assert not editor.select_one('input[name="subtitle"]').has_attr('required')
    assert editor.select_one('.db-editor-toolbar [data-db-delete]')
    assert 'View dashboard' in editor.select_one('.db-editor-toolbar').get_text()
    report = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser',
    )
    assert report.select_one('.db-subtitle').get_text() == 'Business priorities'
    assert not report.select('[data-dashboard-field], [data-db-delete]')
    assert client.post(f'{BASE}/{dashboard_id}', json={'subtitle': '  '}).status_code == 200
    report = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser',
    )
    assert report.select_one('.db-subtitle') is None


@pytest.mark.parametrize('subtitle', [None, 123, [], 'x' * 501])
def test_invalid_subtitle_does_not_partially_create_or_update_dashboard(client, subtitle):
    """Invalid descriptions cannot create a row or partially apply a simultaneous rename."""
    payload = {'name': 'New name', 'subtitle': subtitle}
    assert client.post(BASE, json=payload).status_code == 400
    assert client.get(BASE).json['dashboards'] == []
    dashboard_id = create_dashboard(client)
    assert client.post(f'{BASE}/{dashboard_id}', json=payload).status_code == 400
    saved = client.get(f'{BASE}/{dashboard_id}').json['dashboard']
    assert saved['name'] == 'Manager 1:1'
    assert saved['subtitle'] == ''


def test_subtitle_creation_length_limit_escaping_and_empty_updates(client):
    """Subtitles are optional text on creation, summaries, and report headers."""
    response = client.post(BASE, json={'name': 'My dashboard', 'subtitle': '<img src=x>'})
    assert response.status_code == 201
    dashboard_id = response.json['id']
    for url, selector in (
        (f'/reports/dashboards/{dashboard_id}', '.db-subtitle'),
        ('/reports/dashboards', '.db-list-title p'),
    ):
        page = BeautifulSoup(client.get(url).data, 'html.parser')
        assert page.select_one(selector).get_text() == '<img src=x>'
        assert page.select_one(f'{selector} img') is None
    assert client.get(BASE).json['dashboards'][0]['subtitle'] == '<img src=x>'
    assert client.post(f'{BASE}/{dashboard_id}', json={'subtitle': 'x' * 500}).status_code == 200
    for payload in ({}, [], {'unrecognized': 'value'}, {'name': ''}):
        assert client.post(f'{BASE}/{dashboard_id}', json=payload).status_code == 400
    assert client.get(f'{BASE}/{dashboard_id}').json['dashboard']['subtitle'] == 'x' * 500


def test_unknown_saved_widget_has_explicit_recoverable_state(client, app, caplog):
    """A removed definition leaves its saved placement visible and removable."""
    dashboard_id = create_dashboard(client)
    with app.app_context():
        db.session.add(DashboardWidget(
            dashboard_id=dashboard_id, widget_key='retired.widget', sort_order=0,
        ))
        db.session.commit()
    page = client.get(f'/reports/dashboards/{dashboard_id}')
    assert page.status_code == 200
    assert b'This widget is no longer in the catalog' in page.data
    assert b'id="removeSelectedWidget"' not in page.data
    editor = client.get(f'/reports/dashboards/{dashboard_id}/edit')
    assert b'id="removeSelectedWidget"' in editor.data
    assert 'retired.widget' in caplog.text


def test_database_failure_rolls_back_and_returns_error(client, app):
    """A failed save is not acknowledged as success or partially persisted."""
    dashboard_id = create_dashboard(client)
    with app.app_context():
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('write failed')):
            response = client.post(f'{BASE}/{dashboard_id}', json={'name': 'Not saved'})
        assert response.status_code == 500
        assert response.json['success'] is False
        assert db.session.get(Dashboard, dashboard_id).name == 'Manager 1:1'


def test_read_tool_uses_shared_dashboard_data(client, app):
    """SalesIQ sees saved layouts, setup state, and the same instance identities."""
    dashboard_id = create_dashboard(client)
    widget_id = add_widget(client, dashboard_id)
    with app.app_context():
        listing = execute_tool('get_dashboards', {})
        result = execute_tool('get_dashboards', {'dashboard_id': dashboard_id})
        assert listing['dashboards'][0]['id'] == dashboard_id
        assert len(listing['catalog']) == 10
        assert result['widgets'][0]['id'] == widget_id
        assert result['setup']['ready'] is False
        assert result['url'].endswith(f'/reports/dashboards/{dashboard_id}')
        with pytest.raises(ValueError, match='not found'):
            execute_tool('get_dashboards', {'dashboard_id': dashboard_id + 1000})


def test_get_cannot_modify_dashboard(client):
    """All layout mutations are POST-only."""
    dashboard_id = create_dashboard(client)
    assert client.get(f'{BASE}/{dashboard_id}/delete').status_code == 405
    assert client.get(f'{BASE}/{dashboard_id}/widgets').status_code == 405
    assert len(client.get(BASE).json['dashboards']) == 1
