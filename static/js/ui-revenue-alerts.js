/** Guarded row opening for shared Revenue alert tables; SBTableSort owns column ordering. */
(() => {
    'use strict';
    for (const root of document.querySelectorAll('[data-sb-revenue-alerts]')) {
        const table = root.querySelector('#alertsTable');
        if (!table) continue;
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
    }
})();
