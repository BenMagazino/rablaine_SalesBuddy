"""Reuse read-only loader results within a bounded dashboard render."""
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps
from typing import ParamSpec, TypeVar, cast

from flask import has_request_context, request

P = ParamSpec('P')
R = TypeVar('R')
_shared_reads: ContextVar[dict[tuple, object] | None] = ContextVar('shared_reads', default=None)


@contextmanager
def shared_read_scope() -> Iterator[None]:
    """Keep shared data local to one render, including nested calculations."""
    if _shared_reads.get() is not None:
        yield
        return
    token = _shared_reads.set({})
    try:
        yield
    finally:
        _shared_reads.reset(token)


def request_cached(loader: Callable[P, R]) -> Callable[P, R]:
    """Cache hashable loader arguments for one read request; treat results as read-only.

    Only an explicit shared-read scope enables caching. Ordinary report reads,
    background work and write requests always read afresh.
    """
    @wraps(loader)
    def cached(*args: P.args, **kwargs: P.kwargs) -> R:
        """Reuse a successful load with identical arguments, never a failed load."""
        values = _shared_reads.get()
        if (values is None or not has_request_context()
                or request.method not in ('GET', 'HEAD')):
            return loader(*args, **kwargs)
        key = (loader, args, tuple(sorted(kwargs.items())))
        if key not in values:
            values[key] = loader(*args, **kwargs)
        return cast(R, values[key])

    return cached
