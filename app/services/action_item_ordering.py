"""Validate and atomically save manual action-item order within one owner."""
import logging

from sqlalchemy.exc import SQLAlchemyError

from app.models import ActionItem, db

logger = logging.getLogger(__name__)


def save_action_item_order(owner: str, owner_id: int, data: object) -> tuple[dict, int]:
    """Save the complete open-task order, rejecting stale or foreign task lists."""
    task_ids = data.get('task_ids') if isinstance(data, dict) else None
    if (not isinstance(task_ids, list)
            or any(type(task_id) is not int or task_id < 1 for task_id in task_ids)
            or len(set(task_ids)) != len(task_ids)):
        return {'success': False, 'error': 'task_ids must contain unique positive integers.'}, 400
    try:
        tasks = ActionItem.query.filter_by(**{f'{owner}_id': owner_id}, status='open').all()
        by_id = {task.id: task for task in tasks}
        if set(task_ids) != set(by_id):
            return {
                'success': False,
                'error': 'Action items have changed. Refresh before reordering.',
            }, 409
        for position, task_id in enumerate(task_ids):
            by_id[task_id].sort_order = position
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception('Could not save %s %s action-item order', owner, owner_id)
        return {'success': False, 'error': 'Could not save action-item order. Please retry.'}, 500
    return {'success': True}, 200
