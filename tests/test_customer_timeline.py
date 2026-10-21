"""Customer history uses real event dates and never turns sync times into activity."""

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, Engagement, Milestone, Note, Opportunity, db
from app.services.customer_timeline import _plain_text, _utc, get_customer_timeline


def test_timeline_uses_compact_date_gutter_with_aligned_markers():
    """Reclaim 24px for event titles without detaching the year or connecting line."""
    css = (Path(__file__).parents[1] / 'static' / 'css' / 'ui-customer-timeline.css'
           ).read_text(encoding='utf-8')
    assert 'grid-template-columns: 24px 24px minmax(0, 1fr)' in css
    assert 'column-gap: 6px' in css
    assert 'padding: 16px 0 8px 42px' in css
    assert 'left: 41px' in css


@pytest.fixture
def history(app):
    """Create distinct customer-scoped events, including an excluded team milestone."""
    customer = Customer(name='Timeline customer', tpid=998001)
    other = Customer(name='Other history', tpid=998002)
    db.session.add_all([customer, other])
    db.session.flush()
    records = [
        Note(customer_id=customer.id, call_date=datetime(2026, 10, 1, 13),
             content='<p>Customer discovery &amp; next steps</p>'),
        Engagement(customer_id=customer.id, title='Fabric rollout',
                   created_at=datetime(2026, 9, 1), technical_problem='Capacity sizing'),
        Opportunity(customer_id=customer.id, msx_opportunity_id='timeline-opp', name='Real dates',
                    msx_created_on=datetime(2026, 8, 1), statecode=1,
                    msx_closed_on=datetime(2026, 10, 10), estimated_close_date='2028-01-01'),
        Opportunity(customer_id=customer.id, msx_opportunity_id='undated-opp', name='No source date'),
        Milestone(customer_id=customer.id, title='Our milestone', url='https://example.com/ours',
                  on_my_team=True, msx_created_on=datetime(2026, 8, 2),
                  committed_at=datetime(2026, 9, 2), completed_at=datetime(2026, 10, 2)),
        Milestone(customer_id=customer.id, title='Not on our team', url='https://example.com/theirs',
                  on_my_team=False, msx_created_on=datetime(2026, 10, 14),
                  completed_at=datetime(2026, 10, 15)),
        Note(customer_id=other.id, call_date=datetime(2026, 10, 15), content='Other customer'),
    ]
    db.session.add_all(records)
    db.session.commit()
    return customer.id


def test_source_population_dates_and_plain_text(history):
    """All seven requested events appear, with no estimated, import or foreign dates."""
    result = get_customer_timeline(history)
    events = result['events']
    assert len(events) == 7
    assert result['undated_opportunities'] == 1
    assert result['next_offset'] is None
    assert events[0]['label'] == 'Opportunity closed'
    assert all('2028' not in event['at'] for event in events)
    assert not any(event['title'] in ('Not on our team', 'Other customer', 'No source date')
                   for event in events)
    note = next(event for event in events if event['kind'] == 'note')
    assert note['title'] == 'Customer discovery & next steps'
    assert note['at'] == datetime(2026, 10, 1, 13).astimezone(timezone.utc).isoformat()
    assert all(event['href'].startswith('/') and event['at'].endswith('+00:00')
               for event in events)


def test_utc_interpretation_preserves_local_call_dates():
    """Server timestamps are UTC while naive call dates remain intentional local time."""
    value = datetime(2026, 10, 1, 13)
    assert _utc(value) == value.replace(tzinfo=timezone.utc)
    assert _utc(value, local=True) == value.astimezone(timezone.utc)


def test_note_preview_keeps_authored_block_boundaries_readable():
    """Adjacent headings and paragraphs cannot run together in the narrow rail."""
    assert _plain_text('<h2>Discovery</h2><p>Fabric &amp; SQL<br>Next steps</p>') == (
        'Discovery Fabric & SQL Next steps'
    )


def test_paging_is_complete_and_stable_at_identical_timestamps(history):
    """Source prefix limits and numeric tie breakers do not duplicate or lose events."""
    db.session.add_all([
        Note(customer_id=history, content=f'Identical date {i}',
             call_date=datetime(2026, 10, 14, 12)) for i in range(35)
    ])
    db.session.commit()
    entire = get_customer_timeline(history)['events']
    accumulated = []
    offset = 0
    while offset is not None:
        page = get_customer_timeline(history, limit=4, offset=offset)
        accumulated.extend(page['events'])
        offset = page['next_offset']
    assert accumulated == entire
    assert len({event['key'] for event in accumulated}) == 42


@pytest.mark.parametrize('query', ['limit=0', 'limit=101', 'offset=-1', 'offset=nope'])
def test_invalid_page_is_explicit(client, history, query):
    """Malformed pagination returns a useful error, not an empty success."""
    response = client.get(f'/api/customer/{history}/timeline?{query}')
    assert response.status_code == 400
    assert response.json['error']


def test_api_errors_and_empty_history(client, history):
    """Unknown customers, database failures and empty valid histories stay distinct."""
    assert client.get('/api/customer/999999/timeline').status_code == 404
    with patch('app.services.customer_timeline.get_customer_timeline',
               side_effect=SQLAlchemyError('test failure')):
        response = client.get(f'/api/customer/{history}/timeline')
    assert response.status_code == 500
    assert response.json['error']
    response = client.get(f'/api/customer/{history}/timeline?offset=999')
    assert response.status_code == 200
    assert response.json['events'] == []


def test_customer_page_owns_rail_without_changing_shared_fragments(client, history):
    """Only the full customer page opts into the extra rail and its standalone sizing."""
    html = BeautifulSoup(client.get(f'/customer/{history}').data, 'html.parser')
    assert html.select_one('.cd-layout > [data-customer-timeline]')
    assert html.select_one('.cd-work .ct-rail') is None
    assert html.select_one('[data-customer-timeline]')['data-customer-timeline'] == (
        f'/api/customer/{history}/timeline'
    )


