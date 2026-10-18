"""Fixed canvas geometry, variants, previews, and atomic saves."""
from copy import deepcopy

from bs4 import BeautifulSoup
import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Dashboard, DashboardWidget, db
from app.services import connect_goals
from app.services.dashboards import LayoutConflict, save_dashboard_layout
from tests.test_dashboards import BASE, add_widget, create_dashboard, layout_payload


def test_adjacent_sizes_holes_and_canvas_width_are_saved_exactly(client, app):
    """Quarter, third, half, and full slots keep explicit rows, including empty space."""
    dashboard_id = create_dashboard(client)
    for _ in range(4):
        add_widget(client, dashboard_id)
    payload = layout_payload(client, dashboard_id)
    for item, (column, row, width) in zip(payload['widgets'], [
        (0, 0, 3), (4, 0, 4), (6, 6, 6), (0, 12, 12),
    ]):
        item.update(
            variant_key='metric', layout_column=column, layout_row=row,
            column_span=width, row_span=4,
        )
    payload['content_width'] = 'standard'
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 200
    with app.app_context():
        db.session.remove()
        dashboard = db.session.get(Dashboard, dashboard_id)
        assert dashboard.content_width == 'standard'
        assert dashboard.layout_revision == payload['revision'] + 1
        assert [(item.layout_column, item.layout_row, item.column_span) for item in
                dashboard.widgets] == [(0, 0, 3), (4, 0, 4), (6, 6, 6), (0, 12, 12)]
    page = BeautifulSoup(
        client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser',
    )
    assert '--db-canvas-width: 1152px' in page.select_one('.db-dashboard')['style']
    assert 'grid-column: 5 / span 4; grid-row: 1 / span 4;' in (
        page.select('.db-widget')[1]['style']
    )


