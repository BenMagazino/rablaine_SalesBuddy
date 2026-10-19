"""Customer scope is applied before shared widget calculations without writes."""

from copy import deepcopy
from datetime import date, datetime, timezone
from unittest.mock import Mock

import pytest

from app.models import (
    Customer, Engagement, HygieneNote, ManagerInitiativeItem, ManagerInitiativeSection,
    Milestone, MsxTask, PToFImport, PToFRecord, PrefetchedMeeting, Project,
    RevenueAnalysis, Seller, db,
)
from app.services import (
    activity_coverage, fabric_consumption, hygiene, manager_one_on_one, ptof,
    revenue_analysis,
)


REFERENCE = date(2026, 10, 18)
STAMP = datetime(2026, 10, 18, tzinfo=timezone.utc)


@pytest.fixture
def customers(app):
    """Provide two real customers in the existing isolated pytest database."""
    with app.app_context():
        first = Customer(name='Scoped first', tpid=991001, seller=Seller(name='First seller'))
        second = Customer(name='Scoped second', tpid=991002, seller=Seller(name='Second seller'))
        db.session.add_all([first, second])
        db.session.commit()
        yield first, second


def add_milestone(customer: Customer, amount: float | None = 100) -> Milestone:
    """Create independently scoped on-team milestone work."""
    milestone = Milestone(
        customer=customer, title=f'{customer.name} milestone',
        msx_milestone_id=f'scope-{customer.id}', url='https://example.test/milestone',
        monthly_usage=amount, msx_status='On Track', on_my_team=True,
    )
    db.session.add(milestone)
    return milestone


def add_analysis(customer: Customer, **changes) -> RevenueAnalysis:
    """Create a saved alert without importing or running the analyzer."""
    values = {
        'customer': customer, 'customer_name': customer.name,
        'seller_name': customer.seller.name, 'bucket': 'Azure', 'months_analyzed': 6,
        'avg_revenue': 100, 'latest_revenue': 50, 'category': 'DECLINING',
        'recommended_action': 'CHECK-IN', 'confidence': 'HIGH', 'priority_score': 70,
        'dollars_at_risk': 100, 'dollars_opportunity': 0, 'review_status': 'new',
        'analyzed_at': STAMP,
    }
    values.update(changes)
    analysis = RevenueAnalysis(**values)
    db.session.add(analysis)
    return analysis


def test_hygiene_scope_counts_notes_and_seller_intersection(customers, app):
    """Scope both gap populations and annotations without widening seller mode."""
    first, second = customers
    with db.session.no_autoflush:
        engagements = [
            Engagement(customer=customer, title=customer.name, status='Active', estimated_acr=100)
            for customer in customers
        ]
    db.session.add_all(engagements)
    add_milestone(first)
    add_milestone(second, 900)
    db.session.flush()
    for engagement in engagements:
        db.session.add(HygieneNote(
            entity_type='engagement', entity_id=engagement.id, note='Still a gap',
        ))
    db.session.commit()
    baseline = hygiene.get_hygiene_gaps_widget(REFERENCE)
    scoped = hygiene.get_hygiene_gaps_widget(REFERENCE, customer_ids=(first.id,))
    assert baseline['total'] == 4
    assert scoped['total'] == 2
    assert scoped['engagement_count'] == scoped['milestone_count'] == 1
    assert scoped['on_team_count'] == scoped['annotated_count'] == 1
    assert hygiene.get_hygiene_gaps_widget(REFERENCE, customer_ids=())['total'] == 0
    with app.test_request_context():
        from flask import session
        session['seller_mode_seller_id'] = first.seller_id
        assert hygiene.get_hygiene_gaps_widget(
            REFERENCE, customer_ids=(second.id,),
        )['total'] == 0
    assert hygiene.get_hygiene_gaps_widget(REFERENCE) == baseline
    assert not db.session.dirty


