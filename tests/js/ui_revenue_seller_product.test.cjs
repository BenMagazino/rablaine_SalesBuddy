const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-revenue-seller-product.js'), 'utf8');

function fixture({embedded = false, empty = false, query = ''} = {}) {
    const document = {activeElement: null};
    class Element {
        constructor() {
            this.hidden = false; this.value = ''; this.dataset = {};
            this.listeners = {}; this.scrollTop = 0;
        }
        addEventListener(name, callback) { this.listeners[name] = callback; }
        fire(name) { this.listeners[name]?.(); }
        contains(element) { return element === this; }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
        scrollIntoView(options) { this.scrollOptions = options; }
    }
    const search = new Element(), clear = new Element(), reading = new Element();
    const noMatches = new Element(), notice = new Element(), count = new Element();
    const parentCount = {textContent: 'parent scope'}, warnings = [];
    const rows = empty ? [] : [['Same name', 'Data', '$100'],
        ['Same name', 'Infra', '$30'], ['Other customer', 'Data', '$0']].map(values => {
        const row = new Element();
        row.dataset = {customerName: values[0], bucket: values[1]};
        row.textContent = values.join(' ');
        return row;
    });
    const nodes = {'[data-sb-seller-product-search]': search,
        '[data-sb-seller-product-clear]': clear, '[data-sb-seller-product-reading]': reading,
        '[data-sb-seller-product-no-matches]': noMatches, '[data-sb-seller-product-notice]': notice,
        '[data-sb-seller-product-count]': count};
    notice.hidden = true;
    const root = {dataset: {embedded: String(embedded)},
        querySelector: selector => nodes[selector], querySelectorAll: () => rows};
    document.querySelector = selector => selector === '[data-sb-seller-product]' ?
        root : embedded ? parentCount : count;
    const window = {listeners: {}, timers: [],
        location: {href: 'http://127.0.0.1:5000/revenue/seller/Test/product/SKU' + query},
        history: {state: {}, replaceState(state) { this.state = state; }},
        addEventListener(name, callback) { this.listeners[name] = callback; },
        setTimeout(callback) { this.timers.push(callback); }};
    return {root, document, window, search, clear, reading, noMatches, notice,
        count, parentCount, rows, warnings,
        run() { vm.runInNewContext(source, {
            window, document, URL, console: {
                warn: message => warnings.push(message), error: message => warnings.push(message),
            },
        }); },
        filter(value) { search.value = value; search.fire('input'); }};
}

test('search covers customer, bucket and exact displayed money without reordering rows', () => {
    const h = fixture(); h.run();
    assert.equal(h.count.textContent, '3 of 3 customer entries shown');
    h.filter('INFRA');
    assert.deepEqual(h.rows.map(r => r.hidden), [true, false, true]);
    h.filter('$100');
    assert.deepEqual(h.rows.map(r => r.hidden), [false, true, true]);
    h.filter('unknown');
    assert.equal(h.noMatches.hidden, false);
    assert.equal(h.count.textContent, '0 of 3 customer entries shown');
    h.clear.fire('click');
    assert.ok(h.rows.every(r => !r.hidden));
    assert.equal(h.document.activeElement, h.search);
    assert.equal(h.rows[0].textContent, 'Same name Data $100');
});

test('hiding a focused row restores focus and does not invent another selection', () => {
    const h = fixture({query: '?customer=Same+name&bucket=Infra'}); h.run();
    h.document.activeElement = h.rows[1];
    h.filter('Other');
    assert.equal(h.document.activeElement, h.search);
    assert.equal(h.search.focusOptions.preventScroll, true);
    assert.equal(h.rows[1].dataset.active, 'true');
    assert.equal(h.rows[2].dataset.active, undefined);
});

test('customer bookmarks identify the exact bucket and reveal it after pageshow', () => {
    const h = fixture({query: '?customer=Same+name&bucket=Infra'}); h.run();
    assert.equal(h.rows[1].dataset.active, 'true');
    assert.equal(h.rows[0].dataset.active, undefined);
    h.window.listeners.pageshow(); h.window.timers.shift()();
    assert.equal(h.rows[1].scrollOptions.block, 'center');
    assert.equal(h.notice.hidden, true);
});

test('missing and incomplete bookmarks notify instead of pretending a different row matched', () => {
    for (const query of ['?customer=Gone&bucket=Data', '?customer=Same+name']) {
        const h = fixture({query}); h.run();
        assert.equal(h.notice.hidden, false);
        assert.equal(h.warnings.length, 1);
        assert.ok(h.rows.every(r => r.dataset.active === undefined));
        assert.equal(h.count.textContent, '3 of 3 customer entries shown');
    }
});

test('Back preserves search, scroll and unrelated sort state', () => {
    const h = fixture(); h.run();
    h.window.history.state = {sbTableSort: {matrix: {column: 1, direction: 'ascending'}}};
    h.filter('Infra'); h.reading.scrollTop = 280;
    h.window.listeners.pagehide();
    assert.equal(h.window.history.state.sbTableSort.matrix.column, 1);
    h.search.value = ''; h.reading.scrollTop = 0;
    h.window.listeners.pageshow(); h.window.timers.shift()();
    assert.equal(h.search.value, 'Infra');
    assert.equal(h.reading.scrollTop, 280);
    assert.equal(h.count.textContent, '1 of 3 customer entries shown');
});

test('embedded and empty comparisons own their local counts without page state writes', () => {
    const h = fixture({embedded: true}); h.run(); h.filter('Infra');
    assert.equal(h.parentCount.textContent, 'parent scope');
    assert.equal(h.count.textContent, '1 of 3 customer entries shown');
    assert.equal(h.window.listeners.pagehide, undefined);
    const empty = fixture({empty: true}); empty.run();
    assert.equal(empty.count.textContent, '0 of 0 customer entries shown');
});

test('malformed Back context fails visibly before changing search or scroll', () => {
    const h = fixture(); h.run();
    h.search.value = 'Infra'; h.reading.scrollTop = 120;
    h.window.history.state = {sbSellerProduct: {search: 'Data', scroll: 'invalid'}};
    h.window.listeners.pageshow();
    assert.throws(() => h.window.timers.shift()(), /Invalid seller product browser history state/);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.search.value, 'Infra');
    assert.equal(h.reading.scrollTop, 120);
    assert.equal(h.warnings.length, 1);
});

test('unrelated pages do not mount and missing controls fail explicitly', () => {
    vm.runInNewContext(source, {document: {querySelector: () => null}});
    const h = fixture(); h.root.querySelector = () => null;
    assert.throws(h.run, /controls or count are missing/);
});
