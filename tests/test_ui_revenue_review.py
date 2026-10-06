"""Native revenue review rendering and shared-host integration contracts."""

from datetime import datetime, timezone
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from flask import Flask
from flask.testing import FlaskClient


@pytest.fixture
def review_alert(app: Flask) -> dict[str, int]:
    """Create an isolated revenue alert with matched customer and review history."""
    from app.models import Customer, RevenueAnalysis, RevenueReviewNote, Seller, db

    with app.app_context():
        seller = Seller(name="Review UI Seller")
        db.session.add(seller)
        db.session.flush()
        customer = Customer(name="Review UI Customer", tpid=45123, seller_id=seller.id)
        db.session.add(customer)
        db.session.flush()
        alert = RevenueAnalysis(
            customer_id=customer.id, customer_name=customer.name, seller_name=seller.name,
            bucket="Databases", category="DECLINING", recommended_action="CHECK-IN",
            avg_revenue=5000, latest_revenue=4000, priority_score=70, months_analyzed=6,
            confidence="HIGH", review_status="new", review_notes='<Draft "notes">',
            previous_review_status="reviewed", previous_review_notes="Prior context",
        )
        db.session.add(alert)
        db.session.flush()
        db.session.add(RevenueReviewNote(
            analysis_id=alert.id, review_status="reviewed", review_notes="<Literal history>",
            created_at=datetime.now(timezone.utc),
        ))
        db.session.commit()
        return {"alert": alert.id, "customer": customer.id, "seller": seller.id}


@pytest.mark.parametrize("path, kind", [
    ("/reports/revenue", "analyzer"),
    ("/revenue/seller/Review%20UI%20Seller", "seller"),
])
def test_revenue_pages_use_native_chrome(
    client: FlaskClient, review_alert: dict[str, int], path: str, kind: str,
) -> None:
    """Both migrated page roots retain the shared list without Bootstrap components."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one(f'[data-sb-revenue-page="{kind}"]')
    assert root is not None
    assert root.select_one("h1")
    if kind == "seller":
        assert not root.select(".sb-revenue-page-header > div:first-child > p")
        assert [
            label.get_text(strip=True)
            for label in root.select(".sb-revenue-list-summary dt")
        ].count("Alerts Needing Attention") == 1
    assert root.select_one("#bucketFilterContainer")
    assert root.select_one("#alertsTable")
    bar = soup.select_one(".sb-context-bar")
    navbar = soup.select_one(".sb-app-bar")
    main = soup.select_one("#main-content")
    assert bar is not None
    assert navbar.find_next_sibling() == bar
    assert bar.find_next("main") == main
    assert not main.select('nav[aria-label="Breadcrumb"]')
    assert bar.select_one('[aria-current="page"]')
    assert not root.select(
        ".card, .card-header, .card-body, .btn, .btn-group, .breadcrumb, "
        ".dropdown, .dropdown-menu, .alert, .row, .container-fluid, [data-bs-toggle]"
    )
    assert soup.select_one("dialog[data-sb-revenue-preview]")


@pytest.mark.parametrize("path", [
    "/reports/revenue", "/revenue/seller/Review%20UI%20Seller",
])
def test_revenue_pages_opt_into_native_desktop_frame(
    client: FlaskClient, review_alert: dict[str, int], path: str,
) -> None:
    """Full pages divide one surface into bands, a work region and truthful view status."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert "sb-page-frame" in soup.body.get("class", [])
    assert soup.select_one('link[href="/static/css/ui-page-frame.css"]')
    assert soup.select_one("#main-content > [data-sb-page-surface]")
    assert soup.select_one("[data-sb-page-surface] > [data-sb-page-band]")
    work = soup.select_one("[data-sb-page-body]")
    assert work.select_one(".sb-revenue-alerts-scroll[tabindex='0'] > #alertsTable")
    footer = soup.select_one("body > footer.sb-page-status")
    status = footer.select_one('[role="status"][aria-live="polite"]')
    assert status["data-sb-table-status"] == "alertsTable"
    assert status.get_text(strip=True) == "1 of 1 alerts shown"
    assert soup.select_one('script[src="/static/js/ui-table-status.js"][defer]')
    assert "Sales Buddy" not in footer.get_text()
    assert soup.select_one("#keyboardShortcutsModal .sb-dialog-footer").get_text(
        strip=True
    ) == "© 2026 Sales Buddy - Your Azure Sales Companion"
    assert not footer.select(".container, .bg-light, .text-muted, .py-3, .mt-5")
    assert len(soup.select("footer")) == 1
    assert soup.select_one("#alertsTable")
    assert soup.select_one("dialog[data-sb-revenue-preview]")


@pytest.mark.parametrize("path", [
    "/reports/revenue?embed=1",
    "/revenue/seller/Review%20UI%20Seller?embed=1",
])
def test_embedded_revenue_pages_do_not_take_over_the_host_frame(
    client: FlaskClient, review_alert: dict[str, int], path: str,
) -> None:
    """Embedded content keeps its previous sizing and has no outer navigation or footer."""
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    assert "sb-page-frame" not in soup.body.get("class", [])
    assert not soup.select(".sb-app-bar, .sb-context-bar, footer")
    assert soup.select_one("#alertsTable")


@pytest.mark.parametrize("path", ["/", "/preferences", "/customers"])
def test_native_revenue_frame_does_not_restyle_legacy_or_home_pages(
    client: FlaskClient, path: str,
) -> None:
    """The shared base hook does not opt unrelated pages into a new layout."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert "sb-page-frame" not in soup.body.get("class", [])
    assert not soup.select(".sb-page-status, [data-sb-page-surface]")
    assert not soup.select('script[src="/static/js/ui-table-status.js"]')


@pytest.mark.parametrize("path", ["/reports/revenue", "/revenue/seller/Empty%20Seller"])
def test_revenue_empty_workbench_status_has_no_missing_table_binding(
    client: FlaskClient, path: str,
) -> None:
    """Empty views report zero rather than binding a status observer to a missing table."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert not soup.select("#alertsTable, [data-sb-table-status]")
    assert soup.select_one('.sb-page-status [role="status"]').get_text(
        strip=True
    ) == "0 of 0 alerts shown"
    assert soup.select_one("[data-sb-page-body]")


def test_workbench_scroller_focus_stays_inside_clipped_region() -> None:
    """Edge-connected scrollers keep their keyboard indicator within the work surface."""
    css_path = Path(__file__).resolve().parents[1] / "static" / "css" / "ui-revenue-detail.css"
    source = css_path.read_text()
    selector = ".sb-page-frame .sb-revenue-workarea .sb-revenue-alerts-scroll:focus-visible"
    rule = source.split(selector, 1)[1].split("}", 1)[0]
    assert "outline-offset: -2px" in rule


