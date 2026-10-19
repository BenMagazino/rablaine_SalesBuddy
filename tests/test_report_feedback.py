"""Regression coverage for monthly 1:1 preparation and customer activity sorting."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from bs4 import BeautifulSoup
import pytest

from app.models import (
    Customer, Engagement, Milestone, Note, RevenueAnalysis, Seller, Territory, Topic, db,
)
from app.services.one_on_one_report import get_activity_cutoffs
from app.services.salesiq_tools import execute_tool


@pytest.fixture
def monthly_activity(app):
    """Keep monthly, recent, and excluded evidence distinct in the isolated database."""
    reference = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
    local = reference.astimezone().replace(tzinfo=None)
    with app.app_context():
        sellers = [Seller(name='Zulu Seller'), Seller(name='Alpha Seller')]
        territories = [Territory(name='Alpha Territory'), Territory(name='Zulu Territory')]
        topic = Topic(name='Monthly SQL')
        customers = [
            Customer(name='Monthly Customer', tpid=998101,
                     seller=sellers[0], territory=territories[0]),
            Customer(name='Recent Customer', tpid=998102,
                     seller=sellers[1], territory=territories[1]),
            Customer(name='Old Customer', tpid=998103),
        ]
        engagements = [
            Engagement(title='Monthly Work', customer=customers[0], estimated_acr=99.99),
            Engagement(title='Recent Work', customer=customers[1], estimated_acr=10000.01),
            Engagement(title='Old Work', customer=customers[2], estimated_acr=None),
            Engagement(title='Other Monthly Work', customer=customers[0], estimated_acr=0.02),
        ]
        notes = [
            Note(customer=customer, call_date=local - timedelta(days=age),
                 content=f'Activity {age} days ago', topics=[topic])
            for customer, age in zip(customers, [20, 5, 31])
        ]
        for engagement, note in zip(engagements, notes):
            engagement.notes.append(note)
        engagements[3].notes.append(notes[0])
        milestone = Milestone(
            customer=customers[0], title='Monthly Commitment', url='https://example.com/monthly',
            on_my_team=True, monthly_usage=1234.56,
            committed_at=reference - timedelta(days=20),
        )
        alert = RevenueAnalysis(
            customer_name=customers[0].name, bucket='Azure', category='DECLINING',
            review_status='reviewed', reviewed_at=reference - timedelta(days=20),
            dollars_at_risk=4000, months_analyzed=6, avg_revenue=5000,
            latest_revenue=1000, recommended_action='CHECK-IN', confidence='HIGH',
            priority_score=80,
        )
        db.session.add_all([*engagements, *notes, milestone, alert])
        db.session.commit()
    with patch('app.services.one_on_one_report.get_activity_cutoffs',
               side_effect=lambda days: get_activity_cutoffs(days, reference)):
        yield reference


def test_monthly_window_controls_every_recent_population(client, app, monthly_activity):
    """Thirty days includes older calls, commitments, topic counts and reviewed alerts."""
    default = BeautifulSoup(client.get('/reports/one-on-one').data, 'html.parser')
    monthly = BeautifulSoup(client.get('/reports/one-on-one?days=30').data, 'html.parser')
    assert len(default.select('#recent > .oo-customer')) == 1
    assert len(monthly.select('#recent > .oo-customer')) == 2
    assert 'Monthly Work' not in default.select_one('#recent').get_text()
    assert 'Monthly Work' in monthly.select_one('#recent').get_text()
    assert 'Old Work' not in monthly.select_one('#recent').get_text()
    assert default.select_one('#oneOnOneCommitments') is None
    assert 'Monthly Commitment' in monthly.select_one('#oneOnOneCommitments').get_text()
    assert monthly.select_one('#oneOnOneCommitments tbody td:nth-child(3)')[
        'data-sb-sort-value'
    ] == '1234.56'
    assert default.select_one('#oneOnOneRevenue') is None
    assert monthly.select_one('#oneOnOneRevenue tbody td').text == 'Monthly CustomerAzure'
    assert default.select_one('#oneOnOneTopics tbody td:nth-child(3)').get_text() == '1'
    assert monthly.select_one('#oneOnOneTopics tbody td:nth-child(3)').get_text() == '2'
    assert [item.text for item in monthly.select('.oo-stat strong')] == [
        '2', '3', '2', '4', '3', '$1,235',
    ]
    assert monthly.select_one('#oneOnOnePeriod option[selected]')['value'] == '30'
    assert monthly.select_one('.sb-one-on-one')['data-period-label'] == 'Last 30 Days'
    assert '30d' in monthly.select_one('.oo-stats').get_text()
    assert '2w' not in monthly.select_one('.oo-stats').get_text()
    assert 'Last 30 Days' in monthly.select_one('#recent-tab').text
    with app.test_request_context():
        result = execute_tool('report_one_on_one', {'days': 30})
    assert result['period_days'] == 30
    assert result['total_notes'] == 2
    assert len(result['recently_committed_milestones']) == 1


@pytest.mark.parametrize('order, names', [
    ('recent', ['Recent Customer', 'Monthly Customer']),
    ('acr', ['Recent Customer', 'Monthly Customer']),
    ('seller', ['Recent Customer', 'Monthly Customer']),
    ('territory', ['Monthly Customer', 'Recent Customer']),
])
def test_activity_sort_keeps_customer_groups_and_both_lenses(
    client, monthly_activity, order, names,
):
    """Raw ACR and ownership ordering never omit notes, engagements or missing owners."""
    response = client.get(f'/reports/one-on-one?days=30&activity_sort={order}&embed=1')
    soup = BeautifulSoup(response.data, 'html.parser')
    for tab in ['recent', 'alltime']:
        actual = [
            group.select_one('summary > a').get_text()
            for group in soup.select(f'#{tab} > .oo-customer')
        ]
        assert actual[:2] == names
        if tab == 'alltime':
            assert actual[2:] == ['Old Customer']
        if order == 'acr':
            monthly = next(
                group for group in soup.select(f'#{tab} > .oo-customer')
                if group.select_one('summary > a').text == 'Monthly Customer'
            )
            assert '$100/mo est. ACR' in monthly.select_one('summary').get_text()
            assert [link.text for link in monthly.select('.oo-engagement-heading a')] == [
                'Monthly Work', 'Other Monthly Work',
            ]
    assert soup.select_one('input[name="embed"]')['value'] == '1'
    assert soup.select_one('#oneOnOneActivitySort option[selected]')['value'] == order
    assert '1:1 Report - Last 30 Days' in response.get_data(as_text=True)


@pytest.mark.parametrize('query', [
    'days=0', 'days=31', 'days=oops', 'activity_sort=unknown',
])
def test_invalid_report_controls_return_explicit_errors(client, query):
    """Invalid URL selections must not silently display a different report scope."""
    response = client.get('/reports/one-on-one?' + query)
    assert response.status_code == 400


def test_cutoffs_preserve_local_call_dates_and_utc_timestamps():
    """The same rolling duration respects the two intentionally different timestamp models."""
    reference = datetime(2026, 3, 1, 12, tzinfo=timezone(timedelta(hours=5)))
    utc_cutoff, local_cutoff = get_activity_cutoffs(30, reference)
    assert utc_cutoff == reference.astimezone(timezone.utc) - timedelta(days=30)
    assert utc_cutoff.tzinfo is timezone.utc
    assert local_cutoff == (
        reference.astimezone().replace(tzinfo=None) - timedelta(days=30)
    )
    assert local_cutoff.tzinfo is None
    for days in [True, '30', 0, -1, 91]:
        with pytest.raises(ValueError, match='between 1 and 90'):
            get_activity_cutoffs(days)


def test_thirty_day_boundary_is_inclusive_for_local_calls_and_utc_commitments(
    client, app, monthly_activity,
):
    """One microsecond outside either cutoff must not enter a monthly review."""
    utc_cutoff, local_cutoff = get_activity_cutoffs(30, monthly_activity)
    with app.app_context():
        customer = Customer.query.filter_by(name='Monthly Customer').one()
        for label, delta in [
            ('Boundary included', timedelta()), ('Boundary excluded', timedelta(microseconds=1)),
        ]:
            db.session.add(Note(
                customer=customer, call_date=local_cutoff - delta, content=label,
            ))
            db.session.add(Milestone(
                customer=customer, title=label, url=f'https://example.com/{label}',
                on_my_team=True, committed_at=utc_cutoff - delta,
            ))
        db.session.commit()
    soup = BeautifulSoup(client.get('/reports/one-on-one?days=30').data, 'html.parser')
    for selector in ['#recent', '#oneOnOneCommitments']:
        assert 'Boundary included' in soup.select_one(selector).get_text()
        assert 'Boundary excluded' not in soup.select_one(selector).get_text()


def test_workspace_tool_filters_exact_detailed_names(app, sample_data):
    """SalesIQ accepts the same cross-area OR selection as the cached milestone UI."""
    with app.app_context():
        for workload in ['Apps: App Service', ' Sec: Defender ', 'Infra: Networking']:
            db.session.add(Milestone(
                customer_id=sample_data['customer1_id'], title=workload.strip(),
                workload=workload, url='https://example.com/workload',
            ))
        db.session.commit()
        with app.test_request_context():
            result = execute_tool('get_msx_workspace_milestones', {
                'workloads': ['Apps: App Service', 'Sec: Defender'],
            })
        assert result['count'] == 2
        assert {row['title'] for row in result['milestones']} == {
            'Apps: App Service', 'Sec: Defender',
        }
