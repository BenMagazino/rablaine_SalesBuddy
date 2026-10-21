"""P to F source semantics, atomic snapshots, scheduling and report integration."""
from copy import deepcopy
from datetime import date
from unittest.mock import Mock

import pytest
import requests
from bs4 import BeautifulSoup

from app.models import Customer, Job, PToFImport, PToFRecord, UserPreference, db
from app.services import fabric_consumption, ptof, ptof_pull, scheduled_sync, sync_jobs


@pytest.fixture
def accounts(app):
    """Keep renewal rows and role preferences isolated from all real databases."""
    with app.app_context():
        pref = UserPreference.query.first()
        original = pref.user_role, pref.se_specialty
        pref.user_role, pref.se_specialty = 'se', 'data'
        customer = Customer(name='Local renewal customer', tpid=98923301)
        empty = Customer(name='No renewal data', tpid=98923302)
        db.session.add_all([customer, empty])
        db.session.commit()
        yield customer, empty, pref
        db.session.rollback()
        PToFRecord.query.delete()
        PToFImport.query.delete()
        pref.user_role, pref.se_specialty = original
        db.session.delete(customer)
        db.session.delete(empty)
        db.session.commit()


def payload(tpids: list[int]) -> dict:
    """Match the captured full dates, source ratios, blanks and distinct grains."""
    common = {'tpid': tpids[0], 'source_customer_name': 'Source account name',
              'sa_expiration_amount': 100, 'psku_renewal_amount': None}
    return {
        'metadata': {'complete': True, 'requested_tpids': tpids,
                     'fiscal_years': ['FY25', 'FY26', 'FY27', 'FY28']},
        'summary': [{
            **common, 'renewal_status': 'Not Renewed', 'renewal_status_group': 'Not Renewed',
            'psku_renewal_ratio': None, 'fsku_renewal_ratio': '1.276964072646708',
            'fsku_ri_annualized': 127.696407, 'fsku_paygo_annualized': 0,
            'earliest_expiration': 1811808000000, 'latest_expiration': 1811808000000,
            'ea_count': 1, 'renewed_ea_count': None,
        }],
        'details': [{
            **common, 'expiration_date': 1811808000000, 'subscription_status': 'Anniversary',
            'product_family': 'Power BI Premium P1',
        }],
    }


def test_renewal_widget_future_scope_respects_customer_selection(accounts, monkeypatch):
    """The full future list keeps scoped and explicitly empty selections restrictive."""
    customer, other, _ = accounts
    source = payload([customer.tpid, other.tpid])
    source["details"][0]["expiration_date"] = "2027-06-01"
    source["details"].append({
        **source["details"][0], "tpid": other.tpid, "expiration_date": "2028-01-01",
    })
    monkeypatch.setattr(ptof, "pull_ptof", lambda tpids, progress: source)
    ptof.sync_ptof()
    reference = date(2026, 10, 19)
    all_accounts = ptof.get_ptof_renewals_widget(reference)
    assert all_accounts["counts"]["upcoming"] == 0
    assert all_accounts["future"]["counts"]["customers"] == 2
    selected = ptof.get_ptof_renewals_widget(reference, customer_ids=(customer.id,))
    assert selected["future"]["counts"]["customers"] == 1
    assert selected["future"]["rows"][0]["customer_id"] == customer.id
    assert selected["future"]["sa_expiration_amount"] == 100
    empty = ptof.get_ptof_renewals_widget(reference, customer_ids=())
    assert empty["future"]["rows"] == []
    assert empty["future"]["counts"]["customers"] == 0


def test_queries_preserve_visual_grains_and_scope():
    """The source already contains full dates; do not recreate status thresholds locally."""
    summary = ptof_pull.build_query([123], ['FY27'], detail=False)
    detail = ptof_pull.build_query([123], ['FY27'], detail=True)
    assert summary['From'][0]['Entity'] == ptof_pull.SUMMARY_TABLE
    assert detail['From'][0]['Entity'] == ptof_pull.DETAIL_TABLE
    assert {c['Name'] for c in summary['Select']} >= {
        'renewal_status', 'earliest_expiration', 'latest_expiration',
        'fsku_renewal_ratio', 'fsku_ri_annualized',
    }
    assert {c['Name'] for c in detail['Select']} == {
        'tpid', 'source_customer_name', 'expiration_date', 'subscription_status',
        'product_family', 'sa_expiration_amount', 'psku_renewal_amount',
    }
    assert summary['Where'][0]['Condition']['In']['Values'] == [
        [{'Literal': {'Value': '123L'}}],
    ]
    assert ptof_pull.fiscal_years(date(2026, 10, 15)) == ['FY25', 'FY26', 'FY27', 'FY28']
    assert ptof_pull.fiscal_years(date(2026, 6, 30)) == ['FY24', 'FY25', 'FY26', 'FY27']


