/* Native disclosure lifecycle for administration and fiscal management. */
(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const root = document.querySelector('.sb-administration');
        if (!root) return;
        const state = history.state?.sbAdminDisclosure || {};
        for (const trigger of root.querySelectorAll('[data-sb-admin-disclosure]')) {
            const id = trigger.dataset.sbAdminDisclosure;
            const panel = document.getElementById(id);
            if (!panel) continue;
            if (!(trigger instanceof HTMLButtonElement)) {
                trigger.setAttribute('role', 'button');
                trigger.tabIndex = 0;
            }
            function sync() {
                const open = panel.classList.contains('show');
                trigger.setAttribute('aria-expanded', String(open));
                trigger.classList.toggle('is-collapsed', !open);
            }
            if (typeof state[id] === 'boolean') panel.classList.toggle('show', state[id]);
            sync();
            function toggle(event) {
                if (event.target.closest('button, select, input, a') &&
                    event.target.closest('button, select, input, a') !== trigger) return;
                event.stopPropagation?.();
                event.preventDefault();
                const open = !panel.classList.contains('show');
                panel.classList.toggle('show', open);
                for (const other of root.querySelectorAll(`[data-sb-admin-disclosure="${id}"]`)) {
                    other.setAttribute('aria-expanded', String(open));
                }
                history.replaceState({...history.state, sbAdminDisclosure: {
                    ...history.state?.sbAdminDisclosure, [id]: open,
                }}, '');
                panel.dispatchEvent(new CustomEvent(open ?
                    'sb:disclosure-opened' : 'sb:disclosure-closed'));
                sync();
            }
            trigger.addEventListener('click', toggle);
            trigger.addEventListener('keydown', event => {
                if (!(trigger instanceof HTMLButtonElement) &&
                    ['Enter', ' '].includes(event.key)) toggle(event);
            });
        }
        const inventories = new WeakMap();
        let tableSerial = 0;
        function mountTables() {
            if (!window.SBTableSort) return;
            for (let table of root.querySelectorAll('table.sb-admin-table')) {
                if (!table.tHead || !table.tBodies.length || !table.tBodies[0].rows.length) continue;
                const rows = [...table.tBodies[0].rows];
                const previous = inventories.get(table);
                let focusedColumn = null;
                if (previous && rows.length === previous.rows.length &&
                    rows.every(row => previous.rows.includes(row))) continue;
                if (previous) {
                    // Data refresh replaces only the table shell. Keep actual row/action nodes,
                    // while giving SBTableSort a fresh inventory and its stable history key.
                    const focused = document.activeElement;
                    focusedColumn = focused && table.tHead.contains(focused) ?
                        focused.closest('th')?.cellIndex : null;
                    const next = table.cloneNode(false);
                    const head = previous.head.cloneNode(true);
                    for (const [index, header] of [...table.tHead.rows[0].cells].entries()) {
                        if (!header.dataset.sbSortType) {
                            head.rows[0].replaceChild(header, head.rows[0].cells[index]);
                        }
                    }
                    next.append(head);
                    for (const body of [...table.tBodies]) next.append(body);
                    table.replaceWith(next);
                    table = next;
                    if (focused?.isConnected) focused.focus({preventScroll: true});
                }
                table.dataset.sbSortKey ||= table.tBodies[0].id ||
                    `administration-${location.pathname}-${++tableSerial}`;
                const headers = [...table.tHead.rows[0].cells];
                for (const header of headers) {
                    const label = header.textContent.trim();
                    if (!label || /^(actions?|details|error)$/i.test(label) ||
                        header.querySelector('button, input, a') || header.colSpan !== 1) continue;
                    const numericLabel = /count|notes|customers|events|share|errors|trend|duration|tokens|status|size/i.test(label);
                    const values = rows.filter(row => row.cells.length === headers.length)
                        .map(row => row.cells[header.cellIndex].textContent.trim())
                        .filter(value => value && value !== '-');
                    const numeric = numericLabel && values.every(value =>
                        Number.isFinite(Number(value.replace(/[$,%]/g, ''))));
                    const temporal = /^(time|created|timestamp)$/i.test(label);
                    if (!header.dataset.sbSortType) {
                        header.dataset.sbSortType = numeric || temporal ? 'number' : 'text';
                    }
                    for (const row of rows) {
                        if (row.cells.length !== headers.length || row.querySelector('[colspan]')) {
                            row.setAttribute('data-sb-sort-fixed', '');
                            continue;
                        }
                        const cell = row.cells[header.cellIndex];
                        if (cell.hasAttribute('data-sb-sort-value')) continue;
                        const raw = cell.querySelector('[data-utc]')?.dataset.utc ||
                            cell.textContent.trim();
                        if (temporal) {
                            const timestamp = Date.parse(raw);
                            cell.dataset.sbSortValue = Number.isFinite(timestamp) ? String(timestamp) : '';
                        } else if (numeric) {
                            const value = raw.replace(/[$,%]/g, '');
                            cell.dataset.sbSortValue = value && Number.isFinite(Number(value)) ? value : '';
                        }
                    }
                }
                if (!headers.some(header => header.dataset.sbSortType)) continue;
                const head = table.tHead.cloneNode(true);
                table.setAttribute('data-sb-sortable', '');
                inventories.set(table, {rows, head});
                SBTableSort.create(table);
                if (focusedColumn != null) {
                    table.tHead.rows[0].cells[focusedColumn]?.querySelector('button')
                        ?.focus({preventScroll: true});
                }
            }
        }
        mountTables();
        new MutationObserver(() => {
            mountTables();
            restoreDeferredSelects();
        }).observe(root, {childList: true, subtree: true});
        const fields = [...root.querySelectorAll(
            '#exportName, #startDate, #endDate, #telemetryDays, [id^="evt"]')].filter(field =>
            field.matches('input, select'));
        const drafts = history.state?.sbAdminFields || {};
        const deferredSelects = new Map();
        function restoreDeferredSelects() {
            for (const [field, value] of deferredSelects) {
                if ([...field.options].some(option => option.value === value)) {
                    field.value = value;
                    deferredSelects.delete(field);
                }
            }
        }
        function rememberFields() {
            history.replaceState({...history.state, sbAdminFields:
                Object.fromEntries(fields.map(field => [field.id,
                    field.type === 'checkbox' ? field.checked :
                        deferredSelects.get(field) ?? field.value]))}, '');
        }
        for (const field of fields) {
            if (Object.hasOwn(drafts, field.id)) {
                if (field.type === 'checkbox') field.checked = drafts[field.id] === true;
                else {
                    field.value = drafts[field.id];
                    if (field.tagName === 'SELECT' && drafts[field.id] &&
                        field.value !== drafts[field.id]) {
                        // Event categories arrive asynchronously after the history draft.
                        deferredSelects.set(field, drafts[field.id]);
                    }
                }
            }
            for (const event of ['input', 'change']) {
                field.addEventListener(event, () => {
                    deferredSelects.delete(field);
                    rememberFields();
                });
            }
        }
        if (root.classList.contains('sb-admin-connect-export') &&
            Number.isInteger(history.state?.sbConnectExport) && window.viewExport) {
            window.viewExport(history.state.sbConnectExport);
        }
        if (root.classList.contains('sb-admin-admin-panel') &&
            Number.isInteger(history.state?.sbAdminEventPage) && window.loadEventLog) {
            window.loadEventLog(history.state.sbAdminEventPage, history.state.sbAdminEventQuery);
        }
    });
})();