def test_meeting_scope_filters_coverage_denominator(customers, monkeypatch, app):
    """Only scoped customer meetings contribute to coverage, including zero and empty."""
    first, second = customers
    milestone = add_milestone(first)
    meetings = []
    for index, customer in enumerate((first, second, None)):
        meeting = PrefetchedMeeting(
            workiq_id=f'scope-meeting-{index}', subject='Scoped meeting',
            customer=customer, meeting_date=REFERENCE, start_time=STAMP, expires_at=STAMP,
        )
        db.session.add(meeting)
        meetings.append(meeting)
    db.session.flush()
    db.session.add(MsxTask(
        msx_task_id='scoped-task', subject='Logged', task_category=1,
        milestone=milestone, meeting=meetings[0], is_hva=True,
    ))
    db.session.commit()
    monkeypatch.setattr(activity_coverage, 'get_population_status', lambda reference: {})
    baseline = activity_coverage.get_meeting_activity_coverage_widget(REFERENCE)
    scoped = activity_coverage.get_meeting_activity_coverage_widget(
        REFERENCE, customer_ids=(first.id,),
    )
    assert baseline['summary']['total'] == 3
    assert baseline['coverage_percent'] == 33
    assert scoped['summary']['total'] == scoped['summary']['logged'] == 1
    assert scoped['coverage_percent'] == 100
    zero = activity_coverage.get_meeting_activity_coverage_widget(
        REFERENCE, customer_ids=(second.id,),
    )
    assert zero['summary']['total'] == 1
    assert zero['coverage_percent'] == 0
    empty = activity_coverage.get_meeting_activity_coverage_widget(REFERENCE, customer_ids=())
    assert empty['coverage_percent'] is None
    assert empty['summary']['total'] == 0
    assert empty['rows'] == empty['queue'] == []
    with app.test_request_context():
        from flask import session
        session['seller_mode_seller_id'] = first.seller_id
        assert activity_coverage.get_meeting_coverage_data(
            REFERENCE, customer_ids=(second.id,),
        )['summary']['total'] == 0
    assert activity_coverage.get_meeting_activity_coverage_widget(REFERENCE) == baseline
    assert not db.session.dirty


def test_revenue_scope_filters_amounts_and_analysis_coverage(customers, app):
    """Empty scope never inherits another customer's saved analysis or impact."""
    first, second = customers
    analysis = add_analysis(first)
    add_analysis(second, dollars_at_risk=900)
    db.session.commit()
    analysis.dollars_at_risk = None
    db.session.commit()
    baseline = revenue_analysis.get_revenue_attention_widget(REFERENCE)
    scoped = revenue_analysis.get_revenue_attention_widget(
        REFERENCE, customer_ids=(first.id,),
    )
    assert baseline['pending_count'] == 2
    assert scoped['pending_count'] == 1
    assert scoped['at_risk'] is None
    assert scoped['opportunity'] == 0
    assert scoped['at_risk_missing'] == 1
    assert scoped['has_analysis']
    empty = revenue_analysis.get_revenue_attention_widget(REFERENCE, customer_ids=())
    assert not empty['has_analysis']
    assert empty['pending_count'] == empty['at_risk'] == empty['opportunity'] == 0
    assert empty['oldest_analysis'] is None
    assert revenue_analysis.get_actionable_analysis_query(customer_ids=()).count() == 0
    with app.test_request_context():
        from flask import session
        session['seller_mode_seller_id'] = first.seller_id
        intersected = revenue_analysis.get_revenue_attention_widget(
            REFERENCE, customer_ids=(second.id,),
        )
        assert not intersected['has_analysis']
        assert intersected['pending_count'] == 0
    assert revenue_analysis.get_revenue_attention_widget(REFERENCE) == baseline
    assert not db.session.dirty


def test_renewal_scope_filters_source_rows_before_counts_and_amounts(customers):
    """Both report grains are scoped while source snapshots remain unchanged."""
    first, second = customers
    snapshot = PToFImport(customer_count=2, summary_count=2, detail_count=4)
    db.session.add(snapshot)
    db.session.flush()
    for customer, amount in ((first, 0), (second, 900)):
        for expiration in (REFERENCE.isoformat(), None):
            db.session.add(PToFRecord(
                snapshot=snapshot, tpid=customer.tpid, kind='details',
                data_json={
                    'tpid': customer.tpid, 'expiration_date': expiration,
                    'sa_expiration_amount': amount,
                },
            ))
        db.session.add(PToFRecord(
            snapshot=snapshot, tpid=customer.tpid, kind='summary',
            data_json={'tpid': customer.tpid, 'renewal_status': 'Pending'},
        ))
    db.session.commit()
    baseline = ptof.get_ptof_renewals_widget(REFERENCE)
    scoped = ptof.get_ptof_renewals_widget(REFERENCE, customer_ids=(first.id,))
    assert baseline['sa_expiration_amount'] == 900
    assert scoped['sa_expiration_amount'] == 0
    assert scoped['counts']['upcoming'] == scoped['counts']['customers'] == 1
    assert scoped['counts']['undated'] == 1
    assert len(ptof.get_ptof_report(customer_ids=(first.id,))['summary']) == 1
    assert ptof.get_ptof_report(second.id, customer_ids=(first.id,))['details'] == []
    empty = ptof.get_ptof_renewals_widget(REFERENCE, customer_ids=())
    assert empty['rows'] == []
    assert empty['snapshot_state'] == 'empty'
    assert all(value == 0 for value in empty['counts'].values())
    assert empty['sa_expiration_amount'] is None
    assert ptof.get_ptof_renewals_widget(REFERENCE) == baseline
    assert PToFRecord.query.count() == 6
    assert not db.session.dirty