def test_pull_uses_complete_reader_and_owns_only_its_client():
    """Each query is fully paginated by the existing reader and uses the renewal report."""
    client = Mock(model_id=ptof_pull.MODEL_ID)
    client.query.return_value = []
    result = ptof_pull.pull_ptof([123, 123], client=client)
    assert result['metadata']['complete']
    assert result['metadata']['requested_tpids'] == [123]
    assert client.query.call_count == 2
    assert all(call.args[1] == ptof_pull.REPORT_ID for call in client.query.call_args_list)
    client.close.assert_not_called()


def test_import_matches_local_names_full_dates_and_unmodified_source_status(accounts, monkeypatch):
    """P to F details show local names and true source dates, independently of Fabric data."""
    customer, empty, _ = accounts
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: payload(tpids))
    result = ptof.sync_ptof()
    assert result['success']
    report = ptof.get_ptof_report(customer.id)
    assert report['details'][0]['customer_name'] == customer.name
    assert report['details'][0]['source_customer_name'] == 'Source account name'
    assert report['details'][0]['expiration_date'] == '2027-06-01'
    assert report['details'][0]['renewal_status'] == 'Not Renewed'
    summary = report['summary'][0]
    assert summary['renewal_status'] == 'Not Renewed'
    assert summary['fsku_renewal_ratio'] == pytest.approx(1.276964072646708)
    assert summary['psku_renewal_amount'] is None
    assert summary['fsku_paygo_annualized'] == 0
    assert ptof.get_ptof_report(empty.id)['details'] == []
    customer.name = 'Renamed local customer'
    db.session.commit()
    assert ptof.get_ptof_report(customer.id)['details'][0]['customer_name'] == customer.name


@pytest.mark.parametrize(('statuses', 'expected'), [
    (['P-to-F Renewed'], 'P-to-F Renewed'),
    (['Pending Renewal', 'P-to-F Renewed', 'Pending Renewal', None],
     'P-to-F Renewed; Pending Renewal'),
    ([], None),
    ([None], None),
])
def test_subscription_status_join_preserves_rows_and_account_scope(
    accounts, monkeypatch, statuses, expected,
):
    """Account assessments enrich details without duplicating or crossing subscriptions."""
    source = payload([customer.tpid for customer in accounts[:2]])
    assessment = source['summary'][0]
    source['summary'] = [{**assessment, 'renewal_status': status} for status in statuses]
    source['details'].extend([
        {**source['details'][0], 'product_family': 'Power BI Premium P2'},
        {**source['details'][0], 'tpid': accounts[1].tpid},
    ])
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: source)
    ptof.sync_ptof()
    details = ptof.get_ptof_report()['details']
    assert len(details) == 3
    assert [row['renewal_status'] for row in details] == [expected, expected, None]
    assert [row['sa_expiration_amount'] for row in details] == [100, 100, 100]
    assert len(ptof.get_ptof_report(accounts[0].id)['details']) == 2
    assert ptof.get_ptof_report(accounts[1].id)['details'][0]['renewal_status'] is None


@pytest.mark.parametrize('problem', ['scope', 'partial', 'missing', 'amount', 'date', 'foreign'])
def test_invalid_import_retains_previous_snapshot(accounts, monkeypatch, problem):
    """Never replace a successful import with a partial, foreign or corrupt response."""
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: payload(tpids))
    ptof.sync_ptof()
    previous = ptof.get_ptof_report()
    broken = deepcopy(payload([accounts[0].tpid, accounts[1].tpid]))
    if problem == 'scope':
        broken['metadata']['requested_tpids'] = []
    elif problem == 'partial':
        broken['metadata']['complete'] = False
    elif problem == 'missing':
        del broken['details'][0]['product_family']
    elif problem == 'amount':
        broken['summary'][0]['sa_expiration_amount'] = float('nan')
    elif problem == 'date':
        broken['details'][0]['expiration_date'] = 'not-a-date'
    else:
        broken['details'][0]['tpid'] = 999
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: broken)
    with pytest.raises(ptof.PToFError):
        ptof.sync_ptof()
    assert ptof.get_ptof_report() == previous
    assert PToFImport.query.count() == 1


