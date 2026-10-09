"""Canonical breadcrumbs for entity pages, independent of navigation history.

Only note creation sometimes needs an additional lookup: its route supplies selected
engagement/milestone IDs but no objects. Those scalar reads eagerly load ownership,
never iterate over or query the rows displayed by a collection page. All other paths
reuse render-context objects and their existing scalar relationships.
"""

from collections.abc import Mapping
from typing import cast

from flask import current_app
from sqlalchemy.orm import joinedload

from app.models import Customer, Engagement, Milestone, Opportunity, Project, Seller, Topic, db
from app.services.breadcrumb_types import (
    Breadcrumb, current, customer_path, home, link, page_label, seller_path,
)


_COLLECTIONS = {
    "customers.customers_list": "Customers",
    "sellers.sellers_list": "Sellers",
    "territories.territories_list": "Territories",
    "pods.pods_list": "PODs",
    "solution_engineers.solution_engineers_list": "Solution Engineers",
    "internal_contacts.internal_contacts_list": "Internal Contacts",
    "topics.topics_list": "Topics",
    "notes.notes_list": "Notes",
    "engagements.engagements_hub": "Engagements",
    "milestones.milestones_list": "Milestones",
    "partners.partners_list": "Partners",
    "partners.specialties_list": "Specialties",
    "one_on_one.workspace_hub": "1:1 Workspaces",
}

# Context object, collection destination, record destination, record label attribute.
_RECORDS = {
    "pods": ("pod", "pods.pods_list", "pods.pod_view", "name"),
    "solution_engineers": (
        "solution_engineer", "solution_engineers.solution_engineers_list",
        "solution_engineers.solution_engineer_view", "name",
    ),
    "topics": ("topic", "topics.topics_list", "topics.topic_view", "name"),
    "partners": ("partner", "partners.partners_list", "partners.partner_view", "name"),
    "specialties": (
        "specialty", "partners.specialties_list", "partners.specialty_view", "name",
    ),
    "projects": ("project", "engagements.engagements_hub", "projects.project_view", "title"),
}

_ORDINARY_PAGES = {
    "pods.pod_view": ("pods", False),
    "pods.pod_edit": ("pods", True),
    "solution_engineers.solution_engineer_view": ("solution_engineers", False),
    "solution_engineers.solution_engineer_delete": ("solution_engineers", False),
    "solution_engineers.solution_engineer_edit": ("solution_engineers", True),
    "topics.topic_create": ("topics", False),
    "topics.topic_view": ("topics", False),
    "topics.topic_edit": ("topics", True),
    "partners.partner_new": ("partners", False),
    "partners.partner_view": ("partners", False),
    "partners.partner_edit": ("partners", True),
    "partners.specialty_new": ("specialties", False),
    "partners.specialty_view": ("specialties", False),
    "partners.specialty_edit": ("specialties", True),
    "projects.project_create": ("projects", False),
    "projects.project_view": ("projects", False),
    "projects.project_edit": ("projects", True),
}

HANDLED_ENDPOINTS: set[str] = set(_COLLECTIONS) | set(_ORDINARY_PAGES) | {
    "customers.customer_create", "customers.customer_view", "customers.customer_edit",
    "sellers.seller_create", "sellers.seller_view", "sellers.seller_edit",
    "territories.territory_create", "territories.territory_view", "territories.territory_edit",
    "internal_contacts.internal_contact_new", "internal_contacts.internal_contact_edit",
    "internal_contacts.internal_contact_delete",
    "notes.note_create", "notes.note_view", "notes.note_edit", "notes.fill_my_day",
    "engagements.engagement_create", "engagements.engagement_view", "engagements.engagement_edit",
    "milestones.milestone_create", "milestones.milestone_view", "milestones.milestone_edit",
    "milestones.milestone_tracker", "opportunities.opportunity_view",
    "one_on_one.workspace_view",
}


def _collection_path(endpoint: str) -> list[Breadcrumb]:
    """Link a real collection, including the partners parent for specialties."""
    result = [home()]
    if endpoint == "partners.specialties_list":
        result.append(link("Partners", "partners.partners_list"))
    result.append(link(_COLLECTIONS[endpoint], endpoint))
    return result


def _ordinary_path(context: Mapping[str, object], key: str, editing: bool) -> list[Breadcrumb]:
    """Use a collection and, on edit pages, its existing record view."""
    object_key, collection_endpoint, view_endpoint, label_attribute = _RECORDS[key]
    result = _collection_path(collection_endpoint)
    record = context.get(object_key)
    if editing and record is not None:
        result.append(link(getattr(record, label_attribute), view_endpoint, id=record.id))
    return result


