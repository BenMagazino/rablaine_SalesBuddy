"""Native project dossier parity and isolated task-save failure regressions."""
from datetime import date, datetime
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from app.models import ActionItem, Note, Project, db


@pytest.fixture
def dossier(app) -> dict[str, int]:
    """Create real rich tasks and linked general notes in the isolated test database."""
    with app.app_context():
        project = Project(
            title='Internal <project>', description='First line\nSecond line',
            project_type='custom_type', status='On Hold', due_date=date(2020, 1, 2),
        )
        db.session.add(project)
        db.session.flush()
        tasks = [
            ActionItem(project_id=project.id, title='Rich task', source='project',
                       description='<p>Keep <strong>HTML</strong></p>', priority='high',
                       due_date=date(2020, 1, 3)),
            ActionItem(project_id=project.id, title='Finished', source='project',
                       status='completed'),
        ]
        notes = [
            Note(content='Older note', call_date=datetime(2025, 1, 1)),
            Note(content='Newer note', call_date=datetime(2026, 1, 1)),
        ]
        project.notes = notes
        db.session.add_all(tasks)
        db.session.commit()
        return {'id': project.id, 'task': tasks[0].id, 'new': notes[1].id, 'old': notes[0].id}


def test_full_and_inline_dossier_preserve_values_links_order_and_commands(client, dossier):
    """Both presentations share domain content, while only the page owns a frame and footer."""
    page = BeautifulSoup(client.get(f"/project/{dossier['id']}").data, 'html.parser')
    inline = BeautifulSoup(
        client.get(f"/api/project/{dossier['id']}/detail").data, 'html.parser',
    )
    for doc in [page, inline]:
        root = doc.select_one('[data-sb-project-detail]')
        assert root['data-sb-project-detail'] == str(dossier['id'])
        assert root.select_one('h1').text == 'Internal <project>'
        assert root.select_one('.sb-project-description').text == 'First line\nSecond line'
        assert 'Custom Type' in root.text and 'On Hold' in root.text
        assert root.select_one('.sb-project-facts time')['datetime'] == '2020-01-02'
        assert root.select_one('[aria-label="Overdue"]')
        assert len(root.select('[data-project-task]')) == 2
        assert root.select_one('[data-priority="high"]').text.strip().startswith('Rich task')
        assert root.select_one('[data-status="completed"] .sb-project-task-title').text == 'Finished'
        assert [link['href'] for link in root.select('.sb-project-note')] == [
            f"/note/{dossier['new']}", f"/note/{dossier['old']}",
        ]
        assert root.select_one('[aria-label="New note for this project"]')['href'] == (
            f"/note/new?project_id={dossier['id']}"
        )
        assert root.select_one('[data-project-delete]')['method'] == 'POST'
        assert root.select_one('#newTaskTitle').has_attr('required')
        assert not root.select_one('#newTaskDue').has_attr('required')
        assert root.select_one('#aiEditDesc')
        assert root.select_one('#aiDetailCompleted')
        assert len(root.select('script[src$="ui-action-item-dialog.js"]')) == 1
        assert len(root.select('script[src$="ui-project-detail.js"]')) == 1
        assert not root.select('.card, .btn, .modal, [data-bs-toggle], table')
    assert page.select_one('body.sb-page-frame')
    assert page.select_one('[aria-label="Project status"]')
    assert page.select_one('[data-project-back]')
    assert not inline.select('html, footer, [data-project-back]')
    assert inline.select_one('[data-project-parent="managerWorkModal"]')


def test_task_json_keeps_source_related_note_rich_fields_and_status(client, app, dossier):
    """Task reading uses the existing JSON provider, not an abbreviated project-only shape."""
    with app.app_context():
        task = db.session.get(ActionItem, dossier['task'])
        task.note_id = dossier['new']
        task.contact = 'Owner'
        task.source_url = 'https://example.com/source'
        db.session.commit()
    data = client.get(f"/action-item/{dossier['task']}").json['task']
    assert data['project_id'] == dossier['id']
    assert data['note_id'] == dossier['new']
    assert data['source'] == 'project'
    assert data['source_url'] == 'https://example.com/source'
    assert data['description'] == '<p>Keep <strong>HTML</strong></p>'
    assert data['priority'] == 'high' and data['contact'] == 'Owner'
    assert data['status'] == 'open' and data['is_overdue']


@pytest.mark.parametrize('payload', [
    {'title': 'New task'}, {'title': 'New task', 'due_date': '2027-02-03'},
])
def test_manual_quick_task_payload_and_exact_response(client, app, dossier, payload):
    """The actual manual write keeps title-only and optional-date contracts."""
    response = client.post(f"/api/project/{dossier['id']}/action-item", json=payload)
    assert response.status_code == 200
    assert set(response.json) == {'success', 'id'}
    with app.app_context():
        task = db.session.get(ActionItem, response.json['id'])
        assert task.title == payload['title']
        assert task.source == 'project' and task.project_id == dossier['id']
        assert task.status == 'open' and task.priority == 'normal'
        assert task.due_date == (date(2027, 2, 3) if 'due_date' in payload else None)


def test_failed_task_commit_rolls_back_and_retry_creates_one_record(client, app, dossier):
    """A failed manual save never masquerades as success or retains an orphan task."""
    with patch('app.routes.projects.db.session.commit', side_effect=RuntimeError('Offline')):
        response = client.post(f"/api/project/{dossier['id']}/action-item", json={'title': 'Retry'})
    assert response.status_code == 500
    assert response.json == {
        'success': False, 'error': 'Could not add the action item. Please try again.',
    }
    response = client.post(f"/api/project/{dossier['id']}/action-item", json={'title': 'Retry'})
    assert response.json['success']
    with app.app_context():
        assert ActionItem.query.filter_by(project_id=dossier['id'], title='Retry').count() == 1
