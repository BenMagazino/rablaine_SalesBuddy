/* Bucket navigation focuses filtered content without changing the saved filter. */
(() => {
    'use strict';
    const controllers = new WeakMap();
    function create(root) {
        if (controllers.has(root)) return controllers.get(root);
        const analyses = [...root.querySelectorAll('[data-sb-customer-analysis]')];
        const histories = [...root.querySelectorAll('[data-sb-customer-history]')];
        const status = document.querySelector('[data-sb-customer-revenue-status]');
        const empty = root.querySelector('[data-sb-customer-filter-empty]');
        const heading = root.querySelector('#customerAnalysesTitle');
        const analysisGroup = root.querySelector('.sb-revenue-customer-analyses');
        const available = item => item.style.display !== 'none';
        const count = items => items.filter(available).length;
        const enhance = root.dataset.embedded !== 'true' && (analyses.length || histories.length);
        const nav = root.querySelector('[data-sb-customer-nav]');
        const links = [...root.querySelectorAll('[data-sb-customer-bucket]')];
        const overviewLink = root.querySelector('[data-sb-customer-overview-link]');
        const overview = root.querySelector('#bucket-total');
        const overviewContext = root.querySelector('[data-sb-customer-overview-context]');
        const options = root.querySelector('[data-sb-customer-bucket-options]');
        const returnLink = root.querySelector('[data-sb-customer-return]');
        const noAnalysis = root.querySelector('[data-sb-customer-no-analysis]');
        const contextTitle = root.querySelector('[data-sb-customer-context-title]');
        const noHistory = root.querySelector('[data-sb-customer-no-history]');
        const noData = root.querySelector('[data-sb-customer-no-data]');
        const historyArea = root.querySelector('.sb-revenue-customer-history-area');
        const title = root.querySelector('.sb-revenue-page-header h1');
        const notice = root.querySelector('[data-sb-customer-view-notice]');
        let selected = null;
        const reviewing = () => !!document.getElementById('reviewActionModal')?.open;
        function fail(message) {
            notice.hidden = false;
            notice.textContent = message;
            throw new Error(message);
        }
        const buckets = new Map(links.map(link => [link.dataset.sbCustomerBucket, {
            link,
            analyses: analyses.filter(item => item.dataset.bucket === link.dataset.sbCustomerBucket),
            histories: histories.filter(item => item.dataset.bucket === link.dataset.sbCustomerBucket),
        }]));
        if (enhance && (buckets.size !== links.length ||
            new Set(links.map(link => link.getAttribute('href'))).size !== links.length ||
            [...buckets.values()].some(bucket => !bucket.analyses.length && !bucket.histories.length))) {
            fail('Bucket navigation does not match the customer content. The reading view remains available.');
        }
        function shownBuckets() {
            return [...buckets].filter(([, bucket]) =>
                [...bucket.analyses, ...bucket.histories].some(available)).map(([name]) => name);
        }
        function selectedHash() {
            if (window.location.hash === '#bucket-total' && overview) return '#overview';
            return links.find(link => link.getAttribute('href') === window.location.hash)
                ?.dataset.sbCustomerBucket ?? null;
        }
        function selectedUrl() {
            return selected === '#overview' ? '#bucket-total' :
                buckets.get(selected)?.link.getAttribute('href') ??
                window.location.pathname + window.location.search;
        }
        function show(next, updateUrl = false) {
            if (reviewing()) {
                notice.textContent = 'Close Review Alert before changing the selected bucket or view.';
                notice.hidden = false;
                return false;
            }
            if ((next !== null && next !== '#overview' && !shownBuckets().includes(next)) ||
                (next === '#overview' && !overview)) {
                notice.textContent = 'This view is not available in the current scope. Choose a visible bucket or adjust Buckets.';
                notice.hidden = false;
                return false;
            }
            const changed = selected !== next;
            const focused = document.activeElement;
            if ((changed && (historyArea.contains(focused) || returnLink.contains(focused) ||
                analyses.some(item => item.contains(focused)))) ||
                (options.hidden && options.contains(focused)) ||
                links.some(link => link.hidden && link.contains(focused))) {
                (nav.hidden ? title : nav).focus({preventScroll: true});
            }
            selected = next;
            for (const item of [...analyses, ...histories]) {
                item.hidden = next === '#overview' || item.dataset.bucket !== next;
            }
            if (overview) overview.hidden = next !== '#overview';
            overviewContext.hidden = next !== '#overview';
            const bucket = buckets.get(next);
            if (analysisGroup) analysisGroup.hidden = !bucket || !bucket.analyses.some(available);
            noAnalysis.hidden = !bucket || bucket.analyses.some(available);
            if (bucket) contextTitle.textContent = next;
            noHistory.hidden = !bucket || bucket.histories.some(available);
            if (noData) noData.hidden = next !== null;
            empty.hidden = next !== null || !(analyses.length || histories.length);
            for (const link of links) {
                if (link.dataset.sbCustomerBucket === next) link.setAttribute('aria-current', 'true');
                else link.removeAttribute('aria-current');
            }
            if (overviewLink) {
                if (next === '#overview') overviewLink.setAttribute('aria-current', 'true');
                else overviewLink.removeAttribute('aria-current');
            }
            const shown = shownBuckets();
            returnLink.hidden = next !== '#overview' || shown.length !== 1;
            if (!returnLink.hidden) {
                returnLink.textContent = 'View ' + shown[0];
                returnLink.setAttribute('href', buckets.get(shown[0]).link.getAttribute('href'));
            }
            if (changed) historyArea.scrollTop = 0;
            if (updateUrl) {
                if (window.location.hash !== selectedUrl()) {
                    window.history.pushState(window.history.state, '', selectedUrl());
                }
            }
            notice.hidden = true;
            return true;
        }
        function synchronize() {
            const visibleAnalyses = count(analyses), visibleHistories = count(histories);
            const text = `${visibleHistories} of ${histories.length} history buckets in scope, ` +
                `${visibleAnalyses} of ${analyses.length} analyses`;
            if (status && status.textContent !== text) status.textContent = text;
            if (!enhance) {
                empty.hidden = !((analyses.length || histories.length) &&
                    !visibleAnalyses && !visibleHistories);
                if (heading) heading.hidden = visibleAnalyses === 0;
                return;
            }
            const shown = shownBuckets();
            for (const link of links) link.hidden = !shown.includes(link.dataset.sbCustomerBucket);
            options.hidden = shown.length <= 1;
            nav.hidden = !overview && shown.length <= 1;
            if (reviewing()) return;
            const next = selected === '#overview' || shown.includes(selected) ? selected :
                shown.includes(selectedHash()) ? selectedHash() :
                selectedHash() === '#overview' ? '#overview' : shown[0] ?? null;
            if (show(next) && window.location.hash && window.location.hash !== selectedUrl()) {
                window.history.replaceState(window.history.state, '', selectedUrl());
            }
        }
        if (enhance) {
            root.dataset.sbCustomerEnhanced = 'true';
            nav.tabIndex = -1;
            title.tabIndex = -1;
            root.addEventListener('click', event => {
                const link = event.target.closest('a[href^="#"]');
                if (!link || !root.contains(link) || event.defaultPrevented ||
                    event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey ||
                    event.altKey) return;
                const hash = link.getAttribute('href');
                const next = hash === '#bucket-total' ? '#overview' :
                    links.find(item => item.getAttribute('href') === hash)?.dataset.sbCustomerBucket;
                if (next === undefined) return;
                event.preventDefault();
                show(next, true);
            });
            function restoreLocation() {
                const target = selectedHash();
                const next = target === '#overview' || shownBuckets().includes(target) ?
                    target : shownBuckets()[0] ?? null;
                if (show(next) && window.location.hash && window.location.hash !== selectedUrl()) {
                    window.history.replaceState(window.history.state, '', selectedUrl());
                }
            }
            window.addEventListener('popstate', restoreLocation);
            window.addEventListener('hashchange', restoreLocation);
            document.addEventListener('sb:dialog-closed', event => {
                if (event.target.id === 'reviewActionModal') {
                    notice.hidden = true;
                    synchronize();
                }
            });
        }
        const api = Object.freeze({show, synchronize, get selected() { return selected; }});
        controllers.set(root, api);
        RevenueBucketFilter.init({containerId: 'bucketFilterContainer', onFilterChange: synchronize});
        return api;
    }
    window.SBCustomerRevenue = Object.freeze({create});
    const root = document.querySelector('[data-sb-revenue-page="customer"]');
    if (root) create(root);
})();
