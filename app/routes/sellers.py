"""
Seller routes for Sales Buddy.
Handles seller listing, creation, viewing, and editing.
"""
from flask import Blueprint, render_template, request, redirect, url_for, flash, g, jsonify, session
from datetime import date, datetime, timedelta, timezone
import logging
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, subqueryload

from app.models import db, Seller, Territory, Customer, Engagement, Note

# Create blueprint
sellers_bp = Blueprint('sellers', __name__)
logger = logging.getLogger(__name__)


def _render_seller_form(seller: Seller | None, values: dict | None = None):
    """Render the manual editor with sorted choices and failed-input precedence."""
    territories = Territory.query.order_by(Territory.name).all()
    query = Seller.query
    if seller:
        query = query.filter(Seller.id != seller.id)
    return render_template(
        'seller_form.html', seller=seller, territories=territories,
        existing_sellers=query.order_by(Seller.name).all(), form_values=values,
        territory_choices=[{'id': item.id, 'name': item.name} for item in territories],
    )


def _retain_seller_input() -> None:
    """Retain one failed form across its original validation redirect."""
    session['seller_form_failure'] = {
        'path': request.path, 'values': {
            'name': request.form.get('name', ''),
            'alias': request.form.get('alias', ''),
            'seller_type': request.form.get('seller_type', 'Growth'),
            'territory_ids': request.form.getlist('territory_ids'),
        },
    }


def _seller_failed_input() -> dict | None:
    """Consume redirected input only on its matching New or Edit page."""
    draft = session.get('seller_form_failure')
    if draft and draft.get('path') == request.path:
        session.pop('seller_form_failure')
        return draft['values']
    return None


@sellers_bp.route('/sellers')
def sellers_list():
    """List all sellers with expandable customer rows."""
    sellers = Seller.query.options(
        db.joinedload(Seller.territories).joinedload(Territory.pod),
        db.joinedload(Seller.customers).joinedload(Customer.notes),
    ).order_by(Seller.name).all()

    def build_customers(seller):
        customers_data = []
        for customer in sorted(seller.customers, key=lambda c: c.get_display_name()):
            sorted_notes = sorted(customer.notes, key=lambda n: n.call_date, reverse=True)
            customers_data.append({
                'customer': customer,
                'last_note': sorted_notes[0] if sorted_notes else None,
            })
        return {'seller': seller, 'customers': customers_data}

    growth_sellers = [build_customers(s) for s in sellers if s.seller_type == 'Growth']
    acquisition_sellers = [build_customers(s) for s in sellers if s.seller_type != 'Growth']

    return render_template(
        'sellers_list.html',
        growth_sellers=growth_sellers,
        acquisition_sellers=acquisition_sellers,
    )


@sellers_bp.route('/seller/new', methods=['GET', 'POST'])
def seller_create():
    """Create a new seller (FR002)."""
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        alias = request.form.get('alias', '').strip().replace('@microsoft.com', '') or None
        seller_type = request.form.get('seller_type', 'Growth')
        territory_ids = request.form.getlist('territory_ids')
        
        if not name:
            flash('Seller name is required.', 'danger')
            _retain_seller_input()
            return redirect(url_for('sellers.seller_create'))
        
        # Check for duplicate
        existing = Seller.query.filter_by(name=name).first()
        if existing:
            flash(f'Seller "{name}" already exists.', 'warning')
            return redirect(url_for('sellers.seller_view', id=existing.id))
        
        try:
            seller = Seller(name=name, alias=alias, seller_type=seller_type)
            db.session.add(seller)
            for territory_id in territory_ids:
                territory = db.session.get(Territory, int(territory_id))
                if territory:
                    seller.territories.append(territory)
            db.session.commit()
        except (SQLAlchemyError, ValueError):
            db.session.rollback()
            logger.exception('Could not create seller from manual form')
            flash('Could not save the seller. Your entries are still here.', 'danger')
            _retain_seller_input()
            return _render_seller_form(None, _seller_failed_input()), 500
        
        flash(f'Seller "{name}" created successfully!', 'success')
        return redirect(url_for('sellers.sellers_list'))
    
    return _render_seller_form(None, _seller_failed_input())


