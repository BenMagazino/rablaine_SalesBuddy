/* Read-only freshness snapshots; these requests never start a data refresh. */
(() => {
    'use strict';

    const sources = [
        {id: 'homeMilestonesFreshness', label: 'Milestones', type: 'milestones'},
        {id: 'homeACRFreshness', label: 'ACR', type: 'revenue_sync'},
        {id: 'homeMeetingsFreshness', label: "Today's Meetings", url: '/api/meetings/today-status',
            render: renderMeetingStatus},
        {id: 'homeU2CFreshness', label: 'U2C', type: 'u2c_import'},
        {id: 'homeAccountsFreshness', label: 'Accounts', type: 'accounts'},
    ];
    const refreshButton = document.getElementById('homeFreshnessRefresh');
    const popover = document.getElementById('homeFreshnessPopover');
    const toggleButton = document.getElementById('homeFreshnessToggle');
    const POLL_INTERVAL_MS = 60000;
    const REQUEST_TIMEOUT_MS = 10000;
    let pending = null;
    let pollHandle = null;

    function show(element, label, text, state = 'neutral') {
        const value = label + ': ' + text;
        if (element.textContent !== value) element.textContent = value;
        element.dataset.state = state;
        delete element.dataset.freshnessStamp;
    }

    function showTimestamp(element, label, timestamp) {
        if (typeof timestamp !== 'string' || !timestamp.trim()) {
            throw new Error(label + ' has no valid sync timestamp.');
        }
        if (element.dataset.freshnessStamp === timestamp) return;
        const time = document.createElement('time');
        time.className = 'local-datetime';
        time.setAttribute('data-utc', timestamp);
        time.setAttribute('data-fmt', 'short');
        time.title = 'Recorded refresh: ' + timestamp + '. Displayed in your local time.';
        time.setAttribute('datetime', timestamp);
        element.replaceChildren(document.createTextNode(label + ': '), time);
        window.SBLocalDateTime.render(element);
        if (time.textContent === 'Unavailable') throw new Error(label + ' timestamp is invalid.');
        element.dataset.state = 'neutral';
        element.dataset.freshnessStamp = timestamp;
    }

    function renderStatus(element, label, data) {
        const states = {
            never_run: ['not refreshed yet', 'neutral'],
            in_progress: ['refreshing...', 'neutral'],
            failed: ['last refresh failed', 'error'],
            incomplete: ['last refresh interrupted', 'warning'],
        };
        if (data?.state === 'complete') {
            showTimestamp(element, label, data.completed_at);
        } else if (data && Object.hasOwn(states, data.state)) {
            const [text, state] = states[data.state];
            show(element, label, text, state);
        } else {
            throw new Error(label + ' freshness response is invalid.');
        }
    }

    function renderMeetingStatus(element, label, data) {
        if (typeof data?.synced !== 'boolean') {
            throw new Error(label + ' freshness response is invalid.');
        }
        if (data.synced) {
            showTimestamp(element, label, data.synced_at);
        } else {
            show(element, label, 'Not Pulled', 'warning');
        }
        window.dispatchEvent(new CustomEvent('sb:meetings-today-status', {detail: data}));
    }

    async function read(run, source) {
        const {label, type, id} = source;
        const element = document.getElementById(id);
        try {
            const response = await fetch(source.url || '/api/admin/sync-status/' + type,
                {signal: run.controller.signal});
            if (!response.ok) throw new Error(label + ' status HTTP ' + response.status + '.');
            const data = await response.json();
            if (pending === run) (source.render || renderStatus)(element, label, data);
        } catch (error) {
            if (pending !== run) return;
            console.error('Unable to check ' + label + ' freshness.', error);
            show(element, label, 'status unavailable', 'error');
        }
    }

    function refresh() {
        if (pending) return pending.promise;
        const run = {controller: new AbortController(), promise: null};
        pending = run;
        refreshButton.setAttribute('aria-disabled', 'true');
        refreshButton.setAttribute('aria-busy', 'true');
        const timeout = setTimeout(() => run.controller.abort(), REQUEST_TIMEOUT_MS);
        run.promise = Promise.all(sources.map(source => read(run, source))).finally(() => {
            clearTimeout(timeout);
            if (pending !== run) return;
            pending = null;
            refreshButton.setAttribute('aria-disabled', 'false');
            refreshButton.setAttribute('aria-busy', 'false');
        });
        return run.promise;
    }

    function start() {
        if (pollHandle !== null) return;
        refresh();
        pollHandle = setInterval(() => {
            if (!document.hidden) refresh();
        }, POLL_INTERVAL_MS);
    }

    refreshButton.addEventListener('click', refresh);
    function dismissDetails(event) {
        if (event.key !== 'Escape' || !popover.matches(':popover-open')) return;
        event.preventDefault();
        event.stopPropagation();
        popover.hidePopover();
        toggleButton.focus();
    }
    popover.addEventListener('keydown', dismissDetails);
    toggleButton.addEventListener('keydown', dismissDetails);
    popover.addEventListener('toggle', event => {
        const open = event.newState === 'open';
        toggleButton.setAttribute('aria-expanded', String(open));
        if (open) refresh();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && pollHandle !== null) refresh();
    });
    window.addEventListener('pagehide', () => {
        clearInterval(pollHandle);
        pollHandle = null;
        const run = pending;
        pending = null;
        if (run) run.controller.abort();
    });
    window.addEventListener('pageshow', start);
    window.addEventListener('sb:meetings-cache-updated', () => {
        const recheck = () => {
            if (pollHandle !== null) return refresh();
        };
        if (pending) pending.promise.then(recheck);
        else recheck();
    });
    if (document.readyState !== 'complete') {
        window.addEventListener('DOMContentLoaded', start, {once: true});
    } else {
        start();
    }
})();
