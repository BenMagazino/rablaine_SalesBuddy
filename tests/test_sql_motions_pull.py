"""SQL source query, strict normalization, quality and pagination regression tests."""
from datetime import date, datetime, timezone
from unittest.mock import Mock

import pytest

from app.services import sql_motions_pull as pull
from app.services.fabric_consumption_pull import FabricPullError, FabricQueryClient

STAMP = 1792540800000


def renewal(tpid: int = 1001, **overrides) -> dict:
    """Return one complete migration source row with mixed numeric representations."""
    return {
        'tpid': tpid, 'expiration_date': STAMP, 'expiration_amount': '1250.50',
        'install_base_cores': 12, 'sql_iaas_cores': '3.5', 'monthly_opportunity': None,
        **overrides,
    }


def arc(tpid: int = 1001, **overrides) -> dict:
    """Return one subscription/category discovery source row."""
    return {
        'tpid': tpid, 'subscription_id': 'sub', 'subscription_name': 'Subscription',
        'sql_version': 'SQL Server 2016', 'discovery_type': 'All Discovered',
        'processed_at': STAMP, 'discovered_count': '295', **overrides,
    }


def quality(**overrides) -> dict:
    """Return the required ARC pipeline's passing quality record."""
    return {
        'table_name': pull.ARC_QUALITY_TABLE, 'last_refresh': STAMP, 'result': 'Pass',
        **overrides,
    }


def metadata(tpids: list[int]) -> dict:
    """Return the complete persistence-boundary metadata contract."""
    return {
        'complete': True, 'requested_tpids': tpids, 'notices': [], 'sources': {
            'azure_migrations': {'complete': True, 'refresh_rows': []},
            'ads_accelerate': {'complete': True, 'quality_latest': [quality()]},
        },
    }


def test_queries_keep_exact_source_grain_and_only_tpid_filter():
    """No geography, StageName, segment, top-N or raw snapshot sum enters migration."""
    migration = pull.build_migration_query([1001, 1002])
    assert migration['From'][0]['Entity'] == 'dimazuremigrationaccounts'
    assert migration['Select'][0]['Column']['Property'] == 'TPAccountID'
    assert len(migration['Where']) == 1
    assert all('Measure' in field for field in migration['Select'][1:])
    assert [field['Measure']['Property'] for field in migration['Select'][1:]] == [
        'Next Up SQL Expiration Date', 'Next Up SQL Expiration $', 'SQL Install Base LCM',
        'SQL on IaaS Capped Cores', 'Monthly SQL ACR Opportunity',
    ]
    query = pull.build_arc_query([1001])
    assert query['From'][0]['Entity'] == 'ARC BY License Type'
    assert len(query['Select']) == 7
    assert len(query['Where']) == 1
    assert query['Select'][-1]['Aggregation']['Function'] == 0
    assert query['Select'][-1]['Aggregation']['Expression']['Column']['Property'] == 'Value'


@pytest.mark.parametrize('value', [True, False, '', '1,000', '1_000', 'NaN', 'Infinity',
                                  float('nan'), float('inf'), '1e9999', [], {}])
def test_invalid_numbers_raise_context(value):
    """Unknown null is distinct from malformed or nonfinite monetary/count values."""
    with pytest.raises(pull.SqlMotionsPullError, match='expiration_amount'):
        pull.normalise_rows([renewal(expiration_amount=value)], 'renewals', {1001})


@pytest.mark.parametrize('value', [True, '', 'tomorrow', 10**30, 'NaN', 'Infinity', []])
def test_invalid_dates_raise_context(value):
    """Bad dates fail rather than silently becoming a missing renewal."""
    with pytest.raises(pull.SqlMotionsPullError, match='expiration_date'):
        pull.normalise_rows([renewal(expiration_date=value)], 'renewals', {1001})


@pytest.mark.parametrize('amount', [None, 0, '0', '-1.25'])
def test_date_rows_survive_null_zero_and_negative_amounts(amount):
    """Renewal eligibility is source date presence, not positive amount."""
    row = pull.normalise_rows([renewal(expiration_amount=amount)], 'renewals', {1001})[0]
    assert isinstance(row['expiration_date'], date)
    assert row['expiration_amount'] == (None if amount is None else float(amount))
    assert row['monthly_opportunity'] is None


def test_arc_utc_timestamp_and_categories_remain_separate():
    """All Discovered is not added to Enterprise or other overlapping categories."""
    rows = pull.normalise_rows([
        arc(), arc(discovery_type='Enterprise', discovered_count='100'),
        arc(discovery_type='NA', discovered_count=None),
    ], 'arc_versions', {1001})
    assert rows[0]['processed_at'].tzinfo == timezone.utc
    assert [row['discovered_count'] for row in rows] == [295, 100, None]