@sellers_bp.route('/seller/<int:id>')
def seller_view(id):
    """View seller details, the single source of truth for a seller."""
    seller = Seller.query.options(
        db.joinedload(Seller.customers).joinedload(Customer.notes)
    ).filter_by(id=id).first_or_404()
    
    # Get customers with their most recent note
    customers_data = []
    for customer in sorted(seller.customers, key=lambda c: c.name):
        sorted_notes = sorted(customer.notes, key=lambda c: c.call_date, reverse=True)
        most_recent_note = sorted_notes[0] if sorted_notes else None
        customers_data.append({
            'customer': customer,
            'last_note': most_recent_note
        })
    
    # Sort by most recent note date (nulls last)
    min_date = datetime.min
    def get_sort_key(x):
        if not x['last_note']:
            return min_date
        return x['last_note'].call_date
    customers_data.sort(key=get_sort_key, reverse=True)
    
    # Check if seller can be deleted (no associated customers)
    can_delete = len(seller.customers) == 0
    
    # Get revenue analysis for this seller's customers
    from app.services.revenue_analysis import get_seller_alerts
    _addressed = ('actioned', 'dismissed', 'reviewed')
    revenue_alerts = sorted(
        get_seller_alerts(seller.name),
        key=lambda a: (a.review_status in _addressed, -(a.priority_score or 0)),
    )
    
    # Calculate revenue summary totals
    revenue_summary = {
        'count': len(revenue_alerts),
        'total_at_risk': sum(a.dollars_at_risk or 0 for a in revenue_alerts),
        'total_opportunity': sum(a.dollars_opportunity or 0 for a in revenue_alerts),
    }
    
    # Get milestone tracker data filtered for this seller's customers
    from app.services.milestone_sync import get_milestone_tracker_data_for_seller
    milestone_data = get_milestone_tracker_data_for_seller(seller.id)
    
    # Get stale milestones for this seller
    from app.routes.main import _find_stale_milestones
    stale_milestones = _find_stale_milestones(seller_mode_sid=seller.id)
    
    return render_template(
        'seller_view.html',
        seller=seller,
        customers=customers_data,
        can_delete=can_delete,
        revenue_alerts=revenue_alerts,
        revenue_summary=revenue_summary,
        milestones=milestone_data["milestones"],
        milestone_summary=milestone_data["summary"],
        milestone_areas=milestone_data["areas"],
        milestone_quarters=milestone_data["quarters"],
        stale_milestones=stale_milestones,
    )


@sellers_bp.route('/seller/<int:id>/edit', methods=['GET', 'POST'])
def seller_edit(id):
    """Edit seller (FR007)."""
    seller = Seller.query.filter_by(id=id).first_or_404()
    
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        alias = request.form.get('alias', '').strip().replace('@microsoft.com', '') or None
        seller_type = request.form.get('seller_type', 'Growth')
        territory_ids = request.form.getlist('territory_ids')
        
        if not name:
            flash('Seller name is required.', 'danger')
            _retain_seller_input()
            return redirect(url_for('sellers.seller_edit', id=id))
        
        # Check for duplicate (excluding current seller)
        existing = Seller.query.filter(
            Seller.name == name,
            Seller.id != id
        ).first()
        if existing:
            flash(f'Seller "{name}" already exists.', 'warning')
            _retain_seller_input()
            return redirect(url_for('sellers.seller_edit', id=id))
        
        try:
            seller.name = name
            seller.alias = alias
            seller.seller_type = seller_type
            seller.territories = []
            for territory_id in territory_ids:
                territory = db.session.get(Territory, int(territory_id))
                if territory:
                    seller.territories.append(territory)
            db.session.commit()
        except (SQLAlchemyError, ValueError):
            db.session.rollback()
            logger.exception('Could not update seller %s from manual form', id)
            flash('Could not save the seller. Your entries are still here.', 'danger')
            _retain_seller_input()
            return _render_seller_form(seller, _seller_failed_input()), 500
        
        flash(f'Seller "{name}" updated successfully!', 'success')
        return redirect(url_for('sellers.seller_view', id=seller.id))
    
    return _render_seller_form(seller, _seller_failed_input())


