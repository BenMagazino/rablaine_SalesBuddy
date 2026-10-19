"""Shared date windows and customer ordering for 1:1 preparation."""

from datetime import datetime, timedelta, timezone


def get_activity_cutoffs(
    days: int = 14, reference: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Return UTC timestamp and naive local call-date cutoffs for a rolling window."""
    if type(days) is not int or not 1 <= days <= 90:
        raise ValueError('Choose a reporting window between 1 and 90 days.')
    now = reference or datetime.now(timezone.utc)
    return (
        now.astimezone(timezone.utc) - timedelta(days=days),
        now.astimezone().replace(tzinfo=None) - timedelta(days=days),
    )


def sort_customer_activity(customers: list[dict], order: str = 'recent') -> list[dict]:
    """Order customer groups and their engagements without changing their populations."""
    if order not in {'recent', 'acr', 'seller', 'territory'}:
        raise ValueError('Choose recent activity, estimated ACR, seller, or territory sorting.')
    for group in customers:
        group['estimated_acr'] = sum(eng.estimated_acr or 0 for eng in group['engagements'])
        if order == 'acr':
            group['engagements'].sort(
                key=lambda eng: (-(eng.estimated_acr or 0), eng.title.casefold()),
            )

    def key(group: dict) -> tuple:
        """Use raw values, deterministic customer ties, and missing owners last."""
        customer = group['customer']
        name = customer.name.casefold()
        if order == 'acr':
            return (-group['estimated_acr'], name)
        if order in {'seller', 'territory'}:
            owner = getattr(customer, order)
            return (owner is None, owner.name.casefold() if owner else '', name)
        dates = (
            [note.call_date for note in group['notes'] if note.call_date]
            if 'notes' in group else
            [eng.last_note_date for eng in group['engagements'] if eng.last_note_date]
        )
        latest = max(dates, default=datetime.min)
        return (
            -latest.toordinal(), -latest.hour, -latest.minute,
            -latest.second, -latest.microsecond, name,
        )

    return sorted(customers, key=key)
