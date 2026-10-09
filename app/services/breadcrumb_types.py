"""Shared, read-only breadcrumb values and canonical ownership paths."""

from collections.abc import Mapping
from dataclasses import dataclass

from flask import url_for

from app.models import Customer, Seller


@dataclass(frozen=True)
class Breadcrumb:
    """A location label, linked only when it represents an ancestor."""

    label: str
    url: str | None = None


def link(label: str, endpoint: str, **values: object) -> Breadcrumb:
    """Build an ancestor using a real Flask destination."""
    return Breadcrumb(label, url_for(endpoint, **values))


def home() -> Breadcrumb:
    """Return the shared root destination."""
    return link("Home", "main.index")


def seller_path(seller: Seller | None) -> list[Breadcrumb]:
    """Return the canonical seller ancestry, omitting an absent assignment."""
    result = [home()]
    if seller is not None:
        result.append(link(seller.name, "sellers.seller_view", id=seller.id))
    return result


def customer_path(customer: Customer) -> list[Breadcrumb]:
    """Place customer-owned pages beneath the customer's assigned seller."""
    return [
        *seller_path(customer.seller),
        link(customer.name, "customers.customer_view", id=customer.id),
    ]


def page_label(context: Mapping[str, object]) -> str:
    """Read the normalized template title supplied by the central resolver."""
    label = context.get("breadcrumb_title")
    if not isinstance(label, str) or not label:
        raise ValueError("Breadcrumb rendering requires a non-empty page title.")
    return label


def current(label: str) -> Breadcrumb:
    """Return an explicitly non-clickable current location."""
    return Breadcrumb(label)
