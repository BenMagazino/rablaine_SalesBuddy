"""Shared analytical signals, catalog integration, and revenue review queue regressions."""
from datetime import datetime, timezone
import json

from bs4 import BeautifulSoup
import pytest

from app.models import Customer, RevenueAnalysis, Seller, db
from app.services.dashboards import WIDGET_DEFINITIONS
from app.services.revenue_analysis import (
    get_actionable_analyses, get_revenue_attention_widget,
)
from app.services.salesiq_tools import execute_tool


SIGNAL_KEYS = (
    'hygiene.gaps', 'activity_coverage.meetings', 'revenue.attention',
    'ptof.upcoming_renewals', 'fabric.capacity_pressure',
)


def add_analysis(customer: Customer, bucket: str = 'Azure', **changes) -> RevenueAnalysis:
    """Create a saved analysis without running imports or external analysis."""
    values = {
        'customer': customer, 'customer_name': customer.name, 'bucket': bucket,
        'seller_name': customer.seller.name if customer.seller else None,
        'months_analyzed': 6, 'avg_revenue': 10000, 'latest_revenue': 8000,
        'category': 'DECLINING', 'recommended_action': 'CHECK-IN',
        'confidence': 'HIGH', 'priority_score': 70,
        'dollars_at_risk': 2000, 'dollars_opportunity': 0, 'review_status': 'new',
        'analyzed_at': datetime(2026, 10, 1, tzinfo=timezone.utc),
    }
    values.update(changes)
    analysis = RevenueAnalysis(**values)
    db.session.add(analysis)
    return analysis


def test_revenue_widget_uses_complete_unreviewed_priority_queue(app):
    """Counts and impacts are not silently truncated to the report's first fifty alerts."""
    with app.app_context():
        customer = Customer(name='Review queue', tpid=880101)
        for index in range(55):
            add_analysis(customer, bucket=f'Bucket {index}')
        for status in ('reviewed', 'actioned', 'dismissed'):
            add_analysis(customer, bucket=status, review_status=status)
        add_analysis(customer, bucket='Low priority', priority_score=19)
        add_analysis(customer, bucket='No action', recommended_action='NO ACTION')
        add_analysis(
            customer, bucket='Expansion', review_status='to_be_reviewed',
            dollars_at_risk=0, dollars_opportunity=4000,
        )
        db.session.commit()
        widget = get_revenue_attention_widget()
        assert widget['pending_count'] == 56
        assert widget['at_risk'] == 110000
        assert widget['opportunity'] == 4000
        assert len(get_actionable_analyses(min_priority=20, limit=50)) == 50
        assert widget['oldest_analysis'].startswith('2026-10-01')
        assert widget['destination'] == '/reports/revenue'


def test_revenue_widget_preserves_unknown_and_zero_impacts(app):
    """An absent dollar estimate must not be rendered as a known zero."""
    with app.app_context():
        customer = Customer(name='Missing impact', tpid=880102)
        analysis = add_analysis(customer)
        db.session.commit()
        analysis.dollars_at_risk = None
        db.session.commit()
        widget = get_revenue_attention_widget()
        assert widget['at_risk'] is None
        assert widget['at_risk_missing'] == 1
        assert widget['opportunity'] == 0
        assert widget['opportunity_missing'] == 0


def test_revenue_widget_distinguishes_missing_analysis_from_clear_queue(app):
    """A dashboard must not call a never-analyzed territory healthy."""
    with app.app_context():
        assert get_revenue_attention_widget()['has_analysis'] is False
        customer = Customer(name='Healthy account', tpid=880105)
        add_analysis(customer, recommended_action='NO ACTION', category='HEALTHY')
        db.session.commit()
        widget = get_revenue_attention_widget()
        assert widget['has_analysis'] is True
        assert widget['pending_count'] == 0
        assert widget['at_risk'] == widget['opportunity'] == 0


def test_review_action_refreshes_revenue_widget_totals(app):
    """The existing review workflow immediately changes the next dashboard calculation."""
    with app.app_context():
        customer = Customer(name='Follow-up account', tpid=880106)
        alert = add_analysis(customer)
        db.session.commit()
        assert get_revenue_attention_widget()['at_risk'] == 2000
        alert.review_status = 'actioned'
        db.session.commit()
        widget = get_revenue_attention_widget()
        assert widget['pending_count'] == 0
        assert widget['at_risk'] == 0
        assert db.session.get(RevenueAnalysis, alert.id) is not None


def test_revenue_widget_matches_active_seller_scope(app, client):
    """Seller mode never combines another seller's saved revenue alerts."""
    with app.app_context():
        seller = Seller(name='Scope seller')
        customer = Customer(name='In scope', tpid=880103, seller=seller)
        other = Customer(name='Other account', tpid=880104, seller=Seller(name='Other seller'))
        add_analysis(customer)
        add_analysis(other, dollars_at_risk=9000)
        db.session.commit()
        seller_id = seller.id
    with client.session_transaction() as session:
        session['seller_mode_seller_id'] = seller_id
    response = client.get('/api/reports/dashboards/widget-preview', query_string={
        'key': 'revenue.attention', 'variant': 'detailed', 'width': 6,
    })
    assert response.status_code == 200
    page = BeautifulSoup(response.json['html'], 'html.parser')
    assert 'In scope' in page.get_text()
    assert 'Other account' not in page.get_text()
    assert '$2,000' in page.get_text()
    assert page.select_one('a.db-report-seller .bi-person')


@pytest.mark.parametrize('key', SIGNAL_KEYS)
@pytest.mark.parametrize(('variant', 'width'), [
    ('metric', 3), ('metric', 4), ('metric', 6), ('metric', 12),
    ('detailed', 6), ('detailed', 12),
])
def test_signal_widgets_render_all_catalog_footprints(
    client, key, variant, width, dashboard_sources_ready,
):
    """Every new widget has an honest empty state without requiring fiscal setup."""
    response = client.get('/api/reports/dashboards/widget-preview', query_string={
        'key': key, 'variant': variant, 'width': width,
    })
    assert response.status_code == 200
    page = BeautifulSoup(response.json['html'], 'html.parser')
    assert page.select_one('.db-report-widget')
    assert not page.select('[data-widget-requirement], .sb-connect-goals')
    assert WIDGET_DEFINITIONS[key].requirements == ()
    assert page.select_one('.db-report-heading a')['href'].startswith('/reports/')


@pytest.mark.parametrize('key', SIGNAL_KEYS)
def test_new_signal_tools_reuse_widget_provider(app, key):
    """SalesIQ can query every new analytical signal without requiring a saved dashboard."""
    with app.test_request_context():
        result = execute_tool('report_dashboard_signals', {'widget_key': key})
        assert result == WIDGET_DEFINITIONS[key].provider(None)
        json.dumps(result)
