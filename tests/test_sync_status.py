"""Tests for the SyncStatus model and sync tracking behavior."""

import pytest
from datetime import datetime, timezone, timedelta


class TestSyncStatusModel:
    """Tests for SyncStatus class methods and is_complete logic."""

    @pytest.mark.parametrize('success', [True, False])
    def test_last_completed_utc_normalizes_finished_attempts(self, app, success):
        """Both successful and failed completions provide an aware UTC timestamp."""
        from app.models import SyncStatus

        with app.app_context():
            status = SyncStatus.mark_completed('milestones', success=success)
            completed = SyncStatus.last_completed_utc('milestones')
            assert completed.tzinfo == timezone.utc
            assert completed.replace(tzinfo=None) == status.completed_at.replace(tzinfo=None)

    def test_last_completed_utc_does_not_invent_unfinished_completions(self, app):
        """Never-run, interrupted and live attempts have no completion timestamp."""
        from app.models import SyncStatus

        with app.app_context():
            assert SyncStatus.last_completed_utc('milestones') is None
            SyncStatus.mark_started('milestones')
            assert SyncStatus.last_completed_utc('milestones') is None
            SyncStatus.update_heartbeat('milestones')
            assert SyncStatus.last_completed_utc('milestones') is None

    def test_last_completed_utc_prefers_durable_completion(self, app):
        """Modern job completion overrides the older domain fallback."""
        from app.models import Job, SyncStatus, db

        with app.app_context():
            status = SyncStatus.mark_completed('milestones', success=True)
            finished = status.completed_at + timedelta(minutes=1)
            db.session.add(Job(
                job_type='sync:milestones', status=Job.STATUS_DONE,
                created_at=status.started_at, started_at=status.started_at,
                finished_at=finished, result='{"success": true}',
            ))
            db.session.commit()
            assert SyncStatus.last_completed_utc('milestones') == finished.replace(
                tzinfo=timezone.utc)

    def test_is_complete_returns_false_when_no_record(self, app):
        """is_complete should return False when no sync has ever been recorded."""
        with app.app_context():
            from app.models import SyncStatus
            assert SyncStatus.is_complete('milestones') is False
            assert SyncStatus.is_complete('nonexistent') is False

    def test_mark_started_creates_record(self, app):
        """mark_started should create a new SyncStatus record."""
        with app.app_context():
            from app.models import SyncStatus
            status = SyncStatus.mark_started('milestones')
            assert status.sync_type == 'milestones'
            assert status.started_at is not None
            assert status.completed_at is None
            assert status.success is None
            assert status.items_synced is None
            assert status.details is None

    def test_is_complete_returns_false_when_only_started(self, app):
        """A sync that has started but not completed should not be considered complete."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            assert SyncStatus.is_complete('milestones') is False

    def test_mark_completed_success(self, app):
        """mark_completed with success=True should mark the sync as complete."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            status = SyncStatus.mark_completed('milestones', success=True,
                                                items_synced=42, details='{"test": true}')
            assert status.success is True
            assert status.completed_at is not None
            assert status.items_synced == 42
            assert status.details == '{"test": true}'

    def test_is_complete_returns_true_after_successful_sync(self, app):
        """is_complete should return True after mark_started + mark_completed(success=True)."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True)
            assert SyncStatus.is_complete('milestones') is True

    def test_is_complete_returns_false_after_failed_sync(self, app):
        """is_complete should return False when mark_completed is called with success=False."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=False)
            assert SyncStatus.is_complete('milestones') is False

    def test_mark_started_resets_previous_completion(self, app):
        """Starting a new sync should clear the previous completion state."""
        with app.app_context():
            from app.models import SyncStatus
            # Complete a sync
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True, items_synced=10)
            assert SyncStatus.is_complete('milestones') is True

            # Start a new sync - should reset everything
            status = SyncStatus.mark_started('milestones')
            assert status.completed_at is None
            assert status.success is None
            assert status.items_synced is None
            assert status.details is None
            assert SyncStatus.is_complete('milestones') is False

    def test_interrupted_sync_not_complete(self, app):
        """Simulates a page reload during sync: started but never completed."""
        with app.app_context():
            from app.models import SyncStatus
            # Previously completed
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True)
            assert SyncStatus.is_complete('milestones') is True

            # User starts new sync, then reloads (never completes)
            SyncStatus.mark_started('milestones')
            # <-- reload happens here, no mark_completed call
            assert SyncStatus.is_complete('milestones') is False

    def test_unique_sync_types(self, app):
        """Different sync types should be tracked independently."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True)

            SyncStatus.mark_started('accounts')
            # accounts started but not finished

            assert SyncStatus.is_complete('milestones') is True
            assert SyncStatus.is_complete('accounts') is False

    def test_mark_completed_without_prior_start(self, app):
        """mark_completed should work even without a prior mark_started."""
        with app.app_context():
            from app.models import SyncStatus
            status = SyncStatus.mark_completed('milestones', success=True, items_synced=5)
            assert status.success is True
            assert status.started_at is not None  # Should auto-set started_at
            assert status.completed_at is not None
            assert SyncStatus.is_complete('milestones') is True

    def test_mark_completed_optional_params(self, app):
        """items_synced and details should be optional."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            status = SyncStatus.mark_completed('milestones', success=True)
            assert status.items_synced is None
            assert status.details is None
            assert SyncStatus.is_complete('milestones') is True

    def test_repr(self, app):
        """Test __repr__ output."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            status = SyncStatus.mark_completed('milestones', success=True)
            assert 'milestones' in repr(status)
            assert 'True' in repr(status)


class TestSyncStatusInContext:
    """Tests for SyncStatus integration with the context processor / wizard."""

    def test_wizard_context_has_milestones_false_initially(self, client, app):
        """The wizard context should report has_milestones=False with no sync."""
        with app.app_context():
            response = client.get('/')
            # The page should render without error
            assert response.status_code == 200

    def test_wizard_context_has_milestones_true_after_sync(self, client, app):
        """After a successful milestone sync, the wizard should reflect completion."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True, items_synced=10)

        response = client.get('/')
        assert response.status_code == 200

    def test_wizard_context_has_milestones_false_during_sync(self, client, app):
        """During an in-progress sync, has_milestones should be False."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            # Not completed yet

        response = client.get('/')
        assert response.status_code == 200

    def test_wizard_context_has_revenue_false_initially(self, client, app):
        """The wizard context should report has_revenue=False with no import."""
        with app.app_context():
            response = client.get('/')
            assert response.status_code == 200

    def test_wizard_context_has_revenue_true_after_import(self, client, app):
        """After a successful revenue import, the wizard should reflect completion."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_import')
            SyncStatus.mark_completed('revenue_import', success=True, items_synced=100)

        response = client.get('/')
        assert response.status_code == 200


