"""Manual project form parity and transaction failures use only the isolated database."""
from datetime import date, datetime
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import db, Note, Project


@pytest.fixture
def records(db_session, sample_customer):
    """Build eligible, attached, foreign and customer notes in the isolated database."""
    notes = [
        Note(content='<p>Newest &amp; safe</p>', call_date=datetime(2026, 10, 2)),
        Note(content='Older', call_date=datetime(2026, 9, 2)),
        Note(content='Other project', call_date=datetime(2026, 10, 3)),
        Note(content='Customer', call_date=datetime(2026, 10, 4),
             customer_id=sample_customer.id),
    ]
    project = Project(title='Original "title" <safe>', description='<p>Plain text</p>',
                      project_type='training', status='On Hold', due_date=date(2027, 1, 2),
                      notes=[notes[1]])
    other = Project(title='Other', notes=[notes[2]])
    db_session.add_all([*notes, project, other])
    db_session.commit()
    return project, notes


@pytest.mark.parametrize('editing', [False, True])
def test_form_inventory(client, records, editing):
    """Exact names, defaults, ordering, escaping and canonical destinations survive."""
    project, notes = records
    response = client.get(f'/project/{project.id}/edit' if editing else '/project/new')
    soup = BeautifulSoup(response.data, 'html.parser')
    form = soup.select_one('#projectForm')
    assert response.status_code == 200
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert 'sb-page-frame' in soup.body['class']
    assert {e['name'] for e in form.select('[name]')} == {
        'title', 'description', 'project_type', 'due_date', 'note_ids',
    } | ({'status'} if editing else set())
    assert len(form.select('[required]')) == 1
    assert form.select_one('#title').has_attr('required')
    assert form.select_one('#title')['value'] == (project.title if editing else '')
    assert form.select_one('#description').text == (project.description if editing else '')
    assert form.select_one('#due_date')['value'] == ('2027-01-02' if editing else '')
    assert [o['value'] for o in form.select('#project_type option')] == [
        'general', 'training', 'achievement',
    ]
    assert [o['value'] for o in form.select('#status option')] == (
        ['Active', 'On Hold', 'Completed'] if editing else []
    )
    assert [int(e['value']) for e in form.select('[name="note_ids"]')] == (
        [notes[0].id, notes[1].id] if editing else [notes[0].id]
    )
    assert [int(e['value']) for e in form.select('[name="note_ids"][checked]')] == (
        [notes[1].id] if editing else []
    )
    assert form.select_one('a')['href'] == (f'/project/{project.id}' if editing
                                          else '/engagements')
    assert not form.select('.card, .btn, .form-control, .form-select, .row')
    assert not form.select('script, [contenteditable], [name="owner"]')
    assert soup.select_one('footer.sb-page-status')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1


@pytest.mark.parametrize('editing', [False, True])
def test_save_payload_and_destination(client, records, editing):
    """The original payload trims text, updates statuses/dates and replaces linked notes."""
    project, notes = records
    response = client.post(f'/project/{project.id}/edit' if editing else '/project/new', data={
        'title': '  Saved  ', 'description': '  <b>Literal</b>  ', 'project_type': 'achievement',
        'due_date': '2028-03-04', 'status': 'Completed', 'note_ids': str(notes[0].id),
    })
    assert response.status_code == 302
    saved = db.session.get(Project, project.id) if editing else Project.query.filter_by(
        title='Saved').one()
    assert response.location.endswith(f'/project/{saved.id}')
    assert saved.title == 'Saved' and saved.description == '<b>Literal</b>'
    assert saved.project_type == 'achievement'
    assert saved.status == ('Completed' if editing else 'Active')
    assert saved.due_date == date(2028, 3, 4)
    assert [n.id for n in saved.notes] == [notes[0].id]


@pytest.mark.parametrize('editing', [False, True])
def test_failed_commit_retains_exact_entries_and_rolls_back(client, records, editing):
    """Failed transactions retain raw input/checkboxes, escape HTML and never signal success."""
    project, notes = records
    payload = {'title': '  <script>draft</script>  ', 'description': '  </textarea><b>draft</b>  ',
               'project_type': 'achievement', 'due_date': '2028-03-04',
               'status': 'Completed', 'note_ids': str(notes[0].id)}
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        response = client.post(f'/project/{project.id}/edit' if editing else '/project/new',
                               data=payload)
    assert response.status_code == 500
    soup = BeautifulSoup(response.data, 'html.parser')
    assert soup.select_one('#title')['value'] == payload['title']
    assert soup.select_one('#description').text == payload['description']
    assert soup.select_one('#due_date')['value'] == payload['due_date']
    assert soup.select_one('#project_type option[selected]')['value'] == 'achievement'
    assert [int(e['value']) for e in soup.select('[name="note_ids"][checked]')] == [notes[0].id]
    if editing:
        assert soup.select_one('#status option[selected]')['value'] == 'Completed'
    assert b'Your entries are still here' in response.data
    assert not soup.select_one('#projectForm script')
    db.session.expire_all()
    assert db.session.get(Project, project.id).title == 'Original "title" <safe>'
    assert [n.id for n in db.session.get(Project, project.id).notes] == [notes[1].id]
    assert Project.query.count() == 2


