"""Both native engagement forms preserve fields, scoped choices and isolated save behavior."""
from datetime import date, datetime
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import (
    db, Customer, Note, Engagement, EngagementContact, Milestone, Opportunity,
    CustomerContact, PartnerContact, Partner, SolutionEngineer, Seller, InternalContact,
)


@pytest.fixture
def records(db_session, sample_customer):
    """Build all person types and same/other-customer relationships in the isolated database."""
    other = Customer(name='Other customer', tpid=998877)
    partner = Partner(name='Partner')
    db_session.add_all([other, partner])
    db_session.flush()
    people = [
        CustomerContact(customer_id=sample_customer.id, name='Customer "person" <safe>'),
        PartnerContact(partner_id=partner.id, name='Partner person'),
        SolutionEngineer(name='Engineer', alias='engineer'),
        Seller(name='Seller', alias='seller'),
        InternalContact(name='Internal', alias='internal'),
    ]
    db_session.add_all(people)
    db_session.flush()
    note = Note(customer_id=sample_customer.id, call_date=datetime(2026, 10, 1),
                content='<p>Customer note</p>')
    older = Note(customer_id=sample_customer.id, call_date=datetime(2026, 9, 1),
                 content='Older note')
    opp = Opportunity(customer_id=sample_customer.id, name='B opportunity',
                      msx_opportunity_id='eng-form-b')
    first_opp = Opportunity(customer_id=sample_customer.id, name='A opportunity',
                            msx_opportunity_id='eng-form-a')
    ms = Milestone(customer_id=sample_customer.id, title='B milestone', url='https://msx/b',
                   msx_status='At Risk', msx_milestone_id='kept-msx-id', on_my_team=True)
    first_ms = Milestone(customer_id=sample_customer.id, title='A milestone', url='https://msx/a')
    foreign = Note(customer_id=other.id, call_date=datetime(2026, 10, 2), content='Foreign note')
    foreign_opp = Opportunity(customer_id=other.id, name='Foreign opportunity',
                              msx_opportunity_id='eng-form-foreign')
    foreign_ms = Milestone(customer_id=other.id, title='Foreign milestone', url='https://msx/f')
    eng = Engagement(customer_id=sample_customer.id, title='Original "title" <safe>',
                     status='On Hold', technical_problem='Problem', business_impact='Impact',
                     solution_resources='Resources', estimated_acr=123, target_date=date(2027, 1, 2),
                     business_outcome='Not in this form', notes=[note], opportunities=[opp],
                     milestones=[ms])
    for kind, person in zip(['customer_contact_id', 'partner_contact_id',
                             'solution_engineer_id', 'seller_id', 'internal_contact_id'], people):
        eng.contacts.append(EngagementContact(**{kind: person.id}))
    eng.contacts.append(EngagementContact(external_name='Outside "person" <safe>',
                                          external_email='outside@example.com'))
    db_session.add_all([note, older, opp, first_opp, ms, first_ms,
                       foreign, foreign_opp, foreign_ms, eng])
    db_session.commit()
    return {'customer': sample_customer, 'eng': eng, 'note': note, 'older': older,
            'opp': opp, 'first_opp': first_opp, 'ms': ms, 'first_ms': first_ms,
            'foreign': foreign, 'foreign_opp': foreign_opp, 'foreign_ms': foreign_ms,
            'people': people}


def path_for(records: dict, editing: bool) -> str:
    """Choose the real create or edit route."""
    return f"/engagement/{records['eng'].id}/edit" if editing else (
        f"/customer/{records['customer'].id}/engagement/new"
    )


