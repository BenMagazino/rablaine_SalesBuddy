"""Shared local engagement and milestone hygiene queues."""
from __future__ import annotations

from datetime import date
from typing import Any

from app.models import Customer, Engagement, HygieneNote, Milestone, SyncStatus, db
from app.services.operational_widget_data import serialize_widget_value


def get_hygiene_report_data(seller_id: int | None = None) -> dict[str, Any]:
    """Return the report's active gaps, including off-team milestone gaps.

    An explicit seller scopes the same population as seller mode. Reason notes
    explain a gap but do not resolve it or remove it from the queue.
    """
    from app.services.seller_mode import get_seller_mode_seller_id

    seller_id = seller_id or get_seller_mode_seller_id()
    engagements = (
        Engagement.query.filter(
            Engagement.status == 'Active',
            ~Engagement.milestones.any(),
        )
        .options(db.joinedload(Engagement.customer).joinedload(Customer.seller))
        .order_by(Engagement.estimated_acr.desc(), Engagement.title)
    )
    milestones = (
        Milestone.query.filter(
            Milestone.customer_id.isnot(None),
            Milestone.msx_status.in_(['On Track', 'At Risk', 'Blocked']),
            ~Milestone.engagements.any(),
        )
        .options(db.joinedload(Milestone.customer).joinedload(Customer.seller))
        .order_by(Milestone.monthly_usage.desc(), Milestone.title)
    )
    if seller_id:
        engagements = engagements.join(
            Customer, Engagement.customer_id == Customer.id,
        ).filter(Customer.seller_id == seller_id)
        milestones = milestones.join(
            Customer, Milestone.customer_id == Customer.id,
        ).filter(Customer.seller_id == seller_id)
    engagement_rows = engagements.all()
    engagement_ids = [row.id for row in engagement_rows]
    notes = {}
    if engagement_ids:
        notes = {
            note.entity_id: note.note
            for note in HygieneNote.query.filter(
                HygieneNote.entity_type == 'engagement',
                HygieneNote.entity_id.in_(engagement_ids),
            ).all()
        }
    return {
        'engagements_no_ms': engagement_rows,
        'milestones_no_eng': milestones.all(),
        'eng_notes': notes,
        'seller_id': seller_id,
    }


def get_hygiene_gaps_widget(reference: date | None = None) -> dict[str, Any]:
    """Read complete hygiene queues without syncing or modifying records."""
    report = get_hygiene_report_data()
    engagements = report['engagements_no_ms']
    milestones = report['milestones_no_eng']
    rows = [
        {
            'id': row.id,
            'kind': 'Engagement',
            'title': row.title,
            'customer': row.customer,
            'amount': row.estimated_acr,
            'on_my_team': None,
            'note': report['eng_notes'].get(row.id),
            'destination': f'/engagement/{row.id}',
            'action': 'Link milestones',
        }
        for row in engagements
    ] + [
        {
            'id': row.id,
            'kind': 'Milestone',
            'title': row.display_text,
            'customer': row.customer,
            'amount': row.monthly_usage,
            'on_my_team': row.on_my_team,
            'note': None,
            'destination': f'/milestone/{row.id}',
            'action': 'Link engagement',
        }
        for row in milestones
    ]
    return serialize_widget_value({
        'as_of': reference or date.today(),
        'destination': '/reports/hygiene',
        'engagement_count': len(engagements),
        'milestone_count': len(milestones),
        'on_team_count': sum(bool(row.on_my_team) for row in milestones),
        'annotated_count': len(report['eng_notes']),
        'total': len(rows),
        'rows': rows,
        'seller_id': report['seller_id'],
        'milestone_sync': SyncStatus.get_status('milestones'),
    })