def _opportunity_path(opportunity: Opportunity) -> list[Breadcrumb]:
    """Return the ownership path and opportunity hub, with no invented collection."""
    customer = opportunity.customer
    result = customer_path(customer) if customer is not None else [home()]
    return [*result, link(opportunity.name, "opportunities.opportunity_view", id=opportunity.id)]


def _milestone_ancestors(milestone: Milestone) -> list[Breadcrumb]:
    """Use a milestone's real opportunity when present, then its actual customer."""
    if milestone.opportunity is not None:
        return _opportunity_path(milestone.opportunity)
    if milestone.customer is not None:
        return customer_path(milestone.customer)
    return _collection_path("milestones.milestones_list")


def _project_path(project: Project) -> list[Breadcrumb]:
    """Projects live in the engagements hub, not an imaginary projects index."""
    return [
        *_collection_path("engagements.engagements_hub"),
        link(project.title, "projects.project_view", id=project.id),
    ]


def _selected_record(
    context: Mapping[str, object], key: str, collection: str | None = None,
) -> object | None:
    """Find a selected object in supplied form options without a database query."""
    record = context.get(f"preselect_{key}") or context.get(key)
    if record is not None:
        return record
    selected_id = context.get(f"preselect_{key}_id")
    if selected_id is not None and collection:
        for option in context.get(collection) or ():
            if str(option.id) == str(selected_id):
                return option
    return None


def _selected_work_record(context: Mapping[str, object], key: str) -> object | None:
    """Load one explicit note-form parent only when the route did not supply it."""
    record = _selected_record(context, key)
    if record is not None:
        return record
    selected_id = context.get(f"preselect_{key}_id")
    if selected_id is None:
        return None
    try:
        selected_id = int(selected_id)
    except (TypeError, ValueError):
        current_app.logger.warning(
            "Ignoring invalid %s breadcrumb selection: %r", key, selected_id,
        )
        return None
    if key == "engagement":
        return db.session.get(
            Engagement, selected_id,
            options=[joinedload(Engagement.customer).joinedload(Customer.seller)],
        )
    return db.session.get(
        Milestone, selected_id,
        options=[
            joinedload(Milestone.customer).joinedload(Customer.seller),
            joinedload(Milestone.opportunity).joinedload(Opportunity.customer)
            .joinedload(Customer.seller),
        ],
    )


def _note_create_path(context: Mapping[str, object]) -> list[Breadcrumb]:
    """Use an explicitly selected work item, customer or topic as the form parent."""
    engagement = _selected_work_record(context, "engagement")
    if engagement is not None:
        customer = engagement.customer
        result = (
            customer_path(customer) if customer is not None
            else _collection_path("engagements.engagements_hub")
        )
        return [
            *result, link(engagement.title, "engagements.engagement_view", id=engagement.id),
        ]
    milestone = cast(Milestone | None, _selected_work_record(context, "milestone"))
    if milestone is not None:
        return [
            *_milestone_ancestors(milestone),
            link(milestone.display_text, "milestones.milestone_view", id=milestone.id),
        ]
    customer = cast(Customer | None, _selected_record(context, "customer", "customers"))
    if customer is not None:
        return customer_path(customer)
    project = cast(Project | None, _selected_record(context, "project", "active_projects"))
    if project is not None:
        return _project_path(project)
    topic = cast(Topic | None, _selected_record(context, "topic", "topics"))
    if topic is not None:
        return [
            *_collection_path("topics.topics_list"),
            link(topic.name, "topics.topic_view", id=topic.id),
        ]
    return _collection_path("notes.notes_list")


def _customer_page_path(context: Mapping[str, object], endpoint: str) -> list[Breadcrumb]:
    """Keep customer hubs beneath their actual assigned seller, not a category."""
    customer = cast(Customer | None, context.get("customer"))
    if customer is not None:
        result = customer_path(customer)
        return result if endpoint.endswith("_edit") else result[:-1]
    seller = cast(Seller | None, _selected_record(context, "seller", "sellers"))
    return seller_path(seller) if seller else _collection_path("customers.customers_list")


