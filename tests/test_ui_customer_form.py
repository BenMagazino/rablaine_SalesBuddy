"""Manual customer editor parity and failures, using the isolated test database."""
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, CustomerCSAM, UserPreference, db


def parse(response):
    """Return the parsed form response."""
    return BeautifulSoup(response.data, 'html.parser')


@pytest.mark.parametrize('editing', [False, True])
def test_inventory(client, sample_data, editing):
    """All original names, constraints, prepopulation and destinations survive."""
    customer = db.session.get(Customer, sample_data['customer1_id'])
    customer.nickname = '<short & safe>'
    customer.tpid_url = 'https://example.com/?a=1&b=2'
    customer.website = 'example.com'
    csam = CustomerCSAM(name='A & B', alias='ab')
    customer.available_csams.append(csam)
    db.session.commit()
    customer.csam_id = csam.id
    db.session.commit()
    response = client.get(f'/customer/{customer.id}/edit' if editing else '/customer/new')
    soup = parse(response)
    form = soup.select_one('#customerForm')
    assert response.status_code == 200
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert {e['name'] for e in form.select('[name]')} == {
        'referrer', 'name', 'nickname', 'tpid', 'tpid_url', 'website', 'seller_id',
        'territory_id',
    } | ({'csam_id'} if editing else set())
    assert {e['name'] for e in form.select('[required]')} == {'name', 'tpid'}
    assert form.select_one('#tpid')['type'] == 'number'
    assert form.select_one('#tpid')['min'] == '0'
    assert form.select_one('#tpid')['step'] == '1'
    assert form.select_one('#nickname')['maxlength'] == '200'
    assert form.select_one('#tpid_url')['type'] == 'url'
    assert form.select_one('#tpid_url')['maxlength'] == '500'
    assert form.select_one('#website')['maxlength'] == '500'
    assert form.select_one('#name')['value'] == (customer.name if editing else '')
    assert form.select_one('#nickname')['value'] == (customer.nickname if editing else '')
    assert form.select_one('#tpid_url')['value'] == (customer.tpid_url if editing else '')
    assert form.select_one('#website')['value'] == (customer.website if editing else '')
    if editing:
        assert form.select_one('#seller_id option[selected]')['value'] == str(customer.seller_id)
        assert form.select_one('#territory_id option[selected]')['value'] == str(
            customer.territory_id)
        assert form.select_one('#csam_id option[selected]')['value'] == str(csam.id)
    assert form.select_one('.cf-commands a')['href'] == '/customers'
    assert soup.select_one('a[href="/territory/new"]')['target'] == '_blank'
    inline = soup.select_one('#newSellerModal form')
    assert inline['action'] == '/seller/create-inline'
    assert {e['name'] for e in inline.select('[name]')} == {'name', 'redirect_to'}
    assert inline.select_one('[name="name"]').has_attr('required')
    assert soup.select_one('footer.sb-page-status')
    assert not form.select('.card, .btn, .form-control, .form-select, .row')
    assert len(soup.select('script[src$="ui-milestone-form.js"]')) == 1
    assert not form.select('[name="vertical"], [name="color"], [name="owner"], [name="se"]')


@pytest.mark.parametrize('param', ['seller_id', 'territory_id'])
def test_preselection(client, sample_data, param):
    """Single related seller/territory preselection remains server-owned."""
    value = sample_data['seller1_id' if param == 'seller_id' else 'territory1_id']
    form = parse(client.get(f'/customer/new?{param}={value}')).select_one('#customerForm')
    assert form.select_one('#seller_id option[selected]')['value'] == str(sample_data['seller1_id'])
    assert form.select_one('#territory_id option[selected]')['value'] == str(
        sample_data['territory1_id'])


@pytest.mark.parametrize('editing', [False, True])
@pytest.mark.parametrize('role', ['se', 'dss', 'seller-session'])
def test_roles(client, sample_data, editing, role):
    """SE choices and DSS/session hidden seller payloads remain exactly scoped."""
    pref = UserPreference.query.first()
    if pref is None:
        pref = UserPreference()
        db.session.add(pref)
    pref.user_role = 'dss' if role == 'dss' else 'se'
    pref.my_seller_id = sample_data['seller1_id'] if role == 'dss' else None
    db.session.commit()
    if role == 'seller-session':
        with client.session_transaction() as session:
            session['seller_mode_seller_id'] = sample_data['seller1_id']
    path = f"/customer/{sample_data['customer1_id']}/edit" if editing else '/customer/new'
    soup = parse(client.get(path))
    field = soup.select_one('#customerForm [name="seller_id"]')
    if role == 'se':
        assert field.name == 'select'
        assert soup.select_one('[data-sb-dialog="newSellerModal"]')
    else:
        assert field['type'] == 'hidden' and field['value'] == str(sample_data['seller1_id'])
        assert soup.select_one('[data-sb-dialog="newSellerModal"]') is None
        assert '-seller-' in soup.select_one('#customerForm')['data-form-key']


