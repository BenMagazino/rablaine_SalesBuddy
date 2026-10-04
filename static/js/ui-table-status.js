/** View-local counts reflect rendered table rows, without changing filters or totals. */
(() => {
    'use strict';
    for (const status of document.querySelectorAll('[data-sb-table-status]')) {
        const table = document.getElementById(status.dataset.sbTableStatus);
        if (!(table instanceof HTMLTableElement)) {
            status.textContent = 'View count unavailable';
            status.setAttribute('role', 'alert');
            throw new Error('Workbench status requires a real table: ' + status.dataset.sbTableStatus);
        }
        const unit = status.dataset.sbTableUnit || 'rows';
        function update() {
            const rows = [...table.tBodies].flatMap(body => [...body.rows]);
            const shown = rows.filter(row =>
                !row.hidden && getComputedStyle(row).display !== 'none').length;
            const text = `${shown} of ${rows.length} ${unit} shown`;
            if (status.textContent !== text) status.textContent = text;
        }
        const observer = new MutationObserver(update);
        observer.observe(table, {
            subtree: true, childList: true, attributes: true,
            attributeFilter: ['style', 'hidden', 'class'],
        });
        update();
    }
})();
