"""Version local static assets so unchanged files can be reused across pages."""

from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from stat import S_ISREG

from flask import Flask, Response, request
from werkzeug.security import safe_join

STATIC_CACHE_SECONDS = 365 * 24 * 60 * 60


@lru_cache(maxsize=256)
def _asset_digest(filename: str, _modified_ns: int, _size: int) -> str:
    """Reuse a content digest until the file's modification time or size changes."""
    return sha256(Path(filename).read_bytes()).hexdigest()[:16]


def register_static_asset_cache(app: Flask) -> None:
    """Give generated static URLs content versions and cache only matching versions."""
    folder = app.static_folder
    if folder is None:
        raise ValueError("Static asset caching requires a static folder.")

    def get_version(filename: str) -> str | None:
        """Resolve an asset safely and obtain its current content version."""
        resolved = safe_join(folder, filename)
        if resolved is None:
            app.logger.warning("Rejected unsafe static asset path: %s", filename)
            return None
        try:
            metadata = Path(resolved).stat()
            if not S_ISREG(metadata.st_mode):
                app.logger.warning("Static asset is not a file: %s", filename)
                return None
            return _asset_digest(resolved, metadata.st_mtime_ns, metadata.st_size)
        except FileNotFoundError:
            app.logger.warning("Static asset does not exist: %s", filename)
            return None

    @app.url_defaults
    def add_static_version(endpoint: str, values: dict[str, object]) -> None:
        """Version local static links without changing other URLs or explicit versions."""
        filename = values.get("filename")
        if endpoint != "static" or "v" in values or not isinstance(filename, str):
            return
        version = get_version(filename)
        if version is not None:
            values["v"] = version

    @app.after_request
    def cache_versioned_static(response: Response) -> Response:
        """Cache successful static responses only when their version is current."""
        if request.endpoint != "static" or response.status_code not in (200, 304):
            return response
        version = request.args.get("v")
        filename = (request.view_args or {}).get("filename")
        if version and isinstance(filename, str) and version == get_version(filename):
            response.cache_control.no_cache = False
            response.cache_control.public = True
            response.cache_control.max_age = STATIC_CACHE_SECONDS
            response.cache_control.immutable = True
        return response
