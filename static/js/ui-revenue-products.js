/** Product selection loads the shared customer comparison without monthly histories. */
(() => {
    'use strict';
    const controllers = new WeakMap();
    function create(root) {
        if (controllers.has(root)) return controllers.get(root);
        const search = root.querySelector('#directoryProductSearch');
        const clear = root.querySelector('[data-sb-products-clear]');
        const empty = root.querySelector('[data-sb-products-no-matches]');
        const count = root.dataset.embedded === 'true' ?
            root.querySelector('[data-sb-products-count]') :
            document.querySelector('[data-sb-products-count]');
        if (!search || !clear || !count) {
            throw new Error('Product directory search controls or scope count are missing.');
        }
        const entries = [...root.querySelectorAll('[data-sb-directory-product]')].map((row, index) => ({
            row, id: index + 1, name: row.dataset.productName,
            link: row.querySelector('[data-sb-products-link]'),
            button: row.querySelector('[data-sb-products-select]'),
            text: [...row.querySelectorAll('[data-sb-directory-value]')]
                .map(cell => cell.textContent.trim()).join(' ').toLowerCase(),
        }));
        const enhance = root.dataset.embedded !== 'true' && entries.length > 0;
        const inspector = root.querySelector('[data-sb-products-inspector]');
        const reading = root.querySelector('[data-sb-products-reading]');
        const noSelection = root.querySelector('[data-sb-products-no-selection]');
        if (enhance && (!inspector || !reading || !noSelection ||
            entries.some(entry => !entry.name || !entry.link || !entry.button) ||
            new Set(entries.map(entry => entry.name)).size !== entries.length)) {
            throw new Error('Product directory selection controls or identities are missing.');
        }
        let selected = null, customerScroll = null, pendingScroll = 0;
        const entryRows = new Map(entries.map(entry => [entry.row, entry]));
        const available = () => [...root.querySelectorAll('[data-sb-directory-product]')]
            .map(row => entryRows.get(row)).filter(entry => !entry.row.hidden);
        const entryById = id => {
            const entry = entries.find(item => item.id === id);
            if (!entry) throw new Error('Unknown directory product: ' + id);
            return entry;
        };
        function remember() {
            const state = window.history.state;
            window.history.replaceState({
                ...(state && typeof state === 'object' ? state : {}),
                sbProductsDirectory: {
                    product: selected?.name ?? null, search: search.value,
                    listScroll: reading.scrollTop, customerScroll: customerScroll?.scrollTop ?? 0,
                },
            }, '');
        }
        const loader = enhance ? window.SBRecordDialog.create(inspector, {
            presentation: 'panel',
            loadUrl: id => entryById(id).link.getAttribute('href') + '?comparison=1',
            fullUrl: id => entryById(id).link.getAttribute('href'),
            fragmentSelector: '[data-sb-products-comparison]',
            identityAttribute: 'data-sb-products-comparison',
            identityValue: id => entryById(id).name,
            statusText: root.dataset.comparisonStatus ||
                'All imported months. Choose a customer to open its graph and history.',
            errorText: 'Customer consumption could not be loaded. Retry or use Open product.',
            mount(content) {
                const comparison = content.querySelector('[data-sb-products-comparison]');
                if (!comparison || (comparison.dataset.sbProductsSeller || '') !==
                    (root.dataset.sellerName || '')) {
                    throw new Error('Product customer comparison does not match this seller scope.');
                }
                const scroll = content.querySelector('[data-sb-products-customer-scroll]');
                if (!scroll) throw new Error('Product customer reading region is missing.');
                customerScroll = scroll;
                window.requestAnimationFrame(() => {
                    if (customerScroll === scroll) scroll.scrollTop = pendingScroll;
                });
                return {isDirty: () => false, isBusy: () => false,
                    dispose() { if (customerScroll === scroll) customerScroll = null; }};
            },
        }) : null;
        function select(entry, restoreScroll = null) {
            if (!enhance) return false;
            if (entry && !available().includes(entry)) {
                throw new Error('Product selection is outside the visible directory.');
            }
            if (inspector.contains(document.activeElement) && selected !== entry) {
                (entry?.link || search).focus({preventScroll: true});
            }
            pendingScroll = restoreScroll ??
                (selected === entry ? customerScroll?.scrollTop ?? pendingScroll : 0);
            selected = entry ?? null;
            for (const item of entries) {
                const active = item === selected;
                item.row.dataset.active = String(active);
                item.button.setAttribute('aria-pressed', String(active));
            }
            noSelection.hidden = !!selected;
            if (!selected) { loader.clear(); return true; }
            loader.open({id: selected.id, title: selected.name});
            if (customerScroll) customerScroll.scrollTop = pendingScroll;
            return true;
        }
        function writeLocation() {
            const url = new URL(window.location.href);
            if (selected) url.searchParams.set('product', selected.name);
            else url.searchParams.delete('product');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
        function filter(restore = false) {
            const query = search.value.toLowerCase();
            let shown = 0;
            for (const entry of entries) {
                entry.row.hidden = !entry.text.includes(query);
                if (!entry.row.hidden) shown++;
                else if (entry.row.contains(document.activeElement)) search.focus({preventScroll: true});
            }
            clear.hidden = !query;
            if (empty) empty.hidden = shown > 0;
            const message = `${shown} of ${entries.length} products shown`;
            if (count.textContent !== message) count.textContent = message;
            if (enhance) {
                const saved = restore ? window.history.state?.sbProductsDirectory : null;
                const product = new URL(window.location.href).searchParams.get('product');
                const bookmarked = entries.find(entry => entry.name === product);
                if (restore && product !== null && !bookmarked) {
                    select(null);
                    noSelection.textContent = 'The requested product is no longer available. Choose a product from the list.';
                    return shown;
                }
                noSelection.textContent = 'No matching products. Clear search to choose a product.';
                const visible = available();
                const target = restore ? bookmarked : selected ?? bookmarked;
                const next = visible.includes(target) ? target : visible[0] ?? null;
                if (next !== selected || restore) {
                    select(next, saved?.customerScroll ?? 0);
                }
                if (restore && saved) reading.scrollTop = saved.listScroll;
                writeLocation();
            }
            return shown;
        }
        search.addEventListener('input', () => filter());
        clear.addEventListener('click', () => {
            search.value = '';
            filter();
            search.focus({preventScroll: true});
        });
        // Browser-restored form values arrive after pageshow.
        window.addEventListener('pageshow', () => window.setTimeout(() => {
            const saved = enhance ? window.history.state?.sbProductsDirectory : null;
            if (saved) search.value = saved.search;
            filter(true);
        }, 0));
        if (enhance) {
            root.dataset.sbProductsEnhanced = 'true';
            for (const entry of entries) {
                entry.button.hidden = false;
                const choose = () => {
                    select(entry);
                    writeLocation();
                };
                entry.button.addEventListener('click', choose);
                entry.link.addEventListener('click', event => {
                    if (event.button > 0 || event.ctrlKey || event.metaKey ||
                        event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    choose();
                });
                entry.row.addEventListener('click', event => {
                    if (!event.target.closest('a, button')) choose();
                });
            }
            window.addEventListener('pagehide', remember);
            window.addEventListener('popstate', () => filter(true));
        }
        const api = Object.freeze({filter, get selected() { return selected?.name ?? null; }});
        controllers.set(root, api);
        filter(true);
        return api;
    }
    window.SBProductsDirectory = Object.freeze({create});
    const root = document.querySelector('[data-sb-products-directory]');
    if (root) create(root);
})();