def _territory_page_path(context: Mapping[str, object], endpoint: str) -> list[Breadcrumb]:
    """A territory's single POD is canonical; without one, use Territories."""
    territory = context.get("territory")
    if territory is not None and territory.pod is not None:
        result = [
            *_collection_path("pods.pods_list"),
            link(territory.pod.name, "pods.pod_view", id=territory.pod.id),
        ]
    else:
        result = _collection_path("territories.territories_list")
    if territory is not None and endpoint.endswith("_edit"):
        result.append(link(territory.name, "territories.territory_view", id=territory.id))
    return result


def get_entity_breadcrumbs(
    context: Mapping[str, object], endpoint: str,
) -> list[Breadcrumb] | None:
    """Resolve every full entity page, excluding API, write-only and fragment routes."""
    if endpoint not in HANDLED_ENDPOINTS:
        return None
    label = page_label(context)
    if endpoint in _COLLECTIONS:
        label = _COLLECTIONS[endpoint]
        ancestors = (
            [home(), link("Partners", "partners.partners_list")]
            if endpoint == "partners.specialties_list" else [home()]
        )
    elif endpoint in _ORDINARY_PAGES:
        ancestors = _ordinary_path(context, *_ORDINARY_PAGES[endpoint])
        if endpoint.endswith("_view"):
            key, _ = _ORDINARY_PAGES[endpoint]
            object_key, _, _, label_attribute = _RECORDS[key]
            record = context.get(object_key)
            if record is not None:
                label = getattr(record, label_attribute)
    elif endpoint.startswith("customers."):
        ancestors = _customer_page_path(context, endpoint)
    elif endpoint.startswith("sellers."):
        seller = cast(Seller | None, context.get("seller"))
        ancestors = seller_path(seller) if seller else _collection_path("sellers.sellers_list")
        if seller is not None and endpoint.endswith("_view"):
            ancestors = ancestors[:-1]
    elif endpoint.startswith("territories."):
        ancestors = _territory_page_path(context, endpoint)
    elif endpoint.startswith("internal_contacts."):
        ancestors = _collection_path("internal_contacts.internal_contacts_list")
        contact = context.get("contact")
        # This form inherits the generic base title and has no separate detail page.
        label = f"Edit {contact.name}" if contact is not None else "New Internal Contact"
        if endpoint.endswith("_delete"):
            ancestors = [home()]
            label = "Internal Contacts"
    elif endpoint == "notes.note_create":
        ancestors = _note_create_path(context)
    elif endpoint.startswith("notes."):
        note = context.get("note")
        customer = note.customer if note is not None else None
        ancestors = (
            customer_path(customer) if customer is not None
            else _collection_path("notes.notes_list")
        )
        if note is not None and endpoint.endswith("_edit"):
            ancestors.append(link("Note", "notes.note_view", id=note.id))
    elif endpoint.startswith("engagements."):
        engagement = context.get("engagement")
        customer = cast(Customer | None, context.get("customer"))
        if customer is None and engagement is not None:
            customer = engagement.customer
        ancestors = (
            customer_path(customer) if customer is not None
            else _collection_path("engagements.engagements_hub")
        )
        if engagement is not None and endpoint.endswith("_edit"):
            ancestors.append(
                link(engagement.title, "engagements.engagement_view", id=engagement.id),
            )
        elif engagement is not None and endpoint.endswith("_view"):
            label = engagement.title
        if endpoint == "engagements.engagement_create":
            label = "New Engagement"
        elif endpoint == "engagements.engagement_edit":
            label = "Edit Engagement"
    elif endpoint == "milestones.milestone_tracker":
        ancestors = _collection_path("milestones.milestones_list")
    elif endpoint.startswith("milestones."):
        milestone = cast(Milestone | None, context.get("milestone"))
        ancestors = (
            _milestone_ancestors(milestone) if milestone is not None
            else _collection_path("milestones.milestones_list")
        )
        if milestone is not None and endpoint.endswith("_edit"):
            ancestors.append(
                link(milestone.display_text, "milestones.milestone_view", id=milestone.id),
            )
    elif endpoint == "opportunities.opportunity_view":
        opportunity = context.get("opportunity")
        ancestors = _opportunity_path(opportunity)[:-1] if opportunity is not None else [home()]
    else:
        workspace = context.get("workspace")
        seller = workspace.seller if workspace is not None else None
        ancestors = (
            seller_path(seller) if seller is not None
            else _collection_path("one_on_one.workspace_hub")
        )
        if seller is not None:
            label = "1:1 Notes"
    return [*ancestors, current(label)]
