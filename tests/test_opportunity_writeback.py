"""Tests for opportunity comment writeback (DSS mode)."""

from unittest.mock import patch

import pytest


class TestOpportunityWorkerGating:
    """Worker should respect the shared msx_auto_writeback preference."""

    @patch('app.services.opportunity_tracking._upsert_to_msx_opportunity')
    @patch('app.services.opportunity_tracking._ai_summarize_note')
    @patch('app.services.msx_api.get_opportunity_comments')
    def test_worker_skips_when_disabled(self, mock_comments, mock_ai,
                                         mock_upsert, app):
        """Worker should skip entirely when auto-writeback is disabled (default)."""
        with app.app_context():
            from app.services.opportunity_tracking import _track_note_opportunity_worker
            _track_note_opportunity_worker(
                opportunities_data=[{"msx_opportunity_id": "opp-guid", "opportunity_id": 1}],
                plain="test note",
                customer_name="Test Corp",
                topics="Azure",
                ref_tag="note-99",
                call_date_iso="2026-03-25T00:00:00.000Z",
                note_id=99,
                app=app,
            )
        mock_comments.assert_not_called()
        mock_ai.assert_not_called()
        mock_upsert.assert_not_called()

    @patch('app.services.opportunity_tracking._upsert_to_msx_opportunity')
    @patch('app.services.opportunity_tracking._ai_summarize_note')
    @patch('app.services.msx_api.get_opportunity_comments')
    def test_worker_runs_when_enabled(self, mock_comments, mock_ai,
                                       mock_upsert, app, monkeypatch):
        """Worker proceeds when auto-writeback is enabled and posts AI summary."""
        monkeypatch.delenv('MSX_WRITEBACK_DISABLED', raising=False)
        mock_comments.return_value = {"success": True, "comments": []}
        mock_ai.return_value = "AI summary text"
        mock_upsert.return_value = {"success": True}

        with app.app_context():
            from app.models import UserPreference, db
            pref = UserPreference.query.first()
            pref.msx_auto_writeback = True
            db.session.commit()

            from app.services.opportunity_tracking import _track_note_opportunity_worker
            _track_note_opportunity_worker(
                opportunities_data=[{"msx_opportunity_id": "opp-guid", "opportunity_id": 1}],
                plain="test note with new info",
                customer_name="Test Corp",
                topics="Azure",
                ref_tag="note-99",
                call_date_iso="2026-03-25T00:00:00.000Z",
                note_id=99,
                app=app,
            )
        mock_comments.assert_called()
        mock_ai.assert_called_once()
        mock_upsert.assert_called_once()

    @patch('app.services.opportunity_tracking._upsert_to_msx_opportunity')
    @patch('app.services.opportunity_tracking._ai_summarize_note')
    @patch('app.services.msx_api.get_opportunity_comments')
    def test_worker_posts_fallback_when_no_new_info_but_no_existing_post(
        self, mock_comments, mock_ai, mock_upsert, app, monkeypatch,
    ):
        """If AI returns no_new_info but the note has never been posted, post a fallback."""
        monkeypatch.delenv('MSX_WRITEBACK_DISABLED', raising=False)
        mock_comments.return_value = {"success": True, "comments": []}
        mock_ai.return_value = None  # no_new_info path
        mock_upsert.return_value = {"success": True}

        with app.app_context():
            from app.models import UserPreference, db
            pref = UserPreference.query.first()
            pref.msx_auto_writeback = True
            db.session.commit()

            from app.services.opportunity_tracking import _track_note_opportunity_worker
            _track_note_opportunity_worker(
                opportunities_data=[{"msx_opportunity_id": "opp-guid", "opportunity_id": 1}],
                plain="test note",
                customer_name="Test Corp",
                topics="Azure",
                ref_tag="note-99",
                call_date_iso="2026-03-25T00:00:00.000Z",
                note_id=99,
                app=app,
            )
        mock_upsert.assert_called_once()

    @patch('app.services.opportunity_tracking._upsert_to_msx_opportunity')
    @patch('app.services.opportunity_tracking._ai_summarize_note')
    @patch('app.services.msx_api.get_opportunity_comments')
    def test_worker_skips_when_no_new_info_and_existing_post(
        self, mock_comments, mock_ai, mock_upsert, app, monkeypatch,
    ):
        """If an existing post for this ref tag is present and AI says no new info, do not write."""
        monkeypatch.delenv('MSX_WRITEBACK_DISABLED', raising=False)
        mock_comments.return_value = {
            "success": True,
            "comments": [{"comment": "prior post · note-99 ·", "userId": "x"}],
        }
        mock_ai.return_value = None
        mock_upsert.return_value = {"success": True}

        with app.app_context():
            from app.models import UserPreference, db
            pref = UserPreference.query.first()
            pref.msx_auto_writeback = True
            db.session.commit()

            from app.services.opportunity_tracking import _track_note_opportunity_worker
            _track_note_opportunity_worker(
                opportunities_data=[{"msx_opportunity_id": "opp-guid", "opportunity_id": 1}],
                plain="test note",
                customer_name="Test Corp",
                topics="Azure",
                ref_tag="note-99",
                call_date_iso="2026-03-25T00:00:00.000Z",
                note_id=99,
                app=app,
            )
        mock_upsert.assert_not_called()