def test_fabric_scope_precedes_counts_and_preview_without_mutating_overview(monkeypatch):
    """Customer filters run before signal counting, missing-capacity counting and slicing."""
    rows = [
        {
            'id': customer_id, 'name': f'Customer {customer_id}',
            'capacity': {
                'capacity_id': f'cap-{customer_id}-{index}', 'tenant_id': 'tenant',
                'latest_utilization_pct': 100, 'max_30s_utilization_pct': None,
                'throttling_seconds': 0,
            },
        }
        for customer_id, count in ((1, 2), (2, 8))
        for index in range(count)
    ]
    rows.append({'id': 2, 'name': 'Customer 2', 'capacity': None})
    overview = {'snapshot': {'id': 1}, 'rows': rows, 'workloads': [], 'totals': {}}
    before = deepcopy(overview)
    monkeypatch.setattr(
        fabric_consumption, 'get_fabric_capacity_overview', Mock(return_value=overview),
    )
    baseline = fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE)
    scoped = fabric_consumption.get_fabric_capacity_pressure_widget(
        REFERENCE, customer_ids=(1,),
    )
    assert baseline['counts']['capacities'] == 10
    assert baseline['remaining_count'] == 5
    assert scoped['counts']['capacities'] == scoped['counts']['unknown'] == 2
    assert scoped['counts']['customers_without_capacity'] == 0
    assert scoped['shown_count'] == 2
    assert scoped['remaining_count'] == 0
    assert all(row['max_30s_utilization_pct'] is None for row in scoped['rows'])
    empty = fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE, customer_ids=())
    assert empty['rows'] == []
    assert empty['matching_count'] == empty['shown_count'] == empty['remaining_count'] == 0
    assert all(value == 0 for value in empty['counts'].values())
    report = fabric_consumption.get_fabric_capacity_pressure_report(
        REFERENCE, customer_ids=(1,), signal='overloaded',
    )
    assert report['matching_count'] == 2
    assert overview == before
    assert fabric_consumption.get_fabric_capacity_pressure_widget(REFERENCE) == baseline


def test_initiative_scope_rebuilds_groups_and_totals_from_live_links(customers):
    """Snapshots cannot admit unavailable work, projects or another customer's amounts."""
    first, second = customers
    engagement = Engagement(customer=first, title='First engagement', estimated_acr=0)
    db.session.add(engagement)
    milestone = add_milestone(second, 900)
    section = ManagerInitiativeSection(name='Mixed')
    project_section = ManagerInitiativeSection(name='Internal only')
    empty_section = ManagerInitiativeSection(name='Empty')
    db.session.add_all([engagement, section, project_section, empty_section])
    db.session.flush()
    for item_type, entity, owner in (
        ('engagement', engagement, section), ('milestone', milestone, section),
        ('project', Project(title='Internal work'), project_section),
        ('engagement', None, section),
    ):
        item = ManagerInitiativeItem(
            section=owner, item_type=item_type,
            title_snapshot='Snapshot title', customer_snapshot=first.name,
        )
        setattr(item, item_type, entity)
        db.session.add(item)
    db.session.commit()
    baseline = manager_one_on_one.get_initiative_tracker_widget(REFERENCE)
    scoped = manager_one_on_one.get_initiative_tracker_widget(
        REFERENCE, customer_ids=(first.id,),
    )
    assert len(baseline['sections']) == 3
    assert len(scoped['sections']) == 1
    selected = scoped['sections'][0]
    assert selected['summary'] == {
        'item_count': 1, 'unavailable_count': 0, 'acr': 0,
        'acr_count': 1, 'acr_missing_count': 0,
    }
    assert len(selected['seller_groups']) == 1
    assert selected['seller_groups'][0]['seller_id'] == first.seller_id
    assert selected['seller_groups'][0]['summary'] == selected['summary']
    assert manager_one_on_one.get_initiative_tracker_widget(
        REFERENCE, customer_ids=(),
    )['sections'] == []
    assert manager_one_on_one.get_initiative_tracker_widget(REFERENCE) == baseline
    assert len(section.items) == 3
    assert ManagerInitiativeItem.query.count() == 4
    assert not db.session.dirty
