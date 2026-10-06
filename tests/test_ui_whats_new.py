"""What's New retains provider semantics in its native activity workbench."""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient

from app.models import Milestone, MilestoneAudit, db


@pytest.fixture
def activity(app: Flask, sample_data: dict) -> dict:
    """Create isolated records covering MSX precedence, local fallback and overlap."""
    now = datetime.now(timezone.utc)
    old = now - timedelta(days=100)
    recent = now - timedelta(hours=2)
    with app.app_context():
        def add(name: str, **values: object) -> Milestone:
            """Add a milestone with stable source and export metadata."""
            milestone = Milestone(
                title=name, url=f"https://example.com/{name}", msx_milestone_id=name,
                customer_id=sample_data["customer1_id"], workload=" Data : SQL ",
                monthly_usage=1234.567, msx_status="On Track", **values,
            )
            db.session.add(milestone)
            return milestone

        created = add("MSX-created", msx_created_on=recent, msx_modified_on=recent,
                      created_at=old, updated_at=recent)
        updated = add("MSX-updated", msx_created_on=old, msx_modified_on=recent,
                      created_at=recent, updated_at=recent, on_my_team=True)
        overlap = add("Missing-created-date", msx_modified_on=recent,
                      created_at=recent, updated_at=recent)
        local = add("Local-created", created_at=recent, updated_at=recent)
        fallback = add("Local-updated", msx_created_on=old, created_at=old, updated_at=recent)
        stale = add("MSX-precedence", msx_created_on=old, msx_modified_on=old,
                    created_at=recent, updated_at=recent)
        db.session.flush()
        db.session.add_all([
            MilestoneAudit(milestone_id=updated.id, audit_id="title-older", field_name="msp_name",
                           changed_on=old),
            MilestoneAudit(milestone_id=updated.id, audit_id="title-latest", field_name="msp_name",
                           changed_on=now - timedelta(days=30)),
            MilestoneAudit(milestone_id=updated.id, audit_id="acr", field_name="msp_monthlyuse",
                           changed_on=recent),
            Milestone(url="https://example.com/orphan", title="Orphan", created_at=recent),
        ])
        db.session.commit()
        return {"created": {created.id, overlap.id, local.id},
                "updated": {updated.id, overlap.id, fallback.id}, "updated_id": updated.id,
                "stale_id": stale.id, "title_date": (now - timedelta(days=30)).strftime(
                    "%Y-%m-%dT%H:%M:%S")}


@pytest.mark.parametrize("embedded", [False, True])
def test_whats_new_native_contract(
    client: FlaskClient, activity: dict, embedded: bool,
) -> None:
    """Both lists retain five sortable data columns and unbranded native controls."""
    response = client.get("/reports/whats-new", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-whats-new]")
    assert root["data-embedded"] == str(embedded).lower()
    assert root["data-days"] == "14"
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-page-status")) is not embedded
    assert not root.select(".card, .btn, .badge, [data-bs-toggle], .dropdown-menu")
    assert len(root.select(".sb-whats-new-reading[tabindex='0']")) == 2
    assert [option["value"] for option in root.select("#daysFilter option")] == [
        "1", "3", "7", "14", "30", "60", "90",
    ]
    assert root.select_one('#daysFilter option[value="1"]').text == "Last 24 hours"
    for table in root.select(".sb-whats-new-table"):
        assert [th["data-sb-sort-type"] for th in table.select("th")] == [
            "text", "text", "number", "date", "number",
        ]
        assert all(len(row.select("td")) == 5 for row in table.select(".data-row"))
        assert [row["data-source-order"] for row in table.select(".data-row")] == [
            str(index) for index in range(len(table.select(".data-row")))
        ]
        assert all(cell.has_attr("data-sb-sort-value") for cell in table.select("tbody td"))
    assert root.select_one("dialog.sb-dialog")
    assert ".sb-whats-new-table[data-export-visible=true]" in response.get_data(as_text=True)
    assert r'const CUSTOM_TITLE = "What\u0027s New";' in response.get_data(as_text=True)
    assert soup.select_one('script[src$="/ui-whats-new.js"]')