def test_complete_empty_scope_can_remove_outdated_renewals(accounts, monkeypatch):
    """A verified empty result is not confused with a failed source request."""
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: payload(tpids))
    ptof.sync_ptof()
    empty = {'summary': [], 'details': [], 'metadata': {
        'complete': True, 'requested_tpids': [c.tpid for c in accounts[:2]],
        'fiscal_years': ['FY27'],
    }}
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: empty)
    ptof.sync_ptof()
    assert PToFImport.query.count() == 1
    assert PToFRecord.query.count() == 0
    assert ptof.get_ptof_report()['snapshot'] is not None


@pytest.mark.parametrize(('role', 'specialty', 'due'), [
    ('se', 'infra', False), ('se', 'apps_ai', False), ('se', 'other', False),
    ('se', 'data', True), ('dss', 'data', True), ('dss', 'infra', True),
    ('dss', 'apps_ai', True), ('dss', 'other', True), (None, 'data', True),
])
def test_weekly_refresh_includes_data_ses_and_all_sellers(accounts, role, specialty, due):
    """Non-Data SEs stay manual; all sellers inherit Data-specialty scheduling."""
    pref = accounts[2]
    pref.user_role, pref.se_specialty = role, specialty
    db.session.commit()
    assert scheduled_sync._fabric_sync_due() is due


def test_renewals_share_the_fabric_schedule(accounts):
    """Renewals have no separate admission or scheduler entry."""
    assert sync_jobs.operation_schedules()['fabric']['label'] == 'Every 7 days'
    assert 'ptof' not in sync_jobs.OPERATIONS
    assert 'ptof' not in sync_jobs.operation_schedules()


@pytest.mark.parametrize(('role', 'specialty', 'skipped'), [
    ('se', 'infra', True), ('se', 'apps_ai', True), ('se', 'other', True),
    ('dss', 'data', False), ('dss', 'infra', False),
    ('dss', 'apps_ai', False), ('dss', 'other', False),
])
def test_queued_automatic_import_rechecks_specialty_before_execution(
    accounts, monkeypatch, role, specialty, skipped,
):
    """Queued work skips non-Data SEs but keeps all source reads enabled for sellers."""
    from app.services.job_queue import CURRENT_JOB_ID

    telemetry = Mock(return_value={'success': True})
    renewals = Mock(return_value={'success': True})
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption', telemetry)
    monkeypatch.setattr(ptof, 'sync_ptof', renewals)
    job = Job(job_type='sync:fabric', initiator='scheduled', payload='{}')
    db.session.add(job)
    accounts[2].user_role, accounts[2].se_specialty = role, specialty
    db.session.commit()
    token = CURRENT_JOB_ID.set(job.id)
    try:
        result = fabric_consumption.sync_fabric_360()
        assert bool(result.get('skipped')) is skipped
        if skipped:
            telemetry.assert_not_called()
            renewals.assert_not_called()
        else:
            telemetry.assert_called_once()
            renewals.assert_called_once()
        assert PToFImport.query.count() == 0
    finally:
        CURRENT_JOB_ID.reset(token)


def test_report_and_customer_surface_are_read_only(client, accounts, monkeypatch):
    """Both views expose the shared grains without importing during rendering."""
    sync = Mock(side_effect=AssertionError('Rendering cannot refresh'))
    monkeypatch.setattr(ptof, 'sync_ptof', sync)
    page = BeautifulSoup(client.get('/reports/p-to-f').data, 'html.parser')
    assert page.h1.text == 'P to F'
    assert page.select_one('[data-sb-sync-progress="fabric"]')
    assert page.select_one('[data-ptof-import]').text == 'Refresh Fabric 360'
    assert page.select_one('[data-ptof-details]')
    assert page.select_one('[data-ptof-summary]') is None
    assert 'Renewal assessments' not in page.get_text()
    assert 'PSKU Renewal $' not in page.get_text()
    assert page.select_one('#navReports a[href="/reports/p-to-f"]')
    assert '/reports/p-to-f' in client.get('/reports').get_data(as_text=True)
    console = BeautifulSoup(client.get('/admin/sync-console').data, 'html.parser')
    assert console.select_one('[data-sync-operation="ptof"]') is None
    assert 'P to F renewals' in console.select_one('[data-sync-operation="fabric"]').text
    assert 'Not Renewed' in page.select_one('.sb-ptof-explanation').text
    customer = BeautifulSoup(client.get(f'/customer/{accounts[0].id}').data, 'html.parser')
    roots = customer.select('#cdFabric > section')
    assert roots[0].has_attr('data-ptof')
    assert roots[0]['data-customer-id'] == str(accounts[0].id)
    assert not roots[0].select('.sb-ptof-header, .sb-ptof-explanation, '
                               '[data-ptof-freshness], [data-ptof-detail-count]')
    assert roots[0].select_one('[data-ptof-details]')
    assert roots[0].select_one('.sb-ptof-section h3').text == 'P to F Status'
    assert roots[1].has_attr('data-fabric-report')
    sync.assert_not_called()


