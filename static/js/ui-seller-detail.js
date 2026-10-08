/** Seller workstream selection, owned scroll history and native preview launchers. */
((window) => {
    'use strict';
    function validateHistory(value, id) {
        const panels = ['sdMilestones', 'sdRevenue', 'sdEngagements'];
        const regions = ['customers', 'milestones', 'revenue', 'engagements'];
        if (!value || value.id !== id || !panels.includes(value.tab)
            || !value.scrolls || typeof value.scrolls !== 'object'
            || Array.isArray(value.scrolls)
            || Object.entries(value.scrolls).some(([key, offset]) =>
                !regions.includes(key) || !Number.isFinite(offset) || offset < 0)) {
            throw new Error('Invalid seller reading history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateHistory};
    if (!window.document) return;

    function mount() {
        const root = document.querySelector('[data-sb-seller-detail]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const id = Number(root.dataset.sbSellerDetail);
        const tabs = [...root.querySelectorAll('[role="tab"]')];
        const panels = [...root.querySelectorAll('.sd-panel')];
        const regions = [...root.querySelectorAll('[data-sd-scroll]')];
        function warn(message, error) {
            console.error(message, error);
            const notice = root.querySelector('[data-sd-notice]');
            notice.textContent = message;
            notice.hidden = false;
        }
        let tab = 'sdMilestones', pending = false;
        const offsets = Object.fromEntries(regions.map(node => [node.dataset.sdScroll, 0]));
        function save() {
            regions.forEach(node => {
                if (!node.closest('[hidden]')) offsets[node.dataset.sdScroll] = node.scrollTop;
            });
            try {
                history.replaceState({...history.state, sbSellerDetail: {
                    id, tab, scrolls: {...offsets},
                }}, '');
            } catch (error) { warn('Could not remember seller reading context for Back.', error); }
        }
        function select(next, remember = true) {
            if (!tabs.some(button => button.getAttribute('aria-controls') === next)) return;
            if (remember) save();
            tab = next;
            tabs.forEach(button => {
                const selected = button.getAttribute('aria-controls') === tab;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
            panels.forEach(panel => { panel.hidden = panel.id !== tab; });
            regions.forEach(node => {
                if (!node.closest('[hidden]')) node.scrollTop = offsets[node.dataset.sdScroll];
            });
            if (remember) save();
        }
        function restore() {
            const saved = history.state?.sbSellerDetail;
            if (!saved || saved.id !== id) return;
            try {
                validateHistory(saved, id);
                Object.assign(offsets, saved.scrolls);
                select(saved.tab, false);
            } catch (error) { warn('Could not restore seller reading context.', error); }
        }
        tabs.forEach((button, index) => {
            button.addEventListener('click', () => select(button.getAttribute('aria-controls')));
            button.addEventListener('keydown', event => {
                const positions = {ArrowRight: (index + 1) % tabs.length,
                    ArrowLeft: (index + tabs.length - 1) % tabs.length,
                    Home: 0, End: tabs.length - 1};
                if (!(event.key in positions)) return;
                event.preventDefault();
                const target = tabs[positions[event.key]];
                select(target.getAttribute('aria-controls'));
                target.focus();
            });
        });
        regions.forEach(node => node.addEventListener('scroll', save, {passive: true}));
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', restore);
        restore();

        // Retain the previous customer preference, but only header sorts own new history.
        const table = root.querySelector('#customerTableBody')?.closest('table');
        if (table && !history.state?.sbTableSort?.[table.dataset.sbSortKey]) {
            try {
                if (localStorage.getItem('salesbuddy_seller_customer_sort') === 'name') {
                    SBTableSort.create(table).restore({column: 0, direction: 'ascending'});
                }
            } catch (error) { warn('Could not read the customer sort preference.', error); }
        }
        SBTableSort.mount(root);
        table?.addEventListener('click', event => {
            if (!event.target.closest('[data-sb-table-sort]')) return;
            const state = SBTableSort.create(table).state;
            try {
                localStorage.setItem('salesbuddy_seller_customer_sort',
                    state.column === 0 ? 'name' : 'date');
            } catch (error) { warn('Could not remember the customer sort preference.', error); }
        });
        window._showMsDetail = (id, title, status, url) =>
            SBMilestonePreview.open(id, title, status, url);
        window.openStandaloneMilestoneDetail = (event, id, title, status, url) => {
            if (!event.target.closest('a, button')) return window._showMsDetail(
                id, title, status, url);
        };
        window.openMilestoneDetail = window.openStandaloneMilestoneDetail;
        root.addEventListener('click', event => {
            const milestone = event.target.closest('[data-sd-milestone]');
            if (milestone) window._showMsDetail(Number(milestone.dataset.sdMilestone),
                milestone.dataset.title, milestone.dataset.status, milestone.dataset.url);
            const alert = event.target.closest('[data-sd-alert]');
            if (alert) SBRevenueAlertPreview.open(Number(alert.dataset.sdAlert),
                alert.dataset.customer, alert.dataset.bucket);
        });
        if (root.querySelector('#sellerBucketFilterContainer')) {
            const update = () => {
                const count = root.querySelector('#revenueSummaryCount');
                if (count) count.textContent = [...root.querySelectorAll(
                    '#alertsTable tbody tr[data-bucket]')].filter(
                    row => row.style.display !== 'none').length;
            };
            RevenueBucketFilter.init({
                containerId: 'sellerBucketFilterContainer', onFilterChange: update,
            });
            root.querySelector('#revenueModal').addEventListener('sb:dialog-opened', event => {
                if (event.target.id !== 'revenueModal') return;
                if (!root.querySelector('#modalBucketFilterContainer .sb-bucket-button')) {
                    RevenueBucketFilter.init({
                        containerId: 'modalBucketFilterContainer', onFilterChange: update,
                    });
                }
            });
        }
        const form = root.querySelector('#sellerDeleteDialog form');
        if (form) {
            form.addEventListener('submit', event => {
                if (pending) { event.preventDefault(); return; }
                pending = true;
                form.querySelector('[type="submit"]').disabled = true;
                form.querySelector('[data-sd-delete-status]').textContent = 'Deleting seller...';
            });
            form.closest('dialog').addEventListener('sb:dialog-before-close', event => {
                if (pending) event.preventDefault();
            });
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})(typeof window === 'undefined' ? {} : window);