@pytest.mark.parametrize('editing', [False, True])
def test_native_form_inventory(client, records, editing):
    """Exact names, defaults, choices, ordering, contacts and destinations survive migration."""
    response = client.get(path_for(records, editing))
    soup = BeautifulSoup(response.data, 'html.parser')
    form = soup.select_one('#engagementForm')
    assert response.status_code == 200
    assert 'sb-page-frame' in soup.body['class']
    assert form['method'] == 'POST' and not form.has_attr('action')
    assert soup.select_one('#engagementFormSave')['form'] == 'engagementForm'
    assert soup.select_one('#engagementFormCancel')['href'] == (
        f"/customer/{records['customer'].id}"
    )
    names = {field.get('name') for field in form.select('input, select, textarea')}
    assert names == {'title', 'status', None, 'technical_problem', 'business_impact',
                     'solution_resources', 'estimated_acr', 'target_date',
                     'note_ids', 'opportunity_ids', 'milestone_ids'} | (
        {'contact_types', 'contact_ref_ids', 'contact_ext_names', 'contact_ext_emails'}
        if editing else set()
    )
    assert [o['value'] for o in form.select('#status option')] == [
        'Active', 'On Hold', 'Won', 'Lost'
    ]
    assert form.select_one('#status option[selected]')['value'] == (
        'On Hold' if editing else 'Active'
    )
    assert form.select_one('#title').has_attr('required')
    assert form.select_one('#title').has_attr('autofocus')
    assert len(form.select('[required]')) == 1
    assert form.select_one('#estimated_acr')['min'] == '0'
    assert form.select_one('#estimated_acr')['step'] == '1'
    assert form.select_one('#title')['value'] == (
        records['eng'].title if editing else ''
    )
    assert form.select_one('#target_date')['value'] == ('2027-01-02' if editing else '')
    for field, ordered in [
        ('note_ids', [records['note'], records['older']]),
        ('opportunity_ids', [records['first_opp'], records['opp']]),
        ('milestone_ids', [records['first_ms'], records['ms']]),
    ]:
        boxes = form.select(f'[name="{field}"]')
        assert [int(box['value']) for box in boxes] == [item.id for item in ordered]
        assert [int(box['value']) for box in boxes if box.has_attr('checked')] == (
            [records[{'note_ids': 'note', 'opportunity_ids': 'opp',
                      'milestone_ids': 'ms'}[field]].id] if editing else []
        )
    assert len(form.select('.ef-contact')) == (6 if editing else 0)
    assert not form.select('.card, .btn, .form-control, .form-select, .badge')
    assert soup.select_one('footer.sb-page-status')
    assert soup.select_one('#engagementFormNotice[role="alert"]')
    assert bool(soup.select_one('#engagementDeleteForm')) == editing
    if editing:
        assert soup.select_one('#engagementDeleteForm')['action'] == (
            f"/engagement/{records['eng'].id}/delete"
        )
    assert b'Adding a new contact saves that person immediately' in response.data


@pytest.mark.parametrize('editing', [False, True])
@pytest.mark.parametrize('failure', ['title', 'date', 'number', 'database'])
def test_failed_form_retains_every_payload_and_rolls_back(client, records, editing, failure):
    """Errors remain visible and submitted associations/escaped contacts are never lost."""
    eng = records['eng']
    payload = {
        'title': '  ' if failure == 'title' else '  <script>alert("draft")</script>  ',
        'status': 'Lost', 'technical_problem': '<problem>', 'business_impact': '"impact"',
        'solution_resources': ' resources ', 'estimated_acr': 'bad' if failure == 'number'
        else '456', 'target_date': 'bad-date' if failure == 'date' else '2028-02-03',
        'note_ids': str(records['older'].id), 'opportunity_ids': str(records['first_opp'].id),
        'milestone_ids': str(records['first_ms'].id),
        'contact_types': ['seller', 'external'],
        'contact_ref_ids': [str(records['people'][3].id), ''],
        'contact_ext_names': 'A "quoted" <person>', 'contact_ext_emails': 'a@example.com',
    }
    original_title = eng.title
    if failure == 'database':
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('private error')):
            response = client.post(path_for(records, editing), data=payload)
    else:
        response = client.post(path_for(records, editing), data=payload)
    assert response.status_code == (500 if failure in ('number', 'database') else 200)
    assert b'private error' not in response.data
    assert b'<script>alert("draft")</script>' not in response.data
    expected = {'title': b'Engagement title is required.', 'date': b'Invalid target date format.',
                'number': b'Could not save the engagement.',
                'database': b'Could not save the engagement.'}
    assert expected[failure] in response.data
    form = BeautifulSoup(response.data, 'html.parser').select_one('#engagementForm')
    assert form['data-posted'] == 'true'
    for name in ['title', 'estimated_acr', 'target_date']:
        assert form.select_one(f'[name="{name}"]')['value'] == payload[name]
    for name in ['technical_problem', 'business_impact', 'solution_resources']:
        assert form.select_one(f'[name="{name}"]').text == payload[name]
    assert form.select_one('#status option[selected]')['value'] == payload['status']
    for name in ['note_ids', 'opportunity_ids', 'milestone_ids']:
        assert [box['value'] for box in form.select(f'[name="{name}"][checked]')] == [
            payload[name]
        ]
    assert [p['value'] for p in form.select('[name="contact_types"]')] == ['seller', 'external']
    assert form.select_one('[name="contact_ext_names"]')['value'] == payload['contact_ext_names']
    db.session.refresh(eng)
    assert eng.title == original_title and eng.status == 'On Hold'
    assert eng.estimated_acr == 123 and eng.notes == [records['note']]
    assert eng.opportunities == [records['opp']] and eng.milestones == [records['ms']]
    assert len(eng.contacts) == 6 and Engagement.query.count() == 1


