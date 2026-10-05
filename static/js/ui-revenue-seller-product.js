/** Seller monthly comparisons filter locally without altering revenue or sort order. */
(() => {
    'use strict';
    function create(root) {
        const search = root.querySelector('[data-sb-seller-product-search]');
        const clear = root.querySelector('[data-sb-seller-product-clear]');
        const reading = root.querySelector('[data-sb-seller-product-reading]');
        const empty = root.querySelector('[data-sb-seller-product-no-matches]');
        const notice = root.querySelector('[data-sb-seller-product-notice]');
        const count = root.dataset.embedded === 'true' ?
            root.querySelector('[data-sb-seller-product-count]') :
            document.querySelector('[data-sb-seller-product-count]');
        if (!search || !clear || !reading || !notice || !count) {
            throw new Error('Seller product comparison controls or count are missing.');
        }
        const entries = [...root.querySelectorAll('[data-sb-seller-product-entry]')]
            .map(row => ({row, text: row.textContent.trim().toLowerCase()}));
        const url = new URL(window.location.href);
        const customer = url.searchParams.get('customer'), bucket = url.searchParams.get('bucket');
        const targeted = customer !== null || bucket !== null;
        const match = targeted ? entries.find(entry =>
            entry.row.dataset.customerName === customer && entry.row.dataset.bucket === bucket) : null;
        if (targeted && !match) {
            notice.hidden = false;
            notice.textContent = 'The requested customer entry is no longer available. All seller entries remain listed.';
            console.warn('Seller product customer/bucket bookmark is unavailable.');
        }
        if (match) match.row.dataset.active = 'true';
        function filter() {
            const query = search.value.toLowerCase();
            let shown = 0;
            for (const entry of entries) {
                entry.row.hidden = !entry.text.includes(query);
                if (!entry.row.hidden) shown++;
                else if (entry.row.contains(document.activeElement)) {
                    search.focus({preventScroll: true});
                }
            }
            clear.hidden = !query;
            if (empty) empty.hidden = shown > 0;
            count.textContent = `${shown} of ${entries.length} customer entries shown`;
        }
        function restore() {
            const saved = window.history.state?.sbSellerProduct;
            if (saved && (typeof saved.search !== 'string' ||
                !Number.isFinite(saved.scroll) || saved.scroll < 0)) {
                notice.hidden = false;
                notice.textContent = 'Saved comparison context could not be restored.';
                console.error('Invalid seller product browser history state.');
                throw new Error('Invalid seller product browser history state.');
            }
            if (saved) search.value = saved.search;
            filter();
            if (saved) reading.scrollTop = saved.scroll;
            else if (match && !match.row.hidden) match.row.scrollIntoView({block: 'center'});
        }
        search.addEventListener('input', filter);
        clear.addEventListener('click', () => {
            search.value = '';
            filter();
            search.focus({preventScroll: true});
        });
        window.addEventListener('pageshow', () => window.setTimeout(restore, 0));
        window.addEventListener('popstate', restore);
        if (root.dataset.embedded !== 'true') {
            window.addEventListener('pagehide', () => {
                const state = window.history.state;
                window.history.replaceState({
                    ...(state && typeof state === 'object' ? state : {}),
                    sbSellerProduct: {search: search.value, scroll: reading.scrollTop},
                }, '');
            });
        }
        filter();
        return Object.freeze({filter});
    }
    const root = document.querySelector('[data-sb-seller-product]');
    if (root) create(root);
})();
