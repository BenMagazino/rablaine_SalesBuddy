"""Read complete, account-scoped SQL motion sources through existing Power BI QES."""
from __future__ import annotations

import math
import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Callable

from app.services import revenue_pull
from app.services.fabric_consumption_pull import FabricQueryClient

MIGRATION_REPORT_ID = '638cab13-868e-4b0b-8c63-45818ba14848'
MIGRATION_DATASET_ID = '6fabe7d5-5892-4900-ae69-a1664e35ab8d'
MIGRATION_MODEL_ID = 6338231
ADS_REPORT_ID = 'c91bff6e-45ab-477b-90dc-5226a19ea1e2'
ADS_DATASET_ID = '4a6b504b-b557-4012-9aa3-d875cb9252b2'
ADS_MODEL_ID = 6391164
ARC_TABLE = 'ARC BY License Type'
ARC_QUALITY_TABLE = 'RptARCByLicenseTypeVersionOneLake'
CHUNK_SIZE = 50
RENEWAL_MEASURES = {
    'expiration_amount': ('e', 'Next Up SQL Expiration $'),
    'install_base_cores': ('f', 'SQL Install Base LCM'),
    'sql_iaas_cores': ('f', 'SQL on IaaS Capped Cores'),
    'monthly_opportunity': ('f', 'Monthly SQL ACR Opportunity'),
}
ARC_COLUMNS = {
    'subscription_id': 'SubscriptionID', 'subscription_name': 'SubscriptionDisplayName',
    'sql_version': 'SQLVersion', 'discovery_type': 'DiscoveryType',
    'processed_at': 'processed_timestamp',
}


class SqlMotionsPullError(ValueError):
    """A required SQL source is incomplete, malformed, or outside its requested scope."""


def normalise_number(value: object, context: str) -> float | None:
    """Accept only finite decimal numbers, preserving a source null as unknown."""
    if value is None:
        return None
    try:
        if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
            raise ValueError('Not a decimal value')
        if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?', str(value)):
            raise ValueError('Invalid decimal syntax')
        number = Decimal(str(value))
        result = float(number)
        if not number.is_finite() or not math.isfinite(result):
            raise ValueError('Non-finite decimal')
        return result
    except (InvalidOperation, ValueError, TypeError, OverflowError) as exc:
        raise SqlMotionsPullError(f'{context}: invalid finite decimal value.') from exc


def normalise_timestamp(value: object, context: str) -> datetime | None:
    """Decode source epoch milliseconds or ISO timestamps to aware UTC."""
    if value is None:
        return None
    try:
        if isinstance(value, datetime):
            return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc)
        if isinstance(value, bool):
            raise ValueError('Boolean timestamp')
        if isinstance(value, (int, float, Decimal)):
            number = normalise_number(value, context)
            return datetime.fromtimestamp(number / 1000, timezone.utc)
        if not isinstance(value, str) or not value.strip():
            raise ValueError('Invalid timestamp')
        try:
            number = Decimal(value)
        except InvalidOperation:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc)
        return datetime.fromtimestamp(float(number) / 1000, timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError) as exc:
        raise SqlMotionsPullError(f'{context}: invalid UTC date or timestamp.') from exc


def _source(alias: str, entity: str) -> dict:
    """Create one semantic model table reference."""
    return {'Name': alias, 'Entity': entity, 'Type': 0}


def build_migration_query(tpids: list[int]) -> dict:
    """Select model measures, without summing raw monthly snapshots or report slicers."""
    return {
        'Version': 2,
        'From': [_source('a', 'dimazuremigrationaccounts'),
                 _source('e', 'RptAzureMigrationExpirationsCustomized'),
                 _source('f', 'fact_migrationannualizedacr')],
        'Select': [
            revenue_pull._col('a', 'TPAccountID', 'tpid'),
            revenue_pull._mea('e', 'Next Up SQL Expiration Date', 'expiration_date'),
            *[revenue_pull._mea(alias, field, name)
              for name, (alias, field) in RENEWAL_MEASURES.items()],
        ],
        'Where': [revenue_pull._in('a', 'TPAccountID', [f'{tpid}L' for tpid in tpids])],
    }


def build_arc_query(tpids: list[int]) -> dict:
    """Preserve every discovery category at the complete subscription-level grain."""
    return {
        'Version': 2, 'From': [_source('a', ARC_TABLE)],
        'Select': [
            revenue_pull._col('a', 'TPID', 'tpid'),
            *[revenue_pull._col('a', field, name) for name, field in ARC_COLUMNS.items()],
            {'Aggregation': {
                'Expression': {'Column': revenue_pull._col('a', 'Value', 'count')['Column']},
                'Function': 0,
            }, 'Name': 'discovered_count'},
        ],
        'Where': [revenue_pull._in('a', 'TPID', [f'{tpid}L' for tpid in tpids])],
    }


