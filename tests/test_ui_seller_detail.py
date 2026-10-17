"""Seller coverage, complete embedded consumers and isolated destructive-action parity."""
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from sqlalchemy.exc import SQLAlchemyError

from app.models import Customer, Milestone, OneOnOneWorkspace, Seller, db


def parse(response):
    """Parse the seller's actual standalone response."""
    assert response.status_code == 200
    return BeautifulSoup(response.data, 'html.parser')


def test_complete_native_inventory(client, sample_data):
    """Identity, all customers, exact destinations, role actions and native frame survive."""
    seller_id = sample_data['seller1_id']
    soup = parse(client.get(f'/seller/{seller_id}'))
    root = soup.select_one('[data-sb-seller-detail]')
    assert not {'sb-directory-frame', 'sb-directory-frame-wide'} & set(root['class'])
    assert root['data-sb-seller-detail'] == str(seller_id)
    assert 'sb-page-frame' in soup.body['class']
    assert soup.select_one('.sb-page-status')
    assert len(root.select('#customerTableBody tr')) == 2
    assert {a['href'] for a in root.select('#customerTableBody td:first-child a')} == {
        f'/customer/{sample_data["customer1_id"]}',
        f'/customer/{sample_data["customer3_id"]}',
    }
    assert {th['data-export-label'] for th in root.select('.sd-table th')} == {
        'Customer', 'Last Note',
    }
    assert root.select_one('#customerTableBody td[data-sb-sort-value]')
    commands = {a['href'] for a in root.select('.sd-commands a')}
    assert commands == {
        f'/seller/{seller_id}/one-on-one', f'/customer/new?seller_id={seller_id}',
        f'/seller/{seller_id}/edit',
    }
    assert root.select_one(f'[onclick="activateSellerMode({seller_id})"]')
    assert not root.select_one('#sellerDeleteDialog')
    assert not root.select('.card, .badge, .btn, .modal, [data-bs-toggle]')
    for asset in ('ui-dialog.js', 'ui-table-sort.js', 'ui-seller-detail.js',
                  'ui-engagements-directory.js'):
        assert len(soup.select(f'script[src^="/static/js/{asset}"]')) == 1


def test_embed_uses_exact_seller_provider_scope(client, sample_data):
    """The actual embedded native engagement panel keeps Active/On Hold and all controls."""
    seller_id = sample_data['seller1_id']
    soup = parse(client.get(f'/seller/{seller_id}'))
    panel = soup.select_one('[data-eng-directory]')
    assert panel['data-api-url'] == f'/api/seller/{seller_id}/engagements'
    assert panel['data-seller-scope'] == 'true'
    assert panel['data-show-seller'] == 'false'
    assert [b['data-status'] for b in panel.select('[data-status]')] == [
        '', 'Active', 'On Hold',
    ]
    assert panel.select_one('#engagementsBody_groupToggle')
    assert panel.select_one('#engagementsBody_favoritesBtn')
    assert soup.select_one('#engagementsBody.sb-eng-reading')
    assert [option['value'] for option in panel.select('option')] == [
        'updated', 'updated-asc', 'story-asc', 'story-desc', 'target', 'target-desc',
    ]


def test_read_has_no_quick_start_creation_and_preserves_role_visibility(client, sample_data):
    """Seller viewing remains read-only even though its explicit 1:1 link can create a workspace."""
    original = OneOnOneWorkspace.query.count()
    with client.session_transaction() as session:
        session['seller_mode_seller_id'] = sample_data['seller1_id']
    soup = parse(client.get(f'/seller/{sample_data["seller1_id"]}'))
    assert not soup.select_one('.sd-commands [onclick^="activateSellerMode"]')
    assert len(soup.select('#customerTableBody tr')) == 2
    assert OneOnOneWorkspace.query.count() == original


