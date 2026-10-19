"""Shared, explicit Customer/Seller scope for reusable dashboards."""
from typing import Any
from urllib.parse import urlencode

from app.models import Customer, Seller, db

FILTER_LABELS = {'customer_ids': 'Customer', 'seller_ids': 'Seller'}
MAX_FILTER_ID = 2 ** 53 - 1


def normalize_filters(value: object = None) -> dict[str, list[int]]:
    """Validate selections; an empty selection is unrestricted, not an empty result."""
    if value is None:
        value = {}
    if not isinstance(value, dict) or set(value) - FILTER_LABELS.keys():
        raise ValueError('Choose supported Customer or Seller filters.')
    result = {}
    for key, label in FILTER_LABELS.items():
        selected = value.get(key, [])
        if (not isinstance(selected, list) or len(selected) > 1000
                or any(type(item) is not int or not 0 < item <= MAX_FILTER_ID for item in selected)):
            raise ValueError(f'Choose valid {label.lower()} selections.')
        result[key] = sorted(set(selected))
    return result


def normalize_filter_config(value: object = None) -> dict[str, Any]:
    """Keep permanent scope separate from the optional live controls."""
    if value is None:
        value = {}
    if not isinstance(value, dict) or set(value) - {'scope', 'live_filters'}:
        raise ValueError('Provide a valid dashboard filter configuration.')
    if 'scope' in value and not isinstance(value['scope'], dict):
        raise ValueError('Provide valid dashboard scope selections.')
    live = value.get('live_filters', [])
    if not isinstance(live, list) or any(
        not isinstance(key, str) or key not in FILTER_LABELS for key in live
    ):
        raise ValueError('Choose Customer or Seller live filter controls.')
    return {
        'scope': normalize_filters(value.get('scope')),
        'live_filters': [key for key in FILTER_LABELS if key in live],
    }


def resolve_customer_scope(*layers: dict[str, list[int]]) -> tuple[int, ...] | None:
    """Intersect independent layers, with OR inside each selection and AND between them."""
    query = db.select(Customer.id)
    constrained = False
    for layer in layers:
        for key in FILTER_LABELS:
            if layer[key]:
                constrained = True
                column = Customer.id if key == 'customer_ids' else Customer.seller_id
                query = query.where(column.in_(layer[key]))
    return tuple(db.session.scalars(query.order_by(Customer.id))) if constrained else None


def get_filter_choices() -> dict[str, list[dict[str, Any]]]:
    """Read light identities only, without calculating widgets or fetching remote data."""
    return {
        'customer_ids': [
            {'id': row.id, 'name': row.get_display_name(), 'seller_id': row.seller_id}
            for row in Customer.query.order_by(Customer.name, Customer.id).all()
        ],
        'seller_ids': [
            {'id': row.id, 'name': row.name}
            for row in Seller.query.order_by(Seller.name, Seller.id).all()
        ],
    }


def describe_widget_filters(filters: dict[str, list[int]]) -> str:
    """Keep a widget's permanent selections visible without exposing raw IDs as labels."""
    parts = []
    for key, model in (('customer_ids', Customer), ('seller_ids', Seller)):
        if not filters[key]:
            continue
        rows = db.session.scalars(db.select(model).where(model.id.in_(filters[key])))
        names = {
            row.id: row.get_display_name() if key == 'customer_ids' else row.name for row in rows
        }
        parts.append(FILTER_LABELS[key] + ': ' + ', '.join(
            names.get(id, f'Unavailable #{id}') for id in filters[key]
        ))
    return ' · '.join(parts)


def filters_from_query(args: Any) -> dict[str, list[int]]:
    """Reject malformed URL filters instead of quietly dropping their scope."""
    result = {}
    for key in FILTER_LABELS:
        raw = args.getlist(key)
        if any(not item.isascii() or not item.isdecimal() for item in raw):
            raise ValueError('Provide positive customer and seller IDs.')
        result[key] = [int(item) for item in raw]
    return normalize_filters(result)


def report_customer_scope(args: Any) -> tuple[int, ...] | None:
    """Preserve an explicitly empty dashboard result when following a report link."""
    scope = args.get('customer_scope')
    if scope is not None and scope != '1':
        raise ValueError('Provide a valid report customer scope.')
    selected = filters_from_query(args)
    ids = resolve_customer_scope(selected)
    return () if ids is None and scope == '1' else ids


def report_scope_query(customer_ids: tuple[int, ...]) -> str:
    """Encode both selected IDs and an explicit empty-result boundary."""
    return urlencode([('customer_scope', '1'), *[
        ('customer_ids', customer_id) for customer_id in customer_ids
    ]])


def scope_report_destination(
    data: dict[str, Any], key: str, customer_ids: tuple[int, ...] | None,
) -> dict[str, Any]:
    """Carry scope only into reports with end-to-end scoped rendering."""
    if customer_ids is None:
        return data
    supported = key in ('hygiene.gaps', 'fabric.capacity_pressure')
    result = {**data, 'report_follows_scope': supported}
    if supported and result.get('destination'):
        separator = '&' if '?' in result['destination'] else '?'
        result['destination'] += separator + report_scope_query(customer_ids)
    return result
