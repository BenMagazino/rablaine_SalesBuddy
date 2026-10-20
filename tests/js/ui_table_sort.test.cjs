const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-table-sort.js'), 'utf8');

/** Small DOM harness modeling node moves, attributes, focus, and history entries. */
function fixture(specs = [{}], historyState = null) {
    const events = {}, timers = [], errors = [], writes = [];
    let document;
    class Node {
        constructor(tag = '', text = '') {
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.parentNode = null;
            this.attributes = {};
            this.handlers = {};
            this.style = {};
            this.hidden = false;
            this.text = text;
            this.className = '';
            this.colSpan = 1;
            this.rowSpan = 1;
            this.scrollTop = 0;
            this.scrollLeft = 0;
            this.scrollHeight = 0;
            this.scrollWidth = 0;
            this.clientHeight = 0;
            this.clientWidth = 0;
        }
        get firstChild() { return this.children[0] ?? null; }
        get parentElement() {
            return this.parentNode?.tagName === 'DOCUMENT' ? null : this.parentNode;
        }
        get isConnected() { return document.contains(this); }
        get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
        set textContent(text) { this.text = text; this.children = []; }
        get rows() { return this.children.filter(n => n.tagName === 'TR'); }
        get cells() { return this.children.filter(n => ['TD', 'TH'].includes(n.tagName)); }
        get cellIndex() { return this.parentNode.cells.indexOf(this); }
        get tBodies() { return this.children.filter(n => n.tagName === 'TBODY'); }
        get previousElementSibling() {
            if (!this.parentNode) return null;
            const siblings = this.parentNode.children;
            return siblings[siblings.indexOf(this) - 1] ?? null;
        }
        get classList() {
            return {contains: name => this.className.split(/\s+/).includes(name)};
        }
        setAttribute(key, value) { this.attributes[key] = String(value); }
        getAttribute(key) { return this.attributes[key] ?? null; }
        hasAttribute(key) { return key in this.attributes; }
        removeAttribute(key) { delete this.attributes[key]; }
        appendChild(node) { return this.insertBefore(node, null); }
        insertBefore(node, before) {
            if (node.parentNode) {
                this.moves = (this.moves ?? 0) + 1;
                this.onMove?.(node);
                if (document && node.contains(document.activeElement)) document.activeElement = null;
                node.remove();
            }
            const index = before === null ? this.children.length : this.children.indexOf(before);
            assert.notEqual(index, -1);
            this.children.splice(index, 0, node);
            node.parentNode = this;
            return node;
        }
        remove() {
            if (this.parentNode) {
                const siblings = this.parentNode.children;
                siblings.splice(siblings.indexOf(this), 1);
                this.parentNode = null;
            }
        }
        before(node) { this.parentNode.insertBefore(node, this); }
        contains(node) {
            return this === node || this.children.some(child => child.contains(node));
        }
        matches(selector) {
            if (selector === 'table[data-sb-sortable]') {
                return this.tagName === 'TABLE' && this.hasAttribute('data-sb-sortable');
            }
            if (selector === 'table') return this.tagName === 'TABLE';
            if (selector === 'thead th[data-sb-sort-type]') {
                return this.tagName === 'TH' && this.hasAttribute('data-sb-sort-type') &&
                    this.parentNode?.parentNode?.tagName === 'THEAD';
            }
            if (selector === 'button, a, input') {
                return ['BUTTON', 'A', 'INPUT'].includes(this.tagName);
            }
            if (selector === '[data-sb-table-sort]') return this.hasAttribute('data-sb-table-sort');
            if (selector === 'i') return this.tagName === 'I';
            throw Error('Unexpected selector: ' + selector);
        }
        closest(selector) {
            return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null;
        }
        querySelectorAll(selector) {
            return this.children.flatMap(n =>
                [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
        addEventListener(name, handler) {
            (this.handlers[name] ??= []).push(handler);
        }
        click() { for (const handler of this.handlers.click ?? []) handler(); }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
    }
    document = new Node('document');
    document.createElement = tag => new Node(tag);
    document.activeElement = null;
    function makeTable(spec = {}) {
        const table = new Node('table');
        table.setAttribute('data-sb-sortable', '');
        if (spec.key !== null) table.setAttribute('data-sb-sort-key', spec.key ?? 'table-1');
        if (spec.column !== undefined) {
            table.setAttribute('data-sb-sort-default-column', spec.column);
        }
        if (spec.direction !== undefined) {
            table.setAttribute('data-sb-sort-default-direction', spec.direction);
        }
        const head = table.appendChild(new Node('thead'));
        const headRow = head.appendChild(new Node('tr'));
        const headers = (spec.types ?? ['number']).map((type, index) => {
            const header = headRow.appendChild(new Node('th'));
            header.appendChild(new Node('span', spec.labels?.[index] ?? `Column ${index}`));
            if (type !== null) header.setAttribute('data-sb-sort-type', type);
            return header;
        });
        const body = table.appendChild(new Node('tbody'));
        const rows = (spec.rows ?? [['2'], ['1'], ['3']]).map((values, index) => {
            const row = body.appendChild(new Node('tr'));
            row.id = `r${index}`;
            values.forEach(input => {
                const cell = row.appendChild(new Node('td'));
                const definition = typeof input === 'object' ? input : {raw: input, text: input};
                cell.appendChild(new Node('span', definition.text ?? 'Display label'));
                if (definition.raw !== undefined) {
                    cell.setAttribute('data-sb-sort-value', definition.raw);
                }
            });
            if (spec.fixed?.includes(index)) row.setAttribute('data-sb-sort-fixed', '');
            return row;
        });
        return {
            table, headers, body, rows,
            button: index => headers[index].querySelector('[data-sb-table-sort]'),
            order: () => body.rows.map(row => row.id),
        };
    }
    const tables = specs.map(spec => {
        const h = makeTable(spec); document.appendChild(h.table); return h;
    });
    const history = {
        state: historyState,
        replaceState(state, title, url) {
            writes.push({state, title, url});
            this.state = state;
        },
    };
    const window = {
        history,
        addEventListener: (type, handler) => { events[type] = handler; },
        setTimeout: handler => { timers.push(handler); },
    };
    return {
        ...tables[0], tables, document, window, history, errors, writes, Node, makeTable,
        run() {
            vm.runInNewContext(source, {window, document, console: {error: (...args) => {
                errors.push(args);
            }}});
            return window.SBTableSort;
        },
        dispatch(type) { events[type](); },
        flush() { while (timers.length) timers.shift()(); },
    };
}

test('opt-in mounting preserves source order and original header content nodes', () => {
    const h = fixture(), original = h.headers[0].firstChild;
    const text = h.headers[0].textContent, api = h.run().create(h.table);
    assert.equal(api.state, null);
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
    assert.equal(h.button(0).firstChild, original);
    assert.equal(h.headers[0].textContent, text);
    assert.equal(h.button(0).type, 'button');
    assert.equal(h.button(0).className, 'sb-table-sort-button');
    assert.equal(h.headers[0].getAttribute('aria-sort'), 'none');
    assert.equal(h.button(0).getAttribute('aria-label'), 'Column 0: sort ascending');
    assert.equal(h.button(0).querySelector('i').getAttribute('aria-hidden'), 'true');
    assert.equal(h.button(0).querySelector('i').className, 'bi bi-chevron-expand');
});

test('raw numbers retain fractional, negative, zero and exponent values', () => {
    const h = fixture([{rows: [['0'], ['-0.25'], ['0.02'], ['1e-3'], ['-5'], ['2.5']]}]);
    h.run(); h.button(0).click();
    assert.deepEqual(h.order(), ['r4', 'r1', 'r0', 'r3', 'r2', 'r5']);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r5', 'r2', 'r3', 'r0', 'r1', 'r4']);
});

test('unavailable raw values remain last in both directions, including ties', () => {
    const h = fixture([{rows: [[''], ['-'], ['0'], ['-1'], ['2'], ['  ']]}]);
    h.run(); h.button(0).click();
    assert.deepEqual(h.order(), ['r3', 'r2', 'r4', 'r0', 'r1', 'r5']);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r4', 'r2', 'r3', 'r0', 'r1', 'r5']);
});

test('strict formatted numeric fallback supports dollars, grouping, percent and parentheses', () => {
    const h = fixture([{rows: [
        [{text: '$1,250.50'}], [{text: '($2.50)'}], [{text: '0%'}],
        [{text: '-0.5%'}], [{text: '-'}], [{text: '$-200'}],
    ]}]);
    h.run(); h.button(0).click();
    assert.deepEqual(h.order(), ['r5', 'r1', 'r3', 'r2', 'r0', 'r4']);
});

test('fiscal labels sort by validated calendar dates across fiscal year boundaries', () => {
    const h = fixture([{types: ['date'], rows: [
        [{raw: '2027-07-01', text: 'FY28 Q1'}],
        [{raw: '2026-10-01', text: 'FY27 Q2'}],
        [{raw: '2027-04-01', text: 'FY27 Q4'}],
        [{raw: '-', text: 'Unavailable'}],
        [{raw: '2027-01-01', text: 'FY27 Q3'}],
    ]}]);
    h.run(); h.button(0).click();
    assert.deepEqual(h.order(), ['r1', 'r4', 'r2', 'r0', 'r3']);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r0', 'r2', 'r4', 'r1', 'r3']);
});

test('text fallback is case-insensitive and natural numeric-aware with stable ties', () => {
    const h = fixture([{types: ['text'], rows: [
        [{text: 'Account 10'}], [{text: 'account 2'}], [{text: 'ACCOUNT 2'}],
        [{text: 'Account 1'}], [{text: ''}],
    ]}]);
    h.run(); h.button(0).click();
    assert.deepEqual(h.order(), ['r3', 'r1', 'r2', 'r0', 'r4']);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2', 'r3', 'r4']);
});

test('fixed summaries stay at first, middle, and last original slots without validating totals', () => {
    const h = fixture([{rows: [
        ['Total'], ['3'], ['1'], ['Summary'], ['2'], ['Grand total'],
    ], fixed: [0, 3, 5]}]);
    const api = h.run().create(h.table);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r0', 'r2', 'r4', 'r3', 'r1', 'r5']);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r0', 'r1', 'r4', 'r3', 'r2', 'r5']);
    api.restore(null);
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
    assert.equal(api.state, null);
});

test('equal numeric keys keep original ordinals after direction changes', () => {
    const h = fixture([{rows: [['2'], ['1'], ['2.0'], ['1.00'], ['2']]}]);
    h.run(); h.button(0).click(); h.button(0).click();
    assert.deepEqual(h.order(), ['r0', 'r2', 'r4', 'r1', 'r3']);
    h.button(0).click();
    assert.deepEqual(h.order(), ['r1', 'r3', 'r0', 'r2', 'r4']);
});

test('sorting preserves row/link identities, filters, focus, selection and control state', () => {
    const h = fixture(), link = h.rows[0].cells[0].appendChild(new h.Node('a', 'Open'));
    const input = h.rows[1].cells[0].appendChild(new h.Node('input'));
    input.value = 'draft'; input.checked = true; input.selectionStart = 2;
    h.rows[0].hidden = true; h.rows[1].style.display = 'none';
    h.rows[1].setAttribute('aria-selected', 'true');
    h.run(); input.focus(); h.button(0).click();
    assert.equal(h.body.rows[0], h.rows[1]);
    assert.equal(h.rows[0].cells[0].children[1], link);
    assert.equal(h.rows[0].hidden, true);
    assert.equal(h.rows[1].style.display, 'none');
    assert.equal(h.rows[1].getAttribute('aria-selected'), 'true');
    assert.equal(h.document.activeElement, input);
    assert.equal(input.focusOptions.preventScroll, true);
    assert.equal(input.value, 'draft');
    assert.equal(input.checked, true);
    assert.equal(input.selectionStart, 2);
});

test('defaults, toggles and switching columns expose current sort and next accessible action', () => {
    const h = fixture([{types: ['text', null, 'number'], column: '2', direction: 'descending',
        rows: [['B', 'ignore', '1'], ['A', 'ignore', '3'], ['C', 'ignore', '2']]}]);
    const api = h.run().create(h.table);
    assert.deepEqual(h.order(), ['r1', 'r2', 'r0']);
    assert.equal(api.state.column, 2);
    assert.equal(api.state.direction, 'descending');
    assert.equal(h.button(1), null);
    assert.equal(h.headers[2].getAttribute('aria-sort'), 'descending');
    assert.equal(h.button(2).getAttribute('aria-label'), 'Column 2: sort ascending');
    h.button(2).click();
    assert.equal(api.state.direction, 'ascending');
    assert.equal(h.button(2).getAttribute('aria-label'), 'Column 2: sort descending');
    assert.equal(h.button(2).querySelector('i').className, 'bi bi-sort-up');
    h.button(0).click();
    assert.equal(api.state.column, 0);
    assert.equal(api.state.direction, 'ascending');
    assert.equal(h.headers[2].getAttribute('aria-sort'), 'none');
    h.button(0).click();
    assert.equal(h.button(0).querySelector('i').className, 'bi bi-sort-down');
});

test('default direction is ascending and state getter returns a defensive copy', () => {
    const h = fixture([{column: '0'}]), api = h.run().create(h.table);
    assert.equal(api.state.direction, 'ascending');
    const state = api.state; state.column = 99;
    assert.equal(api.state.column, 0);
});

test('mount and create are idempotent for root tables and descendant fragments', () => {
    const h = fixture(), sorter = h.run(), api = sorter.create(h.table);
    assert.equal(sorter.create(h.table), api);
    assert.equal(sorter.mount(h.table)[0], api);
    assert.equal(sorter.mount()[0], api);
    assert.equal(h.button(0).handlers.click.length, 1);
    assert.equal(h.headers[0].children.length, 1);
    h.button(0).click();
    assert.equal(h.writes.length, 1);
});

test('unmarked tables are untouched and create rejects non-opt-in elements', () => {
    const h = fixture(); h.table.removeAttribute('data-sb-sortable');
    const sorter = h.run();
    assert.equal(sorter.mount().length, 0);
    assert.equal(h.button(0), null);
    assert.throws(() => sorter.create(h.table), /opt-in table/);
    assert.equal(h.errors.length, 1);
});

test('per-table user changes merge history feature state without URL changes', () => {
    const unrelated = {filter: 'active', selection: 42};
    const h = fixture([{key: 'alpha'}, {key: 'beta'}], {
        revenue: unrelated, sbTableSort: {other: {column: 8, direction: 'descending'}},
    });
    const sorter = h.run(), a = sorter.create(h.tables[0].table);
    const b = sorter.create(h.tables[1].table);
    h.tables[0].button(0).click(); h.tables[1].button(0).click();
    h.tables[1].button(0).click();
    assert.equal(a.state.direction, 'ascending');
    assert.equal(b.state.direction, 'descending');
    assert.equal(h.history.state.revenue, unrelated);
    assert.equal(h.history.state.sbTableSort.other.column, 8);
    assert.equal(h.history.state.sbTableSort.alpha.direction, 'ascending');
    assert.equal(h.history.state.sbTableSort.beta.direction, 'descending');
    assert.ok(h.writes.every(write => write.url === undefined));
});

test('saved null overrides defaults and saved sort restores before fragment controllers run', () => {
    const h = fixture([{column: '0', direction: 'descending', key: 'existing'}], {
        sbTableSort: {existing: null, fragment: {column: 0, direction: 'descending'}},
    });
    const sorter = h.run();
    assert.equal(sorter.create(h.table).state, null);
    const fragment = h.makeTable({key: 'fragment'}), root = new h.Node('section');
    root.appendChild(fragment.table);
    sorter.mount(root);
    assert.deepEqual(fragment.order(), ['r2', 'r0', 'r1']);
    assert.equal(h.writes.length, 0);
});

test('deferred Back and BF-cache restore state without persisting or changing unrelated focus', () => {
    const h = fixture([{key: 'back'}]), sorter = h.run();
    h.button(0).click(); h.button(0).click();
    const outside = h.document.appendChild(new h.Node('input')); outside.focus();
    h.rows[1].hidden = true;
    h.history.state = {sbTableSort: {back: {column: 0, direction: 'ascending'}}};
    h.dispatch('popstate');
    assert.deepEqual(h.order(), ['r2', 'r0', 'r1']);
    h.flush();
    assert.deepEqual(h.order(), ['r1', 'r0', 'r2']);
    assert.equal(h.writes.length, 2);
    assert.equal(h.document.activeElement, outside);
    assert.equal(h.rows[1].hidden, true);
    h.history.state = {sbTableSort: {back: null}};
    h.dispatch('pageshow'); h.flush();
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
    assert.equal(sorter.create(h.table).state, null);
});

test('Back to an entry without sort state restores original default order', () => {
    const h = fixture([{column: '0', direction: 'descending'}]);
    h.run(); h.button(0).click();
    h.history.state = null; h.dispatch('popstate'); h.flush();
    assert.deepEqual(h.order(), ['r2', 'r0', 'r1']);
});

test('strict malformed numeric raw and fallback values fail visibly before any reorder', () => {
    for (const raw of ['3oops', 'NaN', 'Infinity', '1e999', '0x10', '$2', '1,000']) {
        const h = fixture([{column: '0', rows: [['3'], ['1'], [raw]]}]);
        assert.throws(() => h.run(), /Invalid finite numeric/);
        assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
        assert.equal(h.table.previousElementSibling.getAttribute('role'), 'alert');
        assert.match(h.table.previousElementSibling.textContent, /sorting unavailable/);
        assert.ok(h.errors.length);
        assert.equal(h.button(0), null);
    }
    for (const text of ['1,00', '$4/mo', '12abc', '(+2)', 'NaN']) {
        const h = fixture([{rows: [[{text}]]}]);
        assert.throws(() => h.run(), /Invalid formatted number/);
    }
});

test('date validation rejects impossible dates, non-ISO labels and missing raw attributes', () => {
    for (const raw of ['2027-02-29', '1900-02-29', '2026-04-31', '2026-13-01',
        '2026-01-00', '0000-01-01', 'FY27 Q1', '2026-1-01', '2026-01-01T00:00:00Z']) {
        const h = fixture([{types: ['date'], rows: [[raw]]}]);
        assert.throws(() => h.run(), /Invalid ISO calendar date/);
    }
    const missing = fixture([{types: ['date'], rows: [[{text: '2026-01-01'}]]}]);
    assert.throws(() => missing.run(), /require raw ISO/);
    const valid = fixture([{types: ['date'], rows: [['2000-02-29'], ['2024-02-29']]}]);
    valid.run(); valid.button(0).click();
    assert.deepEqual(valid.order(), ['r0', 'r1']);
});

test('identity, header, default and persisted state contracts fail explicitly', () => {
    for (const spec of [
        {key: null}, {key: ''}, {key: ' '}, {key: ' padded '},
        {types: ['currency']}, {types: []}, {column: 'x'}, {column: '1'},
        {direction: 'ascending'}, {column: '0', direction: 'desc'},
    ]) {
        const h = fixture([spec]);
        assert.throws(() => h.run());
        assert.equal(h.table.previousElementSibling.getAttribute('role'), 'alert');
        assert.equal(h.writes.length, 0);
    }
    const duplicate = fixture([{key: 'same'}, {key: 'same'}]);
    assert.throws(() => duplicate.run(), /Duplicate table sort key/);
    for (const entry of [
        {sbTableSort: []}, {sbTableSort: null}, {sbTableSort: {key: false}},
        {sbTableSort: {key: {column: 99, direction: 'ascending'}}},
        {sbTableSort: {key: {column: 0, direction: 'up'}}},
    ]) {
        const h = fixture([{key: 'key'}], entry);
        assert.throws(() => h.run());
        assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
    }
});

test('invalid data on an inactive column fails on mount rather than partially sorting', () => {
    const h = fixture([{types: ['number', 'date'], column: '0', rows: [
        ['2', '2026-01-01'], ['1', '2026-02-30'],
    ]}]);
    assert.throws(() => h.run(), /Invalid ISO calendar date/);
    assert.deepEqual(h.order(), ['r0', 'r1']);
});

test('invalid restore or changed values keep previous state/order/history until repaired', () => {
    const h = fixture(), api = h.run().create(h.table);
    h.button(0).click();
    assert.throws(() => api.restore({column: 0, direction: 'bad'}), /Invalid table sort/);
    assert.deepEqual(h.order(), ['r1', 'r0', 'r2']);
    h.rows[2].cells[0].setAttribute('data-sb-sort-value', '3oops');
    assert.throws(() => h.button(0).click(), /Invalid finite numeric/);
    assert.deepEqual(h.order(), ['r1', 'r0', 'r2']);
    assert.equal(api.state.direction, 'ascending');
    assert.equal(h.writes.length, 1);
    h.rows[2].cells[0].setAttribute('data-sb-sort-value', '3');
    h.button(0).click();
    assert.deepEqual(h.order(), ['r2', 'r0', 'r1']);
    assert.equal(h.table.previousElementSibling, null);
});

test('multiple bodies are validated atomically before reordering any body', () => {
    const h = fixture(), extra = h.table.appendChild(new h.Node('tbody'));
    const row = extra.appendChild(new h.Node('tr'));
    const cell = row.appendChild(new h.Node('td')); cell.setAttribute('data-sb-sort-value', '4');
    h.run();
    cell.setAttribute('data-sb-sort-value', 'invalid');
    assert.throws(() => h.button(0).click(), /Invalid finite numeric/);
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
    assert.equal(h.writes.length, 0);
});

test('history write failures are explicit and leave rows and state untouched', () => {
    const h = fixture(), api = h.run().create(h.table);
    h.history.replaceState = () => { throw Error('History denied'); };
    assert.throws(() => h.button(0).click(), /History denied/);
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
    assert.equal(api.state, null);
    assert.equal(h.table.previousElementSibling.getAttribute('role'), 'alert');
});

test('malformed Back state reports an alert and throws without changing rows', () => {
    const h = fixture(); h.run(); h.button(0).click();
    h.history.state = {sbTableSort: { 'table-1': {column: 0, direction: 'wrong'}}};
    h.dispatch('popstate');
    assert.throws(() => h.flush(), /Invalid table sort/);
    assert.deepEqual(h.order(), ['r1', 'r0', 'r2']);
    assert.equal(h.table.previousElementSibling.getAttribute('role'), 'alert');
});

test('missing cells and post-mount row changes fail instead of losing rows', () => {
    const missing = fixture([{rows: [['1'], []]}]);
    assert.throws(() => missing.run(), /missing a column/);
    const h = fixture(), api = h.run().create(h.table);
    h.body.appendChild(new h.Node('tr'));
    assert.throws(() => api.restore(null), /rows changed after mounting/);
    assert.equal(h.body.rows.length, 4);
});

test('row reorders preserve nested vertical and horizontal reading offsets and focus', () => {
    const h = fixture(), outer = new h.Node('main'), inner = new h.Node('section');
    h.document.appendChild(outer); outer.appendChild(inner); inner.appendChild(h.table);
    outer.scrollHeight = 1600; outer.clientHeight = 600;
    inner.scrollHeight = 900; inner.clientHeight = 400;
    inner.scrollWidth = 1000; inner.clientWidth = 500;
    const sorter = h.run(), api = sorter.create(h.table);
    outer.scrollTop = 300; inner.scrollTop = 220; inner.scrollLeft = 75;
    const focused = h.rows[0].cells[0].appendChild(new h.Node('input'));
    focused.focus();
    h.body.onMove = () => {
        outer.scrollTop = 0; inner.scrollTop = 0; inner.scrollLeft = 0;
    };
    h.button(0).click();
    assert.deepEqual(h.order(), ['r1', 'r0', 'r2']);
    assert.equal(outer.scrollTop, 300);
    assert.equal(inner.scrollTop, 220);
    assert.equal(inner.scrollLeft, 75);
    assert.equal(h.document.activeElement, focused);
    api.restore(null);
    assert.deepEqual(h.order(), ['r0', 'r1', 'r2']);
    assert.equal(outer.scrollTop, 300);
    assert.equal(inner.scrollTop, 220);
    assert.equal(inner.scrollLeft, 75);
});

test('directory Back/pageshow restores both sorts without moving already ordered rows or scroll', () => {
    const state = {sbProductsDirectory: {
        product: 'Virtual Machines Dv3 Series', productScroll: 300, customerScroll: 220,
    }, sbTableSort: {
        left: {column: 0, direction: 'ascending'},
        right: {column: 0, direction: 'descending'},
    }};
    const h = fixture([{key: 'left'}, {key: 'right'}], state);
    const panes = h.tables.map(({table}) => {
        const pane = h.document.appendChild(new h.Node('section'));
        pane.appendChild(table);
        pane.scrollHeight = 2000; pane.clientHeight = 500;
        return pane;
    });
    const sorter = h.run();
    panes[0].scrollTop = 300; panes[1].scrollTop = 220;
    const initialMoves = h.tables.map(({body}) => body.moves);
    h.tables.forEach(({body}, index) => {
        body.onMove = () => { panes[index].scrollTop = 0; };
    });
    h.dispatch('popstate'); h.dispatch('pageshow'); h.flush();
    assert.equal(panes[0].scrollTop, 300);
    assert.equal(panes[1].scrollTop, 220);
    assert.deepEqual(h.tables.map(({body}) => body.moves), initialMoves);
    assert.equal(sorter.create(h.tables[0].table).state.direction, 'ascending');
    assert.equal(sorter.create(h.tables[1].table).state.direction, 'descending');
    assert.equal(h.tables[1].headers[0].getAttribute('aria-sort'), 'descending');
    assert.equal(h.history.state.sbProductsDirectory.customerScroll, 220);
    assert.equal(h.writes.length, 0);
});

test('equal row order still updates state/aria without moving nodes or writing scroll', () => {
    const h = fixture([{rows: [['1'], ['1'], ['1']]}]);
    const pane = h.document.appendChild(new h.Node('section'));
    pane.appendChild(h.table); pane.scrollHeight = 1000; pane.clientHeight = 500;
    const api = h.run().create(h.table);
    let top = 220, scrollWrites = 0;
    Object.defineProperty(pane, 'scrollTop', {
        get: () => top, set: value => { top = value; scrollWrites++; },
    });
    h.body.onMove = () => { throw Error('Already ordered rows must not move'); };
    api.restore({column: 0, direction: 'descending'});
    assert.equal(api.state.direction, 'descending');
    assert.equal(h.headers[0].getAttribute('aria-sort'), 'descending');
    assert.equal(h.button(0).getAttribute('aria-label'), 'Column 0: sort ascending');
    assert.equal(scrollWrites, 0);
    api.restore(null);
    assert.equal(h.headers[0].getAttribute('aria-sort'), 'none');
    assert.equal(scrollWrites, 0);
});

test('deferred lifecycle restoration ignores disposed fragments and restores current replacement', () => {
    const h = fixture([{key: 'ajax'}]), sorter = h.run();
    h.button(0).click();
    h.dispatch('pageshow');
    h.table.remove();
    h.rows[0].cells[0].setAttribute('data-sb-sort-value', 'Disposed invalid value');
    const replacement = h.makeTable({key: 'ajax'});
    h.document.appendChild(replacement.table);
    sorter.mount(replacement.table);
    h.history.state = {sbTableSort: {ajax: {column: 0, direction: 'descending'}}};
    h.flush();
    assert.deepEqual(replacement.order(), ['r2', 'r0', 'r1']);
    assert.deepEqual(h.order(), ['r1', 'r0', 'r2']);
    assert.equal(h.errors.length, 0);
    assert.equal(h.table.previousElementSibling, null);
});

function groupedFixture(historyState = null) {
    const h = fixture([{
        types: ['text', 'text', 'text', 'number', 'number'],
        rows: [
            ['Zulu', 'Ada', 'West', '200', '2'], ['Alpha', 'Bea', 'East', '100', '10'],
            ['Beta', '', '', '900', '3'], ['Alpha', 'Ada', 'North', '200', '2'],
        ],
    }], historyState);
    h.table.setAttribute('data-sb-sort-groups', '');
    h.body.remove();
    h.groups = h.rows.map((row, index) => {
        const body = h.table.appendChild(new h.Node('tbody'));
        body.appendChild(row);
        const detail = body.appendChild(new h.Node('tr'));
        detail.hidden = index !== 0;
        const cell = detail.appendChild(new h.Node('td'));
        cell.colSpan = 5;
        const nested = h.makeTable({key: `nested-${index}`});
        cell.appendChild(nested.table);
        return {body, row, detail, nested};
    });
    h.groupOrder = () => h.table.tBodies.map(body => body.rows[0].id);
    return h;
}

test('grouped sorting moves complete expanded readers by all five summary columns', () => {
    const h = groupedFixture(), api = h.run().create(h.table);
    const orders = [
        [['r1', 'r3', 'r2', 'r0'], ['r0', 'r2', 'r1', 'r3']],
        [['r0', 'r3', 'r1', 'r2'], ['r1', 'r0', 'r3', 'r2']],
        [['r1', 'r3', 'r0', 'r2'], ['r0', 'r3', 'r1', 'r2']],
        [['r1', 'r0', 'r3', 'r2'], ['r2', 'r0', 'r3', 'r1']],
        [['r0', 'r3', 'r2', 'r1'], ['r1', 'r2', 'r0', 'r3']],
    ];
    orders.forEach((directions, column) => {
        ['ascending', 'descending'].forEach((direction, index) => {
            api.restore({column, direction});
            assert.deepEqual(h.groupOrder(), directions[index]);
            h.groups.forEach(({body, row, detail, nested}, groupIndex) => {
                assert.deepEqual(body.rows, [row, detail]);
                assert.equal(detail.hidden, groupIndex !== 0);
                assert.equal(nested.table.parentNode.parentNode, detail);
                assert.deepEqual(nested.order(), ['r0', 'r1', 'r2']);
            });
        });
    });
    api.restore(null);
    assert.deepEqual(h.groupOrder(), ['r0', 'r1', 'r2', 'r3']);
});

test('grouped sorting retains nested sort, focus, reading offsets and Back state', () => {
    const context = {id: 4, top: 200, expanded: ['first']};
    const h = groupedFixture({sbTopicDetail: context});
    const pane = h.document.appendChild(new h.Node('section'));
    pane.appendChild(h.table);
    pane.scrollHeight = 2000; pane.clientHeight = 500; pane.scrollTop = 200;
    const sorter = h.run(), api = sorter.create(h.table);
    const nested = h.groups[0].nested;
    nested.button(0).click();
    nested.button(0).focus();
    h.table.onMove = () => {pane.scrollTop = 0;};
    api.restore({column: 4, direction: 'descending'});
    assert.deepEqual(nested.order(), ['r1', 'r0', 'r2']);
    assert.equal(h.document.activeElement, nested.button(0));
    assert.equal(pane.scrollTop, 200);
    h.button(4).click();
    assert.equal(h.history.state.sbTableSort['table-1'].direction, 'ascending');
    assert.equal(h.history.state.sbTableSort['nested-0'].direction, 'ascending');
    assert.equal(h.history.state.sbTopicDetail, context);
    api.restore(null);
    h.dispatch('pageshow'); h.flush();
    assert.deepEqual(h.groupOrder(), ['r0', 'r3', 'r2', 'r1']);
    assert.deepEqual(nested.order(), ['r1', 'r0', 'r2']);
});

test('grouped sorting fails visibly before moving records with invalid summary data', () => {
    const h = groupedFixture(), api = h.run().create(h.table);
    h.rows[1].cells[4].setAttribute('data-sb-sort-value', 'not a number');
    assert.throws(() => api.restore({column: 0, direction: 'ascending'}), /Invalid finite/);
    assert.deepEqual(h.groupOrder(), ['r0', 'r1', 'r2', 'r3']);
    assert.equal(h.table.previousElementSibling.getAttribute('role'), 'alert');
    h.rows[1].cells[4].setAttribute('data-sb-sort-value', '10');
    h.groups[1].body.remove();
    assert.throws(() => api.restore(null), /rows changed/);
});

test('Latest defaults newest first and restores that order through header sorting and Back', () => {
    const context = {id: 4, top: 200, expanded: ['first']};
    const h = groupedFixture({sbTopicDetail: context});
    h.table.setAttribute('data-sb-sort-default-column', '3');
    h.table.setAttribute('data-sb-sort-default-direction', 'descending');
    const api = h.run().create(h.table);
    assert.deepEqual(h.groupOrder(), ['r2', 'r0', 'r3', 'r1']);
    assert.equal(h.headers[3].getAttribute('aria-sort'), 'descending');
    h.groups[0].nested.button(0).click();
    h.button(4).click();
    assert.deepEqual(h.groupOrder(), ['r0', 'r3', 'r2', 'r1']);
    h.button(3).click();
    assert.deepEqual(h.groupOrder(), ['r1', 'r0', 'r3', 'r2']);
    h.button(3).click();
    assert.deepEqual(h.groupOrder(), ['r2', 'r0', 'r3', 'r1']);
    assert.equal(api.state.column, 3);
    assert.equal(api.state.direction, 'descending');
    assert.equal(h.headers[4].getAttribute('aria-sort'), 'none');
    assert.equal(h.headers[3].getAttribute('aria-sort'), 'descending');
    assert.equal(h.history.state.sbTableSort['table-1'].column, 3);
    assert.equal(h.history.state.sbTableSort['table-1'].direction, 'descending');
    assert.equal(h.history.state.sbTableSort['nested-0'].direction, 'ascending');
    assert.equal(h.history.state.sbTopicDetail, context);
    h.dispatch('pageshow'); h.flush();
    assert.deepEqual(h.groupOrder(), ['r2', 'r0', 'r3', 'r1']);
    assert.deepEqual(h.groups[0].nested.order(), ['r1', 'r0', 'r2']);
    const reloaded = groupedFixture(h.history.state);
    reloaded.table.setAttribute('data-sb-sort-default-column', '3');
    reloaded.table.setAttribute('data-sb-sort-default-direction', 'descending');
    reloaded.run();
    assert.deepEqual(reloaded.groupOrder(), ['r2', 'r0', 'r3', 'r1']);
});

test('Latest sorts equal displayed dates by the full underlying time', () => {
    const h = groupedFixture();
    h.rows.forEach(row => { row.cells[3].textContent = 'Jan 01, 1970'; });
    h.run();
    h.button(3).click();
    assert.deepEqual(h.groupOrder(), ['r1', 'r0', 'r3', 'r2']);
    h.button(3).click();
    assert.deepEqual(h.groupOrder(), ['r2', 'r0', 'r3', 'r1']);
});
