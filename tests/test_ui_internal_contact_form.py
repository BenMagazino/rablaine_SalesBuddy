"""Native manual contact forms, verified only in the isolated pytest database."""

from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import InternalContact, db


@pytest.fixture
def contacts(app):
    """Create a contact and a separate deduplication target."""
    with app.app_context():
        contact = InternalContact(name='Original', alias='original', role='DAE')
        other = InternalContact(name='Other', alias='taken', role='CSA')
        db.session.add_all([contact, other])
        db.session.commit()
        return contact.id, other.id


def parse(response):
    """Parse a rendered response."""
    return BeautifulSoup(response.data, 'html.parser')


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_exact_form_contract(client, contacts, mode):
    """Original names, input types, requiredness, suggestions and destinations remain."""
    path = '/internal-contacts/new' if mode == 'new' else f'/internal-contacts/{contacts[0]}/edit'
    soup = parse(client.get(path))
    form = soup.select_one('#icForm')
    assert 'sb-directory-frame' in form['class']
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert [f['name'] for f in form.select('[name]')] == ['name', 'alias', 'role']
    assert all(f['type'] == 'text' for f in form.select('input'))
    assert [f.has_attr('required') for f in form.select('input')] == [True, False, False]
    assert form.select_one('#name').has_attr('autofocus')
    assert [f['value'] for f in form.select('input')] == (
        ['', '', ''] if mode == 'new' else ['Original', 'original', 'DAE'])
    assert [o['value'] for o in form.select('datalist option')] == [
        'DAE', 'DSS', 'DSE - Security', 'DSE - Modern Work',
        'DSE - Business Applications', 'SSP', 'TSP', 'CSA']
    assert form.select_one('[data-ic-cancel]')['href'] == '/internal-contacts'
    assert not form.select('.card,.btn,.form-control,form,[onsubmit]')
    assert not soup.select('form form')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert len(soup.select('#icFormDeletePost')) == (mode == 'edit')
    if mode == 'edit':
        delete = soup.select_one('#icFormDeletePost')
        assert delete['action'] == f'/internal-contacts/{contacts[0]}/delete'
        assert delete['method'] == 'POST'
        assert delete.select_one('[autofocus]').get_text(strip=True) == 'Cancel'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_success_normalization_and_free_role(client, app, contacts, mode):
    """Manual saving retains normalization, unrestricted roles and original redirects."""
    path = '/internal-contacts/new' if mode == 'new' else f'/internal-contacts/{contacts[0]}/edit'
    response = client.post(path, data={'name': '  Revised  ',
                                      'alias': ' NEWALIAS@MICROSOFT.COM ',
                                      'role': '  Arbitrary role  '})
    assert response.status_code == 302 and response.headers['Location'] == '/internal-contacts'
    with app.app_context():
        contact = InternalContact.query.filter_by(alias='newalias').one()
        assert (contact.name, contact.role) == ('Revised', 'Arbitrary role')
        assert db.session.get(InternalContact, contacts[1]).alias == 'taken'
    response = client.post(f'/internal-contacts/{contact.id}/edit',
                           data={'name': 'Revised', 'alias': ' ', 'role': ''})
    assert response.status_code == 302
    with app.app_context():
        updated = db.session.get(InternalContact, contact.id)
        assert updated.alias is None and updated.role is None


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_required_redirect_retains_raw_input_once(client, app, contacts, mode):
    """Required-name errors keep original redirects and retain entries on only this path."""
    path = '/internal-contacts/new' if mode == 'new' else f'/internal-contacts/{contacts[0]}/edit'
    values = {'name': '   ', 'alias': ' <raw> ', 'role': 'custom'}
    response = client.post(path, data=values)
    assert response.status_code == 302 and response.headers['Location'] == path
    with client.session_transaction() as session:
        assert ('danger', 'Name is required.') in session['_flashes']
    unrelated = parse(client.get(f'/internal-contacts/{contacts[1]}/edit'))
    assert unrelated.select_one('#icForm')['data-posted'] == 'false'
    soup = parse(client.get(path))
    assert [f['value'] for f in soup.select('#icForm input')] == list(values.values())
    assert soup.select_one('#icForm')['data-posted'] == 'true'
    assert parse(client.get(path)).select_one('#icForm')['data-posted'] == 'false'
    with app.app_context():
        assert InternalContact.query.count() == 2


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_required_redirect_renders_notification(client, contacts, mode):
    """Following the validation redirect renders the notice and retained raw input."""
    path = '/internal-contacts/new' if mode == 'new' else f'/internal-contacts/{contacts[0]}/edit'
    values = {'name': '   ', 'alias': ' <raw> ', 'role': 'custom'}
    response = client.post(path, data=values, follow_redirects=True)
    assert response.status_code == 200
    soup = parse(response)
    assert 'Name is required.' in soup.get_text()
    assert [field['value'] for field in soup.select('#icForm input')] == list(values.values())
    assert soup.select_one('#icForm')['data-posted'] == 'true'


def test_duplicate_workflows_remain_distinct(client, app, contacts):
    """New duplicate opens the saved existing contact; Edit duplicate retains the draft."""
    values = {'name': ' Draft ', 'alias': ' TAKEN@MICROSOFT.COM ', 'role': 'Custom'}
    response = client.post('/internal-contacts/new', data=values)
    assert response.headers['Location'] == f'/internal-contacts/{contacts[1]}/edit'
    assert parse(client.get(response.headers['Location'])).select_one('#name')['value'] == 'Other'
    path = f'/internal-contacts/{contacts[0]}/edit'
    response = client.post(path, data=values)
    assert response.headers['Location'] == path
    soup = parse(client.get(path))
    assert [f['value'] for f in soup.select('#icForm input')] == list(values.values())
    assert 'already used by Other' in soup.get_text()
    with app.app_context():
        assert db.session.get(InternalContact, contacts[0]).name == 'Original'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_failed_write_rollback_input_retention_and_retry(client, app, contacts, mode):
    """Failed writes retain escaped raw input, roll back, and permit explicit retry."""
    path = '/internal-contacts/new' if mode == 'new' else f'/internal-contacts/{contacts[0]}/edit'
    values = {'name': ' <Attempt & raw> ', 'alias': ' attempted ', 'role': ' <role> '}
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        response = client.post(path, data=values)
    assert response.status_code == 500
    soup = parse(response)
    assert [f['value'] for f in soup.select('#icForm input')] == list(values.values())
    assert not soup.select('attempt,role')
    assert 'Could not save the internal contact. Your entries are still here.' in soup.get_text()
    assert soup.select_one('#icForm')['data-posted'] == 'true'
    with app.app_context():
        assert InternalContact.query.count() == 2
        original = db.session.get(InternalContact, contacts[0])
        assert (original.name, original.alias, original.role) == ('Original', 'original', 'DAE')
    assert client.post(path, data=values).status_code == 302


def test_existing_directory_consumers_and_missing_edit(client, contacts):
    """Existing canonical creation and edit links still reach the same forms."""
    soup = parse(client.get('/internal-contacts'))
    assert soup.select_one('a[href="/internal-contacts/new"]')
    assert soup.select_one(f'a[href="/internal-contacts/{contacts[0]}/edit"]')
    assert client.get('/internal-contacts/999999/edit').status_code == 404
