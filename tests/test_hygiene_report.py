"""Tests for the Engagement / Milestone Hygiene report and reason-note API."""
import json
from datetime import date
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup
from flask.testing import FlaskClient
from app.models import db, Customer, Seller, Engagement, Milestone, HygieneNote


@pytest.fixture
def hygiene_data(app):
    """Create sample engagements and milestones for hygiene tests."""
    with app.app_context():
        seller = Seller(name='Test Seller')
        db.session.add(seller)
        db.session.flush()

        cust = Customer(name='Acme Corp', tpid=12345, seller_id=seller.id)
        db.session.add(cust)
        db.session.flush()

        # Engagement with NO milestones
        eng_no_ms = Engagement(
            customer_id=cust.id, title='Orphan Engagement', status='Active'
        )
        # Engagement WITH a milestone (should not appear in report)
        eng_with_ms = Engagement(
            customer_id=cust.id, title='Healthy Engagement', status='Active'
        )
        db.session.add_all([eng_no_ms, eng_with_ms])
        db.session.flush()

        # Milestone with NO engagement
        ms_no_eng = Milestone(
            customer_id=cust.id,
            msx_milestone_id='MS-001',
            title='Orphan Milestone',
            url='https://msx.example.com/ms-001',
            msx_status='On Track',
            on_my_team=True,
        )
        # Milestone WITH an engagement (should not appear)
        ms_with_eng = Milestone(
            customer_id=cust.id,
            msx_milestone_id='MS-002',
            title='Healthy Milestone',
            url='https://msx.example.com/ms-002',
            msx_status='On Track',
            on_my_team=True,
        )
        # Off-team milestone with no engagement (visible when toggle is off)
        ms_off_team = Milestone(
            customer_id=cust.id,
            msx_milestone_id='MS-003',
            title='OffTeam Milestone',
            url='https://msx.example.com/ms-003',
            msx_status='On Track',
            on_my_team=False,
        )
        db.session.add_all([ms_no_eng, ms_with_eng, ms_off_team])
        db.session.flush()

        # Link the healthy pair
        eng_with_ms.milestones.append(ms_with_eng)
        db.session.commit()

        return {
            'eng_no_ms_id': eng_no_ms.id,
            'eng_with_ms_id': eng_with_ms.id,
            'ms_no_eng_id': ms_no_eng.id,
            'ms_with_eng_id': ms_with_eng.id,
            'ms_off_team_id': ms_off_team.id,
        }