def test_seller_queue_preserves_record_identity_and_comparison_fallback(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """The standalone queue selects alerts, reuses guarded details and retains Table controls."""
    soup = BeautifulSoup(client.get("/revenue/seller/Review%20UI%20Seller").data, "html.parser")
    item = soup.select_one('[data-sb-queue-alert]')
    assert item["data-sb-queue-alert"] == str(review_alert["alert"])
    assert item["role"] == "option"
    assert item["data-full-url"] == f'/customer/{review_alert["customer"]}'
    assert soup.select_one('[data-sb-queue-view][hidden]')
    assert not soup.select_one('[data-sb-table-view]').has_attr("hidden")
    assert len(soup.select("#revenueSummaryCount")) == 1
    assert soup.select_one('[data-sb-queue-inspector] [data-sb-record-retry]')
    scripts = [script.get("src", "") for script in soup.select("script")]
    assert scripts.index("/static/js/ui-record-dialog.js") < scripts.index(
        "/static/js/ui-revenue-workbench.js"
    )
    assert soup.select_one('#alertsTable .review-action-btn')
    assert soup.select_one('#alertsTable[data-sb-sortable]')
    assert all(header.get("data-sb-sort-type") for header in soup.select("#alertsTable thead th"))


@pytest.mark.parametrize("path", [
    "/reports/revenue", "/revenue/seller/Review%20UI%20Seller?embed=1",
])
def test_seller_queue_does_not_change_analyzer_or_embedded_consumers(
    client: FlaskClient, review_alert: dict[str, int], path: str,
) -> None:
    """The workflow pilot is not an implicit redesign of other shared-list hosts."""
    soup = BeautifulSoup(client.get(path).data, "html.parser")
    assert not soup.select('[data-sb-revenue-workbench], [data-sb-queue-inspector]')
    assert not soup.select('script[src="/static/js/ui-revenue-workbench.js"]')
    assert soup.select_one("#alertsTable")


def test_seller_queue_counts_alerts_not_unique_customers(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """Two buckets for one customer remain distinct reviewable alerts and count as two."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        db.session.add(RevenueAnalysis(
            customer_id=review_alert["customer"], customer_name="Review UI Customer",
            seller_name="Review UI Seller", bucket="Fabric", category="DECLINING",
            recommended_action="CHECK-IN", priority_score=80,
            avg_revenue=3000, latest_revenue=2000, months_analyzed=6, confidence="HIGH",
        ))
        db.session.commit()
    soup = BeautifulSoup(client.get("/revenue/seller/Review%20UI%20Seller").data, "html.parser")
    assert soup.select_one("#revenueSummaryCount").text == "2"
    assert soup.select_one(".sb-revenue-list-summary dt").text == "Alerts Needing Attention"
    items = soup.select("[data-sb-queue-alert]")
    assert len(items) == 2
    assert len({item["data-sb-queue-alert"] for item in items}) == 2
    assert {item["data-customer-name"] for item in items} == {"Review UI Customer"}


@pytest.mark.parametrize("score, tone", [
    (100, "danger"), (80, "danger"), (79, "warning"), (60, "warning"),
    (59, "accent"), (40, "accent"), (39, "neutral"), (0, "neutral"),
])
def test_priority_tiers_match_queue_table_and_detail(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], score: int, tone: str,
) -> None:
    """All native alert presentations preserve the same priority threshold semantics."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.priority_score = score
        db.session.commit()
    soup = BeautifulSoup(client.get("/revenue/seller/Review%20UI%20Seller").data, "html.parser")
    queue = soup.select_one(".sb-revenue-queue-identity > span[data-tone]")
    table = soup.select_one("#alertsTable .sb-revenue-number")
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    detail = BeautifulSoup(response.data, "html.parser").select_one(
        ".sb-revenue-metrics > div:last-child > dd"
    )
    for element in (queue, table, detail):
        assert element["data-tone"] == tone
        assert element.get_text(strip=True) == str(score)


def test_analyzer_commands_and_seller_menu_keep_destinations(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """Native commands keep the existing POST, export functions and seller destinations."""
    response = client.get("/reports/revenue")
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="analyzer"]')
    for href in ["/revenue/import", "/products", "/revenue/config"]:
        assert root.select_one(f'a.sb-revenue-command[href="{href}"]')
    form = root.select_one("#reanalyze-form")
    assert form["method"] == "post"
    assert form["action"] == "/revenue/analyze"
    assert root.select_one('button[type="submit"][form="reanalyze-form"]')
    export = root.select_one("#reportExportBtnGroup")
    assert [button["onclick"] for button in export.select("button")] == [
        "exportReportCSV()", "copyReportForEmail()", "downloadReportEmail()",
    ]
    assert all("sb-revenue-command" in button["class"] for button in export.select("button"))
    assert "const CUSTOM_TITLE = 'Revenue Analyzer';" in response.get_data(as_text=True)
    assert root.select_one("#reportExportNoticeTemplate .sb-notice")
    trigger = root.select_one('[data-sb-menu="revenueSellersMenu"]')
    assert trigger["data-sb-menu-anchor"] == "trigger"
    assert trigger["aria-controls"] == "revenueSellersMenu"
    assert trigger["aria-haspopup"] == "menu"
    menu = root.select_one("#revenueSellersMenu")
    assert menu["popover"] == "manual"
    assert menu["role"] == "menu"
    assert menu.select_one('a[href="/revenue/seller/Review%20UI%20Seller"]')


def test_analyzer_preserves_category_values_and_import_metadata(
    client: FlaskClient, app: Flask, review_alert: dict[str, int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """All four summaries preserve counts, impact units and last-import metadata."""
    from app.models import Customer, RevenueAnalysis, RevenueImport, db

    with app.app_context():
        original = db.session.get(RevenueAnalysis, review_alert["alert"])
        original.dollars_at_risk = 1250
        for tpid, (category, risk, opportunity) in enumerate([
            ("RECENT_DIP", 250, 0),
            ("EXPANSION_OPPORTUNITY", 0, 500),
            ("VOLATILE", 0, 0),
        ], start=45124):
            customer = Customer(
                name=f"Category UI {category}", seller_id=review_alert["seller"], tpid=tpid,
            )
            db.session.add(customer)
            db.session.flush()
            db.session.add(RevenueAnalysis(
                customer_id=customer.id, customer_name=customer.name,
                seller_name=original.seller_name, bucket="Databases", category=category,
                recommended_action="CHECK-IN", priority_score=70, avg_revenue=5000,
                latest_revenue=4000, months_analyzed=6, dollars_at_risk=risk,
                dollars_opportunity=opportunity, confidence="HIGH",
            ))
        db.session.add(RevenueImport(
            filename="isolated-ui-test", imported_at=datetime(2026, 9, 28, tzinfo=timezone.utc),
        ))
        db.session.commit()
    monkeypatch.setattr("app.routes.revenue.get_months_in_database", lambda: ["Jan", "Feb"])
    soup = BeautifulSoup(client.get("/reports/revenue").data, "html.parser")
    summary = soup.select_one(".sb-revenue-categories")
    for category, expected in [
        ("DECLINING", "$1,250/mo at risk"),
        ("RECENT_DIP", "$250/mo at risk"),
        ("EXPANSION_OPPORTUNITY", "$500/mo opportunity"),
        ("VOLATILE", "Needs review"),
    ]:
        item = summary.select_one(f'[data-category="{category}"]')
        assert item.select_one(".sb-revenue-category-count").text == "1"
        assert expected in item.get_text(" ", strip=True)
    assert "(4)" in soup.select_one("#revenueCustomersHeading").get_text()
    metadata = soup.select_one(".sb-page-status > span:last-child")
    assert " ".join(metadata.get_text(" ", strip=True).split()) == (
        "Last import: Sep 28, 2026 (2 months)"
    )


@pytest.mark.parametrize("job, state", [
    ("revenue_sync", "incomplete"), ("revenue_sync", "failed"),
    ("revenue_analysis", "incomplete"), ("revenue_analysis", "failed"),
])
def test_revenue_job_notices_preserve_recovery_and_literal_details(
    client: FlaskClient, app: Flask, job: str, state: str,
) -> None:
    """Interrupted and failed jobs retain persistent recovery links or POST controls."""
    from app.models import SyncStatus, db

    started = datetime(2020, 1, 2, 12, tzinfo=timezone.utc)
    with app.app_context():
        db.session.add(SyncStatus(
            sync_type=job, started_at=started,
            completed_at=started if state == "failed" else None,
            success=False if state == "failed" else None, details='<Literal "failure">',
        ))
        db.session.commit()
    soup = BeautifulSoup(client.get("/reports/revenue").data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="analyzer"]')
    notices = root.select(".sb-revenue-job-notice")
    assert len(notices) == 1
    notice = notices[0]
    assert notice["role"] == "alert"
    assert notice["data-sb-tone"] == ("danger" if state == "failed" else "warning")
    assert not notice.select("[data-sb-notice-dismiss]")
    if job == "revenue_sync":
        assert notice.select_one('a[href="/revenue/import"]')
        if state == "incomplete":
            timestamp = notice.select_one(".local-datetime")
            assert timestamp["data-utc"].startswith("2020-01-02T12:00:00")
            assert timestamp["data-fmt"] == "short"
    else:
        form = notice.select_one('form[action="/revenue/analyze"]')
        assert form["method"] == "post"
        assert form.select_one('button[type="submit"]').text == "Re-run analysis"
    if state == "failed":
        assert '<Literal "failure">' in notice.get_text()
        assert not notice.find("literal")


def test_analyzer_empty_state_retains_import_guidance(client: FlaskClient) -> None:
    """No data has a distinct import action and zero category counts, not a blank table."""
    soup = BeautifulSoup(client.get("/reports/revenue").data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="analyzer"]')
    assert not root.select(".sb-revenue-job-notice, #revenueSellersMenu, #alertsTable")
    empty = root.select_one(".sb-revenue-page-empty")
    assert "No alerts yet" in empty.get_text()
    assert "Import revenue data to see customer alerts." in empty.get_text()
    assert empty.select_one('a[href="/revenue/import"]')
    assert [count.text for count in root.select(".sb-revenue-category-count")] == ["0"] * 4


def test_analyzer_seller_mode_retains_scoping_without_the_seller_menu(
    client: FlaskClient, app: Flask, review_alert: dict[str, int],
) -> None:
    """Seller mode hides cross-seller controls and still scopes rows server-side."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        db.session.add(RevenueAnalysis(
            customer_name="Other seller customer", seller_name="Other seller",
            bucket="Databases", category="DECLINING", recommended_action="CHECK-IN",
            priority_score=70, avg_revenue=5000, latest_revenue=4000, months_analyzed=6,
            confidence="HIGH",
        ))
        db.session.commit()
    assert client.post(f'/api/seller-mode/activate/{review_alert["seller"]}').status_code == 200
    soup = BeautifulSoup(client.get("/reports/revenue").data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="analyzer"]')
    assert not root.select("#revenueSellersMenu, [data-sb-menu], .sb-alert-seller")
    rows = root.select("#alertsTable tbody tr[data-analysis-id]")
    assert len(rows) == 1
    assert rows[0]["data-analysis-id"] == str(review_alert["alert"])
    assert "Other seller customer" not in root.get_text()


@pytest.mark.parametrize("matched, embedded", [(True, False), (False, False), (True, True)])
def test_seller_page_commands_and_embedding(
    client: FlaskClient, review_alert: dict[str, int], matched: bool, embedded: bool,
) -> None:
    """Seller Hub is conditional and embedded consumers omit only the existing page chrome."""
    name = "Review%20UI%20Seller" if matched else "Unmatched%20Seller"
    path = f"/revenue/seller/{name}" + ("?embed=1" if embedded else "")
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="seller"]')
    assert root["data-embedded"] == str(embedded).lower()
    if embedded:
        assert not root.select(".sb-revenue-page-header")
        assert not soup.select(".sb-context-bar")
        assert root.select_one("[data-sb-revenue-alerts]")
    else:
        bar = soup.select_one(".sb-context-bar")
        assert bar.select_one('a[href="/"]')
        if matched:
            assert bar.select_one(f'a[href="/seller/{review_alert["seller"]}"]')
            assert not bar.select_one('a[href="/reports/revenue"]')
        else:
            assert bar.select_one('a[href="/reports/revenue"]')
        assert bar.select_one('[aria-current="page"]')
        assert not root.select('nav[aria-label="Breadcrumb"]')
        assert root.select_one(f'a[href="/revenue/seller/{name}/products"]')
        assert root.select_one(f'a[href="/revenue/seller/{name}/export"]')
        hub = root.select_one(f'a[href="/seller/{review_alert["seller"]}"]')
        assert bool(hub) == matched


@pytest.mark.parametrize("path", [
    "/reports/revenue?embed=1", "/revenue/seller/Review%20UI%20Seller?embed=1",
])
def test_embedded_revenue_pages_omit_the_shell_context_bar(
    client: FlaskClient, review_alert: dict[str, int], path: str,
) -> None:
    """Embedding does not add outer navigation or duplicate breadcrumbs to the fragment."""
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert not soup.select(".sb-context-bar, .sb-app-bar")
    assert soup.select_one("[data-sb-revenue-page]")


@pytest.mark.parametrize("host", ["home", "dashboard", "customer", "seller_alerts", "seller"])
def test_editor_is_native_in_every_host(
    client: FlaskClient, review_alert: dict[str, int], host: str,
) -> None:
    """All consumers include one editor, one discard dialog and the shared helper."""
    paths = {
        "home": "/", "dashboard": "/reports/revenue",
        "customer": f'/customer/{review_alert["customer"]}/revenue',
        "seller_alerts": "/revenue/seller/Review%20UI%20Seller",
        "seller": f'/seller/{review_alert["seller"]}',
    }
    response = client.get(paths[host])
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    dialog = soup.find("dialog", id="reviewActionModal")
    assert dialog is not None
    assert len(soup.select("#reviewActionModal")) == 1
    assert len(soup.select("#reviewDiscardDialog")) == 1
    assert dialog["aria-labelledby"] == "reviewActionModalLabel"
    assert dialog["data-sb-backdrop-close"] == "true"
    assert not dialog.select(".modal, .btn, .form-control, [data-bs-dismiss], [onclick]")
    assert [field["value"] for field in dialog.select('[name="reviewStatus"]')] == [
        "new", "to_be_reviewed", "reviewed", "actioned", "dismissed",
    ]
    for field in dialog.select('[name="reviewStatus"], #reviewNotes'):
        assert dialog.select_one(f'label[for="{field["id"]}"]')
    assert dialog.find(id="reviewHistoryRetry")
    assert dialog.find(id="reviewResult")["aria-live"] == "polite"
    assert len(soup.select('script[src="/static/js/ui-revenue-review.js"]')) == 1


def test_review_macros_keep_literal_notes_and_identity(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """Imported macros use native controls and safely escaped attributes."""
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    button = soup.select_one(".review-action-btn")
    assert button["data-analysis-id"] == str(review_alert["alert"])
    assert button["data-notes"] == '<Draft "notes">'
    assert button["aria-label"] == "Set review status"
    assert "sb-review-button" in button["class"]
    assert not button.has_attr("onclick")
    assert soup.select_one(".review-badge").get_text(" ", strip=True) == "New"
    assert soup.select_one("[data-review-previous-id]")["data-review-previous-id"] == str(
        review_alert["alert"]
    )
    assert not soup.find("dialog")


def test_history_and_save_contracts_remain_unchanged(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """The existing API returns literal history, canonical notes and confirmed status."""
    alert_id = review_alert["alert"]
    history = client.get(f"/api/revenue/analysis/{alert_id}/review-history")
    assert history.status_code == 200
    assert history.json["history"][0]["review_notes"] == "<Literal history>"
    response = client.patch(f"/api/revenue/analysis/{alert_id}/review", json={
        "review_status": "actioned", "review_notes": '  <Quoted "notes">  ',
    })
    assert response.status_code == 200
    assert response.json["success"] is True
    assert response.json["review_status"] == "actioned"
    assert response.json["review_notes"] == '<Quoted "notes">'
    assert len(response.json["history"]) == 2


def test_preview_refresh_waits_for_confirmed_review_save() -> None:
    """Opening/cancelling review does not mark a preview dirty and reload its page."""
    root = Path(__file__).resolve().parents[1]
    template = (root / "static" / "js" / "ui-revenue-preview.js").read_text("utf-8")
    assert "event.target instanceof Element" in template
    assert "dialog.open && dialog.contains(event.target)" in template
    assert "document.addEventListener('sb:revenue-review-saved'" in template


@pytest.mark.parametrize("host", ["home", "dashboard", "seller_alerts", "seller"])
def test_alert_preview_is_native_and_has_identity_loader_controls(
    client: FlaskClient, review_alert: dict[str, int], host: str,
) -> None:
    """Every preview host uses one identified native frame and the same controller."""
    paths = {
        "home": "/", "dashboard": "/reports/revenue",
        "seller_alerts": "/revenue/seller/Review%20UI%20Seller",
        "seller": f'/seller/{review_alert["seller"]}',
    }
    response = client.get(paths[host])
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    dialog_id = "homeAlertDetailModal" if host == "home" else "alertDetailModal"
    title_id = "homeAlertTitle" if host == "home" else "alertDetailTitle"
    body_id = "homeAlertBody" if host == "home" else "alertDetailBody"
    dialog = soup.find("dialog", id=dialog_id)
    assert dialog is not None
    assert len(soup.select("[data-sb-revenue-preview]")) == 1
    assert dialog["aria-labelledby"] == title_id
    assert not dialog.select(".modal, .btn, [data-bs-dismiss]")
    for field in ["title", "full-link", "loading", "error", "retry", "content", "status"]:
        assert dialog.select_one(f"[data-sb-record-{field}]")
    assert dialog.select_one("[data-sb-record-full-link]")["href"] == "/reports/revenue"
    assert dialog.select_one(f"#{body_id}[data-sb-record-content]")
    assert len(soup.select('script[src="/static/js/ui-revenue-preview.js"][defer]')) == 1
    assert soup.select_one('link[href="/static/css/ui-revenue-detail.css"]')
    if host == "seller":
        assert dialog["data-sb-revenue-parent"] == "revenueModal"
        parent = soup.select_one("dialog#revenueModal")
        assert parent
        assert not parent.select(".modal, .btn, .card, .table, [data-bs-dismiss]")
        assert parent.select_one("[data-sb-revenue-status]")
        assert soup.select_one('[data-sb-dialog="revenueModal"]')
    else:
        assert not dialog.has_attr("data-sb-revenue-parent")


@pytest.mark.parametrize("host", ["dashboard", "seller_alerts", "seller"])
def test_alert_list_preserves_data_links_and_native_controls(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], host: str,
) -> None:
    """Shared lists retain every column, literal metadata and risk-first impact."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.customer_name = '<Literal "customer">'
        alert.engagement_rationale = '<Literal "rationale">'
        alert.dollars_at_risk = 1234
        alert.dollars_opportunity = 9000
        db.session.commit()
    paths = {
        "dashboard": "/reports/revenue",
        "seller_alerts": "/revenue/seller/Review%20UI%20Seller",
        "seller": f'/seller/{review_alert["seller"]}',
    }
    response = client.get(paths[host])
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-revenue-alerts]")
    assert root
    assert not root.select(".card, .badge, .table, .text-danger, [onclick]")
    table = root.select_one("#alertsTable")
    assert table.caption
    assert all(h["scope"] == "col" for h in table.select("thead th"))
    assert table.has_attr("data-sb-sortable")
    assert table["data-sb-sort-default-direction"] == "descending"
    assert all(header.get("data-sb-sort-type") for header in table.select("thead th"))
    for header in table.select("th[data-export-label]"):
        assert header["data-export-label"] == header.get_text(" ", strip=True)
    row = table.select_one(f'tr[data-analysis-id="{review_alert["alert"]}"]')
    assert row["data-customer-name"] == '<Literal "customer">'
    assert row["data-bucket"] == "Databases"
    assert row["data-alert-clickable"] == "true"
    assert len(row.find_all("td", recursive=False)) == len(table.select("thead th"))
    assert row.select_one(".sb-revenue-number")["data-tone"] == "warning"
    assert "$5,000" in row.get_text()
    assert "$1,234/mo risk" in row.get_text()
    assert row.select_one(".sb-revenue-money")["data-sb-sort-value"] == "5000.0"
    assert row.select(".sb-revenue-money")[1]["data-sb-sort-value"] == "1234.0"
    assert "$9,000/mo opp" not in row.get_text()
    assert row.select_one(".sb-revenue-rationale").get_text() == '<Literal "rationale">'
    assert row.select_one(".sb-revenue-category").get_text() == "Declining"
    assert row.select_one(".sb-revenue-category")["data-tone"] == "danger"
    assert row.select_one("[data-sb-revenue-open]")["type"] == "button"
    assert row.select_one(".review-action-btn")["data-analysis-id"] == str(review_alert["alert"])
    assert row.select_one("[data-review-previous-id]")
    hrefs = [a["href"] for a in row.select("a")]
    assert f'/customer/{review_alert["customer"]}/revenue' in hrefs
    assert f'/customer/{review_alert["customer"]}' in hrefs
    assert len(soup.select('script[src="/static/js/ui-revenue-alerts.js"][defer]')) == 1
    if host != "dashboard":
        summary = soup.select_one(".sb-revenue-list-summary") if host == "seller_alerts" else (
            root.select_one(".sb-revenue-list-summary")
        )
        assert summary.select_one("#revenueSummaryCount").get_text() == "1"
        assert len(summary.select("dt")) == len(summary.select("dd")) == 3
        assert "$1,234" in summary.get_text()
        assert "$9,000" in summary.get_text()


@pytest.mark.parametrize("status", ["new", "to_be_reviewed", "reviewed", "actioned", "dismissed"])
def test_alert_list_retains_status_and_review_identity(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], status: str,
) -> None:
    """Native rows retain all statuses without fading readable text through opacity."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        db.session.get(RevenueAnalysis, review_alert["alert"]).review_status = status
        db.session.commit()
    soup = BeautifulSoup(client.get("/reports/revenue").data, "html.parser")
    row = soup.select_one(f'#alertsTable tr[data-analysis-id="{review_alert["alert"]}"]')
    assert "opacity" not in row.get("style", "")
    assert row.select_one(".sb-review-badge")["data-status"] == status
    assert row.select_one(".review-action-btn")["data-status"] == status


def test_empty_alert_list_is_native(client: FlaskClient) -> None:
    """Seller alert lists preserve their healthy/below-threshold empty state."""
    response = client.get("/revenue/seller/No%20Alerts%20Seller")
    assert response.status_code == 200
    root = BeautifulSoup(response.data, "html.parser").select_one("[data-sb-revenue-alerts]")
    assert root.select_one('[role="status"]').get_text(" ", strip=True) == (
        "No alerts All customers are healthy or below thresholds."
    )
    assert not root.select_one("#alertsTable")
    assert not root.select(".card, .badge, .table")


@pytest.mark.parametrize("category,label,tone", [
    ("DECLINING", "Declining", "danger"), ("RECENT_DIP", "Recent Dip", "warning"),
    ("EXPANSION_OPPORTUNITY", "Expansion", "positive"), ("VOLATILE", "Volatile", "neutral"),
    ("HEALTHY", "Healthy", "neutral"), ("NEW_CUSTOMER", "New Customer", "accent"),
    ("CHURNED", "Churned", "neutral"), ("CUSTOM_CATEGORY", "Custom Category", "neutral"),
])
def test_detail_categories_preserve_labels_and_identity(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
    category: str, label: str, tone: str,
) -> None:
    """Every category renders native markup with the requested alert identity."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.category = category
        db.session.commit()
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one("[data-sb-revenue-detail]")
    assert root["data-sb-revenue-id"] == str(review_alert["alert"])
    assert not root.select(".card, .badge, .row, .col-6, .table, .btn, .text-danger")
    category_tag = root.select_one(".sb-revenue-category")
    assert category_tag.get_text(strip=True) == label
    assert category_tag["data-tone"] == tone
    assert [d.get_text(strip=True) for d in root.select(".sb-revenue-metrics dt")] == [
        "Avg Revenue", "Latest", "Trend", "Priority",
    ]
    assert [d.get_text(strip=True) for d in root.select(".sb-revenue-metrics dd")][:2] == [
        "$5,000", "$4,000",
    ]
    assert "CHECK-IN" in root.get_text()
    assert "months)" in root.select_one(".sb-revenue-review-meta").get_text()
    assert root.select_one(".review-action-btn")["data-analysis-id"] == str(review_alert["alert"])
    header_meta = root.select_one(".sb-revenue-detail-header .sb-revenue-header-meta")
    assert header_meta.select_one(".sb-revenue-category") == category_tag
    assert header_meta.select_one("[data-review-id]")["data-review-id"] == str(review_alert["alert"])
    assert header_meta.select_one(".sb-revenue-review-meta")
    assert header_meta.select_one(".review-action-btn")
    metadata_items = header_meta.find_all(recursive=False)
    assert len(metadata_items) == 4
    assert "sb-revenue-review-meta" in metadata_items[0]["class"]
    assert metadata_items[1]["data-review-id"] == str(review_alert["alert"])
    assert metadata_items[1].select_one('.sb-review-badge[data-status="new"]')
    assert metadata_items[2] == category_tag
    assert "review-action-btn" in metadata_items[3]["class"]
    assert len(root.select("[data-review-id]")) == 1
    assert len(root.select(".sb-revenue-review-meta")) == 1
    assert not root.select_one(".sb-revenue-products")


@pytest.mark.parametrize("priority,tone", [
    (80, "danger"), (79, "warning"), (60, "warning"), (59, "accent"),
    (40, "accent"), (39, "neutral"),
])
def test_detail_priority_thresholds(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], priority: int, tone: str,
) -> None:
    """Original priority severity thresholds are preserved at their boundaries."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.priority_score = priority
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    assert soup.select(".sb-revenue-metrics dd")[-1]["data-tone"] == tone


@pytest.mark.parametrize("trend,tone", [
    (-3.1, "danger"), (-3.0, "neutral"), (3.0, "neutral"), (3.1, "positive"),
])
def test_detail_trend_thresholds(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], trend: float, tone: str,
) -> None:
    """Monthly trend semantics remain unchanged, including exact neutral thresholds."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.trend_slope = trend
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    field = soup.select(".sb-revenue-metrics dd")[2]
    assert field["data-tone"] == tone
    assert field.get_text(strip=True) == f"{trend:+.1f}%/mo"


@pytest.mark.parametrize("risk,opportunity,expected", [
    (200, 100, "$200/mo at risk"), (0, 100, "$100/mo opportunity"), (0, 0, None),
])
def test_detail_no_action_keeps_impact_without_inventing_guidance(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
    risk: int, opportunity: int, expected: str | None,
) -> None:
    """No-action alerts still show dollar impact and preserve risk-before-opportunity."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.recommended_action = "NO ACTION"
        alert.dollars_at_risk = risk
        alert.dollars_opportunity = opportunity
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    guidance = soup.select_one(".sb-revenue-guidance")
    assert not soup.find("strong")
    if expected:
        assert guidance.get_text(strip=True) == expected
    else:
        assert guidance is None
        assert soup.select_one(".sb-revenue-summary")["data-guidance"] == "false"


def test_unmatched_detail_is_an_identified_empty_state_and_missing_is_404(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """A valid unmatched alert is distinct from missing/error HTML in the native loader."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.customer_id = None
        db.session.commit()
    response = client.get(f'/api/revenue/analysis/{review_alert["alert"]}/detail')
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert soup.select_one("[data-sb-revenue-id]")["data-sb-revenue-id"] == str(review_alert["alert"])
    assert soup.select_one('[role="status"]').get_text(strip=True) == (
        "No matched customer for this alert."
    )
    assert not soup.select(".sb-revenue-metrics, .review-action-btn")
    assert client.get("/api/revenue/analysis/999999/detail").status_code == 404


@pytest.mark.parametrize("host", ["detail", "customer", "bucket"])
def test_product_breakdown_preserves_recent_seven_months_totals_links_and_change_colors(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
    host: str,
) -> None:
    """All three hosts retain monthly, zero, negative and all-history total semantics."""
    from app.models import CustomerRevenueData, ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    months = ["FY26-Jul", "FY26-Aug", "FY26-Sep", "FY26-Oct",
              "FY26-Nov", "FY26-Dec", "FY26-Jan", "FY26-Feb"]
    revenues = [100, 90, 80, 88, 100, 0, -20, 40]
    product = '<SQL & "test">'
    with app.app_context():
        imported = RevenueImport(filename="isolated-detail-test", record_count=8)
        db.session.add(imported)
        db.session.flush()
        for month, revenue in zip(months, revenues):
            common = {
                "customer_name": "Review UI Customer", "customer_id": review_alert["customer"],
                "bucket": "Databases", "fiscal_month": month,
                "month_date": fiscal_month_to_date(month), "revenue": revenue,
                "last_import_id": imported.id,
            }
            db.session.add(CustomerRevenueData(**common))
            db.session.add(ProductRevenueData(product=product, **common))
        db.session.commit()
    path = {
        "detail": f'/api/revenue/analysis/{review_alert["alert"]}/detail',
        "customer": f'/revenue/customer/{review_alert["customer"]}',
        "bucket": f'/customer/{review_alert["customer"]}/revenue/bucket/Databases',
    }[host]
    response = client.get(path)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    table = soup.select_one(".sb-revenue-table")
    assert [h.get_text(strip=True) for h in table.select("thead th")] == [
        "Product", *months[1:], "Total",
    ]
    assert table.find("caption")
    assert table.has_attr("data-sb-sortable")
    assert all(h.get("data-sb-sort-type") for h in table.select("thead th"))
    assert all(h["scope"] == "col" for h in table.select("thead th"))
    assert all(h["scope"] == "row" for h in table.select("tbody th"))
    rows = table.select("tbody tr")
    assert len(rows) == (1 if host == "bucket" else 2)
    for row in rows:
        cells = row.select("td")
        assert [float(cell["data-sb-sort-value"]) for cell in cells] == [
            *revenues[1:], sum(revenues),
        ]
        assert [c.get_text(strip=True) for c in cells] == [
            "$90", "$80", "$88", "$100", "-", "$-20", "$40", "$478",
        ]
        assert cells[1].select_one('[data-tone="danger"]')
        assert not cells[2].select_one("[data-tone]")
        assert cells[3].select_one('[data-tone="positive"]')
        assert not cells[5].select_one("[data-tone]")
    assert rows[-1].find("a").get_text(strip=True) == product
    assert "<SQL" not in str(rows[-1])
    if host == "detail":
        assert soup.select_one(".sb-revenue-products-header a")["href"] == (
            f'/customer/{review_alert["customer"]}/revenue'
        )
    elif host == "customer":
        assert soup.select_one(".sb-revenue-products-header a")["href"] == (
            f'/customer/{review_alert["customer"]}/revenue/bucket/Databases'
        )
    else:
        history = soup.select_one("#fullHistory .sb-revenue-history-table")
        assert not soup.select_one("#fullHistory").has_attr("open")
        full_rows = history.select("tbody tr")
        assert [r.find("th").text for r in full_rows] == list(reversed(months))
        assert [r.select("td")[0].text for r in full_rows] == [
            "$40", "$-20", "$0", "$100", "$88", "$80", "$90", "$100",
        ]
        assert [r.select("td")[1].get_text(strip=True) for r in full_rows] == [
            "-", "-", "-100.0%", "+13.6%", "+10.0%", "-11.1%", "-10.0%", "-",
        ]
        assert full_rows[2].select_one('[data-tone="danger"]')
        assert full_rows[3].select_one('[data-tone="positive"]')
        assert not full_rows[4].select_one("[data-tone]")
        assert not full_rows[6].select_one("[data-tone]")
        assert soup.select_one(".sb-revenue-bucket-scope").get_text(" ", strip=True).endswith(
            "FY26-Jul to FY26-Feb"
        )
        assert history.find("caption")
        assert history["data-sb-sort-default-direction"] == "descending"
        assert all(h.get("data-sb-sort-type") for h in history.select("thead th"))
        assert [row.find("th")["data-sb-sort-value"] for row in full_rows] == [
            fiscal_month_to_date(month).isoformat() for month in reversed(months)
        ]
        assert full_rows[0].select("td")[1]["data-sb-sort-value"] == ""
        assert float(full_rows[2].select("td")[1]["data-sb-sort-value"]) == -100


def test_product_sort_keys_keep_missing_months_distinct_from_real_zero_and_rounded_values(
    app: Flask,
) -> None:
    """Sorting uses imported values, never invented zeroes or rounded display dollars."""
    with app.test_request_context():
        html = app.jinja_env.get_template("partials/_revenue_product_table.html").render(
            revenue_bucket="Data", bucket_data={
                "recent_months": ["FY26-Jul", "FY26-Aug"],
                "product_summary": [
                    {"product": "Zero", "month_revenues": {
                        "FY26-Jul": 0, "FY26-Aug": 1.234,
                    }, "total_revenue": 1.234},
                    {"product": "Missing", "month_revenues": {
                        "FY26-Aug": 0.001,
                    }, "total_revenue": 0.001},
                ],
            },
        )
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("tbody tr:not([data-sb-sort-fixed])")
    assert rows[0].select("td")[0]["data-sb-sort-value"] == "0"
    assert rows[1].select("td")[0]["data-sb-sort-value"] == ""
    assert rows[0].select("td")[0].get_text(strip=True) == "-"
    assert rows[1].select("td")[0].get_text(strip=True) == "-"
    assert rows[0].select("td")[1]["data-sb-sort-value"] == "1.234"
    assert rows[0].select("td")[1].get_text(strip=True) == "$1"
    assert rows[1].select("td")[1]["data-sb-sort-value"] == "0.001"
    assert rows[1].select("td")[1].get_text(strip=True) == "$0"


@pytest.mark.parametrize("path", [
    "/revenue/customer/{customer}/bucket/Databases",
    "/customer/{customer}/revenue/bucket/Databases",
])
@pytest.mark.parametrize("embedded", [False, True])
def test_bucket_history_native_composition_and_embed_boundary(
    client: FlaskClient, review_alert: dict[str, int], path: str, embedded: bool,
) -> None:
    """Bucket drilldowns share domain content without duplicate scope navigation."""
    url = path.format(**review_alert) + ("?embed=1" if embedded else "")
    response = client.get(url)
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="bucket"][data-sb-page-surface]')
    assert root.select_one('[data-sb-page-body]')
    assert root.select_one('.sb-revenue-bucket-context[tabindex="0"]')
    assert root.select_one('.sb-revenue-bucket-reading[role="region"][tabindex="0"]')
    assert not root.select(".card, .btn, .badge, .table, .alert, [data-bs-toggle]")
    assert not root.select("[data-bucket], #bucketFilterContainer, nav")
    assert root.select_one("details#fullHistory > summary")
    assert not root.select_one("#fullHistory").has_attr("open")
    assert not root.select("table")  # The isolated fixture has analysis, but no product data.
    assert "No product data available" in root.get_text()
    assert "No product history available" in root.get_text()
    assert root.select_one(".review-action-btn")["data-analysis-id"] == str(review_alert["alert"])
    assert len(soup.select("#reviewActionModal")) == 1
    assert root.select_one("a.sb-revenue-command")["href"] == (
        f'/customer/{review_alert["customer"]}/revenue'
    )
    if embedded:
        assert "sb-page-frame" not in soup.body.get("class", [])
        assert not soup.select(".sb-app-bar, .sb-context-bar, footer")
    else:
        assert "sb-page-frame" in soup.body["class"]
        assert soup.select_one(".sb-context-bar [aria-current='page'] > span[title]").text == (
            "Databases Products"
        )
        assert soup.select_one("body > footer.sb-page-status").get_text(" ", strip=True) == (
            "0 products, 0 recent months Product totals include all imported months"
        )


