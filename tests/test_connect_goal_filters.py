"""Filtered Connect metrics use complete scoped populations, including U2C history."""
from datetime import date, datetime, timezone

import pytest

from app.models import (
    Customer, CustomerRevenueData, Milestone, MsxTask, RevenueImport, Seller,
    U2CSnapshot, U2CSnapshotItem, U2CSnapshotVersion, U2CSnapshotVersionItem, db,
)
from app.services import connect_goals, dashboards
from app.services.dashboard_filters import normalize_filters, resolve_customer_scope
from app.services.u2c_snapshot import get_attainment, get_attainment_trend
from tests.test_connect_goals import _confirm_scope, _milestone, _seed_revenue_buckets


@pytest.fixture
def scoped_snapshot(app):
    """Keep snapshot ownership, live ownership, history and new work deliberately different."""
    with app.app_context():
        seller = Seller(name='Snapshot account seller')
        first = Customer(name='Snapshot customer', tpid=890001, seller=seller)
        second = Customer(name='Other customer', tpid=890002)
        db.session.add_all([first, second])
        db.session.flush()
        snapshot = U2CSnapshot(
            fiscal_quarter='FY27 Q1', snapshot_date=datetime(2026, 7, 1, tzinfo=timezone.utc),
            total_items=4, total_monthly_acr=1000,
        )
        db.session.add(snapshot)
        db.session.flush()
        for index, (owner, amount, committed) in enumerate([
            (first, 100, True), (first, 300, False), (second, 600, True),
        ]):
            live = _milestone(
                owner.id, number=f'SCOPE-{index}', on_team=True, monthly_usage=amount * 2,
            )
            live.due_date = datetime(2026, 9, 10)
            live.customer_commitment = 'Committed' if committed else 'Uncommitted'
            db.session.add(live)
            db.session.flush()
            db.session.add(U2CSnapshotItem(
                snapshot_id=snapshot.id, milestone_id=live.id, customer_id=owner.id,
                customer_name=owner.name, milestone_number=live.milestone_number,
                milestone_title=live.title, workload=live.workload, monthly_acr=amount,
                due_date=live.due_date, msx_status='On Track',
            ))
            if index == 0:
                live.customer_id = second.id
        # New live work is not part of this quarter's frozen starting population.
        new_live = _milestone(first.id, number='NEW-LIVE', on_team=True, monthly_usage=9000)
        new_live.due_date = datetime(2026, 9, 10)
        new_live.customer_commitment = 'Committed'
        db.session.add(new_live)
        # An account's milestone outside the quarter must not leak into history.
        db.session.add(U2CSnapshotItem(
            snapshot_id=snapshot.id, customer_id=first.id, customer_name=first.name,
            milestone_number='OUTSIDE-QUARTER', milestone_title='Future work',
            workload='Data: Fabric', monthly_acr=7000, due_date=datetime(2026, 12, 1),
        ))
        for version_date, commitments in [
            (date(2026, 7, 7), ('Uncommitted', 'Uncommitted', 'Committed')),
            (date(2026, 7, 14), ('Committed', 'Uncommitted', 'Committed')),
        ]:
            version = U2CSnapshotVersion(
                snapshot_id=snapshot.id, msxi_version=version_date.strftime('%Y%m%d'),
                version_date=version_date, total_items=4, total_starting_acr=8000,
                total_committed_acr=7700, total_converted_acr=20000,
            )
            db.session.add(version)
            db.session.flush()
            for index, (amount, commitment) in enumerate(zip([100, 300, 600], commitments)):
                db.session.add(U2CSnapshotVersionItem(
                    version_id=version.id, milestone_number=f'SCOPE-{index}',
                    workload='Data: SQL Modernization', starting_acr=amount,
                    converted_acr=amount * 2 if commitment == 'Committed' else 0,
                    commitment=commitment, status='On Track',
                ))
            db.session.add(U2CSnapshotVersionItem(
                version_id=version.id, milestone_number='OUTSIDE-QUARTER',
                workload='Data: Fabric', starting_acr=7000, converted_acr=14000,
                commitment='Committed',
            ))
        db.session.add(U2CSnapshotVersion(
            snapshot_id=snapshot.id, msxi_version='20260721', version_date=date(2026, 7, 21),
            total_items=3, total_starting_acr=1000, total_committed_acr=700,
        ))
        _seed_revenue_buckets(first.id)
        _confirm_scope()
        db.session.commit()
        return snapshot.id, first.id, second.id, seller.id


