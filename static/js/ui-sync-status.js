/** Non-blocking meeting-sync feedback, independent of Bootstrap. */
(() => {
    'use strict';

    const POSITION_KEY = 'syncStatusCardPos';
    const POLL_INTERVAL_MS = 3000;
    const required = id => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing meeting-sync control: ${id}`);
        return element;
    };
    const card = required('syncStatusCard');
    const header = required('syncStatusCardHeader');
    const title = required('syncStatusTitle');
    const current = required('syncStatusCurrent');
    const date = required('syncStatusDate');
    const progress = required('syncStatusProgress');
    const errorPanel = required('syncStatusError');
    const retry = required('syncStatusRetry');
    const dismiss = required('syncStatusDismiss');
    let pollHandle = null, pending = null, generation = 0, opener = null;
    let dragOffsetX = 0, dragOffsetY = 0;

    function place(left, top) {
        card.style.left = Math.max(0, Math.min(
            left, document.documentElement.clientWidth - card.offsetWidth,
        )) + 'px';
        card.style.top = Math.max(0, Math.min(
            top, document.documentElement.clientHeight - card.offsetHeight,
        )) + 'px';
        card.style.right = 'auto';
    }

    function constrainPosition() {
        if (card.hidden) return;
        const rect = card.getBoundingClientRect();
        if (rect.left < 0 || rect.top < 0 ||
            rect.right > document.documentElement.clientWidth ||
            rect.bottom > document.documentElement.clientHeight) {
            place(rect.left, rect.top);
        }
    }

    function restorePosition() {
        try {
            const raw = localStorage.getItem(POSITION_KEY);
            if (raw) {
                const position = JSON.parse(raw);
                if (!position || !Number.isFinite(position.left) ||
                    !Number.isFinite(position.top)) {
                    throw new Error('Saved meeting-sync position is invalid.');
                }
                place(position.left, position.top);
            }
        } catch (error) {
            console.warn('Unable to restore meeting-sync position.', error);
        }
        constrainPosition();
    }

    function savePosition() {
        const rect = card.getBoundingClientRect();
        try {
            localStorage.setItem(POSITION_KEY, JSON.stringify({left: rect.left, top: rect.top}));
        } catch (error) {
            console.warn('Unable to save meeting-sync position.', error);
        }
    }

    function stopDragging() {
        header.style.cursor = 'grab';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', onDrop);
    }

    function onDrag(event) {
        place(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
    }

    function onDrop() {
        stopDragging();
        savePosition();
    }

    header.addEventListener('mousedown', event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        header.style.cursor = 'grabbing';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', onDrop);
    });
    window.addEventListener('resize', constrainPosition);

    function conceal() {
        generation++;
        pending = null;
        const returnFocus = card.contains(document.activeElement);
        card.hidden = true;
        stopDragging();
        if (returnFocus) {
            const target = opener && opener !== document.body && opener.isConnected &&
                !opener.disabled && opener.getClientRects().length &&
                !opener.closest('[hidden], [inert]') ? opener : required('main-content');
            target.focus({preventScroll: true});
        }
    }

    function hide({reload = false} = {}) {
        conceal();
        if (pollHandle !== null) clearInterval(pollHandle);
        pollHandle = null;
        // The calendar owns per-day refresh. Never rebuild it from this card.
        if (reload) {
            if (typeof window.checkTodayStatus === 'function') window.checkTodayStatus();
            window.dispatchEvent(new CustomEvent('sb:meetings-cache-updated'));
        }
    }

    function reveal() {
        if (card.hidden && !card.contains(document.activeElement)) opener = document.activeElement;
        card.hidden = false;
        restorePosition();
        if (pollHandle === null) pollHandle = setInterval(() => refresh(false), POLL_INTERVAL_MS);
    }

    function validate(state, partial = false) {
        if (!state || typeof state !== 'object' || Array.isArray(state) ||
            ((!partial || 'running' in state) && typeof state.running !== 'boolean') ||
            (state.current_date != null && typeof state.current_date !== 'string') ||
            (state.aura_dates !== undefined && (!Array.isArray(state.aura_dates) ||
                state.aura_dates.some(value => typeof value !== 'string')))) {
            throw new Error('Meeting-sync status response is invalid.');
        }
        return state;
    }

    function update(state) {
        const message = state.job ? window.SBJobs.message(state.job) : '';
        title.textContent = 'Refreshing meetings';
        card.dataset.sbState = 'running';
        current.hidden = Boolean(message);
        progress.hidden = false;
        errorPanel.hidden = true;
        retry.disabled = false;
        date.textContent = state.current_date || 'today';
        const index = state.aura_dates?.indexOf(state.current_date) ?? -1;
        progress.textContent = message || (index >= 0 ?
            `Day ${index + 1} of ${state.aura_dates.length}` : '');
        constrainPosition();
    }

    async function readState() {
        if (!pending) {
            pending = (async () => {
                const response = await fetch('/api/meetings/sync-status');
                if (!response.ok) throw new Error(`Meeting-sync status HTTP ${response.status}.`);
                return validate(await response.json());
            })();
        }
        const request = pending;
        try {
            return await request;
        } finally {
            if (pending === request) pending = null;
        }
    }

    async function refresh(show = true) {
        const version = generation;
        let state;
        try {
            state = await readState();
        } catch (error) {
            if (version !== generation) return;
            console.error('Unable to check meeting-sync status.', error);
            title.textContent = 'Meeting sync status';
            card.dataset.sbState = 'error';
            current.hidden = true;
            progress.hidden = true;
            errorPanel.hidden = false;
            retry.disabled = false;
            if (show) reveal();
            constrainPosition();
            return;
        }
        if (version !== generation) return;
        if (!state.running) {
            if (state.error) {
                title.textContent = 'Meeting sync failed';
                card.dataset.sbState = 'error';
                current.hidden = true;
                progress.hidden = false;
                progress.textContent = state.error + ' Check Sync Status for details.';
                errorPanel.hidden = true;
                if (show) reveal();
                if (pollHandle !== null) clearInterval(pollHandle);
                pollHandle = null;
                return;
            }
            hide({reload: !show});
            return;
        }
        update(state);
        if (show) reveal();
    }

    function check() {
        generation++;
        pending = null;
        if (document.activeElement === retry) dismiss.focus({preventScroll: true});
        retry.disabled = true;
        return refresh();
    }

    dismiss.addEventListener('click', conceal);
    retry.addEventListener('click', check);
    window.SyncStatus = {
        check,
        forceShow(state) {
            const snapshot = validate(state ?? {}, true);
            generation++;
            pending = null;
            update(snapshot);
            reveal();
        },
        hide,
    };
})();
