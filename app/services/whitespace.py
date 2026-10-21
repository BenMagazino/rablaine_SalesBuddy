"""Source-defined strategic pillar revenue shared by reports, imports and SalesIQ."""

from collections import defaultdict
from datetime import date, timedelta
from math import fsum
from typing import Any

from sqlalchemy import func
from sqlalchemy.sql.selectable import Subquery

from app.models import Customer, StrategicPillarRevenueData, db
from app.services.revenue_import import fiscal_month_to_date
from app.services.se_specialty import has_specialty_access

STRATEGIC_PILLARS = ('AI', 'Analytics', 'Apps', 'Databases', 'Developer', 'Infra', 'Security')
DATABASE_WHITESPACE_ADJACENT_PILLARS = ('AI', 'Analytics', 'Apps')


def has_pillar_data() -> bool:
    """Distinguish an upgraded app awaiting its first pillar import from loaded data."""
    return db.session.query(StrategicPillarRevenueData.id).first() is not None


def monthly_revenue() -> Subquery:
    """Roll products up before testing coverage or averaging monthly pillar revenue."""
    return db.session.query(
        StrategicPillarRevenueData.customer_id.label('customer_id'),
        StrategicPillarRevenueData.pillar.label('bucket'),
        StrategicPillarRevenueData.month_date.label('month_date'),
        func.sum(StrategicPillarRevenueData.revenue).label('revenue'),
    ).group_by(
        StrategicPillarRevenueData.customer_id,
        StrategicPillarRevenueData.pillar,
        StrategicPillarRevenueData.month_date,
    ).subquery()


def get_whitespace_grid(
    selected_buckets: list[str], *, min_revenue: float = 0, show_all: bool = False,
) -> dict:
    """Read the existing grid's latest-data window, averages and coverage rules."""
    result = {'customers': [], 'buckets': selected_buckets}
    if not selected_buckets:
        return result
    monthly = monthly_revenue().c
    latest_month = db.session.query(func.max(monthly.month_date)).scalar()
    if not latest_month:
        return result
    spend = db.session.query(
        monthly.customer_id, monthly.bucket,
        func.avg(monthly.revenue).label('avg_revenue'),
    ).filter(
        monthly.customer_id.isnot(None),
        monthly.bucket.in_(selected_buckets),
        monthly.month_date >= latest_month - timedelta(days=62),
    ).group_by(monthly.customer_id, monthly.bucket).all()
    customer_buckets = {}
    for row in spend:
        buckets = customer_buckets.setdefault(row.customer_id, {})
        if row.avg_revenue and row.avg_revenue > min_revenue:
            buckets[row.bucket] = round(row.avg_revenue, 2)
    target_ids = [
        cid for cid, buckets in customer_buckets.items()
        if buckets and (show_all or len(buckets) < len(selected_buckets))
    ]
    if not target_ids:
        return result
    customers = Customer.query.options(db.joinedload(Customer.seller)).filter(
        Customer.id.in_(target_ids),
    ).order_by(Customer.name).all()
    result['customers'] = [{
        'id': customer.id, 'name': customer.name, 'nickname': customer.nickname,
        'seller': {'id': customer.seller.id, 'name': customer.seller.name}
        if customer.seller else None,
        'buckets': customer_buckets[customer.id],
    } for customer in customers]
    return result


def get_database_whitespace_widget(
    reference: date | None = None, *, customer_ids: tuple[int, ...] | None = None,
) -> dict:
    """Select AI, Analytics or Apps-backed Database gaps using the grid's saved window."""
    result = {
        'available': has_specialty_access('data'), 'has_revenue_data': False,
        'rows': [], 'seller_groups': [], 'count': 0,
        'destination': '/reports/whitespace?view=database-whitespace',
    }
    if not result['available']:
        return result
    result['has_revenue_data'] = has_pillar_data()
    grid = get_whitespace_grid([*DATABASE_WHITESPACE_ADJACENT_PILLARS, 'Databases'], show_all=True)
    scope = set(customer_ids) if customer_ids is not None else None
    for customer in grid['customers']:
        if 'Databases' in customer['buckets'] or (
            scope is not None and customer['id'] not in scope
        ):
            continue
        buckets = customer['buckets']
        name = customer['name']
        if customer['nickname']:
            name += f" ({customer['nickname']})"
        adjacent_spend = {
            pillar: buckets.get(pillar, 0) for pillar in DATABASE_WHITESPACE_ADJACENT_PILLARS
        }
        result['rows'].append({
            'customer_id': customer['id'], 'customer_name': name,
            'row_key': f"customer-{customer['id']}", 'seller': customer['seller'],
            'destination': f"/customer/{customer['id']}/revenue",
            'monthly_spend': {
                **adjacent_spend, 'Total': fsum(adjacent_spend.values()),
            },
        })
    result['rows'].sort(key=lambda row: (
        -row['monthly_spend']['Total'], row['customer_name'].casefold(), row['customer_id'],
    ))
    groups = {}
    for row in result['rows']:
        seller = row['seller']
        key = seller['id'] if seller else None
        groups.setdefault(key, {'seller': seller, 'rows': []})['rows'].append(row)
    result['seller_groups'] = sorted(groups.values(), key=lambda group: (
        group['seller'] is None,
        group['seller']['name'].casefold() if group['seller'] else '',
        group['seller']['id'] if group['seller'] else 0,
    ))
    result['count'] = len(result['rows'])
    return result


