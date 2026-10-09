"""Territory directory parity using isolated associations and role populations."""

import pytest
from bs4 import BeautifulSoup

from app.models import Customer, POD, Seller, Territory, UserPreference, db


def directory(client):
    """Render the original org-wide provider into the native directory."""
    response = client.get("/territories")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    return soup.select_one("[data-territories-directory]"), soup


def test_empty_directory_commands_and_frame(client):
    """Empty directories keep creation links and shared helpers load exactly once."""
    root, soup = directory(client)
    assert 'sb-directory-frame' in root['class']
    assert "sb-page-frame" in soup.body["class"]
    assert root.select_one("[data-sb-page-body]")
    assert "No territories yet." in root.get_text()
    assert len(root.select('a[href="/territory/new"]')) == 2
    assert "0 territories" in soup.select_one(".sb-page-status").get_text()
    assert not root.select(".card,.badge,.list-group,[onclick],[data-bs-toggle]")
    for name in ("ui-territories-directory.js", "ui-table-sort.js"):
        assert len(soup.select(f'script[src="/static/js/{name}"]')) == 1


def test_complete_rows_order_links_and_direct_customer_counts(app, client):
    """Preserve seller-name order, optional POD and direct territory customer scope."""
    with app.app_context():
        pod = POD(name="A POD")
        first = Territory(name="A Territory", pod=pod)
        last = Territory(name="Z Territory")
        sellers = [Seller(name="Z Seller"), Seller(name="A Seller")]
        first.sellers = sellers
        db.session.add_all([last, first])
        db.session.flush()
        db.session.add_all([
            Customer(name="Direct", tpid=1, territory=first),
            Customer(name="Seller only", tpid=2, seller=sellers[0]),
        ])
        db.session.commit()
        first_id, last_id, pod_id = first.id, last.id, pod.id
        seller_ids = [seller.id for seller in sellers]
    root, soup = directory(client)
    assert [int(row["data-territory-id"]) for row in root.select("tbody tr")] == [
        first_id, last_id,
    ]
    row = root.select_one(f'[data-territory-id="{first_id}"]')
    assert row["data-territory-href"] == f"/territory/{first_id}"
    assert row.select_one(f'a[href="/territory/{first_id}"]')["aria-label"] == (
        "View A Territory"
    )
    assert row.select_one(f'a[href="/pod/{pod_id}"]')
    assert [link.get_text(strip=True) for link in row.select(".sb-territory-seller")] == [
        "A Seller", "Z Seller",
    ]
    for id_ in seller_ids:
        assert row.select_one(f'a[href="/seller/{id_}"]')
    assert row.select_one(".sb-territory-count")["data-sb-sort-value"] == "1"
    assert row.select_one(".sb-territory-count").get_text() == "1 customers"
    for id_ in (first_id, last_id):
        assert root.select_one(f'a[href="/customer/new?territory_id={id_}"]')
    empty = root.select_one(f'[data-territory-id="{last_id}"]')
    assert empty.select_one("td:nth-child(2)")["data-sb-sort-value"] == ""
    assert "No sellers" in empty.get_text()
    assert empty.select_one(".sb-territory-count").get_text() == "0 customers"
    headers = root.select("th[data-sb-sort-type]")
    assert [header["data-sb-sort-type"] for header in headers] == [
        "text", "text", "text", "number",
    ]
    assert [header["data-export-label"] for header in headers] == [
        "Name", "POD", "Sellers", "Customers",
    ]
    assert not root.select_one("th:last-child").has_attr("data-sb-sort-type")
    assert not root.select_one("table").has_attr("data-sb-sort-default-column")
    assert "2 territories" in soup.select_one(".sb-page-status").get_text()


@pytest.mark.parametrize("role", ["se", "dss", "seller_mode"])
def test_org_wide_scope_unchanged_in_each_role(app, client, sample_data, role):
    """Directory population is independent of personal seller and impersonation scope."""
    with app.app_context():
        pref = UserPreference.query.first()
        pref.user_role = "dss" if role == "dss" else "se"
        pref.my_seller_id = sample_data["seller1_id"]
        db.session.commit()
        count = Territory.query.count()
    if role == "seller_mode":
        client.post(f'/api/seller-mode/activate/{sample_data["seller1_id"]}')
    root, _ = directory(client)
    assert len(root.select("[data-territory-id]")) == count
    assert len(root.select('a[href^="/customer/new?territory_id="]')) == count
