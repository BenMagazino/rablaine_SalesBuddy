"""Initiative widgets share live report summaries and preserve money semantics."""
from dataclasses import replace
from unittest.mock import Mock

from bs4 import BeautifulSoup
import pytest

from app.models import (
    Customer, Engagement, ManagerInitiativeItem, ManagerInitiativeSection,
    Milestone, Project, Seller, db,
)
from app.services import connect_goals, dashboards
from app.services.manager_one_on_one import (
    get_manager_one_on_one_report, summarize_initiative_items,
)
from app.services.salesiq_tools import execute_tool
from tests.test_dashboards import BASE, add_widget, create_dashboard

KEY = 'initiative_tracker.overview'


@pytest.fixture
def initiative_portfolio(app) -> dict:
    """Include overlapping work, missing estimates, internal work, and a lost record."""
    with app.app_context():
        alice, bob = Seller(name='Alice'), Seller(name='Bob')
        first = Customer(name='First customer', tpid=990101, seller=alice)
        second = Customer(name='Second customer', tpid=990102, seller=bob)
        unassigned = Customer(name='Unassigned customer', tpid=990103)
        milestones = [
            Milestone(
                customer=customer, title=f'Milestone {index}', monthly_usage=amount,
                msx_milestone_id=f'WIDGET-{index}', url=f'https://example.com/{index}',
                msx_status='On Track',
            )
            for index, (customer, amount) in enumerate(
                ((first, 5000), (second, 3000), (unassigned, 0), (first, None)),
            )
        ]
        engagement = Engagement(
            customer=first, title='Data modernization', status='Active', estimated_acr=9000,
        )
        engagement.milestones.append(milestones[0])
        engagement.milestones.append(Milestone(
            customer=first, title='Not directly added', monthly_usage=70000,
            msx_milestone_id='WIDGET-LINKED-ONLY', url='https://example.com/linked-only',
            msx_status='On Track',
        ))
        project = Project(title='Internal enablement')
        section = ManagerInitiativeSection(name='Modernize data')
        for milestone in milestones:
            section.items.append(ManagerInitiativeItem(
                item_type='milestone', milestone=milestone,
                title_snapshot=milestone.title, customer_snapshot=milestone.customer.name,
            ))
        section.items.extend([
            ManagerInitiativeItem(
                item_type='engagement', engagement=engagement,
                title_snapshot=engagement.title, customer_snapshot=first.name,
            ),
            ManagerInitiativeItem(
                item_type='project', project=project,
                title_snapshot=project.title, customer_snapshot='Internal project',
            ),
            ManagerInitiativeItem(
                item_type='milestone', title_snapshot='Deleted milestone',
                customer_snapshot='Former customer',
            ),
        ])
        empty = ManagerInitiativeSection(name='Plan next quarter')
        db.session.add_all([section, empty])
        db.session.commit()
        return {
            'section_id': section.id, 'empty_id': empty.id,
            'alice_id': alice.id, 'bob_id': bob.id, 'second_customer_id': second.id,
            'milestone_id': milestones[0].id,
        }


def test_shared_summary_combines_engagements_and_direct_milestones(
    app, initiative_portfolio,
):
    """Sum directly added work without expanding engagements into linked milestones."""
    with app.app_context():
        section = get_manager_one_on_one_report()['sections'][0]
        assert section['summary'] == {
            'item_count': 7, 'unavailable_count': 1,
            'acr': 17000, 'acr_count': 6, 'acr_missing_count': 2,
        }
        groups = {group['seller_name']: group['summary'] for group in section['seller_groups']}
        assert groups['Alice']['acr'] == 14000
        assert groups['Alice']['acr_missing_count'] == 1
        assert groups['Bob']['acr'] == 3000
        assert groups['No seller']['acr'] == 0
        assert groups['No seller']['acr_missing_count'] == 1
        assert sum(group['acr'] for group in groups.values()) == section['summary']['acr']
        empty = get_manager_one_on_one_report()['sections'][1]['summary']
        assert empty['acr'] is None
        assert empty['acr_count'] == 0
        assert empty['item_count'] == 0


@pytest.mark.parametrize(('amounts', 'expected', 'missing'), [
    ((None, None), None, 2),
    ((0, None), 0, 1),
    ((None, 0), 0, 1),
    ((0, 0), 0, 0),
    ((5000, 9000), 14000, 0),
])
def test_combined_acr_preserves_unknown_amounts_and_real_zero(amounts, expected, missing):
    """Missing amounts stay explicit rather than being silently converted to zero."""
    summary = summarize_initiative_items([
        {'item_type': kind, 'acr': amount, 'available': True}
        for kind, amount in zip(('milestone', 'engagement'), amounts)
    ] + [{'item_type': 'project', 'acr': None, 'available': True}])
    assert summary['acr'] == expected
    assert summary['acr_count'] == 2
    assert summary['acr_missing_count'] == missing


def test_widget_and_salesiq_use_live_report_seller_totals(app, initiative_portfolio):
    """Reassignments and edits are read live, rather than saved in dashboard placements."""
    with app.app_context():
        customer = db.session.get(Customer, initiative_portfolio['second_customer_id'])
        customer.seller_id = initiative_portfolio['alice_id']
        db.session.commit()
        report = get_manager_one_on_one_report()
        assert report['sections'][0]['seller_groups'][0]['summary']['acr'] == 17000
        assert len(report['sections'][0]['seller_groups']) == 2
        assert dashboards.get_widget_preview(KEY, 'detailed', 6)['data']['sections'] == (
            report['sections']
        )
        assert execute_tool('report_manager_one_on_one', {})['sections'] == report['sections']