def prepare_pillar_rows(rows: list[dict], customer_ids: dict[int, int],
                        import_id: int) -> list[StrategicPillarRevenueData]:
    """Normalize source rows by TPID, never by customer name or inferred bucket mapping."""
    records: dict[tuple[int, str, str, date], StrategicPillarRevenueData] = {}
    for row in rows:
        pillar = str(row.get('pillar') or '').strip()
        month = fiscal_month_to_date(str(row.get('fm') or ''))
        tpid = int(row['tpid'])
        if pillar not in STRATEGIC_PILLARS or month is None or tpid <= 0:
            raise ValueError(f'Invalid strategic pillar revenue row: TPID {tpid}, '
                             f'pillar {pillar!r}, month {row.get("fm")!r}.')
        product = str(row.get('product') or '').strip()
        key = (tpid, pillar, product, month)
        amount = float(row['acr'])
        if key in records:
            records[key].revenue += amount
        else:
            records[key] = StrategicPillarRevenueData(
                tpid=tpid, customer_name=str(row.get('name') or '').strip(),
                customer_id=customer_ids.get(tpid), pillar=pillar, product=product,
                fiscal_month=str(row['fm']), month_date=month, revenue=amount,
                last_import_id=import_id,
            )
    return list(records.values())


def product_details(customer_id: int, pillar: str) -> dict[str, Any]:
    """Build the existing product/history presentation from pillar-specific source data."""
    rows = db.session.query(
        StrategicPillarRevenueData.product, StrategicPillarRevenueData.fiscal_month,
        StrategicPillarRevenueData.month_date,
        func.sum(StrategicPillarRevenueData.revenue).label('revenue'),
    ).filter(
        StrategicPillarRevenueData.customer_id == customer_id,
        StrategicPillarRevenueData.pillar == pillar,
    ).group_by(
        StrategicPillarRevenueData.product, StrategicPillarRevenueData.fiscal_month,
        StrategicPillarRevenueData.month_date,
    ).order_by(StrategicPillarRevenueData.month_date).all()
    history = defaultdict(list)
    months = {}
    for row in rows:
        history[row.product].append(row)
        months[row.fiscal_month] = row.month_date
    summary = [
        {'product': product, 'total_revenue': sum(row.revenue for row in records),
         'month_revenues': {row.fiscal_month: row.revenue for row in records}}
        for product, records in history.items()
    ]
    summary.sort(key=lambda item: item['total_revenue'], reverse=True)
    return {
        'products': summary, 'product_summary': summary, 'product_history': history,
        'recent_months': sorted(months, key=months.get)[-7:],
    }


def pillar_coverage(customer_id: int | None = None, pillar: str | None = None) -> dict:
    """Expose historical pillar coverage using the same monthly totals as the report."""
    monthly = monthly_revenue().c
    query = db.session.query(monthly.bucket).filter(monthly.revenue > 0)
    if customer_id is not None:
        used = {row[0] for row in query.filter(monthly.customer_id == customer_id).distinct()}
        return {'customer_id': customer_id, 'pillars_with_spend': sorted(used),
                'missing_pillars': [value for value in STRATEGIC_PILLARS if value not in used]}
    if pillar not in STRATEGIC_PILLARS:
        return {'error': 'Provide customer_id or a valid strategic pillar.'}
    count = db.session.query(func.count(func.distinct(monthly.customer_id))).filter(
        monthly.bucket == pillar, monthly.revenue > 0,
    ).scalar()
    return {'pillar': pillar, 'customers_with_spend': count}


def pillar_history(customer_id: int, pillar: str | None = None) -> dict:
    """Read monthly source-defined totals for a customer's complete imported history."""
    monthly = monthly_revenue().c
    query = db.session.query(monthly.bucket, monthly.month_date, monthly.revenue).filter(
        monthly.customer_id == customer_id,
    )
    if pillar is not None:
        query = query.filter(monthly.bucket == pillar)
    return {'customer_id': customer_id, 'rows': [
        {'pillar': row.bucket, 'month': row.month_date.isoformat(), 'revenue': row.revenue}
        for row in query.order_by(monthly.month_date, monthly.bucket)
    ]}