def _metadata_query(table: str, fields: dict[str, str]) -> dict:
    """Read source refresh and quality records without importing unrelated pipelines."""
    return {
        'Version': 2, 'From': [_source('m', table)],
        'Select': [revenue_pull._col('m', field, name) for name, field in fields.items()],
    }


def _validate_tpid(value: object, scope: set[int], context: str) -> int:
    """Require a positive integral TPID belonging to the exact requested batch."""
    if isinstance(value, bool) or not str(value).isdigit() or int(value) not in scope:
        raise SqlMotionsPullError(f'{context}: account outside the requested TPID scope.')
    return int(value)


def normalise_rows(rows: object, kind: str, scope: set[int]) -> list[dict]:
    """Validate all result fields before any snapshot can be persisted."""
    if not isinstance(rows, list):
        raise SqlMotionsPullError(f'{kind}: missing complete result set.')
    fields = ({'expiration_date', *RENEWAL_MEASURES} if kind == 'renewals'
              else {*ARC_COLUMNS, 'discovered_count'})
    result = []
    for index, row in enumerate(rows):
        context = f'{kind} row {index + 1}'
        if not isinstance(row, dict) or not {'tpid', *fields} <= row.keys():
            raise SqlMotionsPullError(f'{context}: incomplete source row.')
        parsed = {'tpid': _validate_tpid(row['tpid'], scope, context)}
        for field in fields:
            value = row[field]
            label = f'{context} TPID {parsed["tpid"]} {field}'
            if field in RENEWAL_MEASURES or field == 'discovered_count':
                value = normalise_number(value, label)
            elif field in ('expiration_date', 'processed_at'):
                if field == 'expiration_date' and isinstance(value, date):
                    value = value.date() if isinstance(value, datetime) else value
                else:
                    value = normalise_timestamp(value, label)
                    if value is not None and field == 'expiration_date':
                        value = value.date()
            elif value is not None and not isinstance(value, str):
                raise SqlMotionsPullError(f'{label}: invalid text.')
            parsed[field] = value
        result.append(parsed)
    return result


def _latest_quality(rows: object) -> list[dict]:
    """Keep only latest quality per table, rejecting ambiguous or failed ARC quality."""
    if not isinstance(rows, list):
        raise SqlMotionsPullError('ADS quality metadata is missing.')
    latest = {}
    for row in rows:
        if not isinstance(row, dict) or not {'table_name', 'last_refresh', 'result'} <= row.keys():
            raise SqlMotionsPullError('ADS returned incomplete quality metadata.')
        name = row['table_name']
        if not isinstance(name, str) or not isinstance(row['result'], str):
            raise SqlMotionsPullError('ADS returned invalid quality metadata.')
        refreshed = normalise_timestamp(row['last_refresh'], f'ADS quality {name}')
        if refreshed is None:
            raise SqlMotionsPullError(f'ADS quality {name}: missing refresh timestamp.')
        candidate = {**row, 'last_refresh': refreshed.isoformat()}
        previous = latest.get(name)
        if previous is None or candidate['last_refresh'] > previous['last_refresh']:
            latest[name] = candidate
        elif (candidate['last_refresh'] == previous['last_refresh']
              and candidate['result'].strip().lower() != 'pass'):
            latest[name] = candidate
    required = latest.get(ARC_QUALITY_TABLE)
    if required is None or required['result'].strip().lower() != 'pass':
        raise SqlMotionsPullError('Required ADS ARC discovery source quality is not Pass.')
    return sorted(latest.values(), key=lambda row: row['table_name'])


def validate_payload(payload: dict, tpids: set[int]) -> dict:
    """Revalidate complete two-source payloads at the persistence boundary."""
    metadata = payload.get('metadata') or {}
    sources = metadata.get('sources') or {}
    if (metadata.get('complete') is not True
            or set(metadata.get('requested_tpids', [])) != tpids
            or set(sources) != {'azure_migrations', 'ads_accelerate'}
            or any(source.get('complete') is not True for source in sources.values())):
        raise SqlMotionsPullError('SQL motions did not confirm both complete source scopes.')
    _latest_quality(sources['ads_accelerate'].get('quality_latest'))
    versions = normalise_rows(payload.get('arc_versions'), 'arc_versions', tpids)
    latest = {}
    for row in versions:
        grain = (row['tpid'], row['subscription_id'], row['sql_version'], row['discovery_type'])
        previous = latest.get(grain)
        observed = row['processed_at'] or datetime.min.replace(tzinfo=timezone.utc)
        prior = ((previous['processed_at'] or datetime.min.replace(tzinfo=timezone.utc))
                 if previous else None)
        if previous is None or observed > prior:
            latest[grain] = row
        elif observed == prior and row != previous:
            raise SqlMotionsPullError('ADS returned ambiguous duplicate discovery snapshot grain.')
    return {
        'renewals': normalise_rows(payload.get('renewals'), 'renewals', tpids),
        'arc_versions': list(latest.values()),
        'metadata': metadata,
    }