@pytest.mark.parametrize('width,pixels', [('standard', 1152), ('wide', 1344)])
@pytest.mark.parametrize('editing', [False, True])
def test_dashboard_title_canvas_and_editor_use_shared_report_frame(
    client, width, pixels, editing,
):
    """The full-width editor sits above the bounded title and grid, not inside their frame."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    payload = layout_payload(client, dashboard_id)
    payload['content_width'] = width
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 200
    destination = f'/reports/dashboards/{dashboard_id}' + ('/edit' if editing else '')
    page = BeautifulSoup(client.get(destination).data, 'html.parser')
    surface = page.select_one('#main-content > .db-dashboard.sb-directory-frame')
    assert surface
    assert ('sb-directory-frame-wide' in surface['class']) is (width == 'wide')
    assert f'--db-canvas-width: {pixels}px' in surface['style']
    title = surface.select_one(':scope > header.db-header')
    assert title.select_one('#dashboardTitle')
    assert not title.select('a, button, select')
    assert bool(title.select('[data-dashboard-field]')) is editing
    reading = surface.select_one(':scope > #dashboardReading[data-sb-page-body]')
    assert reading.select_one('#dashboardCanvas .db-widget')
    assert '--db-canvas-width' not in reading.select_one('#dashboardCanvas')['style']
    assert reading.select_one('.db-widget')['style'] == (
        'grid-column: 1 / span 12; grid-row: 1 / span 8;'
    )
    toolbar = page.select_one('#main-content > #layoutEditor.db-editor-toolbar')
    assert bool(toolbar) is editing
    assert ('is-editing' in surface['class']) is editing
    assert surface.select_one('#editDashboardLayout') is None
    if editing:
        assert toolbar['aria-label'] == 'Dashboard editor'
        assert toolbar.select_one('#openWidgetLibrary')
        assert not toolbar.has_attr('hidden')
        assert toolbar.select_one('#cancelDashboardLayout').get_text() == 'Discard draft'
        assert toolbar.select_one('#saveDashboardLayout').get_text() == 'Save'
        assert not any(field.has_attr('disabled') for field in title.select('[data-dashboard-field]'))
        assert surface.find_previous_sibling() == toolbar
        assert surface.select_one('#layoutEditor') is None
        row = toolbar.select_one(':scope > .db-editor-command-row')
        assert row.select_one('[aria-label="Canvas tools"] #canvasWidth')
        assert row.select_one('[aria-label="Canvas tools"] #openWidgetLibrary') is None
        assert toolbar.select_one('#widgetInspector > #openWidgetLibrary')
        assert row.select_one('[aria-label="Layout actions"] #saveDashboardLayout')
        assert row.select_one('[aria-label="Layout actions"] #cancelDashboardLayout')
        assert row.select_one('.db-editor-danger-actions [data-db-delete]')
        assert row.select_one('a[href]')['href'] == f'/reports/dashboards/{dashboard_id}'
        assert len(row.select('.is-primary')) == 1
        assert toolbar.select_one('#widgetInspectorFields').has_attr('hidden')
        assert not toolbar.select_one('#widgetInspectorEmpty').has_attr('hidden')
        assert toolbar.select_one('#dashboardLayoutHelp summary')
    else:
        assert not surface.select('#layoutEditor, #widgetLibrary, [data-dashboard-field]')
    assert not surface.select('.db-header button, .db-header select')


@pytest.mark.parametrize('display_style', ['cards', 'dividers'])
@pytest.mark.parametrize('width', ['standard', 'wide'])
def test_display_style_persists_in_report_editor_and_library_without_moving_widgets(
    client, display_style, width,
):
    """Presentation choices share the report frame and widget content, not new layouts."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    add_widget(client, dashboard_id, 'connect_goals.team_coverage')
    before = layout_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload.update(display_style=display_style, content_width=width)
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 200
    saved = layout_payload(client, dashboard_id)
    assert saved['display_style'] == display_style
    assert saved['widgets'] == before['widgets']
    assert saved['revision'] == before['revision'] + 1
    assert client.get(BASE).json['dashboards'][0]['display_style'] == display_style
    for editing in (False, True):
        url = f'/reports/dashboards/{dashboard_id}' + ('/edit' if editing else '')
        page = BeautifulSoup(client.get(url).data, 'html.parser')
        root = page.select_one('#main-content > .db-dashboard.sb-directory-frame')
        assert root['data-display-style'] == display_style
        assert ('sb-directory-frame-wide' in root['class']) is (width == 'wide')
        assert len(root.select('.db-widget-body')) == 2
        assert not page.select('.db-header button, .db-header select')
        if editing:
            select = page.select_one('#layoutEditor #dashboardDisplayStyle')
            assert select.select_one('option[selected]')['value'] == display_style
            assert page.select_one('#widgetPreview')['data-display-style'] == display_style
        else:
            assert page.select_one('#dashboardDisplayStyle') is None


@pytest.mark.parametrize('display_style', ['', 'unknown', None, True, [], {}])
def test_invalid_display_style_is_rejected_before_layout_changes(client, display_style):
    """Invalid display modes cannot partially change geometry, width, or revision."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    before = layout_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload.update(display_style=display_style, content_width='standard')
    payload['widgets'][0]['layout_row'] = 3
    response = client.post(f'{BASE}/{dashboard_id}/layout', json=payload)
    assert response.status_code == 400
    assert 'Cards or Dividers' in response.json['error']
    assert layout_payload(client, dashboard_id) == before


def test_display_choice_rejects_stale_changes_and_survives_older_layout_clients(client):
    """Style shares revision protection, while omitted style leaves the saved choice intact."""
    dashboard_id = create_dashboard(client)
    before = layout_payload(client, dashboard_id)
    assert before['display_style'] == 'cards'
    update = dict(before, display_style='dividers')
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=update).status_code == 200
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=before).status_code == 409
    older = layout_payload(client, dashboard_id)
    older.pop('display_style')
    older['content_width'] = 'standard'
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=older).status_code == 200
    assert client.get(f'{BASE}/{dashboard_id}').json['dashboard']['display_style'] == 'dividers'
    assert client.post(f'{BASE}/{dashboard_id}', json={'subtitle': 'New details'}).status_code == 200
    assert client.get(f'{BASE}/{dashboard_id}').json['dashboard']['display_style'] == 'dividers'


@pytest.mark.parametrize('changes', [
    {'layout_column': -1}, {'layout_column': 1}, {'layout_row': -1},
    {'layout_row': 1000}, {'layout_row': 1.5}, {'column_span': True},
    {'column_span': 5}, {'column_span': 3}, {'row_span': 4},
    {'row_span': 21}, {'row_span': None}, {'variant_key': 'invented'},
])
def test_invalid_geometry_is_rejected_without_partial_changes(client, changes):
    """Reject overflow, unsupported footprints, booleans, fractions, and invalid variants."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    before = layout_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload['widgets'][0].update(changes)
    response = client.post(f'{BASE}/{dashboard_id}/layout', json=payload)
    assert response.status_code == 400
    assert response.json['success'] is False
    assert layout_payload(client, dashboard_id) == before


