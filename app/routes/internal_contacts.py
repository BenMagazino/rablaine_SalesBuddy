"""Internal contact routes for Sales Buddy.

Handles listing, creating, editing, and deleting internal contacts
(Microsoft employees not tracked as Sellers or Solution Engineers).
"""
from flask import Blueprint, current_app, render_template, request, redirect, url_for, flash, session
from sqlalchemy.exc import SQLAlchemyError

from app.models import db, InternalContact, NoteAttendee

internal_contacts_bp = Blueprint('internal_contacts', __name__)


def _form_values() -> dict:
    """Capture raw manual entries before normalization."""
    return {key: request.form.get(key, '') for key in ('name', 'alias', 'role')}


def _render_form(contact: InternalContact | None, values: dict | None = None):
    """Render retained failure input only on its original editor."""
    failure = session.get('ic_form_failure')
    if values is None and failure and failure.get('path') == request.path:
        values = session.pop('ic_form_failure')['values']
    return render_template('internal_contact_form.html', contact=contact, form_values=values)


@internal_contacts_bp.route('/internal-contacts')
def internal_contacts_list():
    """List all internal contacts."""
    contacts = InternalContact.query.order_by(InternalContact.name).all()
    return render_template('internal_contacts_list.html', contacts=contacts)


@internal_contacts_bp.route('/internal-contacts/new', methods=['GET', 'POST'])
def internal_contact_new():
    """Create a new internal contact."""
    if request.method == 'POST':
        values = _form_values()
        name = request.form.get('name', '').strip()
        alias = request.form.get('alias', '').strip().lower()
        role = request.form.get('role', '').strip()

        if not name:
            flash('Name is required.', 'danger')
            session['ic_form_failure'] = {'path': request.path, 'values': values}
            return redirect(url_for('internal_contacts.internal_contact_new'))

        if alias.endswith('@microsoft.com'):
            alias = alias[:-len('@microsoft.com')]

        # Check for duplicate alias
        if alias:
            existing = InternalContact.query.filter(
                db.func.lower(InternalContact.alias) == alias
            ).first()
            if existing:
                flash(f'An internal contact with alias "{alias}" already exists.', 'warning')
                return redirect(url_for('internal_contacts.internal_contact_edit',
                                        id=existing.id))

        ic = InternalContact(
            name=name,
            alias=alias or None,
            role=role or None,
        )
        try:
            db.session.add(ic)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            current_app.logger.exception('Could not create internal contact from manual form')
            flash('Could not save the internal contact. Your entries are still here.', 'danger')
            return _render_form(None, values), 500

        flash(f'Internal contact "{name}" created.', 'success')
        return redirect(url_for('internal_contacts.internal_contacts_list'))

    return _render_form(None)


@internal_contacts_bp.route('/internal-contacts/<int:id>/edit', methods=['GET', 'POST'])
def internal_contact_edit(id):
    """Edit an internal contact."""
    ic = InternalContact.query.get_or_404(id)

    if request.method == 'POST':
        values = _form_values()
        name = request.form.get('name', '').strip()
        alias = request.form.get('alias', '').strip().lower()
        role = request.form.get('role', '').strip()

        if not name:
            flash('Name is required.', 'danger')
            session['ic_form_failure'] = {'path': request.path, 'values': values}
            return redirect(url_for('internal_contacts.internal_contact_edit', id=id))

        if alias.endswith('@microsoft.com'):
            alias = alias[:-len('@microsoft.com')]

        # Check for duplicate alias (exclude self)
        if alias:
            existing = InternalContact.query.filter(
                db.func.lower(InternalContact.alias) == alias,
                InternalContact.id != ic.id,
            ).first()
            if existing:
                flash(f'Alias "{alias}" is already used by {existing.name}.', 'warning')
                session['ic_form_failure'] = {'path': request.path, 'values': values}
                return redirect(url_for('internal_contacts.internal_contact_edit', id=id))

        try:
            ic.name = name
            ic.alias = alias or None
            ic.role = role or None
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            current_app.logger.exception('Could not edit internal contact %s from manual form', id)
            flash('Could not save the internal contact. Your entries are still here.', 'danger')
            return _render_form(ic, values), 500

        flash(f'Internal contact "{name}" updated.', 'success')
        return redirect(url_for('internal_contacts.internal_contacts_list'))

    return _render_form(ic)


@internal_contacts_bp.route('/internal-contacts/<int:id>/delete', methods=['POST'])
def internal_contact_delete(id):
    """Delete an internal contact.

    Clears any NoteAttendee references first (sets internal_contact_id to NULL
    and copies name/email to external fields so the attendee record survives).
    """
    ic = InternalContact.query.get_or_404(id)
    ic_name = ic.name

    try:
        # Preserve attendee records by converting to external.
        attendees = NoteAttendee.query.filter_by(internal_contact_id=ic.id).all()
        for att in attendees:
            att.external_name = ic.name
            att.external_email = ic.get_email()
            att.internal_contact_id = None

        db.session.delete(ic)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception('Could not delete internal contact %s', id)
        flash('Could not delete this internal contact. Nothing was changed. Please try again.',
              'danger')
        contacts = InternalContact.query.order_by(InternalContact.name).all()
        return render_template('internal_contacts_list.html', contacts=contacts), 503

    flash(f'Internal contact "{ic_name}" deleted.', 'success')
    return redirect(url_for('internal_contacts.internal_contacts_list'))
