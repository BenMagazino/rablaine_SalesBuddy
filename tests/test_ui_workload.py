"""Workload workbench preserves provider data, export scope and compact embeds."""

import json
from datetime import datetime
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient

from app.models import Customer, Engagement, Milestone, Note, Topic, db


@pytest.mark.parametrize("embedded", [False, True])
def test_workload_native_structure(
    app: Flask, client: FlaskClient, sample_data: dict, embedded: bool,
) -> None:
    """Every real group/column remains sortable, with separate full/embed composition."""
    response = client.get("/reports/workload", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-workload]")
    assert root["data-embedded"] == str(embedded).lower()
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-page-status")) is not embedded
    assert not root.select(".card, .btn, .badge, [data-bs-toggle], .collapse")
    assert bool(root.select(".sb-workload-topic-table")) is not embedded
    assert len(root.select(".sb-workload-group")) == 2
    assert bool(root.select("details.sb-workload-group")) is embedded
    assert root.select_one('label[for="dateFrom"]')
    assert root.select_one('label[for="dateTo"]')
    assert [button["data-preset"] for button in root.select("[data-preset]")] == [
        "fq", "prev_fq", "30d", "90d", "all",
    ]
    assert root.select_one("#emptyState").has_attr("hidden")
    assert "Customer/workload entries" in root.text
    assert "deduplicated" in root.text
    for table in root.select(".sb-workload-table"):
        assert table.has_attr("data-sb-sortable")
        headers = table.select("thead th")
        assert [th["data-sb-sort-type"] for th in headers] == [
            "text", "number", "number", "number", "date",
        ]
        assert [th["data-export-label"] for th in headers] == [
            "Customer", "Engagements", "Milestones", "Est. ACR", "Last Activity",
        ]
        assert all(cell.has_attr("data-sb-sort-value") for cell in table.select("tbody td"))
    acme = next(row for row in root.select(".workload-row") if "Acme Corp" in row.text)
    assert acme.select_one("a")["href"] == f"/customer/{sample_data['customer1_id']}"
    assert acme.select_one("td")["data-export-url"] == "https://example.com/acme"
    assert '.sb-workload-table[data-workload-visible=true]' in response.get_data(as_text=True)
    assert "const CUSTOM_TITLE = 'Workload Report'" in response.get_data(as_text=True)
    assert soup.select_one('script[src$="/ui-workload.js"]')


def test_workload_provider_semantics_and_raw_precision(
    app: Flask, client: FlaskClient, sample_data: dict,
) -> None:
    """Latest topic note, customer-wide engagements and topic-linked milestones stay intact."""
    with app.app_context():
        first = db.session.get(Customer, sample_data["customer1_id"])
        first_note = db.session.get(Note, sample_data["call1_id"])
        topic = db.session.get(Topic, sample_data["topic2_id"])
        milestone = Milestone(
            url="https://example.com/milestone", customer_id=first.id, monthly_usage=10.25,
            msx_status="On Track", customer_commitment="Committed",
        )
        closed = Milestone(
            url="https://example.com/closed", monthly_usage=500, msx_status="Completed",
        )
        latest = Note(customer_id=first.id, content="Latest topic note",
                      call_date=datetime(2099, 1, 2, 14, 30))
        db.session.add(latest)
        latest.topics.append(first_note.topics[0])
        other_topic = Note(customer_id=first.id, content="Same milestone, other topic",
                           call_date=datetime(2025, 1, 1, 9, 0))
        db.session.add(other_topic)
        other_topic.topics.append(topic)
        first_note.milestones.extend([milestone, closed])
        other_topic.milestones.append(milestone)
        db.session.add_all([
            milestone, closed, latest, other_topic,
            Engagement(customer_id=first.id, title="Customer-wide active", status="Active"),
            Engagement(customer_id=first.id, title="Closed engagement", status="Won"),
        ])
        db.session.commit()
        response = client.get("/reports/workload")
        soup = BeautifulSoup(response.data, "html.parser")
        groups = soup.select(".sb-workload-group")
        acme_rows = [row for row in soup.select(".workload-row") if "Acme Corp" in row.text]
        assert len(groups) == 2 and len(acme_rows) == 2
        for row in acme_rows:
            assert row["data-acr"] == "10.25"
            assert row["data-milestone-ids"] == str(milestone.id)
            assert row.select_one(".sb-workload-commit").text == "Committed"
            assert [td["data-sb-sort-value"] for td in row.select("td")][1:4] == [
                "1", "1", "10.25",
            ]
        assert {row["data-note-date"] for row in acme_rows} == {"2099-01-02", "2025-01-01"}
        milestone_map = json.loads(soup.select_one("[data-sb-workload-data]").text)
        assert milestone_map == {str(milestone.id): 10.25}


def test_workload_seller_scope_unchanged(
    app: Flask, client: FlaskClient, sample_data: dict,
) -> None:
    """Seller mode still excludes other sellers rather than filtering only presentation."""
    with patch("app.services.seller_mode.get_seller_mode_seller_id",
               return_value=sample_data["seller1_id"]):
        soup = BeautifulSoup(client.get("/reports/workload").data, "html.parser")
    names = [row.select_one("td")["data-sb-sort-value"] for row in soup.select(".workload-row")]
    assert names == ["Acme Corp"]


def test_workload_empty_source_and_help(client: FlaskClient) -> None:
    """Empty sources stay truthful and Help describes actual date/count/export semantics."""
    soup = BeautifulSoup(client.get("/reports/workload").data, "html.parser")
    assert not soup.select(".workload-row")
    assert "Tag your notes with topics" in soup.select_one(".sb-workload-empty:not([hidden])").text
    source = client.get("/static/js/page-help.js").get_data(as_text=True)
    help_text = source.split("title: 'Workload Report',", 1)[1].split("`},", 1)[0]
    for expected in [
        "latest note for that topic", "Earlier notes", "not activity recomputed",
        "deduplicates milestone IDs", "distinct customer names", "not just the selected",
        "Back restores", "Retry", "Embedded reports",
    ]:
        assert expected in help_text
