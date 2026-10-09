"""HTTP recovery presentation contracts, including non-replayable failed writes."""

import pytest
from flask import Flask, abort, g
from werkzeug.exceptions import ServiceUnavailable

from app.routes.errors import register_error_handlers


@pytest.fixture
def error_app():
    """Build an isolated HTTP contract app without touching a database."""
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.update(TESTING=True, PROPAGATE_EXCEPTIONS=False)
    app.add_url_rule('/', endpoint='main.index', view_func=lambda: 'Home')

    @app.before_request
    def diagnostic_reference():
        """Supply a deterministic reference, not a sensitive exception message."""
        g._diag_cid = 'test-reference'

    @app.route('/failure', methods=['GET', 'POST'])
    def failure():
        """Raise a real server exception handled by Flask's 500 pathway."""
        raise RuntimeError('private database credentials')

    @app.route('/unavailable')
    def unavailable():
        """Preserve retry headers across the HTML recovery document."""
        raise ServiceUnavailable(retry_after=60)

    @app.route('/forbidden')
    def forbidden():
        """Preserve meaningful escaped HTTP descriptions."""
        abort(403, description='<b>Access is unavailable</b>')

    register_error_handlers(app)
    return app


def test_missing_record_and_unknown_route_use_native_document(client):
    """Live route contracts keep 404 semantics and meaningful navigation."""
    for url in ('/customer/999999999', '/does-not-exist'):
        response = client.get(url)
        assert response.status_code == 404
        assert b'Page or record not found' in response.data
        assert b'Go to Home' in response.data
        assert b'ui-errors.css' in response.data
        assert b'bootstrap' not in response.data


def test_failure_hides_exception_and_exposes_diagnostic_reference(error_app):
    """A safe GET retry does not disclose the caught internal exception."""
    response = error_app.test_client().get('/failure')
    assert response.status_code == 500
    assert b'private database credentials' not in response.data
    assert b'test-reference' in response.data
    assert b'id="error-retry"' in response.data
    assert b'Check the record before submitting it again' in response.data


def test_failed_post_does_not_offer_replay(error_app):
    """Never offer a reload retry for a potentially mutating submission."""
    response = error_app.test_client().post('/failure')
    assert response.status_code == 500
    assert b'id="error-retry"' not in response.data


def test_server_error_does_not_requery_preferences(error_app):
    """Error rendering must survive an unusable ORM session."""
    class ExpiredPreference:
        """Simulate a database-backed attribute that must not be accessed."""
        @property
        def dark_mode(self):
            """Fail if the handler attempts a database-backed theme lookup."""
            raise RuntimeError('database session cannot load preferences')

    @error_app.before_request
    def expired_preferences():
        """Attach the expired preference to the normal request context."""
        g.user_prefs = ExpiredPreference()

    response = error_app.test_client().get('/failure')
    assert response.status_code == 500
    assert b'test-reference' in response.data


def test_error_headers_and_escaped_description_survive(error_app):
    """Retain HTTP protocol headers and descriptive non-server failures."""
    client = error_app.test_client()
    response = client.get('/unavailable')
    assert response.status_code == 503
    assert response.headers['Retry-After'] == '60'
    response = client.get('/forbidden')
    assert response.status_code == 403
    assert b'&lt;b&gt;Access is unavailable&lt;/b&gt;' in response.data


def test_api_and_json_clients_keep_status_and_json(error_app):
    """API clients receive actionable JSON rather than navigation HTML."""
    client = error_app.test_client()
    for url in ('/api/does-not-exist', '/does-not-exist'):
        response = client.get(url, headers={'Accept': 'application/json'})
        assert response.status_code == 404
        assert response.is_json
        assert response.json['error'] == 'Not Found'
    response = client.get('/failure', headers={'Accept': 'application/json'})
    assert response.status_code == 500
    assert response.json['reference'] == 'test-reference'
    assert 'private database credentials' not in response.json['message']
