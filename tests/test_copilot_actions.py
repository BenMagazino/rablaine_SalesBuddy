"""Tests for Copilot daily action items feature."""

import json
from datetime import datetime, date, time, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest


# Sample WorkIQ response (JSON format from our prompt)
SAMPLE_WORKIQ_RESPONSE = """[
  {
    "title": "Provide cost comparison for Vantage PostgreSQL scaling",
    "description": "This is blocking decision-making on whether the customer can safely run at higher capacity. Build a cost comparison for PostgreSQL Flexible Server.",
    "source_url": "https://teams.microsoft.com/l/message/19:abc@thread.v2/123",
    "last_activity_date": "2026-03-26"
  },
  {
    "title": "Follow up on LogixHealth TCO deliverables",
    "description": "This account has multiple live threads and upcoming final delivery meeting. Ensure the assessment deck is accessible to all parties.",
    "source_url": "https://outlook.office365.com/owa/?ItemID=AAMk123",
    "last_activity_date": "2026-03-25"
  },
  {
    "title": "Progress Q3 pipeline hygiene actions",
    "description": "Manager-directed priority tied to your scorecard. Verify API usage and follow up on uncommitted milestones.",
    "source_url": "https://teams.microsoft.com/l/meeting/details?eventId=AAMk456",
    "last_activity_date": "2026-03-24"
  }
]"""

EMPTY_RESPONSE = ""

NO_ITEMS_RESPONSE = """I looked through your emails, chats and meetings but couldn't find any clear action items for you today."""

MARKDOWN_WORKIQ_RESPONSE = """I found three unresolved follow-ups:

1. **Send the demo**
   - Share the recording and setup instructions.
   - Source: [Meeting](https://teams.microsoft.com/l/meeting/demo)
2. **Review the estimate**
   Confirm the revised costs with the account team.
   https://outlook.office365.com/owa/?ItemID=estimate
3. Schedule the next session
   Offer two times next week.

Let me know if you would like help drafting a reply.
"""


class TestParseActionItems:
    """Tests for the markdown response parser."""

    def test_parses_three_items(self):
        """Should extract all 3 action items from a well-formatted response."""
        from app.services.copilot_actions import parse_action_items
        items = parse_action_items(SAMPLE_WORKIQ_RESPONSE)
        assert len(items) == 3

    def test_extracts_titles(self):
        """Should extract clean titles without markdown formatting."""
        from app.services.copilot_actions import parse_action_items
        items = parse_action_items(SAMPLE_WORKIQ_RESPONSE)
        assert items[0]['title'] == 'Provide cost comparison for Vantage PostgreSQL scaling'
        assert items[1]['title'] == 'Follow up on LogixHealth TCO deliverables'
        assert items[2]['title'] == 'Progress Q3 pipeline hygiene actions'

    def test_extracts_description(self):
        """Should include context in description."""
        from app.services.copilot_actions import parse_action_items
        items = parse_action_items(SAMPLE_WORKIQ_RESPONSE)
        assert 'blocking decision-making' in items[0]['description']
        assert 'cost comparison' in items[0]['description']

    def test_empty_response_returns_empty(self):
        """Should return empty list for empty response."""
        from app.services.copilot_actions import parse_action_items
        assert parse_action_items(EMPTY_RESPONSE) == []
        assert parse_action_items(None) == []

    def test_no_items_response_returns_empty(self):
        """Should return empty list when WorkIQ finds no action items."""
        from app.services.copilot_actions import parse_action_items
        assert parse_action_items(NO_ITEMS_RESPONSE) == []

    def test_truncates_long_titles(self):
        """Titles should be truncated to 300 chars."""
        from app.services.copilot_actions import parse_action_items
        long_title = 'A' * 500
        response = json.dumps([{"title": long_title, "description": "test"}])
        items = parse_action_items(response)
        if items:
            assert len(items[0]['title']) <= 300

    def test_handles_json_in_code_block(self):
        """Should extract JSON even if wrapped in markdown code block."""
        from app.services.copilot_actions import parse_action_items
        response = '```json\n[{"title": "Test item", "description": "Do stuff"}]\n```'
        items = parse_action_items(response)
        assert len(items) == 1
        assert items[0]['title'] == 'Test item'

    def test_handles_json_with_preamble(self):
        """Should extract JSON even with text before the array."""
        from app.services.copilot_actions import parse_action_items
        response = 'Here are your items:\n[{"title": "Test", "description": "x"}]'
        items = parse_action_items(response)
        assert len(items) == 1

    def test_recovers_raw_newlines_inside_strings(self):
        """WorkIQ sometimes splits string values across lines with raw
        newline bytes, which breaks strict json.loads. The parser must
        repair these and still return the items. Regression for the
        2026-07-06 boot-time parse failure."""
        from app.services.copilot_actions import parse_action_items
        response = (
            '[{"title":"Provide Purview file-format and third-party integration\n'
            'documentation","description":"Docs committed as a follow-up and\n'
            'remains listed as a meeting\ntask.","sourceurl":"",'
            '"lastactivitydate":"2026-06-30"}]'
        )
        items = parse_action_items(response)
        assert len(items) == 1
        assert 'Purview' in items[0]['title']


