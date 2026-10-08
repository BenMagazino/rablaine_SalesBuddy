"""
Solution engineer routes for Sales Buddy.
Handles solution engineer listing, viewing, and editing.
"""
import logging

from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from sqlalchemy.exc import SQLAlchemyError

from app.models import db, SolutionEngineer, POD

# Create blueprint
solution_engineers_bp = Blueprint('solution_engineers', __name__)
logger = logging.getLogger(__name__)


def _render_engineer_detail(se: SolutionEngineer):
    """Render the original POD-derived coverage without adding direct assignments."""
    pods = sorted(se.pods, key=lambda pod: pod.name)
    territories = sorted(
        {territory.id: territory for pod in pods for territory in pod.territories}.values(),
        key=lambda territory: territory.name,
    )
    return render_template(
        'solution_engineer_view.html', solution_engineer=se,
        pods=pods, territories=territories,
    )


def _render_engineer_form(se: SolutionEngineer, values: dict | None = None):
    """Render alphabetical POD choices and any retained manual input."""
    return render_template(
        'solution_engineer_form.html', solution_engineer=se,
        all_pods=POD.query.order_by(POD.name).all(), form_values=values,
    )


@solution_engineers_bp.route('/solution-engineers')
def solution_engineers_list():
    """List all solution engineers."""
    ses = SolutionEngineer.query.options(
        db.joinedload(SolutionEngineer.pods)
    ).order_by(SolutionEngineer.name).all()
    return render_template('solution_engineers_list.html', solution_engineers=ses)


@solution_engineers_bp.route('/solution-engineer/<int:id>')
def solution_engineer_view(id):
    """View solution engineer details."""
    se = SolutionEngineer.query.options(
        db.selectinload(SolutionEngineer.pods).selectinload(POD.territories)
    ).filter_by(id=id).first_or_404()
    return _render_engineer_detail(se)


@solution_engineers_bp.route('/solution-engineer/<int:id>/edit', methods=['GET', 'POST'])
def solution_engineer_edit(id):
    """Edit solution engineer details."""
    se = SolutionEngineer.query.options(
        db.joinedload(SolutionEngineer.pods)
    ).filter_by(id=id).first_or_404()
    
    if request.method == 'POST':
        values = {key: request.form.get(key, '') for key in ('name', 'alias', 'specialty')}
        values['pod_ids'] = request.form.getlist('pod_ids')
        name, alias, specialty = (values[key].strip() for key in ('name', 'alias', 'specialty'))
        
        if not name:
            flash('Solution Engineer name is required.', 'danger')
            session['se_form_failure'] = {'path': request.path, 'values': values}
            return redirect(url_for('solution_engineers.solution_engineer_edit', id=id))

        try:
            pod_ids = list(dict.fromkeys(int(value) for value in values['pod_ids']))
        except ValueError:
            flash('Review the POD assignments before saving. Your entries are still here.', 'danger')
            return _render_engineer_form(se, values), 400

        try:
            pods = [pod for pod_id in pod_ids if (pod := db.session.get(POD, pod_id))]
            se.name = name
            se.alias = alias or None
            se.specialty = specialty or None
            se.pods = pods
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            logger.exception('Could not edit solution engineer %s from manual form', id)
            flash('Could not save the solution engineer. Your entries are still here.', 'danger')
            return _render_engineer_form(se, values), 500
        
        flash(f'Solution Engineer "{name}" updated successfully!', 'success')
        return redirect(url_for('solution_engineers.solution_engineer_view', id=se.id))
    
    failure = session.get('se_form_failure')
    values = None
    if failure and failure.get('path') == request.path:
        values = session.pop('se_form_failure')['values']
    return _render_engineer_form(se, values)


@solution_engineers_bp.route('/solution-engineer/<int:id>/delete', methods=['POST'])
def solution_engineer_delete(id):
    """Delete solution engineer."""
    se = SolutionEngineer.query.filter_by(id=id).first_or_404()
    
    se_name = se.name
    
    try:
        se.pods.clear()
        db.session.delete(se)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception('Could not delete solution engineer %s', id)
        flash('Could not delete the solution engineer. No changes were saved. Try again.',
              'danger')
        return _render_engineer_detail(se), 500
    
    flash(f'Solution Engineer "{se_name}" deleted successfully.', 'success')
    return redirect(url_for('solution_engineers.solution_engineers_list'))
