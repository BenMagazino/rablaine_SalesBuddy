"""Recent source-product revenue with comparable Fabric context for discovery."""
from datetime import date
from math import fsum

from sqlalchemy.orm import joinedload

from app.models import Customer, ProductRevenueData, RevenueAnalysis, db


PRODUCT_FAMILIES = (
    ('synapse', 'Synapse', 'Azure Synapse Analytics'),
    ('aas', 'AAS', 'Azure Analysis Services'),
    ('adx', 'ADX', 'Azure Data Explorer'),
    ('databricks', 'Databricks', 'Azure Databricks'),
    ('fabric', 'Fabric', 'Fabric Capacity'),
)
MIN_SOURCE_REVENUE = 50
MIN_SOURCE_REVENUE_WITH_FABRIC = 100
REVENUE_WINDOW_MONTHS = 3


def _product_family(product: str) -> str | None:
    """Match complete source family names without including unrelated SQL products."""
    for key, _, prefix in PRODUCT_FAMILIES:
        if product == prefix or product.startswith(prefix + ' '):
            return key
    return None


def get_fabric_modernization_report(reference: date | None = None) -> dict:
    """Keep three-month eligibility totals and expose covered monthly averages for display.

    Linked rows roll up by customer ID across names and buckets. Unlinked imports
    remain separate by source name rather than guessing a customer match.
    """
    reference = reference or date.today()
    end = reference.replace(day=1)
    month_index = end.year * 12 + end.month - 1
    months = [
        date(index // 12, index % 12 + 1, 1)
        for index in range(month_index - REVENUE_WINDOW_MONTHS, month_index)
    ]
    records = db.session.query(
        ProductRevenueData.customer_id, ProductRevenueData.customer_name,
        ProductRevenueData.product, db.func.sum(ProductRevenueData.revenue).label('revenue'),
    ).filter(
        ProductRevenueData.month_date >= months[0], ProductRevenueData.month_date < end,
    ).group_by(
        ProductRevenueData.customer_id, ProductRevenueData.customer_name, ProductRevenueData.product,
    ).all()
    coverage = db.session.query(
        ProductRevenueData.customer_id, ProductRevenueData.customer_name,
        ProductRevenueData.month_date,
    ).filter(
        ProductRevenueData.month_date.in_(months),
    ).distinct().all()
    observed: dict[tuple, set[date]] = {}
    for record in coverage:
        key = ('id', record.customer_id) if record.customer_id else ('name', record.customer_name)
        observed.setdefault(key, set()).add(record.month_date)
    amounts: dict[tuple, dict[str, list[float]]] = {}
    names = {}
    for record in records:
        family = _product_family(record.product)
        if family is None:
            continue
        key = ('id', record.customer_id) if record.customer_id else ('name', record.customer_name)
        names[key] = record.customer_name
        amounts.setdefault(key, {name: [] for name, _, _ in PRODUCT_FAMILIES})[family].append(
            record.revenue,
        )
    customers = {
        customer.id: customer for customer in Customer.query.options(joinedload(Customer.seller))
        .filter(Customer.id.in_([key[1] for key in amounts if key[0] == 'id'])).all()
    }
    unlinked_names = [key[1] for key in amounts if key[0] == 'name']
    source_ownership = db.session.query(
        RevenueAnalysis.customer_name, db.func.min(RevenueAnalysis.seller_name),
        db.func.count(db.func.distinct(RevenueAnalysis.seller_name)),
    ).filter(RevenueAnalysis.customer_name.in_(unlinked_names)).group_by(
        RevenueAnalysis.customer_name,
    ).all()
    source_sellers = {name: seller if count == 1 else None
                      for name, seller, count in source_ownership}
    rows = []
    for key, families in amounts.items():
        spend = {family: fsum(values) for family, values in families.items()}
        source_revenue = fsum(spend[family] for family in spend if family != 'fabric')
        minimum = MIN_SOURCE_REVENUE_WITH_FABRIC if spend['fabric'] > 0 else MIN_SOURCE_REVENUE
        if source_revenue < minimum:
            continue
        customer = customers.get(key[1]) if key[0] == 'id' else None
        seller = customer.seller if customer else None
        coverage_complete = len(observed.get(key, set())) == REVENUE_WINDOW_MONTHS
        rows.append({
            'customer_id': customer.id if customer else None,
            'customer_name': customer.get_display_name() if customer else names[key],
            'tpid_url': customer.tpid_url if customer else None,
            'seller': {'id': seller.id, 'name': seller.name} if seller else None,
            'seller_name': seller.name if seller else
                source_sellers.get(names[key]) if customer is None else None,
            'spend': spend,
            'source_revenue': source_revenue,
            'monthly_spend': {
                family: amount / REVENUE_WINDOW_MONTHS if coverage_complete else None
                for family, amount in spend.items()
            },
            'monthly_source_revenue': (
                source_revenue / REVENUE_WINDOW_MONTHS if coverage_complete else None
            ),
            'months_observed': len(observed.get(key, set())),
            'coverage_complete': coverage_complete,
            'row_key': f'{key[0]}-{key[1]}',
        })
    rows.sort(key=lambda row: (-row['source_revenue'], row['customer_name'].casefold(), row['row_key']))
    groups = {}
    for row in rows:
        seller_key = (
            ('id', row['seller']['id']) if row['seller'] else ('name', row['seller_name'] or '')
        )
        if seller_key not in groups:
            groups[seller_key] = {
                'seller': row['seller'], 'name': row['seller_name'], 'rows': [],
                'key': f'{seller_key[0]}-{seller_key[1]}',
            }
        groups[seller_key]['rows'].append(row)
    return {
        'rows': rows,
        'seller_groups': sorted(groups.values(), key=lambda group: (
            not bool(group['name']), (group['name'] or '').casefold(), group['key'],
        )),
        'months': [month.isoformat() for month in months],
        'period_start': months[0].isoformat(), 'period_end': months[-1].isoformat(),
        'period_label': f'{months[0]:%b %Y} through {months[-1]:%b %Y}',
        'products': [{'key': key, 'label': label, 'source': source}
                     for key, label, source in PRODUCT_FAMILIES],
        'totals': {family: fsum(row['spend'][family] for row in rows)
                   for family, _, _ in PRODUCT_FAMILIES},
        'partial_customer_count': sum(not row['coverage_complete'] for row in rows),
        'has_revenue_data': bool(db.session.query(ProductRevenueData.id).first()),
        'url': '/reports/fabric-modernization',
    }


def get_fabric_modernization_widget(
    reference: date | None = None, *, customer_ids: tuple[int, ...] | None = None,
) -> dict:
    """Reuse report eligibility, then select customers with Other Analytics above Fabric."""
    report = get_fabric_modernization_report(reference)
    scope = set(customer_ids) if customer_ids is not None else None
    rows = [
        {**row, 'destination': f"/customer/{row['customer_id']}/revenue"
         if row['customer_id'] is not None else None}
        for row in report['rows']
        if (scope is None or row['customer_id'] in scope)
        and row['source_revenue'] > row['spend']['fabric']
    ]
    by_key = {row['row_key']: row for row in rows}
    groups = []
    for group in report['seller_groups']:
        members = [by_key[row['row_key']] for row in group['rows'] if row['row_key'] in by_key]
        if members:
            groups.append({**group, 'rows': members})
    total_revenue = fsum(row['source_revenue'] for row in rows)
    partial_count = sum(not row['coverage_complete'] for row in rows)
    return {
        'count': len(rows),
        'other_analytics_revenue': total_revenue,
        'monthly_other_analytics_revenue': (
            total_revenue / REVENUE_WINDOW_MONTHS if not partial_count else None
        ),
        'details': {'rows': rows, 'seller_groups': groups},
        'period_label': report['period_label'],
        'has_revenue_data': report['has_revenue_data'],
        'partial_customer_count': partial_count,
        'destination': report['url'],
    }
