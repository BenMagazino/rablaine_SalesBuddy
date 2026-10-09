"""Native setup, SalesIQ and final sharing consumer contracts."""
from pathlib import Path

from bs4 import BeautifulSoup


def test_setup_uses_mandatory_native_dialog_and_preserves_auth_states(client):
    """All auth outcomes and both setup steps remain independently addressable."""
    soup = BeautifulSoup(client.get('/').data, 'html.parser')
    dialog = soup.select_one('dialog#welcomeModal')
    assert dialog is not None
    assert 'sb-dialog' in dialog.get('class', [])
    assert dialog['data-sb-escape-close'] == 'false'
    assert dialog['data-sb-backdrop-close'] == 'false'
    for identity in (
        'onboardingStep1', 'onboardingStep2', 'startSignInBtn', 'signInInitial',
        'signInWaiting', 'signInBrowserHint', 'signInStatus', 'signInStillWaitingNudge',
        'signInCancelBtn', 'signInSuccess', 'signInEmail', 'signInVpnBlocked',
        'signInVpnEmail', 'vpnRetryBtn', 'signInError', 'signInErrorMsg', 'signInRetryBtn',
        'signInNoCli', 'signInNoCliMsg', 'signInNoCliHelp', 'signInNoCliRetryBtn',
        'onboardDarkModeToggle', 'onboardStartImport', 'importIncompleteWarning',
        'importIncompleteText', 'onboardBackBtn', 'onboardNextBtn',
    ):
        assert dialog.select_one(f'#{identity}') is not None, identity
    assert dialog.select_one('#onboardNextBtn').has_attr('disabled')
    assert not dialog.select('[data-bs-dismiss], .modal, .card, .btn, .form-check-input')


def test_setup_preserves_three_sequential_import_phases(client):
    """Native progress and retry controls retain the original phase identities."""
    soup = BeautifulSoup(client.get('/').data, 'html.parser')
    for phase in ('Accounts', 'Milestones', 'Revenue'):
        for suffix in ('Icon', 'Status', 'BarWrap', 'Bar', 'Summary', 'Retry'):
            assert soup.select_one(f'#phase{phase}{suffix}') is not None
        progress = soup.select_one(f'#phase{phase}Bar')
        assert progress['role'] == 'progressbar'
        assert progress['aria-valuemax'] == '100'
    script = Path('templates/partials/_onboarding_js.html').read_text(encoding='utf-8')
    assert 'const ready = accountsImported || await runAccounts();' in script
    assert 'if (!milestonesImported) await runMilestones();' in script
    assert 'if (!revenueImported) await runRevenue();' in script
    assert 'const escapeHatch = accountsImported && importFailed && !importRunning;' in script
    assert "window.addEventListener('beforeunload', warnOnLeave)" in script
    assert "bar.setAttribute('aria-valuenow', String(pct))" in script
    assert 'bootstrap.' not in script
    assert 'd-none' not in script
    assert 'spinner-border' not in script


def test_setup_sign_in_uses_shared_icon_label_spacing(client):
    """Native icon buttons keep a real gap instead of collapsing whitespace in flex layout."""
    soup = BeautifulSoup(client.get('/').data, 'html.parser')
    button = soup.select_one('#startSignInBtn.sb-dialog-button')
    assert button['type'] == 'button'
    assert button.get_text(strip=True) == 'Sign In to Azure'
    assert button.select_one('.bi-box-arrow-in-right')['aria-hidden'] == 'true'
    css = Path('static/css/ui-dialog.css').read_text(encoding='utf-8')
    rule = css.split('\n.sb-dialog-button {', 1)[1].split('}', 1)[0]
    assert 'gap: var(--sb-ui-space-2);' in rule


def test_completed_setup_has_a_closed_review_entry_without_reset(client, app):
    """Completed users can inspect setup without first resetting their preferences."""
    from app.models import db, UserPreference

    with app.app_context():
        preference = UserPreference.query.first()
        preference.first_run_modal_dismissed = True
        db.session.commit()
    soup = BeautifulSoup(client.get('/').data, 'html.parser')
    dialog = soup.select_one('dialog#welcomeModal')
    assert dialog['data-sb-auto-open'] == 'false'
    assert not dialog.has_attr('open')
    assert dialog.select_one('#setupReviewClose') is not None
    assert dialog.select_one('#setupReviewStatus') is not None
    source = Path('templates/partials/_onboarding_js.html').read_text(encoding='utf-8')
    assert 'window.openSetupWizard = () =>' in source
    assert 'if (autoOpen) initWizard();' in source
    assert "window.SBDialog.close(welcomeModal, 'review')" in source
    with app.app_context():
        assert UserPreference.query.first().first_run_modal_dismissed is True