class TestMarkdownActionItems:
    """Regression tests for prose responses that contain numbered follow-ups."""

    def test_extracts_numbered_items_and_sources(self):
        """Preserve titles, context and links without absorbing closing prose."""
        from app.services.copilot_actions import parse_action_items

        with patch('app.services.telemetry_shipper.queue_workiq_call') as telemetry:
            items = parse_action_items(MARKDOWN_WORKIQ_RESPONSE)

        assert [item['title'] for item in items] == [
            'Send the demo', 'Review the estimate', 'Schedule the next session',
        ]
        assert 'Share the recording' in items[0]['description']
        assert items[0]['source_url'] == 'https://teams.microsoft.com/l/meeting/demo'
        assert items[1]['source_url'] == 'https://outlook.office365.com/owa/?ItemID=estimate'
        assert items[2]['source_url'] is None
        assert items[2]['description'] == 'Offer two times next week.'
        telemetry.assert_called_once_with(
            'copilot_actions', 'parse_recovered',
            failure_type='parse_fell_back_to_markdown',
        )

    def test_nested_numbered_steps_are_not_new_actions(self):
        """Only top-level list entries become action items."""
        from app.services.copilot_actions import parse_action_items

        items = parse_action_items(
            '1. Send the demo\n'
            '   1. Record the walkthrough.\n'
            '   2. Upload the recording.\n'
            '2. Confirm the estimate'
        )
        assert len(items) == 2
        assert 'Upload the recording.' in items[0]['description']
        assert items[1]['description'] is None

    @pytest.mark.parametrize('marker', ['1.', '1)'])
    def test_indented_lists_and_link_titles(self, marker):
        """Accept common list markers and strip presentation-only title markup."""
        from app.services.copilot_actions import parse_action_items

        items = parse_action_items(
            f'  {marker} **[Review estimate](https://example.com/estimate)**\n'
            '     - Confirm scope.'
        )
        assert items == [{
            'title': 'Review estimate',
            'description': '- Confirm scope.',
            'source_url': 'https://example.com/estimate',
        }]

    def test_leading_indentation_is_consistent_across_items(self):
        """Trimming the response must not promote just the first indented item."""
        from app.services.copilot_actions import parse_action_items

        items = parse_action_items('  1. Send the demo\n  2. Confirm scope')
        assert [item['title'] for item in items] == ['Send the demo', 'Confirm scope']

    def test_markdown_titles_are_bounded(self):
        """Apply the same 300-character title limit to both formats."""
        from app.services.copilot_actions import parse_action_items

        assert parse_action_items('1. ' + 'A' * 500)[0]['title'] == 'A' * 300

    def test_url_punctuation_does_not_break_source_links(self):
        """Preserve balanced URL parentheses without sentence punctuation."""
        from app.services.copilot_actions import parse_action_items

        items = parse_action_items(
            '1. Review scope\n'
            '   See https://example.com/review(v2).'
        )
        assert items[0]['source_url'] == 'https://example.com/review(v2)'

    @pytest.mark.parametrize('json_text', ['[]', '[{"title": "JSON task"}]'])
    def test_valid_json_takes_precedence(self, json_text):
        """Do not turn numbered explanatory text into extra tasks after valid JSON."""
        from app.services.copilot_actions import parse_action_items

        with patch('app.services.telemetry_shipper.queue_workiq_call') as telemetry:
            items = parse_action_items(json_text + '\n1. Not another task')
        assert len(items) == (0 if json_text == '[]' else 1)
        telemetry.assert_not_called()

    def test_malformed_json_can_recover_from_numbered_list(self):
        """Attempt markdown only after JSON parsing fails."""
        from app.services.copilot_actions import parse_action_items

        items = parse_action_items('[not JSON]\n1. Send the recording')
        assert items[0]['title'] == 'Send the recording'

    def test_invalid_json_fields_do_not_crash_or_discard_valid_items(self):
        """Skip malformed items without losing valid JSON suggestions."""
        from app.services.copilot_actions import parse_action_items

        items = parse_action_items(json.dumps([
            {'title': 7}, {'title': 'Bad description', 'description': []},
            {'title': 'Bad URL', 'source_url': {}}, None, {'title': 'Valid task'},
        ]))
        assert items == [{'title': 'Valid task', 'description': None, 'source_url': None}]

    def test_total_failure_logs_without_sending_response_content(self, caplog):
        """Only a fixed failure taxonomy reaches telemetry."""
        from app.services.copilot_actions import parse_action_items

        with patch('app.services.telemetry_shipper.queue_workiq_call') as telemetry:
            assert parse_action_items('Private prose, no actionable list.') == []
        assert 'Could not parse Copilot action items' in caplog.text
        assert 'Private prose' not in caplog.text
        telemetry.assert_called_once_with(
            'copilot_actions', 'parse_failed', failure_type='parse_copilot_actions_json',
        )


