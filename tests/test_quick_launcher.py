"""Shared launcher rendering and its canonical navigation destinations."""

from bs4 import BeautifulSoup
import pytest


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
