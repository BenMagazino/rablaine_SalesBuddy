/**
 * Shared native bucket filter. Empty selection intentionally shows every row.
 * Local selections persist across pages; server preferences remain a read-only fallback.
 */
var RevenueBucketFilter = (() => {
    'use strict';
    const STORAGE_KEY = 'salesbuddy_revenue_bucket_filter';
    const VERSION_KEY = 'salesbuddy_revenue_bucket_taxonomy_version';
    const views = new Map(), callbacks = new Set(), warnings = new Map();
    let allBuckets = [], selectedBuckets = new Set();
    let loaded = false, usedFallback = true, edits = 0, pending = null;

    function warn(key, text, error) {
        console.error('Revenue bucket filter ' + key + ':', error);
        warnings.set(key, text);
        syncViews();
    }

    function saveSelection() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedBuckets]));
            warnings.delete('storage');
        } catch (error) {
            warn('storage', 'Could not remember this selection. It applies on this page only.', error);
        }
    }

    function loadSelection() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const saved = raw === null ? [] : JSON.parse(raw);
            if (!Array.isArray(saved) || saved.some(bucket => typeof bucket !== 'string')) {
                throw new Error('Invalid saved bucket selection.');
            }
            selectedBuckets = new Set(saved.filter(bucket => allBuckets.includes(bucket)));
            usedFallback = saved.length === 0;
            warnings.delete('storage');
        } catch (error) {
            selectedBuckets = new Set();
            usedFallback = true;
            warn('storage', 'Saved bucket selection is unavailable. Showing all buckets for now.', error);
        }
    }

    async function read(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Request failed (HTTP ' + response.status + ').');
        return response.json();
    }

    async function hydrate() {
        const version = edits;
        try {
            const data = await read('/api/revenue/sync/status');
            if (!Number.isInteger(data?.bucket_taxonomy_version) || data.bucket_taxonomy_version < 0) {
                throw new Error('Invalid bucket taxonomy version.');
            }
            const serverVersion = String(data.bucket_taxonomy_version);
            try {
                const savedVersion = localStorage.getItem(VERSION_KEY);
                if ((savedVersion === null ? '0' : savedVersion) !== serverVersion) {
                    if (version === edits) localStorage.removeItem(STORAGE_KEY);
                    localStorage.setItem(VERSION_KEY, serverVersion);
                    if (version === edits) {
                        selectedBuckets = new Set();
                        usedFallback = true;
                    }
                }
            } catch (error) {
                warn('storage', 'Could not check saved bucket version. ' +
                    'Your current page selection is unchanged.', error);
            }
            warnings.delete('taxonomy');
        } catch (error) {
            warn('taxonomy', 'Could not check bucket changes. Your current selection is unchanged.', error);
        }
        if (usedFallback && version === edits) {
            try {
                const buckets = await read('/api/revenue/compensated-buckets');
                if (!Array.isArray(buckets) || buckets.some(bucket => typeof bucket !== 'string')) {
                    throw new Error('Invalid saved bucket list.');
                }
                if (version === edits && buckets.length) {
                    selectedBuckets = new Set(buckets);
                    saveSelection();
                }
                warnings.delete('fallback');
            } catch (error) {
                if (version === edits && usedFallback) {
                    warn('fallback', 'Could not load saved buckets. ' +
                        'Your current selection is unchanged.', error);
                } else {
                    console.error('Revenue bucket filter superseded fallback:', error);
                }
            }
        }
        applyFilter();
    }

    function refresh() {
        if (pending) return pending;
        if (warnings.has('storage')) {
            if (edits === 0) loadSelection();
            else saveSelection();
        }
        pending = hydrate().finally(() => { pending = null; syncViews(); });
        syncViews();
        return pending;
    }

    function syncViews() {
        for (const view of views.values()) {
            const count = selectedBuckets.size;
            view.count.textContent = count + '/' + allBuckets.length;
            view.count.hidden = !(count > 0 && count < allBuckets.length);
            view.selectAll.checked = allBuckets.length > 0 &&
                allBuckets.every(bucket => selectedBuckets.has(bucket));
            view.selectAll.indeterminate = !view.selectAll.checked &&
                allBuckets.some(bucket => selectedBuckets.has(bucket));
            for (const checkbox of view.list.querySelectorAll('input')) {
                checkbox.checked = selectedBuckets.has(checkbox.value);
            }
            view.status.textContent = [...warnings.values()].join(' ');
            view.status.setAttribute('role', warnings.size ? 'alert' : 'status');
            view.retry.hidden = warnings.size === 0;
            view.retry.disabled = pending !== null;
            if (view.panel.matches(':popover-open')) position(view);
        }
    }

    function applyFilter() {
        let visible = 0;
        document.querySelectorAll('[data-bucket]').forEach(element => {
            const show = selectedBuckets.size === 0 || selectedBuckets.has(element.dataset.bucket);
            element.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        syncViews();
        for (const callback of callbacks) callback(visible);
    }

    function change() {
        edits++;
        usedFallback = false;
        warnings.delete('fallback');
        saveSelection();
        applyFilter();
    }

    function searchRows(view) {
        const term = view.search.value.toLowerCase().trim();
        let visible = 0;
        for (const row of view.list.children) {
            row.hidden = !row.dataset.bucketName.includes(term);
            if (!row.hidden) visible++;
        }
        view.empty.hidden = visible !== 0;
        view.empty.textContent = allBuckets.length ?
            'No buckets match your search.' : 'No buckets on this page.';
        if (view.panel.matches(':popover-open')) position(view);
    }

    function position(view, reset = false) {
        const button = view.button.getBoundingClientRect(), panel = view.panel.getBoundingClientRect();
        if (reset || !view.anchor) {
            view.anchor = button.bottom + 6 + panel.height <= window.innerHeight - 8 ?
                'below' : 'above';
        }
        const left = Math.max(8, Math.min(button.right - panel.width,
            window.innerWidth - panel.width - 8));
        const attachedTop = view.anchor === 'above' ?
            button.top - panel.height - 6 : button.bottom + 6;
        const top = Math.max(8, Math.min(attachedTop, window.innerHeight - panel.height - 8));
        view.panel.style.left = left + 'px';
        view.panel.style.top = top + 'px';
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function buildRows(view) {
        view.list.replaceChildren();
        allBuckets.forEach((bucket, index) => {
            const row = element('label', 'sb-bucket-option');
            row.dataset.bucketName = bucket.toLowerCase();
            const checkbox = element('input', 'sb-bucket-check');
            checkbox.type = 'checkbox';
            checkbox.value = bucket;
            checkbox.id = view.panel.id + '-bucket-' + index;
            row.htmlFor = checkbox.id;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) selectedBuckets.add(bucket);
                else selectedBuckets.delete(bucket);
                change();
            });
            row.appendChild(checkbox);
            row.appendChild(element('span', '', bucket));
            view.list.appendChild(row);
        });
        searchRows(view);
    }

    function renderFilterUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Revenue bucket filter container missing:', containerId);
            return;
        }
        const existing = views.get(container);
        if (existing) { buildRows(existing); return; }
        const button = element('button', 'sb-bucket-button', 'Buckets');
        button.type = 'button';
        const count = element('span', 'sb-bucket-count');
        count.hidden = true;
        button.appendChild(count);
        const panel = element('div', 'sb-bucket-popover');
        panel.id = containerId + '-bucket-popover';
        panel.setAttribute('popover', 'auto');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Revenue bucket filter');
        button.setAttribute('popovertarget', panel.id);
        button.setAttribute('aria-controls', panel.id);
        button.setAttribute('aria-expanded', 'false');
        const heading = element('div', 'sb-bucket-heading', 'Revenue buckets');
        const search = element('input', 'sb-bucket-search');
        search.type = 'search';
        search.placeholder = 'Search buckets';
        search.setAttribute('aria-label', 'Search revenue buckets');
        search.autocomplete = 'off';
        const selectRow = element('label', 'sb-bucket-option sb-bucket-select-all');
        const selectAll = element('input', '');
        selectAll.type = 'checkbox';
        selectRow.appendChild(selectAll);
        selectRow.appendChild(element('span', '', 'Select all'));
        const list = element('div', 'sb-bucket-list');
        const empty = element('p', 'sb-bucket-empty');
        empty.setAttribute('role', 'status');
        const hint = element('p', 'sb-bucket-hint', 'No selection shows every bucket.');
        const status = element('p', 'sb-bucket-status');
        status.setAttribute('aria-live', 'polite');
        const retry = element('button', 'sb-bucket-button', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', refresh);
        for (const node of [heading, search, selectRow, list, empty, hint, status, retry]) {
            panel.appendChild(node);
        }
        const view = {button, count, panel, search, selectAll, list, empty, status, retry};
        views.set(container, view);
        search.addEventListener('input', () => searchRows(view));
        selectAll.addEventListener('change', () => {
            selectedBuckets = selectAll.checked ? new Set(allBuckets) : new Set();
            change();
        });
        panel.addEventListener('toggle', event => {
            button.setAttribute('aria-expanded', String(event.newState === 'open'));
            if (event.newState === 'open') {
                view.anchor = null;
                search.value = '';
                searchRows(view);
                position(view);
                search.focus();
            }
        });
        container.appendChild(button);
        container.appendChild(panel);
        buildRows(view);
    }

    window.addEventListener('resize', () => {
        for (const view of views.values()) if (view.panel.matches(':popover-open')) position(view, true);
    });
    window.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const view = [...views.values()].find(item => item.panel.matches(':popover-open'));
        if (!view) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        view.panel.hidePopover();
        view.button.focus();
    }, true);
    window.addEventListener('pagehide', () => {
        for (const view of views.values()) {
            if (view.panel.matches(':popover-open')) view.panel.hidePopover();
        }
    });

    return Object.freeze({
        init(options = {}) {
            options = options || {};
            if (options.onFilterChange) callbacks.add(options.onFilterChange);
            const previous = allBuckets.join('\0');
            allBuckets = [...new Set([...document.querySelectorAll('[data-bucket]')]
                .map(row => row.dataset.bucket).filter(Boolean))].sort();
            if (previous !== allBuckets.join('\0')) {
                for (const view of views.values()) buildRows(view);
            }
            if (!loaded) { loadSelection(); loaded = true; }
            if (options.containerId) renderFilterUI(options.containerId);
            applyFilter();
            return refresh();
        },
        toggle(bucket) {
            if (selectedBuckets.has(bucket)) selectedBuckets.delete(bucket);
            else selectedBuckets.add(bucket);
            change();
        },
        selectAll() { selectedBuckets = new Set(allBuckets); change(); },
        selectNone() { selectedBuckets.clear(); change(); },
        getSelected: () => [...selectedBuckets],
        isSelected: bucket => selectedBuckets.has(bucket),
        getAllBuckets: () => allBuckets.slice(),
    });
})();