def pull_sql_motions(
        tpids: list[int], progress_callback: Callable | None = None, *,
        chunk: int = CHUNK_SIZE, migration_client: FabricQueryClient | None = None,
        ads_client: FabricQueryClient | None = None) -> dict:
    """Read and validate both sources entirely, using existing auth and pagination."""
    if (not tpids or any(isinstance(tpid, bool) or not isinstance(tpid, int) or tpid <= 0
                        for tpid in tpids) or isinstance(chunk, bool)
            or not isinstance(chunk, int) or chunk < 1):
        raise SqlMotionsPullError('SQL motions require positive integer TPIDs and chunk size.')
    tpids = sorted(set(tpids))
    migration = migration_client or FabricQueryClient(
        dataset_id=MIGRATION_DATASET_ID, model_id=MIGRATION_MODEL_ID,
    )
    ads = ads_client or FabricQueryClient(dataset_id=ADS_DATASET_ID, model_id=ADS_MODEL_ID)
    payload = {'renewals': [], 'arc_versions': [], 'metadata': {
        'complete': False, 'requested_tpids': tpids, 'sources': {},
        'notices': [
            'Discovery categories overlap; All Discovered and its components are not additive.',
            'Discovered count is the published source Value; its counting unit is unverified.',
            'Discovery does not establish ESU entitlement or coverage.',
            'Discovery retains only the latest processed timestamp per account, subscription, '
            'SQL version and category; historical processed snapshots are not added.',
        ],
    }}
    try:
        batches = [tpids[index:index + chunk] for index in range(0, len(tpids), chunk)]
        for kind, reader, builder, report in (
            ('renewals', migration, build_migration_query, MIGRATION_REPORT_ID),
            ('arc_versions', ads, build_arc_query, ADS_REPORT_ID),
        ):
            for index, batch in enumerate(batches):
                if progress_callback:
                    progress_callback({
                        'phase': kind, 'progress': (45 if kind == 'arc_versions' else 0)
                        + 40 * index / len(batches),
                        'message': f'Reading SQL {kind}, batch {index + 1}/{len(batches)}.',
                    })
                payload[kind].extend(normalise_rows(
                    reader.query(builder(batch), report), kind, set(batch),
                ))
        refresh_rows = migration.query(_metadata_query('iapmigrations_refreshdata', {
            'data': 'Data', 'refresh_date': 'RefreshDate', 'frequency': 'Frequency',
        }), MIGRATION_REPORT_ID)
        for row in refresh_rows:
            if not isinstance(row, dict) or not {'data', 'refresh_date', 'frequency'} <= row.keys():
                raise SqlMotionsPullError('Azure Migrations returned incomplete refresh metadata.')
            refreshed = normalise_timestamp(row['refresh_date'], 'Azure Migrations refresh')
            row['refresh_date'] = refreshed.isoformat() if refreshed else None
        quality = _latest_quality(ads.query(_metadata_query('ads_quality_results', {
            'table_name': 'TableName', 'last_refresh': 'LastRefresh', 'result': 'FinalResult',
        }), ADS_REPORT_ID))
        payload['metadata']['sources'] = {
            'azure_migrations': {
                'dataset_id': MIGRATION_DATASET_ID, 'model_id': migration.model_id,
                'report_id': MIGRATION_REPORT_ID, 'complete': True, 'refresh_rows': refresh_rows,
            },
            'ads_accelerate': {
                'dataset_id': ADS_DATASET_ID, 'model_id': ads.model_id,
                'report_id': ADS_REPORT_ID, 'complete': True, 'quality_latest': quality,
            },
        }
        for row in quality:
            if row['table_name'] != ARC_QUALITY_TABLE and row['result'].strip().lower() != 'pass':
                payload['metadata']['notices'].append(
                    f"Unimported ADS pipeline {row['table_name']} quality: {row['result']}.",
                )
        payload['metadata']['complete'] = True
        return validate_payload(payload, set(tpids))
    finally:
        if migration_client is None:
            migration.close()
        if ads_client is None:
            ads.close()
