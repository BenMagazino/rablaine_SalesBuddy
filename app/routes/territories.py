"""
Territory routes for Sales Buddy.
Handles territory listing, creation, viewing, and editing.
"""
from flask import Blueprint, render_template, request, redirect, url_for, flash, g, session
from datetime import timedelta
import logging
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from app.models import db, Territory, Seller, Customer, Note, POD, UserPreference, utc_now

# Create blueprint
territories_bp = Blueprint('territories', __name__)
logger = logging.getLogger(__name__)


def _render_territory_form(territory: Territory | None, values: dict | None = None):
    """Render the original alphabetical duplicate reference and retained input."""
    query = Territory.query
    if territory:
        query = query.filter(Territory.id != territory.id)
    return render_template(
        'territory_form.html', territory=territory,
        existing_territories=query.order_by(Territory.name).all(), form_values=values,
    )


def _retain_territory_input() -> None:
    """Retain raw input once across the original validation redirect."""
    session['territory_form_failure'] = {
        'path': request.path, 'values': {'name': request.form.get('name', '')},
    }


def _territory_failed_input() -> dict | None:
    """Consume failed entries only on their matching New or Edit endpoint."""
    draft = session.get('territory_form_failure')
    if draft and draft.get('path') == request.path:
        session.pop('territory_form_failure')
        return draft['values']
    return None


@territories_bp.route('/territories')
def territories_list():
    """List all territories."""
    territories = Territory.query.options(
        db.joinedload(Territory.sellers),
        db.joinedload(Territory.customers),
        db.joinedload(Territory.pod)
    ).order_by(Territory.name).all()
    return render_template('territories_list.html', territories=territories)


@territories_bp.route('/territory/new', methods=['GET', 'POST'])
def territory_create():
    """Create a new territory (FR001)."""
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        
        if not name:
            flash('Territory name is required.', 'danger')
            _retain_territory_input()
            return redirect(url_for('territories.territory_create'))
        
        # Check for duplicate
        existing = Territory.query.filter_by(name=name).first()
        if existing:
            flash(f'Territory "{name}" already exists.', 'warning')
            return redirect(url_for('territories.territory_view', id=existing.id))
        
        try:
            territory = Territory(name=name)
            db.session.add(territory)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            logger.exception('Could not create territory from manual form')
            flash('Could not save the territory. Your entries are still here.', 'danger')
            return _render_territory_form(None, {'name': request.form.get('name', '')}), 500
        
        flash(f'Territory "{name}" created successfully!', 'success')
        return redirect(url_for('territories.territories_list'))
    
    return _render_territory_form(None, _territory_failed_input())


@territories_bp.route('/territory/<int:id>')
def territory_view(id):
    """View territory details (FR006)."""
    territory = Territory.query.options(
        db.joinedload(Territory.pod)
    ).filter_by(id=id).first_or_404()
    # Sort sellers in-memory since they're eager-loaded
    sellers = sorted(territory.sellers, key=lambda s: s.name)
    
    # Get user preference for territory view
    pref = UserPreference.query.first()
    show_accounts = pref.territory_view_accounts if pref else False
    
    recent_calls = []
    growth_customers = []
    acquisition_customers = []
    
    if show_accounts:
        # Get all customers in this territory with call counts
        customers_with_counts = db.session.query(
            Customer,
            func.count(Note.id).label('call_count')
        ).join(
            Seller, Customer.seller_id == Seller.id
        ).filter(
            Seller.territories.any(Territory.id == id)
        ).outerjoin(
            Note, Customer.id == Note.customer_id
        ).group_by(Customer.id, Seller.id, Seller.seller_type).all()
        
        # Group by seller type and sort by call count
        for customer, call_count in customers_with_counts:
            customer.call_count = call_count  # Attach count for template
            # Determine customer type by their seller
            if customer.seller:
                if customer.seller.seller_type == 'Growth':
                    growth_customers.append(customer)
                elif customer.seller.seller_type == 'Acquisition':
                    acquisition_customers.append(customer)
        
        # Sort by call count descending
        growth_customers.sort(key=lambda c: c.call_count, reverse=True)
        acquisition_customers.sort(key=lambda c: c.call_count, reverse=True)
    else:
        # Get calls from last 7 days
        week_ago = utc_now() - timedelta(days=7)
        recent_calls = Note.query.join(Customer).filter(
            Customer.territory_id == id,
            Note.call_date >= week_ago
        ).order_by(Note.call_date.desc()).all()
    
    return render_template('territory_view.html', 
                         territory=territory, 
                         sellers=sellers, 
                         recent_calls=recent_calls,
                         show_accounts=show_accounts,
                         growth_customers=growth_customers,
                         acquisition_customers=acquisition_customers)


@territories_bp.route('/territory/<int:id>/edit', methods=['GET', 'POST'])
def territory_edit(id):
    """Edit territory (FR006)."""
    territory = Territory.query.filter_by(id=id).first_or_404()
    
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        
        if not name:
            flash('Territory name is required.', 'danger')
            _retain_territory_input()
            return redirect(url_for('territories.territory_edit', id=id))
        
        # Check for duplicate (excluding current territory)
        existing = Territory.query.filter(
            Territory.name == name,
            Territory.id != id
        ).first()
        if existing:
            flash(f'Territory "{name}" already exists.', 'warning')
            _retain_territory_input()
            return redirect(url_for('territories.territory_edit', id=id))
        
        try:
            territory.name = name
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            logger.exception('Could not edit territory %s from manual form', id)
            flash('Could not save the territory. Your entries are still here.', 'danger')
            return _render_territory_form(
                territory, {'name': request.form.get('name', '')},
            ), 500
        
        flash(f'Territory "{name}" updated successfully!', 'success')
        return redirect(url_for('territories.territory_view', id=territory.id))
    
    return _render_territory_form(territory, _territory_failed_input())


@territories_bp.route('/territory/create-inline', methods=['POST'])
def territory_create_inline():
    """Create territory inline from other forms."""
    name = request.form.get('name', '').strip()
    redirect_to = request.form.get('redirect_to', url_for('territories.territories_list'))
    
    if name:
        existing = Territory.query.filter_by(name=name).first()
        if not existing:
            territory = Territory(name=name)
            db.session.add(territory)
            db.session.commit()
            flash(f'Territory "{name}" created successfully!', 'success')
        else:
            flash(f'Territory "{name}" already exists.', 'info')
    
    return redirect(redirect_to)