def test_milestone_populations_full_consumer_and_raw_values(client, sample_data):
    """Compact commitment exclusions differ intentionally from the complete locked tracker."""
    seller_id = sample_data['seller1_id']
    records = []
    for title, status, commitment, team in [
        ('Visible "milestone" <test>', 'On Track', 'Uncommitted', True),
        ('Committed remains in Full View', 'On Track', 'Committed', True),
        ('Cancelled remains in Full View', 'Cancelled', 'Uncommitted', True),
        ('Completed remains in Full View', 'Completed', 'Uncommitted', True),
        ('Not on team', 'On Track', 'Uncommitted', False),
    ]:
        records.append(Milestone(
            title=title, url='https://example.com/source',
            customer_id=sample_data['customer1_id'], msx_status=status,
            customer_commitment=commitment, on_my_team=team,
            workload='Data: SQL', monthly_usage=1234.56,
            due_date=datetime(2027, 1, 2, tzinfo=timezone.utc),
        ))
    db.session.add_all(records)
    db.session.commit()
    with patch('app.routes.main._find_stale_milestones', return_value=[]):
        soup = parse(client.get(f'/seller/{seller_id}'))
    rows = soup.select('#sdMilestones [data-milestone-id]')
    assert [r['data-milestone-id'] for r in rows] == [str(records[0].id)]
    assert rows[0].select_one('[data-sd-milestone]')['data-title'] == records[0].title
    assert rows[0].select_one('td[data-sb-sort-value="1234.56"]')
    assert rows[0].select_one('td[data-sb-sort-value="2027-01-02"]')
    assert [th.get_text(strip=True) for th in soup.select('#sdMilestones th')] == [
        'Milestone', 'Customer', 'Workload', 'Status', 'Due', 'ACR/mo',
    ]
    tracker = soup.select_one('dialog#milestonesModal .milestone-tracker-instance')
    assert tracker['data-locked-seller'] == str(seller_id)
    for record in records[:4]:
        assert record.title in tracker.get_text()
    assert records[4].title not in soup.get_text()
    assert soup.select_one(f'#milestonesModal a[href="/reports/milestone-tracker?seller={seller_id}"]')
    for role in ('searchFilter', 'customerFilter', 'myTeamFilter', 'commitmentFilter',
                 'urgencyFilter'):
        assert tracker.select_one(f'[data-role="{role}"]')
    assert soup.select_one('dialog#milestonePreviewDialog [data-sb-record-retry]')


def test_stale_population_does_not_require_current_tracker(client, sample_data):
    """Stale-only scope retains its own title fallbacks, age, usage and preview action."""
    customer = db.session.get(Customer, sample_data['customer1_id'])
    stale = SimpleNamespace(
        id=909, title='', opportunity_name="Stale's opportunity",
        customer=customer, workload='Infra: VM', days_since_comment=18,
        monthly_usage=12.34, msx_status='Blocked', url='https://example.com/stale',
    )
    with patch('app.routes.main._find_stale_milestones', return_value=[stale]):
        soup = parse(client.get(f'/seller/{sample_data["seller1_id"]}'))
    row = soup.select_one('[data-stale-milestone-id="909"]')
    assert row.select_one('[data-sd-milestone]')['data-title'] == stale.opportunity_name
    assert row.select_one('td[data-sb-sort-value="18"]')
    assert row.select_one('td[data-sb-sort-value="12.34"]')
    assert not soup.select_one('#milestonesModal')
    assert soup.select_one('dialog#milestonePreviewDialog')


