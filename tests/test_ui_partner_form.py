"""Native Partner manual forms and immediate specialty writes in the isolated database."""

from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Partner, PartnerContact, Specialty, db


@pytest.fixture
def records(app, sample_data):
    """Seed associations, null/zero rating and safe mocked backup/favicon consumers."""
    with app.app_context():
        first = Specialty(name='Expertise "quoted" <tag>', description='Context & detail')
        second = Specialty(name='Another')
        partner = Partner(name='Original', rating=0, overview=None,
                          website='example.com', favicon_b64='original')
        partner.specialties = [first, second]
        partner.contacts = [PartnerContact(name='Contact', email='person@example.com',
                                          title='Role', is_primary=True)]
        db.session.add(partner)
        db.session.commit()
        ids = partner.id, first.id, second.id, partner.contacts[0].id
    with patch('app.routes.partners.backup_partner') as backup, \
            patch('app.routes.partners.fetch_favicon_for_domain', return_value='new-icon') as icon:
        yield ids, backup, icon


def parse(response):
    """Parse owned rendered markup."""
    return BeautifulSoup(response.data, 'html.parser')


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_exact_fields_and_defaults(client, records, mode):
    """Original fields, destinations and actions remain, without invented contacts/color."""
    ids, _, _ = records
    path = '/partners/new' if mode == 'new' else f'/partners/{ids[0]}/edit'
    soup = parse(client.get(path))
    form = soup.select_one('#partnerForm')
    assert 'sb-directory-frame' in form['class']
    assert form['method'] == 'post' and not form.has_attr('action')
    assert {f['name'] for f in form.select('[name]')} == {
        'name', 'website', 'rating', 'overview', *(['specialty_ids'] if mode == 'edit' else [])}
    assert form.select_one('#name').has_attr('required')
    assert form.select_one('#name').has_attr('autofocus')
    assert form.select_one('#website')['type'] == 'text'
    assert form.select_one('#rating')['type'] == 'hidden'
    assert form.select_one('#rating')['value'] == ('0' if mode == 'edit' else '')
    assert form.select_one('#clear-rating').has_attr('hidden') == (mode == 'new')
    assert form.select_one('#notes').get_text() == ''
    assert form.select_one('#notes')['rows'] == '5'
    assert form.select_one('[data-partner-cancel]')['href'] == (
        f'/partners/{ids[0]}' if mode == 'edit' else '/partners')
    assert form.select_one('[type=submit]').get_text(strip=True) == (
        'Save Changes' if mode == 'edit' else 'Create Partner')
    assert not form.select('.card,.btn,.form-control,[onclick],form')
    assert soup.select_one('body.sb-page-frame')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert len(soup.select('script[src$="ui-partner-form.js"]')) == 1
    assert 'saves a specialty immediately' in form.get_text()
    if mode == 'edit':
        assert [f['value'] for f in form.select('[name=specialty_ids]')] == [
            str(ids[1]), str(ids[2])]
        assert form.select_one('[data-remove-specialty]')['aria-label'].startswith(
            'Remove Expertise')


@pytest.mark.parametrize('mode', ['new', 'edit'])
@pytest.mark.parametrize('rating, expected', [('', None), ('0', 0), ('5', 5), ('9', None)])
def test_manual_save_contract(client, app, records, mode, rating, expected):
    """Trim, normalize, resolve associations and preserve contacts and original redirect."""
    ids, backup, icon = records
    path = '/partners/new' if mode == 'new' else f'/partners/{ids[0]}/edit'
    response = client.post(path, data={
        'name': ' Revised ', 'website': ' https://www.example.com/path ',
        'rating': rating, 'overview': ' Context\nmore ', 'specialty_ids': [str(ids[2])],
    })
    assert response.status_code == 302
    with app.app_context():
        saved = Partner.query.filter_by(name='Revised').one()
        assert saved.rating == expected
        assert saved.website == 'example.com'
        assert saved.overview == 'Context\nmore'
        assert [s.id for s in saved.specialties] == [ids[2]]
        assert response.headers['Location'] == f'/partners/{saved.id}'
        backup.assert_called_once_with(saved.id)
        if mode == 'edit':
            assert [c.id for c in saved.contacts] == [ids[3]]
            assert saved.contacts[0].title == 'Role' and saved.contacts[0].is_primary
            icon.assert_not_called()
        else:
            icon.assert_called_once_with('example.com')


