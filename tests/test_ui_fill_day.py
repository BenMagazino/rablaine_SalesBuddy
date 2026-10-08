"""Native Fill My Day contract and isolated persistence/remote failure coverage."""
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest


def test_native_owned_surface_and_single_shared_assets(client):
    """The page owns its workbench, not Bootstrap, with the exact date default."""
    response = client.get('/fill-my-day?date=2026-10-07')
    soup = BeautifulSoup(response.data, 'html.parser')
    root = soup.select_one('.fill-workbench')
    assert root.select_one('#fillDate')['value'] == '2026-10-07'
    assert root.select_one('#startBtn').get_text(strip=True) == 'Fetch Meetings'
    assert soup.select_one('body.sb-page-frame')
    assert soup.select_one('footer.sb-page-status')
    assert soup.select_one('dialog#fillGuard.sb-dialog')
    assert not root.select('[data-bs-toggle], .card, .btn, .form-control, .container-fluid')
    for name in ('ui-dialog.js', 'ui-table-sort.js', 'ui-fill-day.js'):
        assert sum(name in script.get('src', '') for script in soup.select('script')) == 1
    source = Path('templates/fill_my_day.html').read_text(encoding='utf-8')
    assert 'alert(' not in source
    assert 'data-bs-toggle' not in source
    assert 'complete_on_create: true' in source
    assert '/api/meetings?' in source


def test_page_get_never_fetches_or_creates(client):
    """Loading the page cannot execute the implicit meetings GET write path."""
    with patch('app.services.workiq_service.get_meetings_for_date') as remote, \
            patch('app.services.meeting_sync.sync_meetings_for_date') as sync, \
            patch('app.gateway_client.gateway_call') as ai:
        assert client.get('/fill-my-day').status_code == 200
        remote.assert_not_called()
        sync.assert_not_called()
        ai.assert_not_called()


def test_existing_help_inventory_describes_actual_import_not_invented_prep():
    """Keep the same single help route and describe only the original workflow."""
    source = Path('static/js/page-help.js').read_text(encoding='utf-8')
    assert source.count("pattern: /^\\/fill-my-day/") == 1
    section = source.split("pattern: /^\\/fill-my-day/")[1].split('`},')[0]
    assert 'upcoming meetings' not in section
    assert 'Create Task in MSX is an immediate remote write' in section
    assert 'WorkIQ meetings' in section
    assert 'Save Note creates a local note' in section


@pytest.mark.parametrize('join_result', [
    {'success': True}, {'success': False, 'error': 'already a member'},
    {'success': False, 'error': 'Access denied'}, RuntimeError('Unavailable'),
])
def test_note_save_links_existing_task_and_team_outcomes(client, sample_data, join_result):
    """Exact save metadata persists and remote team failures remain nonblocking."""
    payload = {
        'customer_id': sample_data['customer1_id'], 'call_date': '2026-10-07',
        'call_time': '14:15', 'content': '<p>Review</p>', 'topic_ids': [],
        'milestone': {'msx_milestone_id': 'isolated-fill-ms', 'name': 'Milestone',
                      'status': 'On Track', 'number': '7-123', 'opportunity_name': 'Opportunity'},
        'created_task_id': 'isolated-task', 'created_task_url': 'https://example.com/task',
        'task_subject': 'Task', 'task_description': 'Details',
        'created_task_category_name': 'Workshop', 'created_task_is_hva': '1',
        'task_due_date': '2026-10-08',
    }
    kwargs = {'side_effect': join_result} if isinstance(join_result, Exception) else {
        'return_value': join_result}
    with patch('app.routes.notes.add_user_to_milestone_team', **kwargs) as join:
        response = client.post('/api/fill-my-day/save', json=payload)
        assert response.status_code == 200
        join.assert_called_once_with('isolated-fill-ms')
    with client.application.app_context():
        from app.models import db, Note, MsxTask
        note = db.session.get(Note, response.json['note_id'])
        assert note.call_date.hour == 14 and note.call_date.minute == 15
        assert note.call_date.tzinfo is None
        task = MsxTask.query.filter_by(msx_task_id='isolated-task').one()
        assert task.note.id == note.id
        assert task.is_hva is True
        assert task.task_category_name == 'Workshop'
        assert task.due_date.strftime('%Y-%m-%d') == '2026-10-08'
        assert response.json['view_url'] == f'/note/{note.id}'


def test_save_rollback_and_retry(client, sample_data):
    """A failed commit leaves no note; an explicit retry succeeds."""
    from app.models import db, Note
    payload = {'customer_id': sample_data['customer1_id'], 'call_date': '2026-10-07',
               'content': '<p>Retry evidence</p>', 'topic_ids': []}
    with client.application.app_context():
        count = Note.query.count()
        with patch.object(db.session, 'commit', side_effect=RuntimeError('Commit unavailable')):
            response = client.post('/api/fill-my-day/save', json=payload)
        assert response.status_code == 500
        assert response.json['success'] is False
        assert Note.query.count() == count
    response = client.post('/api/fill-my-day/save', json=payload)
    assert response.status_code == 200


def test_process_preserves_topics_milestone_and_impact(client, sample_data):
    """The exact provider payload and suggested task fields survive native migration."""
    from app.models import db, Customer
    with client.application.app_context():
        customer = db.session.get(Customer, sample_data['customer1_id'])
        customer.tpid_url = 'https://example.com/account'
        db.session.commit()
    milestone = {'id': 'match-guid', 'name': 'Milestone', 'status': 'On Track',
                 'status_code': 1, 'number': '7-42', 'url': 'https://example.com/ms',
                 'opportunity_name': 'Opportunity', 'workload': 'Azure'}
    with patch('app.services.workiq_service.get_meeting_summary', return_value={
            'summary': 'Azure discussion', 'action_items': ['Follow up'],
            'connect_impact': ['Impact'], 'engagement_signals': {'Status': 'Active'},
            'task_subject': 'Default task', 'task_description': 'Default details'}), \
            patch('app.services.msx_api.extract_account_id_from_url', return_value='account'), \
            patch('app.services.msx_api.get_milestones_by_account',
                  return_value={'success': True, 'milestones': [milestone]}), \
            patch('app.gateway_client.gateway_call', side_effect=[
                {'topics': ['azure vm', 'Missing topic']}, {'milestone_id': 'match-guid',
                                        'task_subject': 'Matched task', 'task_description': 'Matched details'}
            ]) as ai:
        response = client.post('/api/fill-my-day/process', json={
            'meeting': {'title': 'Meeting'}, 'date': '2026-10-07',
            'customer_id': sample_data['customer1_id']})
    assert response.status_code == 200
    assert response.json['summary_ok'] is True
    assert response.json['topics'] == [{'id': sample_data['topic1_id'], 'name': 'Azure VM'}]
    assert response.json['milestone']['msx_milestone_id'] == 'match-guid'
    assert response.json['task_subject'] == 'Default task'
    assert response.json['connect_impact'] == ['Impact']
    assert response.json['engagement_signals'] == {'Status': 'Active'}
    assert [call.args[0] for call in ai.call_args_list] == [
        '/v1/suggest-topics', '/v1/match-milestone']
