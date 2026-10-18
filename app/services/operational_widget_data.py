"""JSON-safe identities and dates at operational widget provider boundaries."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.models import Customer


def serialize_widget_value(value: Any) -> Any:
    """Normalize supported local report values without exposing ORM objects."""
    if isinstance(value, Customer):
        return {
            'id': value.id,
            'name': value.name,
            'nickname': value.nickname,
            'seller': (
                {'id': value.seller.id, 'name': value.seller.name}
                if value.seller else None
            ),
        }
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: serialize_widget_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize_widget_value(item) for item in value]
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    raise TypeError(f'Unsupported operational widget value: {type(value).__name__}')
