"""Native Specialty manual forms, tested only against the isolated fixture database."""

from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Partner, Specialty, db


@pytest.fixture
def specialties(app, sample_data):
    """Create nullable context, duplicate names and a real partner association."""
    with app.app_context():
        first = Specialty(name='Original', description=None)
        other = Specialty(name='Taken', description='Existing context')
        partner = Partner(name='Linked', specialties=[first])
        db.session.add_all([partner, other])
        db.session.commit()
        return first.id, other.id, partner.id


def parse(response):
    """Parse the owned form surface."""
    return BeautifulSoup(response.data, 'html.parser')


def form_path(mode, specialties):
    """Resolve the two existing manual form paths."""
    return '/specialties/new' if mode == 'new' else f'/specialties/{specialties[0]}/edit'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_exact_original_contract(client, specialties, mode):
    """Keep field order/types/defaults/requiredness and distinct command labels."""
    soup = parse(client.get(form_path(mode, specialties)))
    form = soup.select_one('#specialtyForm')
    assert 'sb-directory-frame' in form['class']
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert [field['name'] for field in form.select('[name]')] == ['name', 'description']
    name = form.select_one('#name')
    assert name['type'] == 'text' and name.has_attr('required')
    assert not name.has_attr('maxlength') and not name.has_attr('autofocus')
    assert name['value'] == ('' if mode == 'new' else 'Original')
    description = form.select_one('#description')
    assert description['rows'] == '3' and not description.has_attr('required')
    assert description.get_text() == ''
    assert form.select_one('[data-specialty-cancel]')['href'] == '/specialties'
    assert form.select_one('[type=submit]').get_text(strip=True) == (
        'Create Specialty' if mode == 'new' else 'Save Changes')
    assert not form.select('.card,.btn,.form-control,form,[onclick],[onsubmit]')
    assert soup.select_one('body.sb-page-frame')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert soup.select_one('#specialtyFormDiscard [autofocus]').get_text() == 'Keep editing'


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_success_trim_null_redirect_and_relationships(client, app, specialties, mode):
    """Both forms redirect to detail, trim strings and never rewrite partner links."""
    with app.app_context():
        created = db.session.get(Specialty, specialties[0]).created_at
    response = client.post(form_path(mode, specialties),
                           data={'name': ' Revised ', 'description': ' Context\nmore '})
    with app.app_context():
        saved = Specialty.query.filter_by(name='Revised').one()
        assert saved.description == 'Context\nmore'
        saved_id = saved.id
        linked = db.session.get(Specialty, specialties[0])
        assert [partner.id for partner in linked.partners] == [specialties[2]]
        assert linked.created_at == created
    assert response.status_code == 302
    assert response.headers['Location'] == f'/specialties/{saved_id}'
    assert client.post(f'/specialties/{saved_id}/edit',
                       data={'name': 'Revised', 'description': ' '}).status_code == 302
    with app.app_context():
        assert db.session.get(Specialty, saved_id).description is None


@pytest.mark.parametrize('mode', ['new', 'edit'])
@pytest.mark.parametrize('name, message', [
    ('   ', 'Specialty name is required'),
    (' tAkEn ', 'Specialty "tAkEn" already exists'),
])
def test_validation_original_redirect_raw_input_once(client, app, specialties, mode, name, message):
    """Required/case-insensitive duplicate redirects retain escaped path-local input."""
    path = form_path(mode, specialties)
    values = {'name': name, 'description': ' <raw> & context '}
    response = client.post(path, data=values)
    assert response.status_code == 302
    assert response.headers['Location'] == f'http://localhost{path}'
    with client.session_transaction() as session:
        assert ('error', message) in session['_flashes']
    other = parse(client.get(f'/specialties/{specialties[1]}/edit'))
    assert other.select_one('#specialtyForm')['data-posted'] == 'false'
    soup = parse(client.get(path))
    assert soup.select_one('#name')['value'] == name
    assert soup.select_one('#description').get_text() == values['description']
    assert soup.select_one('#specialtyForm')['data-posted'] == 'true'
    assert parse(client.get(path)).select_one('#specialtyForm')['data-posted'] == 'false'
    direct = parse(client.post(path, data=values, follow_redirects=True))
    assert message in direct.get_text()
    with app.app_context():
        assert db.session.get(Specialty, specialties[0]).name == 'Original'
        assert Specialty.query.filter(db.func.lower(Specialty.name) == 'taken').count() == 1


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_failure_rollback_log_retained_input_and_retry(client, app, specialties, mode, caplog):
    """Failed database writes leave no partial record or relationship and allow retry."""
    path = form_path(mode, specialties)
    values = {'name': ' <Attempt & raw> ', 'description': ' <script>context</script> '}
    with app.app_context():
        count = Specialty.query.count()
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        response = client.post(path, data=values)
    assert response.status_code == 500
    soup = parse(response)
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#description').get_text() == values['description']
    assert not soup.select_one('#description script')
    assert soup.select_one('#specialtyForm')['data-posted'] == 'true'
    assert 'Could not save the specialty. Your entries are still here.' in soup.get_text()
    assert path in caplog.text
    with app.app_context():
        assert Specialty.query.count() == count
        saved = db.session.get(Specialty, specialties[0])
        assert saved.name == 'Original' and saved.description is None
        assert [partner.id for partner in saved.partners] == [specialties[2]]
    assert client.post(path, data=values).status_code == 302


def test_actual_consumers_self_duplicate_and_immediate_api(client, app, specialties):
    """Standalone links and immediate API remain distinct from manual specialty editing."""
    assert parse(client.get('/specialties')).select_one('a[href="/specialties/new"]')
    assert parse(client.get(f'/specialties/{specialties[0]}')).select_one(
        f'a[href="/specialties/{specialties[0]}/edit"]')
    assert client.get('/specialties/999999/edit').status_code == 404
    path = f'/specialties/{specialties[0]}/edit'
    assert client.post(path, data={'name': ' original '}).headers['Location'] == (
        f'/specialties/{specialties[0]}')
    existing = client.post('/api/specialties/create', json={'name': ' ORIGINAL '}).json
    assert existing['existed'] and existing['id'] == specialties[0]
    created = client.post('/api/specialties/create', json={'name': ' Immediate '}).json
    assert created['existed'] is False
    with app.app_context():
        assert db.session.get(Specialty, created['id']).description is None
        assert [s.id for s in db.session.get(Partner, specialties[2]).specialties] == [specialties[0]]
    partner_form = parse(client.get(f'/partners/{specialties[2]}/edit'))
    assert 'saves a specialty immediately' in partner_form.get_text()
    assert str(created['id']) in partner_form.select_one('#partnerSpecialtyData').get_text()