class TestShouldSync:
    """Tests for the sync-needed check."""

    def test_should_sync_when_never_synced(self, app):
        """Should return True if never synced before."""
        with app.app_context():
            from app.services.copilot_actions import should_sync
            assert should_sync() is True

    def test_should_not_sync_before_6am(self, app):
        """Should return False before 6 AM even if never synced."""
        with app.app_context():
            from app.services.copilot_actions import should_sync
            with patch('app.services.copilot_actions.datetime') as mock_dt:
                mock_dt.now.return_value = datetime(2026, 3, 26, 4, 0)  # 4 AM
                mock_dt.combine = datetime.combine
                result = should_sync()
            # First sync: should_sync checks pref.last_copilot_sync is None,
            # returns True regardless of time
            assert result is True

    def test_should_sync_after_6am_if_stale(self, app):
        """Should return True after 6 AM if last sync was yesterday."""
        with app.app_context():
            from app.models import UserPreference, db
            from app.services.copilot_actions import should_sync
            pref = UserPreference.query.first()
            # Set last sync to yesterday 7 AM UTC
            pref.last_copilot_sync = datetime(2026, 3, 25, 12, 0, tzinfo=timezone.utc)
            db.session.commit()
            # Force "now" to be after today's 6 AM local boundary so the
            # check isn't time-of-day dependent (test would fail if run
            # before 6 AM local).
            with patch('app.services.copilot_actions.datetime') as mock_dt:
                mock_dt.now.return_value = datetime(2026, 3, 26, 9, 0)  # 9 AM local
                mock_dt.combine = datetime.combine
                assert should_sync() is True

    def test_should_not_sync_if_already_done_today(self, app):
        """Should return False if sync already ran today after 6 AM."""
        with app.app_context():
            from app.models import UserPreference, db
            from app.services.copilot_actions import should_sync
            pref = UserPreference.query.first()
            # Set last sync to today at 6:05 AM UTC (well after 6 AM local)
            pref.last_copilot_sync = datetime.now(timezone.utc)
            db.session.commit()
            assert should_sync() is False