@pytest.mark.parametrize(('variant', 'width'), [
    ('metric', 3), ('metric', 4), ('metric', 6), ('metric', 12),
    ('detailed', 6), ('detailed', 12),
])
def test_all_widget_footprints_render_real_initiatives_without_fiscal_setup(
    client, monkeypatch, initiative_portfolio, variant, width,
):
    """Summary lists amounts; detailed adds sortable seller rows at supported widths."""
    monkeypatch.setattr(
        connect_goals, 'get_setup_state',
        Mock(side_effect=AssertionError('Initiatives do not require compensation setup')),
    )
    response = client.get(f'{BASE}/widget-preview', query_string={
        'key': KEY, 'variant': variant, 'width': width,
    })
    assert response.status_code == 200
    page = BeautifulSoup(response.json['html'], 'html.parser')
    widget = page.select_one('.db-initiative-widget')
    assert widget['data-initiative-variant'] == variant
    assert len(widget.select('.db-initiative')) == 2
    assert widget.select_one(
        f'a[href="/reports/initiative-tracker#section-{initiative_portfolio["section_id"]}"]',
    )
    assert '$17,000' in widget.get_text()
    assert widget.select_one('.db-initiative-totals dt').get_text() == 'ACR/mo'
    assert len(widget.select_one('.db-initiative-totals').select('dd')) == 1
    for overview in widget.select('.db-initiative-overview'):
        assert overview.select_one(':scope > .db-initiative-identity h3 a')
        assert overview.select_one(':scope > .db-initiative-totals dd')
        assert overview.select_one('.db-initiative-totals dt.sb-visually-hidden')
    assert '2 not set' in widget.get_text()
    assert '1 unavailable record' in widget.get_text()
    assert not page.select('.sb-connect-goals, [data-widget-requirement], script')
    tables = widget.select('table[data-sb-sortable]')
    assert len(tables) == (1 if variant == 'detailed' else 0)
    if tables:
        assert [th['data-sb-sort-type'] for th in tables[0].select('thead th')] == (
            ['text', 'number']
        )
        assert [th.get_text(strip=True) for th in tables[0].select('thead th')] == (
            ['Seller', 'ACR/mo']
        )
        assert len(tables[0].select('tbody tr')) == 3
        seller = tables[0].select_one('a.badge.bg-primary')
        assert seller.select_one('.bi-person')
        assert seller.get_text(strip=True) == 'Alice'
    connect_goals.get_setup_state.assert_not_called()


def test_empty_widget_guides_to_tracker_and_catalog_exposes_scope(client):
    """An empty portfolio is a valid state, not a bucket setup failure."""
    preview = client.get(f'{BASE}/widget-preview', query_string={
        'key': KEY, 'variant': 'metric', 'width': 3,
    })
    assert preview.status_code == 200
    page = BeautifulSoup(preview.json['html'], 'html.parser')
    assert 'No initiatives yet' in page.get_text()
    assert page.select_one('.db-initiative-empty a')['href'] == '/reports/initiative-tracker'
    catalog = client.get(BASE).json['catalog']
    definition = next(item for item in catalog if item['key'] == KEY)
    assert definition['scope'] == 'All initiatives'
    assert definition['report'] == 'Initiative Tracker'
    assert definition['requirements'] == []
    assert [item['widths'] for item in definition['variants']] == [[3, 4, 6, 12], [6, 12]]


def test_duplicate_placements_share_calculation_not_dom_identity(
    client, monkeypatch, initiative_portfolio,
):
    """Saved dashboards and injected previews share markup, with unique sort keys and IDs."""
    spec = dashboards.WIDGET_DEFINITIONS[KEY]
    provider = Mock(wraps=spec.provider)
    dashboard_id = create_dashboard(client)
    add_widget(client, dashboard_id, KEY)
    add_widget(client, dashboard_id, KEY)
    monkeypatch.setitem(dashboards.WIDGET_DEFINITIONS, KEY, replace(spec, provider=provider))
    for suffix in ('', '/edit'):
        provider.reset_mock()
        page = BeautifulSoup(
            client.get(f'/reports/dashboards/{dashboard_id}{suffix}').data, 'html.parser',
        )
        assert len(page.select('.db-canvas .db-initiative-widget')) == 2
        ids = [node['id'] for node in page.select('.db-canvas [id]')]
        assert len(ids) == len(set(ids))
        keys = [node['data-sb-sort-key'] for node in page.select('.db-canvas [data-sb-sort-key]')]
        assert len(keys) == len(set(keys)) == 2
        provider.assert_called_once()


def test_shared_work_is_summarized_per_initiative_and_names_remain_text(
    client, app, initiative_portfolio,
):
    """A shared milestone remains visible in both initiatives without a fake overall total."""
    with app.app_context():
        other = db.session.get(ManagerInitiativeSection, initiative_portfolio['empty_id'])
        milestone = db.session.get(Milestone, initiative_portfolio['milestone_id'])
        other.name = '<img src=x onerror=alert(1)>'
        other.items.append(ManagerInitiativeItem(
            item_type='milestone', milestone=milestone,
            title_snapshot=milestone.title, customer_snapshot=milestone.customer.name,
        ))
        db.session.commit()
        sections = get_manager_one_on_one_report()['sections']
        assert [section['summary']['acr'] for section in sections] == [17000, 5000]
    response = client.get(f'{BASE}/widget-preview', query_string={
        'key': KEY, 'variant': 'detailed', 'width': 12,
    })
    page = BeautifulSoup(response.json['html'], 'html.parser')
    assert '<img src=x onerror=alert(1)>' in page.get_text()
    assert page.select_one('.db-initiative-widget img') is None