@pytest.mark.parametrize('editing', [False, True])
@pytest.mark.parametrize('error', ['name', 'missing-tpid', 'invalid-tpid', 'duplicate', 'commit'])
def test_failures_retain_entries(client, sample_data, editing, error):
    """Raw failed entries stay escaped; transaction failure never mutates existing records."""
    customer = db.session.get(Customer, sample_data['customer1_id'])
    original = (customer.name, customer.tpid, customer.website)
    original_count = Customer.query.count()
    payload = {'name': ' <script>draft</script> ', 'nickname': ' <short> ',
               'tpid': '8001234', 'tpid_url': 'https://example.com/?a=1&b=2',
               'website': '', 'seller_id': str(sample_data['seller1_id']),
               'territory_id': str(sample_data['territory1_id']), 'referrer': '/customers'}
    if error == 'name':
        payload['name'] = ' '
    elif error == 'missing-tpid':
        payload['tpid'] = ''
    elif error == 'invalid-tpid':
        payload['tpid'] = 'bad'
    elif error == 'duplicate':
        payload['tpid'] = str(db.session.get(Customer, sample_data['customer2_id']).tpid)
    path = f'/customer/{customer.id}/edit' if editing else '/customer/new'
    with patch('app.routes.customers._schedule_customer_backup') as backup:
        if error == 'commit':
            with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('isolated')):
                response = client.post(path, data=payload)
        else:
            response = client.post(path, data=payload)
        backup.assert_not_called()
    assert response.status_code == (500 if error == 'commit' else 400)
    soup = parse(response)
    for name in ['name', 'nickname', 'tpid', 'tpid_url', 'website', 'referrer']:
        assert soup.select_one(f'#customerForm [name="{name}"]')['value'] == payload[name]
    assert soup.select_one('#seller_id option[selected]')['value'] == payload['seller_id']
    assert not soup.select_one('#customerForm script')
    assert b'created successfully' not in response.data
    assert b'updated successfully' not in response.data
    db.session.expire_all()
    saved = db.session.get(Customer, customer.id)
    assert (saved.name, saved.tpid, saved.website) == original
    assert Customer.query.count() == original_count


@pytest.mark.parametrize('editing', [False, True])
def test_save_and_enrichment(client, sample_data, editing):
    """Exact trimming/null semantics, edit-only favicon/backup, and redirects survive."""
    customer = db.session.get(Customer, sample_data['customer1_id'])
    payload = {'name': ' Saved ', 'nickname': ' ', 'tpid': '880022',
               'tpid_url': ' https://example.com/ ', 'website': ' example.com ',
               'seller_id': '', 'territory_id': '', 'referrer': '/customers?origin=test'}
    path = f'/customer/{customer.id}/edit' if editing else '/customer/new'
    with patch('app.routes.admin.fetch_favicon_for_domain', return_value='image') as favicon, \
            patch('app.routes.customers._schedule_customer_backup') as backup:
        response = client.post(path, data=payload)
        assert favicon.call_count == int(editing)
        assert backup.call_count == int(editing)
    saved = db.session.get(Customer, customer.id) if editing else Customer.query.filter_by(
        tpid=880022).one()
    assert response.status_code == 302
    assert response.location.endswith(f'/customer/{saved.id}' if editing
                                      else '/customers?origin=test')
    assert (saved.name, saved.nickname, saved.tpid_url, saved.website,
            saved.seller_id, saved.territory_id, saved.favicon_b64) == (
                'Saved', None, 'https://example.com/', 'example.com', None, None,
                'image' if editing else None)


def test_csam_membership_and_favicon_clear(client, sample_data):
    """Existing invalid-CSAM retention and blank CSAM/site clearing remain unchanged."""
    customer = db.session.get(Customer, sample_data['customer1_id'])
    allowed = CustomerCSAM(name='Allowed', alias='allowed')
    foreign = CustomerCSAM(name='Foreign', alias='foreign')
    customer.available_csams.append(allowed)
    db.session.add(foreign)
    db.session.commit()
    customer.csam_id = allowed.id
    customer.website = 'example.com'
    customer.favicon_b64 = 'old'
    db.session.commit()
    with patch('app.routes.customers._schedule_customer_backup'):
        response = client.post(f'/customer/{customer.id}/edit', data={
            'name': customer.name, 'tpid': customer.tpid, 'csam_id': foreign.id})
        assert response.status_code == 302
        assert customer.csam_id == allowed.id
        assert customer.website is None and customer.favicon_b64 is None
        client.post(f'/customer/{customer.id}/edit', data={
            'name': customer.name, 'tpid': customer.tpid, 'csam_id': ''})
        assert customer.csam_id is None


def test_create_default_redirect_duplicate_name_and_server_integer_semantics(client, sample_data):
    """Names are not unique and manual server integer parsing remains unchanged."""
    existing = db.session.get(Customer, sample_data['customer1_id'])
    response = client.post('/customer/new', data={'name': existing.name, 'tpid': '-22'})
    saved = Customer.query.filter_by(tpid=-22).one()
    assert response.status_code == 302 and response.location.endswith(f'/customer/{saved.id}')
    assert saved.name == existing.name
    assert saved.nickname is None and saved.website is None and saved.csam_id is None


@pytest.mark.parametrize('changed', [False, True])
def test_nonblocking_edit_favicon_and_unexposed_metadata(client, sample_data, changed):
    """Unchanged domains skip enrichment; enrichment failures retain original metadata."""
    customer = db.session.get(Customer, sample_data['customer1_id'])
    customer.website = 'example.com'
    customer.favicon_b64 = 'old'
    customer.dae_name = 'Owner'
    customer.dae_alias = 'owner'
    customer.account_context = 'Keep context'
    db.session.commit()
    with patch('app.routes.admin.fetch_favicon_for_domain', side_effect=RuntimeError('offline')) \
            as favicon, patch('app.routes.customers._schedule_customer_backup'):
        response = client.post(f'/customer/{customer.id}/edit', data={
            'name': customer.name, 'tpid': customer.tpid,
            'website': 'new.example.com' if changed else 'example.com',
        })
    assert response.status_code == 302
    assert favicon.call_count == int(changed)
    assert (customer.favicon_b64, customer.dae_name, customer.dae_alias,
            customer.account_context) == ('old', 'Owner', 'owner', 'Keep context')
