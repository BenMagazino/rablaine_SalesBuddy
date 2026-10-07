"""Native MSX workspace presentation and unchanged cache-provider contracts."""
from pathlib import Path

from bs4 import BeautifulSoup
import pytest


@pytest.mark.parametrize("query", ["", "?tab=opps", "?tab=milestones", "?tab=tasks"])
def test_native_workspace_host(client, sample_data, query: str) -> None:
    """Every tab URL retains the native frame, filters, dialogs and shared assets."""
    response = client.get("/reports/msx-workspace" + query)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert "sb-page-frame" in soup.body["class"]
    root = soup.select_one("[data-sb-page-surface]")
    assert root.select_one('a[href="/reports/milestone-tracker"]')
    assert len(root.select('[role="tab"]')) == 3
    assert len(root.select(".msx-reading")) == 3
    for id_ in ("filterSeller", "filterCustomer", "filterSearch", "oppStatusFilter",
                "oppTeamFilter", "msTeamFilter", "msOppFilter", "msWorkloadFilter"):
        assert root.find(id=id_)
    for id_ in ("createTaskModal", "msxOppDetailModal"):
        dialog = soup.find(id=id_)
        assert dialog.name == "dialog"
        assert dialog.has_attr("aria-labelledby")
        assert dialog.select_one("[data-sb-dialog-close]")
    assert not root.select(".card, .nav-tabs, .table-responsive, [data-bs-toggle]")
    assert len(soup.select('script[src="/static/js/ui-table-sort.js"]')) == 1
    assert len(soup.select('script[src="/static/js/ui-dialog.js"]')) == 1
    assert soup.select_one("footer.sb-page-status #workspaceStatus")


def test_all_real_columns_have_sort_and_export_contracts(client, sample_data) -> None:
    """Data headings opt in to correct raw types, while actions remain unsortable."""
    soup = BeautifulSoup(client.get("/reports/msx-workspace").data, "html.parser")
    for id_, count in (("oppsTable", 7), ("msTable", 9), ("tasksTable", 4)):
        table = soup.find(id=id_)
        headers = table.select("th[data-sb-sort-type]")
        assert len(headers) == count
        assert all(header["data-export-label"] == header.get_text(strip=True) for header in headers)
        assert all(header["data-sb-sort-type"] in ("text", "number", "date")
                   for header in headers)
    assert soup.find(id="tasksTable").select("th")[-1].get_text() == "Actions"
    assert not soup.find(id="tasksTable").select("th")[-1].has_attr("data-sb-sort-type")
    text = (Path(__file__).parents[1] / "templates" / "report_msx_workspace.html").read_text()
    assert 'data-sb-sort-value="${opp.estimated_value ?? \'\'}"' in text
    assert 'data-sb-sort-value="${ms.monthly_usage ?? \'\'}"' in text
    assert "SBMilestonePreview.open(msId, title, status, msxUrl)" in text
    assert "bootstrap." not in text


def test_keyword_and_status_defaults_remain_explicit(client, sample_data) -> None:
    """Clear All status retains its original unrestricted meaning, not zero matches."""
    soup = BeautifulSoup(client.get("/reports/msx-workspace").data, "html.parser")
    assert soup.find(id="oppStatusFilter").find("option", selected=True)["value"] == "open"
    assert [cb["value"] for cb in soup.select(".ms-status-cb[checked]")] == [
        "On Track", "At Risk", "Blocked",
    ]
    assert len(soup.select(".ms-status-cb")) == 6
    assert soup.find(id="taskSubject")["maxlength"] == "200"
    assert soup.find(id="taskMilestoneName").has_attr("readonly")
