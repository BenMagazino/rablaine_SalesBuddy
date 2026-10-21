"""Read-loader caching stays inside one request and never hides errors or writes."""
from unittest.mock import Mock

import pytest

from app.services.request_cache import request_cached, shared_read_scope


@pytest.mark.parametrize('method', ['GET', 'HEAD'])
def test_identical_loader_inputs_are_reused_in_one_read_request(app, method):
    """Scoped inputs, including explicitly empty scope, have independent cached results."""
    loader = Mock(side_effect=lambda scope, *, version: {'scope': scope, 'version': version})
    cached = request_cached(loader)
    with app.test_request_context(method=method), shared_read_scope():
        first = cached((1,), version=2)
        assert cached((1,), version=2) is first
        assert cached((2,), version=2)['scope'] == (2,)
        assert cached((), version=2)['scope'] == ()
        assert cached(None, version=2)['scope'] is None
        assert cached((1,), version=3)['version'] == 3
    assert loader.call_count == 5


def test_caches_are_isolated_between_loaders_requests_and_nested_app_contexts(app):
    """Even requests that share Flask's app context cannot share cached data."""
    first = Mock(side_effect=lambda: object())
    second = Mock(side_effect=lambda: object())
    cached_first, cached_second = request_cached(first), request_cached(second)
    with app.app_context():
        with app.test_request_context(), shared_read_scope():
            previous = cached_first()
            assert cached_first() is previous
            assert cached_second() is not previous
        with app.test_request_context(), shared_read_scope():
            assert cached_first() is not previous
    assert first.call_count == 2
    assert second.call_count == 1


@pytest.mark.parametrize('method', ['POST', 'PUT', 'PATCH', 'DELETE'])
def test_write_requests_do_not_cache_reads(app, method):
    """A read after a write must see fresh state in the same request."""
    loader = Mock(side_effect=[1, 2])
    cached = request_cached(loader)
    with app.test_request_context(method=method), shared_read_scope():
        assert cached() == 1
        assert cached() == 2
    assert loader.call_count == 2


def test_calls_without_a_request_do_not_cache(app, monkeypatch):
    """Workers, tools, and standalone app-context calls preserve fresh-read behavior."""
    loader = Mock(side_effect=[1, 2])
    cached = request_cached(loader)
    monkeypatch.setattr('app.services.request_cache.has_request_context', lambda: False)
    with app.app_context(), shared_read_scope():
        assert cached() == 1
        assert cached() == 2


def test_failed_load_is_raised_and_can_be_retried(app):
    """Errors propagate normally instead of becoming cached success-shaped fallbacks."""
    loader = Mock(side_effect=[ValueError('Source failed'), {'ready': True}])
    cached = request_cached(loader)
    with app.test_request_context(), shared_read_scope():
        with pytest.raises(ValueError, match='Source failed'):
            cached()
        assert cached() == {'ready': True}
        assert cached() == {'ready': True}
    assert loader.call_count == 2


def test_ordinary_report_reads_outside_a_render_scope_remain_fresh(app):
    """A request alone cannot cache successive report reads around a data change."""
    loader = Mock(side_effect=[1, 2])
    cached = request_cached(loader)
    with app.test_request_context():
        assert cached() == 1
        assert cached() == 2


def test_nested_scope_reuses_data_and_failed_render_always_releases_it(app):
    """A nested renderer shares reads, while the next render starts with a clean cache."""
    loader = Mock(side_effect=[1, 2])
    cached = request_cached(loader)
    with app.test_request_context():
        with pytest.raises(ValueError, match='Render failed'):
            with shared_read_scope():
                assert cached() == 1
                with shared_read_scope():
                    assert cached() == 1
                raise ValueError('Render failed')
        with shared_read_scope():
            assert cached() == 2
    assert loader.call_count == 2