@pytest.mark.parametrize('value', ['bad', '0', '-1'])
def test_read_rejects_invalid_customer_scope(client, value):
    """Bad customer IDs must not silently show all accounts."""
    response = client.get('/api/reports/p-to-f', query_string={'customer_id': value})
    assert response.status_code == 400
    assert response.json['success'] is False


def test_manual_refresh_uses_durable_job_and_shared_tool(client, accounts, monkeypatch):
    """The endpoint admits once; the worker and SalesIQ reuse the domain service."""
    from app.services.salesiq_tools import execute_tool
    from app.services.job_queue import process_one

    telemetry = Mock(return_value={'success': True, 'customer_count': 2})
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption', telemetry)
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: payload(tpids))
    response = client.post('/api/reports/fabric-consumption/import')
    repeated = client.post('/api/jobs/start/fabric', json={})
    assert response.status_code == 202
    assert repeated.status_code == 202
    assert repeated.json['job_id'] == response.json['job_id']
    assert Job.query.filter_by(job_type='sync:fabric').count() == 1
    assert PToFImport.query.count() == 0
    process_one('test-worker')
    telemetry.assert_called_once()
    assert db.session.get(Job, response.json['job_id']).status == 'done'
    assert PToFImport.query.count() == 1
    assert execute_tool('report_ptof', {'customer_id': accounts[0].id}) == (
        ptof.get_ptof_report(accounts[0].id))


def test_combined_refresh_orders_sources_on_one_progress_scale(accounts, monkeypatch):
    """A source completion cannot mark the overall job complete before renewals finish."""
    calls, events = [], []

    def telemetry(progress):
        """Report a complete first source without fetching remote data."""
        calls.append('fabric')
        progress({'phase': 'reading', 'progress': 0})
        progress({'phase': 'complete', 'progress': 100})
        return {'success': True, 'import_id': 7}

    def renewals(progress):
        """Report renewal completion in the final quarter of the same job."""
        calls.append('ptof')
        progress({'phase': 'reading', 'progress': 0})
        progress({'phase': 'saving', 'progress': 95})
        return {'success': True, 'import_id': 8}

    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption', telemetry)
    monkeypatch.setattr(ptof, 'sync_ptof', renewals)
    result = fabric_consumption.sync_fabric_360(progress=events.append)
    assert calls == ['fabric', 'ptof']
    assert result['success']
    assert result['import_id'] == 7
    assert result['ptof']['import_id'] == 8
    assert [event['progress'] for event in events] == [0, 75, 75, 75, 98.75]
    assert all(event['phase'] != 'complete' for event in events)


def test_failed_telemetry_does_not_start_renewals(accounts, monkeypatch):
    """A failed first phase cannot be mistaken for a complete Fabric refresh."""
    failure = {'success': False, 'error': 'Telemetry unavailable', 'retryable': True}
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption',
                        Mock(return_value=failure))
    renewals = Mock(side_effect=AssertionError('Cannot start after telemetry failure'))
    monkeypatch.setattr(ptof, 'sync_ptof', renewals)
    assert fabric_consumption.sync_fabric_360() == failure
    renewals.assert_not_called()


@pytest.mark.parametrize(('error', 'retryable'), [
    (ptof.PToFError('Source unavailable'), False),
    (requests.ConnectionError('Source unavailable'), True),
    (requests.Timeout('Source unavailable'), True),
])
def test_failed_renewals_report_partial_refresh_and_keep_previous_snapshot(
    accounts, monkeypatch, caplog, error, retryable,
):
    """The shared job fails explicitly instead of hiding a stale second source."""
    monkeypatch.setattr(ptof, 'pull_ptof', lambda tpids, progress: payload(tpids))
    ptof.sync_ptof()
    previous = ptof.get_ptof_report()
    monkeypatch.setattr(fabric_consumption, 'sync_fabric_consumption',
                        Mock(return_value={'success': True, 'import_id': 9}))
    monkeypatch.setattr(ptof, 'sync_ptof',
                        Mock(side_effect=error))
    result = fabric_consumption.sync_fabric_360()
    assert result['success'] is False
    assert result['fabric']['import_id'] == 9
    assert 'telemetry and revenue were refreshed, but P to F failed' in result['error']
    assert 'Previous renewal data was retained' in result['error']
    assert 'Source unavailable' in caplog.text
    assert result['retryable'] is retryable
    assert ptof.get_ptof_report() == previous
