"""Entity reading surfaces and genuine paired-workspace width regressions."""

from pathlib import Path
import re

import pytest
from bs4 import BeautifulSoup


PROJECT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("filename,selector", [
    ("ui-seller-detail.css", ".sd-context"),
    ("ui-territory-detail.css", ".td-roster"),
])
def test_reading_sidebars_use_the_workbench_surface(filename: str, selector: str) -> None:
    """Full reading panes are not command or status bands."""
    css = (PROJECT / "static" / "css" / filename).read_text(encoding="utf-8")
    rule = re.search(re.escape(selector) + r"\s*\{([^}]+)\}", css)
    assert rule
    assert "background: var(--sb-ui-surface);" in rule.group(1)
    assert "background: var(--sb-ui-context);" not in rule.group(1)


@pytest.mark.parametrize("filename,selector", [
    ("ui-seller-form.css", ".sf-layout"),
    ("ui-territory-form.css", ".tf-layout"),
    ("ui-pod-form.css", ".pod-edit-layout"),
])
def test_paired_editor_content_has_no_stale_inner_width_cap(
    filename: str, selector: str,
) -> None:
    """Reference and assignment panes expand with their standalone page root."""
    css = (PROJECT / "static" / "css" / filename).read_text(encoding="utf-8")
    rule = re.search(re.escape(selector) + r"\s*\{([^}]+)\}", css)
    assert rule
    assert "max-width" not in rule.group(1)
    assert "display: grid" in rule.group(1)


@pytest.mark.parametrize("filename", [
    "customers_list.html", "sellers_list.html", "partners_list.html",
    "topics_list.html", "specialties_list.html", "territories_list.html",
    "pods_list.html", "solution_engineers_list.html", "internal_contacts_list.html",
    "customer_form.html", "partner_form.html", "topic_form.html",
    "specialty_form.html", "internal_contact_form.html", "solution_engineer_form.html",
])
def test_simple_directories_and_single_forms_keep_standard_width(filename: str) -> None:
    """A two-column set of fields is not a pair of simultaneous work areas."""
    template = (PROJECT / "templates" / filename).read_text(encoding="utf-8")
    root = BeautifulSoup(template, "html.parser").select_one("[data-sb-page-surface]")
    assert root
    assert "sb-directory-frame" in root["class"]
    assert "sb-directory-frame-wide" not in root["class"]
