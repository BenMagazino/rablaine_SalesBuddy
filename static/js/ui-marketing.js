(function (global) {
    'use strict';

    function matches(name, query) {
        return name.toLowerCase().includes(query.toLowerCase());
    }

    function validateView(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)
            || typeof value.query !== 'string'
            || (value.selected !== null && (typeof value.selected !== 'string'
                || !/^[1-9]\d*$/.test(value.selected)))
            || !Number.isFinite(value.listScroll) || value.listScroll < 0
            || !Number.isFinite(value.detailScroll) || value.detailScroll < 0) {
            throw new Error('Invalid saved marketing view.');
        }
        return value;
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = {matches, validateView};
    if (!global.document) return;
    function init() {
        const root = document.querySelector('[data-sb-marketing]');
        const search = root?.querySelector('#customerFilter');
        if (!search) return;
        const embedded = root.dataset.embedded === 'true';
        const rows = Array.from(root.querySelectorAll('#summaryTable tbody tr'));
        const details = Array.from(root.querySelectorAll('[data-marketing-customer]'));
        const listReading = root.querySelector('.sb-marketing-list-reading');
        const detailReading = root.querySelector('.sb-marketing-detail-reading');
        const notice = root.querySelector('.sb-marketing-notice');
        const status = document.querySelector('[data-marketing-status]');
        let selected = null;
        global.SBTableSort.create(root.querySelector('#summaryTable'));

        function reportError(error) {
            console.error('Marketing view:', error);
            notice.textContent = 'Could not preserve the marketing view for Back navigation.';
            notice.hidden = false;
        }

        function visibleRows() {
            return Array.from(root.querySelectorAll('#summaryTable tbody tr'))
                .filter(row => row.style.display !== 'none');
        }

        function select(id, resetScroll = true) {
            const row = visibleRows().find(candidate => candidate.dataset.customerId === id);
            selected = row ? id : null;
            rows.forEach(candidate => {
                const active = candidate.dataset.customerId === selected;
                candidate.dataset.selected = String(active);
                candidate.querySelector('[data-customer-select]').setAttribute('aria-pressed',
                    String(active));
            });
            details.forEach(detail => {
                detail.hidden = detail.dataset.marketingCustomer !== selected;
                if (!detail.hidden) {
                    detail.querySelectorAll('[data-marketing-table]').forEach(table => {
                        table.dataset.sbSortable = '';
                    });
                    global.SBTableSort.mount(detail);
                }
            });
            root.querySelector('[data-marketing-no-selection]').hidden = selected !== null;
            if (resetScroll) detailReading.scrollTop = 0;
            const name = row?.cells[0].dataset.exportLabel;
            if (status) status.textContent = visibleRows().length + ' of ' + rows.length
                + ' customers' + (name ? ' | ' + name : '');
        }

        function filter() {
            rows.forEach(row => {
                row.style.display = matches(row.dataset.customerName, search.value) ? '' : 'none';
            });
            const visible = visibleRows();
            root.querySelector('#summaryTable').dataset.exportVisible = String(visible.length > 0);
            root.querySelector('[data-marketing-count]').textContent = visible.length + ' shown';
            root.querySelector('[data-marketing-empty]').hidden = visible.length > 0;
            const next = visible.some(row => row.dataset.customerId === selected)
                ? selected : visible[0]?.dataset.customerId;
            select(next || null, next !== selected);
        }

        function save() {
            if (embedded) return;
            try {
                history.replaceState({...history.state, sbMarketing: {
                    query: search.value, selected, listScroll: listReading.scrollTop,
                    detailScroll: detailReading.scrollTop,
                }}, '');
            } catch (error) {
                reportError(error);
            }
        }

        search.addEventListener('input', filter);
        root.querySelector('#summaryTable tbody').addEventListener('click', event => {
            const row = event.target.closest('tr[data-customer-id]');
            if (row) select(row.dataset.customerId);
        });
        global.addEventListener('pagehide', save);
        document.addEventListener('click', event => {
            if (event.target.closest('a[href]')) save();
        }, true);
        let saved = null;
        try {
            if (!embedded && history.state?.sbMarketing) saved = validateView(history.state.sbMarketing);
        } catch (error) {
            reportError(error);
        }
        if (saved) { search.value = saved.query; selected = saved.selected; }
        filter();
        if (saved) {
            listReading.scrollTop = saved.listScroll;
            detailReading.scrollTop = saved.detailScroll;
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, {once: true});
    } else {
        init();
    }
})(typeof window === 'undefined' ? globalThis : window);
