const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-products.js'), 'utf8');

function fixture({embedded = false, empty = false, product = '', products = null} = {}) {
    const document = {activeElement: null};
    class Element {
        constructor() {
            this.hidden = false; this.listeners = {}; this.value = ''; this.scrollTop = 0;
            this.dataset = {}; this.attributes = {}; this.children = [];
        }
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
        fire(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); }
        contains(element) {
            return element === this || element === this.link ||
                this.children.some(child => child.contains(element));
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        getAttribute(name) { return this.attributes[name]; }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
    }
    const search = new Element(), clear = new Element(), noMatches = new Element();
    const count = {textContent: ''}, parentCount = {textContent: 'parent scope'};
    const rows = (empty ? [] : products ?? [
        ['Premium SSD', '20', '$200'], ['SQL/Compute <literal>', '2', '$110'],
        ['Azure Synapse Analytics', '2', '$350'],
    ]).map(values => {
        const row = new Element(); row.link = new Element(); row.button = new Element();
        row.dataset.productName = values[0];
        row.link.setAttribute('href', '/product/' + encodeURIComponent(values[0]));
        row.querySelector = selector => selector === '[data-sb-products-link]' ? row.link : row.button;
        row.querySelectorAll = () => values.map(textContent => ({textContent}));
        return row;
    });
    const inspector = new Element(), reading = new Element(), noSelection = new Element();
    const customerScroll = new Element(), content = new Element();
    content.querySelector = () => customerScroll;
    content.children = [customerScroll]; inspector.children = [content];
    const nodes = {'#directoryProductSearch': search, '[data-sb-products-clear]': clear,
        '[data-sb-products-no-matches]': noMatches, '[data-sb-products-count]': count};
    Object.assign(nodes, {'[data-sb-products-inspector]': inspector,
        '[data-sb-products-reading]': reading, '[data-sb-products-no-selection]': noSelection});
    const root = {dataset: {embedded: String(embedded)},
        querySelector: selector => nodes[selector], querySelectorAll: () => rows};
    document.querySelector = selector => selector === '[data-sb-products-directory]' ?
        root : embedded ? parentCount : count;
    let loaderOptions;
    const requests = [], loader = {
        open(snapshot) {
            if (!inspector.hidden && requests.at(-1)?.id === snapshot.id) return;
            inspector.hidden = false; requests.push(snapshot);
        },
        clear() { inspector.hidden = true; this.cleared = true; },
    };
    inspector.hidden = true;
    const window = {listeners: {}, timers: [],
        location: {pathname: '/products', search: product ? '?product=' + encodeURIComponent(product) : '', hash: ''},
        SBRecordDialog: {create(target, options) {
            assert.equal(target, inspector); loaderOptions = options; return loader;
        }},
        requestAnimationFrame(callback) { this.timers.push(callback); },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        setTimeout(callback) { this.timers.push(callback); }};
    Object.defineProperty(window.location, 'href', {get() {
        return 'http://127.0.0.1:5000' + this.pathname + this.search + this.hash;
    }});
    window.history = {state: {}, replacements: [],
        replaceState(state, unused, destination) {
            this.state = state;
            if (!destination) return;
            this.replacements.push(destination);
            const url = new URL(destination, window.location.href);
            Object.assign(window.location, {pathname: url.pathname, search: url.search, hash: url.hash});
        }};
    return {search, clear, noMatches, count, parentCount, rows, root, document, window,
        inspector, reading, noSelection, customerScroll, content, requests, loader,
        get loaderOptions() { return loaderOptions; },
        run: () => vm.runInNewContext(source, {window, document, URL}),
        query(value) { search.value = value; search.fire('input'); }};
}