@sellers_bp.route('/seller/create-inline', methods=['POST'])
def seller_create_inline():
    """Create seller inline from other forms."""
    name = request.form.get('name', '').strip()
    redirect_to = request.form.get('redirect_to', url_for('sellers.sellers_list'))
    
    if name:
        existing = Seller.query.filter_by(name=name).first()
        if not existing:
            seller = Seller(name=name)
            db.session.add(seller)
            db.session.commit()
            flash(f'Seller "{name}" created successfully!', 'success')
        else:
            flash(f'Seller "{name}" already exists.', 'info')
    
    return redirect(redirect_to)


@sellers_bp.route('/seller/<int:id>/delete', methods=['POST'])
def seller_delete(id):
    """Delete seller if it has no associated customers."""
    seller = Seller.query.filter_by(id=id).first_or_404()
    seller_name = seller.name
    
    # Check if seller has any customers
    if len(seller.customers) > 0:
        flash(f'Cannot delete seller "{seller_name}" because it has {len(seller.customers)} associated customer(s).', 'danger')
        return redirect(url_for('sellers.seller_view', id=id))
    
    # Delete the seller
    try:
        db.session.delete(seller)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception('Could not delete seller %s', id)
        flash('Could not delete the seller. Please try again.', 'danger')
        return redirect(url_for('sellers.seller_view', id=id))
    
    flash(f'Seller "{seller_name}" deleted successfully.', 'success')
    return redirect(url_for('sellers.sellers_list'))


@sellers_bp.route('/api/seller/<int:id>/engagements')
def api_seller_engagements(id):
    """Return active/on-hold engagements for a specific seller's customers."""
    seller = Seller.query.filter_by(id=id).first_or_404()
    customer_ids = [c.id for c in seller.customers]

    if not customer_ids:
        return jsonify({'success': True, 'engagements': [], 'count': 0})

    status_filter = request.args.get('status', '').strip()

    query = Engagement.query.filter(
        Engagement.customer_id.in_(customer_ids),
        Engagement.status.in_(['Active', 'On Hold'])
    )
    if status_filter in ('Active', 'On Hold'):
        query = query.filter(Engagement.status == status_filter)

    query = query.options(
        joinedload(Engagement.customer),
        subqueryload(Engagement.notes),
        subqueryload(Engagement.opportunities),
        subqueryload(Engagement.milestones),
    )

    engagements = query.order_by(Engagement.updated_at.desc()).all()

    results = []
    for eng in engagements:
        results.append({
            'id': eng.id,
            'title': eng.title,
            'status': eng.status,
            'customer_name': eng.customer.name if eng.customer else 'Unknown',
            'customer_id': eng.customer_id,
            'customer_favicon': (eng.customer.favicon_b64
                                if eng.customer and eng.customer.favicon_b64
                                else None),
            'estimated_acr': eng.estimated_acr,
            'target_date': eng.target_date.isoformat() if eng.target_date else None,
            'story_completeness': eng.story_completeness,
            'linked_note_count': eng.linked_note_count,
            'opportunity_count': len(eng.opportunities),
            'milestone_count': len(eng.milestones),
            'latest_note_date': max((n.call_date for n in eng.notes), default=None).isoformat() if eng.notes else None,
        })

    return jsonify({'success': True, 'engagements': results, 'count': len(results)})