def test_overlap_and_foreign_or_duplicate_instances_are_rejected_atomically(client):
    """A complete layout must contain only its own widgets once, without intersections."""
    dashboard_id = create_dashboard(client)
    for _ in range(2):
        add_widget(client, dashboard_id)
    other = create_dashboard(client, 'Other')
    foreign_id = add_widget(client, other)
    before = layout_payload(client, dashboard_id)
    for mutation in ('overlap', 'missing', 'duplicate', 'foreign'):
        payload = deepcopy(before)
        if mutation == 'overlap':
            payload['widgets'][1]['layout_row'] = 1
        elif mutation == 'missing':
            payload['widgets'].pop()
        elif mutation == 'duplicate':
            payload['widgets'][1] = deepcopy(payload['widgets'][0])
        else:
            payload['widgets'][1]['id'] = foreign_id
        assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 400
        assert layout_payload(client, dashboard_id) == before


def test_stale_draft_cannot_overwrite_newer_layout_or_widget_addition(client):
    """Revision checking covers both layout writes and changes to membership."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    stale = layout_payload(client, dashboard_id)
    updated = deepcopy(stale)
    updated['widgets'][0]['layout_row'] = 3
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=updated).status_code == 200
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=stale).status_code == 409
    stale = layout_payload(client, dashboard_id)
    add_widget(client, dashboard_id)
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=stale).status_code == 409
    assert client.get(f'{BASE}/{dashboard_id}').json['dashboard']['widgets'][0]['layout_row'] == 3


def test_concurrent_write_after_loading_dashboard_cannot_overwrite_layout(client, app):
    """The conditional update also rejects a race after the initial revision check."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    payload = layout_payload(client, dashboard_id)
    payload['content_width'] = 'standard'
    payload['display_style'] = 'dividers'
    payload['widgets'][0]['layout_row'] = 5
    with app.app_context():
        dashboard = db.session.get(Dashboard, dashboard_id)
        list(dashboard.widgets)
        with Session(db.engine) as competing_session:
            competing_session.execute(db.update(Dashboard).where(
                Dashboard.id == dashboard_id,
            ).values(layout_revision=dashboard.layout_revision + 1))
            competing_session.commit()
        with pytest.raises(LayoutConflict):
            save_dashboard_layout(dashboard, payload)
        db.session.rollback()
        assert dashboard.content_width == 'wide'
        assert dashboard.display_style == 'cards'
        assert dashboard.widgets[0].layout_row == 0
        assert dashboard.layout_revision == payload['revision'] + 1


