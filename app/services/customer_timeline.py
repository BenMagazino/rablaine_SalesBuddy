"""Read-only, source-dated customer history shared by the dossier and SalesIQ."""

from datetime import datetime, timezone
import re
from typing import Any

from markupsafe import Markup

from app.models import Engagement, Milestone, Note, Opportunity


def _utc(value: datetime, local: bool = False) -> datetime:
    """Interpret note call times locally and naive persisted source dates as UTC."""
    if value.tzinfo is None and not local:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _plain_text(value: str | None) -> str:
    """Keep block boundaries readable when reducing authored HTML to preview text."""
    spaced = re.sub(r'</(?:p|div|h[1-6]|li|tr)>|<br\s*/?>', ' ', value or '', flags=re.I)
    return str(Markup(spaced).striptags()).strip()


def get_customer_timeline(customer_id: int, limit: int = 100, offset: int = 0) -> dict:
    """Merge bounded source prefixes into a stable, newest-first page of events.

    Missing source dates are omitted rather than replaced with import timestamps.
    Each source supplies enough candidates for the merged page, without loading
    relationships or the customer's entire history.
    """
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError('Timeline limit must be between 1 and 100.')
    if type(offset) is not int or not 0 <= offset <= 100000:
        raise ValueError('Timeline offset must be between 0 and 100000.')
    events: list[dict[str, Any]] = []
    sources = [
        (Note, Note.call_date, Note.content, Note.content, 'note', 'Call note', None),
        (Engagement, Engagement.created_at, Engagement.title,
         Engagement.technical_problem, 'engagement', 'Engagement created', None),
        (Opportunity, Opportunity.msx_created_on, Opportunity.name,
         Opportunity.description, 'opportunity', 'Opportunity created', None),
        (Opportunity, Opportunity.msx_closed_on, Opportunity.name,
         Opportunity.state, 'opportunity', 'Opportunity closed',
         Opportunity.statecode.in_([1, 2])),
        (Milestone, Milestone.msx_created_on, Milestone.title,
         Milestone.msx_status, 'milestone', 'Milestone created', Milestone.on_my_team.is_(True)),
        (Milestone, Milestone.committed_at, Milestone.title,
         Milestone.msx_status, 'committed', 'Milestone committed', Milestone.on_my_team.is_(True)),
        (Milestone, Milestone.completed_at, Milestone.title,
         Milestone.msx_status, 'completed', 'Milestone completed', Milestone.on_my_team.is_(True)),
    ]
    for model, timestamp, title, summary, kind, label, extra in sources:
        query = model.query.with_entities(model.id, timestamp, title, summary).filter(
            model.customer_id == customer_id, timestamp.isnot(None),
        )
        if extra is not None:
            query = query.filter(extra)
        rows = query.order_by(timestamp.desc(), model.id.desc()).limit(offset + limit + 1).all()
        for record_id, at, name, detail in rows:
            plain = _plain_text(name)
            entity = 'milestone' if kind in ('committed', 'completed') else kind
            events.append({
                'key': f'{kind}:{record_id}:{label}',
                'kind': kind, 'label': label, 'record_id': record_id,
                'at': _utc(at, local=model is Note).isoformat(),
                'title': plain[:100] or label,
                'summary': _plain_text(detail)[:400],
                'href': f'/{entity}/{record_id}',
            })
    events.sort(key=lambda event: (
        event['at'], event['kind'], event['record_id'], event['label'],
    ), reverse=True)
    return {
        'events': events[offset:offset + limit],
        'next_offset': offset + limit if len(events) > offset + limit else None,
        'undated_opportunities': Opportunity.query.filter(
            Opportunity.customer_id == customer_id, Opportunity.msx_created_on.is_(None),
        ).count(),
    }
