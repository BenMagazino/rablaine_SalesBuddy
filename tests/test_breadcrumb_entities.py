"""Isolated canonical-path and template regression tests for entity breadcrumbs."""

import ast
from pathlib import Path
import re
from unittest.mock import patch
from urllib.parse import urlsplit

from flask import url_for
import pytest

from app.models import (
    Customer, Engagement, InternalContact, Milestone, Note, OneOnOneWorkspace,
    Opportunity, Partner, POD, Project, Seller, SolutionEngineer, Specialty, Territory, Topic,
)
from app.services.breadcrumb_entities import HANDLED_ENDPOINTS, get_entity_breadcrumbs


_ROOT = Path(__file__).resolve().parents[1]
_ROUTE_MODULES = (
    "customers", "sellers", "territories", "pods", "solution_engineers",
    "internal_contacts", "topics", "notes", "engagements", "milestones",
    "opportunities", "projects", "partners", "one_on_one",
)
_LEGACY_TEMPLATES = (
    "internal_contact_form.html", "partner_form.html", "partner_view.html",
    "specialties_list.html", "specialty_form.html", "specialty_view.html",
    "partials/project_view_content.html", "partials/_engagement_view_content.html",
)


@pytest.fixture
def entity_context():
    """Use transient models with IDs, never live records or a navigation session."""
    seller = Seller(id=11, name="Assigned Seller")
    customer = Customer(id=22, name="Actual Customer", seller=seller)
    opportunity = Opportunity(id=33, name="Cloud Opportunity", customer=customer)
    milestone = Milestone(
        id=44, title="Deployment", customer=customer, opportunity=opportunity,
    )
    pod = POD(id=55, name="North POD")
    return {
        "breadcrumb_title": "Current Page",
        "seller": seller,
        "customer": customer,
        "opportunity": opportunity,
        "milestone": milestone,
        "engagement": Engagement(id=66, title="Data Platform", customer=customer),
        "note": Note(id=77, customer=customer),
        "project": Project(id=88, title="Internal Initiative"),
        "pod": pod,
        "territory": Territory(id=99, name="North Territory", pod=pod),
        "solution_engineer": SolutionEngineer(id=111, name="Engineer"),
        "topic": Topic(id=122, name="Azure Data"),
        "partner": Partner(id=133, name="Delivery Partner"),
        "specialty": Specialty(id=144, name="Migration"),
        "contact": InternalContact(id=155, name="Internal Person"),
        "workspace": OneOnOneWorkspace(id=166, person_name=seller.name, seller=seller),
        "locked_seller": seller,
    }


def _resolve(context, endpoint):
    """Resolve and assert the invariant shared by all entity pages."""
    crumbs = get_entity_breadcrumbs(context, endpoint)
    assert crumbs is not None
    assert crumbs[0].label == "Home"
    assert crumbs[0].url == url_for("main.index")
    assert crumbs[-1].url is None
    assert all(crumb.url for crumb in crumbs[:-1])
    return crumbs


def _rendered_page_templates():
    """Discover literal base-inheriting render calls rather than maintain a second registry."""
    result = {}
    for module in _ROUTE_MODULES:
        tree = ast.parse((_ROOT / "app" / "routes" / f"{module}.py").read_text("utf-8"))
        for function in tree.body:
            if not isinstance(function, ast.FunctionDef):
                continue
            for call in ast.walk(function):
                if not (
                    isinstance(call, ast.Call)
                    and isinstance(call.func, ast.Name)
                    and call.func.id == "render_template"
                    and call.args
                    and isinstance(call.args[0], ast.Constant)
                    and isinstance(call.args[0].value, str)
                ):
                    continue
                template = call.args[0].value
                source = (_ROOT / "templates" / template).read_text("utf-8")
                if re.search(r"""\{%\s*extends\s+['"]base\.html['"]\s*%\}""", source):
                    result[f"{module}.{function.name}"] = template
    return result


def test_declared_endpoint_coverage_matches_actual_pages():
    """All and only actual full-page render endpoints are owned."""
    assert HANDLED_ENDPOINTS == set(_rendered_page_templates())


