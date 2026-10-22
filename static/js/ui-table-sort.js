/** Opt-in, identity-preserving table sorting with per-history-entry state. */
(() => {
    'use strict';
    const instances = new WeakMap();
    const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
    const selector = 'table[data-sb-sortable]';
    const directions = new Set(['ascending', 'descending']);
    const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const formatted = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
    const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

    function fail(table, error) {
        console.error('SBTableSort:', error);
        if (table?.matches?.(selector)) {
            let notice = table.previousElementSibling;
            if (!notice?.classList.contains('sb-table-sort-notice')) {
                notice = document.createElement('div');
                notice.className = 'sb-table-sort-notice';
                table.before(notice);
            }
            notice.setAttribute('role', 'alert');
            notice.textContent = `Table sorting unavailable: ${error.message}`;
        }
        throw error;
    }

    function objectState(value, label) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`${label} must be an object.`);
        }
        return value;
    }

    function savedState(key, fallback) {
        const entry = window.history.state;
        if (entry == null) return fallback;
        objectState(entry, 'History state');
        if (!owns(entry, 'sbTableSort')) return fallback;
        const saved = objectState(entry.sbTableSort, 'History table sort state');
        return owns(saved, key) ? saved[key] : fallback;
    }

    function persist(key, state) {
        const entry = window.history.state ?? {};
        objectState(entry, 'History state');
        const saved = owns(entry, 'sbTableSort') ?
            objectState(entry.sbTableSort, 'History table sort state') : {};
        window.history.replaceState({
            ...entry, sbTableSort: {...saved, [key]: state},
        }, '');
    }

    function scrollOffsets(table) {
        const offsets = [];
        for (let ancestor = table.parentElement; ancestor; ancestor = ancestor.parentElement) {
            if (ancestor.scrollHeight > ancestor.clientHeight ||
                ancestor.scrollWidth > ancestor.clientWidth ||
                ancestor.scrollTop !== 0 || ancestor.scrollLeft !== 0) {
                offsets.push({
                    element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft,
                });
            }
        }
        return offsets;
    }

    function value(cell, type) {
        if (!cell) throw new Error('A sortable row is missing a column.');
        const raw = cell.getAttribute('data-sb-sort-value');
        if (type === 'date' && raw === null) {
            throw new Error('Date columns require raw ISO data-sb-sort-value values.');
        }
        const text = (raw === null ? cell.textContent : raw).trim();
        if (text === '' || text === '-') return null;
        if (type === 'text') return text;
        if (type === 'date') {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                throw new Error(`Invalid ISO calendar date: "${text}".`);
            }
            const [year, month, day] = text.split('-').map(Number);
            const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
            const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
                throw new Error(`Invalid ISO calendar date: "${text}".`);
            }
            return text;
        }
        let normalized = text;
        if (raw === null) {
            let negative = false;
            if (normalized.startsWith('(') && normalized.endsWith(')')) {
                negative = true;
                normalized = normalized.slice(1, -1);
            }
            normalized = normalized.replace(/^\$/, '').replace(/%$/, '');
            if (negative && /^[+-]/.test(normalized)) {
                throw new Error(`Invalid formatted number: "${text}".`);
            }
            if (!formatted.test(normalized)) {
                throw new Error(`Invalid formatted number: "${text}".`);
            }
            normalized = (negative ? '-' : '') + normalized.replace(/,/g, '');
        }
        if (!numeric.test(normalized) || !Number.isFinite(Number(normalized))) {
            throw new Error(`Invalid finite numeric value: "${text}".`);
        }
        return Number(normalized);
    }

    function create(table) {
        if (instances.has(table)) return instances.get(table);
        try {
            if (!table?.matches?.(selector)) throw new Error('An opt-in table is required.');
            const key = table.getAttribute('data-sb-sort-key');
            const server = table.hasAttribute('data-sb-sort-server');
            if (!key || !key.trim() || key !== key.trim()) {
                throw new Error('A stable, nonempty data-sb-sort-key is required.');
            }
            for (const other of document.querySelectorAll(selector)) {
                if (other !== table && other.getAttribute('data-sb-sort-key') === key) {
                    throw new Error(`Duplicate table sort key: "${key}".`);
                }
            }
            const columns = [...table.querySelectorAll('thead th[data-sb-sort-type]')]
                .filter(header => header.closest('table') === table)
                .map(header => ({
                    header, index: header.cellIndex,
                    type: header.getAttribute('data-sb-sort-type'),
                    label: header.textContent.trim().replace(/\s+/g, ' '),
                }));
            if (!columns.length || !table.tBodies.length) {
                throw new Error('Sortable tables require marked headers and a tbody.');
            }
            const indexes = new Set();
            for (const column of columns) {
                if (!['text', 'number', 'date'].includes(column.type) || !column.label ||
                    column.header.colSpan !== 1 || column.header.rowSpan !== 1 ||
                    indexes.has(column.index) || column.header.querySelector('button, a, input')) {
                    throw new Error('Sortable headers require unique, labeled, unspanned columns ' +
                        'with a valid type and no existing interactive controls.');
                }
                indexes.add(column.index);
            }
            // Grouped readers keep each tbody's summary and expanded content together.
            const grouped = table.hasAttribute('data-sb-sort-groups');
            const items = container => grouped ? container.tBodies : container.rows;
            const bodies = grouped ? [{body: table, original: [...items(table)]}] :
                [...table.tBodies].map(body => ({body, original: [...items(body)]}));
            let state = null;
            const defaultColumn = table.getAttribute('data-sb-sort-default-column');
            const defaultDirection = table.getAttribute('data-sb-sort-default-direction');
            if (defaultDirection !== null && defaultColumn === null) {
                throw new Error('A default direction requires a default column.');
            }
            const defaultState = defaultColumn === null ? null : {
                column: /^\d+$/.test(defaultColumn) ? Number(defaultColumn) : NaN,
                direction: defaultDirection ?? 'ascending',
            };

            function validateState(next) {
                if (next === null) return null;
                objectState(next, 'Table sort state');
                if (!Number.isInteger(next.column) || !indexes.has(next.column) ||
                    !directions.has(next.direction)) {
                    throw new Error('Invalid table sort column or direction.');
                }
                return {column: next.column, direction: next.direction};
            }

            function plan(next) {
                return bodies.map(({body, original}) => {
                    const current = [...items(body)];
                    if (current.length !== original.length ||
                        current.some(row => !original.includes(row))) {
                        throw new Error('Table rows changed after mounting; mount a new table.');
                    }
                    const movable = original.filter(row => !row.hasAttribute('data-sb-sort-fixed'));
                    const values = new Map(movable.map(row => [row, new Map(columns.map(column =>
                        [column.index, value(
                            (grouped ? row.rows[0] : row)?.cells[column.index], column.type,
                        )]))]));
                    if (next) {
                        const column = columns.find(column => column.index === next.column);
                        const type = column.type;
                        const emptyFirst = column.header.hasAttribute('data-sb-sort-empty-first');
                        const ordinals = new Map(original.map((row, index) => [row, index]));
                        movable.sort((left, right) => {
                            const a = values.get(left).get(next.column);
                            const b = values.get(right).get(next.column);
                            if (a === null || b === null) {
                                return a === b ? ordinals.get(left) - ordinals.get(right) :
                                    (a === null ? 1 : -1) * (emptyFirst ? -1 : 1);
                            }
                            const delta = type === 'text' ? collator.compare(a, b) :
                                type === 'date' ? (a > b ? 1 : a < b ? -1 : 0) : a - b;
                            return delta ? (next.direction === 'ascending' ? delta : -delta) :
                                ordinals.get(left) - ordinals.get(right);
                        });
                    }
                    let index = 0;
                    return {body, rows: original.map(row =>
                        row.hasAttribute('data-sb-sort-fixed') ? row : movable[index++])};
                });
            }

            function updateHeaders() {
                for (const column of columns) {
                    const active = state?.column === column.index;
                    const next = active && state.direction === 'ascending' ?
                        'descending' : 'ascending';
                    column.header.setAttribute('aria-sort', active ? state.direction : 'none');
                    column.button.setAttribute('aria-label', `${column.label}: sort ${next}`);
                    column.icon.className = active ?
                        (state.direction === 'ascending' ? 'bi bi-sort-up' : 'bi bi-sort-down') :
                        'bi bi-chevron-expand';
                }
            }

            function apply(next, save = false) {
                try {
                    next = validateState(next);
                    const changes = (server ? [] : plan(next)).filter(({body, rows}) =>
                        rows.some((row, index) => row !== items(body)[index]));
                    if (save) persist(key, next);
                    const focused = document.activeElement;
                    const keepFocus = focused && table.contains(focused);
                    const offsets = changes.length ? scrollOffsets(table) : [];
                    try {
                        for (const {body, rows} of changes) {
                            rows.forEach((row, index) => {
                                const before = items(body)[index];
                                if (row === before) return;
                                if (body.moveBefore) body.moveBefore(row, before ?? null);
                                else body.insertBefore(row, before ?? null);
                            });
                        }
                        if (keepFocus && document.activeElement !== focused) {
                            focused.focus({preventScroll: true});
                        }
                        state = next;
                        updateHeaders();
                        const notice = table.previousElementSibling;
                        if (notice?.classList.contains('sb-table-sort-notice')) notice.remove();
                    } finally {
                        // Read after layout, then explicitly cancel anchoring's pending adjustment.
                        for (const {element, top, left} of offsets) {
                            void element.scrollTop;
                            element.scrollTop = top;
                            element.scrollLeft = left;
                        }
                    }
                } catch (error) {
                    fail(table, error);
                }
            }

            validateState(defaultState);
            const initial = validateState(server ? defaultState : savedState(key, defaultState));
            plan(initial);
            for (const column of columns) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'sb-table-sort-button';
                button.setAttribute('data-sb-table-sort', '');
                while (column.header.firstChild) button.appendChild(column.header.firstChild);
                const icon = document.createElement('i');
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);
                column.header.appendChild(button);
                column.button = button;
                column.icon = icon;
                button.addEventListener('click', () => {
                    const next = {
                        column: column.index,
                        direction: state?.column === column.index && state.direction === 'ascending' ?
                            'descending' : 'ascending',
                    };
                    if (server) {
                        table.dispatchEvent(new CustomEvent('sb:table-sort', {detail: next}));
                    } else {
                        apply(next, true);
                    }
                });
            }
            const api = {
                get state() { return state ? {...state} : null; },
                restore(next) { apply(next); },
            };
            apply(initial);
            instances.set(table, {api, restoreHistory: () =>
                apply(server ? defaultState : savedState(key, defaultState))});
            return api;
        } catch (error) {
            fail(table, error);
        }
    }

    function mount(root = document) {
        const tables = [...root.querySelectorAll(selector)];
        if (root.matches?.(selector)) tables.unshift(root);
        return tables.map(table => instances.get(table)?.api ?? create(table));
    }

    window.SBTableSort = {create: table => instances.get(table)?.api ?? create(table), mount};
    mount();
    for (const event of ['pageshow', 'popstate']) {
        window.addEventListener(event, () => window.setTimeout(() => {
            for (const table of document.querySelectorAll(selector)) {
                if (!table.isConnected) continue;
                const instance = instances.get(table);
                if (!instance) continue;
                try {
                    instance.restoreHistory();
                } catch (error) {
                    // State-reading failures also need the same visible, explicit feedback.
                    fail(table, error);
                }
            }
        }, 0));
    }
})();
