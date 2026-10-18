"""Regression coverage for read-only Hygiene and Meeting Coverage widgets."""
import json
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from bs4 import BeautifulSoup
from flask import current_app, session
import pytest

from app.models import (
    ActivityCoveragePopulation,
    Customer,
    Engagement,
    HygieneNote,
    Milestone,
    MsxTask,
    Note,
    PrefetchedMeeting,
    Seller,
    db,
)
from app.services.activity_coverage import (
    fiscal_year_bounds,
    get_meeting_activity_coverage_widget,
    get_report_data,
)
from app.services.hygiene import get_hygiene_gaps_widget, get_hygiene_report_data


REFERENCE = date(2047, 7, 8)


@pytest.fixture
def operational_data(app):
    """Provide uncommitted local records and roll back every test's changes."""
    with app.test_request_context():
        seller = Seller(name='Operational Seller')
        other_seller = Seller(name='Other Operational Seller')
        db.session.add_all([seller, other_seller])
        db.session.flush()
        customer = Customer(name='Operational Customer', tpid=804700001, seller_id=seller.id)
        other_customer = Customer(
            name='Other Operational Customer', tpid=804700002, seller_id=other_seller.id,
        )
        db.session.add_all([customer, other_customer])
        db.session.flush()
        data = SimpleNamespace(
            seller=seller, other_seller=other_seller,
            customer=customer, other_customer=other_customer,
        )
        try:
            yield data
        finally:
            db.session.rollback()


def add_milestone(customer: Customer, title: str = 'Operational Milestone', **kwargs):
    """Create a local milestone with report-eligible defaults."""
    milestone = Milestone(
        customer_id=customer.id, title=title,
        msx_milestone_id=f'operational-{title}',
        url='https://example.test/milestone',
        msx_status=kwargs.pop('msx_status', 'On Track'),
        on_my_team=kwargs.pop('on_my_team', True), **kwargs,
    )
    db.session.add(milestone)
    db.session.flush()
    return milestone


def add_meeting(
    customer: Customer | None, subject: str, meeting_date: date = REFERENCE, **kwargs,
):
    """Create a saved meeting without invoking any calendar integration."""
    meeting = PrefetchedMeeting(
        workiq_id=f'operational-{subject}', subject=subject,
        start_time=datetime.combine(meeting_date, time(10)),
        meeting_date=meeting_date, customer_id=customer.id if customer else None,
        expires_at=datetime.now(timezone.utc) - timedelta(days=1), **kwargs,
    )
    db.session.add(meeting)
    db.session.flush()
    return meeting


def add_task(milestone: Milestone, subject: str, **kwargs):
    """Add one locally cached activity and its coverage classification."""
    task = MsxTask(
        milestone_id=milestone.id, msx_task_id=f'operational-{subject}',
        subject=subject, task_category=861980004, task_category_name='Architecture',
        duration_minutes=60, **kwargs,
    )
    db.session.add(task)
    db.session.flush()
    return task


def render_widget(name: str, data: dict, variant: str = 'detailed', prefix: str = 'one-'):
    """Render without depending on central dashboard registration."""
    html = current_app.jinja_env.get_template(f'partials/widgets/{name}.html').render(
        instance=SimpleNamespace(data=data, variant_key=variant),
        widget_id_prefix=prefix,
    )
    return BeautifulSoup(html, 'html.parser')