@pytest.mark.parametrize("endpoint", sorted(HANDLED_ENDPOINTS))
def test_every_entity_page_has_real_links(app, entity_context, endpoint):
    """Full context renders never invent routes or add queries over listed records."""
    with app.test_request_context(), patch(
        "app.services.breadcrumb_entities.db.session.get",
        side_effect=AssertionError("Supplied objects must not be reloaded"),
    ):
        crumbs = _resolve(entity_context, endpoint)
        adapter = app.url_map.bind("localhost")
        for crumb in crumbs[:-1]:
            adapter.match(urlsplit(crumb.url).path, method="GET")


@pytest.mark.parametrize("editing", [False, True])
def test_customer_assignment_hierarchy(app, entity_context, editing):
    """Customer ancestry uses its assigned seller rather than arbitrary context or history."""
    entity_context["seller"] = Seller(id=999, name="Unrelated Seller")
    entity_context["breadcrumb_title"] = "Edit Customer" if editing else "Actual Customer"
    endpoint = "customers.customer_edit" if editing else "customers.customer_view"
    with app.test_request_context(
        headers={"Referer": "http://localhost/partner/999"},
    ):
        crumbs = _resolve(entity_context, endpoint)
        assert [(crumb.label, crumb.url) for crumb in crumbs] == [
            ("Home", url_for("main.index")),
            ("Assigned Seller", url_for("sellers.seller_view", id=11)),
            *(
                [("Actual Customer", url_for("customers.customer_view", id=22))]
                if editing else []
            ),
            (entity_context["breadcrumb_title"], None),
        ]


@pytest.mark.parametrize("editing", [False, True])
def test_unassigned_customer_omits_missing_seller(app, entity_context, editing):
    """An unassigned customer must not acquire a fake seller breadcrumb."""
    entity_context["customer"].seller = None
    endpoint = "customers.customer_edit" if editing else "customers.customer_view"
    with app.test_request_context():
        crumbs = _resolve(entity_context, endpoint)
        assert [crumb.label for crumb in crumbs] == (
            ["Home", "Actual Customer", "Current Page"] if editing
            else ["Home", "Current Page"]
        )
        assert not any("/seller/" in (crumb.url or "") for crumb in crumbs)


@pytest.mark.parametrize("selected", [11, "11", None, 999])
def test_customer_create_uses_supplied_selected_seller(app, selected):
    """Preselection is resolved in supplied options; invalid IDs use the real collection."""
    context = {
        "breadcrumb_title": "New Customer", "customer": None,
        "sellers": [Seller(id=11, name="Assigned Seller")],
        "preselect_seller_id": selected,
    }
    with app.test_request_context(), patch(
        "app.services.breadcrumb_entities.db.session.get",
        side_effect=AssertionError("Seller options are already available"),
    ):
        crumbs = _resolve(context, "customers.customer_create")
        assert crumbs[1].url == (
            url_for("sellers.seller_view", id=11) if selected in (11, "11")
            else url_for("customers.customers_list")
        )
        assert crumbs[-1].label == "New Customer"


@pytest.mark.parametrize(
    ("endpoint", "record_key", "collection", "view", "label_attribute"),
    [
        ("pods.pod_edit", "pod", "pods.pods_list", "pods.pod_view", "name"),
        (
            "solution_engineers.solution_engineer_edit", "solution_engineer",
            "solution_engineers.solution_engineers_list",
            "solution_engineers.solution_engineer_view", "name",
        ),
        ("topics.topic_edit", "topic", "topics.topics_list", "topics.topic_view", "name"),
        (
            "partners.partner_edit", "partner", "partners.partners_list",
            "partners.partner_view", "name",
        ),
        (
            "partners.specialty_edit", "specialty", "partners.specialties_list",
            "partners.specialty_view", "name",
        ),
        (
            "projects.project_edit", "project", "engagements.engagements_hub",
            "projects.project_view", "title",
        ),
    ],
)
def test_edit_forms_link_the_existing_record(
    app, entity_context, endpoint, record_key, collection, view, label_attribute,
):
    """Edit pages link the record and its actual landing page without changing the form."""
    record = entity_context[record_key]
    with app.test_request_context():
        crumbs = _resolve(entity_context, endpoint)
        assert crumbs[-2].label == getattr(record, label_attribute)
        assert crumbs[-2].url == url_for(view, id=record.id)
        assert crumbs[-3].url == url_for(collection)
        assert crumbs[-1].label == "Current Page"


