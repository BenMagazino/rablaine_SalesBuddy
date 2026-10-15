"""Scoped manual-order persistence and shared dossier ordering contracts."""
from datetime import date
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.models import ActionItem, Engagement, Project, db


@pytest.fixture(params=['engagement', 'project'])
def ordered_owner(request, app, sample_customer):
    """Create one owner with dated, undated, completed and unrelated tasks."""
    with app.app_context():
        kind = request.param
        owner = (Engagement(title='Ordered engagement', customer_id=sample_customer.id)
                 if kind == 'engagement' else Project(title='Ordered project'))
        db.session.add(owner)
        db.session.flush()
        scope = {f'{kind}_id': owner.id}
        tasks = [
            ActionItem(title='Later', due_date=date(2027, 4, 1), sort_order=0, **scope),
            ActionItem(title='Undated', sort_order=1, **scope),
            ActionItem(title='Earlier', due_date=date(2027, 1, 1), sort_order=2, **scope),
            ActionItem(title='Done', status='completed', sort_order=3, **scope),
            ActionItem(title='Unrelated'),
        ]
        db.session.add_all(tasks)
        db.session.commit()
        return {
            'kind': kind, 'id': owner.id, 'ids': [task.id for task in tasks],
            'url': (f'/engagement/{owner.id}/action-items/reorder' if kind == 'engagement'
                    else f'/api/project/{owner.id}/action-items/reorder'),
            'detail': (f'/api/engagement/{owner.id}/detail' if kind == 'engagement'
                       else f'/api/project/{owner.id}/detail'),
        }


def test_shared_controls_and_raw_sort_keys_on_page_and_fragment(client, ordered_owner):
    """Both owners expose the same ordering UI in standalone and embedded views."""
    owner = ordered_owner
    for path in [f"/{owner['kind']}/{owner['id']}", owner['detail']]:
        response = client.get(path)
        assert response.status_code == 200
        soup = BeautifulSoup(response.data, 'html.parser')
        assert [option['value'] for option in soup.select('[data-action-order] option')] == [
            'due', 'due-desc', 'manual',
        ]
        rows = soup.select('[data-action-order-id]')
        assert len(rows) == 4
        assert [row['data-action-order-due'] for row in rows] == [
            '2027-04-01', '', '2027-01-01', '',
        ]
        assert rows[-1]['data-action-order-status'] == 'completed'
        assert soup.select_one('[data-action-order-notice][role="alert"]')
        assert soup.select_one('script[src^="/static/js/ui-action-item-order.js"]')


def test_order_persists_after_reload_without_altering_dates_or_completed(client, app, ordered_owner):
    """Manual moves survive new reads, with completed tasks left untouched."""
    owner = ordered_owner
    ids = owner['ids']
    desired = [ids[2], ids[0], ids[1]]
    assert client.post(owner['url'], json={'task_ids': desired}).json == {'success': True}
    with app.app_context():
        assert [db.session.get(ActionItem, tid).sort_order for tid in desired] == [0, 1, 2]
        assert db.session.get(ActionItem, ids[3]).sort_order == 3
        assert db.session.get(ActionItem, ids[0]).due_date == date(2027, 4, 1)
    soup = BeautifulSoup(client.get(owner['detail']).data, 'html.parser')
    assert [int(row['data-action-order-id']) for row in
            soup.select('[data-action-order-id][data-action-order-status="open"]')] == desired


@pytest.mark.parametrize('payload', [None, [], {}, {'task_ids': 'bad'},
                                    {'task_ids': [True]}, {'task_ids': [1.5]},
                                    {'task_ids': [1, 1]}, {'task_ids': [-1]}])
def test_invalid_order_payload_is_explicit_and_atomic(client, app, ordered_owner, payload):
    """Invalid IDs and wrong shapes never silently save a partial order."""
    owner = ordered_owner
    response = client.post(owner['url'], json=payload)
    assert response.status_code == 400 and not response.json['success']
    with app.app_context():
        assert [db.session.get(ActionItem, tid).sort_order for tid in owner['ids'][:4]] == [
            0, 1, 2, 3,
        ]


@pytest.mark.parametrize('case', ['missing', 'foreign', 'completed'])
def test_stale_or_foreign_lists_are_rejected_without_partial_write(
        client, app, ordered_owner, case):
    """A concurrently added/completed task or wrong owner requires refreshing."""
    owner = ordered_owner
    ids = owner['ids']
    requested = {'missing': ids[:2], 'foreign': [ids[2], ids[4], ids[0]],
                 'completed': [ids[2], ids[3], ids[0]]}[case]
    response = client.post(owner['url'], json={'task_ids': requested})
    assert response.status_code == 409 and response.json['error']
    with app.app_context():
        assert [db.session.get(ActionItem, tid).sort_order for tid in ids[:4]] == [0, 1, 2, 3]


def test_failed_reorder_rolls_back_and_reports_failure(client, app, ordered_owner):
    """Failed commits remain visible and do not persist optimistic manual positions."""
    owner = ordered_owner
    with patch('app.services.action_item_ordering.db.session.commit',
               side_effect=SQLAlchemyError('Unavailable')):
        response = client.post(owner['url'], json={'task_ids': owner['ids'][2::-1]})
    assert response.status_code == 500 and not response.json['success']
    with app.app_context():
        assert [db.session.get(ActionItem, tid).sort_order for tid in owner['ids'][:3]] == [0, 1, 2]


def test_project_new_tasks_append_to_saved_manual_order(client, app, ordered_owner):
    """Project creation honors existing manual order instead of assigning zero again."""
    owner = ordered_owner
    if owner['kind'] != 'project':
        pytest.skip('Project-specific creation path')
    response = client.post(f"/api/project/{owner['id']}/action-item", json={'title': 'New'})
    assert response.status_code == 200
    with app.app_context():
        assert db.session.get(ActionItem, response.json['id']).sort_order == 4
