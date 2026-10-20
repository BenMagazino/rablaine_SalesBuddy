"""Covered Fabric acquisition whitespace shared by the report, widgets and SalesIQ."""

from collections import defaultdict
from datetime import date
from math import fsum

from sqlalchemy.orm import joinedload

from app.models import Customer, StrategicPillarRevenueData, db
from app.services.se_specialty import has_specialty_access

DESTINATION = '/reports/whitespace?view=fabric-acquisition'
WIDGET_MIN_MONTHLY_ACR = 2000
COLUMNS = (
    ('AI', 'AI'),
    ('Databases', 'Databases'),
    ('Analytics', 'Other Analytics'),
)


def get_fabric_acquisition_report(
    reference: date | None = None, *, customer_ids: tuple[int, ...] | None = None,
    minimum_monthly_acr: float | None = None,
) -> dict:
    """Require three covered months and no positive monthly net Fabric ACR.

    Coverage uses all source-defined pillars for each linked customer. Missing
    product rows within a covered month are zero; missing months remain unknown.
    Fabric is split out of Analytics before any aggregation, never subtracted
    from rounded amounts or combined with the separate service-bucket feed.
    The optional footprint minimum is used only by the dashboard widget.
    """
    end = (reference or date.today()).replace(day=1)
    index = end.year * 12 + end.month - 1
    months = [date(i // 12, i % 12 + 1, 1) for i in range(index - 3, index)]
    result = {
        'available': has_specialty_access('data'),
        'rows': [], 'seller_groups': [], 'count': 0, 'unknown_customer_count': 0,
        'columns': [{'key': key, 'label': label} for key, label in COLUMNS],
        'period_label': f'{months[0]:%b %Y} through {months[-1]:%b %Y}',
        'months': [month.isoformat() for month in months],
        'has_revenue_data': False, 'destination': DESTINATION,
    }
    if not result['available']:
        return result
    result['has_revenue_data'] = (
        db.session.query(StrategicPillarRevenueData.id).first() is not None
    )
    query = db.session.query(
        StrategicPillarRevenueData.customer_id, StrategicPillarRevenueData.pillar,
        StrategicPillarRevenueData.product, StrategicPillarRevenueData.month_date,
        db.func.sum(StrategicPillarRevenueData.revenue).label('revenue'),
    ).filter(
        StrategicPillarRevenueData.customer_id.isnot(None),
        StrategicPillarRevenueData.month_date.in_(months),
    )
    if customer_ids is not None:
        query = query.filter(StrategicPillarRevenueData.customer_id.in_(customer_ids))
    records = query.group_by(
        StrategicPillarRevenueData.customer_id, StrategicPillarRevenueData.pillar,
        StrategicPillarRevenueData.product, StrategicPillarRevenueData.month_date,
    ).all()
    coverage = defaultdict(set)
    spend = defaultdict(lambda: defaultdict(list))
    fabric_months = defaultdict(lambda: defaultdict(list))
    for record in records:
        coverage[record.customer_id].add(record.month_date)
        if record.pillar not in ('AI', 'Databases', 'Analytics'):
            continue
        fabric = record.pillar == 'Analytics' and (
            record.product == 'Fabric Capacity' or record.product.startswith('Fabric Capacity ')
        )
        family = 'Fabric' if fabric else record.pillar
        spend[record.customer_id][family].append(record.revenue)
        if fabric:
            fabric_months[record.customer_id][record.month_date].append(record.revenue)
    customers = {
        customer.id: customer for customer in Customer.query.options(
            joinedload(Customer.seller),
        ).filter(Customer.id.in_(spend)).all()
    }
    for customer_id, families in spend.items():
        totals = {
            key: fsum(families[key]) for key in ('AI', 'Databases', 'Analytics', 'Fabric')
        }
        if not any(totals[key] > 0 for key in ('AI', 'Databases', 'Analytics')):
            continue
        if any(fsum(values) > 0 for values in fabric_months[customer_id].values()):
            continue
        if len(coverage[customer_id]) != 3:
            result['unknown_customer_count'] += 1
            continue
        monthly_footprint = fsum(totals[key] for key in ('AI', 'Databases', 'Analytics')) / 3
        if minimum_monthly_acr is not None and monthly_footprint < minimum_monthly_acr:
            continue
        customer = customers[customer_id]
        result['rows'].append({
            'customer_id': customer.id, 'customer_name': customer.name,
            'destination': f'/customer/{customer.id}/revenue',
            'row_key': f'customer-{customer.id}',
            'seller': {'id': customer.seller.id, 'name': customer.seller.name}
            if customer.seller else None,
            'monthly_spend': {key: value / 3 for key, value in totals.items()},
            'revenue': monthly_footprint,
        })
    result['rows'].sort(key=lambda row: (-row['revenue'], row['customer_name'].casefold()))
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


def get_fabric_acquisition_widget(
    reference: date | None = None, *, customer_ids: tuple[int, ...] | None = None,
) -> dict:
    """Restrict widget counts and details to at least $2,000 monthly non-Fabric ACR."""
    return get_fabric_acquisition_report(
        reference, customer_ids=customer_ids, minimum_monthly_acr=WIDGET_MIN_MONTHLY_ACR,
    )