class TestHygieneReport:
    """Tests for GET /reports/hygiene."""

    def test_report_loads(self, client):
        """Should render the hygiene report page."""
        resp = client.get('/reports/hygiene')
        assert resp.status_code == 200
        html = resp.data.decode()
        assert 'Engagement / Milestone Hygiene' in html

    def test_shows_engagement_without_milestone(self, client, hygiene_data):
        """Should list engagements that have no milestones."""
        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'Orphan Engagement' in html
        assert 'Healthy Engagement' not in html

    def test_shows_milestone_without_engagement(self, client, hygiene_data):
        """Should list milestones that have no engagements."""
        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'Orphan Milestone' in html
        assert 'Healthy Milestone' not in html

    def test_off_team_milestones_in_html_but_hidden(self, client, hygiene_data):
        """Off-team milestones should be in the HTML (for toggle) but hidden by default."""
        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'OffTeam Milestone' in html
        assert 'data-on-team="false"' in html
        # On-team toggle should be present
        assert 'onTeamToggle' in html

    def test_milestones_can_be_grouped_by_seller(self, client, hygiene_data):
        """Milestone rows should expose seller data to the persisted grouping control."""
        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'groupBySellerToggle' in html
        assert 'data-seller-name="Test Seller"' in html
        soup = BeautifulSoup(html, 'html.parser')
        assert soup.select_one('#onTeamToggle').has_attr('checked')
        assert not soup.select_one('#groupBySellerToggle').has_attr('checked')
        assert soup.select_one('[data-hygiene-ms-tables] #milestoneGlobalHeader')
        assert not soup.select_one('[data-hygiene-eng-tables] #milestoneGlobalHeader')
        source = client.get('/static/js/ui-hygiene.js').get_data(as_text=True)
        assert 'salesbuddy_hygiene_milestone_view' in source
        assert "heading.className = 'sb-hygiene-seller'" in source
        assert "'hygiene-seller-' + name" in source

    def test_report_renders_remediation_actions(self, client, hygiene_data):
        """Gap rows should expose inline milestone and engagement fixes."""
        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'data-link-engagement-id=' in html
        assert 'data-add-existing-milestone-id=' in html
        assert 'data-create-engagement-milestone-id=' in html
        assert 'id="linkMilestonesModal"' in html
        assert 'id="addExistingEngagementModal"' in html
        assert 'id="existingEngagementSelect"' in html
        assert 'id="createEngagementFromEmptyState"' in html
        assert 'id="createEngagementModal"' in html
        assert 'id="engagementAnnotatedCount"' in html
        assert 'data-create-engagement-milestone-status=' in html
        assert 'data-create-engagement-milestone-msx-id=' in html
        soup = BeautifulSoup(html, 'html.parser')
        assert soup.select_one('dialog.sb-dialog#linkMilestonesModal')
        assert soup.select_one('dialog.sb-dialog#createEngagementModal')
        assert soup.select_one('dialog.sb-dialog#addExistingEngagementModal')
        assert soup.select_one('dialog#hygieneDiscardDialog')
        assert not soup.select_one('[data-hygiene] .modal')
        assert 'js/milestone-multi-picker.js' in html
        source = client.get('/static/js/ui-hygiene.js').get_data(as_text=True)
        assert '/api/customer/' in source
        assert "'/milestones/' + current.milestoneId + '/add'" in source
        assert 'sb:dialog-before-close' in source
        assert "openDialog('create', source)" in source
        assert 'async function refreshQueues()' in source
        assert 'Why no milestone?' in html
        assert 'data-entity-type="milestone"' not in html

    def test_report_embeds_client_sort_values(self, client, hygiene_data):
        """Milestone rows should expose customer and ACR values for redraw sorting."""
        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'data-customer-name="Acme Corp"' in html
        assert 'data-acr=' in html
        soup = BeautifulSoup(html, 'html.parser')
        row = soup.select_one('.ms-row')
        assert row.select('td')[1]['data-sb-sort-value'] == 'Acme Corp'
        assert row.select('td')[3].has_attr('data-sb-sort-value')
        assert row.select('td')[4].has_attr('data-sb-sort-value')

    @pytest.mark.parametrize('embedded', [False, True])
    def test_native_frame_and_export_scope(self, client: FlaskClient, hygiene_data: dict,
                                          embedded: bool) -> None:
        """Full pages and embeds retain both complete, sortable export queues."""
        response = client.get('/reports/hygiene', query_string={'embed': 1} if embedded else {})
        soup = BeautifulSoup(response.data, 'html.parser')
        root = soup.select_one('[data-hygiene]')
        assert root['data-embedded'] == str(embedded).lower()
        assert ('sb-page-frame' in soup.body.get('class', [])) is not embedded
        assert bool(soup.select('.sb-page-status')) is not embedded
        assert root.select_one('#milestoneQueue').has_attr('hidden') is not embedded
        assert root.select_one('#engagementQueue')['role'] == (
            'region' if embedded else 'tabpanel')
        assert not root.select('.card, .btn, .badge, .modal, [data-bs-toggle]')
        tables = root.select('table[data-sb-sortable]')
        assert len(tables) == 2
        for table in tables:
            assert len(table.select('thead th[data-export-label][data-sb-sort-type]')) == 5
            fix = table.select('thead th')[-1]
            assert fix['data-export-label'] == 'Fix'
            assert not fix.has_attr('data-sb-sort-type')
            for row in table.select('tbody tr'):
                assert all(cell.has_attr('data-sb-sort-value') for cell in row.select('td')[:5])
                assert not row.select('td')[-1].has_attr('data-sb-sort-value')
        assert '.sb-hygiene-table[data-export-visible=true]' in response.get_data(as_text=True)
        assert 'const CUSTOM_TITLE = "Engagement / Milestone Hygiene"' in response.get_data(
            as_text=True)
        assert 'tables.flatMap' in response.get_data(as_text=True)
        assert soup.select_one('input[name="title"][required]')
        assert soup.select_one('input[name="estimated_acr"][min="0"][step="1"]')
        assert soup.select_one('input[name="target_date"][type="date"]')
        assert len(soup.select('[data-hygiene-confirm-refresh]')) == 3
        styles = client.get('/static/css/ui-hygiene.css').get_data(as_text=True)
        assert 'overflow-anchor: none' in styles
        assert '.sb-hygiene-header .sb-revenue-export { padding-right: 0; border-right: 0; }' in styles

    def test_precision_dates_and_confirmed_annotation_exports(
        self, app, client: FlaskClient, hygiene_data: dict,
    ) -> None:
        """Financial sorting uses raw values and exports keep saved notes and story values."""
        with app.app_context():
            engagement = db.session.get(Engagement, hygiene_data['eng_no_ms_id'])
            milestone = db.session.get(Milestone, hygiene_data['ms_no_eng_id'])
            engagement.estimated_acr = 1234
            milestone.monthly_usage = 10.25
            milestone.due_date = date(2026, 10, 6)
            db.session.add(HygieneNote(
                entity_type='engagement', entity_id=engagement.id, note='Confirmed reason',
            ))
            db.session.commit()
            soup = BeautifulSoup(client.get('/reports/hygiene').data, 'html.parser')
            eng = soup.select_one('.engagement-gap-row')
            cells = eng.select('td')
            assert cells[2]['data-sb-sort-value'] == '1234'
            assert cells[3]['data-export-label'] == f'{engagement.story_completeness}% complete'
            assert cells[4]['data-export-label'] == 'Confirmed reason'
            assert cells[4].select_one('input')['value'] == 'Confirmed reason'
            assert cells[5]['data-export-label'] == ''
            ms = soup.select_one(f'.ms-row[data-milestone-id="{milestone.id}"]')
            assert ms.select('td')[3]['data-sb-sort-value'] == '10.25'
            assert ms.select('td')[4]['data-sb-sort-value'] == '2026-10-06'
            assert ms.select_one('a')['href'] == f'/milestone/{milestone.id}'

    def test_provider_keeps_completed_links_and_active_customer_gap_semantics(
        self, app, client: FlaskClient, hygiene_data: dict,
    ) -> None:
        """A completed link still resolves engagement hygiene; inactive/no-account gaps stay out."""
        with app.app_context():
            engagement = db.session.get(Engagement, hygiene_data['eng_no_ms_id'])
            linked = db.session.get(Milestone, hygiene_data['ms_with_eng_id'])
            linked.msx_status = 'Completed'
            db.session.add_all([
                Engagement(customer_id=engagement.customer_id, title='Paused', status='On Hold'),
                Milestone(customer_id=engagement.customer_id, title='Closed orphan',
                          msx_status='Completed', url='https://example.com/closed'),
                Milestone(title='No account', msx_status='On Track',
                          url='https://example.com/no-account'),
            ])
            db.session.commit()
        soup = BeautifulSoup(client.get('/reports/hygiene').data, 'html.parser')
        assert len(soup.select('.engagement-gap-row')) == 1
        assert len(soup.select('.ms-row')) == 2
        assert soup.select_one('.engagement-gap-row')['data-engagement-id'] == str(
            hygiene_data['eng_no_ms_id'])

    def test_seller_scope_and_contextual_help(
        self, app, client: FlaskClient, hygiene_data: dict,
    ) -> None:
        """Seller scoping remains provider-owned and Help describes actual repair/export behavior."""
        with app.app_context():
            engagement = db.session.get(Engagement, hygiene_data['eng_no_ms_id'])
            seller_id = engagement.customer.seller_id
            other_seller = Seller(name='Another seller')
            other_customer = Customer(name='Another customer', tpid=67890, seller=other_seller)
            db.session.add_all([other_seller, other_customer])
            db.session.flush()
            db.session.add_all([
                Engagement(customer_id=other_customer.id, title='Other gap', status='Active'),
                Milestone(customer_id=other_customer.id, title='Other milestone',
                          msx_status='Blocked', url='https://example.com/other'),
            ])
            db.session.commit()
        with patch('app.services.seller_mode.get_seller_mode_seller_id', return_value=seller_id):
            soup = BeautifulSoup(client.get('/reports/hygiene').data, 'html.parser')
        assert len(soup.select('.engagement-gap-row')) == 1
        assert len(soup.select('.ms-row')) == 2
        help_source = client.get('/static/js/page-help.js').get_data(as_text=True)
        help_text = help_source.split("title: 'Engagement / Milestone Hygiene',", 1)[1].split(
            '`},', 1)[0]
        for expected in ['completed milestone', 'Only confirmed notes', 'Retry note',
                         'both queues', 'not just the selected tab', 'Back restores',
                         'Grouped exports identify', 'Embedded reports']:
            assert expected in help_text

    @pytest.mark.parametrize('operation', ['link', 'existing', 'create', 'create-empty'])
    def test_repairs_refresh_authoritative_queues(
        self, app, client: FlaskClient, hygiene_data: dict, operation: str,
    ) -> None:
        """Real isolated writes resolve both queues or add a legitimate unlinked engagement."""
        engagement_id = hygiene_data['eng_no_ms_id']
        milestone_id = hygiene_data['ms_no_eng_id']
        with app.app_context():
            customer_id = db.session.get(Engagement, engagement_id).customer_id
        with patch('app.routes.engagements.track_engagement_on_milestones'):
            if operation == 'link':
                response = client.post(f'/api/engagement/{engagement_id}/milestones',
                                       json={'milestone_ids': [milestone_id]})
            elif operation == 'existing':
                response = client.post(
                    f'/api/engagement/{engagement_id}/milestones/{milestone_id}/add')
            else:
                response = client.post(f'/customer/{customer_id}/engagement/create-inline', json={
                    'title': 'New repair', 'status': 'Active', 'technical_problem': 'SQL move',
                    'business_impact': 'Reduce costs', 'solution_resources': 'SQL',
                    'estimated_acr': '2500', 'target_date': '2026-12-31',
                    'milestone_ids': [] if operation == 'create-empty' else [milestone_id],
                })
        assert response.status_code == 200
        assert response.json['success'] is True
        soup = BeautifulSoup(client.get('/reports/hygiene?embed=1').data, 'html.parser')
        engagement_ids = {int(row['data-engagement-id'])
                          for row in soup.select('.engagement-gap-row')}
        milestone_ids = {int(row['data-milestone-id']) for row in soup.select('.ms-row')}
        if operation in ('link', 'existing'):
            assert engagement_id not in engagement_ids
        else:
            assert engagement_id in engagement_ids
            assert (response.json['id'] in engagement_ids) is (operation == 'create-empty')
            with app.app_context():
                created = db.session.get(Engagement, response.json['id'])
                assert created.estimated_acr == 2500
                assert created.target_date == date(2026, 12, 31)
                assert created.technical_problem == 'SQL move'
        assert (milestone_id in milestone_ids) is (operation == 'create-empty')
        assert hygiene_data['ms_off_team_id'] in milestone_ids
        assert hygiene_data['ms_with_eng_id'] not in milestone_ids

    def test_shared_picker_keeps_scrollbar_open_and_colors_statuses(self, client):
        """Shared picker should preserve scroll interaction and standard badge colors."""
        resp = client.get('/static/js/milestone-multi-picker.js')
        assert resp.status_code == 200
        javascript = resp.data.decode()
        assert "case 'On Track': return 'bg-success'" in javascript
        assert "case 'At Risk': return 'bg-warning text-dark'" in javascript
        assert "case 'Blocked': return 'bg-danger'" in javascript
        assert "this.results.addEventListener('pointerdown'" in javascript
        assert "if (!picker.resultsInteracting) picker.closeResults()" in javascript
        assert 'this.closeResults();' in javascript
        assert 'this.input.blur();' in javascript
        assert "this.input.addEventListener('click'" in javascript
        assert 'milestone.local_milestone_id != null' in javascript
        assert 'Number.isInteger(milestoneId) && milestoneId > 0' in javascript
        assert 'initialSelections' in javascript
        assert 'Loading optional additional milestones...' in javascript
        assert "'card border-success mb-2'" in javascript
        assert 'bg-success-subtle' not in javascript
        assert 'card-body d-flex justify-content-between' in javascript
        assert 'bi bi-check-circle-fill text-success' in javascript

    def test_shows_existing_hygiene_notes(self, client, app, hygiene_data):
        """Should display pre-existing hygiene notes inline."""
        with app.app_context():
            hn = HygieneNote(
                entity_type='engagement',
                entity_id=hygiene_data['eng_no_ms_id'],
                note='Waiting on customer approval',
            )
            db.session.add(hn)
            db.session.commit()

        resp = client.get('/reports/hygiene')
        html = resp.data.decode()
        assert 'Waiting on customer approval' in html