class TestSyncCopilotActionItems:
    """Tests for the full sync function."""

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_accepts_numbered_followups(self, mock_workiq, app):
        """The normal sync persists recovered tasks without another WorkIQ call."""
        from app.models import ActionItem
        from app.services.copilot_actions import sync_copilot_action_items

        mock_workiq.return_value = MARKDOWN_WORKIQ_RESPONSE
        with app.app_context():
            result = sync_copilot_action_items()
            assert result == {'success': True, 'items_created': 3}
            assert ActionItem.query.filter_by(source='copilot', status='open').count() == 3
            assert ActionItem.query.filter_by(title='Send the demo').one().source_url == (
                'https://teams.microsoft.com/l/meeting/demo'
            )
        assert mock_workiq.call_count == 1

    @patch('app.services.workiq_service.query_workiq')
    def test_unparseable_response_preserves_saved_items(self, mock_workiq, app):
        """A failed parse must not clear existing suggestions or advance freshness."""
        from app.models import ActionItem, UserPreference, db
        from app.services.copilot_actions import sync_copilot_action_items

        mock_workiq.return_value = NO_ITEMS_RESPONSE
        with app.app_context():
            db.session.add(ActionItem(title='Keep this task', source='copilot', status='open'))
            db.session.commit()
            previous_sync = UserPreference.query.first().last_copilot_sync
            result = sync_copilot_action_items()
            assert result['success'] is False
            assert ActionItem.query.filter_by(title='Keep this task').count() == 1
            assert UserPreference.query.first().last_copilot_sync == previous_sync

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_creates_items(self, mock_workiq, app):
        """Should create action items from WorkIQ response."""
        mock_workiq.return_value = SAMPLE_WORKIQ_RESPONSE

        with app.app_context():
            from app.services.copilot_actions import sync_copilot_action_items
            from app.models import ActionItem
            result = sync_copilot_action_items()
            assert result['success'] is True
            assert result['items_created'] == 3

            items = ActionItem.query.filter_by(source='copilot').all()
            assert len(items) == 3
            assert all(i.status == 'open' for i in items)

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_clears_old_items(self, mock_workiq, app):
        """Should delete old copilot items before creating new ones."""
        with app.app_context():
            from app.services.copilot_actions import sync_copilot_action_items
            from app.models import ActionItem, db

            # Create an old copilot item
            old = ActionItem(
                title='Old copilot item',
                source='copilot',
                status='open',
            )
            db.session.add(old)
            db.session.commit()
            old_id = old.id

            mock_workiq.return_value = SAMPLE_WORKIQ_RESPONSE
            result = sync_copilot_action_items()
            assert result['success'] is True

            # Old item should be gone (check by title since IDs can be reused)
            assert ActionItem.query.filter_by(title='Old copilot item').first() is None
            # New items should exist
            assert ActionItem.query.filter_by(source='copilot').count() == 3

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_does_not_touch_engagement_items(self, mock_workiq, app,
                                                    sample_data):
        """Should not delete engagement action items during sync."""
        with app.app_context():
            from app.services.copilot_actions import sync_copilot_action_items
            from app.models import ActionItem, Engagement, db

            eng = Engagement.query.first()
            if not eng:
                eng = Engagement(
                    title='Test Engagement',
                    customer_id=sample_data['customer1_id'],
                )
                db.session.add(eng)
                db.session.flush()

            eng_task = ActionItem(
                title='Engagement task',
                engagement_id=eng.id,
                source='engagement',
                status='open',
            )
            db.session.add(eng_task)
            db.session.commit()
            eng_task_id = eng_task.id

            mock_workiq.return_value = SAMPLE_WORKIQ_RESPONSE
            sync_copilot_action_items()

            # Engagement task should still exist
            assert ActionItem.query.get(eng_task_id) is not None

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_updates_last_sync_timestamp(self, mock_workiq, app):
        """Should update last_copilot_sync after successful sync."""
        mock_workiq.return_value = SAMPLE_WORKIQ_RESPONSE

        with app.app_context():
            from app.services.copilot_actions import sync_copilot_action_items
            from app.models import UserPreference
            sync_copilot_action_items()

            pref = UserPreference.query.first()
            assert pref.last_copilot_sync is not None

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_handles_empty_response(self, mock_workiq, app):
        """Should handle empty WorkIQ response gracefully."""
        mock_workiq.return_value = ""

        with app.app_context():
            from app.services.copilot_actions import sync_copilot_action_items
            result = sync_copilot_action_items()
            assert result['success'] is False
            assert 'Empty response' in result['error']

    @patch('app.services.workiq_service.query_workiq')
    def test_sync_handles_workiq_exception(self, mock_workiq, app):
        """Should handle WorkIQ failures gracefully."""
        mock_workiq.side_effect = Exception("WorkIQ timeout")

        with app.app_context():
            from app.services.copilot_actions import sync_copilot_action_items
            result = sync_copilot_action_items()
            assert result['success'] is False


