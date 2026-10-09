"""Native directory contracts over the unchanged customer-linked milestone provider."""

from datetime import datetime, timezone

from bs4 import BeautifulSoup

from app.models import Milestone, Note, db


def test_directory_population_order_fields_and_destinations(
    client, sample_customer,
) -> None:
    """Retain newest-first order, call counts, untitled records and detail destinations."""
    older = Milestone(
        title=None, url="https://example.test/old?x=1&y=2", customer_id=sample_customer.id,
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    newer = Milestone(
        title="A <milestone>", url="https://example.test/new", customer_id=sample_customer.id,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc), msx_status="Completed",
    )
    orphan = Milestone(title="Not customer linked", url="https://example.test/orphan")
    db.session.add_all([older, newer, orphan])
    db.session.flush()
    note = Note(content="Linked call", customer_id=sample_customer.id)
    note.milestones.append(older)
    db.session.add(note)
    db.session.commit()
    expected = Milestone.query.filter(Milestone.customer_id.isnot(None)).order_by(
        Milestone.created_at.desc(),
    ).all()
    soup = BeautifulSoup(client.get("/milestones").data, "html.parser")
    surface = soup.select_one("[data-sb-page-surface]")
    rows = surface.select("tbody tr")
    assert [int(row["data-milestone-id"]) for row in rows] == [m.id for m in expected]
    for row, milestone in zip(rows, expected):
        cells = row.select("td")
        assert cells[0]["data-sb-sort-value"] == (milestone.title or "Untitled Milestone")
        assert cells[1]["data-sb-sort-value"] == milestone.url
        assert cells[1].a["title"] == milestone.url
        assert cells[2]["data-sb-sort-value"] == str(len(milestone.notes))
        assert cells[2].get_text(strip=True) == (
            f"{len(milestone.notes)} call{'s' if len(milestone.notes) != 1 else ''}"
        )
        assert all(a["href"] == f"/milestone/{milestone.id}" for a in row.select("a"))
    assert "sb-page-frame" in soup.body["class"]
    assert not surface.select(".card, .list-group, .badge, [data-bs-toggle]")
    assert surface.select_one('a[href="/milestone/new"]')
    assert surface.select_one('a[href="/reports/milestone-tracker"]')
    assert soup.select_one("footer.sb-page-status")
    headers = surface.select("th")
    assert [h["data-sb-sort-type"] for h in headers] == ["text", "text", "number"]
    assert all(h["data-export-label"] == h.get_text(strip=True) for h in headers)
    assert not surface.table.has_attr("data-sb-sort-default-column")
    assert len(soup.select('script[src="/static/js/ui-table-sort.js"]')) == 1
    assert len(soup.select('script[src="/static/js/ui-revenue-reports.js"]')) == 1


def test_empty_directory_keeps_creation_explanation_and_commands(client) -> None:
    """Empty scope retains the original manual and automatic creation guidance."""
    soup = BeautifulSoup(client.get("/milestones").data, "html.parser")
    surface = soup.select_one("[data-sb-page-surface]")
    assert "No milestones yet" in surface.get_text()
    assert "add a milestone URL to a note" in surface.get_text()
    assert len(surface.select('a[href="/milestone/new"]')) == 2
    assert not surface.select("table")
    assert "0 milestones" in soup.select_one("body > footer.sb-page-status").get_text()
    assert surface.select_one('[data-sb-page-body][tabindex="0"]')
    assert surface.select_one("[data-sb-report-context-notice][hidden]")
