"""Native persistent workspace presentation and editor contract regressions."""

import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient

from app.models import OneOnOneAgendaItem, OneOnOneWorkspace, Seller, db


@pytest.fixture
def workspace_records(app: Flask) -> tuple[int, int]:
    """Create isolated rich notes, active work and dated discussion history."""
    with app.app_context():
        seller = Seller(name="Native Workspace Seller")
        db.session.add(seller)
        db.session.flush()
        workspace = OneOnOneWorkspace(
            person_name=seller.name, seller_id=seller.id, person_type="Seller",
            notes='<h2>Standing context</h2><table><tr><td>Rich cell</td></tr></table>',
        )
        db.session.add(workspace)
        db.session.flush()
        db.session.add_all([
            OneOnOneAgendaItem(
                workspace=workspace, item_type="milestone", title_snapshot="Orphan milestone",
                customer_snapshot="Original customer", talking_points="Keep these points",
            ),
            OneOnOneAgendaItem(
                workspace=workspace, item_type="engagement", title_snapshot="Earlier work",
                customer_snapshot="Earlier customer", talking_points="Earlier discussion",
                status="discussed", discussed_at=datetime.now(timezone.utc),
            ),
        ])
        db.session.commit()
        return workspace.id, seller.id


@pytest.mark.parametrize("surface", ["full", "embed", "fragment"])
def test_native_workspace_contract(
    client: FlaskClient, app: Flask, workspace_records: tuple[int, int], surface: str,
) -> None:
    """All consumers share complete content without Bootstrap-owned controls or data writes."""
    workspace_id, seller_id = workspace_records
    with app.app_context():
        before = db.session.get(OneOnOneWorkspace, workspace_id)
        baseline = (before.notes, before.updated_at, OneOnOneAgendaItem.query.count())
    url = (
        f"/api/seller/{seller_id}/one-on-one/detail" if surface == "fragment"
        else f"/one-on-one/{workspace_id}" + ("?embed=1" if surface == "embed" else "")
    )
    response = client.get(url)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(".sb-one-on-one-workspace")
    assert root.select_one(".workspace-standing #workspaceNotes table td").text == "Rich cell"
    assert root.select_one(".workspace-conversation #activeAgenda")
    assert root.select_one("#discussionHistory").find_parent("details")
    assert root.select_one("[data-talking-points]").text == "Keep these points"
    assert "Earlier discussion" in root.text
    assert not root.select(".card, .btn, .badge, .form-control, [data-bs-toggle]")
    assert not soup.select(".ow-dialog [data-bs-toggle], .ow-dialog [data-bs-dismiss]")
    assert len(soup.select("dialog.ow-dialog.sb-dialog")) == 2
    assert soup.select_one("#workspaceRetrySave[hidden]")
    assert soup.select_one("[data-item-retry][hidden]")
    assert soup.select_one("#workspaceSaveState[aria-live='polite']")
    assert soup.select_one("script[src$='ui-one-on-one-save.js']")
    assert soup.select_one("link[href$='ui-one-on-one-workspace.css']")
    if surface == "full":
        assert "sb-page-frame" in soup.body["class"]
        assert soup.select_one("body > footer.sb-page-status")
    elif surface == "embed":
        assert "sb-page-frame" in soup.body["class"]
        assert not soup.select_one("footer.sb-page-status")
    else:
        assert not soup.select("html, body, iframe")
    with app.app_context():
        after = db.session.get(OneOnOneWorkspace, workspace_id)
        assert (after.notes, after.updated_at, OneOnOneAgendaItem.query.count()) == baseline


@pytest.mark.parametrize("person_type", ["Manager", "Other"])
def test_standalone_workspace_empty_and_full_book(
    client: FlaskClient, app: Flask, person_type: str,
) -> None:
    """Non-seller workspaces retain empty guidance and full-book candidate scope."""
    with app.app_context():
        workspace = OneOnOneWorkspace(person_name="Native Person", person_type=person_type)
        db.session.add(workspace)
        db.session.commit()
        workspace_id = workspace.id
    soup = BeautifulSoup(client.get(f"/one-on-one/{workspace_id}").data, "html.parser")
    assert soup.select_one("#agendaEmptyState [data-sb-dialog='addAgendaModal']")
    assert "Showing your full customer book." in soup.select_one("#addAgendaModal").text
    assert soup.select_one("#discussionHistory") is None
    assert soup.select_one("#agendaCount").text == "0 queued"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is required for JS tests")
def test_workspace_editor_javascript() -> None:
    """Run isolated editor save, failure, payload and pending-edit regressions."""
    result = subprocess.run(
        ["node", "--test", str(Path(__file__).parent / "js" / "ui_one_on_one_workspace.test.cjs")],
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_standing_notes_do_not_reserve_an_empty_scrollbar_gutter(client: FlaskClient) -> None:
    """Toolbar and editor fill their pane without an unused scrollbar-width gap."""
    response = client.get("/static/css/ui-one-on-one-workspace.css")
    assert response.status_code == 200
    notes_surface = re.search(r"\.notes-surface\s*\{([^}]+)\}", response.get_data(as_text=True))
    assert notes_surface is not None
    assert "scrollbar-gutter: auto;" in notes_surface.group(1)
    assert "overflow: auto;" in notes_surface.group(1)


def test_standing_notes_fill_available_height_without_manual_resizing(
    client: FlaskClient,
) -> None:
    """The editor flexes below a fixed toolbar instead of imposing a stored pixel height."""
    css = client.get("/static/css/ui-one-on-one-workspace.css").get_data(as_text=True)
    surface = re.search(r"\.notes-surface\s*\{([^}]+)\}", css)
    editor = re.search(r"\.workspace-notes\s*\{([^}]+)\}", css)
    toolbar = re.search(r"\.notes-surface \.ql-toolbar\s*\{([^}]+)\}", css)
    assert surface is not None and editor is not None and toolbar is not None
    assert "display: flex;" in surface.group(1)
    assert "flex-direction: column;" in surface.group(1)
    for declaration in ("flex: 1;", "min-height: 0;", "height: auto;", "resize: none;"):
        assert declaration in editor.group(1)
    assert "flex-shrink: 0;" in toolbar.group(1)