test('directory mounts once and preserves all products in original order', () => {
    const h = fixture(); h.run();
    const api = h.window.SBProductsDirectory.create(h.root);
    assert.equal(h.window.SBProductsDirectory.create(h.root), api);
    assert.equal(h.search.listeners.input.length, 1);
    assert.equal(h.count.textContent, '3 of 3 products shown');
    assert.equal(h.noMatches.hidden, true);
    assert.equal(h.clear.hidden, true);
    assert.ok(h.rows.every(row => !row.hidden));
});

test('search covers every displayed field, provides zero-match recovery and never mutates values', () => {
    const h = fixture(); h.run();
    h.query('SQL/COMPUTE');
    assert.deepEqual(h.rows.map(row => row.hidden), [true, false, true]);
    h.query('$350');
    assert.deepEqual(h.rows.map(row => row.hidden), [true, true, false]);
    h.query('20');
    assert.deepEqual(h.rows.map(row => row.hidden), [false, true, true]);
    h.query('no product matches');
    assert.equal(h.count.textContent, '0 of 3 products shown');
    assert.equal(h.noMatches.hidden, false);
    h.clear.fire('click');
    assert.equal(h.count.textContent, '3 of 3 products shown');
    assert.equal(h.document.activeElement, h.search);
    assert.ok(h.rows.every(row => !row.hidden));
    assert.equal(h.rows[1].querySelectorAll()[2].textContent, '$110');
});

test('hiding a focused product link returns focus to search', () => {
    const h = fixture(); h.run();
    h.document.activeElement = h.rows[0].link;
    h.query('SQL');
    assert.equal(h.document.activeElement, h.search);
    assert.equal(h.search.focusOptions.preventScroll, true);
});

test('Back-restored form values reconcile after pageshow', () => {
    const h = fixture(); h.run();
    h.window.listeners.pageshow();
    h.search.value = 'synapse';
    h.window.timers.shift()();
    assert.equal(h.count.textContent, '1 of 3 products shown');
    assert.deepEqual(h.rows.map(row => row.hidden), [true, true, false]);
});

test('empty and embedded directories stay local to their own reading scope', () => {
    const empty = fixture({empty: true}); empty.run();
    assert.equal(empty.count.textContent, '0 of 0 products shown');
    const h = fixture({embedded: true}); h.run(); h.query('SQL');
    assert.equal(h.count.textContent, '1 of 3 products shown');
    assert.equal(h.parentCount.textContent, 'parent scope');
});

test('other pages do not mount controls and malformed controls fail explicitly', () => {
    vm.runInNewContext(source, {window: {}, document: {querySelector: () => null}});
    const h = fixture();
    h.root.querySelector = () => null;
    assert.throws(h.run, /controls or scope count are missing/);
});

test('directory Help matches both aliases and leaves product detail Help intact', () => {
    const help = fs.readFileSync(path.join(__dirname, '../../static/js/page-help.js'), 'utf8');
    for (const pathname of ['/products', '/revenue/products/', '/product/SQL/Compute']) {
        const title = {}, body = {};
        vm.runInNewContext(help + '\nPageHelp.show();', {
            window: {location: {pathname}},
            document: {getElementById: id => id === 'pageHelpModalLabel' ? title : body},
            SBDialog: {toggle() {}},
        });

        assert.equal(title.textContent, pathname.startsWith('/product/') ? 'Product Revenue' : 'Products');
        if (title.textContent === 'Products') assert.match(body.innerHTML, /not unique customers/);
    }
});

test('product selection uses the existing guarded panel and verifies product-name identity', () => {
    const h = fixture({product: 'SQL/Compute <literal>'}); h.run();
    assert.equal(h.window.SBProductsDirectory.create(h.root).selected, 'SQL/Compute <literal>');
    assert.equal(h.root.dataset.sbProductsEnhanced, 'true');
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].id, 2);
    assert.equal(h.loaderOptions.presentation, 'panel');
    assert.equal(h.loaderOptions.identityValue(2), 'SQL/Compute <literal>');
    assert.equal(h.loaderOptions.loadUrl(2), '/product/SQL%2FCompute%20%3Cliteral%3E?comparison=1');
    assert.throws(() => h.loaderOptions.identityValue(20), /Unknown directory product/);
    let prevented = false;
    h.rows[2].link.fire('click', {preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.equal(h.requests.at(-1).id, 3);
    assert.equal(h.rows[2].button.attributes['aria-pressed'], 'true');
    assert.equal(new URL(h.window.location.href).searchParams.get('product'), 'Azure Synapse Analytics');
    const requests = h.requests.length;
    h.rows[0].link.fire('click', {ctrlKey: true});
    assert.equal(h.requests.length, requests);
});