def test_guided_tour_preserves_all_seven_destinations_and_completion():
    """Theme adaptation never removes tour steps or its persisted completion flow."""
    source = Path('templates/partials/_guided_tour.html').read_text(encoding='utf-8')
    for identity in ('navCustomers', 'navSellers', 'navPods', 'navMilestones',
                     'navRevenue', 'navQuickLookup', 'navNewNote'):
        assert f"element: '#{identity}'" in source
    assert source.count('element:') == 7
    assert "'/api/preferences/guided-tour-complete'" in source
    assert "localStorage.setItem('salesbuddy_tour_completed', '1')" in source
    assert "localStorage.getItem('salesbuddy_start_tour')" in source


def test_chat_native_nonmodal_pane_retains_all_actions(app, client, monkeypatch):
    """Debug availability stays unchanged and chat no longer requires offcanvas."""
    monkeypatch.setitem(app.config, 'DEBUG', True)
    soup = BeautifulSoup(client.get('/').data, 'html.parser')
    pane = soup.select_one('aside#copilotChatFlyout')
    assert pane is not None and pane.has_attr('hidden')
    assert soup.select_one('script[src*="/js/ui-shortcuts.js"]') is not None
    for identity in ('copilotChatMessages', 'copilotChatInput', 'copilotChatSend',
                     'copilotChatClear', 'copilotChatClose'):
        assert pane.select_one(f'#{identity}') is not None
    assert pane.select_one('#copilotChatMessages')['role'] == 'log'
    assert pane.select_one('#copilotChatMessages')['aria-live'] == 'polite'
    assert pane.select_one('#copilotChatInput')['aria-describedby'] == 'copilotChatHint'
    assert not pane.select('[data-bs-dismiss], .offcanvas, .btn, .form-control')


def test_chat_remains_debug_only(app, client, monkeypatch):
    """A presentation migration must not broaden SalesIQ release availability."""
    monkeypatch.setitem(app.config, 'DEBUG', False)
    soup = BeautifulSoup(client.get('/').data, 'html.parser')
    assert soup.select_one('#copilotChatFlyout') is None


def test_chat_transport_context_history_and_citations_remain_intact():
    """Sending still uses the existing endpoint, history limit and markdown links."""
    source = Path('templates/partials/_copilot_chat_js.html').read_text(encoding='utf-8')
    for text in (
        "fetch('/api/ai/chat'", "const MAX_HISTORY = 20;",
        "const HISTORY_KEY = 'copilotChatHistory';", "const OPEN_KEY = 'copilotChatOpen';",
        'context: getContext()', 'history: history.slice(-(MAX_HISTORY - 1))',
        'window.copilotContext', 'renderMarkdownTable', "if (e.key === 'Enter' && !e.shiftKey)",
        '<a href="$2" target="_blank">$1</a>', 'data.tools_used', 'Network error.',
        'clearBtn.disabled = true;', 'if (isWaiting) return;',
    ):
        assert text in source, text
    assert 'bootstrap.' not in source
    assert '.bs.offcanvas' not in source


def test_final_sharing_consumers_use_native_review_and_no_legacy_client(client):
    """Directory, partner and note consumers share the guarded native implementation."""
    soup = BeautifulSoup(client.get('/partners').data, 'html.parser')
    for identity in ('shareModal', 'shareImportReviewModal'):
        dialog = soup.select_one(f'dialog#{identity}')
        assert dialog is not None
        assert 'sb-dialog' in dialog.get('class', [])
    assert soup.select_one('#shareImportConfirmBtn') is not None
    assert soup.select_one('#shareImportStatus') is not None
    assert [path.name for path in Path('static/js').glob('share*.js')] == ['share.js']
    assert soup.select_one('script[src$="/js/share.js"]') is not None
