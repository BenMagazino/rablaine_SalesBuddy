"""Capacity investigation stays complete while dashboard previews stay deliberately small."""
from datetime import date

from bs4 import BeautifulSoup
import pytest

from app.services import fabric_consumption as service
from app.services.salesiq_tools import execute_tool
from tests.test_fabric_renewal_widgets import capacity_row, set_capacities, render_widget


REFERENCE = date(2026, 10, 18)


@pytest.fixture
def pressure_snapshot(monkeypatch):
    """Mix more attention rows than a widget can show with unknown and healthy records."""
    rows = [
        capacity_row(str(index), throttling_seconds=index * 3600)
        for index in range(1, 9)
    ] + [
        capacity_row('healthy'),
        capacity_row('unknown', latest_utilization_pct=None),
        capacity_row('near', latest_utilization_pct=90),
    ]
    rows[0]['name'] = '<script>bad()</script>'
    return set_capacities(monkeypatch, rows, {
        'capacity_as_of': '2026-10-14T20:00:00+00:00',
        'imported_at': '2026-10-15', 'capacity_window': 'Saved source history',
    })


def test_widget_top_five_attention_only_and_complete_counts(pressure_snapshot):
    """Widget previews must not become embedded full reports or hide a truncated total."""
    report = service.get_fabric_capacity_pressure_report(REFERENCE)
    widget = service.get_fabric_capacity_pressure_widget(REFERENCE)
    assert len(report['rows']) == 11
    assert len(widget['rows']) == widget['shown_count'] == widget['preview_limit'] == 5
    assert widget['remaining_count'] == 4
    assert widget['counts'] == report['counts']
    assert widget['counts']['attention'] == 9
    assert all(row['attention'] for row in widget['rows'])
    assert widget['rows'] == [row for row in report['rows'] if row['attention']][:5]
    page = BeautifulSoup(render_widget('fabric_capacity_pressure', widget), 'html.parser')
    assert not page.select('table')
    assert len(page.select('.db-pressure-preview li')) == 5
    assert 'Top 5 of 9' in page.get_text()
    assert page.select_one('.db-report-heading a')['href'] == '/reports/fabric-capacity-pressure'
    compact = BeautifulSoup(render_widget('fabric_capacity_pressure', widget, 'metric'),
                            'html.parser')
    assert not compact.select('table, .db-pressure-preview')


@pytest.mark.parametrize('variant', ['metric', 'detailed'])
def test_widget_shows_only_core_metrics_and_one_report_link(pressure_snapshot, variant):
    """Keep measurement metadata in the report instead of repeating it in the widget."""
    data = service.get_fabric_capacity_pressure_widget(REFERENCE)
    assert data['counts']['unknown'] == 1
    assert data['capacity_as_of_date'] == '2026-10-14'
    page = BeautifulSoup(render_widget('fabric_capacity_pressure', data, variant), 'html.parser')
    assert [label.get_text() for label in page.select('.db-report-metrics dt')] == [
        'Need attention', 'Throttling recorded',
    ]
    links = page.select('a[href="/reports/fabric-capacity-pressure"]')
    assert len(links) == 1
    assert links[0].get_text(strip=True).startswith('Open report')
    assert not page.select('.db-report-notice')
    text = page.get_text()
    assert 'Measurements:' not in text
    assert 'incomplete' not in text.lower()
    assert 'View all in report' not in text


@pytest.mark.parametrize(('signal', 'count'), [
    ('all', 11), ('attention', 9), ('throttled', 8), ('near_limit', 1),
    ('overloaded', 0), ('historical_spike', 0), ('unknown', 1), ('below_threshold', 1),
])
def test_full_report_filters_preserve_portfolio_counts(pressure_snapshot, signal, count):
    """Each signal filters its own flag without changing full-population summary totals."""
    data = service.get_fabric_capacity_pressure_report(REFERENCE, signal=signal)
    assert len(data['rows']) == data['matching_count'] == count
    assert data['counts']['capacities'] == 11
    assert data['snapshot_state'] == 'available'


