"""Native manual topic forms, using only the isolated pytest database."""

from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Topic, db


@pytest.fixture
def topics(app, sample_data):
    """Create two manual edit targets alongside a real note-tag relationship."""
    with app.app_context():
        first = Topic(name='Original', description=None)
        other = Topic(name='Taken', description='Existing description')
        db.session.add_all([first, other])
        db.session.commit()
        return first.id, other.id, sample_data['topic1_id']


def parse(response):
    """Parse a rendered response."""
    return BeautifulSoup(response.data, 'html.parser')


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_exact_form_contract(client, topics, mode):
    """Keep original types, requiredness, POST, defaults and canonical destinations."""
    path = '/topic/new' if mode == 'new' else f'/topic/{topics[0]}/edit'
    soup = parse(client.get(path))
    form = soup.select_one('#topicForm')
    assert 'sb-directory-frame' in form['class']
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert [field['name'] for field in form.select('[name]')] == ['name', 'description']
    assert form.select_one('#name')['type'] == 'text'
    assert form.select_one('#name').has_attr('required')
    assert form.select_one('#name').has_attr('autofocus')
    assert form.select_one('#name')['value'] == ('' if mode == 'new' else 'Original')
    description = form.select_one('textarea')
    assert description['rows'] == '4' and not description.has_attr('required')
    assert description.get_text() == ''
    assert not form.select('input[maxlength],.card,.btn,.form-control,form,[onsubmit]')
    assert form.select_one('[data-topic-cancel]')['href'] == '/topics'
    assert form.select_one('[type=submit]').get_text(strip=True) == 'Save Topic'
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert soup.select_one('body.sb-page-frame')
    assert soup.select_one('#topicFormDiscard [autofocus]').get_text(strip=True) == 'Keep editing'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_success_normalization_and_original_redirects(client, app, topics, mode):
    """Trim manually posted fields and keep distinct New and Edit success destinations."""
    path = '/topic/new' if mode == 'new' else f'/topic/{topics[0]}/edit'
    response = client.post(path, data={'name': ' Revised ', 'description': ' Context\nmore '})
    with app.app_context():
        saved = Topic.query.filter_by(name='Revised').one()
        assert saved.description == 'Context\nmore'
        saved_id = saved.id
    assert response.status_code == 302
    assert response.headers['Location'] == (
        '/topics' if mode == 'new' else f'/topic/{saved_id}')
    assert client.post(f'/topic/{saved_id}/edit',
                       data={'name': 'Revised', 'description': ' '}).status_code == 302
    with app.app_context():
        assert db.session.get(Topic, saved_id).description is None
        assert db.session.get(Topic, topics[1]).name == 'Taken'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_required_redirect_retains_raw_input_once(client, app, topics, mode):
    """Required errors retain original redirects and path-local raw entries once."""
    path = '/topic/new' if mode == 'new' else f'/topic/{topics[0]}/edit'
    values = {'name': '   ', 'description': ' <raw> & context '}
    response = client.post(path, data=values)
    assert response.status_code == 302 and response.headers['Location'] == path
    with client.session_transaction() as session:
        assert ('danger', 'Topic name is required.') in session['_flashes']
    assert parse(client.get(f'/topic/{topics[1]}/edit')).select_one(
        '#topicForm')['data-posted'] == 'false'
    soup = parse(client.get(path))
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#description').get_text() == values['description']
    assert soup.select_one('#topicForm')['data-posted'] == 'true'
    assert parse(client.get(path)).select_one('#topicForm')['data-posted'] == 'false'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_required_redirect_renders_notice(client, topics, mode):
    """The direct redirected render includes the real error and raw description."""
    path = '/topic/new' if mode == 'new' else f'/topic/{topics[0]}/edit'
    response = client.post(path, data={'name': '', 'description': 'raw'},
                           follow_redirects=True)
    assert response.status_code == 200
    soup = parse(response)
    assert 'Topic name is required.' in soup.get_text()
    assert soup.select_one('#description').get_text() == 'raw'


def test_duplicate_workflows_and_case_sensitive_manual_names(client, app, topics):
    """New duplicates open detail; Edit duplicates return the draft; case rules stay exact."""
    values = {'name': ' Taken ', 'description': ' raw duplicate '}
    assert client.post('/topic/new', data=values).headers['Location'] == f'/topic/{topics[1]}'
    path = f'/topic/{topics[0]}/edit'
    response = client.post(path, data=values, follow_redirects=True)
    soup = parse(response)
    assert 'already exists' in soup.get_text()
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#description').get_text() == values['description']
    assert client.post('/topic/new', data={'name': 'taken'}).status_code == 302
    with app.app_context():
        assert Topic.query.filter_by(name='Taken').count() == 1
        assert Topic.query.filter_by(name='taken').count() == 1
        assert db.session.get(Topic, topics[0]).name == 'Original'
    assert client.post(f'/topic/{topics[1]}/edit', data={'name': 'Taken'}).status_code == 302


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_failed_write_rolls_back_retains_escaped_input_and_retries(client, app, topics, mode):
    """SQLAlchemy failures preserve entries and database state, then allow manual retry."""
    path = '/topic/new' if mode == 'new' else f'/topic/{topics[0]}/edit'
    values = {'name': ' <Attempt & raw> ', 'description': ' <script>context</script> '}
    with app.app_context():
        original_count = Topic.query.count()
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        response = client.post(path, data=values)
    assert response.status_code == 500
    soup = parse(response)
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#description').get_text() == values['description']
    assert not soup.select_one('#description script')
    assert 'Could not save the topic. Your entries are still here.' in soup.get_text()
    assert soup.select_one('#topicForm')['data-posted'] == 'true'
    with app.app_context():
        assert Topic.query.count() == original_count
        assert db.session.get(Topic, topics[0]).name == 'Original'
    assert client.post(path, data=values).status_code == 302


def test_actual_consumers_associations_and_api_remain_distinct(client, app, topics):
    """Directory/detail links, tagged notes, missing IDs and JSON deduplication remain."""
    assert parse(client.get('/topics')).select_one('a[href="/topic/new"]')
    assert parse(client.get(f'/topic/{topics[0]}')).select_one(
        f'a[href="/topic/{topics[0]}/edit"]')
    assert client.get('/topic/999999/edit').status_code == 404
    with app.app_context():
        tagged = db.session.get(Topic, topics[2])
        note_ids = [note.id for note in tagged.notes]
        name = tagged.name
    assert client.post(f'/topic/{topics[2]}/edit',
                       data={'name': name, 'description': 'Updated context'}).status_code == 302
    with app.app_context():
        assert [note.id for note in db.session.get(Topic, topics[2]).notes] == note_ids
    assert client.post('/api/topic/create', json={'name': 'taken'}).json['existed'] is True
    response = client.post('/api/topic/create', json={'name': ' API distinct '})
    assert response.status_code == 201 and response.json['description'] == ''
    assert client.post('/api/topic/create', json={'name': ''}).status_code == 400
