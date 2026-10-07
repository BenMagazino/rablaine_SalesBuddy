"""
Project routes for Sales Buddy.
Handles internal project CRUD - non-customer work like training, copilot saved tasks, etc.
"""
import logging
from datetime import datetime, timezone

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from app.models import db, Project, ActionItem, Note, notes_projects

logger = logging.getLogger(__name__)

projects_bp = Blueprint('projects', __name__)


def _render_project_form(project: Project | None, status_code: int = 200) -> tuple[str, int]:
    """Render eligible general notes, retaining the submitted form after failures."""
    eligibility = ~Note.projects.any()
    if project:
        eligibility = db.or_(eligibility, Note.projects.any(Project.id == project.id))
    notes = (Note.query.filter(Note.customer_id.is_(None)).filter(eligibility)
             .order_by(Note.call_date.desc()).all())
    return render_template(
        'project_form.html', project=project,
        project_types=Project.BUILT_IN_TYPES, unattached_notes=notes,
    ), status_code


def _save_project_form(project: Project, creating: bool) -> None:
    """Apply the existing manual POST contract and selected-note replacement."""
    project.title = request.form.get('title', '').strip() or project.title
    project.description = request.form.get('description', '').strip() or None
    project_type = request.form.get(
        'project_type', 'general' if creating else project.project_type,
    )
    project.project_type = project_type.strip() if creating else project_type
    if not creating:
        project.status = request.form.get('status', project.status)
    due_date_str = request.form.get('due_date', '').strip()
    if due_date_str:
        try:
            project.due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass
    elif not creating:
        project.due_date = None
    if creating:
        db.session.add(project)
        db.session.flush()
    note_ids = request.form.getlist('note_ids')
    selected_ids = {int(nid) for nid in note_ids}
    current_ids = {note.id for note in project.notes}
    to_add = selected_ids - current_ids
    if to_add:
        project.notes.extend(Note.query.filter(Note.id.in_(to_add)).all())
    project.notes = [note for note in project.notes if note.id in selected_ids]
    db.session.commit()


@projects_bp.route('/project/new', methods=['GET', 'POST'])
def project_create():
    """Create a new internal project."""
    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        if not title:
            flash('Project title is required.', 'danger')
            return _render_project_form(None, 400)
        project = Project(title=title)
        try:
            _save_project_form(project, creating=True)
        except Exception:
            db.session.rollback()
            logger.exception('Could not create project from the manual form')
            flash('Could not create the project. Your entries are still here. Please try again.',
                  'danger')
            return _render_project_form(None, 500)
        flash(f'Project "{title}" created!', 'success')
        return redirect(url_for('projects.project_view', id=project.id))

    return _render_project_form(None)


@projects_bp.route('/project/<int:id>')
def project_view(id):
    """View project details with notes and action items."""
    project = Project.query.get_or_404(id)
    return render_template('project_view.html', project=project)


@projects_bp.route('/api/project/<int:id>/detail')
def project_detail(id: int) -> str:
    """Render the complete project page content for the Initiative Tracker detail modal."""
    project = Project.query.get_or_404(id)
    return render_template(
        'partials/project_view_content.html', project=project,
        parent_modal_id='managerWorkModal',
    )


@projects_bp.route('/project/<int:id>/edit', methods=['GET', 'POST'])
def project_edit(id):
    """Edit an existing project."""
    project = Project.query.get_or_404(id)

    if request.method == 'POST':
        try:
            _save_project_form(project, creating=False)
        except Exception:
            db.session.rollback()
            logger.exception('Could not update project %s from the manual form', id)
            flash('Could not save the project. Your entries are still here. Please try again.',
                  'danger')
            return _render_project_form(project, 500)
        flash('Project updated.', 'success')
        return redirect(url_for('projects.project_view', id=project.id))

    return _render_project_form(project)


@projects_bp.route('/project/<int:id>/delete', methods=['POST'])
def project_delete(id):
    """Delete a project."""
    project = Project.query.get_or_404(id)
    title = project.title
    db.session.delete(project)
    db.session.commit()
    flash(f'Project "{title}" deleted.', 'success')
    return redirect(url_for('engagements.engagements_hub'))


@projects_bp.route('/api/project/<int:id>/action-item', methods=['POST'])
def project_add_action_item(id):
    """Add an action item to a project."""
    project = Project.query.get_or_404(id)
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify(success=False, error='Title is required'), 400

    item = ActionItem(
        project_id=project.id,
        title=title,
        description=(data.get('description') or '').strip() or None,
        source='project',
        status='open',
        priority=data.get('priority', 'normal'),
    )
    due_str = (data.get('due_date') or '').strip()
    if due_str:
        try:
            item.due_date = datetime.strptime(due_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    try:
        db.session.add(item)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('Could not add action item to project %s', id)
        return jsonify(success=False, error='Could not add the action item. Please try again.'), 500
    return jsonify(success=True, id=item.id)


@projects_bp.route('/api/project/create-inline', methods=['POST'])
def project_create_inline():
    """Create a project with just a title (inline from note form).

    Accepts JSON with: title, [project_type, description, due_date]
    Returns: {success: true, id: X, title: "...", project_type: "..."}
    """
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify(success=False, error='Title is required'), 400

    project_type = (data.get('project_type') or 'general').strip()
    allowed_types = [t for t in Project.BUILT_IN_TYPES if t != 'copilot_saved']
    if project_type not in allowed_types:
        project_type = 'general'

    project = Project(
        title=title,
        description=(data.get('description') or '').strip() or None,
        project_type=project_type,
    )
    due_str = (data.get('due_date') or '').strip()
    if due_str:
        try:
            project.due_date = datetime.strptime(due_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    db.session.add(project)
    db.session.commit()

    return jsonify(
        success=True,
        id=project.id,
        title=project.title,
        project_type=project.project_type,
    )


@projects_bp.route('/api/project/<int:id>', methods=['GET'])
def project_get_json(id: int):
    """Return project details as JSON (for inline flyout editing)."""
    project = Project.query.get_or_404(id)
    return jsonify(
        id=project.id,
        title=project.title,
        description=project.description or '',
        project_type=project.project_type,
        status=project.status,
        due_date=project.due_date.strftime('%Y-%m-%d') if project.due_date else '',
    )


@projects_bp.route('/api/project/<int:id>', methods=['PUT'])
def project_update_json(id: int):
    """Update a project from the inline flyout."""
    project = Project.query.get_or_404(id)
    data = request.get_json(silent=True) or {}

    title = (data.get('title') or '').strip()
    if not title:
        return jsonify(success=False, error='Title is required'), 400

    project.title = title
    project.description = (data.get('description') or '').strip() or None

    project_type = (data.get('project_type') or project.project_type).strip()
    allowed_types = [t for t in Project.BUILT_IN_TYPES if t != 'copilot_saved']
    if project_type in allowed_types:
        project.project_type = project_type

    status = (data.get('status') or '').strip()
    if status in Project.STATUSES:
        project.status = status

    due_str = (data.get('due_date') or '').strip()
    if due_str:
        try:
            project.due_date = datetime.strptime(due_str, '%Y-%m-%d').date()
        except ValueError:
            pass
    else:
        project.due_date = None

    db.session.commit()
    return jsonify(
        success=True,
        id=project.id,
        title=project.title,
        project_type=project.project_type,
        status=project.status,
    )
