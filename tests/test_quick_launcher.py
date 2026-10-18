"""Shared launcher rendering and its canonical navigation destinations."""

from bs4 import BeautifulSoup
import pytest
from unittest.mock import Mock

from app.services import connect_goals
from tests.test_dashboards import BASE, create_dashboard


@pytest.mark.parametrize("embedded", [False, True])
def test_launcher_uses_the_shared_picker_on_full_pages(client, embedded):
    """Embeds reuse the parent's launcher rather than rendering another modal."""
    response = client.get("/reports/whitespace" + ("?embed=1" if embedded else ""))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    dialog = soup.select_one("#quickLauncherModal")
    assert bool(dialog) is not embedded
    scripts = [script.get("src", "") for script in soup.select("script[src]")]
    assert any("ui-quick-launcher.js" in src for src in scripts)
    if embedded:
        return
    assert "sb-dialog-picker" in dialog["class"]
    assert dialog.select_one("#quickLauncherSearch[autofocus]")["aria-controls"] == (
        "quickLauncherResults")
    assert dialog.select_one('#quickLauncherCount[aria-live="polite"]')
    assert dialog.select_one('#quickLauncherResults[role="region"]')
    assert "Tab or arrow keys" in dialog.get_text()
    assert "Quick launcher" in soup.select_one("#keyboardShortcutsModal").get_text()
    assert {link["href"] for link in dialog.select("template a")} == {
        "/", "/admin/sync-console", "/sellers",
    }


def test_dashboard_report_destinations_follow_saved_names_across_navigation(client, monkeypatch):
    """The launcher uses top-level dashboard links, never entries in the Reports directory."""
    provider = Mock(side_effect=AssertionError('Navigation must not calculate widget values'))
    monkeypatch.setattr(connect_goals, 'get_setup_state', provider)
    dashboard_id = create_dashboard(client, 'Seller weekly')
    assert client.post(f'{BASE}/{dashboard_id}/widgets', json={
        'key': 'connect_goals.u2c',
    }).status_code == 200
    report_url = f'/reports/dashboards/{dashboard_id}'
    for name in ('Seller weekly', 'Manager weekly'):
        assert client.post(f'{BASE}/{dashboard_id}', json={'name': name}).status_code == 200
        page = BeautifulSoup(client.get('/reports').data, 'html.parser')
        menu = page.select_one(f'#dashboardsMenu a[href="{report_url}"]')
        assert menu.get_text(strip=True) == name
        assert page.select_one('main a[href^="/reports/dashboards"]') is None
        assert page.select_one('#reportsMenu a[href^="/reports/dashboards"]') is None
        assert page.select_one(f'#dashboardsMenu a[href="{report_url}/edit"]') is None
        launcher_script = next(script for script in page.select('script[src]')
                               if 'ui-quick-launcher.js' in script['src'])
        assert launcher_script
    assert client.post(f'{BASE}/{dashboard_id}/delete').status_code == 200
    page = BeautifulSoup(client.get('/reports').data, 'html.parser')
    assert page.select_one(f'a[href="{report_url}"]') is None
    assert page.select_one('#dashboardsMenu a[href="/reports/dashboards"]')
    provider.assert_not_called()
