"""Native Reports directory preserves the canonical report registry and contexts."""

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


GROUPS = [
    ("Planning & Reviews", ["connect-goals", "initiative-tracker", "one-on-one", "connect-impact"]),
    ("Execution & Coverage", ["u2c-attainment", "milestone-tracker", "activity-coverage", "whitespace"]),
    ("Pipeline Health", ["hygiene-report", "msx-workspace", "whats-new"]),
    ("Account Insights", ["revenue-analyzer", "workload-report", "marketing-insights",
                          "synapse-customers"]),
]


@pytest.mark.parametrize("embedded", [False, True])
@pytest.mark.parametrize("role", ["se", "dss"])
def test_directory_preserves_order_accessibility_and_context(
    app: Flask, client: FlaskClient, embedded: bool, role: str,
) -> None:
    """Full/embed and both roles keep all fifteen actual destinations and descriptions."""
    from app.models import UserPreference, db

    with app.app_context():
        UserPreference.query.first().user_role = role
        db.session.commit()
    response = client.get("/reports", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-reports-hub]")
    assert root["data-sb-report-key"] == "reports-hub"
    assert root["data-sb-report-embedded"] == str(embedded).lower()
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-page-status")) is not embedded
    assert not root.select(".card, .btn, .row, .container-fluid, table")
    groups = root.select("[data-sb-report-group]")
    assert [group["data-sb-report-group"] for group in groups] == [name for name, _ in GROUPS]
    for group, (name, ids) in zip(groups, GROUPS):
        assert group.select_one("h2").text.strip() == name
        rows = group.select("[data-sb-report-entry]")
        assert [row["data-report-id"] for row in rows] == ids
        for row in rows:
            link = row.select_one("a")
            assert root.select_one("#" + link["aria-labelledby"]) == row.select_one("h3")
            assert root.select_one("#" + link["aria-describedby"]) == row.select_one("p")
            assert row.select_one("p").text.strip()
            assert all(icon["aria-hidden"] == "true" for icon in row.select("i"))
            assert link["href"].startswith("/reports/")
    assert len(root.select("a.sb-reports-entry")) == 15
    assert "15 reports across 4 groups" in soup.select_one("[data-sb-reports-count]").text
    search = root.select_one("#findReport")
    assert search["type"] == "search" and search["aria-controls"] == "reportsDirectory"
    assert root.select_one('label[for="findReport"]')
    assert root.select_one("[data-sb-reports-clear]").has_attr("disabled")
    assert root.select_one("[data-sb-reports-empty]").has_attr("hidden")
    scripts = [script.get("src", "") for script in soup.select("script[src]")]
    own = next(value for value in scripts if value.endswith("/ui-reports-hub.js"))
    reading = next(value for value in scripts if value.endswith("/ui-revenue-reports.js"))
    assert scripts.index(own) < scripts.index(reading)


def test_report_directory_help_matches_filter_and_back(client: FlaskClient) -> None:
    """Help explains directory navigation without implying report data is filtered."""
    source = client.get("/static/js/page-help.js").get_data(as_text=True)
    section = source.split("title: 'Reports',", 1)[1].split("`},", 1)[0]
    assert "filtering does not change report data" in section
    assert "Back restores your filter and reading position" in section
    assert "Embedded directories keep their filter local" in section


def test_report_dividers_only_follow_visible_rows(client: FlaskClient) -> None:
    """Hidden preceding entries must not add a divider above a group's first match."""
    source = client.get("/static/css/ui-reports-hub.css").get_data(as_text=True)
    assert ".sb-reports-list li:not([hidden]) ~ li:not([hidden])" in source
    assert ".sb-reports-list li + li" not in source
