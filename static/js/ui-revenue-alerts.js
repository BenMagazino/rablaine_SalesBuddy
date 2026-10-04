/** Sorting and guarded row opening for shared Revenue alert tables. */
(() => {
    'use strict';
    for (const root of document.querySelectorAll('[data-sb-revenue-alerts]')) {
        const table = root.querySelector('#alertsTable');
        if (!table) continue;
        const headers = [...table.querySelectorAll('thead th')];
        let column = 0, ascending = true;
        function sort(index) {
            ascending = column === index ? !ascending : true;
            column = index;
            const kind = headers[index].dataset.sortType;
            const text = row => row.cells[index].textContent.trim();
            const number = value => parseFloat(kind === 'currency' ?
                value.replace(/[^\d.\-]/g, '') : value) || 0;
            const rows = [...table.tBodies[0].rows];
            rows.sort((a, b) => {
                const left = text(a), right = text(b);
                const delta = kind === 'text' ?
                    left.localeCompare(right, undefined, {sensitivity: 'base'}) :
                    number(left) - number(right);
                return ascending ? delta : -delta;
            });
            for (const row of rows) table.tBodies[0].appendChild(row);
            headers.forEach((header, i) => {
                const button = header.querySelector('[data-sb-alert-sort]');
                if (!button) return;
                header.setAttribute('aria-sort', i === index ?
                    (ascending ? 'ascending' : 'descending') : 'none');
                button.querySelector('i').className = i === index ?
                    (ascending ? 'bi bi-sort-up' : 'bi bi-sort-down') : 'bi bi-chevron-expand';
            });
        }
        headers.forEach((header, index) => {
            header.querySelector('[data-sb-alert-sort]')?.addEventListener('click', () => sort(index));
        });
        table.addEventListener('click', event => {
            if (!(event.target instanceof Element)) return;
            const row = event.target.closest('tr[data-analysis-id]');
            if (!row || !table.contains(row) || row.dataset.alertClickable !== 'true') return;
            if (event.target.closest('a, button') &&
                !event.target.closest('[data-sb-revenue-open]')) return;
            row.querySelector('[data-sb-revenue-open]').focus({preventScroll: true});
            SBRevenueAlertPreview.open(row.dataset.analysisId, row.dataset.customerName,
                row.dataset.bucket);
        });
        sort(0);
    }
})();