@pytest.mark.parametrize("category", ["HEALTHY", "CHURNED"])
def test_bucket_history_preserves_no_action_rationale_without_changing_preview_defaults(
    app: Flask, client: FlaskClient, review_alert: dict[str, int], category: str,
) -> None:
    """Original bucket rationale remains visible even when no engagement is recommended."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.category = category
        alert.recommended_action = "NO ACTION"
        alert.engagement_rationale = '<Existing "context">'
        alert.dollars_at_risk = 0
        alert.dollars_opportunity = 0
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/customer/{review_alert["customer"]}/revenue/bucket/Databases'
    ).data, "html.parser")
    analysis = soup.select_one(".sb-revenue-bucket-analysis")
    assert analysis.select_one(".sb-revenue-guidance p").text == '<Existing "context">'
    assert "<Existing" not in str(analysis)
    assert analysis.select_one(".sb-revenue-category").get_text(strip=True) == (
        "Inactive" if category == "CHURNED" else "Healthy"
    )
    preview = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    assert not preview.select_one(".sb-revenue-guidance")


def test_bucket_history_missing_analysis_is_not_an_empty_analysis_panel(
    client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """A bucket without analysis or products has distinct honest empty states."""
    soup = BeautifulSoup(client.get(
        f'/customer/{review_alert["customer"]}/revenue/bucket/No%20data'
    ).data, "html.parser")
    root = soup.select_one('[data-sb-revenue-page="bucket"]')
    assert "No analysis available for this bucket." in root.get_text()
    assert "No product data available for this bucket." in root.get_text()
    assert "No product history available for this bucket." in root.get_text()
    assert not root.select(".sb-revenue-bucket-analysis, .review-action-btn, table")
    assert not soup.select("#reviewActionModal")


@pytest.mark.parametrize("path", [
    "/revenue/customer/{customer}", "/customer/{customer}/revenue",
])
def test_customer_revenue_has_connected_native_regions_and_shared_analysis(
    client: FlaskClient, review_alert: dict[str, int], path: str,
) -> None:
    """Both customer aliases preserve analysis, review and ancestry in a native shell."""
    response = client.get(path.format(**review_alert))
    assert response.status_code == 200
    soup = BeautifulSoup(response.data, "html.parser")
    assert "sb-page-frame" in soup.body["class"]
    root = soup.select_one('[data-sb-revenue-page="customer"][data-sb-page-surface]')
    assert root.select_one('[data-sb-page-body][role="region"][tabindex="0"]')
    assert root.select_one('[data-sb-customer-nav][hidden]')
    assert root.select_one('[data-sb-customer-bucket="Databases"]')["href"] == (
        f'#analysis-{review_alert["alert"]}'
    )
    assert not root.select("[data-sb-customer-overview-link]")
    assert root.select_one(".sb-revenue-customer-context [data-sb-customer-analysis]")
    assert root.select_one(".sb-revenue-customer-history-area")
    assert not root.has_attr("data-sb-customer-enhanced")  # Stacked SSR fallback.
    assert root.select_one('a.sb-revenue-command[href="/customer/' +
                           str(review_alert["customer"]) + '"]')
    assert not root.select(".card, .btn, .badge, .row, .table, .alert, .table-responsive")
    assert not root.select("nav[aria-label='Breadcrumb']")
    assert soup.select_one(
        ".sb-context-bar [aria-current='page'] > span[title]"
    ).text == "Revenue"
    detail = root.select_one("[data-sb-customer-analysis]")
    preview = BeautifulSoup(client.get(
        f'/api/revenue/analysis/{review_alert["alert"]}/detail'
    ).data, "html.parser")
    for selector in (".sb-revenue-detail-header", ".sb-revenue-summary", ".sb-review-previous"):
        assert detail.select_one(selector).get_text(strip=True) == (
            preview.select_one(selector).get_text(strip=True)
        )
    assert not detail.select_one("h3 a")  # No invented anchor when history is absent.
    assert detail.select_one(".review-action-btn")["data-notes"] == '<Draft "notes">'
    assert len(soup.select("#reviewActionModal")) == 1
    assert soup.select_one("[data-sb-customer-revenue-status]")
    assert "Totals include all buckets and all imported months" in soup.get_text()


def test_customer_revenue_totals_and_bucket_links_preserve_scope(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
) -> None:
    """Filtering does not recalculate all-bucket totals or remove history destinations."""
    from app.models import CustomerRevenueData, ProductRevenueData, RevenueImport, db
    from app.services.revenue_import import fiscal_month_to_date

    with app.app_context():
        imported = RevenueImport(filename="isolated-customer-test", record_count=2)
        db.session.add(imported)
        db.session.flush()
        for bucket, revenue in [("Databases", 100), ("Fabric", 200)]:
            common = {
                "customer_name": "Review UI Customer", "customer_id": review_alert["customer"],
                "bucket": bucket, "fiscal_month": "FY26-Jul",
                "month_date": fiscal_month_to_date("FY26-Jul"), "revenue": revenue,
                "last_import_id": imported.id,
            }
            db.session.add(CustomerRevenueData(**common))
            if bucket == "Databases":
                db.session.add(ProductRevenueData(product="SQL", **common))
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/revenue/customer/{review_alert["customer"]}'
    ).data, "html.parser")
    total = soup.select_one("#bucket-total")
    assert not total.has_attr("data-bucket")
    assert total.select_one("table[data-sb-sortable]")
    assert total.select_one("tbody tr[data-sb-sort-fixed]")
    assert all(header.get("data-sb-sort-type") for header in total.select("thead th"))
    assert total.select_one("tbody tr").get_text(" ", strip=True) == "All Buckets $300 $300"
    assert [row["data-bucket"] for row in total.select("tr[data-bucket]")] == [
        "Databases", "Fabric",
    ]
    assert total.select_one('a[href="#bucket-fabric"]')
    assert soup.select_one('[data-sb-customer-overview-link]')["href"] == "#bucket-total"
    assert [item["data-sb-customer-bucket"] for item in soup.select(
        "[data-sb-customer-bucket]"
    )] == ["Databases", "Fabric"]
    assert not soup.select("[data-sb-customer-bucket][data-bucket]")
    assert soup.select_one("[data-sb-customer-analysis] h3 a")["href"] == "#bucket-databases"
    assert soup.select_one("#bucket-fabric .sb-revenue-empty").text == (
        "No product data available for this bucket."
    )
    assert not soup.select_one("#bucket-fabric a")
    assert soup.select_one("#bucket-databases .sb-revenue-products-header a")
    assert soup.select_one("#bucket-databases table tbody a")["href"] == "/product/SQL"


@pytest.mark.parametrize("category,label,tone", [
    ("DECLINING", "Declining", "danger"), ("RECENT_DIP", "Recent Dip", "warning"),
    ("EXPANSION_OPPORTUNITY", "Expansion", "positive"), ("VOLATILE", "Volatile", "neutral"),
    ("HEALTHY", "Healthy", "neutral"), ("NEW_CUSTOMER", "New Customer", "accent"),
    ("CHURNED", "Inactive", "neutral"), ("CUSTOM_CATEGORY", "Custom Category", "neutral"),
])
def test_customer_analysis_preserves_category_labels_and_tones(
    app: Flask, client: FlaskClient, review_alert: dict[str, int],
    category: str, label: str, tone: str,
) -> None:
    """Customer labels retain Inactive while the shared preview retains Churned."""
    from app.models import RevenueAnalysis, db

    with app.app_context():
        alert = db.session.get(RevenueAnalysis, review_alert["alert"])
        alert.category = category
        db.session.commit()
    soup = BeautifulSoup(client.get(
        f'/revenue/customer/{review_alert["customer"]}'
    ).data, "html.parser")
    tag = soup.select_one(".sb-revenue-category")
    assert tag.get_text(strip=True) == label
    assert tag["data-tone"] == tone


def test_customer_revenue_empty_and_embedded_views_do_not_invent_analysis(
    app: Flask, client: FlaskClient,
) -> None:
    """Customers without imported records retain explicit empty feedback and embed boundaries."""
    from app.models import Customer, db

    with app.app_context():
        customer = Customer(name="No imported data", tpid=56789)
        db.session.add(customer)
        db.session.commit()
        customer_id = customer.id
    for suffix in ("", "?embed=1"):
        soup = BeautifulSoup(client.get(
            f"/revenue/customer/{customer_id}{suffix}"
        ).data, "html.parser")
        root = soup.select_one('[data-sb-revenue-page="customer"]')
        assert not root.select("[data-sb-customer-analysis], [data-sb-customer-history], table")
        assert "No revenue history found for this customer." in soup.get_text()
        assert bool(soup.select(".sb-page-status")) == (not suffix)
        assert ("sb-page-frame" in soup.body.get("class", [])) == (not suffix)
