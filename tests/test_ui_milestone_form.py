"""Manual milestone form contract and isolated save/error behavior."""
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Milestone, db


def form_soup(response):
    """Return the native form from a response."""
    return BeautifulSoup(response.data, 'html.parser').select_one('#milestoneForm')


@pytest.mark.parametrize('editing', [False, True])
def test_native_fields_and_destinations(client, db_session, editing):
    """Both variants preserve the exact original field and navigation contract."""
    milestone = Milestone(url='https://example.com/msx?a=1&b=2', title='A "quoted" <title>')
    db_session.add(milestone)
    db_session.commit()
    path = f'/milestone/{milestone.id}/edit' if editing else '/milestone/new'
    response = client.get(path)
    soup = BeautifulSoup(response.data, 'html.parser')
    form = soup.select_one('#milestoneForm')
    assert response.status_code == 200
    assert 'sb-page-frame' in soup.body['class']
    assert form['method'] == 'POST'
    assert not form.has_attr('action')
    assert [field['name'] for field in form.select('input')] == ['url', 'title']
    url, title = form.select('input')
    assert url['type'] == 'url' and url.has_attr('required')
    assert title['type'] == 'text' and not title.has_attr('required')
    assert not url.has_attr('maxlength') and not title.has_attr('maxlength')
    assert url['value'] == (milestone.url if editing else '')
    assert title['value'] == (milestone.title if editing else '')
    assert url['placeholder'] == 'https://msxsalesplatform.dynamics.com/...'
    assert title['placeholder'] == 'e.g., Q2 Deployment Milestone'
    assert form.select_one('#milestoneUrlHelp').text == 'The URL from your MSX sales platform'
    assert form.select_one('#milestoneTitleHelp').text == (
        'A friendly name to display instead of the URL'
    )
    assert form.select_one('#milestoneFormCancel')['href'] == (
        f'/milestone/{milestone.id}' if editing else '/milestones'
    )
    assert form.select_one('button[type=submit]').text.strip().endswith(
        'Update Milestone' if editing else 'Create Milestone'
    )
    assert not form.select('.card, .form-control, .btn')
    assert soup.select_one('footer.sb-page-status')
    assert soup.select_one('#milestoneFormNotice[role=alert]')


@pytest.mark.parametrize('editing', [False, True])
@pytest.mark.parametrize('failure', ['required', 'duplicate', 'database'])
def test_failed_save_preserves_fields_and_records(client, db_session, editing, failure):
    """Invalid and failed writes remain errors, escape input and leave stored values intact."""
    original = Milestone(url='https://example.com/original', title='Original')
    duplicate = Milestone(url='https://example.com/duplicate', title='Duplicate')
    db_session.add_all([original, duplicate])
    db_session.commit()
    original_id = original.id
    path = f'/milestone/{original_id}/edit' if editing else '/milestone/new'
    url = {'required': '  ', 'duplicate': duplicate.url,
           'database': 'https://example.com/new?a=1&b=2'}[failure]
    title = '  <script>alert("draft")</script>  '
    if failure == 'database':
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('private db error')):
            response = client.post(path, data={'url': url, 'title': title})
        assert response.status_code == 500
        assert b'Could not save the milestone.' in response.data
        assert b'private db error' not in response.data
    else:
        response = client.post(path, data={'url': url, 'title': title})
        assert response.status_code == 200
        message = b'URL is required' if failure == 'required' else b'already exists'
        assert message in response.data
    form = form_soup(response)
    assert form['data-posted'] == 'true'
    assert form.select_one('[name=url]')['value'] == url
    assert form.select_one('[name=title]')['value'] == title
    assert b'<script>alert("draft")</script>' not in response.data
    assert Milestone.query.count() == 2
    db.session.refresh(original)
    assert original.url == 'https://example.com/original'
    assert original.title == 'Original'


@pytest.mark.parametrize('editing', [False, True])
def test_save_payload_and_relationship_parity(client, db_session, sample_customer, editing):
    """Only URL/title change; trimming, nullable title, relationships and redirects are unchanged."""
    original = Milestone(
        url='https://example.com/original', title='Original',
        customer_id=sample_customer.id, msx_milestone_id='original-msx-id',
        msx_status='On Track', on_my_team=True,
    )
    db_session.add(original)
    db_session.commit()
    original_id = original.id
    created_at = original.created_at
    path = f'/milestone/{original_id}/edit' if editing else '/milestone/new'
    response = client.post(path, data={
        'url': '  https://example.com/saved  ', 'title': '   ',
        'customer_id': '99999', 'on_my_team': 'false',
    })
    assert response.status_code == 302
    saved = Milestone.query.filter_by(url='https://example.com/saved').one()
    assert saved.title is None
    assert response.headers['Location'] == f'/milestone/{saved.id}'
    if editing:
        assert saved.id == original_id
        assert saved.customer_id == sample_customer.id
        assert saved.msx_milestone_id == 'original-msx-id'
        assert saved.msx_status == 'On Track' and saved.on_my_team is True
        assert saved.created_at == created_at
    else:
        assert saved.customer_id is None and saved.msx_milestone_id is None
    with client.session_transaction() as session:
        assert session['_flashes'][-1] == (
            'success', 'Milestone updated successfully' if editing
            else 'Milestone created successfully'
        )


def test_current_url_and_original_server_validation(client, db_session):
    """An unchanged edit URL is allowed, and presentation adds no business URL restriction."""
    original = Milestone(url='native-browser-only-validation', title=None)
    db_session.add(original)
    db_session.commit()
    response = client.post(f'/milestone/{original.id}/edit', data={
        'url': original.url, 'title': ' Updated ',
    })
    assert response.status_code == 302
    assert original.title == 'Updated'


def test_missing_edit_still_404(client):
    """Missing records retain the original 404 contract."""
    assert client.get('/milestone/9999999/edit').status_code == 404
