/** Product search limits comparison scope; row selection presents existing customer history. */
(() => {
    'use strict';
    const controllers = new WeakMap();
    function create(root) {
        if (controllers.has(root)) return controllers.get(root);
        const notice = root.querySelector('[data-sb-product-notice]');
        function fail(message) {
            if (notice) { notice.textContent = message; notice.hidden = false; }
            throw new Error(message);
        }
        const find = selector => root.querySelector(selector) || fail('Missing product region: ' + selector);
        const search = find('#productCustomerSearch'), clear = find('[data-sb-product-clear]');
        const reading = find('[data-sb-product-reading]');
        const noSelection = find('[data-sb-product-no-selection]');
        const missing = find('[data-sb-product-missing-history]');
        const missingTitle = find('[data-sb-product-missing-title]');
        const noMatches = root.querySelector('[data-sb-product-no-matches]');
        const fallbackEmpty = root.querySelector('[data-sb-product-fallback-empty]');
        const status = root.dataset.embedded === 'true' ? null :
            document.querySelector('[data-sb-product-status]');
        const panels = [...root.querySelectorAll('[data-sb-product-history]')];
        const histories = new Map(panels.map(panel => [panel.dataset.sbProductHistory, panel]));
        const entries = [...root.querySelectorAll('[data-sb-product-entry]')].map(row => ({
            row, name: row.dataset.customerName,
            button: row.querySelector('[data-sb-product-select]'),
            history: histories.get(row.dataset.customerName),
            text: [...row.querySelectorAll('[data-sb-product-search-value]')]
                .map(cell => cell.textContent.trim()).join(' ').toLowerCase(),
        }));
        const enhance = root.dataset.embedded !== 'true' && entries.length > 0;
        if (enhance && (histories.size !== panels.length ||
            new Set(entries.map(entry => entry.row.id)).size !== entries.length ||
            entries.some(entry => !entry.button || !entry.row.id || !entry.name) ||
            panels.some(panel => !entries.some(entry => entry.name === panel.dataset.sbProductHistory)))) {
            fail('Product history does not match the customer entries. The full reading view remains available.');
        }
        const trend = enhance ? window.SBProductRevenueTrend.create(root) : null;
        let selected = null;
        const available = () => entries.filter(entry => !entry.row.hidden);
        const fromHash = () => entries.find(entry => '#' + entry.row.id === window.location.hash);
        const selectedUrl = () => selected ? '#' + selected.row.id :
            window.location.pathname + window.location.search;
        function select(entry, push = false) {
            if (!enhance) {
                notice.textContent = 'Customer selection is available in the standalone product view.';
                notice.hidden = false;
                return false;
            }
            if (entry && !available().includes(entry)) {
                notice.textContent = 'This entry is outside the search results. Clear search or choose a visible entry.';
                notice.hidden = false;
                return false;
            }
            const focused = document.activeElement;
            const changed = selected?.name !== entry?.name;
            if ((changed && (panels.some(panel => panel.contains(focused)) ||
                missing.contains(focused))) ||
                entries.some(item => item.row.hidden && item.row.contains(focused))) {
                (entry?.button || search).focus({preventScroll: true});
            }
            if (changed) reading.scrollTop = 0;
            selected = entry ?? null;
            for (const panel of panels) panel.hidden = panel !== selected?.history;
            noSelection.hidden = selected !== null;
            missing.hidden = !selected || !!selected.history;
            if (selected) missingTitle.textContent = selected.name;
            if (fallbackEmpty) fallbackEmpty.hidden = true;
            for (const item of entries) {
                const active = item === selected;
                item.row.dataset.active = String(active);
                item.button.setAttribute('aria-pressed', String(active));
            }
            if (trend) trend.show(selected?.history ?? null);
            if (push && window.location.hash !== selectedUrl()) {
                window.history.pushState(window.history.state, '', selectedUrl());
            }
            notice.hidden = true;
            return true;
        }
        function filter(restore = false) {
            const query = search.value.toLowerCase();
            for (const entry of entries) entry.row.hidden = !entry.text.includes(query);
            const shown = available();
            if (noMatches) noMatches.hidden = shown.length > 0;
            clear.hidden = !query;
            const text = `${shown.length} of ${entries.length} customer entries shown`;
            if (status && status.textContent !== text) status.textContent = text;
            if (!enhance) return;
            const bookmarked = fromHash();
            select(restore ? (shown.includes(bookmarked) ? bookmarked : shown[0] ?? null) :
                shown.includes(selected) ? selected :
                    shown.includes(bookmarked) ? bookmarked : shown[0] ?? null);
            if (window.location.hash && window.location.hash !== selectedUrl()) {
                window.history.replaceState(window.history.state, '', selectedUrl());
            }
        }
        search.addEventListener('input', () => filter());
        clear.addEventListener('click', () => {
            search.value = '';
            filter();
            search.focus({preventScroll: true});
        });
        if (enhance) {
            root.dataset.sbProductEnhanced = 'true';
            for (const entry of entries) {
                entry.button.hidden = false;
                entry.button.addEventListener('click', () => select(entry, true));
                entry.row.addEventListener('click', event => {
                    if (!event.target.closest('a, button')) select(entry, true);
                });
            }
            function restoreLocation() {
                filter(true);
            }
            window.addEventListener('popstate', restoreLocation);
            window.addEventListener('hashchange', restoreLocation);
        }
        const api = Object.freeze({filter, select: id =>
            select(entries.find(entry => entry.row.id === id) || fail('Unknown customer entry: ' + id), true),
            get selected() { return selected?.row.id ?? null; }});
        controllers.set(root, api);
        // Form values are restored after pageshow; reconcile on the next browser task.
        window.addEventListener('pageshow', () => window.setTimeout(() => filter(true), 0));
        filter();
        return api;
    }
    window.SBProductRevenue = Object.freeze({create});
    const root = document.querySelector('[data-sb-revenue-page="product"]');
    if (root) create(root);
})();
