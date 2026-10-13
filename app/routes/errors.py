"""Safe, app-owned HTTP failure documents and API responses."""

from flask import Flask, Response, g, jsonify, render_template, request
from werkzeug.exceptions import HTTPException


def register_error_handlers(app: Flask) -> None:
    """Preserve HTTP status/headers without leaking internal exception details."""
    @app.errorhandler(HTTPException)
    def present_http_error(error: HTTPException) -> Response:
        """Render a recovery page, or JSON for API and explicit JSON clients."""
        response = error.get_response()
        code = error.code or 500
        internal = code >= 500
        description = (
            'Sales Buddy could not finish this request. Try again in a moment. '
            'If it keeps happening, use Help > Open Logs Folder in the desktop app.'
            if internal else error.description
        )
        reference = getattr(g, '_diag_cid', None) if internal else None
        if request.path.startswith('/api/') or (
            request.accept_mimetypes.best == 'application/json'
        ):
            payload = {'error': error.name, 'message': description}
            if reference:
                payload['reference'] = reference
            response.set_data(jsonify(payload).get_data())
            response.content_type = 'application/json'
            return response
        # An expired ORM preference could re-query a failed database transaction.
        prefs = None if internal else getattr(g, 'user_prefs', None)
        dark_mode = getattr(prefs, 'dark_mode', None)
        response.set_data(render_template(
            'error.html', code=code, error_name=error.name, description=description,
            reference=reference, dark_mode=dark_mode,
            theme_family=getattr(prefs, 'theme_family', 'graphite'),
            can_retry=request.method in ('GET', 'HEAD') and code >= 500,
        ))
        response.content_type = 'text/html; charset=utf-8'
        return response
