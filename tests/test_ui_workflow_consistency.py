"""Reading surfaces and explicit paired-width contracts for workflow pages."""

from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("filename,selector", [
    ("ui-note.css", ".sb-note-context, .sb-note-main"),
    ("ui-milestone.css", ".sb-ms-context, .sb-ms-main"),
    ("ui-opportunity.css", ".sb-opp-context, .sb-opp-work"),
    ("ui-engagement-detail.css", ".sb-engagement-story, .sb-engagement-work"),
    ("ui-engagement-form.css", ".ef-reading"),
    ("ui-one-on-one-workspace.css", ".workspace-standing, .workspace-conversation"),
    ("ui-project-detail.css", ".sb-project-reading, .sb-project-evidence"),
    ("ui-fill-day.css", ".notes-preview"),
    ("ui-action-items.css", ".sb-actions-content"),
    ("ui-one-on-one-hub.css", ".hub-directory, .hub-launcher"),
    ("ui-milestone-tracker.css", ".milestone-tracker-instance"),
])
def test_workflow_reading_regions_share_surface(filename: str, selector: str) -> None:
    """Reading and editing areas use surface, not the darker command-band tone."""
    source = (ROOT / "static" / "css" / filename).read_text(encoding="utf-8")
    rule = source.split(selector + " {", 1)[1].split("}", 1)[0]
    assert "background: var(--sb-ui-surface)" in rule or (
        "background:var(--sb-ui-surface)" in rule
    )


def test_project_paired_reading_has_no_inner_width_clamp() -> None:
    """Widen the actual dossier, not just its heading or outer frame."""
    source = (ROOT / "static" / "css" / "ui-project-detail.css").read_text(encoding="utf-8")
    rule = source.split(".sb-project-dossier {", 1)[1].split("}", 1)[0]
    assert "max-width" not in rule
    assert ".sb-project-detail:not(.sb-project-page) .sb-project-evidence { display: block; }" in (
        source
    )


def test_note_reading_width_is_scoped_to_standalone_page() -> None:
    """Shared standalone roots replace private clamps without narrowing embedded notes."""
    source = (ROOT / "static" / "css" / "ui-note.css").read_text(encoding="utf-8")
    rule = source.split(".sb-note-reading-page #main-content {", 1)[1].split("}", 1)[0]
    assert "max-width:none;" in rule
    assert "1368px" not in source
    detail = (ROOT / "templates" / "partials" / "note_view_content.html").read_text("utf-8")
    assert "sb-directory-frame sb-directory-frame-wide" in detail
    editor = (ROOT / "templates" / "note_form.html").read_text(encoding="utf-8")
    assert "mainContainer.style.maxWidth" not in editor
    assert "1900px" not in editor
    assert "row.classList.toggle('sb-directory-frame', !rightHasContent);" in editor