@pytest.mark.parametrize(("endpoint", "key", "attribute"), [
    ("engagements.engagement_view", "engagement", "title"),
    ("partners.partner_view", "partner", "name"),
    ("partners.specialty_view", "specialty", "name"),
    ("projects.project_view", "project", "title"),
])
def test_record_current_labels_do_not_repeat_window_title_ancestry(
    app, entity_context, endpoint, key, attribute,
):
    """Window-title context is not duplicated in the last breadcrumb."""
    entity_context["breadcrumb_title"] = "Record Name - Redundant Parent Section"
    with app.test_request_context():
        crumbs = _resolve(entity_context, endpoint)
    assert crumbs[-1].label == getattr(entity_context[key], attribute)


@pytest.mark.parametrize(
    ("endpoint", "key", "collection"),
    [
        ("sellers.seller_create", "seller", "sellers.sellers_list"),
        ("territories.territory_create", "territory", "territories.territories_list"),
        ("topics.topic_create", "topic", "topics.topics_list"),
        ("partners.partner_new", "partner", "partners.partners_list"),
        ("partners.specialty_new", "specialty", "partners.specialties_list"),
        ("projects.project_create", "project", "engagements.engagements_hub"),
        ("milestones.milestone_create", "milestone", "milestones.milestones_list"),
    ],
)
def test_create_forms_use_real_collections(app, endpoint, key, collection):
    """Create forms do not emit record links with None IDs or invented category URLs."""
    with app.test_request_context():
        crumbs = _resolve({"breadcrumb_title": "New Record", key: None}, endpoint)
        assert crumbs[-2].url == url_for(collection)
        assert crumbs[-1].label == "New Record"


@pytest.mark.parametrize(
    ("endpoint", "parent_key"),
    [
        ("notes.note_view", "note"),
        ("notes.note_edit", "note"),
        ("engagements.engagement_create", "engagement"),
        ("engagements.engagement_view", "engagement"),
        ("engagements.engagement_edit", "engagement"),
        ("opportunities.opportunity_view", "opportunity"),
    ],
)
def test_customer_owned_work_uses_customer_path(app, entity_context, endpoint, parent_key):
    """Notes, engagements and opportunities share actual seller/customer hub ancestry."""
    context = {
        "breadcrumb_title": "Work Page", parent_key: entity_context[parent_key],
    }
    if endpoint == "engagements.engagement_create":
        context["engagement"] = None
        context["customer"] = entity_context["customer"]
    with app.test_request_context():
        crumbs = _resolve(context, endpoint)
        assert [crumb.url for crumb in crumbs[:3]] == [
            url_for("main.index"), url_for("sellers.seller_view", id=11),
            url_for("customers.customer_view", id=22),
        ]


@pytest.mark.parametrize("editing", [False, True])
def test_milestone_uses_real_opportunity_parent(app, entity_context, editing):
    """A linked milestone follows the real opportunity, not the cached opportunity name."""
    milestone = entity_context["milestone"]
    milestone.opportunity_name = "Old cached name"
    endpoint = "milestones.milestone_edit" if editing else "milestones.milestone_view"
    with app.test_request_context():
        crumbs = _resolve(entity_context, endpoint)
        assert [crumb.label for crumb in crumbs] == [
            "Home", "Assigned Seller", "Actual Customer", "Cloud Opportunity",
            *(["Deployment"] if editing else []), "Current Page",
        ]
        assert crumbs[3].url == url_for("opportunities.opportunity_view", id=33)
        if editing:
            assert crumbs[-2].url == url_for("milestones.milestone_view", id=44)


def test_milestone_can_use_opportunity_customer_when_its_customer_is_missing(app, entity_context):
    """An optional milestone customer can be recovered from its linked opportunity."""
    entity_context["milestone"].customer = None
    with app.test_request_context():
        crumbs = _resolve(entity_context, "milestones.milestone_view")
        assert [crumb.label for crumb in crumbs[:4]] == [
            "Home", "Assigned Seller", "Actual Customer", "Cloud Opportunity",
        ]


