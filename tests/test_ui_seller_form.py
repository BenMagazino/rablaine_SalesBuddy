"""Native seller editor contract, writes and failure retention in the isolated DB."""
import json
from unittest.mock import patch
from urllib.parse import urlsplit

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Seller, Territory, db


def parse(response):
    """Parse the rendered editor."""
    return BeautifulSoup(response.data, 'html.parser')


def path_for(data, editing):
    """Return the original New or Edit endpoint."""
    return f"/seller/{data['seller1_id']}/edit" if editing else '/seller/new'


@pytest.mark.parametrize('editing', [False, True])
def test_inventory(client, sample_data, editing):
    """Fields, defaults, reference scope, choices and inline payload remain exact."""
    soup = parse(client.get(path_for(sample_data, editing)))
    form = soup.select_one('#sellerForm')
    assert 'sb-directory-frame' in form['class']
    assert 'sb-directory-frame-wide' in form['class']
    seller = db.session.get(Seller, sample_data['seller1_id'])
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert {e['name'] for e in form.select('[name]')} == (
        {'name', 'alias', 'seller_type', 'territory_ids'} if editing
        else {'name', 'alias', 'seller_type'})
    assert {e['name'] for e in form.select('[required]')} == {'name'}
    assert form.select_one('#name')['type'] == 'text'
    assert form.select_one('#alias')['type'] == 'text'
    assert form.select_one('#name')['value'] == (seller.name if editing else '')
    assert form.select_one('#alias')['value'] == (seller.get_email() if editing else '')
    assert form.select_one('#seller_type option[selected]')['value'] == 'Growth'
    assert [e['value'] for e in form.select('#seller_type option')] == ['Growth', 'Acquisition']
    assert [e['value'] for e in form.select('[name="territory_ids"]')] == (
        [str(sample_data['territory1_id'])] if editing else [])
    names = [li.get_text(strip=True) for li in soup.select('.sf-existing li')]
    assert names == (['Bob Jones'] if editing else ['Alice Smith', 'Bob Jones'])
    choices = json.loads(soup.select_one('#sellerTerritories').string)
    assert [item['name'] for item in choices] == ['East Region', 'West Region']
    assert form.select_one('.sf-commands a')['href'] == '/sellers'
    inline = soup.select_one('#newTerritoryModal form')
    assert inline['action'] == '/territory/create-inline'
    assert {e['name'] for e in inline.select('[name]')} == {'name', 'redirect_to'}
    assert inline.select_one('[name="name"]').has_attr('required')
    assert inline.select_one('[name="redirect_to"]')['value'].endswith(path_for(
        sample_data, editing))
    for surface in [form, soup.select_one('#newTerritoryModal')]:
        assert not surface.select('.card, .btn, .form-control, .form-select, [data-bs-toggle]')
    assert soup.select_one('footer.sb-page-status')
    assert sum(urlsplit(script['src']).path.endswith('/ui-milestone-form.js')
               for script in soup.select('script[src]')) == 1
    assert sum(urlsplit(script['src']).path.endswith('/ui-save-wait.js')
               for script in soup.select('script[src]')) == 1


@pytest.mark.parametrize('editing', [False, True])
def test_save(client, sample_data, editing):
    """Normalization, multiple associations, all customers and redirects survive."""
    path = path_for(sample_data, editing)
    territories = [str(sample_data['territory1_id']), str(sample_data['territory2_id'])]
    response = client.post(path, data={
        'name': '  Updated Seller  ', 'alias': ' updated@microsoft.com ',
        'seller_type': 'Acquisition', 'territory_ids': territories,
    })
    seller = Seller.query.filter_by(name='Updated Seller').one()
    assert response.status_code == 302
    assert response.headers['Location'] == (f'/seller/{seller.id}' if editing else '/sellers')
    assert seller.alias == 'updated' and seller.seller_type == 'Acquisition'
    assert sorted(str(t.id) for t in seller.territories) == sorted(territories)
    assert len(seller.customers) == (2 if editing else 0)
    if editing:
        response = client.post(path, data={'name': seller.name})
        assert response.status_code == 302
        assert seller.alias is None and seller.seller_type == 'Growth'
        assert seller.territories == []


