"""Native milestone shell and nested-workflow parity across all original hosts."""

from datetime import date
from pathlib import Path
import re

import pytest
from bs4 import BeautifulSoup

from app.models import Milestone, db


@pytest.fixture
def preview_milestone(app, sample_data) -> int:
    """Create an isolated milestone that exposes both nested creation editors."""
    with app.app_context():
        milestone = Milestone(
            title="Native Preview Milestone", url="https://example.com/milestone",
            msx_milestone_id="native-preview-guid", customer_id=sample_data["customer1_id"],
            due_date=date.today(), msx_status="On Track", on_my_team=True,
        )
        db.session.add(milestone)
        db.session.commit()
        return milestone.id


@pytest.mark.parametrize("path", [
    "/", "/action-items", "/reports/milestone-tracker",
    "/reports/msx-workspace", "/reports/connect-impact",
])
def test_all_milestone_hosts_use_the_shared_native_shell(client, preview_milestone, path) -> None:
    """Routed hosts have one shared dialog, dependencies, accessible labels and Retry."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    dialogs = soup.find_all(id="milestonePreviewDialog")
    assert len(dialogs) == 1
    dialog = dialogs[0]
    assert dialog.name == "dialog"
    assert dialog["aria-labelledby"] == "milestonePreviewTitle"
    assert dialog.select_one("[data-sb-record-retry]")["type"] == "button"
    assert dialog.select_one("[data-sb-record-full-link]")
    assert dialog.find(id="milestonePreviewMsxLink")["target"] == "_blank"
    assert soup.select_one('script[src="/static/js/ui-milestone-workflow.js"]').has_attr("defer")
    assert soup.select_one('script[src="/static/js/ui-milestone-preview.js"]').has_attr("defer")
    assert not soup.select("#homeMilestoneDetailModal, #actionItemsMilestoneModal, "
                           "#milestoneDetailModal, #msxMilestoneDetailModal")


def test_seller_preview_keeps_tracker_parent_handoff(client, sample_data, preview_milestone) -> None:
    """Seller's embedded tracker uses the shared stacked native detail lifecycle."""
    response = client.get(f'/seller/{sample_data["seller1_id"]}')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one('dialog#milestonesModal .milestone-tracker-instance')
    assert soup.select_one('script[src="/static/js/ui-seller-detail.js"]')
    assert not soup.select('#milestonesModal [data-bs-dismiss]')
    assert b"standaloneMilestoneDetailModal" not in response.data


def test_milestone_fragment_preserves_body_commands_and_native_nested_fields(
    client, preview_milestone,
) -> None:
    """Information and all original engagement/task inputs survive the lifecycle migration."""
    response = client.get(f"/api/milestone/{preview_milestone}/detail")
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-milestone-detail]")
    assert root["data-sb-milestone-id"] == str(preview_milestone)
    for action in ("engagement", "task", "refresh"):
        assert root.select_one(f'[data-sb-ms-action="{action}"]')
    assert root.find(id="joinMilestoneTeamBtn") or root.find(id="leaveMilestoneTeamBtn")
    assert root.find(id="commentsBody")
    assert root.find(id="detailsCached")
    assert root.select_one("script[data-sb-milestone-controller]")
    for dialog_id in ("newTaskModal", "milestoneEngagementModal"):
        dialog = root.find(id=dialog_id)
        assert dialog.name == "dialog"
        assert dialog.has_attr("data-sb-milestone-child")
        assert dialog.select_one("[data-sb-child-status]")
        assert dialog.select_one("[data-sb-dialog-close]")
        assert not dialog.select(".modal-dialog, .modal-content, [data-bs-dismiss]")
    for field in ("Title", "Status", "Problem", "Impact", "Resources", "Acr", "Target"):
        assert root.find(id=f"milestoneEngagement{field}")
    for field in ("subject", "category", "description", "due_date"):
        assert root.find(id=f"modal_task_{field}")
    assert root.find(id="modal_task_category").has_attr("required")
    assert not root.select('a[href$="/edit"]')
    assert "milestone_ids: [" + str(preview_milestone) + "]" in response.text
    assert "duration_minutes: 60" in response.text
    assert "created_in_msx === true" in response.text


def test_customerless_local_milestone_has_no_manufactured_creation_controls(client, app) -> None:
    """Conditional no-customer/no-MSX branches remain supported."""
    with app.app_context():
        milestone = Milestone(title="Local Milestone", url="https://example.com/local")
        db.session.add(milestone)
        db.session.commit()
        milestone_id = milestone.id
    soup = BeautifulSoup(client.get(f"/api/milestone/{milestone_id}/detail").data, "html.parser")
    assert soup.select_one("[data-sb-milestone-detail]")
    assert not soup.select("#newTaskModal, #milestoneEngagementModal")
    assert "Tasks cannot be created" in soup.get_text()


@pytest.mark.parametrize("filename,launcher", [
    ("index.html", "openHomeMilestoneDetail"),
    ("action_items_hub.html", "openActionItemsMilestone"),
    ("seller_view.html", "openStandaloneMilestoneDetail"),
    (r"partials\milestone_tracker_content.html", "openMilestoneDetail"),
    ("report_msx_workspace.html", "openMsxMilestoneDetail"),
    ("report_connect_impact.html", "data-impact-preview"),
])
def test_launcher_contracts_are_retained_without_duplicated_partial_loaders(filename, launcher) -> None:
    """Original launcher signatures remain while one controller owns fragment loading."""
    template = Path(__file__).parents[1] / "templates" / filename
    text = template.read_text(encoding="utf-8")
    if filename == "seller_view.html":
        text += (Path(__file__).parents[1] / "static" / "js" /
                 "ui-seller-detail.js").read_text()
    assert launcher in text
    if filename == "report_connect_impact.html":
        text += (Path(__file__).parents[1] / "static" / "js" / "ui-impact.js").read_text()
    assert "SBMilestonePreview.open" in text
    assert not re.search(r"fetch\([^)]*/api/milestone/[^)]*/detail", text)