def test_report_routes_navigation_search_sort_and_tool(client, app, pressure_snapshot):
    """The real report owns every capacity and is reachable independently of a dashboard."""
    response = client.get('/reports/fabric-capacity-pressure?signal=all')
    assert response.status_code == 200
    page = BeautifulSoup(response.data, 'html.parser')
    assert page.select_one('h1').get_text() == 'Fabric Capacity Pressure'
    assert len(page.select('#fabricPressureTable tbody tr')) == 11
    assert page.select_one('#navReports a[href="/reports/fabric-capacity-pressure"]')
    assert page.select_one('a.sb-pressure-seller .bi-person')
    assert page.select_one('#fabricPressureTable [data-sb-sort-value="28800.0"]') or (
        page.select_one('#fabricPressureTable [data-sb-sort-value="28800"]')
    )
    assert not page.select('#fabricPressureTable script')
    assert '<script>bad()</script>' in page.get_text()
    filtered = client.get('/api/reports/fabric-capacity-pressure?q=near').json
    assert len(filtered['rows']) == 1
    assert filtered['rows'][0]['capacity']['capacity_id'] == 'near'
    assert filtered['counts']['capacities'] == 11
    assert client.get('/api/reports/fabric-capacity-pressure?signal=invalid').status_code == 400
    assert client.get('/reports/fabric-capacity-pressure?signal=invalid').status_code == 400
    hub = BeautifulSoup(client.get('/reports').data, 'html.parser')
    assert hub.select_one('a[href="/reports/fabric-capacity-pressure"]')
    with app.test_request_context():
        data = execute_tool('report_fabric_capacity_pressure', {'signal': 'all'})
        assert len(data['rows']) == 11


def test_report_omits_missing_account_warning_without_changing_counts(client, monkeypatch):
    """Accounts without capacity data stay out of capacity counts without a warning line."""
    set_capacities(monkeypatch, [
        capacity_row(throttling_seconds=3600),
        {'id': 8, 'name': 'Account without capacity data', 'capacity': None},
    ], {'capacity_as_of': '2026-10-14T20:00:00+00:00'})
    data = client.get('/api/reports/fabric-capacity-pressure').json
    assert data['counts']['customers_without_capacity'] == 1
    assert data['counts']['capacities'] == 1
    assert data['counts']['attention'] == 1
    page = BeautifulSoup(client.get('/reports/fabric-capacity-pressure').data, 'html.parser')
    assert not page.select('.sb-pressure-warning')
    assert len(page.select('#fabricPressureTable tbody tr')) == 1


def test_report_labels_distinguish_latest_hour_from_full_period(client, pressure_snapshot):
    """A latest-hour peak below the long-term average must not look contradictory."""
    page = BeautifulSoup(client.get('/reports/fabric-capacity-pressure').data, 'html.parser')
    headings = [cell.get_text() for cell in page.select('#fabricPressureTable thead th')]
    assert headings[2:5] == ['15-day avg %', 'Latest hour %', 'Latest-hour peak (30s) %']
    assert 'It can be lower than the 15-day average.' in page.get_text()
    assert 'Historical spike' not in page.get_text()
    assert page.select_one('option[value="historical_spike"]').get_text() == (
        'Latest-hour peak at/above 100%'
    )


def test_widget_peak_reading_identifies_latest_hour(monkeypatch):
    """The same peak metric keeps its time-window context when surfaced in the shortlist."""
    set_capacities(monkeypatch, [capacity_row(max_30s_utilization_pct=110)], {})
    data = service.get_fabric_capacity_pressure_widget(REFERENCE)
    page = BeautifulSoup(render_widget('fabric_capacity_pressure', data), 'html.parser')
    assert page.select_one('.db-pressure-reading').get_text(strip=True) == (
        '110.0%latest-hour peak (30s)'
    )