def test_hygiene_uses_report_population_and_does_not_resolve_annotated_gaps(operational_data):
    """Active all-team gaps count, while linked and inactive records do not."""
    data = operational_data
    session['seller_mode_seller_id'] = data.seller.id
    gap = Engagement(customer_id=data.customer.id, title='Needs milestone', estimated_acr=0)
    linked = Engagement(customer_id=data.customer.id, title='Linked engagement')
    inactive = Engagement(customer_id=data.customer.id, title='Inactive', status='Won')
    on_team = add_milestone(data.customer, 'On-team gap', monthly_usage=0)
    off_team = add_milestone(data.customer, 'Off-team gap', on_my_team=False)
    healthy = add_milestone(data.customer, 'Healthy milestone')
    add_milestone(data.customer, 'Completed milestone', msx_status='Completed')
    add_milestone(data.other_customer, 'Other seller gap')
    linked.milestones.append(healthy)
    db.session.add_all([gap, linked, inactive])
    db.session.flush()
    db.session.add(HygieneNote(
        entity_type='engagement', entity_id=gap.id, note='Waiting for confirmation',
    ))
    db.session.flush()

    report = get_hygiene_report_data()
    widget = get_hygiene_gaps_widget(REFERENCE)
    assert [row.id for row in report['engagements_no_ms']] == [gap.id]
    assert {row.id for row in report['milestones_no_eng']} == {on_team.id, off_team.id}
    assert widget['engagement_count'] == 1
    assert widget['milestone_count'] == 2
    assert widget['on_team_count'] == 1
    assert widget['annotated_count'] == 1
    assert widget['total'] == 3
    assert len(widget['rows']) == 3
    assert widget['rows'][0]['amount'] == 0
    assert widget['rows'][0]['note'] == 'Waiting for confirmation'
    soup = render_widget('hygiene_gaps', widget)
    assert soup.select_one('td[data-sb-sort-value="0"]').text == '$0'
    assert 'Off team' in soup.text
    assert soup.select_one('.badge.bg-primary .bi-person')
    assert all(link['href'] == '/reports/hygiene'
               for link in soup.select('td:last-child a'))
    assert len(soup.select('tbody tr')) == widget['total']


def test_hygiene_route_reuses_shared_service(client):
    """The existing workflow consumes the same producer as dashboard and tools."""
    with patch('app.services.hygiene.get_hygiene_report_data', return_value={
        'engagements_no_ms': [], 'milestones_no_eng': [], 'eng_notes': {},
    }) as get_report:
        response = client.get('/reports/hygiene')
    assert response.status_code == 200
    get_report.assert_called_once_with()


def test_hygiene_empty_state_is_not_a_sync_success(operational_data):
    """An empty local queue does not claim that MSX has been audited."""
    session['seller_mode_seller_id'] = operational_data.seller.id
    with patch('app.services.hygiene.SyncStatus.get_status',
               return_value={'state': 'failed', 'completed_at': None}):
        data = get_hygiene_gaps_widget(REFERENCE)
    soup = render_widget('hygiene_gaps', data, 'metric')
    assert data['total'] == 0
    assert 'failed' in soup.select_one('.db-report-notice').text
    assert 'saved active records' in soup.select_one('.db-report-empty').text
    assert not soup.select('table')


def test_meeting_denominator_and_hva_distinctions(operational_data):
    """FY-to-date excludes dismissed/future/prior meetings, not expired history."""
    data = operational_data
    milestone = add_milestone(data.customer)
    ready = add_meeting(data.customer, 'Ready', milestone_id=milestone.id)
    needs_ms = add_meeting(data.customer, 'Needs milestone')
    needs_customer = add_meeting(None, 'Needs customer')
    hva = add_meeting(data.customer, 'HVA logged')
    other = add_meeting(data.customer, 'Other logged')
    via_note = add_meeting(data.customer, 'Note fallback')
    note = Note(customer_id=data.customer.id, content='Existing note')
    db.session.add(note)
    db.session.flush()
    via_note.note_id = note.id
    add_task(milestone, 'HVA', meeting_id=hva.id, is_hva=True)
    add_task(milestone, 'Non-HVA', meeting_id=other.id, is_hva=False)
    add_task(milestone, 'Via note', note_id=note.id, is_hva=False)
    add_meeting(data.customer, 'Dismissed', dismissed=True)
    add_meeting(data.customer, 'Future', REFERENCE + timedelta(days=1))
    fiscal_start, _ = fiscal_year_bounds(REFERENCE)
    add_meeting(data.customer, 'Prior fiscal year', fiscal_start - timedelta(days=1))
    widget = get_meeting_activity_coverage_widget(REFERENCE)
    assert widget['summary'] == {
        'total': 6, 'logged': 3, 'ready': 1, 'needs_attention': 2,
        'needs_customer': 1, 'needs_milestone': 1,
        'hva_logged': 1, 'other_logged': 2, 'coverage_percent': 50,
    }
    assert {row['id'] for row in widget['queue']} == {
        ready.id, needs_ms.id, needs_customer.id,
    }
    assert len(widget['rows']) == 6
    assert widget['fiscal_year_label'] == 'FY48'
    assert widget['fiscal_start'] == '2047-07-01'
    assert widget['through'] == REFERENCE.isoformat()
    soup = render_widget('meeting_activity_coverage', widget)
    assert len(soup.select('tbody tr')) == 3
    assert 'not milestone HVA coverage' in soup.text
    assert '1 HVA-linked meetings' in soup.text and '2 other-activity-linked meetings' in soup.text
    assert soup.select_one('tbody a')['href'].endswith('week=2047-07-08')


