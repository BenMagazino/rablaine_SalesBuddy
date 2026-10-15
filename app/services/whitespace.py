"""Source-defined strategic pillar revenue shared by reports, imports and SalesIQ."""

from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import func
from sqlalchemy.sql.selectable import Subquery

from app.models import StrategicPillarRevenueData, db
from app.services.revenue_import import fiscal_month_to_date

STRATEGIC_PILLARS = ('AI', 'Analytics', 'Apps', 'Databases', 'Developer', 'Infra', 'Security')


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