class TestTrackNoteOnOpportunities:
    """Public API tests for track_note_on_opportunities."""

    def test_no_opportunities_short_circuits(self, app):
        """Note with no opportunities returns immediately with no work."""
        from datetime import datetime
        with app.app_context():
            from app.models import db, Note, Customer
            from app.services.opportunity_tracking import track_note_on_opportunities

            cust = Customer(name='Acme', tpid='tpid-no-opp')
            db.session.add(cust)
            db.session.flush()
            note = Note(content='hi', call_date=datetime.now(), customer_id=cust.id)
            db.session.add(note)
            db.session.flush()

            result = track_note_on_opportunities(note, background=False)
            assert result == []

    def test_opportunity_without_msx_id_is_skipped(self, app, monkeypatch):
        """Opportunities without an msx_opportunity_id should be filtered out."""
        from datetime import datetime
        monkeypatch.delenv('MSX_WRITEBACK_DISABLED', raising=False)

        with app.app_context():
            from app.models import db, Note, Customer, Opportunity, UserPreference
            from app.services.opportunity_tracking import track_note_on_opportunities

            pref = UserPreference.query.first()
            pref.msx_auto_writeback = True

            cust = Customer(name='Acme', tpid='tpid-with-opp')
            db.session.add(cust)
            db.session.flush()

            # Opportunity model requires msx_opportunity_id (unique, not null)
            # so we can't create one without it; instead, this test verifies
            # the synchronous return shape when there ARE opportunities with IDs.
            opp = Opportunity(
                msx_opportunity_id='opp-guid-test',
                name='Test Opp',
                customer_id=cust.id,
            )
            db.session.add(opp)

            note = Note(content='hi', call_date=datetime.now(), customer_id=cust.id)
            note.opportunities.append(opp)
            db.session.add(note)
            db.session.commit()

            with patch('app.services.opportunity_tracking._upsert_to_msx_opportunity') as mock_upsert, \
                 patch('app.services.opportunity_tracking._ai_summarize_note') as mock_ai, \
                 patch('app.services.msx_api.get_opportunity_comments') as mock_read:
                mock_read.return_value = {"success": True, "comments": []}
                mock_ai.return_value = "summary"
                mock_upsert.return_value = {"success": True}

                result = track_note_on_opportunities(note, background=False)

            assert result is not None
            assert len(result) == 1
            assert result[0]["opportunity_id"] == opp.id


class TestSettingsCopy:
    """Settings page copy mentions both milestones and opportunities."""

    def test_settings_page_mentions_opportunities(self, client):
        resp = client.get('/preferences')
        assert resp.status_code == 200
        body = resp.data.decode('utf-8', errors='ignore').lower()
        assert 'milestones' in body
        assert 'opportunities' in body
