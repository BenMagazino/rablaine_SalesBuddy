"""Tests for publishing complete browser drafts without partially changing dashboards."""
from copy import deepcopy

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Dashboard, db
from app.services import connect_goals, dashboards
from tests.test_dashboards import BASE, add_widget, create_dashboard


def draft_payload(client, dashboard_id: int) -> dict:
    """Read the saved baseline and complete draft configuration."""
    data = client.get(f'{BASE}/{dashboard_id}').json['dashboard']
    return {
        'revision': data['layout_revision'],
        'base_name': data['name'], 'base_subtitle': data['subtitle'],
        'name': data['name'], 'subtitle': data['subtitle'],
        'content_width': data['content_width'], 'display_style': data['display_style'],
        'widgets': [{key: item[key] for key in (
            'id', 'key', 'variant_key', 'layout_column', 'layout_row', 'column_span', 'row_span',
        )} for item in data['widgets']],
    }


def test_save_publishes_details_membership_and_fixed_geometry_in_one_revision(client):
    """Draft-only additions get real IDs; removed widgets disappear only on publish."""
    dashboard_id = create_dashboard(client)
    removed = add_widget(client, dashboard_id)
    retained = add_widget(client, dashboard_id, 'connect_goals.team_coverage')
    before = draft_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload.update(name='Published', subtitle='My business', display_style='dividers',
                   content_width='standard')
    payload['widgets'] = [payload['widgets'][1], {
        'id': -1, 'key': 'connect_goals.u2c', 'variant_key': 'metric',
        'layout_column': 3, 'layout_row': 0, 'column_span': 3, 'row_span': 4,
    }]
    response = client.post(f'{BASE}/{dashboard_id}/save', json=payload)
    assert response.status_code == 200
    assert response.json['name'] == 'Published'
    saved = draft_payload(client, dashboard_id)
    assert saved['revision'] == before['revision'] + 1
    assert saved['name'] == 'Published' and saved['subtitle'] == 'My business'
    assert saved['display_style'] == 'dividers' and saved['content_width'] == 'standard'
    saved_by_id = {item['id']: item for item in saved['widgets']}
    assert saved_by_id[retained] == before['widgets'][1]
    ids = [item['id'] for item in saved['widgets']]
    assert retained in ids and removed not in ids and all(item > 0 for item in ids)
    added = next(item for item in saved['widgets'] if item['id'] != retained)
    assert added['layout_column'] == 3
    assert added['column_span'] == 3


@pytest.mark.parametrize('mutation', [
    'name', 'subtitle', 'width', 'style', 'foreign', 'duplicate', 'key', 'variant',
    'overlap', 'zero', 'boolean', 'height', 'position', 'missing-key',
])
def test_invalid_draft_cannot_partially_publish_any_changes(client, mutation):
    """All supplied values are validated before metadata or membership changes."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    before = draft_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload.update(name='Do not publish', subtitle='Do not publish')
    entry = payload['widgets'][0]
    if mutation == 'name':
        payload['name'] = ' '
    elif mutation == 'subtitle':
        payload['subtitle'] = None
    elif mutation == 'width':
        payload['content_width'] = 'invalid'
    elif mutation == 'style':
        payload['display_style'] = None
    elif mutation == 'foreign':
        other = create_dashboard(client, 'Other')
        entry['id'] = add_widget(client, other)
    elif mutation == 'duplicate':
        payload['widgets'].append(deepcopy(entry))
    elif mutation == 'key':
        entry['key'] = 'connect_goals.team_coverage'
    elif mutation == 'variant':
        entry['variant_key'] = 'unknown'
    elif mutation == 'overlap':
        payload['widgets'].append(dict(entry, id=-1))
    elif mutation == 'zero':
        entry['id'] = 0
    elif mutation == 'boolean':
        entry['id'] = True
    elif mutation == 'height':
        entry['row_span'] = 100
    elif mutation == 'position':
        entry['layout_column'] = -1
    else:
        entry['id'] = -1
        entry.pop('key')
    response = client.post(f'{BASE}/{dashboard_id}/save', json=payload)
    assert response.status_code == 400
    assert response.json['success'] is False
    assert draft_payload(client, dashboard_id) == before


@pytest.mark.parametrize('changed', ['name', 'layout'])
def test_stale_drafts_cannot_overwrite_newer_details_or_layout(client, changed):
    """Older metadata clients and newer complete saves both protect in-flight drafts."""
    dashboard_id = create_dashboard(client)
    payload = draft_payload(client, dashboard_id)
    payload['subtitle'] = 'Stale draft'
    if changed == 'name':
        client.post(f'{BASE}/{dashboard_id}', json={'name': 'Other window'})
    else:
        newer = dict(payload, name='Other window')
        assert client.post(f'{BASE}/{dashboard_id}/save', json=newer).status_code == 200
    current = draft_payload(client, dashboard_id)
    response = client.post(f'{BASE}/{dashboard_id}/save', json=payload)
    assert response.status_code == 409
    assert draft_payload(client, dashboard_id) == current


def test_failed_publish_rolls_back_added_removed_and_retained_widgets(client, monkeypatch):
    """A commit failure retains the complete previous dashboard."""
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id)
    before = draft_payload(client, dashboard_id)
    payload = deepcopy(before)
    payload.update(name='Not saved', subtitle='Not saved', display_style='dividers')
    payload['widgets'] = [dict(payload['widgets'][0], id=-1, layout_row=4)]

    def fail_commit() -> None:
        """Fail after validation and relationship changes."""
        raise SQLAlchemyError('Publish failed')

    with monkeypatch.context() as scoped:
        scoped.setattr(db.session, 'commit', fail_commit)
        response = client.post(f'{BASE}/{dashboard_id}/save', json=payload)
    assert response.status_code == 500
    assert draft_payload(client, dashboard_id) == before


def test_metadata_race_after_loading_dashboard_cannot_be_overwritten(client, app):
    """Revision acquisition checks baseline details inside the same conditional update."""
    dashboard_id = create_dashboard(client)
    payload = draft_payload(client, dashboard_id)
    payload['name'] = 'Stale draft'
    with app.app_context():
        dashboard = db.session.get(Dashboard, dashboard_id)
        list(dashboard.widgets)
        with Session(db.engine) as other:
            other.execute(db.update(Dashboard).where(
                Dashboard.id == dashboard_id,
            ).values(name='Other window'))
            other.commit()
        with pytest.raises(dashboards.LayoutConflict):
            dashboards.save_dashboard_draft(dashboard, payload)
        db.session.rollback()
        assert dashboard.name == 'Other window'


def test_draft_preview_uses_unique_widget_ids_without_creating_saved_widgets(client, monkeypatch):
    """Restoring several draft widgets cannot duplicate chart or navigation element IDs."""
    monkeypatch.setattr(connect_goals, 'get_setup_state', lambda reference=None: {'ready': True})
    dashboard_id = create_dashboard(client)
    before = draft_payload(client, dashboard_id)
    for instance_id in (-1, -2):
        response = client.get(f'{BASE}/widget-preview', query_string={
            'key': 'connect_goals.u2c', 'variant': 'metric', 'width': 3,
            'instance_id': instance_id,
        })
        assert response.status_code == 200
        assert f'dw{instance_id}-connectGoalsData' in response.json['html']
    assert draft_payload(client, dashboard_id) == before
