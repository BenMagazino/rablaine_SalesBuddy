"""
Topic routes for Sales Buddy.
Handles topic listing, creation, viewing, editing, and deletion.
"""
from flask import (
    Blueprint, current_app, render_template, request, redirect, url_for, flash, jsonify, session,
)
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from app.models import db, Topic, UserPreference

# Create blueprint
topics_bp = Blueprint('topics', __name__)


def _form_values() -> dict:
    """Capture raw manual entries before normalization."""
    return {key: request.form.get(key, '') for key in ('name', 'description')}


def _render_form(topic: Topic | None, values: dict | None = None):
    """Retain validation input once, only on its original form path."""
    failure = session.get('topic_form_failure')
    if values is None and failure and failure.get('path') == request.path:
        values = session.pop('topic_form_failure')['values']
    return render_template('topic_form.html', topic=topic, form_values=values)


@topics_bp.route('/topics')
def topics_list():
    """List all topics (FR009)."""
    pref = UserPreference.query.first()
    
    # Load topics with eager loading
    topics = Topic.query.options(db.joinedload(Topic.notes)).all()
    
    # Sort based on preference
    if pref and pref.topic_sort_by_calls:
        # Sort by number of calls (descending), then by name
        topics = sorted(topics, key=lambda t: (-len(t.notes), t.name.lower()))
    else:
        # Sort alphabetically
        topics = sorted(topics, key=lambda t: t.name.lower())
    
    return render_template(
        'topics_list.html', topics=topics,
        topic_sort_by_calls=bool(pref and pref.topic_sort_by_calls),
    )


@topics_bp.route('/topic/new', methods=['GET', 'POST'])
def topic_create():
    """Create a new topic (FR004)."""
    if request.method == 'POST':
        values = _form_values()
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        
        if not name:
            flash('Topic name is required.', 'danger')
            session['topic_form_failure'] = {'path': request.path, 'values': values}
            return redirect(url_for('topics.topic_create'))
        
        # Check for duplicate topic names
        existing = Topic.query.filter_by(name=name).first()
        if existing:
            flash(f'Topic "{name}" already exists.', 'warning')
            return redirect(url_for('topics.topic_view', id=existing.id))
        
        topic = Topic(
            name=name,
            description=description if description else None)
        try:
            db.session.add(topic)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            current_app.logger.exception('Could not create topic from manual form')
            flash('Could not save the topic. Your entries are still here.', 'danger')
            return _render_form(None, values), 500
        
        flash(f'Topic "{name}" created successfully!', 'success')
        return redirect(url_for('topics.topics_list'))
    
    return _render_form(None)


@topics_bp.route('/topic/<int:id>')
def topic_view(id):
    """View topic details (FR009)."""
    topic = Topic.query.filter_by(id=id).first_or_404()
    # Sort notes in-memory since they're eager-loaded
    notes = sorted(topic.notes, key=lambda c: c.call_date, reverse=True)
    return render_template('topic_view.html', topic=topic, notes=notes)


@topics_bp.route('/topic/<int:id>/edit', methods=['GET', 'POST'])
def topic_edit(id):
    """Edit topic (FR009)."""
    topic = Topic.query.filter_by(id=id).first_or_404()
    
    if request.method == 'POST':
        values = _form_values()
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        
        if not name:
            flash('Topic name is required.', 'danger')
            session['topic_form_failure'] = {'path': request.path, 'values': values}
            return redirect(url_for('topics.topic_edit', id=id))
        
        # Check for duplicate topic names (excluding current topic)
        existing = Topic.query.filter(Topic.name == name, Topic.id != id).first()
        if existing:
            flash(f'Topic "{name}" already exists.', 'warning')
            session['topic_form_failure'] = {'path': request.path, 'values': values}
            return redirect(url_for('topics.topic_edit', id=id))
        
        try:
            topic.name = name
            topic.description = description if description else None
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            current_app.logger.exception('Could not edit topic %s from manual form', id)
            flash('Could not save the topic. Your entries are still here.', 'danger')
            return _render_form(topic, values), 500
        
        flash(f'Topic "{name}" updated successfully!', 'success')
        return redirect(url_for('topics.topic_view', id=topic.id))
    
    return _render_form(topic)


@topics_bp.route('/topic/<int:id>/delete', methods=['POST'])
def topic_delete(id):
    """Delete topic and remove from all associated notes."""
    topic = Topic.query.filter_by(id=id).first_or_404()
    topic_name = topic.name
    
    # Get all notes associated with this topic
    notes_count = len(topic.notes)
    
    # SQLAlchemy removes topic associations without deleting the notes.
    try:
        db.session.delete(topic)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception('Could not delete topic %s', id)
        flash('Could not delete the topic. Your topic and note associations are unchanged.',
              'danger')
        return redirect(url_for('topics.topic_view', id=id))
    
    if notes_count > 0:
        flash(f'Topic "{topic_name}" deleted and removed from {notes_count} note(s).', 'success')
    else:
        flash(f'Topic "{topic_name}" deleted successfully.', 'success')
    
    return redirect(url_for('topics.topics_list'))


# API route
@topics_bp.route('/api/topic/create', methods=['POST'])
def api_topic_create():
    """API endpoint to create a new topic via AJAX (FR027)."""
    data = request.get_json()
    name = data.get('name', '').strip() if data else ''
    
    if not name:
        return jsonify({'error': 'Topic name is required'}), 400
    
    # Check for duplicate topic names (case-insensitive)
    existing = Topic.query.filter(func.lower(Topic.name) == func.lower(name)).first()
    if existing:
        return jsonify({
            'id': existing.id,
            'name': existing.name,
            'description': existing.description or '',
            'existed': True
        }), 200
    
    # Create new topic
    topic = Topic(name=name, description=None)
    db.session.add(topic)
    db.session.commit()
    
    return jsonify({
        'id': topic.id,
        'name': topic.name,
        'description': topic.description or '',
        'existed': False
    }), 201