def test_u2c_scope_uses_frozen_customer_and_baseline_not_live_ownership(app, scoped_snapshot):
    """Current commitments use snapshot dollars; moved/new milestones cannot rewrite scope."""
    snapshot_id, first, second, _ = scoped_snapshot
    with app.app_context():
        scoped = get_attainment(snapshot_id, 'Data:', customer_ids=(first,))
        assert scoped['target_total'] == 400
        assert scoped['committed_total'] == 100
        assert scoped['attainment_total'] == 200
        assert scoped['u2c_pct'] == 25
        assert scoped['total_in_scope'] == 2
        assert scoped['remaining_count'] == 1
        assert {item['customer_id'] for item in (
            scoped['committed_items'] + scoped['remaining_items']
        )} == {first}
        other = get_attainment(snapshot_id, 'Data:', customer_ids=(second,))
        assert other['target_total'] == other['committed_total'] == 600
        assert other['u2c_pct'] == 100
        all_customers = get_attainment(snapshot_id, 'Data:')
        assert all_customers['target_total'] == 1000
        assert all_customers['u2c_pct'] == 70


def test_u2c_historical_and_today_points_use_same_customer_scope(app, scoped_snapshot):
    """Weekly detail is scoped by frozen milestone identity, not aggregate totals."""
    snapshot_id, first, second, _ = scoped_snapshot
    with app.app_context():
        points = get_attainment_trend(
            snapshot_id, 'Data', include_live=True, reference=date(2026, 8, 15),
            customer_ids=(first,),
        )
        assert [point['date'] for point in points] == ['2026-07-07', '2026-07-14', '2026-08-15']
        assert [point['u2c_pct'] for point in points] == [0, 25, 25]
        assert all(point['starting_acr'] == 400 and point['items'] == 2 for point in points)
        assert points[1]['committed_acr'] == 100
        assert points[1]['msxi_converted_acr'] == 200
        assert points[-1]['source'] == 'live'
        # Customer filtering must also work independently of the workload slicer.
        assert get_attainment_trend(snapshot_id, customer_ids=(second,))[0]['u2c_pct'] == 100
        widget = connect_goals.get_u2c_widget(date(2026, 8, 15), customer_ids=(first,))
        assert widget['value'] == widget['trend'][-1]['u2c_pct'] == 25
        assert widget['starting_acr'] == 400 and widget['committed_acr'] == 100


def test_empty_u2c_scope_never_loads_the_portfolio_or_claims_progress(app, scoped_snapshot):
    """Explicit no matches and unknown accounts stay empty, including the trend."""
    snapshot_id, _, _, _ = scoped_snapshot
    with app.app_context():
        for scope in ((), (99999999,)):
            data = get_attainment(snapshot_id, 'Data:', customer_ids=scope)
            assert data['target_total'] == data['committed_total'] == data['total_in_scope'] == 0
            widget = connect_goals.get_u2c_widget(date(2026, 8, 15), customer_ids=scope)
            assert widget['available'] is False
            assert 'No snapshotted' in widget['message']
            assert widget['trend']
            assert all(point['starting_acr'] == point['committed_acr'] == point['items'] == 0
                       for point in widget['trend'])


def test_seller_scope_resolves_snapshot_accounts_not_live_milestone_owner(app, scoped_snapshot):
    """Dashboard Seller selections scope the baseline's customer, even after a live move."""
    _, first, _, seller_id = scoped_snapshot
    with app.app_context():
        scope = resolve_customer_scope(normalize_filters({'seller_ids': [seller_id]}))
        assert scope == (first,)
        assert connect_goals.get_u2c_widget(
            date(2026, 8, 15), customer_ids=scope,
        )['value'] == 25


def test_team_and_hva_filters_recalculate_denominators_and_validation_counts(app):
    """Customer scope is applied before weighted coverage and task counting."""
    with app.app_context():
        first = Customer(name='Covered account', tpid=890011)
        second = Customer(name='Uncovered account', tpid=890012)
        db.session.add_all([first, second])
        db.session.flush()
        milestones = [
            _milestone(first.id, number='FILTER-A', on_team=True, monthly_usage=100),
            _milestone(first.id, number='FILTER-B', on_team=False, monthly_usage=300),
            _milestone(second.id, number='FILTER-C', on_team=True, monthly_usage=600),
        ]
        db.session.add_all(milestones)
        db.session.flush()
        db.session.add(MsxTask(
            msx_task_id='filtered-demo', subject='Scoped demo', task_category=861980002,
            is_hva=True, due_date=datetime(2026, 8, 1), milestone_id=milestones[0].id,
        ))
        db.session.commit()
        ref = date(2026, 9, 23)
        first_team = connect_goals.get_team_coverage_widget(ref, customer_ids=(first.id,))
        assert first_team['value'] == 25 and first_team['total_acr'] == 400
        assert first_team['on_team_count'] == first_team['off_team_count'] == 1
        first_hva = connect_goals.get_hva_coverage_widget(ref, customer_ids=(first.id,))
        assert first_hva['value'] == 100 and first_hva['total_count'] == 1
        assert first_hva['validation_counts']['Demo'] == 1
        second_hva = connect_goals.get_hva_coverage_widget(ref, customer_ids=(second.id,))
        assert second_hva['value'] == 0 and second_hva['uncovered'] == 1
        assert second_hva['validation_counts']['Demo'] == 0
        assert connect_goals.get_team_coverage_widget(ref)['value'] == 70
        assert connect_goals.get_hva_coverage_widget(ref)['value'] == 50
        for provider in (connect_goals.get_team_coverage_widget, connect_goals.get_hva_coverage_widget):
            empty = provider(ref, customer_ids=())
            assert empty['available'] is False and empty['total_count'] == 0


