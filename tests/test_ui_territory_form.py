"""Native territory editor parity and isolated manual write regressions."""
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import POD, SolutionEngineer, Territory, db


def parse(response):
    """Parse an editor response."""
    return BeautifulSoup(response.data, 'html.parser')


def path_for(data, editing):
    """Return the unchanged manual POST endpoint."""
    return f"/territory/{data['territory1_id']}/edit" if editing else '/territory/new'


def relationships(territory):
    """Snapshot associations that renaming must not touch."""
    return (
        territory.pod_id, [item.id for item in territory.sellers],
        [item.id for item in territory.customers],
        [item.id for item in territory.solution_engineers], territory.created_at,
    )


def attach_coverage(territory):
    """Exercise nonempty POD and engineer associations as well as fixture coverage."""
    territory.pod = POD(name='Form parity POD')
    territory.solution_engineers.append(SolutionEngineer(name='Form parity engineer'))
    db.session.commit()


@pytest.mark.parametrize('editing', [False, True])
def test_inventory(client, sample_data, editing):
    """Exact name payload, requiredness, defaults, reference and native commands survive."""
    soup = parse(client.get(path_for(sample_data, editing)))
    form = soup.select_one('#territoryForm')
    assert 'sb-directory-frame' in form['class']
    assert 'sb-directory-frame-wide' in form['class']
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert [field['name'] for field in form.select('[name]')] == ['name']
    field = form.select_one('#name')
    assert field['type'] == 'text' and field.has_attr('required')
    assert field['value'] == ('West Region' if editing else '')
    assert not field.has_attr('maxlength')
    assert [li.get_text(strip=True) for li in form.select('.tf-existing li')] == (
        ['East Region'] if editing else ['East Region', 'West Region'])
    assert form.select_one('[data-territory-cancel]')['href'] == '/territories'
    assert form.select_one('#territoryFormSave')['type'] == 'submit'
    assert soup.select_one('footer.sb-page-status')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert not form.select('.card, .btn, .form-control, [data-bs-toggle]')


@pytest.mark.parametrize('editing', [False, True])
def test_save(client, sample_data, editing):
    """Trim names without changing relationships, creation defaults or original redirects."""
    territory = db.session.get(Territory, sample_data['territory1_id'])
    attach_coverage(territory)
    before = relationships(territory)
    response = client.post(path_for(sample_data, editing), data={'name': '  New name  '})
    saved = Territory.query.filter_by(name='New name').one()
    assert response.status_code == 302
    assert response.headers['Location'] == (
        f'/territory/{saved.id}' if editing else '/territories')
    if editing:
        assert saved.id == territory.id and relationships(saved) == before
    else:
        assert saved.pod_id is None and saved.created_at
        assert saved.sellers == [] and saved.customers == [] and saved.solution_engineers == []
    assert Territory.query.count() == (2 if editing else 3)


@pytest.mark.parametrize('editing', [False, True])
def test_required_redirect_retains_input_once(client, sample_data, editing):
    """Original blank-name redirects retain raw input, scoped to the matching editor."""
    path = path_for(sample_data, editing)
    response = client.post(path, data={'name': '   '})
    assert response.status_code == 302 and response.headers['Location'] == path
    other = '/territory/new' if editing else f"/territory/{sample_data['territory1_id']}/edit"
    other_soup = parse(client.get(other))
    assert other_soup.select_one('#territoryForm')['data-posted'] == 'false'
    assert 'Territory name is required.' in other_soup.get_text()
    soup = parse(client.get(path))
    assert soup.select_one('#territoryForm')['data-posted'] == 'true'
    assert soup.select_one('#name')['value'] == '   '
    assert parse(client.get(path)).select_one('#territoryForm')['data-posted'] == 'false'
    assert Territory.query.count() == 2


@pytest.mark.parametrize('editing', [False, True])
def test_duplicate_redirects(client, sample_data, editing):
    """New opens the duplicate; Edit remains on its editor and retains attempted input."""
    path = path_for(sample_data, editing)
    response = client.post(path, data={'name': '  East Region  '})
    assert response.status_code == 302
    assert response.headers['Location'] == (
        path if editing else f"/territory/{sample_data['territory2_id']}")
    if editing:
        assert parse(client.get(path)).select_one('#name')['value'] == '  East Region  '
    assert Territory.query.count() == 2
    assert db.session.get(Territory, sample_data['territory1_id']).name == 'West Region'


@pytest.mark.parametrize('editing', [False, True])
def test_failed_save_rolls_back_and_retains_raw_input(client, sample_data, editing):
    """Database failures preserve escaped raw entries, relationships and retryability."""
    path = path_for(sample_data, editing)
    territory = db.session.get(Territory, sample_data['territory1_id'])
    attach_coverage(territory)
    before = relationships(territory)
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('failure')):
        response = client.post(path, data={'name': '  <Attempt & raw>  '})
    soup = parse(response)
    assert response.status_code == 500
    assert 'Could not save the territory. Your entries are still here.' in soup.get_text()
    assert soup.select_one('#territoryForm')['data-posted'] == 'true'
    assert soup.select_one('#name')['value'] == '  <Attempt & raw>  '
    assert not soup.select('attempt')
    assert Territory.query.count() == 2
    territory = db.session.get(Territory, sample_data['territory1_id'])
    assert territory.name == 'West Region' and relationships(territory) == before
    assert client.post(path, data={'name': 'Retry name'}).status_code == 302


def test_same_name_edit_and_missing_record(client, sample_data):
    """Unchanged names are allowed and missing editors remain 404."""
    assert client.post(path_for(sample_data, True), data={'name': 'West Region'}).status_code == 302
    assert client.get('/territory/999999/edit').status_code == 404
    assert client.post('/territory/999999/edit', data={'name': 'No record'}).status_code == 404


def test_empty_reference_and_inline_provider_unchanged(client):
    """Empty reference is absent and the inline territory provider retains its POST behavior."""
    assert not parse(client.get('/territory/new')).select('.tf-existing')
    for count in [1, 1]:
        response = client.post('/territory/create-inline', data={
            'name': '  Inline territory  ', 'redirect_to': '/seller/new',
        })
        assert response.status_code == 302 and response.headers['Location'] == '/seller/new'
        assert Territory.query.count() == count
