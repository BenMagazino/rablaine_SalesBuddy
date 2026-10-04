const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-alerts.js'), 'utf8');

function fixture() {
    class Element {
        constructor() { this.handlers = {}; }
        addEventListener(type, fn) { this.handlers[type] = fn; }
        focus() { this.focused = true; }
        closest(selector) {
            if (selector === 'tr[data-analysis-id]') return this.row || null;
            if (selector === 'a, button') return this.interactive ? this : null;
            if (selector === '[data-sb-revenue-open]') return this.preview ? this : null;
            throw Error('Unexpected selector ' + selector);
        }
    }
    const kinds = ['number', 'text', 'text', 'text', 'text', 'currency', 'currency', null, 'text'];
    const headers = kinds.map(kind => {
        const button = kind ? new Element() : null, icon = {};
        if (button) button.querySelector = () => icon;
        return {dataset: {sortType: kind}, attrs: {}, button, icon,
            querySelector: () => button,
            setAttribute(key, value) { this.attrs[key] = value; }};
    });
    const rows = [
        ['40', 'alpha', 'Data', 'Healthy', 'NO ACTION', '$9,050', '-', 'First', 'New'],
        ['95', '<Quoted "customer">', 'Databases', 'Declining', 'CHECK-IN', '$1,200',
            '$3,711/mo risk', 'Second', 'Reviewed'],
        ['70', 'Zulu', 'Fabric', 'Expansion', 'EXPAND', '$-200', '$5,000/mo opp', 'Third', 'New'],
    ].map((values, index) => {
        const row = new Element(), button = new Element();
        row.cells = values.map(textContent => ({textContent}));
        row.dataset = {analysisId: String(index + 1), customerName: values[1],
            bucket: values[2], alertClickable: 'true'};
        row.style = {display: index === 0 ? 'none' : ''};
        button.row = row; button.interactive = true; button.preview = true;
        row.querySelector = () => button;
        row.opener = button;
        return row;
    });
    const tbody = {rows: [...rows], appendChild(row) {
        this.rows.splice(this.rows.indexOf(row), 1); this.rows.push(row);
    }};
    const table = new Element();
    table.querySelectorAll = () => headers;
    table.tBodies = [tbody];
    table.contains = row => rows.includes(row);
    const root = {querySelector: () => table}, opens = [];
    vm.runInNewContext(source, {
        document: {querySelectorAll: () => [root, {querySelector: () => null}]},
        Element, SBRevenueAlertPreview: {open: (...args) => opens.push(args)},
    });
    return {headers, rows, tbody, table, opens, Element};
}

test('initial priority is descending and sortable headers expose their direction', () => {
    const h = fixture();
    assert.deepEqual(h.tbody.rows.map(row => row.cells[0].textContent), ['95', '70', '40']);
    assert.equal(h.headers[0].attrs['aria-sort'], 'descending');
    h.headers[0].button.handlers.click();
    assert.deepEqual(h.tbody.rows.map(row => row.cells[0].textContent), ['40', '70', '95']);
    assert.equal(h.headers[0].attrs['aria-sort'], 'ascending');
});

test('currency sorting preserves negative values, risk/opportunity amounts and filtered rows', () => {
    const h = fixture();
    h.headers[5].button.handlers.click();
    assert.deepEqual(h.tbody.rows.map(row => row.dataset.analysisId), ['3', '2', '1']);
    h.headers[5].button.handlers.click();
    assert.deepEqual(h.tbody.rows.map(row => row.dataset.analysisId), ['1', '2', '3']);
    h.headers[6].button.handlers.click();
    assert.deepEqual(h.tbody.rows.map(row => row.dataset.analysisId), ['1', '2', '3']);
    assert.equal(h.rows[0].style.display, 'none');
    assert.equal(h.headers[0].attrs['aria-sort'], 'none');
});

test('text/status columns sort independently of the optional Seller column', () => {
    const h = fixture();
    h.headers[8].button.handlers.click();
    assert.deepEqual(h.tbody.rows.map(row => row.cells[8].textContent), ['New', 'New', 'Reviewed']);
    assert.equal(h.headers[8].attrs['aria-sort'], 'ascending');
    assert.equal(h.headers[8].icon.className, 'bi bi-sort-up');
});

test('row clicks focus a native opener and pass literal identity fields to the shared preview', () => {
    const h = fixture(), cell = new h.Element(); cell.row = h.rows[1];
    h.table.handlers.click({target: cell});
    assert.deepEqual(h.opens, [['2', '<Quoted "customer">', 'Databases']]);
    assert.equal(h.rows[1].opener.focused, true);
    h.table.handlers.click({target: h.rows[2].opener});
    assert.deepEqual(h.opens[1], ['3', 'Zulu', 'Fabric']);
});

test('customer links and review controls never launch another preview', () => {
    const h = fixture(), link = new h.Element(); link.row = h.rows[1]; link.interactive = true;
    h.table.handlers.click({target: link});
    h.table.handlers.click({target: {}});
    assert.equal(h.opens.length, 0);
    h.rows[1].dataset.alertClickable = 'false';
    h.table.handlers.click({target: h.rows[1].opener});
    assert.equal(h.opens.length, 0);
});