@pytest.mark.parametrize(
    ("endpoint", "key", "expected"),
    [
        ("notes.note_view", "note", ["Home", "Notes", "Current Page"]),
        ("notes.note_edit", "note", ["Home", "Notes", "Note", "Current Page"]),
        ("opportunities.opportunity_view", "opportunity", ["Home", "Current Page"]),
        ("milestones.milestone_view", "milestone", ["Home", "Milestones", "Current Page"]),
        (
            "milestones.milestone_edit", "milestone",
            ["Home", "Milestones", "Deployment", "Current Page"],
        ),
        (
            "territories.territory_view", "territory",
            ["Home", "Territories", "Current Page"],
        ),
        (
            "one_on_one.workspace_view", "workspace",
            ["Home", "1:1 Workspaces", "Current Page"],
        ),
    ],
)
def test_optional_parent_fallbacks(app, entity_context, endpoint, key, expected):
    """Missing optional ownership does not produce broken or fictitious ancestors."""
    record = entity_context[key]
    if key == "territory":
        record.pod = None
    elif key == "workspace":
        record.seller = None
    else:
        record.customer = None
        if key == "milestone":
            record.opportunity = None
    with app.test_request_context():
        assert [crumb.label for crumb in _resolve(entity_context, endpoint)] == expected


def test_single_pod_and_seller_workspace_are_canonical_parents(app, entity_context):
    """Only unambiguous ownership relationships become breadcrumb parents."""
    with app.test_request_context():
        territory = _resolve(entity_context, "territories.territory_edit")
        assert [crumb.label for crumb in territory] == [
            "Home", "PODs", "North POD", "North Territory", "Current Page",
        ]
        workspace = _resolve(entity_context, "one_on_one.workspace_view")
        assert [crumb.label for crumb in workspace] == [
            "Home", "Assigned Seller", "1:1 Notes",
        ]
        tracker = _resolve(entity_context, "milestones.milestone_tracker")
        assert tracker[1].url == url_for("milestones.milestones_list")


@pytest.mark.parametrize(("endpoint", "label"), [
    ("engagements.engagement_create", "New Engagement"),
    ("engagements.engagement_edit", "Edit Engagement"),
])
def test_engagement_form_labels_do_not_repeat_customer(
    app, entity_context, endpoint, label,
):
    """Window titles include the customer, but the trail already supplies that parent."""
    entity_context["breadcrumb_title"] = f"{label} - Actual Customer"
    with app.test_request_context():
        crumbs = _resolve(entity_context, endpoint)
    assert crumbs[-1].label == label


def test_collection_label_matches_its_canonical_ancestor_label(app, entity_context):
    """A collection does not change names between its own trail and a child's trail."""
    with app.test_request_context():
        hub = _resolve(entity_context, "one_on_one.workspace_hub")
        entity_context["workspace"].seller = None
        child = _resolve(entity_context, "one_on_one.workspace_view")
    assert hub[-1].label == child[-2].label == "1:1 Workspaces"


@pytest.mark.parametrize("locked", [True, False])
def test_tracker_ancestry_does_not_change_with_seller_scope(app, entity_context, locked):
    """Filtering a shared tool does not turn the active seller into its parent."""
    if not locked:
        entity_context["locked_seller"] = None
    with app.test_request_context():
        crumbs = _resolve(entity_context, "milestones.milestone_tracker")
    assert [crumb.label for crumb in crumbs] == ["Home", "Milestones", "Current Page"]


def test_milestone_opportunity_ancestor_keeps_its_own_customer(app, entity_context):
    """An opportunity's canonical ancestry is not rewritten by a child's stale assignment."""
    entity_context["milestone"].customer = Customer(id=999, name="Different Customer")
    with app.test_request_context():
        crumbs = _resolve(entity_context, "milestones.milestone_view")
    assert [crumb.label for crumb in crumbs[:4]] == [
        "Home", "Assigned Seller", "Actual Customer", "Cloud Opportunity",
    ]


@pytest.mark.parametrize(
    ("key", "collection", "expected_label", "expected_view"),
    [
        ("engagement", None, "Data Platform", "engagements.engagement_view"),
        ("milestone", None, "Deployment", "milestones.milestone_view"),
        ("customer", "customers", "Actual Customer", "customers.customer_view"),
        ("project", "active_projects", "Internal Initiative", "projects.project_view"),
        ("topic", "topics", "Azure Data", "topics.topic_view"),
    ],
)
def test_new_note_uses_explicit_supplied_parent(
    app, entity_context, key, collection, expected_label, expected_view,
):
    """Selected note parents reuse context objects and supplied option collections."""
    record = entity_context[key]
    context = {"breadcrumb_title": "New Note", f"preselect_{key}_id": record.id}
    if collection:
        context[collection] = [record]
    else:
        context[f"preselect_{key}"] = record
    with app.test_request_context(), patch(
        "app.services.breadcrumb_entities.db.session.get",
        side_effect=AssertionError("Selected parent is already supplied"),
    ):
        crumbs = _resolve(context, "notes.note_create")
        assert crumbs[-2].label == expected_label
        assert crumbs[-2].url == url_for(expected_view, id=record.id)