@pytest.mark.parametrize('editing', [False, True])
def test_success_original_post_and_non_form_relationships(client, records, editing):
    """Original trimming, scoped links, tracking and redirect destinations remain exact."""
    customer = records['customer']
    payload = {'title': ' Saved ', 'status': 'Won', 'technical_problem': ' problem ',
               'business_impact': ' ', 'solution_resources': ' resources ',
               'estimated_acr': '0', 'target_date': '2028-01-02',
               'note_ids': [str(records['older'].id), str(records['foreign'].id)],
               'opportunity_ids': [str(records['first_opp'].id), str(records['foreign_opp'].id)],
               'milestone_ids': [str(records['first_ms'].id), str(records['foreign_ms'].id)],
               'contact_types': ['external'], 'contact_ref_ids': [''],
               'contact_ext_names': 'Outside', 'contact_ext_emails': 'outside@example.com'}
    with patch('app.routes.engagements.track_engagement_on_milestones') as track:
        response = client.post(path_for(records, editing), data=payload)
    assert response.status_code == 302
    saved = Engagement.query.filter_by(title='Saved').one()
    assert response.headers['Location'] == (
        f'/engagement/{saved.id}' if editing else f'/customer/{customer.id}'
    )
    assert saved.status == 'Won' and saved.estimated_acr == 0
    assert saved.technical_problem == 'problem' and saved.business_impact is None
    assert saved.solution_resources == 'resources'
    assert saved.target_date == date(2028, 1, 2)
    assert saved.notes == [records['older']]
    assert saved.opportunities == [records['first_opp']]
    assert saved.milestones == [records['first_ms']]
    assert saved.contacts[0].external_name == 'Outside'
    assert saved.contacts[0].external_email == 'outside@example.com'
    assert saved.business_outcome == ('Not in this form' if editing else None)
    assert track.call_count == int(editing)
    assert records['ms'].msx_milestone_id == 'kept-msx-id'
    assert records['ms'].on_my_team is True


def test_no_new_server_business_constraints_and_empty_links(client, records):
    """Presentation adds no status/ACR restrictions and still clears unchecked relationships."""
    response = client.post(path_for(records, True), data={
        'title': 'Saved', 'status': 'custom-status', 'estimated_acr': '-1',
    })
    assert response.status_code == 302
    eng = records['eng']
    assert eng.status == 'custom-status' and eng.estimated_acr == -1
    assert eng.target_date is None
    assert not eng.notes and not eng.opportunities and not eng.milestones and not eng.contacts


def test_missing_records_still_404(client):
    """Unknown records keep their existing not-found behavior."""
    assert client.get('/engagement/999999/edit').status_code == 404
    assert client.get('/customer/999999/engagement/new').status_code == 404
