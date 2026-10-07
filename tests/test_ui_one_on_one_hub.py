"""The native 1:1 hub preserves workspace contents, counts and explicit quick starts."""

from datetime import datetime, timedelta, timezone

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient

from app.models import OneOnOneAgendaItem, OneOnOneWorkspace, Seller, db


@pytest.fixture
def hub_records(app: Flask) -> dict[str, int]:
    """Seed isolated seller, manager and other workspaces with distinct queue counts."""
    now = datetime.now(timezone.utc)
    with app.app_context():
        seller = Seller(name="Hub Seller")
        available = Seller(name="Available Seller")
        db.session.add_all([seller, available])
        db.session.flush()
        seller_workspace = OneOnOneWorkspace(
            person_name=seller.name, person_type="Seller", seller_id=seller.id,
            notes="<p><strong>Standing</strong> context.</p>",
            updated_at=now - timedelta(days=3),
        )
        manager = OneOnOneWorkspace(
            person_name="Hub Manager", person_type="Manager", updated_at=now,
        )
        other = OneOnOneWorkspace(
            person_name="Hub Other", person_type="Other",
            notes="Long context " * 30, updated_at=now - timedelta(days=8),
        )
        db.session.add_all([seller_workspace, manager, other])
        db.session.flush()
        db.session.add_all([
            OneOnOneAgendaItem(
                workspace=seller_workspace, item_type="milestone",
                title_snapshot="First queued item", status="active",
            ),
            OneOnOneAgendaItem(
                workspace=seller_workspace, item_type="engagement",
                title_snapshot="Second queued item", status="active",
            ),
            OneOnOneAgendaItem(
                workspace=seller_workspace, item_type="milestone",
                title_snapshot="Discussed item", status="discussed", discussed_at=now,
            ),
        ])
        db.session.commit()
        return {"seller": seller_workspace.id, "manager": manager.id, "other": other.id,
                "available": available.id, "linked_seller": seller.id}


@pytest.mark.parametrize("embedded", [False, True])
def test_native_hub_contract(
    client: FlaskClient, hub_records: dict[str, int], embedded: bool,
) -> None:
    """Both surfaces retain the sorted provider population and all six sortable columns."""
    response = client.get("/one-on-one/", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(".sb-one-on-one-hub")
    assert root["data-embedded"] == str(embedded).lower()
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select("body > footer.sb-page-status")) is not embedded
    assert not root.select(".card, .btn, .badge, .form-control, [data-bs-toggle]")
    table = root.select_one("#workspaceList[data-sb-sortable]")
    assert [header["data-sb-sort-type"] for header in table.select("th")] == [
        "text", "text", "text", "number", "number", "date",
    ]
    assert not table.has_attr("data-sb-sort-default-column")
    assert [row["data-workspace-id"] for row in table.select("tbody tr")] == [
        str(hub_records[key]) for key in ["manager", "seller", "other"]
    ]
    assert len(soup.select("script[src$='ui-table-sort.js']")) == 1
    assert soup.select_one("script[src$='ui-one-on-one-hub.js']")


def test_preview_counts_and_all_cell_destinations(
    client: FlaskClient, hub_records: dict[str, int],
) -> None:
    """Keep stripped/truncated previews, queue counts and native link behavior on every cell."""
    soup = BeautifulSoup(client.get("/one-on-one/").data, "html.parser")
    seller = soup.select_one(f"[data-workspace-id='{hub_records['seller']}']")
    assert seller.select_one(".workspace-preview").text == "Standing context."
    assert seller.select_one("td:nth-child(4)")["data-sb-sort-value"] == "2"
    assert seller.select_one("td:nth-child(5)")["data-sb-sort-value"] == "1"
    assert seller.select_one(".hub-person.is-seller .bi-person")
    assert seller.select_one(".hub-kind").text == "Seller"
    assert seller.select_one("td:nth-child(6)")["data-sb-sort-value"]
    for row in soup.select("#workspaceList tbody tr"):
        links = row.select("td > a")
        assert len(links) == 6
        assert {link["href"] for link in links} == {
            f"/one-on-one/{row['data-workspace-id']}",
        }
        assert not links[0].has_attr("tabindex")
        assert all(link["tabindex"] == "-1" for link in links[1:])
    other = soup.select_one(f"[data-workspace-id='{hub_records['other']}'] .workspace-preview")
    assert len(other.text) <= 180 and other.text.endswith("...")
    assert soup.select_one("footer.sb-page-status span").text.strip() == (
        "3 workspaces · 2 queued · 1 discussed"
    )


def test_quick_start_fields_and_read_only_listing(
    client: FlaskClient, app: Flask, hub_records: dict[str, int],
) -> None:
    """Rendering never creates a workspace; quick starts retain their original actions."""
    soup = BeautifulSoup(client.get("/one-on-one/").data, "html.parser")
    sellers = soup.select("#sellerLaunchList a")
    assert [link["href"] for link in sellers] == [
        f"/seller/{hub_records['available']}/one-on-one",
    ]
    assert sellers[0]["data-seller-name"] == "available seller"
    assert soup.select_one("#sellerWorkspaceFilter")["type"] == "search"
    assert soup.select_one("#hubSellerEmpty[hidden]")
    form = soup.select_one(".hub-launcher form")
    assert form["method"] == "post" and form["action"] == "/one-on-one/new"
    assert [option["value"] for option in form.select("[name='person_type'] option")] == [
        "Manager", "Other",
    ]
    name = form.select_one("[name='person_name']")
    assert name.has_attr("required") and name["maxlength"] == "200"
    with app.app_context():
        assert OneOnOneWorkspace.query.count() == 3
        assert OneOnOneAgendaItem.query.count() == 3


def test_empty_hub_keeps_explicit_creation(client: FlaskClient) -> None:
    """Empty workspaces and available sellers retain their existing meaningful messages."""
    soup = BeautifulSoup(client.get("/one-on-one/").data, "html.parser")
    assert soup.select_one(".hub-empty h3").text == "No workspaces yet"
    assert not soup.select("#workspaceList")
    assert "Every seller already has a workspace." in soup.get_text()
    assert soup.select_one("form button[type='submit']").text == "Create"
