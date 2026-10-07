"""Customer directory parity, with all mutations restricted to isolated fixtures."""

from datetime import datetime, timezone

import pytest
from bs4 import BeautifulSoup

from app.models import Customer, Note, Seller, Territory, UserPreference, db


def directory(client):
    """Return the rendered native directory and its complete document."""
    response = client.get("/customers")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-customer-directory]"), soup


def test_frame_controls_assets_and_empty_state(client):
    """Empty directories retain creation, import and scoped sort commands."""
    root, soup = directory(client)
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one(".sb-cust-reading[data-sb-page-body]")
    assert soup.select_one(".sb-page-status")
    assert [el["data-sort"] for el in root.select("button[data-sort]")] == [
        "alphabetical", "grouped", "by_calls",
    ]
    assert root.select_one('a[href="/customer/new"]')
    assert root.select_one('[data-sb-dialog="tpidImportModal"]')
    assert soup.select_one("dialog.sb-dialog#tpidImportModal")
    assert "No customers yet." in root.get_text()
    assert not root.select(".card,.badge,.list-group,[data-bs-toggle]")
    for asset in ("ui-dialog.js", "ui-table-sort.js", "ui-customers-directory.js"):
        assert len(soup.select(f'script[src="/static/js/{asset}"]')) == 1
    assert not root.select("form")


@pytest.mark.parametrize("order", ["alphabetical", "by_calls", "grouped"])
@pytest.mark.parametrize("show_empty", [True, False])
def test_population_defaults_raw_values_and_all_links(client, app, order, show_empty):
    """Server order, note filtering and grouped seller/unassigned scope are unchanged."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.customer_sort_by = order
        pref.customer_view_grouped = False
        pref.show_customers_without_calls = show_empty
        seller = Seller(name="Z seller", seller_type="Growth")
        territory = Territory(name="Exact Territory")
        db.session.add_all([seller, territory])
        db.session.flush()
        entries = [
            Customer(name="B customer", tpid=9000000001, seller=seller,
                     territory=territory, tpid_url="https://example.test/account/B",
                     favicon_b64="ZmF2aWNvbg==", website="untouched.example",
                     stale_since=datetime(2026, 1, 1, tzinfo=timezone.utc)),
            Customer(name="A customer", tpid=2, seller=seller, territory=territory),
            Customer(name="C customer", tpid=31),
        ]
        db.session.add_all(entries)
        db.session.flush()
        db.session.add_all([
            Note(customer=entries[0], content="First note",
                 call_date=datetime(2026, 1, 1)),
            Note(customer=entries[0], content="Second note",
                 call_date=datetime(2026, 1, 2)),
            Note(customer=entries[1], content="Third note",
                 call_date=datetime(2026, 1, 1)),
        ])
        db.session.commit()
        ids = [entry.id for entry in entries]
        seller_id = seller.id
    root, soup = directory(client)
    expected = [ids[1], ids[0], ids[2]] if order != "by_calls" else ids
    if not show_empty:
        expected = [value for value in expected if value != ids[2]]
    assert [int(row["data-customer-id"]) for row in root.select("[data-customer-id]")] == expected
    row = root.select_one(f'[data-customer-id="{ids[0]}"]')
    assert row.select_one('[data-sb-sort-value="9000000001"]')
    assert row.select_one('[data-sb-sort-value="2"]').get_text(strip=True) == "2 notes"
    assert row.select_one('a[href="https://example.test/account/B"]')["target"] == "_blank"
    assert row.select_one(f'a[href="/customer/{ids[0]}"]')
    assert row.select_one(f'a[href="/note/new?customer_id={ids[0]}"]')
    assert row.select_one('img[src="data:image/png;base64,ZmF2aWNvbg=="]')
    assert "Exact Territory" in root.get_text()
    assert root.select_one(f'a[href="/seller/{seller_id}"]')
    assert "Growth" in root.get_text()
    for table in root.select("table"):
        headings = table.select("thead th")
        assert all(heading.has_attr("data-export-label") for heading in headings)
        assert all(heading.has_attr("data-sb-sort-type") for heading in headings[:-1])
        assert not headings[-1].has_attr("data-sb-sort-type")
    assert not root.select("[data-pagination], [data-revenue], [data-stale]")
    if order == "grouped":
        assert root.select_one(f"#sellerGroup{seller_id}[data-seller-key]")
        assert root.select_one("#expandAllBtn") and root.select_one("#collapseAllBtn")
    with app.app_context():
        unchanged = db.session.get(Customer, ids[0])
        assert unchanged.website == "untouched.example"
        assert unchanged.stale_since == datetime(2026, 1, 1)
        assert unchanged.favicon_b64 == "ZmF2aWNvbg=="


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
@pytest.mark.parametrize("show_empty", [True, False])
def test_actual_role_scope_and_group_override(client, app, sample_data, role, show_empty):
    """DSS and SE seller mode keep provider scope and omit redundant seller controls."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.customer_sort_by = "grouped"
        pref.customer_view_grouped = False
        pref.show_customers_without_calls = show_empty
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
    if role == "seller_mode":
        assert client.post(
            f'/api/seller-mode/activate/{sample_data["seller1_id"]}'
        ).status_code == 200
    root, _ = directory(client)
    expected = [sample_data["customer1_id"]]
    if show_empty:
        expected.append(sample_data["customer3_id"])
    if role == "se":
        expected.append(sample_data["customer2_id"])
        assert [int(row["data-customer-id"]) for row in root.select("[data-customer-id]")] == expected
        assert root["data-sort"] == "grouped"
    else:
        assert [int(row["data-customer-id"]) for row in root.select("[data-customer-id]")] == expected
        assert root["data-sort"] == "alphabetical"
        assert not root.select('button[data-sort="grouped"]')
        assert "Seller / type" not in root.get_text()


def test_zero_matches_and_legacy_group_preference(client, app):
    """No-note filtering can produce the same original empty state."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.customer_view_grouped = True
        pref.customer_sort_by = "alphabetical"
        pref.show_customers_without_calls = False
        db.session.add(Customer(name="Hidden no notes", tpid=33))
        db.session.commit()
    root, _ = directory(client)
    assert root["data-sort"] == "grouped"
    assert not root.select("[data-customer-id]")
    assert "No customers yet." in root.get_text()
    assert root.select_one('.sb-cust-empty a[href="/customer/new"]')


def test_import_preview_fields_and_manual_write_contract(client):
    """All original preview and import IDs remain, without automatic lookup or autosave."""
    _, soup = directory(client)
    for id_ in ("tpidInput", "tpidLookupBtn", "tpidImportBtn", "tpidViewBtn",
                "previewName", "previewTpid", "previewWebsite", "previewTerritory",
                "previewSeller", "previewVertical", "tpidError", "tpidImportError",
                "importSuccessMsg", "importSuccessDetails", "tpidModalFooter"):
        assert soup.select_one("#" + id_)
    assert soup.select_one("#tpidInput")["pattern"] == "[0-9]*"
    assert soup.select_one("#tpidImportBtn").has_attr("hidden")
