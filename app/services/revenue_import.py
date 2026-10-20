"""
Revenue Query Service
=====================
Read helpers over the imported revenue tables - history, product rollups, and
per-seller views. Revenue now lands via ``revenue_sync`` (a headless MSXI pull
keyed on TPID), so nothing here parses files or guesses customers by name.

Fiscal Month Format: "FY26-Jan" where FY26 = July 2025 - June 2026
"""
from __future__ import annotations

import re
from datetime import date
from typing import Optional, TypedDict

from app.models import (
    db, RevenueImport, CustomerRevenueData, ProductRevenueData,
)


# Product consolidation rules - products starting with these prefixes get rolled up
PRODUCT_CONSOLIDATION_PREFIXES = [
    'Azure Synapse Analytics',
]


def consolidate_product_name(product: str) -> str:
    """Get the consolidated product name for display purposes.
    
    Products starting with certain prefixes (like 'Azure Synapse Analytics')
    get consolidated into a single display name.
    
    Args:
        product: Original product name
        
    Returns:
        Consolidated product name (or original if no consolidation applies)
    """
    for prefix in PRODUCT_CONSOLIDATION_PREFIXES:
        if product.startswith(prefix):
            return prefix
    return product


def consolidate_products_list(products: list[dict]) -> list[dict]:
    """Consolidate a list of product dicts by rolling up matching prefixes.
    
    Products starting with consolidation prefixes get merged into a single entry
    with summed revenues and customer counts.
    
    Args:
        products: List of dicts with 'product', 'customer_count', 'total_revenue'
        
    Returns:
        Consolidated list with rolled-up products
    """
    consolidated = {}
    
    for p in products:
        display_name = consolidate_product_name(p['product'])
        
        if display_name not in consolidated:
            consolidated[display_name] = {
                'product': display_name,
                'customer_count': 0,
                'total_revenue': 0,
                '_original_products': []
            }
        
        # For customer count, we need to be careful not to double-count
        # if multiple sub-products have the same customer
        consolidated[display_name]['total_revenue'] += p.get('total_revenue', 0)
        consolidated[display_name]['_original_products'].append(p['product'])
        # Sum customer counts across sub-products. May slightly overcount for
        # consolidated products if the same customer+bucket appears in multiple
        # sub-products, but consistency with the detail page matters more.
        consolidated[display_name]['customer_count'] += p.get('customer_count', 0)
    
    return list(consolidated.values())


class ProductComparison(TypedDict):
    """Shared product members and customer/bucket rollup, without monthly history."""

    customers: list[dict]
    matching_products: list[str]
    is_consolidated: bool


def get_product_comparison(product: str, seller_name: str | None = None) -> ProductComparison:
    """Roll up product members using the existing global or seller-scoped query semantics."""
    is_consolidated = product in PRODUCT_CONSOLIDATION_PREFIXES
    matching_products = (
        [p['product'] for p in (
            get_seller_products(seller_name) if seller_name is not None else get_all_products()
        ) if p['product'].startswith(product)]
        if is_consolidated else [product]
    )
    customers_dict: dict[tuple[str, str], dict] = {}
    for member in matching_products:
        member_customers = (
            get_seller_customers_using_product(seller_name, member)
            if seller_name is not None else get_customers_using_product(member)
        )
        for customer in member_customers:
            key = (customer['customer_name'], customer['bucket'])
            if key not in customers_dict:
                customers_dict[key] = {
                    'customer_name': customer['customer_name'],
                    'bucket': customer['bucket'],
                    'customer_id': customer.get('customer_id'),
                    'total_revenue': 0,
                    'latest_month': customer.get('latest_month'),
                }
            customers_dict[key]['total_revenue'] += customer['total_revenue']
    return {
        'customers': sorted(
            customers_dict.values(), key=lambda customer: customer['total_revenue'], reverse=True,
        ),
        'matching_products': matching_products,
        'is_consolidated': is_consolidated,
    }


def fiscal_month_to_date(fiscal_month: str) -> Optional[date]:
    """Convert fiscal month string to date (first of that month).
    
    Microsoft FY runs July-June:
    - FY26-Jul = July 2025 (FY26 starts July 2025)
    - FY26-Jan = January 2026
    - FY26-Jun = June 2026 (last month of FY26)
    
    Args:
        fiscal_month: String like "FY26-Jan"
        
    Returns:
        date object for first of that month, or None if invalid
    """
    match = re.match(r'FY(\d{2})-(\w{3})', fiscal_month)
    if not match:
        return None
    
    fy_num = int(match.group(1))
    month_abbr = match.group(2)
    
    # Map month abbreviation to number
    month_map = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    
    month_num = month_map.get(month_abbr)
    if not month_num:
        return None
    
    # Calculate calendar year
    # FY26 = July 2025 - June 2026
    # Jul-Dec are in year (FY - 1), Jan-Jun are in year FY
    base_year = 2000 + fy_num  # FY26 -> 2026
    
    if month_num >= 7:  # Jul-Dec
        calendar_year = base_year - 1
    else:  # Jan-Jun
        calendar_year = base_year
    
    return date(calendar_year, month_num, 1)


