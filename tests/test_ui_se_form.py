"""Solution Engineer manual edit parity using the isolated test database."""

from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.datastructures import MultiDict

from app.models import POD, SolutionEngineer, Territory, db


@pytest.fixture
def engineer(app):
    """Create nonempty coverage with an unrelated engineer and POD."""
    with app.app_context():
        a, z = POD(name='A POD'), POD(name='Z POD')
        territory = Territory(name='Direct territory')
        se = SolutionEngineer(name='Original', alias='original', specialty='Azure Data',
                              pods=[z], territories=[territory])
        other = SolutionEngineer(name='Other', pods=[a])
        db.session.add_all([se, other])
        db.session.commit()
        return {'id': se.id, 'a': a.id, 'z': z.id, 'other': other.id,
                'territory': territory.id}


def parse(response):
    """Parse a rendered form response."""
    return BeautifulSoup(response.data, 'html.parser')


def edit_path(engineer):
    """Return the unchanged edit POST endpoint."""
    return f"/solution-engineer/{engineer['id']}/edit"


def test_original_fields_defaults_and_consumers(client, engineer):
    """Editable identity, exact specialty options and alphabetical PODs remain."""
    soup = parse(client.get(edit_path(engineer)))
    form = soup.select_one('#seForm')
    assert 'sb-directory-frame' in form['class']
    assert 'sb-page-frame' in soup.body['class']
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert [field['name'] for field in form.select('[name]')] == [
        'name', 'alias', 'specialty', 'pod_ids', 'pod_ids',
    ]
    assert form.select_one('#name')['value'] == 'Original'
    assert form.select_one('#name').has_attr('required')
    assert form.select_one('#name')['type'] == form.select_one('#alias')['type'] == 'text'
    assert not form.select_one('#alias').has_attr('required')
    assert form.select_one('#alias')['value'] == 'original'
    assert form.select_one('#alias')['placeholder'] == 'e.g., jsmith'
    assert '@microsoft.com' in form.get_text()
    assert [o['value'] for o in form.select('#specialty option')] == [
        '', 'Azure Data', 'Azure Core and Infra', 'Azure Apps and AI',
    ]
    assert form.select_one('#specialty option[selected]')['value'] == 'Azure Data'
    boxes = form.select('[name="pod_ids"]')
    assert [b['value'] for b in boxes] == [str(engineer['a']), str(engineer['z'])]
    assert [b.has_attr('checked') for b in boxes] == [False, True]
    assert form.select_one('[data-se-cancel]')['href'] == f"/solution-engineer/{engineer['id']}"
    assert not form.select('.card,.btn,.badge,.form-control,[onchange],[onclick],[readonly]')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert not form.select('[maxlength]')
    for path in ['/solution-engineers', f"/solution-engineer/{engineer['id']}"]:
        assert parse(client.get(path)).select_one(f'a[href="{edit_path(engineer)}"]')
    assert client.get('/solution-engineer/new').status_code == 404


def test_success_updates_only_original_fields_and_pods(app, client, engineer):
    """Trim identity, replace PODs and retain direct territories and other records."""
    with app.app_context():
        before = db.session.get(SolutionEngineer, engineer['id']).created_at
    response = client.post(edit_path(engineer), data=MultiDict([
        ('name', '  Revised  '), ('alias', '  revised  '),
        ('specialty', '  Azure Apps and AI  '), ('pod_ids', str(engineer['a'])),
        ('pod_ids', str(engineer['z'])),
    ]))
    assert response.status_code == 302
    assert response.headers['Location'] == f"/solution-engineer/{engineer['id']}"
    with app.app_context():
        se = db.session.get(SolutionEngineer, engineer['id'])
        assert (se.name, se.alias, se.specialty) == ('Revised', 'revised', 'Azure Apps and AI')
        assert {p.id for p in se.pods} == {engineer['a'], engineer['z']}
        assert [t.id for t in se.territories] == [engineer['territory']]
        assert se.created_at == before
        assert [p.id for p in db.session.get(SolutionEngineer, engineer['other']).pods] == [
            engineer['a'],
        ]
        assert SolutionEngineer.query.count() == 2


def test_blank_optionals_and_clear_pods(client, app, engineer):
    """Omitted IDs clear coverage and blank optional strings become None."""
    assert client.post(edit_path(engineer), data={'name': 'Original', 'alias': '  ',
                                                 'specialty': ''}).status_code == 302
    with app.app_context():
        se = db.session.get(SolutionEngineer, engineer['id'])
        assert se.alias is None and se.specialty is None and se.pods == []
        assert [t.id for t in se.territories] == [engineer['territory']]