def test_layout_write_failure_before_commit_is_visible_and_rolled_back(client, monkeypatch):
    """Database errors during revision acquisition preserve the saved layout."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    before = layout_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload['display_style'] = 'dividers'
    payload['widgets'][0]['layout_row'] = 5

    def fail_revision(*args):
        """Simulate a database failure before the commit helper is reached."""
        raise SQLAlchemyError('Database write failed')

    monkeypatch.setattr('app.services.dashboards.advance_layout_revision', fail_revision)
    response = client.post(f'{BASE}/{dashboard_id}/layout', json=payload)
    assert response.status_code == 500
    assert response.json['success'] is False
    assert 'could not be saved' in response.json['error']
    assert layout_payload(client, dashboard_id) == before


def test_display_and_geometry_roll_back_together_if_commit_fails(client, monkeypatch):
    """A commit failure cannot leave presentation or positions partially saved."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    before = layout_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload.update(display_style='dividers', content_width='standard')
    payload['widgets'][0]['layout_row'] = 3

    def fail_commit() -> None:
        """Simulate a failure after all validated layout values have been assigned."""
        raise SQLAlchemyError('Dashboard commit failed')

    with monkeypatch.context() as scoped:
        scoped.setattr(db.session, 'commit', fail_commit)
        response = client.post(f'{BASE}/{dashboard_id}/layout', json=payload)
    assert response.status_code == 500
    assert response.json['success'] is False
    assert layout_payload(client, dashboard_id) == before


def test_new_widgets_append_below_and_removal_does_not_compact_holes(client):
    """Membership changes never change the geometry of any existing instance."""
    dashboard_id = create_dashboard(client)
    first = add_widget(client, dashboard_id)
    second = add_widget(client, dashboard_id)
    payload = layout_payload(client, dashboard_id)
    payload['widgets'][1]['layout_row'] = 20
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 200
    assert client.post(f'{BASE}/{dashboard_id}/widgets/{first}/remove').status_code == 200
    third = add_widget(client, dashboard_id)
    items = client.get(f'{BASE}/{dashboard_id}').json['dashboard']['widgets']
    assert [(item['id'], item['layout_row']) for item in items] == [(second, 20), (third, 28)]


def test_preview_and_placed_metric_use_same_renderer_without_a_write(client, monkeypatch):
    """The library uses shared live providers, with no sample figures or new placements."""
    monkeypatch.setattr(
        connect_goals, 'get_setup_state', lambda reference=None: {'ready': True},
    )
    response = client.get(
        f'{BASE}/widget-preview?key=connect_goals.team_coverage&variant=metric&width=3',
    )
    assert response.status_code == 200
    preview = BeautifulSoup(response.json['html'], 'html.parser')
    assert preview.select_one('.db-metric')
    assert preview.select_one('[data-goals-coverage]')
    dashboard_id = create_dashboard(client)
    assert client.post(f'{BASE}/{dashboard_id}/widgets', json={
        'key': 'connect_goals.team_coverage', 'variant_key': 'metric',
        'column_span': 3, 'row_span': 4,
    }).status_code == 200
    page = BeautifulSoup(client.get(f'/reports/dashboards/{dashboard_id}').data, 'html.parser')
    assert page.select_one('.db-metric').get_text(' ', strip=True) == (
        preview.select_one('.db-metric').get_text(' ', strip=True)
    )
    assert len(client.get(f'{BASE}/{dashboard_id}').json['dashboard']['widgets']) == 1
    assert page.select_one('.db-widget')['data-column-span'] == '3'


@pytest.mark.parametrize('query', [
    'key=not-real&variant=metric&width=3',
    'key=connect_goals.u2c&variant=detailed&width=3',
    'key=connect_goals.u2c&variant=metric&width=2',
    'key=connect_goals.u2c&variant=metric&width=3.5',
    'key=connect_goals.u2c&variant=invalid&width=12',
])
def test_preview_rejects_unsupported_combinations(client, query):
    """Preview selection obeys the same support matrix as saved widgets."""
    response = client.get(f'{BASE}/widget-preview?{query}')
    assert response.status_code == 400
    assert response.json['success'] is False


def test_empty_dashboard_can_save_canvas_width_and_bad_widths_are_explicit(client):
    """Canvas preferences persist even before the first widget is added."""
    dashboard_id = create_dashboard(client)
    payload = layout_payload(client, dashboard_id)
    payload['content_width'] = 'fluid'
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 400
    payload['content_width'] = 'standard'
    assert client.post(f'{BASE}/{dashboard_id}/layout', json=payload).status_code == 200
    assert client.get(f'{BASE}/{dashboard_id}').json['dashboard']['canvas_width'] == 1152