def get_import_history(limit: int = 20) -> list[RevenueImport]:
    """Get recent import history.
    
    Args:
        limit: Max number of imports to return
        
    Returns:
        List of RevenueImport records, most recent first
    """
    return RevenueImport.query.order_by(
        RevenueImport.imported_at.desc()
    ).limit(limit).all()


def get_months_in_database() -> list[dict]:
    """Get all unique months in the database with record counts.
    
    Returns:
        List of dicts with month_date, fiscal_month, record_count
    """
    results = db.session.query(
        CustomerRevenueData.month_date,
        CustomerRevenueData.fiscal_month,
        db.func.count(CustomerRevenueData.id).label('record_count')
    ).group_by(
        CustomerRevenueData.month_date
    ).order_by(
        CustomerRevenueData.month_date.desc()
    ).all()
    
    return [
        {
            'month_date': r.month_date,
            'fiscal_month': r.fiscal_month,
            'record_count': r.record_count
        }
        for r in results
    ]


def get_customer_revenue_history(
    customer_name: Optional[str] = None,
    bucket: Optional[str] = None,
    *,
    customer_id: Optional[int] = None
) -> list[CustomerRevenueData]:
    """Get revenue history for a specific customer.
    
    Args:
        customer_name: Customer name to look up (from CSV)
        bucket: Optional bucket filter (e.g., your imported service groupings)
        customer_id: Sales Buddy customer ID (preferred over customer_name)
        
    Returns:
        List of CustomerRevenueData records ordered by month
    """
    if customer_id:
        query = CustomerRevenueData.query.filter_by(customer_id=customer_id)
    elif customer_name:
        query = CustomerRevenueData.query.filter_by(customer_name=customer_name)
    else:
        return []
    
    if bucket:
        query = query.filter_by(bucket=bucket)
    
    return query.order_by(CustomerRevenueData.month_date).all()


def get_product_revenue_history(
    customer_name: Optional[str] = None,
    bucket: Optional[str] = None,
    product: Optional[str] = None,
    *,
    customer_id: Optional[int] = None
) -> list[ProductRevenueData]:
    """Get product-level revenue history for a customer/bucket.
    
    Args:
        customer_name: Customer name to look up (from CSV)
        bucket: Bucket name (e.g., your imported service groupings)
        product: Optional specific product filter
        customer_id: Sales Buddy customer ID (preferred over customer_name)
        
    Returns:
        List of ProductRevenueData records ordered by product then month
    """
    if customer_id:
        query = ProductRevenueData.query.filter_by(customer_id=customer_id)
    elif customer_name:
        query = ProductRevenueData.query.filter_by(customer_name=customer_name)
    else:
        return []
    
    if bucket:
        query = query.filter_by(bucket=bucket)
    
    if product:
        query = query.filter_by(product=product)
    
    return query.order_by(
        ProductRevenueData.product,
        ProductRevenueData.month_date
    ).all()


def get_products_for_bucket(
    customer_name: Optional[str] = None,
    bucket: Optional[str] = None,
    *,
    customer_id: Optional[int] = None
) -> list[dict]:
    """Get all products used by a customer in a specific bucket with totals.
    
    Args:
        customer_name: Customer name (from CSV)
        bucket: Bucket name
        customer_id: Sales Buddy customer ID (preferred over customer_name)
        
    Returns:
        List of dicts with product name and total revenue
    """
    filters = []
    if customer_id:
        filters.append(ProductRevenueData.customer_id == customer_id)
    elif customer_name:
        filters.append(ProductRevenueData.customer_name == customer_name)
    else:
        return []
    
    if bucket:
        filters.append(ProductRevenueData.bucket == bucket)
    
    results = db.session.query(
        ProductRevenueData.product,
        db.func.sum(ProductRevenueData.revenue).label('total_revenue'),
        db.func.count(ProductRevenueData.id).label('month_count')
    ).filter(
        *filters
    ).group_by(
        ProductRevenueData.product
    ).order_by(
        db.func.sum(ProductRevenueData.revenue).desc()
    ).all()
    
    return [
        {
            'product': r.product,
            'total_revenue': r.total_revenue or 0,
            'month_count': r.month_count
        }
        for r in results
    ]