def test_clear_optional_values_and_keep_note_links(client, app, records, sample_data):
    """Clearing selects and optional fields does not remove contacts or linked notes."""
    from app.models import Note
    ids, _, icon = records
    with app.app_context():
        partner = db.session.get(Partner, ids[0])
        note = Note.query.first()
        partner.notes.append(note)
        db.session.commit()
        note_id = note.id
    assert client.post(f'/partners/{ids[0]}/edit', data={'name': 'Original'}).status_code == 302
    with app.app_context():
        partner = db.session.get(Partner, ids[0])
        assert partner.specialties == []
        assert partner.rating is partner.website is partner.favicon_b64 is partner.overview is None
        assert [n.id for n in partner.notes] == [note_id]
        assert [c.id for c in partner.contacts] == [ids[3]]
    icon.assert_not_called()


@pytest.mark.parametrize('mode', ['new', 'edit'])
@pytest.mark.parametrize('invalid', ['name', 'rating'])
def test_validation_redirect_retains_raw_entries(client, records, mode, invalid):
    """Name and malformed integer errors keep original redirects and repeated values."""
    ids, backup, _ = records
    path = '/partners/new' if mode == 'new' else f'/partners/{ids[0]}/edit'
    values = {'name': '   ' if invalid == 'name' else 'Draft', 'website': ' raw.example ',
              'overview': ' <script>raw</script> ',
              'rating': 'bad' if invalid == 'rating' else '0',
              'specialty_ids': [str(ids[2])]}
    response = client.post(path, data=values)
    assert response.status_code == 302 and response.headers['Location'].endswith(path)
    soup = parse(client.get(path))
    assert soup.select_one('#partnerForm')['data-posted'] == 'true'
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#notes').get_text() == values['overview']
    assert not soup.select_one('#notes script')
    assert soup.select_one('[name=specialty_ids]')['value'] == str(ids[2])
    message = 'Partner name is required' if invalid == 'name' else 'Rating must be'
    assert message in soup.get_text()
    assert parse(client.get(path)).select_one('#partnerForm')['data-posted'] == 'false'
    backup.assert_not_called()


@pytest.mark.parametrize('mode', ['new', 'edit'])
def test_write_error_rolls_back_and_retries(client, app, records, mode):
    """Failures visibly retain raw entries and associations, without claiming a save."""
    ids, backup, _ = records
    path = '/partners/new' if mode == 'new' else f'/partners/{ids[0]}/edit'
    values = {'name': ' <Attempt> ', 'overview': ' raw & notes ', 'rating': '2',
              'specialty_ids': [str(ids[2])]}
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        response = client.post(path, data=values)
    assert response.status_code == 500
    soup = parse(response)
    assert 'Could not save the partner. Your entries are still here.' in soup.get_text()
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#notes').get_text() == values['overview']
    with app.app_context():
        assert Partner.query.filter_by(name='<Attempt>').count() == 0
        original = db.session.get(Partner, ids[0])
        assert original.name == 'Original' and original.rating == 0
        assert len(original.specialties) == 2
    backup.assert_not_called()
    assert client.post(path, data=values).status_code == 302


def test_immediate_specialty_payload_dedup_and_failures(client, app, records):
    """Immediate creation stays separate from unsaved partner associations and handles errors."""
    ids, backup, _ = records
    response = client.post('/api/specialties/create', json={'name': ' Immediate '})
    assert response.status_code == 200
    assert set(response.json) == {'id', 'name', 'description', 'existed'}
    assert response.json['name'] == 'Immediate' and response.json['existed'] is False
    existing = client.post('/api/specialties/create', json={'name': ' immediate '})
    assert existing.json['id'] == response.json['id'] and existing.json['existed'] is True
    for payload in [None, [], {'name': 4}, {'name': ''}]:
        assert client.post('/api/specialties/create', json=payload).status_code == 400
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        failure = client.post('/api/specialties/create', json={'name': 'Failed specialty'})
    assert failure.status_code == 503 and 'Could not create' in failure.json['error']
    with app.app_context():
        assert Specialty.query.filter_by(name='Failed specialty').count() == 0
        assert len(db.session.get(Partner, ids[0]).specialties) == 2
    backup.assert_not_called()
    retry = client.post('/api/specialties/create', json={'name': 'Failed specialty'})
    assert retry.status_code == 200


def test_existing_consumers_and_missing_edit(client, records):
    """The original directory/detail links still reach the same standalone forms."""
    ids, _, _ = records
    assert parse(client.get('/partners')).select_one('a[href="/partners/new"]')
    assert parse(client.get(f'/partners/{ids[0]}')).select_one(
        f'a[href="/partners/{ids[0]}/edit"]')
    assert client.get('/partners/999999/edit').status_code == 404