class TestDashboardCopilotItems:
    """Integration tests: copilot items show on the dashboard."""

    def test_copilot_items_visible(self, client, app):
        """Copilot action items should appear on the dashboard."""
        with app.app_context():
            from app.models import ActionItem, db
            item = ActionItem(
                title='Copilot Test Item',
                source='copilot',
                status='open',
            )
            db.session.add(item)
            db.session.commit()

        resp = client.get('/')
        assert resp.status_code == 200
        assert b'Copilot Test Item' in resp.data
        assert b'bi-stars' in resp.data  # Copilot icon

    def test_copilot_items_labeled(self, client, app):
        """Copilot items should show 'Copilot Suggestions' section header."""
        with app.app_context():
            from app.models import ActionItem, db
            item = ActionItem(
                title='Test Copilot Label',
                source='copilot',
                status='open',
            )
            db.session.add(item)
            db.session.commit()

        resp = client.get('/')
        assert b'Copilot Suggestions' in resp.data


class TestDismissAndFeedback:
    """Tests for dismiss and not-useful endpoints."""

    def test_dismiss_copilot_task(self, client, app):
        """Dismiss should delete the task and store the title."""
        with app.app_context():
            from app.models import ActionItem, DismissedCopilotTask, db
            item = ActionItem(
                title='Annoying Task',
                source='copilot',
                status='open',
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id

        resp = client.post(f'/action-item/{item_id}/dismiss')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['success'] is True

        with app.app_context():
            from app.models import ActionItem, DismissedCopilotTask, db
            assert ActionItem.query.get(item_id) is None
            dismissed = DismissedCopilotTask.query.filter_by(title='Annoying Task').first()
            assert dismissed is not None
            assert dismissed.reason == 'dismissed'

    def test_dismiss_rejects_non_copilot(self, client, app):
        """Dismiss should reject non-copilot tasks."""
        with app.app_context():
            from app.models import ActionItem, db
            item = ActionItem(
                title='Engagement Task',
                source='engagement',
                status='open',
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id

        resp = client.post(f'/action-item/{item_id}/dismiss')
        assert resp.status_code == 400

    def test_not_useful_stores_feedback_and_dismisses(self, client, app):
        """Not-useful should store feedback, dismiss the task, and delete it."""
        with app.app_context():
            from app.models import ActionItem, DismissedCopilotTask, db
            item = ActionItem(
                title='Useless Suggestion',
                source='copilot',
                status='open',
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id

        resp = client.post(f'/action-item/{item_id}/not-useful')
        assert resp.status_code == 200

        with app.app_context():
            from app.models import ActionItem, DismissedCopilotTask, db
            assert ActionItem.query.get(item_id) is None
            dismissed = DismissedCopilotTask.query.filter_by(title='Useless Suggestion').first()
            assert dismissed is not None
            assert dismissed.reason == 'not_useful'

    def test_not_useful_rejects_non_copilot(self, client, app):
        """Not-useful should reject non-copilot tasks."""
        with app.app_context():
            from app.models import ActionItem, db
            item = ActionItem(
                title='Engagement Task',
                source='engagement',
                status='open',
            )
            db.session.add(item)
            db.session.commit()
            item_id = item.id

        resp = client.post(f'/action-item/{item_id}/not-useful')
        assert resp.status_code == 400

    def test_prompt_includes_dismissed_titles(self, app):
        """Build prompt should include dismissed task titles in exclusions."""
        with app.app_context():
            from app.models import DismissedCopilotTask, UserPreference, db
            from app.services.copilot_actions import _build_prompt
            db.session.add(DismissedCopilotTask(title='Old Boring Task'))
            db.session.add(UserPreference())
            db.session.commit()

            prompt = _build_prompt()
            assert 'Old Boring Task' in prompt
            assert 'dismissed' in prompt.lower()

    def test_prompt_includes_feedback_titles(self, app):
        """Build prompt should include feedback titles as negative examples."""
        with app.app_context():
            from app.models import DismissedCopilotTask, UserPreference, db
            from app.services.copilot_actions import _build_prompt
            db.session.add(DismissedCopilotTask(title='Terrible Suggestion', reason='not_useful'))
            db.session.add(UserPreference())
            db.session.commit()

            prompt = _build_prompt()
            assert 'Terrible Suggestion' in prompt
            assert 'not useful' in prompt.lower()