def test_pull_chunks_both_models_and_keeps_latest_quality_without_unrelated_failure():
    """Each report uses its own configured client and metadata is honest about other failures."""
    migration = Mock(model_id=pull.MIGRATION_MODEL_ID)
    ads = Mock(model_id=pull.ADS_MODEL_ID)
    migration.query.side_effect = [[renewal(1001)], [renewal(1002)], []]
    ads.query.side_effect = [
        [arc(1001)], [arc(1002)], [
            quality(last_refresh=STAMP - 86400000, result='Fail'), quality(),
            quality(table_name='RptConsumptionOpportunity', result='Row variance failure'),
        ],
    ]
    payload = pull.pull_sql_motions(
        [1002, 1001], chunk=1, migration_client=migration, ads_client=ads,
    )
    assert len(payload['renewals']) == len(payload['arc_versions']) == 2
    assert migration.query.call_count == ads.query.call_count == 3
    assert all(call.args[1] == pull.MIGRATION_REPORT_ID for call in migration.query.call_args_list)
    assert all(call.args[1] == pull.ADS_REPORT_ID for call in ads.query.call_args_list)
    sources = payload['metadata']['sources']
    assert len(sources['ads_accelerate']['quality_latest']) == 2
    assert any('Row variance failure' in notice for notice in payload['metadata']['notices'])
    migration.close.assert_not_called()
    ads.close.assert_not_called()


@pytest.mark.parametrize('rows', [[], [quality(result='Fail')], [
    quality(), quality(last_refresh=STAMP + 86400000, result='Fail'),
]])
def test_required_arc_quality_failure_aborts(rows):
    """Missing, failed or newer failed ARC quality cannot be labeled a successful import."""
    with pytest.raises(pull.SqlMotionsPullError, match='quality is not Pass'):
        pull._latest_quality(rows)


def test_reused_client_paginates_each_sql_query(monkeypatch):
    """The existing client follows restart tokens rather than using a row cap."""
    client = FabricQueryClient(dataset_id=pull.ADS_DATASET_ID, model_id=pull.ADS_MODEL_ID)
    page = Mock(side_effect=[([arc()], ['next']), ([arc(subscription_id='sub2')], None)])
    monkeypatch.setattr(client, '_page', page)
    try:
        rows = client.query(pull.build_arc_query([1001]), pull.ADS_REPORT_ID)
    finally:
        client.close()
    assert len(rows) == 2
    assert page.call_args_list[1].args[-1] == ['next']


def test_repeated_pagination_cursor_raises(monkeypatch):
    """A truncated/repeated cursor cannot become a complete SQL source."""
    client = FabricQueryClient(dataset_id=pull.ADS_DATASET_ID, model_id=pull.ADS_MODEL_ID)
    monkeypatch.setattr(client, '_page', Mock(return_value=([arc()], ['same'])))
    try:
        with pytest.raises(FabricPullError, match='repeated'):
            client.query(pull.build_arc_query([1001]), pull.ADS_REPORT_ID)
    finally:
        client.close()


def test_latest_processed_snapshot_per_grain_is_not_summed():
    """Historical processed dates do not inflate SQL 2016 discovery."""
    payload = {
        'metadata': metadata([1001]), 'renewals': [], 'arc_versions': [
            arc(processed_at=STAMP - 86400000, discovered_count=900),
            arc(discovered_count=295), arc(discovery_type='Enterprise', discovered_count=100),
        ],
    }
    rows = pull.validate_payload(payload, {1001})['arc_versions']
    assert [row['discovered_count'] for row in rows] == [295, 100]


def test_conflicting_same_timestamp_grain_rejected():
    """A duplicate grain with inconsistent source values must not silently select a winner."""
    payload = {'metadata': metadata([1001]), 'renewals': [],
               'arc_versions': [arc(), arc(discovered_count=111)]}
    with pytest.raises(pull.SqlMotionsPullError, match='ambiguous duplicate'):
        pull.validate_payload(payload, {1001})


def test_unknown_tpid_and_wrong_chunk_are_rejected():
    """Every scoped query is validated against its own batch, not just the global scope."""
    with pytest.raises(pull.SqlMotionsPullError, match='outside'):
        pull.normalise_rows([arc(9999)], 'arc_versions', {1001})


def test_owned_clients_are_configured_and_closed_on_second_source_failure(monkeypatch):
    """Both model clients use existing authentication and close even on a failed pull."""
    migration = Mock(model_id=pull.MIGRATION_MODEL_ID)
    ads = Mock(model_id=pull.ADS_MODEL_ID)
    migration.query.return_value = [renewal()]
    ads.query.side_effect = FabricPullError('ADS failed')
    factory = Mock(side_effect=[migration, ads])
    monkeypatch.setattr(pull, 'FabricQueryClient', factory)
    with pytest.raises(FabricPullError, match='ADS failed'):
        pull.pull_sql_motions([1001])
    assert [call.kwargs for call in factory.call_args_list] == [
        {'dataset_id': pull.MIGRATION_DATASET_ID, 'model_id': pull.MIGRATION_MODEL_ID},
        {'dataset_id': pull.ADS_DATASET_ID, 'model_id': pull.ADS_MODEL_ID},
    ]
    migration.close.assert_called_once()
    ads.close.assert_called_once()
