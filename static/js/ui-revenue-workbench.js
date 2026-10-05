/** Seller alert queue uses the existing table's filters and the shared guarded record loader. */
(() => {
    'use strict';
    const controllers = new WeakMap();
    function create(root) {
        if (controllers.has(root)) return controllers.get(root);
        const notice = root.querySelector('[data-sb-queue-error]');
        function fail(message) {
            if (notice) { notice.hidden = false; notice.textContent = message; }
            throw new Error(message);
        }
        const find = selector => root.querySelector(selector) || fail('Missing workbench region: ' + selector);
        const queue = find('[data-sb-queue-view]'), tableView = find('[data-sb-table-view]');
        const panel = find('[data-sb-queue-inspector]'), empty = find('[data-sb-queue-empty]');
        const table = find('#alertsTable');
        const queueList = find('[data-sb-queue-list]');
        const modes = document.querySelector('[data-sb-revenue-modes]');
        if (!modes) fail('Revenue view controls are missing.');
        const items = [...root.querySelectorAll('[data-sb-queue-alert]')];
        const rows = new Map([...table.querySelectorAll('tbody tr[data-analysis-id]')]
            .map(row => [row.dataset.analysisId, row]));
        if (items.length !== rows.size ||
            new Set(items.map(item => item.dataset.sbQueueAlert)).size !== rows.size ||
            items.some(item => !rows.has(item.dataset.sbQueueAlert) ||
                !Number.isSafeInteger(Number(item.dataset.sbQueueAlert)) ||
                !/^[1-9]\d*$/.test(item.dataset.sbQueueAlert))) {
            fail('The alert queue does not match the comparison table.');
        }
        if (typeof SBRecordDialog === 'undefined') {
            fail('Alert queue unavailable: the record loader is missing. Table view remains available.');
        }
        let mode = 'table', selectedId = null, reviewedId = null;
        const reviewing = () => !!document.getElementById('reviewActionModal')?.open;
        const controller = SBRecordDialog.create(panel, {
            presentation: 'panel', statusText: '',
            isBusy: reviewing,
            stateEvent: 'sb:revenue-panel-state',
            loadUrl: id => `/api/revenue/analysis/${id}/detail`,
            fullUrl: id => items.find(item => item.dataset.sbQueueAlert === String(id)).dataset.fullUrl,
            fragmentSelector: '[data-sb-revenue-detail]', identityAttribute: 'data-sb-revenue-id',
            busyText: 'Close Review Alert before changing the selected alert or view.',
            errorText: 'Retry to load this alert.',
            onSelection(snapshot) {
                selectedId = String(snapshot.id);
                for (const item of items) {
                    const selected = item.dataset.sbQueueAlert === selectedId;
                    item.setAttribute('aria-selected', String(selected));
                    item.tabIndex = selected ? 0 : -1;
                }
                panel.querySelector('[data-sb-record-full-link]').textContent =
                    items.find(item => item.dataset.sbQueueAlert === selectedId).dataset.fullLabel;
            },
            mount() {
                return {isDirty: () => false, isBusy: reviewing, dispose() {}};
            },
        });
        function select(item) {
            return controller.open({id: Number(item.dataset.sbQueueAlert),
                title: item.dataset.customerName});
        }
        function visible() {
            return [...queue.querySelectorAll('[data-sb-queue-alert]')].filter(item => !item.hidden);
        }
        function sync() {
            const current = [...queue.querySelectorAll('[data-sb-queue-alert]')];
            const itemById = new Map(items.map(item => [item.dataset.sbQueueAlert, item]));
            const ordered = [...table.querySelectorAll('tbody tr[data-analysis-id]')]
                .map(row => itemById.get(row.dataset.analysisId));
            if (ordered.some((item, index) => item !== current[index])) {
                for (const item of ordered) queueList.appendChild(item);
            }
            for (const item of items) {
                const row = rows.get(item.dataset.sbQueueAlert);
                item.hidden = row.hidden || getComputedStyle(row).display === 'none';
            }
            const shown = visible();
            empty.hidden = shown.length > 0;
            if (mode !== 'queue') return;
            const desired = shown.find(item => item.dataset.sbQueueAlert === selectedId) || shown[0];
            if (desired) select(desired);
            else if (controller.clear()) {
                selectedId = null;
                for (const item of items) {
                    item.tabIndex = -1;
                    item.setAttribute('aria-selected', 'false');
                }
            }
        }
        function setMode(next) {
            if (!['queue', 'table'].includes(next)) fail('Invalid revenue view: ' + next);
            if (mode === next) return;
            if (!controller.clear()) return false;
            mode = next;
            queue.hidden = next !== 'queue';
            tableView.hidden = next !== 'table';
            for (const button of modes.querySelectorAll('[data-sb-revenue-mode]')) {
                button.setAttribute('aria-pressed', String(button.dataset.sbRevenueMode === next));
            }
            sync();
            return true;
        }
        for (const item of items) {
            item.addEventListener('click', () => select(item));
            item.addEventListener('keydown', event => {
                const shown = visible(), index = shown.indexOf(item);
                const next = event.key === 'ArrowDown' ? Math.min(index + 1, shown.length - 1) :
                    event.key === 'ArrowUp' ? Math.max(index - 1, 0) :
                    event.key === 'Home' ? 0 : event.key === 'End' ? shown.length - 1 : null;
                if (next === null || !shown[next]) return;
                event.preventDefault();
                if (select(shown[next]) !== false) {
                    shown[next].focus({preventScroll: true});
                    shown[next].scrollIntoView({block: 'nearest'});
                }
            });
        }
        for (const button of modes.querySelectorAll('[data-sb-revenue-mode]')) {
            button.addEventListener('click', () => setMode(button.dataset.sbRevenueMode));
        }
        const observer = new MutationObserver(sync);
        observer.observe(table, {subtree: true, childList: true, attributes: true,
            attributeFilter: ['style', 'hidden', 'class']});
        document.addEventListener('sb:revenue-review-saved', event => {
            if (panel.contains(event.target) && String(event.detail?.analysisId) === selectedId) {
                reviewedId = selectedId;
            }
        });
        document.addEventListener('sb:dialog-closed', event => {
            if (event.target.id !== 'reviewActionModal') return;
            panel.dispatchEvent(new CustomEvent('sb:revenue-panel-state'));
            sync();
            if (reviewedId !== null && reviewedId === selectedId && mode === 'queue') {
                controller.refresh();
            }
            reviewedId = null;
        });
        window.addEventListener('pagehide', () => controller.clear());
        window.addEventListener('pageshow', event => { if (event.persisted) sync(); });
        const api = Object.freeze({setMode, sync});
        controllers.set(root, api);
        modes.hidden = false;
        setMode('queue');
        return api;
    }
    window.SBRevenueWorkbench = Object.freeze({create});
    for (const root of document.querySelectorAll('[data-sb-revenue-workbench]')) create(root);
})();