@pytest.mark.parametrize('editing', [False, True])
def test_empty_name_redirect_preserves_input(client, sample_data, editing):
    """The original validation redirect now retains all raw failed entries once."""
    path = path_for(sample_data, editing)
    response = client.post(path, data={
        'name': ' ', 'alias': '<raw>@microsoft.com', 'seller_type': 'Acquisition',
        'territory_ids': [str(sample_data['territory2_id'])],
    })
    assert response.status_code == 302 and response.headers['Location'] == path
    form = parse(client.get(path)).select_one('#sellerForm')
    assert form['data-posted'] == 'true'
    assert form.select_one('#name')['value'] == ' '
    assert form.select_one('#alias')['value'] == '<raw>@microsoft.com'
    assert form.select_one('#seller_type option[selected]')['value'] == 'Acquisition'
    assert form.select_one('[name="territory_ids"]')['value'] == str(
        sample_data['territory2_id'])
    assert parse(client.get(path)).select_one('#sellerForm')['data-posted'] == 'false'


@pytest.mark.parametrize('editing', [False, True])
def test_duplicate_redirects(client, sample_data, editing):
    """New still opens the existing seller; Edit stays on its original editor."""
    path = path_for(sample_data, editing)
    response = client.post(path, data={
        'name': 'Bob Jones', 'alias': 'draft', 'seller_type': 'Acquisition',
        'territory_ids': [str(sample_data['territory2_id'])],
    })
    assert response.status_code == 302
    assert response.headers['Location'] == (
        path if editing else f"/seller/{sample_data['seller2_id']}")
    if editing:
        form = parse(client.get(path)).select_one('#sellerForm')
        assert form.select_one('#name')['value'] == 'Bob Jones'
        assert form.select_one('#alias')['value'] == 'draft'
    assert Seller.query.count() == 2
    assert db.session.get(Seller, sample_data['seller1_id']).name == 'Alice Smith'


@pytest.mark.parametrize('editing', [False, True])
@pytest.mark.parametrize('failure', ['commit', 'invalid-territory'])
def test_failed_write_retains_payload_and_rolls_back(client, sample_data, editing, failure):
    """Honest write failures retain escaped raw fields and do not alter associations."""
    path = path_for(sample_data, editing)
    payload = {
        'name': '<Attempt & raw>', 'alias': '  raw@microsoft.com  ',
        'seller_type': 'Acquisition',
        'territory_ids': [str(sample_data['territory2_id'])
                          if failure == 'commit' else 'not-an-id'],
    }
    if failure == 'commit':
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('failure')):
            response = client.post(path, data=payload)
    else:
        response = client.post(path, data=payload)
    assert response.status_code == 500
    soup = parse(response)
    assert 'Could not save the seller. Your entries are still here.' in soup.get_text()
    form = soup.select_one('#sellerForm')
    assert form['data-posted'] == 'true'
    for name in ['name', 'alias']:
        assert form.select_one(f'[name="{name}"]')['value'] == payload[name]
    assert form.select_one('#seller_type option[selected]')['value'] == 'Acquisition'
    assert [e['value'] for e in form.select('[name="territory_ids"]')] == payload[
        'territory_ids']
    assert Seller.query.count() == 2
    seller = db.session.get(Seller, sample_data['seller1_id'])
    assert (seller.name, seller.alias, seller.seller_type) == (
        'Alice Smith', 'alices', 'Growth')
    assert [t.id for t in seller.territories] == [sample_data['territory1_id']]


def test_inline_territory_provider(client, sample_data):
    """The existing inline provider keeps name, redirect and duplicate behavior."""
    target = path_for(sample_data, True)
    for expected_count in [3, 3]:
        response = client.post('/territory/create-inline', data={
            'name': '  New territory  ', 'redirect_to': target})
        assert response.status_code == 302 and response.headers['Location'] == target
        assert Territory.query.count() == expected_count
    assert Territory.query.filter_by(name='New territory').one()


def test_safe_territory_names_and_empty_references(client):
    """Quotes and closing scripts stay data, and empty seller reference is omitted."""
    db.session.add(Territory(name="O'Brien </script> & West"))
    db.session.commit()
    soup = parse(client.get('/seller/new'))
    assert json.loads(soup.select_one('#sellerTerritories').string)[0]['name'] == (
        "O'Brien </script> & West")
    assert soup.select_one('.sf-existing') is None
