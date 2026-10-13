"""Tests for automatic static asset versions and safe browser caching."""

from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from flask import Flask, url_for

from app.static_assets import STATIC_CACHE_SECONDS, register_static_asset_cache


@pytest.fixture
def asset_app(tmp_path: Path) -> Flask:
    """Create a small Flask app with isolated static files and no database."""
    (tmp_path / "script.js").write_text("console.log('original');", encoding="utf-8")
    application = Flask(__name__, static_folder=str(tmp_path), static_url_path="/static")
    register_static_asset_cache(application)

    @application.get("/page")
    def page() -> str:
        """Return a document rather than a static asset."""
        return "page"
    return application


def asset_url(application: Flask) -> str:
    """Generate the same versioned URL used by templates."""
    with application.test_request_context():
        return url_for("static", filename="script.js")


def test_static_links_receive_a_stable_content_version(asset_app: Flask) -> None:
    """Repeated renders reuse the same version for unchanged contents."""
    first = asset_url(asset_app)
    assert first == asset_url(asset_app)
    assert len(parse_qs(urlsplit(first).query)["v"][0]) == 16


def test_current_version_can_be_reused_without_another_server_request(asset_app: Flask) -> None:
    """The browser may cache immutable versioned assets between page navigations."""
    response = asset_app.test_client().get(asset_url(asset_app))
    assert response.status_code == 200
    assert response.cache_control.public
    assert response.cache_control.immutable
    assert response.cache_control.max_age == STATIC_CACHE_SECONDS
    assert not response.cache_control.no_cache


def test_an_edit_changes_the_url_and_does_not_cache_an_old_version(asset_app: Flask) -> None:
    """Edits and git updates invalidate the URL automatically."""
    original = asset_url(asset_app)
    folder = asset_app.static_folder
    assert folder is not None
    (Path(folder) / "script.js").write_text(
        "console.log('updated asset');", encoding="utf-8"
    )
    updated = asset_url(asset_app)
    assert updated != original
    client = asset_app.test_client()
    assert client.get(original).cache_control.max_age is None
    assert b"updated asset" in client.get(updated).data
    assert client.get(updated).cache_control.immutable


@pytest.mark.parametrize("url", ["/static/script.js", "/static/script.js?v=wrong",
                                  "/static/missing.js?v=wrong"])
def test_unversioned_invalid_and_missing_assets_are_not_immutable(
    asset_app: Flask, url: str
) -> None:
    """Do not cache failures or unversioned URLs as immutable assets."""
    response = asset_app.test_client().get(url)
    assert response.cache_control.max_age is None
    assert not response.cache_control.immutable


def test_explicit_versions_and_other_endpoint_urls_are_preserved(asset_app: Flask) -> None:
    """Automatic versions do not overwrite explicitly supplied URL parameters."""
    with asset_app.test_request_context():
        assert url_for("static", filename="script.js", v="explicit").endswith("v=explicit")
        assert url_for("page") == "/page"
    assert not asset_app.test_client().get("/page?v=irrelevant").cache_control.immutable


def test_conditional_response_preserves_versioned_cache_headers(asset_app: Flask) -> None:
    """A conditional request retains the same immutable policy."""
    client = asset_app.test_client()
    url = asset_url(asset_app)
    initial = client.get(url)
    response = client.get(url, headers={"If-None-Match": initial.headers["ETag"]})
    assert response.status_code == 304
    assert response.cache_control.max_age == STATIC_CACHE_SECONDS
    assert response.cache_control.immutable


def test_missing_directory_and_unsafe_paths_remain_unversioned(asset_app: Flask) -> None:
    """Invalid asset paths retain Flask's normal missing-file behavior."""
    with asset_app.test_request_context():
        for filename in ("missing.js", "", "../outside.js"):
            assert "v=" not in url_for("static", filename=filename)