def test_whats_new_provider_precedence_overlap_audits_and_precision(
    client: FlaskClient, activity: dict,
) -> None:
    """Creation/updates, all-history audits and source links are not reinterpreted."""
    soup = BeautifulSoup(client.get("/reports/whats-new").data, "html.parser")
    for section in ["created", "updated"]:
        assert {int(row["data-milestone-id"]) for row in soup.select(
            f'#{section}Body .data-row')} == activity[section]
    updated = soup.select_one(
        f'#updatedBody [data-milestone-id="{activity["updated_id"]}"]')
    assert updated["data-area"] == "Data"
    assert updated["data-on-my-team"] == "true"
    assert updated["data-change-types"] == "Est. ACR/mo|Title"
    cells = updated.select("td")
    assert cells[0]["data-export-url"] == "https://example.com/MSX-updated"
    assert cells[0].select_one("a")["href"] == f'/milestone/{activity["updated_id"]}'
    assert cells[2]["data-sb-sort-value"] == "1234.567"
    assert cells[2].text == "$1,235/mo"
    assert cells[4]["data-export-bool"] == "true"
    assert cells[4]["data-sb-sort-value"] == "1"
    audits = json.loads(soup.select_one("[data-sb-whats-new-audits]").text)
    assert audits[str(activity["updated_id"])]["Title"] == activity["title_date"]


@pytest.mark.parametrize("requested,expected", [("0", "1"), ("91", "90"), ("bad", "14"),
                                                ("5", "5")])
def test_whats_new_actual_lookback(client: FlaskClient, requested: str, expected: str) -> None:
    """Clamped, invalid and non-preset URL values display the provider's actual scope."""
    soup = BeautifulSoup(client.get(f"/reports/whats-new?days={requested}").data, "html.parser")
    assert soup.select_one("#daysFilter option[selected]")["value"] == expected
    assert soup.select_one("[data-sb-whats-new]")["data-days"] == expected
    assert f"last {expected} days" in soup.select_one("#createdEmpty").text
    assert f"last {expected} days" in soup.select_one("#updatedEmpty").text


def test_whats_new_seller_mode_remains_initial_filter(
    client: FlaskClient, activity: dict, sample_data: dict,
) -> None:
    """Seller mode preselects presentation without silently changing provider scope."""
    with patch("app.services.seller_mode.get_seller_mode_seller_id",
               return_value=sample_data["seller1_id"]):
        soup = BeautifulSoup(client.get("/reports/whats-new").data, "html.parser")
    assert soup.select_one("#sellerFilter option[selected]")["value"] == str(
        sample_data["seller1_id"])
    assert len(soup.select(".data-row")) == len(activity["created"]) + len(activity["updated"])


def test_whats_new_help_and_separator(client: FlaskClient) -> None:
    """Help makes date/filter/count/export semantics explicit and commands end cleanly."""
    source = client.get("/static/js/page-help.js").get_data(as_text=True)
    help_text = source.split('title: "What\'s New",', 1)[1].split("`},", 1)[0]
    for expected in ["Updated only", "all cached audits", "older than the lookback",
                     "Counts include collapsed", "not automatically repeated", "expanded rows"]:
        assert expected in help_text
    css = client.get("/static/css/ui-whats-new.css").get_data(as_text=True)
    assert ".sb-whats-new-header .sb-revenue-export { border-right: 0; padding-right: 0; }" in css


def test_whats_new_dss_template_contract(
    app: Flask, client: FlaskClient, activity: dict,
) -> None:
    """DSS presentation omits seller selection without reinterpreting provider data."""
    def dss_context() -> dict[str, str]:
        """Supply the existing DSS template context in the isolated app."""
        return {"user_role": "dss"}

    processors = app.template_context_processors[None]
    processors.append(dss_context)
    try:
        soup = BeautifulSoup(client.get("/reports/whats-new").data, "html.parser")
    finally:
        processors.remove(dss_context)
    assert not soup.select_one("#sellerFilter")
    assert soup.select_one("#areaFilter")
    assert len(soup.select(".data-row")) == len(activity["created"]) + len(activity["updated"])