def test_required_redirect_retains_raw_fields_once_on_matching_editor(client, app, engineer):
    """Required-name validation keeps original redirect, selections and raw input."""
    values = {'name': '   ', 'alias': ' <raw> ', 'specialty': 'Azure Core and Infra',
              'pod_ids': str(engineer['a'])}
    response = client.post(edit_path(engineer), data=values)
    assert response.status_code == 302 and response.headers['Location'] == edit_path(engineer)
    other = parse(client.get(f"/solution-engineer/{engineer['other']}/edit"))
    assert other.select_one('#seForm')['data-posted'] == 'false'
    soup = parse(client.get(edit_path(engineer)))
    assert soup.select_one('#seForm')['data-posted'] == 'true'
    assert soup.select_one('#name')['value'] == values['name']
    assert soup.select_one('#alias')['value'] == values['alias']
    assert soup.select_one('#specialty option[selected]')['value'] == values['specialty']
    assert soup.select_one('[name="pod_ids"][checked]')['value'] == str(engineer['a'])
    assert parse(client.get(edit_path(engineer))).select_one('#seForm')['data-posted'] == 'false'
    with app.app_context():
        assert db.session.get(SolutionEngineer, engineer['id']).name == 'Original'


def test_failed_commit_retains_input_rolls_back_and_can_retry(client, app, engineer):
    """Storage failure keeps raw escaped identity and PODs without partial writes."""
    values = {'name': '  <Attempt & raw>  ', 'alias': ' raw ',
              'specialty': 'Azure Apps and AI', 'pod_ids': str(engineer['a'])}
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated failure')):
        response = client.post(edit_path(engineer), data=values)
    assert response.status_code == 500
    soup = parse(response)
    assert 'Could not save the solution engineer. Your entries are still here.' in soup.get_text()
    assert soup.select_one('#name')['value'] == values['name']
    assert not soup.select('attempt')
    assert soup.select_one('#alias')['value'] == values['alias']
    assert soup.select_one('[name="pod_ids"][checked]')['value'] == str(engineer['a'])
    assert soup.select_one('#seForm')['data-posted'] == 'true'
    with app.app_context():
        se = db.session.get(SolutionEngineer, engineer['id'])
        assert (se.name, se.alias, se.specialty) == ('Original', 'original', 'Azure Data')
        assert [p.id for p in se.pods] == [engineer['z']]
        assert [t.id for t in se.territories] == [engineer['territory']]
    assert client.post(edit_path(engineer), data=values).status_code == 302


def test_invalid_pod_and_original_missing_id_behavior(client, app, engineer):
    """Malformed IDs return an honest failure; absent records remain ignored."""
    response = client.post(edit_path(engineer), data={
        'name': 'Draft', 'alias': 'draft', 'specialty': 'Azure Data',
        'pod_ids': ['bad', str(engineer['a'])],
    })
    assert response.status_code == 400
    soup = parse(response)
    assert soup.select_one('#name')['value'] == 'Draft'
    assert soup.select_one('[name="pod_ids"][checked]')['value'] == str(engineer['a'])
    with app.app_context():
        assert db.session.get(SolutionEngineer, engineer['id']).name == 'Original'
    response = client.post(edit_path(engineer), data={
        'name': 'Draft', 'pod_ids': [str(engineer['a']), str(engineer['a']), '999999'],
    })
    assert response.status_code == 302
    with app.app_context():
        assert [p.id for p in db.session.get(SolutionEngineer, engineer['id']).pods] == [
            engineer['a'],
        ]


def test_empty_choices_missing_records_and_existing_specialty_behavior(app, client):
    """No new workflow or specialty restrictions, and empty POD guidance survives."""
    with app.app_context():
        se = SolutionEngineer(name='Empty', specialty='Other specialty')
        db.session.add(se)
        db.session.commit()
        se_id = se.id
    path = f'/solution-engineer/{se_id}/edit'
    soup = parse(client.get(path))
    assert not soup.select('[name="pod_ids"]')
    assert 'Create PODs by importing your accounts from MSX.' in soup.get_text()
    assert len(soup.select('#specialty option')) == 4
    assert not soup.select('#specialty option[selected]')
    assert client.post(path, data={'name': 'Empty', 'specialty': 'Other specialty'}).status_code == 302
    with app.app_context():
        assert db.session.get(SolutionEngineer, se_id).specialty == 'Other specialty'
    assert client.get('/solution-engineer/999999/edit').status_code == 404
    assert client.post('/solution-engineer/999999/edit', data={'name': 'Missing'}).status_code == 404
