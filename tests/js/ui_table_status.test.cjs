const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-table-status.js'), 'utf8');

function fixture({missing = false, empty = false, unit = 'alerts'} = {}) {
    class HTMLTableElement {}
    const rows = empty ? [] : [
        {hidden: false, display: 'table-row'},
        {hidden: false, display: 'none'},
        {hidden: true, display: 'table-row'},
    ];
    const table = new HTMLTableElement();
    table.tBodies = [{rows}];
    const status = {
        dataset: {sbTableStatus: 'alertsTable', sbTableUnit: unit},
        value: '', writes: 0, attributes: {},
        get textContent() { return this.value; },
        set textContent(value) { this.value = value; this.writes++; },
        setAttribute(name, value) { this.attributes[name] = value; },
    };
    const observers = [];
    class MutationObserver {
        constructor(update) { this.update = update; observers.push(this); }
        observe(target, options) { this.target = target; this.options = options; }
    }
    const context = {
        HTMLTableElement, MutationObserver,
        document: {
            querySelectorAll: () => [status],
            getElementById: id => id === 'alertsTable' && !missing ? table : null,
        },
        getComputedStyle: row => ({display: row.display}),
    };
    return {rows, table, status, observers, run: () => vm.runInNewContext(source, context)};
}

test('view counts only its table bodies, excluding hidden and CSS-filtered rows', () => {
    const h = fixture(); h.run();
    assert.equal(h.status.textContent, '1 of 3 alerts shown');
    assert.equal(h.observers[0].target, h.table);
    assert.equal(h.observers[0].options.subtree, true);
    assert.equal(h.observers[0].options.childList, true);
    assert.deepEqual(Array.from(h.observers[0].options.attributeFilter), ['style', 'hidden', 'class']);
});

test('filter changes and inserted/removed rows update shown and total counts', () => {
    const h = fixture(); h.run();
    h.rows[1].display = 'table-row'; h.rows[2].hidden = false;
    h.observers[0].update();
    assert.equal(h.status.textContent, '3 of 3 alerts shown');
    h.rows.push({hidden: false, display: 'table-row'});
    h.observers[0].update();
    assert.equal(h.status.textContent, '4 of 4 alerts shown');
    h.rows.splice(0, 1); h.observers[0].update();
    assert.equal(h.status.textContent, '3 of 3 alerts shown');
});

test('sorting and unrelated observed changes do not repeat live-region announcements', () => {
    const h = fixture(); h.run();
    const writes = h.status.writes;
    h.rows.reverse(); h.observers[0].update();
    assert.equal(h.status.writes, writes);
});

test('all-filtered views keep the actual total, and empty tables report zero', () => {
    const h = fixture(); h.run();
    h.rows.forEach(row => { row.display = 'none'; }); h.observers[0].update();
    assert.equal(h.status.textContent, '0 of 3 alerts shown');
    const empty = fixture({empty: true, unit: undefined}); empty.run();
    assert.equal(empty.status.textContent, '0 of 0 alerts shown');
});

test('optional unit defaults to rows and pages without bindings require no observer', () => {
    const h = fixture({unit: ''}); h.run();
    assert.equal(h.status.textContent, '1 of 3 rows shown');
    vm.runInNewContext(source, {document: {querySelectorAll: () => []}});
});

test('invalid bindings expose unavailable feedback and fail explicitly', () => {
    const h = fixture({missing: true});
    assert.throws(h.run, /requires a real table: alertsTable/);
    assert.equal(h.status.textContent, 'View count unavailable');
    assert.equal(h.status.attributes.role, 'alert');
    assert.equal(h.observers.length, 0);
});
