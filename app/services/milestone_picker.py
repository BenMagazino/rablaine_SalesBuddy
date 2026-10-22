"""Live milestone choices shared by the note picker and durable sync worker."""

import logging

from app.models import Customer, Milestone
from app.services.msx_api import (
    extract_account_id_from_url,
    get_milestones_by_account,
    get_my_milestone_team_ids,
)

logger = logging.getLogger(__name__)


def get_customer_milestone_choices(customer: Customer) -> dict:
    """Fetch all account milestones with local note and team metadata."""
    account_id = extract_account_id_from_url(customer.tpid_url)
    if not account_id:
        return {
            "success": False,
            "error": "Could not extract account ID from customer's MSX URL",
        }
    result = get_milestones_by_account(account_id)
    if not result.get("success"):
        return result

    my_team_ids = set()
    try:
        team_result = get_my_milestone_team_ids()
        if team_result.get("success"):
            my_team_ids = team_result.get("milestone_ids", set())
        else:
            logger.warning("Milestone picker team lookup failed for customer %s: %s",
                           customer.id, team_result.get("error"))
    except Exception:
        logger.exception("Milestone picker team lookup failed for customer %s", customer.id)

    for milestone in result.get("milestones", []):
        msx_id = milestone.get("id")
        if not msx_id:
            continue
        existing = Milestone.query.filter_by(msx_milestone_id=msx_id).first()
        milestone["used_in_notes"] = len(existing.notes) if existing else 0
        milestone["local_milestone_id"] = existing.id if existing else None
        milestone["on_my_team"] = (
            msx_id.lower() in my_team_ids if my_team_ids
            else bool(existing and existing.on_my_team)
        )
    return result
