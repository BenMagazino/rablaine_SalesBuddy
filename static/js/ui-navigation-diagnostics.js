/** Bounded, local-only navbar event metadata for intermittent navigation failures. */
(() => {
    'use strict';
    const bar = document.querySelector('.sb-app-bar');
    if (!bar) return;
    const storageKey = 'sb.navbar-diagnostics.v1';
    const limit = 256;
    const status = document.getElementById('navDiagnosticsStatus');
    const menus = {
        sellersMenu: 'sellers', dashboardsMenu: 'dashboards', reportsMenu: 'reports',
        browseMenu: 'browse', settingsMenu: 'settings',
    };
    const pageNames = new Set([
        'home', 'reports', 'customers', 'customer', 'notes', 'note', 'engagements',
        'engagement', 'partners', 'partner', 'sellers', 'seller', 'preferences', 'admin',
        'topics', 'territories', 'products', 'pods', 'search', 'analytics', 'revenue',
        'action-items', 'milestones', 'solution-engineers', 'internal-contacts', 'other',
    ]);
    const types = new Set([
        'page-ready', 'pageshow', 'pagehide', 'beforeunload', 'window-focus', 'window-blur',
        'visibility', 'pointerdown', 'pointerup', 'pointerenter', 'pointerleave',
        'click', 'click-result', 'focusin', 'focusout',
        'popover-open', 'popover-close', 'menu-open', 'menu-close', 'navigation-start',
        'navigation-abort', 'navigation-error', 'navigation-not-observed',
        'activation-not-observed', 'script-error', 'storage-unavailable', 'history-reset',
        'diagnostics-export',
    ]);
    const strings = {
        menu: new Set(['sellers', 'dashboards', 'reports', 'browse', 'settings', 'page', 'none']),
        focus: new Set(['navbar-search', 'menu-item', 'menu-trigger', 'navbar', 'dialog',
            'page-input', 'page-content']),
        reason: new Set(['hover', 'trigger', 'keyboard', 'menu-switch', 'pointer-leave',
            'link-click', 'outside-pointer', 'outside-focus', 'scroll', 'escape', 'tab',
            'dialog-opening']),
        navigation_type: new Set(['push', 'replace', 'reload', 'traverse']),
        error: new Set(['AbortError', 'SecurityError', 'QuotaExceededError', 'TypeError',
            'SyntaxError', 'InvalidStateError', 'Error', 'other']),
    };
    const booleans = ['focused', 'visible', 'menu_open', 'expanded', 'default_prevented',
        'expected_navigation', 'modified', 'propagation_stopped', 'same_document', 'persisted',
        'download'];
    let memoryOnly = false;
    let persistenceError = null;
    let resetHistory = false;
    let saveTimer = null;
    let attemptTimer = null;
    let pending = null;
    let downloadNavigation = false;

    function errorName(error) {
        return strings.error.has(error?.name) ? error.name : 'other';
    }

    function storageUnavailable(error) {
        memoryOnly = true;
        persistenceError = errorName(error);
        console.warn('Navbar diagnostic history cannot persist across pages:', persistenceError);
        if (status) status.textContent =
            'Recording on this page only: browser storage is unavailable. Download before leaving.';
    }

    function clean(record) {
        if (!record || !types.has(record.type) || !Number.isSafeInteger(record.time) ||
            record.time < 0 ||
            !Number.isSafeInteger(record.page_id) || record.page_id < 1) return null;
        const safe = {time: record.time, page_id: record.page_id, type: record.type,
            page: pageNames.has(record.page) ? record.page : 'other'};
        for (const [name, allowed] of Object.entries(strings)) {
            if (allowed.has(record[name])) safe[name] = record[name];
        }
        for (const name of booleans) {
            if (typeof record[name] === 'boolean') safe[name] = record[name];
        }
        if (Number.isSafeInteger(record.item) && record.item >= 0 && record.item < 4096) {
            safe.item = record.item;
        }
        return safe;
    }

    function load() {
        let raw;
        try { raw = window.sessionStorage.getItem(storageKey); }
        catch (error) { storageUnavailable(error); }
        if (raw) {
            try {
                if (raw.length > 131072) throw new Error('Diagnostic history exceeds its limit');
                const saved = JSON.parse(raw);
                if (saved.schema_version !== 1 || !Number.isSafeInteger(saved.pages) ||
                    saved.pages < 0 || !Array.isArray(saved.events)) {
                    throw new Error('Invalid diagnostic history');
                }
                const events = saved.events.slice(-limit).map(clean).filter(Boolean);
                if (events.length !== Math.min(saved.events.length, limit)) {
                    throw new Error('Invalid diagnostic events');
                }
                return {schema_version: 1, pages: saved.pages, events};
            } catch (error) {
                resetHistory = true;
                console.warn('Unreadable navbar diagnostic history was reset:', errorName(error));
                if (status) status.textContent =
                    'Earlier diagnostic history was unreadable; recording has restarted.';
            }
        }
        return {schema_version: 1, pages: 0, events: []};
    }

    let history = load();
    let pageId = ++history.pages;

    function persist() {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (memoryOnly) return;
        try { window.sessionStorage.setItem(storageKey, JSON.stringify(history)); }
        catch (error) {
            storageUnavailable(error);
            record('storage-unavailable', {error: persistenceError});
        }
    }

    function record(type, details = {}) {
        const page = location.pathname.split('/')[1] || 'home';
        const event = clean({...details, type, time: Date.now(), page_id: pageId,
            page, focused: document.hasFocus(), visible: document.visibilityState === 'visible'});
        if (!event) return;
        history.events.push(event);
        if (history.events.length > limit) history.events.splice(0, history.events.length - limit);
        if (!memoryOnly && saveTimer === null) saveTimer = setTimeout(persist, 300);
    }

    function focusKind(target) {
        if (target?.id === 'navCustomerSearch') return 'navbar-search';
        if (target?.closest?.('.sb-nav-menu a[href]')) return 'menu-item';
        if (target?.closest?.('[data-sb-menu]')) return 'menu-trigger';
        if (bar.contains(target)) return 'navbar';
        if (target?.closest?.('dialog')) return 'dialog';
        if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return 'page-input';
        return 'page-content';
    }

    function describe(target) {
        const trigger = target?.closest?.('[data-sb-menu]');
        const menu = trigger ? document.getElementById(trigger.dataset.sbMenu) :
            target?.closest?.('.sb-nav-menu');
        const link = target?.closest?.('a[href]');
        const details = {menu: menu ? menus[menu.id] || 'page' : 'none',
            focus: focusKind(document.activeElement)};
        if (menu) {
            details.menu_open = menu.matches(':popover-open');
            if (link) details.item = [...menu.querySelectorAll('a[href]')].indexOf(link);
        }
        if (trigger) details.expanded = trigger.getAttribute('aria-expanded') === 'true';
        return details;
    }

    function expectsNavigation(event) {
        const link = event.target.closest?.('a[href]');
        if (!link || event.button > 0 || event.ctrlKey || event.metaKey || event.altKey ||
            event.shiftKey || link.hasAttribute('download') ||
            (link.target && link.target !== '_self')) return false;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return false;
        const url = new URL(link.href, location.href);
        if (url.hash && url.pathname === location.pathname && url.search === location.search) {
            return false;
        }
        return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol);
    }

    function finishAttempt() {
        if (!pending) return;
        if (pending.click) {
            record('click-result', {...pending.details,
                default_prevented: pending.click.defaultPrevented,
                propagation_stopped: !pending.bubbled});
            if (!pending.started) record('navigation-not-observed',
                {...pending.details, default_prevented: pending.click.defaultPrevented});
        } else {
            record('activation-not-observed', pending.details);
        }
        pending = null;
    }

    for (const type of ['pointerdown', 'pointerup', 'click', 'focusin', 'focusout']) {
        document.addEventListener(type, event => {
            const target = event.target;
            if (!bar.contains(target) && !target.closest?.('.sb-nav-menu') &&
                !document.querySelector('.sb-nav-menu:popover-open')) return;
            const details = {...describe(target), default_prevented: event.defaultPrevented};
            if (type === 'pointerdown' || type === 'click') {
                details.expected_navigation = expectsNavigation(event);
                details.modified = Boolean(event.ctrlKey || event.metaKey ||
                    event.altKey || event.shiftKey);
            }
            record(type, details);
            if (details.expected_navigation && (type === 'pointerdown' || type === 'click')) {
                clearTimeout(attemptTimer);
                if (type === 'pointerdown' || pending?.click) finishAttempt();
                if (type === 'pointerdown' || !pending) {
                    pending = {details, started: false, click: null, bubbled: false};
                }
                if (type === 'click') pending.click = event;
                attemptTimer = setTimeout(finishAttempt, type === 'click' ? 600 : 1500);
            }
        }, true);
    }
    document.addEventListener('click', event => {
        if (pending?.click === event) pending.bubbled = true;
    });
    for (const type of ['pointerenter', 'pointerleave']) {
        document.addEventListener(type, event => {
            if (event.target.matches?.('[data-sb-menu], .sb-nav-menu')) {
                record(type, describe(event.target));
            }
        }, true);
    }
    document.addEventListener('beforetoggle', event => {
        if (event.target.matches?.('.sb-nav-menu')) {
            record(event.newState === 'open' ? 'popover-open' : 'popover-close',
                describe(event.target));
        }
    }, true);
    for (const [name, type] of [['focus', 'window-focus'], ['blur', 'window-blur']]) {
        window.addEventListener(name, () => record(type, {focus: focusKind(document.activeElement)}));
    }
    document.addEventListener('visibilitychange', () => record('visibility'));
    window.addEventListener('beforeunload', () => record('beforeunload'));
    window.addEventListener('pagehide', event => {
        clearTimeout(attemptTimer);
        if (pending?.click) record('click-result', {...pending.details,
            default_prevented: pending.click.defaultPrevented,
            propagation_stopped: !pending.bubbled});
        pending = null;
        record('pagehide', {persisted: event.persisted});
        persist();
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) {
            history = load();
            pageId = ++history.pages;
        }
        record('pageshow', {persisted: event.persisted});
    });
    window.addEventListener('error', event => {
        if (pending || document.querySelector('.sb-nav-menu:popover-open')) {
            record('script-error', {error: errorName(event.error)});
        }
    });
    if (window.navigation) {
        window.navigation.addEventListener('navigate', event => {
            const download = typeof event.downloadRequest === 'string';
            downloadNavigation = download;
            if (pending && !download) pending.started = true;
            record('navigation-start', {navigation_type: event.navigationType,
                same_document: event.destination.sameDocument, download});
            event.signal.addEventListener('abort', () =>
                record('navigation-abort', {error: errorName(event.signal.reason), download}),
            {once: true});
        });
        window.navigation.addEventListener('navigateerror', event =>
            record('navigation-error', {error: errorName(event.error), download: downloadNavigation}));
    }

    function snapshot() {
        return {schema_version: 1, captured_at: new Date().toISOString(),
            environment: {
                mode: location.port === '5000' ? 'development' :
                    location.port === '5151' ? 'installed' : 'other',
                renderer: (navigator.userAgent.match(
                    /(?:Chrome|Chromium|Electron|Edg|Firefox)\/[\d.]+/g,
                ) || []).slice(0, 4),
                navigation_api: Boolean(window.navigation),
                persistence: memoryOnly ? 'page-memory-only' : 'tab-session',
                persistence_error: persistenceError,
            },
            event_limit: limit, events: history.events.map(clean).filter(Boolean)};
    }

    window.SBNavDiagnostics = Object.freeze({
        menu(action, trigger, reason) {
            if (action === 'open' || action === 'close') {
                record(`menu-${action}`, {...describe(trigger), reason});
            }
        },
        snapshot,
    });
    document.getElementById('navDiagnosticsDownload')?.addEventListener('click', () => {
        let url;
        let link;
        try {
            clearTimeout(attemptTimer);
            finishAttempt();
            if (status) status.setAttribute('role', 'status');
            record('diagnostics-export');
            persist();
            const data = snapshot();
            url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)],
                {type: 'application/json'}));
            link = document.createElement('a');
            link.href = url;
            link.download = `salesbuddy-navbar-${data.captured_at.replace(/[:.]/g, '-')}.json`;
            link.hidden = true;
            let click;
            link.addEventListener('click', event => { click = event; }, {once: true});
            document.body.append(link);
            link.click();
            if (click?.defaultPrevented) throw new Error('Diagnostic download was canceled');
            if (status) status.textContent = 'Download requested. Nothing is uploaded automatically.';
        } catch (error) {
            console.error('Navbar diagnostic download failed:', errorName(error));
            if (status) {
                status.setAttribute('role', 'alert');
                status.textContent =
                    'Could not download diagnostics. Check browser download permissions and retry.';
            }
        } finally {
            link?.remove();
            if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    });
    record('page-ready');
    if (memoryOnly) record('storage-unavailable', {error: persistenceError});
    if (resetHistory) record('history-reset');
})();