def test_whitespace_scope_filters_wins_ramping_and_histories_without_changing_source_months(app):
    """Filtered accounts retain the same complete history used by the portfolio calculation."""
    with app.app_context():
        first = Customer(name='Scoped win', tpid=890021)
        second = Customer(name='Other ramp', tpid=890022)
        imported = RevenueImport(filename='filtered-whitespace')
        db.session.add_all([first, second, imported])
        db.session.flush()
        for customer, values in ((first, [0, 0, 0, 20, 30, 40]),
                                 (second, [0, 0, 0, 0, 0, 900])):
            for month, revenue in zip(range(4, 10), values):
                db.session.add(CustomerRevenueData(
                    customer_id=customer.id, customer_name=customer.name, bucket='Fabric',
                    fiscal_month=f'FY27-{month}', month_date=date(2026, month, 1),
                    revenue=revenue, last_import_id=imported.id,
                ))
        db.session.commit()
        ref = date(2026, 9, 23)
        baseline = connect_goals.get_whitespace_widget(ref)
        scoped = connect_goals.get_whitespace_widget(ref, customer_ids=(first.id,))
        assert scoped['wins']['Fabric'] == baseline['wins']['Fabric']
        assert len(scoped['wins']['Fabric']) == 1
        assert scoped['ramping']['Fabric'] == []
        other = connect_goals.get_whitespace_widget(ref, customer_ids=(second.id,))
        assert other['wins']['Fabric'] == []
        assert other['ramping']['Fabric'] == baseline['ramping']['Fabric']
        empty = connect_goals.get_whitespace_widget(ref, customer_ids=())
        assert all(not rows for rows in empty['wins'].values())
        assert all(not rows for rows in empty['ramping'].values())
        assert all(row['wins'] == row['ramping'] == 0 for row in empty['bucket_progress'])


def test_all_connect_catalog_variants_and_preview_follow_scope(app, scoped_snapshot):
    """Saved dashboard, preview and tool entry points declare and use identical capabilities."""
    from app.models import Dashboard, DashboardWidget

    _, first, second, _ = scoped_snapshot
    with app.app_context():
        dashboard = Dashboard(
            name='Scoped Connect', content_width='wide', display_style='cards',
            filter_config={'scope': {}, 'live_filters': ['customer_ids', 'seller_ids']},
        )
        for index, key in enumerate(key for key in dashboards.WIDGET_DEFINITIONS
                                    if key.startswith('connect_goals.')):
            definition = dashboards.WIDGET_DEFINITIONS[key]
            assert definition.supported_filters == ('customer_ids', 'seller_ids')
            for variant_index, variant in enumerate(definition.variants):
                dashboard.widgets.append(DashboardWidget(
                    widget_key=key, variant_key=variant.key, column_span=6, row_span=8,
                    layout_column=variant_index * 6, layout_row=index * 8,
                    filters={'customer_ids': [first]},
                ))
        db.session.add(dashboard)
        db.session.commit()
        reference = date(2026, 8, 15)
        data = dashboards.get_dashboard_data(dashboard, reference)
        assert len(data['widgets']) == 8
        for widget in data['widgets']:
            assert widget['filter_info']['scoped'] and not widget['filter_info']['ignored']
            if widget['key'] == 'connect_goals.u2c':
                assert widget['data']['starting_acr'] == 400 and widget['data']['value'] == 25
        empty = dashboards.get_dashboard_data(dashboard, reference,
                                             live_filters={'customer_ids': [second]})
        for widget in empty['widgets']:
            if widget['key'] == 'connect_goals.u2c':
                assert widget['data']['starting_acr'] == 0