class TestGetStatus:
    """Tests for SyncStatus.get_status() detail method."""

    def test_get_status_never_run(self, app):
        """get_status should return 'never_run' for untracked sync types."""
        with app.app_context():
            from app.models import SyncStatus
            result = SyncStatus.get_status('milestones')
            assert result['state'] == 'never_run'
            assert result['started_at'] is None
            assert result['completed_at'] is None
            assert result['items_synced'] is None

    def test_get_status_incomplete(self, app):
        """get_status should return 'incomplete' when started but not completed."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            result = SyncStatus.get_status('milestones')
            assert result['state'] == 'incomplete'
            assert result['started_at'] is not None
            assert result['completed_at'] is None

    def test_get_status_failed(self, app):
        """get_status should return 'failed' when completed with success=False."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=False, details='Connection error')
            result = SyncStatus.get_status('milestones')
            assert result['state'] == 'failed'
            assert result['details'] == 'Connection error'

    def test_get_status_complete(self, app):
        """get_status should return 'complete' after successful sync."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True, items_synced=42)
            result = SyncStatus.get_status('milestones')
            assert result['state'] == 'complete'
            assert result['items_synced'] == 42

    def test_get_status_revenue_import(self, app):
        """get_status should work for revenue_import sync type."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_import')
            SyncStatus.mark_completed('revenue_import', success=True,
                                       items_synced=500, details='200 created, 300 updated')
            result = SyncStatus.get_status('revenue_import')
            assert result['state'] == 'complete'
            assert result['items_synced'] == 500
            assert result['details'] == '200 created, 300 updated'

    def test_get_status_revenue_analysis(self, app):
        """get_status should work for revenue_analysis sync type."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_analysis')
            SyncStatus.mark_completed('revenue_analysis', success=True,
                                       items_synced=100, details='100 analyzed, 20 actionable')
            result = SyncStatus.get_status('revenue_analysis')
            assert result['state'] == 'complete'
            assert result['items_synced'] == 100

    def test_get_status_independent_types(self, app):
        """Different sync types should have independent statuses."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True)

            SyncStatus.mark_started('revenue_import')
            # revenue_import left incomplete

            SyncStatus.mark_started('revenue_analysis')
            SyncStatus.mark_completed('revenue_analysis', success=False)

            assert SyncStatus.get_status('milestones')['state'] == 'complete'
            assert SyncStatus.get_status('revenue_import')['state'] == 'incomplete'
            assert SyncStatus.get_status('revenue_analysis')['state'] == 'failed'

    def test_get_status_after_restart(self, app):
        """After completing then restarting, status should be incomplete."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_import')
            SyncStatus.mark_completed('revenue_import', success=True)
            assert SyncStatus.get_status('revenue_import')['state'] == 'complete'

            # Restart (e.g., re-import)
            SyncStatus.mark_started('revenue_import')
            assert SyncStatus.get_status('revenue_import')['state'] == 'incomplete'


class TestSyncWarningBanners:
    """Tests for sync status warning banners on milestone tracker and revenue pages."""

    def test_admin_scheduler_status_uses_actual_manual_completion(self, client, app):
        """Admin immediately reflects a manual sync even with automatic sync disabled."""
        from app.models import SyncStatus, UserPreference, db

        with app.app_context():
            pref = UserPreference.query.first()
            pref.milestone_auto_sync = False
            pref.milestone_sync_hour = 15
            pref.milestone_sync_minute = 5
            SyncStatus.mark_completed('milestones', success=True)
            db.session.commit()
            expected = SyncStatus.get_status('milestones')['completed_at']
            expected = expected.replace(tzinfo=timezone.utc).isoformat()
        response = client.get('/api/admin/tasks/milestone-sync/status')
        assert response.status_code == 200
        assert response.json == {'enabled': False, 'sync_time': '15:05', 'last_sync': expected}

    def test_milestone_tracker_no_warning_when_complete(self, client, app):
        """Milestone tracker should NOT show a warning when sync completed successfully."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
            SyncStatus.mark_completed('milestones', success=True)
        response = client.get('/reports/milestone-tracker')
        html = response.data.decode('utf-8')
        assert "Last milestone sync didn&#39;t finish" not in html
        assert 'Last milestone sync failed' not in html

    def test_milestone_tracker_reattaches_to_interrupted_work(self, client, app):
        """The shared progress panel can discover an interrupted durable sync."""
        with app.app_context():
            from app.models import Job, db
            stale = datetime.now(timezone.utc) - timedelta(minutes=10)
            job = Job(
                job_type='sync:milestones', status=Job.STATUS_RUNNING,
                started_at=stale, heartbeat_at=stale,
            )
            db.session.add(job)
            db.session.commit()
            job_id = job.id
        response = client.get('/reports/milestone-tracker')
        html = response.data.decode('utf-8')
        assert 'data-sb-sync-progress="milestones"' in html
        observed = client.get('/api/jobs/operations/milestones').json['job']
        assert observed['id'] == job_id
        assert observed['state'] == 'interrupted'

    def test_milestone_tracker_reattaches_to_failed_work(self, client, app):
        """The shared progress panel receives the actual failed run and its error."""
        with app.app_context():
            from app.models import Job, db
            now = datetime.now(timezone.utc)
            db.session.add(Job(
                job_type='sync:milestones', status=Job.STATUS_FAILED,
                started_at=now, finished_at=now, last_error='API timeout',
            ))
            db.session.commit()
        response = client.get('/reports/milestone-tracker')
        html = response.data.decode('utf-8')
        assert 'data-sb-sync-progress="milestones"' in html
        observed = client.get('/api/jobs/operations/milestones').json['job']
        assert observed['state'] == 'failed'
        assert observed['error'] == 'API timeout'

    def test_revenue_dashboard_no_warning_when_complete(self, client, app):
        """Revenue dashboard should NOT show warnings when syncs completed."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_sync')
            SyncStatus.mark_completed('revenue_sync', success=True)
            SyncStatus.mark_started('revenue_analysis')
            SyncStatus.mark_completed('revenue_analysis', success=True)
        response = client.get('/reports/revenue')
        html = response.data.decode('utf-8')
        assert "Last revenue import didn" not in html
        assert 'Last revenue import failed' not in html
        assert "Last revenue analysis didn" not in html
        assert 'Last revenue analysis failed' not in html

    def test_revenue_dashboard_warning_when_import_incomplete(self, client, app):
        """Revenue dashboard should show a warning when the sync was incomplete."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_sync')
        response = client.get('/reports/revenue')
        html = response.data.decode('utf-8')
        assert "Last revenue import didn" in html

    def test_revenue_dashboard_warning_when_analysis_failed(self, client, app):
        """Revenue dashboard should show danger alert when analysis failed."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_analysis')
            SyncStatus.mark_completed('revenue_analysis', success=False)
        response = client.get('/reports/revenue')
        html = response.data.decode('utf-8')
        assert 'Last revenue analysis failed' in html

    def test_wizard_shows_milestone_incomplete_warning(self, client, app):
        """Onboarding wizard should reference incomplete state for milestone sync."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('milestones')
        response = client.get('/')
        html = response.data.decode('utf-8')
        assert "milestonesSyncState = &#39;incomplete&#39;" in html or \
               "milestonesSyncState = 'incomplete'" in html

    def test_wizard_shows_revenue_incomplete_warning(self, client, app):
        """Onboarding wizard should reference incomplete state for the revenue sync."""
        with app.app_context():
            from app.models import SyncStatus
            SyncStatus.mark_started('revenue_sync')
        response = client.get('/')
        html = response.data.decode('utf-8')
        assert "revenueSyncState = &#39;incomplete&#39;" in html or \
               "revenueSyncState = 'incomplete'" in html