@pytest.mark.parametrize(('stored', 'expected', 'display'), [
    (37.4567, 37.4567, '37.5%'),
    (125.678, 125.678, '125.7%'),
    (0, 0, '0.0%'),
    (None, None, 'Not supplied'),
    (float('nan'), None, 'Not supplied'),
    (float('inf'), None, 'Not supplied'),
])
def test_report_includes_stored_average_with_raw_numeric_sort_values(
    client, monkeypatch, stored, expected, display,
):
    """Read the retained-history average, not the latest or peak, without inventing zero."""
    set_capacities(monkeypatch, [
        capacity_row(utilization_pct=stored, latest_utilization_pct=105),
    ], {'capacity_as_of': '2026-10-14T20:00:00+00:00'})
    data = service.get_fabric_capacity_pressure_report(REFERENCE)
    assert data['rows'][0]['utilization_pct'] == expected
    page = BeautifulSoup(client.get('/reports/fabric-capacity-pressure').data, 'html.parser')
    heading = page.select('#fabricPressureTable thead th')[2]
    assert heading.get_text() == '15-day avg %'
    assert heading['data-sb-sort-type'] == 'number'
    cell = page.select('#fabricPressureTable tbody tr td')[2]
    assert cell.get_text() == display
    assert cell['data-sb-sort-value'] == (str(float(expected)) if expected is not None else '')
    assert data['counts']['overloaded'] == 1
    assert data['counts']['unknown'] == 0


def test_no_pressure_does_not_fill_widget_with_healthy_or_unknown_capacities(monkeypatch):
    """No shortlist is different from missing data and from a healthy portfolio claim."""
    set_capacities(monkeypatch, [
        capacity_row('healthy'), capacity_row('unknown', latest_utilization_pct=None),
    ], {'capacity_as_of': None})
    widget = service.get_fabric_capacity_pressure_widget(REFERENCE)
    assert widget['rows'] == []
    assert widget['counts']['capacities'] == 2
    assert widget['counts']['unknown'] == 1
    assert 'No recorded pressure signals.' in render_widget(
        'fabric_capacity_pressure', widget,
    )


@pytest.mark.parametrize(('snapshot', 'message'), [
    (None, 'No saved Fabric snapshot'), ({}, 'No saved capacities to assess'),
])
def test_full_report_empty_states_remain_actionable(client, monkeypatch, snapshot, message):
    """A missing snapshot and an empty snapshot must not masquerade as healthy capacity."""
    set_capacities(monkeypatch, [], snapshot)
    response = client.get('/reports/fabric-capacity-pressure')
    assert response.status_code == 200
    page = BeautifulSoup(response.data, 'html.parser')
    assert message in page.get_text()
    assert page.select_one('a[href="/reports/fabric-consumption"]')
    assert not page.select('.sb-fabric-pressure table')


def test_unmatched_search_does_not_claim_snapshot_is_empty(client, pressure_snapshot):
    """An empty filter result still discloses the full saved population."""
    data = client.get('/api/reports/fabric-capacity-pressure?q=no-such-capacity').json
    assert data['snapshot_state'] == 'available'
    assert data['matching_count'] == 0
    assert data['counts']['capacities'] == 11
    html = client.get('/reports/fabric-capacity-pressure?q=no-such-capacity').get_data(
        as_text=True,
    )
    assert 'No capacities match these filters' in html


@pytest.mark.parametrize(('seconds', 'reading'), [
    (0.01, '0.01s'), (1, '1s'), (60, '1.0m'), (1200, '20.0m'), (3600, '1.0h'),
])
def test_widget_throttling_units_do_not_round_positive_signals_to_zero(
    monkeypatch, seconds, reading,
):
    """Short durations must stay meaningful instead of showing misleading zero hours."""
    set_capacities(monkeypatch, [capacity_row(throttling_seconds=seconds)], {
        'capacity_as_of': None,
    })
    data = service.get_fabric_capacity_pressure_widget(REFERENCE)
    page = BeautifulSoup(render_widget('fabric_capacity_pressure', data), 'html.parser')
    assert page.select_one('.db-pressure-reading strong').get_text() == reading
