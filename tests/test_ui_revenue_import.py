"""Revenue maintenance keeps original records, sorting precision and role contexts."""

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient
import pytest


@pytest.mark.parametrize("embedded", [False, True])
@pytest.mark.parametrize("dss", [False, True])
def test_import_records_sort_keys_and_contexts(
    app: Flask, client: FlaskClient, monkeypatch: pytest.MonkeyPatch,
    embedded: bool, dss: bool,
) -> None:
    """History and month values stay intact, with exact UTC and calendar sort values."""
    from app.models import UserPreference, db

    stamp = datetime(2026, 10, 5, 18, 16, 15, 123456)
    aware = stamp.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=-5)))
    imports = [
        SimpleNamespace(id=1, imported_at=stamp, filename="<script>literal</script>",
                        record_count=32851, records_created=285747, records_updated=0),
        SimpleNamespace(id=2, imported_at=aware, filename="MSXI",
                        record_count=2, records_created=1, records_updated=1),
    ]
    months = [{"month_date": date(2026, 9, 1), "fiscal_month": "FY27-Sep",
               "record_count": 1428}]
    monkeypatch.setattr("app.routes.revenue.get_import_history", lambda limit: imports)
    monkeypatch.setattr("app.routes.revenue.get_months_in_database", lambda: months)
    with app.app_context():
        pref = UserPreference.query.first()
        pref.user_role = "dss" if dss else "se"
        db.session.commit()
    response = client.get("/revenue/import", query_string={"embed": "1"} if embedded else {})
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-import]")
    assert root["data-has-buckets"] == str(not dss).lower()
    assert ("sb-page-frame" in soup.body.get("class", [])) is not embedded
    assert bool(soup.select(".sb-page-status")) is not embedded
    assert bool(root.select("#bucketPickerCard")) is not dss
    assert not root.select(".card, .btn, .progress, .list-group, .container")
    styles = [link["href"] for link in soup.select('link[rel="stylesheet"]')]
    detail = next(value for value in styles if value.endswith("/ui-revenue-detail.css"))
    frame = next(value for value in styles if value.endswith("/ui-page-frame.css"))
    assert styles.count(detail) == 1 and styles.index(detail) < styles.index(frame)
    rows = root.select(".sb-import-history tbody tr")
    assert len(rows) == 2
    for row in rows:
        assert float(row.td["data-sb-sort-value"]) == stamp.replace(tzinfo=timezone.utc).timestamp()
    assert rows[0].select("td")[1].text == "<script>literal</script>"
    assert not rows[0].select("script")
    assert [cell["data-sb-sort-value"] for cell in rows[0].select("td")[2:]] == [
        "32851", "285747", "0",
    ]
    assert root.select_one(".sb-import-months tbody td")["data-sb-sort-value"] == "2026-09-01"
    assert [th["data-sb-sort-type"] for th in root.select("th")] == [
        "number", "text", "number", "number", "number", "date", "number",
    ]
    assert root["data-sync-url"] == "/api/revenue/sync"
    assert root["data-status-url"] == "/api/revenue/sync/status"
    assert root["data-notice-url"] == "/api/revenue/bucket-notice"
    assert root.select_one("#syncBar").name == "progress"
    assert root.select_one("#revImportBrainrotCheck")["type"] == "checkbox"


def test_import_empty_state_and_read_only_render(client: FlaskClient) -> None:
    """A fresh store keeps the bucket manager hidden and does not start a sync."""
    soup = BeautifulSoup(client.get("/revenue/import").data, "html.parser")
    root = soup.select_one("[data-sb-import]")
    assert "No imports yet" in root.text and "No data imported" in root.text
    assert root.select_one("#bucketPickerCard").has_attr("hidden")
    assert root.select_one("#syncResults").has_attr("hidden")
    assert not root.select("form")


def test_import_help_describes_recovery(client: FlaskClient) -> None:
    """Help matches sortable panes, refresh and confirmed notice/save behavior."""
    source = client.get("/static/js/page-help.js").get_data(as_text=True)
    section = source.split("title: 'Revenue Import'", 1)[1].split("`},", 1)[0]
    for text in ("Check status", "Refresh stored-data tables", "both directions",
                 "No selection shows every bucket", "server confirms dismissal"):
        assert text in section


def test_nullable_legacy_counters_stay_distinct_from_zero(
    client: FlaskClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nullable created/updated fields never crash formatting or turn into fake zeroes."""
    record = SimpleNamespace(
        id=1, imported_at=datetime(2026, 10, 5, tzinfo=timezone.utc), filename="Legacy",
        record_count=0, records_created=None, records_updated=None,
    )
    monkeypatch.setattr("app.routes.revenue.get_import_history", lambda limit: [record])
    response = client.get("/revenue/import")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    cells = soup.select(".sb-import-history tbody td")[2:]
    assert [cell["data-sb-sort-value"] for cell in cells] == ["0", "", ""]
    assert [cell.text for cell in cells] == ["0", "-", "-"]
