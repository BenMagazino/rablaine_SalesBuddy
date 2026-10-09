"""Seller directory parity with isolated seller/customer populations and role changes."""

from datetime import datetime
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from flask import Flask

from app.models import Customer, Note, Seller, Territory, UserPreference, db


def directory(client):
    """Return the complete native seller directory response."""
    response = client.get("/sellers")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-sellers-directory]"), soup


def test_empty_directory_frame_and_commands(client):
    """Empty populations keep the original creation destinations and shared assets."""
    root, soup = directory(client)
    assert "sb-page-frame" in soup.body["class"]
    assert "sb-directory-frame" in root["class"]
    assert root.select_one("[data-sb-page-body]")
    assert soup.select_one(".sb-page-status")
    assert root.select_one('#toggleAllBtn[aria-expanded="false"]')
    assert len(root.select('a[href="/seller/new"]')) == 2
    assert "No sellers yet." in root.get_text()
    assert "0 sellers" in soup.select_one(".sb-page-status").get_text()
    assert not root.select(".badge,.card,.list-group,[onclick],[data-bs-toggle]")
    for filename in ("ui-sellers-directory.js", "ui-table-sort.js"):
        assert len(soup.select(f'script[src="/static/js/{filename}"]')) == 1


def test_summary_reserves_identity_and_coverage_columns(app: Flask) -> None:
    """Missing emails cannot shift the shared territory column or other summary fields."""
    css = Path(app.root_path).parent.joinpath(
        "static", "css", "ui-sellers-directory.css",
    ).read_text(encoding="utf-8")
    assert 'grid-template-areas: "disclosure name email territories count action"' in css
    assert "grid-template-columns: 10px 160px 200px minmax(0, 1fr)" in css
    for area in ("disclosure", "name", "email", "territories", "count", "action"):
        assert f"grid-area: {area};" in css


def test_bounded_directory_frame_is_explicitly_opted_in(app: Flask) -> None:
    """Directory width limits do not implicitly constrain other workbench surfaces."""
    css = Path(app.root_path).parent.joinpath(
        "static", "css", "ui-page-frame.css",
    ).read_text(encoding="utf-8")
    assert "#main-content > [data-sb-page-surface].sb-directory-frame {" in css
    assert "max-width: 1152px;" in css
    assert "margin-inline: auto;" in css


def test_directory_inherits_the_shared_gutter_background(app: Flask) -> None:
    """Use the shared canvas without a Sellers-specific gutter override."""
    css = Path(app.root_path).parent.joinpath(
        "static", "css", "ui-sellers-directory.css",
    ).read_text(encoding="utf-8")
    assert "#main-content" not in css
    frame = Path(app.root_path).parent.joinpath(
        "static", "css", "ui-page-frame.css",
    ).read_text(encoding="utf-8")
    gutter = frame.split(".sb-page-frame #main-content {", 1)[1].split("}", 1)[0]
    assert "background: var(--sb-ui-canvas);" in gutter
    surface = frame.split(
        ".sb-page-frame #main-content > [data-sb-page-surface] {", 1,
    )[1].split("}", 1)[0]
    assert "background: var(--sb-ui-surface);" in surface


def test_population_type_order_identity_and_latest_notes(app, client):
    """Preserve all sellers, alphabetical display-name customers and latest local notes."""
    with app.app_context():
        first = Seller(name="A Growth", alias="exact.alias", seller_type="Growth")
        second = Seller(name="Z Growth", seller_type="Growth")
        acquisition = Seller(name="B Acquisition", seller_type="Acquisition")
        unspecified = Seller(name="C unspecified", seller_type="Other")
        territories = [Territory(name="Z Territory"), Territory(name="A Territory")]
        first.territories = territories
        db.session.add_all([first, second, acquisition, unspecified])
        db.session.flush()
        customers = [
            Customer(name="Z legal name", nickname="A display", tpid=101,
                     seller=first, favicon_b64="ZmF2aWNvbg=="),
            Customer(name="B display", tpid=102, seller=first),
        ]
        db.session.add_all(customers)
        db.session.flush()
        db.session.add_all([
            Note(customer=customers[0], content="Older", call_date=datetime(2025, 12, 31)),
            Note(customer=customers[0], content="Latest", call_date=datetime(2026, 1, 3)),
        ])
        db.session.commit()
        seller_ids = [first.id, second.id, acquisition.id, unspecified.id]
        customer_ids = [customer.id for customer in customers]
        territory_ids = [territory.id for territory in territories]
    root, soup = directory(client)
    assert [int(item["data-seller-id"]) for item in root.select("details")] == seller_ids
    record = root.select_one(f'[data-seller-id="{seller_ids[0]}"]')
    assert "exact.alias@microsoft.com" in record.get_text()
    assert [item.get_text(strip=True) for item in record.select(".sb-seller-territory")] == [
        "A Territory", "Z Territory",
    ]
    assert record.select_one(f'a[href="/seller/{seller_ids[0]}"]')
    for id_ in territory_ids:
        assert record.select_one(f'a[href="/territory/{id_}"]')
    rows = record.select("[data-customer-id]")
    assert [int(row["data-customer-id"]) for row in rows] == customer_ids
    assert rows[0].select_one(f'a[href="/customer/{customer_ids[0]}"]')
    assert rows[0].select_one('img[src="data:image/png;base64,ZmF2aWNvbg=="]')
    assert rows[0].select_one('[data-sb-sort-value="2026-01-03"]').get_text() == "Jan 03"
    assert rows[1].select_one('[data-sb-sort-value=""]').get_text() == "No notes"
    assert "2 customers" in record.select_one("summary").get_text()
    assert "No customers assigned" in root.get_text()
    assert len(root.select("[data-view-as]")) == 4
    assert "4 sellers" in soup.select_one(".sb-page-status").get_text()
    for table in root.select("table"):
        assert [th["data-sb-sort-type"] for th in table.select("th")] == ["text", "date"]
        assert [th["data-export-label"] for th in table.select("th")] == ["Name", "Latest note"]
    assert not root.select("summary[data-sb-sort-type]")


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_full_population_and_original_view_as_visibility(app, client, sample_data, role):
    """Directory remains org-wide while View as follows the original seller-mode condition."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        count = Seller.query.count()
    if role == "seller_mode":
        result = client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
        assert result.json["seller_mode"] is True
        assert result.json["seller_id"] == sample_data["seller1_id"]
    root, _ = directory(client)
    assert len(root.select("details[data-seller-id]")) == count
    assert len(root.select("[data-view-as]")) == (count if role == "se" else 0)