def test_create_missing_title_retains_optional_input(client, records):
    """Original required-title error is visible without losing optional entries."""
    response = client.post('/project/new', data={'title': ' ', 'description': 'Keep me',
                                                'project_type': 'training'})
    assert response.status_code == 400
    assert b'Project title is required.' in response.data
    assert BeautifulSoup(response.data, 'html.parser').select_one('#description').text == 'Keep me'
    assert Project.query.count() == 2


@pytest.mark.parametrize('due_date', ['', 'not-a-date'])
def test_existing_optional_and_invalid_date_semantics(client, records, due_date):
    """Blank edit title keeps its value; empty dates clear, invalid dates retain the saved date."""
    project, _ = records
    response = client.post(f'/project/{project.id}/edit', data={
        'title': '', 'description': '', 'due_date': due_date,
    })
    assert response.status_code == 302
    assert project.title == 'Original "title" <safe>'
    assert project.description is None
    assert project.due_date == (None if not due_date else date(2027, 1, 2))
    assert project.status == 'On Hold' and project.project_type == 'training'
    assert project.notes == []


def test_create_defaults_and_invalid_date(client):
    """Original create defaults and ignored invalid date remain unchanged."""
    response = client.post('/project/new', data={'title': 'Defaults', 'due_date': 'bad'})
    assert response.status_code == 302
    project = Project.query.filter_by(title='Defaults').one()
    assert (project.project_type, project.status, project.description, project.due_date) == (
        'general', 'Active', None, None,
    )


def test_note_flyout_partial_retains_native_compact_contract(app):
    """The embedded note consumer retains its IDs, status scope and compact layout."""
    with app.test_request_context('/note/new'):
        html = app.jinja_env.get_template('partials/_project_form_fields.html').render(
            project=None, project_types=Project.BUILT_IN_TYPES, flyout_mode=True,
        )
    soup = BeautifulSoup(html, 'html.parser')
    assert soup.select_one('#flyout_project_title')
    assert soup.select_one('#flyout_project_status_group')['style'] == 'display: none;'
    assert not soup.select_one('#flyout_project_title').has_attr('required')
    assert soup.select_one('.pf-flyout') and not soup.select_one('.pf-fields')
    assert not soup.select('.form-control, .form-select, .row')
    assert soup.select_one('#flyout_project_title')['name'] == 'title'
    assert soup.select_one('#flyout_project_description')['rows'] == '2'
    assert soup.select_one('#flyout_project_description')['name'] == 'description'
    assert soup.select_one('#flyout_project_due_date')['name'] == 'due_date'
    assert [option['value'] for option in soup.select('#flyout_project_type option')] == [
        'general', 'training', 'achievement',
    ]
    assert [option['value'] for option in soup.select('#flyout_project_status option')] == [
        'Active', 'On Hold', 'Completed',
    ]


def test_note_flyout_edit_values_and_note_scope(app, records):
    """Compact edits preserve prefixed labels, status and eligible note selections."""
    project, notes = records
    with app.test_request_context('/note/new'):
        html = app.jinja_env.get_template('partials/_project_form_fields.html').render(
            project=project, project_types=Project.BUILT_IN_TYPES, flyout_mode=True,
            unattached_notes=notes[:2],
        )
    soup = BeautifulSoup(html, 'html.parser')
    assert soup.select_one('#flyout_project_title')['value'] == project.title
    assert soup.select_one('#flyout_project_description').text == project.description
    assert soup.select_one('#flyout_project_due_date')['value'] == '2027-01-02'
    assert soup.select_one('#flyout_project_type option[selected]')['value'] == 'training'
    assert soup.select_one('#flyout_project_status option[selected]')['value'] == 'On Hold'
    assert not soup.select_one('#flyout_project_status_group').has_attr('style')
    assert [int(element['value']) for element in soup.select('[name="note_ids"][checked]')] == [
        notes[1].id,
    ]
    assert soup.select_one(f'#flyout_note_{notes[1].id}')
    for control in soup.select('input, select, textarea'):
        assert soup.select_one(f'label[for="{control["id"]}"]')
    assert not soup.select('#title, #description, #project_type, #due_date, #status')


def test_missing_project(client):
    """The original edit missing-record response remains a 404."""
    assert client.get('/project/999999/edit').status_code == 404