def test_meeting_seller_scope_matches_report(operational_data):
    """Seller mode uses matched customers for both denominator and visible queue."""
    data = operational_data
    today = date.today()
    first = add_meeting(data.customer, 'Selected seller', today)
    add_meeting(data.other_customer, 'Excluded seller', today)
    add_meeting(None, 'Unmatched excluded in seller mode', today)
    session['seller_mode_seller_id'] = data.seller.id
    widget = get_meeting_activity_coverage_widget(today)
    report = get_report_data(view_all=True)
    assert widget['summary'] == report['summary']
    assert widget['summary']['total'] == 1
    assert [row['id'] for row in widget['queue']] == [first.id]
    assert [row['id'] for row in report['meetings']] == [first.id]
    assert 'unmatched meetings are excluded' in render_widget(
        'meeting_activity_coverage', widget,
    ).text


@pytest.mark.parametrize('variant', ['metric', 'detailed'])
def test_meeting_empty_missing_and_incomplete_calendar(operational_data, variant):
    """An empty or partially imported calendar cannot silently look fully covered."""
    session['seller_mode_seller_id'] = operational_data.seller.id
    with patch('app.services.activity_coverage.get_population_status', return_value={
        'error': None, 'running': False, 'populated_through': None, 'pending_count': 5,
    }):
        widget = get_meeting_activity_coverage_widget(REFERENCE)
    assert widget['coverage_percent'] is None
    soup = render_widget('meeting_activity_coverage', widget, variant)
    assert 'No denominator' in soup.text
    assert 'completeness is unknown' in soup.text
    assert 'not 100% coverage' in soup.text
    assert not soup.select('table')


@pytest.mark.parametrize('population,expected', [
    ({'error': 'Calendar unavailable'}, 'Calendar import failed'),
    ({'running': True}, 'import in progress'),
    ({'populated_through': '2047-07-02', 'pending_count': 3}, '3 weekdays remain'),
    ({'populated_through': '2047-07-08', 'pending_count': 0}, 'imported through'),
])
def test_meeting_population_states(operational_data, population, expected):
    """Surface failure, running, catch-up and complete checkpoints explicitly."""
    status = {'error': None, 'running': False, 'populated_through': None, 'pending_count': 0}
    status.update(population)
    with patch('app.services.activity_coverage.get_population_status', return_value=status):
        widget = get_meeting_activity_coverage_widget(REFERENCE)
    assert expected in render_widget('meeting_activity_coverage', widget).text


def test_operational_widgets_are_read_only_and_use_unique_sort_keys(operational_data):
    """Providers never start imports or persist state; table state stays per instance."""
    data = operational_data
    session['seller_mode_seller_id'] = data.seller.id
    add_milestone(data.customer)
    add_meeting(data.customer, 'Needs audit')
    db.session.flush()
    before = ActivityCoveragePopulation.query.count()
    with patch('app.services.activity_coverage.start_population') as populate, \
            patch('app.services.activity_coverage.start_reconciliation') as reconcile, \
            patch.object(db.session, 'commit') as commit:
        hygiene = get_hygiene_gaps_widget(REFERENCE)
        meeting = get_meeting_activity_coverage_widget(REFERENCE)
    populate.assert_not_called()
    reconcile.assert_not_called()
    commit.assert_not_called()
    assert ActivityCoveragePopulation.query.count() == before
    for name, widget in [('hygiene_gaps', hygiene), ('meeting_activity_coverage', meeting)]:
        first = render_widget(name, widget, prefix='first-')
        second = render_widget(name, widget, prefix='second-')
        assert first.select_one('[data-sb-sortable]')['data-sb-sort-key'].startswith('first-')
        assert second.select_one('[data-sb-sortable]')['data-sb-sort-key'].startswith('second-')
        assert not render_widget(name, widget, 'metric').select('table')