test('search exclusion clears the inspector and Clear selects a real product again', () => {
    const h = fixture(); h.run();
    h.query('no matching product');
    assert.equal(h.inspector.hidden, true);
    assert.equal(h.noSelection.hidden, false);
    assert.equal(h.loader.cleared, true);
    assert.equal(new URL(h.window.location.href).searchParams.has('product'), false);
    h.clear.fire('click');
    assert.equal(h.inspector.hidden, false);
    assert.equal(h.noSelection.hidden, true);
    assert.equal(h.window.SBProductsDirectory.create(h.root).selected, 'Premium SSD');
});

test('Back restores exact product, search and both independent reading positions', () => {
    const h = fixture(); h.run();
    h.query('SQL');
    const mounted = h.loaderOptions.mount(h.content); h.window.timers.shift()();
    h.reading.scrollTop = 410; h.customerScroll.scrollTop = 230;
    h.window.history.state.otherFeature = 'preserved';
    h.window.listeners.pagehide();
    assert.equal(h.window.history.state.sbProductsDirectory.product, 'SQL/Compute <literal>');
    assert.equal(h.window.history.state.otherFeature, 'preserved');
    h.search.value = ''; h.reading.scrollTop = 0; h.customerScroll.scrollTop = 0;
    h.window.listeners.pageshow(); h.window.timers.shift()();
    assert.equal(h.search.value, 'SQL');
    assert.equal(h.reading.scrollTop, 410);
    assert.equal(h.customerScroll.scrollTop, 230);
    assert.equal(h.count.textContent, '1 of 3 products shown');
    h.rows[1].button.fire('click');
    assert.equal(h.customerScroll.scrollTop, 230);
    mounted.dispose();
    const later = h.loaderOptions.mount(h.content); later.dispose();
    h.customerScroll.scrollTop = 50; h.window.timers.shift()();
    assert.equal(h.customerScroll.scrollTop, 50);
});

test('embedded and truly empty directories never start a panel or write navigation state', () => {
    for (const options of [{embedded: true}, {empty: true}]) {
        const h = fixture(options); h.run();
        assert.equal(h.requests.length, 0);
        assert.equal(h.loaderOptions, undefined);
        assert.equal(h.window.history.replacements.length, 0);
        assert.equal(h.root.dataset.sbProductsEnhanced, undefined);
    }
});

test('search fallback follows current product order while numeric loader IDs remain stable', () => {
    const h = fixture({products: [
        ['Other', '1', '$1'], ['Shared Beta', '2', '$2'], ['Shared Alpha', '3', '$3'],
    ]});
    h.run(); h.rows.reverse(); h.query('Shared');
    assert.equal(h.window.SBProductsDirectory.create(h.root).selected, 'Shared Alpha');
    assert.equal(h.requests.at(-1).id, 3);
    assert.equal(h.loaderOptions.identityValue(3), 'Shared Alpha');
});

test('removed product bookmarks show an explicit empty inspector, never another product', () => {
    const h = fixture({product: 'Removed product'}); h.run();
    assert.equal(h.requests.length, 0);
    assert.equal(h.noSelection.hidden, false);
    assert.match(h.noSelection.textContent, /requested product is no longer available/);
    h.rows[0].button.fire('click');
    assert.equal(h.requests[0].title, 'Premium SSD');
});
