/** Local action queue navigation, seller filtering and owned reading restoration. */
(() => {
    'use strict';
    function filterRows(rows, seller) {
        let count = 0;
        for (const row of rows) {
            row.hidden = Boolean(seller && row.dataset.sellerId !== seller);
            if (!row.hidden) count++;
        }
        return count;
    }
    function validateState(state) {
        if (!state || typeof state.seller !== 'string' ||
            !Number.isFinite(state.top) || state.top < 0 ||
            !Number.isFinite(state.left) || state.left < 0) {
            throw new Error('Invalid action queue reading state.');
        }
        if (state.panes !== undefined) {
            if (!state.panes || typeof state.panes !== 'object' || Array.isArray(state.panes)) {
                throw new Error('Invalid action dashboard reading state.');
            }
            for (const position of Object.values(state.panes)) {
                if (!position || !Number.isFinite(position.top) || position.top < 0 ||
                    !Number.isFinite(position.left) || position.left < 0) {
                    throw new Error('Invalid action dashboard cell position.');
                }
            }
        }
        return state;
    }
    function capturePaneState(panes) {
        return Object.fromEntries(panes.map(pane =>
            [pane.id, {top: pane.scrollTop, left: pane.scrollLeft}]));
    }
    function restorePaneState(panes, positions) {
        for (const pane of panes) {
            const position = positions[pane.id];
            if (!position) continue;
            pane.scrollTop = position.top;
            pane.scrollLeft = position.left;
        }
    }
    async function activateEngagementScripts(body, current) {
        for (const old of body.querySelectorAll('script')) {
            if (!current()) return;
            const script = document.createElement('script');
            if (old.src) {
                const loaded = new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Engagement dependency failed.'));
                });
                script.src = old.src;
                old.replaceWith(script);
                await loaded;
            } else {
                script.textContent = old.textContent;
                old.replaceWith(script);
            }
        }
    }
    if (typeof module !== 'undefined') {
        module.exports = {filterRows, validateState, capturePaneState, restorePaneState,
            activateEngagementScripts};
    }
    if (typeof document === 'undefined') return;

    function mount() {
        const root = document.querySelector('[data-actions-hub]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const reading = document.querySelector('.sb-actions-reading');
        const panes = [...root.querySelectorAll('.sb-actions-cell-body')];
        const filter = root.querySelector('#staleMilestoneSellerFilter');
        const rows = [...root.querySelectorAll('.stale-ms-item')];
        const empty = root.querySelector('#staleMilestonesEmpty');
        let restoring = true;
        function warn(message, error) {
            console.error(message, error);
            const notice = document.getElementById('actionsReadingNotice');
            if (notice) { notice.textContent = message; notice.hidden = false; }
        }
        function applyFilter() {
            const count = filterRows(rows, filter?.value || '');
            root.querySelector('#staleMilestoneCount').textContent = count;
            empty.hidden = count !== 0;
            empty.textContent = filter?.value ?
                'No stale milestones for this seller' : 'No stale milestones';
        }
        function save() {
            if (!reading || restoring) return;
            try {
                history.replaceState({...history.state, sbActionQueues: {
                    seller: filter?.value || '', top: reading.scrollTop,
                    left: reading.scrollLeft,
                    panes: capturePaneState(panes),
                }}, '');
            } catch (error) { warn('Could not save action queue context for Back.', error); }
        }
        function restore() {
            restoring = true;
            try {
                const state = history.state?.sbActionQueues;
                if (state && reading) {
                    validateState(state);
                    if (filter) filter.value = state.seller;
                    applyFilter();
                    reading.scrollTop = state.top;
                    reading.scrollLeft = state.left;
                    restorePaneState(panes, state.panes || {});
                }
            } catch (error) { warn('Could not restore action queue context.', error); }
            window.setTimeout(() => { restoring = false; }, 0);
        }
        try {
            if (filter) filter.value = localStorage.getItem('staleMilestoneSellerFilter') || '';
        } catch (error) { warn('Could not restore the saved seller filter.', error); }
        applyFilter();
        filter?.addEventListener('change', () => {
            applyFilter();
            try { localStorage.setItem('staleMilestoneSellerFilter', filter.value); }
            catch (error) { warn('Could not save the seller filter.', error); }
            save();
        });
        root.addEventListener('click', event => {
            const action = event.target.closest('[data-action-preview]');
            const milestone = event.target.closest('[data-milestone-preview]');
            const engagement = event.target.closest('[data-engagement-preview]');
            if (action) window.viewActionItem(Number(action.dataset.actionPreview),
                {showEngagementLink: action.dataset.engagementLink === 'true',
                    showProjectLink: true});
            if (milestone) window.SBMilestonePreview.open(Number(milestone.dataset.milestonePreview),
                milestone.dataset.title, milestone.dataset.status, milestone.dataset.url);
            if (engagement) openEngagement(engagement);
        });
        reading?.addEventListener('scroll', save, {passive: true});
        panes.forEach(pane => pane.addEventListener('scroll', save, {passive: true}));
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', () => window.setTimeout(restore, 0));
        window.setTimeout(restore, 0);
        window.SBTableSort?.mount(root);
    }

    let request = null, generation = 0;
    async function openEngagement(button) {
        const dialog = document.getElementById('actionItemsEngagementModal');
        if (!dialog) { location.assign('/engagement/' + button.dataset.engagementPreview); return; }
        request?.abort();
        request = new AbortController();
        const version = ++generation;
        const body = document.getElementById('aiEngBody');
        document.getElementById('aiEngTitle').textContent = button.dataset.title || 'Engagement';
        const badge = document.getElementById('aiEngBadge');
        badge.className = 'sb-action-item-tag';
        badge.textContent = button.dataset.status || '';
        badge.dataset.tone = {Active: 'success', Won: 'accent',
            Lost: 'danger', 'On Hold': 'warning'}[button.dataset.status] || '';
        document.getElementById('aiEngFullLink').href =
            '/engagement/' + button.dataset.engagementPreview;
        body.querySelector('[data-sb-engagement-detail]')?._engagement?.dispose?.();
        const parentContext = dialog.open ? dialog._engagementParentContext : window.copilotContext;
        dialog._engagementParentContext = parentContext;
        body.textContent = 'Loading engagement...';
        body.removeAttribute('role');
        SBDialog.open(dialog);
        if (dialog._engagementClosed) {
            dialog.removeEventListener('sb:dialog-closed', dialog._engagementClosed);
        }
        dialog._engagementClosed = event => {
            if (event.target !== dialog) return;
            generation++; request?.abort();
            body.querySelector('[data-sb-engagement-detail]')?._engagement?.dispose?.();
            window.copilotContext = parentContext;
            dialog.removeEventListener('sb:dialog-closed', dialog._engagementClosed);
            dialog._engagementClosed = null;
        };
        dialog.addEventListener('sb:dialog-closed', dialog._engagementClosed);
        try {
            const response = await fetch('/api/engagement/' +
                button.dataset.engagementPreview + '/detail', {signal: request.signal});
            if (!response.ok) throw new Error('Engagement HTTP ' + response.status);
            const html = await response.text();
            if (version !== generation) return;
            body.innerHTML = html;
            // The host already owns the canonical local-task dialogs.
            body.querySelectorAll('#actionItemDetailModal, #aiDiscardDialog')
                .forEach(duplicate => duplicate.remove());
            await activateEngagementScripts(body, () => version === generation);
            window.SBLocalDateTime?.render(body);
            window.SBTableSort?.mount(body);
        } catch (error) {
            if (version !== generation || request.signal.aborted) return;
            console.error('Unable to load engagement details.', error);
            body.textContent = 'Failed to load engagement details. Close and try again, or open Full Page.';
            body.setAttribute('role', 'alert');
        }
    }
    window.openActionItemsEngagement = (id, title, status) => openEngagement({
        dataset: {engagementPreview: id, title, status},
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})();