class TestHygieneNoteAPI:
    """Tests for engagement reason notes posted to /api/hygiene-note."""

    def test_create_note(self, client, app, hygiene_data):
        """Should create a new hygiene note."""
        resp = client.post('/api/hygiene-note',
                           data=json.dumps({
                               'entity_type': 'engagement',
                               'entity_id': hygiene_data['eng_no_ms_id'],
                               'note': 'No MSX match yet',
                           }),
                           content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True

        with app.app_context():
            hn = HygieneNote.query.filter_by(
                entity_type='engagement',
                entity_id=hygiene_data['eng_no_ms_id'],
            ).first()
            assert hn is not None
            assert hn.note == 'No MSX match yet'

    def test_update_note(self, client, app, hygiene_data):
        """Should update an existing hygiene note."""
        with app.app_context():
            hn = HygieneNote(
                entity_type='engagement',
                entity_id=hygiene_data['eng_no_ms_id'],
                note='Old reason',
            )
            db.session.add(hn)
            db.session.commit()

        resp = client.post('/api/hygiene-note',
                           data=json.dumps({
                               'entity_type': 'engagement',
                               'entity_id': hygiene_data['eng_no_ms_id'],
                               'note': 'Updated reason',
                           }),
                           content_type='application/json')
        assert resp.status_code == 200

        with app.app_context():
            hn = HygieneNote.query.filter_by(
                entity_type='engagement',
                entity_id=hygiene_data['eng_no_ms_id'],
            ).first()
            assert hn.note == 'Updated reason'

    def test_rejects_removed_milestone_reason_notes(self, client, hygiene_data):
        """Milestones should no longer accept obsolete reason notes."""
        resp = client.post('/api/hygiene-note', json={
            'entity_type': 'milestone',
            'entity_id': hygiene_data['ms_no_eng_id'],
            'note': 'Obsolete reason',
        })
        assert resp.status_code == 400

    def test_delete_note_on_empty(self, client, app, hygiene_data):
        """Should delete the record when note is empty."""
        with app.app_context():
            hn = HygieneNote(
                entity_type='engagement',
                entity_id=hygiene_data['eng_no_ms_id'],
                note='To be cleared',
            )
            db.session.add(hn)
            db.session.commit()

        resp = client.post('/api/hygiene-note',
                           data=json.dumps({
                               'entity_type': 'engagement',
                               'entity_id': hygiene_data['eng_no_ms_id'],
                               'note': '',
                           }),
                           content_type='application/json')
        assert resp.status_code == 200

        with app.app_context():
            hn = HygieneNote.query.filter_by(
                entity_type='engagement',
                entity_id=hygiene_data['eng_no_ms_id'],
            ).first()
            assert hn is None

    def test_rejects_invalid_entity_type(self, client):
        """Should return 400 for invalid entity_type."""
        resp = client.post('/api/hygiene-note',
                           data=json.dumps({
                               'entity_type': 'bogus',
                               'entity_id': 1,
                               'note': 'test',
                           }),
                           content_type='application/json')
        assert resp.status_code == 400

    def test_rejects_missing_entity_id(self, client):
        """Should return 400 when entity_id is missing."""
        resp = client.post('/api/hygiene-note',
                           data=json.dumps({
                               'entity_type': 'engagement',
                               'note': 'test',
                           }),
                           content_type='application/json')
        assert resp.status_code == 400