def test_salesiq_reads_the_same_feed(history):
    """The new analytical surface is queryable without duplicated business logic."""
    from app.services.salesiq_tools import execute_tool

    assert execute_tool('get_customer_timeline', {'customer_id': history, 'limit': 2}) == (
        get_customer_timeline(history, limit=2)
    )


def test_source_date_cache_normalizes_offsets_and_retains_valid_dates(caplog):
    """Invalid or omitted source dates cannot silently replace known dates."""
    opp = Opportunity(msx_opportunity_id='date-cache', name='Date cache')
    opp.cache_msx_dates('2026-08-01T03:00:00+03:00', '2026-10-10')
    assert opp.msx_created_on == datetime(2026, 8, 1)
    assert opp.msx_closed_on == datetime(2026, 10, 10)
    opp.cache_msx_dates('not-a-date', None)
    assert opp.msx_created_on == datetime(2026, 8, 1)
    assert 'Invalid msx_created_on' in caplog.text


def test_opportunity_date_migration_is_additive_and_idempotent():
    """An old SQLite schema gains source-date columns without changing existing records."""
    from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, inspect
    from sqlalchemy.orm import Session
    from app.migrations import _migrate_opportunity_details_columns

    engine = create_engine('sqlite://')
    metadata = MetaData()
    table = Table('opportunities', metadata, Column('id', Integer, primary_key=True),
                  Column('name', String))
    metadata.create_all(engine)
    try:
        with Session(engine) as session:
            session.execute(table.insert().values(id=1, name='Keep this opportunity'))
            session.commit()
            adapter = SimpleNamespace(session=session)
            _migrate_opportunity_details_columns(adapter, inspect(engine))
            _migrate_opportunity_details_columns(adapter, inspect(engine))
            columns = {column['name'] for column in inspect(engine).get_columns('opportunities')}
            assert {'msx_created_on', 'msx_closed_on'} <= columns
            assert session.execute(table.select()).one().name == 'Keep this opportunity'
    finally:
        engine.dispose()


def test_sync_upserts_source_dates_and_does_not_erase_them(history):
    """Milestone-expanded and account opportunity sync paths both preserve source dates."""
    from app.services.milestone_sync import _upsert_opportunity, sync_customer_opportunities

    data = {'msx_opportunity_id': 'upsert-dates', 'opportunity_name': 'Source opportunity',
            'opportunity_created_on': '2026-07-01T00:00:00Z',
            'opportunity_closed_on': '2026-09-01T00:00:00Z'}
    opp, created = _upsert_opportunity(data, history)
    assert created and opp.msx_created_on == datetime(2026, 7, 1)
    opp, created = _upsert_opportunity(
        {'msx_opportunity_id': 'upsert-dates', 'opportunity_name': 'Still known'}, history,
    )
    assert not created and opp.msx_closed_on == datetime(2026, 9, 1)
    customer = db.session.get(Customer, history)
    customer.tpid_url = 'https://example.com/accounts/00000000-0000-0000-0000-000000000001'
    with patch('app.services.milestone_sync.extract_account_id_from_url',
               return_value='account'), patch(
        'app.services.milestone_sync.get_opportunities_by_account',
        return_value={'success': True, 'opportunities': [{
            'id': 'timeline-opp', 'name': 'Refreshed', 'created_on': '2026-06-01T00:00:00Z',
            'closed_on': '2026-10-11T00:00:00Z',
        }]},
    ):
        result = sync_customer_opportunities(customer)
    assert result['success']
    refreshed = Opportunity.query.filter_by(msx_opportunity_id='timeline-opp').one()
    assert refreshed.msx_created_on == datetime(2026, 6, 1)
    assert refreshed.msx_closed_on == datetime(2026, 10, 11)


@pytest.mark.parametrize('mode', ['single', 'account', 'batch', 'milestone'])
def test_msx_read_paths_request_and_return_source_dates(mode):
    """Every MSX opportunity producer carries source dates, including expanded records."""
    from app.services import msx_api

    raw = {'opportunityid': 'opp', '_parentaccountid_value': 'account', 'name': 'Test',
           'createdon': '2026-08-01T00:00:00Z', 'actualclosedate': '2026-10-10'}
    response = Mock(status_code=200)
    response.json.return_value = raw if mode == 'single' else {'value': [raw]}
    if mode == 'batch':
        with patch.object(msx_api, 'query_entity',
                          return_value={'success': True, 'records': [raw]}) as query:
            result = msx_api.batch_get_opportunities(['account'])
        assert {'createdon', 'actualclosedate'} <= set(query.call_args.kwargs['select'])
        value = result['by_account']['account'][0]
    else:
        if mode == 'milestone':
            response.json.return_value = {'value': [{
                'msp_engagementmilestoneid': 'ms', 'msp_OpportunityId': raw,
                '_msp_opportunityid_value': 'opp',
            }]}
        with patch.object(msx_api, '_msx_request', return_value=response) as query:
            if mode == 'single':
                result = msx_api.get_opportunity('opp')
                value = result['opportunity']
            elif mode == 'account':
                result = msx_api.get_opportunities_by_account('account')
                value = result['opportunities'][0]
            else:
                result = msx_api.get_milestones_by_account('account')
                value = result['milestones'][0]
        assert 'createdon' in query.call_args.args[1]
        assert 'actualclosedate' in query.call_args.args[1]
    prefix = 'opportunity_' if mode == 'milestone' else ''
    assert value[prefix + 'created_on'] == raw['createdon']
    assert value[prefix + 'closed_on'] == raw['actualclosedate']