def test_revenue_keeps_complete_shared_list_and_preview(client, sample_data):
    """Compact category, money and reviewed state coexist with all original full workflows."""
    alert = SimpleNamespace(
        id=900, bucket='Databases', customer_name='Acme Corp', customer_id=sample_data[
            'customer1_id'], customer=None, category='DECLINING', avg_revenue=1234.56,
        review_status='reviewed', priority_score=42, dollars_at_risk=210.45,
        dollars_opportunity=0, recommended_action='CHECK-IN (High)',
        engagement_rationale='Verify production workload', previous_review_status=None,
        previous_reviewed_at=None, reviewed_at=None, review_notes=None,
    )
    with patch('app.services.revenue_analysis.get_seller_alerts', return_value=[alert]):
        soup = parse(client.get(f'/seller/{sample_data["seller1_id"]}'))
    compact = soup.select_one('[data-sd-alert="900"]')
    assert compact.name == 'button' and compact['type'] == 'button'
    assert compact['data-reviewed'] == 'reviewed'
    for value in ('Databases', 'Declining', '$210 at risk', 'CHECK-IN (High)', 'Reviewed'):
        assert value in compact.get_text()
    assert soup.select_one('dialog#revenueModal [data-sb-revenue-alerts]')
    assert soup.select_one('#alertsTable td[data-sb-sort-value="210.45"]')
    assert not soup.select('#alertsTable th')[-1].has_attr('data-sb-sort-type')
    assert soup.select('#alertsTable th')[-1]['data-export-label'] == 'Actions'
    assert soup.select_one('dialog[data-sb-revenue-parent="revenueModal"]')
    assert soup.select_one('#sellerBucketFilterContainer')
    assert soup.select_one('#modalBucketFilterContainer')


def test_no_records_and_delete_dialog(client):
    """Empty states remain honest and deletion is an explicit native POST confirmation."""
    seller = Seller(name='No relationships', alias='empty', seller_type='Acquisition')
    db.session.add(seller)
    db.session.commit()
    soup = parse(client.get(f'/seller/{seller.id}'))
    for text in ('No customers assigned', 'No active milestones', 'No revenue insights'):
        assert text in soup.get_text()
    assert soup.select_one('a[href="mailto:empty@microsoft.com"]')
    form = soup.select_one('dialog#sellerDeleteDialog form')
    assert form['action'] == f'/seller/{seller.id}/delete' and form['method'] == 'POST'
    assert not form.has_attr('onsubmit')
    response = client.post(form['action'])
    assert response.status_code == 302 and response.headers['Location'] == '/sellers'
    assert db.session.get(Seller, seller.id) is None


def test_delete_refuses_customers_and_rolls_back_failure(client, sample_data):
    """Business guard, exact redirect and honest DB failures are exercised only in isolation."""
    seller_id = sample_data['seller1_id']
    response = client.post(f'/seller/{seller_id}/delete')
    assert response.headers['Location'] == f'/seller/{seller_id}'
    assert db.session.get(Seller, seller_id)
    seller = Seller(name='Failed delete')
    db.session.add(seller)
    db.session.commit()
    saved_id = seller.id
    with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('failure')), \
            patch.object(db.session, 'rollback', wraps=db.session.rollback) as rollback:
        response = client.post(f'/seller/{saved_id}/delete')
        assert rollback.called
    assert response.headers['Location'] == f'/seller/{saved_id}'
    assert db.session.get(Seller, saved_id)
    assert b'Could not delete the seller' in client.get(f'/seller/{saved_id}').data


def test_missing_seller_is_404(client):
    """A missing record never manufactures a detail page or engagement population."""
    assert client.get('/seller/999999').status_code == 404
    assert client.get('/api/seller/999999/engagements').status_code == 404


def test_layout_owns_reading_without_fixed_legacy_height():
    """Native CSS defines the actual region geometry, not inline Bootstrap height proxies."""
    css = (Path(__file__).parents[1] / 'static' / 'css' / 'ui-seller-detail.css').read_text()
    assert 'overflow: auto' in css
    assert 'grid-template-columns: 355px minmax(0, 1fr)' in css
    assert 'height: 600px' not in css


def test_customer_list_uses_the_context_heading_inset() -> None:
    """Customer headers and rows share the heading's inset without changing other tables."""
    css = (Path(__file__).parents[1] / 'static' / 'css' / 'ui-seller-detail.css').read_text()
    assert '.sb-seller-detail { --sd-context-inset: 18px;' in css
    assert 'padding: 10px var(--sd-context-inset);' in css
    assert (
        '.sd-customers .sd-table :is(th, td):first-child '
        '{ padding-inline-start: var(--sd-context-inset); }'
    ) in css