def test_operational_queues_do_not_silently_cap_records(operational_data):
    """Every gap remains actionable even when the queue exceeds a preview size."""
    data = operational_data
    session['seller_mode_seller_id'] = data.seller.id
    db.session.add_all([
        Engagement(customer_id=data.customer.id, title=f'Queue gap {index:02d}')
        for index in range(61)
    ])
    for index in range(61):
        add_meeting(data.customer, f'Queue meeting {index:02d}')
    hygiene = get_hygiene_gaps_widget(REFERENCE)
    meeting = get_meeting_activity_coverage_widget(REFERENCE)
    assert hygiene['engagement_count'] == len(hygiene['rows']) == 61
    assert meeting['summary']['total'] == len(meeting['queue']) == 61
    assert len(render_widget('hygiene_gaps', hygiene).select('tbody tr')) == 61
    assert len(render_widget('meeting_activity_coverage', meeting).select('tbody tr')) == 61


def test_fully_linked_meetings_still_disclose_import_completeness(operational_data):
    """A perfect saved-record ratio is not proof the calendar import is complete."""
    data = operational_data
    session['seller_mode_seller_id'] = data.seller.id
    milestone = add_milestone(data.customer)
    meeting = add_meeting(data.customer, 'All saved meetings linked')
    add_task(milestone, 'Only saved task', meeting_id=meeting.id, is_hva=False)
    with patch('app.services.activity_coverage.get_population_status', return_value={
        'error': None, 'running': False, 'populated_through': None, 'pending_count': 5,
    }):
        widget = get_meeting_activity_coverage_widget(REFERENCE)
    soup = render_widget('meeting_activity_coverage', widget)
    assert widget['coverage_percent'] == 100
    assert widget['summary']['hva_logged'] == 0
    assert 'completeness is unknown' in soup.text
    assert 'Every saved meeting' in soup.text
    assert not soup.select('table')


def test_meeting_widget_rolls_fiscal_year_on_july_first(operational_data):
    """The denominator follows the supplied FY, not a hardcoded Data goal."""
    data = operational_data
    session['seller_mode_seller_id'] = data.seller.id
    add_meeting(data.customer, 'June meeting', date(2047, 6, 30))
    july = add_meeting(data.customer, 'July meeting', date(2047, 7, 1))
    before = get_meeting_activity_coverage_widget(date(2047, 6, 30))
    after = get_meeting_activity_coverage_widget(date(2047, 7, 1))
    assert before['fiscal_year_label'] == 'FY47'
    assert before['summary']['total'] == 1
    assert after['fiscal_year_label'] == 'FY48'
    assert [row['id'] for row in after['rows']] == [july.id]


@pytest.mark.parametrize('provider,template', [
    (get_hygiene_gaps_widget, 'hygiene_gaps'),
    (get_meeting_activity_coverage_widget, 'meeting_activity_coverage'),
])
def test_populated_operational_widget_payload_is_json_serializable(
    operational_data, provider, template,
):
    """Populated API payloads contain customer identities, never ORM objects."""
    data = operational_data
    session['seller_mode_seller_id'] = data.seller.id
    add_milestone(data.customer)
    add_meeting(data.customer, 'Serialized meeting')
    db.session.add(Engagement(customer_id=data.customer.id, title='Serialized engagement'))
    db.session.flush()
    payload = provider(REFERENCE)
    restored = json.loads(json.dumps(payload))
    assert restored['rows'][0]['customer']['id'] == data.customer.id
    assert restored['rows'][0]['customer']['seller']['id'] == data.seller.id
    assert restored['rows'][0]['customer']['seller']['name'] == data.seller.name
    assert render_widget(template, restored).select_one('.badge.bg-primary .bi-person')
    assert render_widget(template, restored).select_one('[data-sb-sortable]')
