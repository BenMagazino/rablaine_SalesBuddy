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
    table.tBodies = [tbody];
    table.contains = row => rows.includes(row);
    const root = {querySelector: () => table}, opens = [];
    vm.runInNewContext(source, {
        document: {querySelectorAll: () => [root, {querySelector: () => null}]},
        Element, SBRevenueAlertPreview: {open: (...args) => opens.push(args)},
    });
    return {rows, tbody, table, opens, Element};
}

test('row binding leaves shared-sort order, data and filtered rows untouched', () => {
    const h = fixture();
    assert.deepEqual(h.tbody.rows.map(row => row.cells[0].textContent), ['40', '95', '70']);
    assert.deepEqual(h.tbody.rows.map(row => row.dataset.analysisId), ['1', '2', '3']);
    assert.equal(h.rows[0].style.display, 'none');
    assert.equal(h.rows[2].cells[5].textContent, '$-200');
    h.table.handlers.click({target: new h.Element()});
    assert.equal(h.opens.length, 0);
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