def get_all_products() -> list[dict]:
    """Get all unique products in the database with usage stats.
    
    Only counts customer+bucket pairs with positive total revenue,
    matching the detail page filter.
    
    Returns:
        List of dicts with product name, customer count, total revenue
    """
    # Subquery: customer+bucket pairs with positive revenue per product
    positive_pairs = db.session.query(
        ProductRevenueData.product,
        db.func.sum(ProductRevenueData.revenue).label('pair_revenue')
    ).group_by(
        ProductRevenueData.product,
        ProductRevenueData.customer_name,
        ProductRevenueData.bucket
    ).having(
        db.func.sum(ProductRevenueData.revenue) > 0
    ).subquery()
    
    results = db.session.query(
        positive_pairs.c.product,
        db.func.count().label('customer_count'),
        db.func.sum(positive_pairs.c.pair_revenue).label('total_revenue')
    ).group_by(
        positive_pairs.c.product
    ).order_by(
        db.func.sum(positive_pairs.c.pair_revenue).desc()
    ).all()
    
    return [
        {
            'product': r.product,
            'customer_count': r.customer_count,
            'total_revenue': r.total_revenue or 0
        }
        for r in results
    ]


def get_customers_using_product(product: str) -> list[dict]:
    """Get all customers using a specific product with their revenue history.
    
    Args:
        product: Product name to look up
        
    Returns:
        List of dicts with customer info and revenue data
    """
    results = db.session.query(
        ProductRevenueData.customer_name,
        ProductRevenueData.bucket,
        db.func.max(ProductRevenueData.customer_id).label('customer_id'),
        db.func.sum(ProductRevenueData.revenue).label('total_revenue'),
        db.func.max(ProductRevenueData.month_date).label('latest_month')
    ).filter_by(
        product=product
    ).group_by(
        ProductRevenueData.customer_name,
        ProductRevenueData.bucket
    ).having(
        db.func.sum(ProductRevenueData.revenue) > 0
    ).order_by(
        db.func.sum(ProductRevenueData.revenue).desc()
    ).all()
    
    return [
        {
            'customer_name': r.customer_name,
            'bucket': r.bucket,
            'customer_id': r.customer_id,
            'total_revenue': r.total_revenue or 0,
            'latest_month': r.latest_month
        }
        for r in results
    ]


def get_seller_products(seller_name: str) -> list[dict]:
    """Get all unique products used by a seller's customers.
    
    Args:
        seller_name: Seller name to filter by
        
    Returns:
        List of dicts with product name, customer count, total revenue
    """
    # Get customer names for this seller from analyses
    from app.models import RevenueAnalysis
    seller_customers = db.session.query(
        db.distinct(RevenueAnalysis.customer_name)
    ).filter_by(seller_name=seller_name).scalar_subquery()
    
    # Subquery: customer+bucket pairs with positive revenue per product
    positive_pairs = db.session.query(
        ProductRevenueData.product,
        db.func.sum(ProductRevenueData.revenue).label('pair_revenue')
    ).filter(
        ProductRevenueData.customer_name.in_(seller_customers)
    ).group_by(
        ProductRevenueData.product,
        ProductRevenueData.customer_name,
        ProductRevenueData.bucket
    ).having(
        db.func.sum(ProductRevenueData.revenue) > 0
    ).subquery()
    
    results = db.session.query(
        positive_pairs.c.product,
        db.func.count().label('customer_count'),
        db.func.sum(positive_pairs.c.pair_revenue).label('total_revenue')
    ).group_by(
        positive_pairs.c.product
    ).order_by(
        db.func.sum(positive_pairs.c.pair_revenue).desc()
    ).all()
    
    return [
        {
            'product': r.product,
            'customer_count': r.customer_count,
            'total_revenue': r.total_revenue or 0
        }
        for r in results
    ]


def get_seller_customers_using_product(seller_name: str, product: str) -> list[dict]:
    """Get seller's customers using a specific product.
    
    Args:
        seller_name: Seller name to filter by
        product: Product name to look up
        
    Returns:
        List of dicts with customer info and revenue data
    """
    from app.models import RevenueAnalysis
    
    # Get customer names for this seller from analyses
    seller_customers = db.session.query(
        db.distinct(RevenueAnalysis.customer_name)
    ).filter_by(seller_name=seller_name).scalar_subquery()
    
    results = db.session.query(
        ProductRevenueData.customer_name,
        ProductRevenueData.bucket,
        db.func.max(ProductRevenueData.customer_id).label('customer_id'),
        db.func.sum(ProductRevenueData.revenue).label('total_revenue'),
        db.func.max(ProductRevenueData.month_date).label('latest_month')
    ).filter(
        ProductRevenueData.product == product,
        ProductRevenueData.customer_name.in_(seller_customers)
    ).group_by(
        ProductRevenueData.customer_name,
        ProductRevenueData.bucket
    ).order_by(
        db.func.sum(ProductRevenueData.revenue).desc()
    ).all()
    
    return [
        {
            'customer_name': r.customer_name,
            'bucket': r.bucket,
            'customer_id': r.customer_id,
            'total_revenue': r.total_revenue or 0,
            'latest_month': r.latest_month
        }
        for r in results
    ]