@pytest.mark.parametrize("key", ["engagement", "milestone"])
def test_new_note_id_only_parent_uses_one_eager_read(app, entity_context, key):
    """The two ID-only form parents require one scalar read with eager ownership options."""
    record = entity_context[key]
    context = {"breadcrumb_title": "New Note", f"preselect_{key}_id": str(record.id)}
    with app.test_request_context(), patch(
        "app.services.breadcrumb_entities.db.session.get", return_value=record,
    ) as get_record:
        crumbs = _resolve(context, "notes.note_create")
        get_record.assert_called_once()
        assert get_record.call_args.args[1] == record.id
        assert get_record.call_args.kwargs["options"]
        assert crumbs[-2].url == url_for(
            f"{key}s.{key}_view", id=record.id,
        )


@pytest.mark.parametrize("selected", [999, "invalid"])
def test_invalid_note_preselection_falls_back_to_notes(app, selected):
    """Invalid or stale work IDs do not invent a linked parent."""
    context = {"breadcrumb_title": "New Note", "preselect_engagement_id": selected}
    with app.test_request_context(), patch(
        "app.services.breadcrumb_entities.db.session.get", return_value=None,
    ):
        assert [crumb.label for crumb in _resolve(context, "notes.note_create")] == [
            "Home", "Notes", "New Note",
        ]


def test_internal_contacts_without_detail_route_use_literal_edit_label(app, entity_context):
    """Contacts have no detail page or title block; use their real list and edit label."""
    with app.test_request_context():
        crumbs = _resolve(entity_context, "internal_contacts.internal_contact_edit")
        assert [crumb.label for crumb in crumbs] == [
            "Home", "Internal Contacts", "Edit Internal Person",
        ]
        assert crumbs[-2].url == url_for("internal_contacts.internal_contacts_list")


def test_model_labels_are_escaped_by_shared_template(app, entity_context):
    """Ancestor names and current titles render as text, including HTML-like model names."""
    entity_context["customer"].seller.name = '<img src=x onerror="bad()">'
    entity_context["customer"].name = "A & B <script>bad()</script>"
    entity_context["breadcrumb_title"] = '<b title="unsafe">Edit Customer</b>'
    with app.test_request_context():
        crumbs = _resolve(entity_context, "customers.customer_edit")
        template = app.jinja_env.get_template("partials/_breadcrumbs.html")
        html = template.render(page_breadcrumbs=crumbs)
    assert "<img" not in html
    assert "<script>" not in html
    assert '<b title="unsafe">' not in html
    assert "&lt;img" in html
    assert "A &amp; B &lt;script&gt;" in html
    assert "&lt;b title=&#34;unsafe&#34;&gt;" in html
    assert html.count('aria-current="page"') == 1


def test_owned_templates_have_no_inline_duplicate_breadcrumbs():
    """The central base renderer is the only breadcrumb nav for full entity pages."""
    templates = set(_rendered_page_templates().values()) | set(_LEGACY_TEMPLATES)
    for template in templates:
        source = (_ROOT / "templates" / template).read_text("utf-8")
        assert not re.search(
            r"""<nav\b[^>]*aria-label\s*=\s*['"]breadcrumb['"]""", source, re.IGNORECASE,
        ), template
        assert not re.search(
            r"""<ol\b[^>]*class\s*=\s*['"][^'"]*\bbreadcrumb\b""", source, re.IGNORECASE,
        ), template


@pytest.mark.parametrize(
    "endpoint",
    [
        "notes.note_detail_fragment", "engagements.engagement_detail_fragment",
        "milestones.milestone_detail_fragment", "opportunities.opportunity_detail_fragment",
        "projects.project_detail", "one_on_one.seller_workspace_fragment",
        "customers.customer_update_csam", "partners.partner_delete",
        "one_on_one.workspace_create", "reports.reports_hub", "revenue.revenue_dashboard",
    ],
)
def test_unowned_write_api_and_fragment_endpoints_return_none(endpoint):
    """Do not claim ownership of fragment renders, writes or another domain's pages."""
    assert get_entity_breadcrumbs({}, endpoint) is None
