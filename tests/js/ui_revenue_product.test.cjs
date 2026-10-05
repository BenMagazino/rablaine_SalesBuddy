const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-product.js'), 'utf8');

function fixture({embedded = false, names = ['Alpha', 'Beta', 'Gamma'],
    panelNames = ['Alpha', 'Gamma'], hash = ''} = {}) {
    class Element {
        constructor(dataset = {}) {
            this.dataset = dataset; this.hidden = false; this.attributes = {};
            this.children = []; this.listeners = {}; this.value = ''; this.textContent = '';
            this.scrollTop = 0;
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
        fire(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
        contains(item) { return this === item || this.children.some(c => c.contains(item)); }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
        closest() { return null; }
    }
    const search = new Element(), clear = new Element(), reading = new Element();
    const noSelection = new Element(), missing = new Element(), missingTitle = new Element();
    const noMatches = new Element(), notice = new Element();
    noSelection.hidden = missing.hidden = noMatches.hidden = true;
    const status = {writes: 0, value: '',
        get textContent() { return this.value; },
        set textContent(v) { this.value = v; this.writes++; }};
    const panels = panelNames.map(name => new Element({sbProductHistory: name}));
    const rows = names.map((name, index) => {
        const row = new Element({sbProductEntry: String(index + 1), customerName: name});
        row.id = 'product-entry-' + (index + 1);
        row.button = new Element(); row.button.hidden = true; row.children.push(row.button);
        row.cells = [name, ['Databases', 'Fabric', 'Storage'][index],
            ['$100', '$0', '$-20'][index]]
            .map(text => ({textContent: text || ''}));
        row.querySelector = () => row.button;
        row.querySelectorAll = () => row.cells;
        return row;
    });
    const root = new Element({embedded: String(embedded)});
    const nodes = {
        '#productCustomerSearch': search, '[data-sb-product-clear]': clear,
        '[data-sb-product-reading]': reading, '[data-sb-product-no-selection]': noSelection,
        '[data-sb-product-missing-history]': missing, '[data-sb-product-missing-title]': missingTitle,
        '[data-sb-product-no-matches]': noMatches, '[data-sb-product-notice]': notice,
        '[data-sb-product-fallback-empty]': null,
    };
    root.querySelector = selector => nodes[selector];
    root.querySelectorAll = selector => selector === '[data-sb-product-history]' ? panels : rows;
    const document = {activeElement: null,
        querySelector: selector => selector === '[data-sb-revenue-page="product"]' ? root : status};
    const trends = [];
    const window = {SBProductRevenueTrend: {create: () => ({show: panel => trends.push(panel)})},
        location: {hash, pathname: '/product/SQL', search: ''}, listeners: {},
        timers: [], setTimeout(fn) { this.timers.push(fn); },
        addEventListener(name, fn) { this.listeners[name] = fn; }};
    window.history = {state: {}, pushes: [], replacements: [],
        pushState(state, unused, url) {
            this.pushes.push(url); window.location.hash = url.startsWith('#') ? url : '';
        },
        replaceState(state, unused, url) {
            this.replacements.push(url); window.location.hash = url.startsWith('#') ? url : '';
        }};
    const context = {window, document};
    return {root, rows, panels, search, clear, reading, noSelection, missing, missingTitle,
        noMatches, notice, status, window, document, trends,
        run: () => vm.runInNewContext(source, context),
        api: () => window.SBProductRevenue.create(root),
        query(value) { search.value = value; search.fire('input'); }};
}

test('comparison selects existing history, preserves all records and has one idempotent mount', () => {
    const h = fixture(); h.run();
    assert.equal(h.root.dataset.sbProductEnhanced, 'true');
    assert.equal(h.api().selected, 'product-entry-1');
    assert.equal(h.panels[0].hidden, false);
    assert.equal(h.panels[1].hidden, true);
    assert.equal(h.rows[0].button.attributes['aria-pressed'], 'true');
    assert.equal(h.status.textContent, '3 of 3 customer entries shown');
    assert.equal(h.rows.length, 3);
    const api = h.api(); h.api();
    assert.equal(h.api(), api);
    assert.equal(h.search.listeners.input.length, 1);
    assert.equal(h.rows[0].button.listeners.click.length, 1);
    assert.equal(h.trends.at(-1), h.panels[0]);
});

test('search includes the three visible fields, advances selection and reports missing history', () => {
    const h = fixture(); h.run();
    h.query('FABRIC');
    assert.equal(h.api().selected, 'product-entry-2');
    assert.equal(h.missing.hidden, false);
    assert.equal(h.missingTitle.textContent, 'Beta');
    assert.equal(h.trends.at(-1), null);
    assert.equal(h.status.textContent, '1 of 3 customer entries shown');
    h.query('$-20');
    assert.equal(h.api().selected, 'product-entry-3');
    assert.equal(h.panels[1].hidden, false);
    h.query('Sep 2026');
    assert.equal(h.api().selected, null);
    h.query('Alpha');
    assert.equal(h.api().selected, 'product-entry-1');
    h.query('history');  // The selection button's label is not searchable data.
    assert.equal(h.api().selected, null);
    assert.equal(h.noMatches.hidden, false);
    assert.equal(h.noSelection.hidden, false);
    assert.equal(h.missing.hidden, true);
    assert.ok(h.panels.every(p => p.hidden));
    assert.equal(h.trends.at(-1), null);
    h.clear.fire('click');
    assert.equal(h.api().selected, 'product-entry-1');
    assert.equal(h.document.activeElement, h.search);
    assert.equal(h.clear.hidden, true);
});

test('selection and repeated filtering do not change scope, totals or unchanged history scroll', () => {
    const h = fixture(); h.run();
    h.rows[2].button.fire('click');
    assert.equal(h.api().selected, 'product-entry-3');
    assert.ok(h.rows.every(row => !row.hidden));
    assert.deepEqual(h.window.history.pushes, ['#product-entry-3']);
    h.reading.scrollTop = 123;
    const writes = h.status.writes;
    h.search.fire('input'); h.rows[2].button.fire('click');
    assert.equal(h.reading.scrollTop, 123);
    assert.equal(h.status.writes, writes);
    assert.equal(h.window.history.pushes.length, 1);
});

test('row actions preserve actual navigation links and enable nonlink selection', () => {
    const h = fixture(); h.run();
    h.rows[2].fire('click', {target: {closest: () => ({tagName: 'A'})}});
    assert.equal(h.api().selected, 'product-entry-1');
    h.rows[2].fire('click', {target: {closest: () => null}});
    assert.equal(h.api().selected, 'product-entry-3');
});

test('duplicate names keep distinct bucket entries and reuse the existing name-grouped history', () => {
    const h = fixture({names: ['Alpha', 'Alpha'], panelNames: ['Alpha']}); h.run();
    h.reading.scrollTop = 200; h.rows[1].button.fire('click');
    assert.equal(h.api().selected, 'product-entry-2');
    assert.equal(h.reading.scrollTop, 200);
    assert.equal(h.panels[0].hidden, false);
    assert.equal(h.status.textContent, '2 of 2 customer entries shown');
    assert.equal(h.rows[0].button.attributes['aria-pressed'], 'false');
    assert.equal(h.rows[1].button.attributes['aria-pressed'], 'true');
    h.document.activeElement = h.rows[1].button;
    h.query('Databases');
    assert.equal(h.document.activeElement, h.rows[0].button);
    assert.equal(h.reading.scrollTop, 200);
});

test('fragments and Back/Forward stay in search scope without preference writes', () => {
    const h = fixture({hash: '#product-entry-3'}); h.run();
    assert.equal(h.api().selected, 'product-entry-3');
    h.window.location.hash = '#product-entry-1'; h.window.listeners.popstate();
    assert.equal(h.api().selected, 'product-entry-1');
    h.window.location.hash = '#product-entry-3'; h.window.listeners.hashchange();
    assert.equal(h.api().selected, 'product-entry-3');
    h.query('Alpha');
    assert.equal(h.window.location.hash, '#product-entry-1');
    h.window.location.hash = '#product-entry-3'; h.window.listeners.popstate();
    assert.equal(h.api().selected, 'product-entry-1');
    assert.equal(h.window.location.hash, '#product-entry-1');
});

test('hiding focused history or an excluded selection returns focus to available content', () => {
    const h = fixture(); h.run();
    h.document.activeElement = h.panels[0]; h.query('Storage');
    assert.equal(h.document.activeElement, h.rows[2].button);
    assert.equal(h.document.activeElement.focusOptions.preventScroll, true);
    h.query('no match');
    assert.equal(h.document.activeElement, h.search);
});

test('browser-restored search fields reconcile after pageshow without changing global totals', () => {
    const h = fixture({hash: '#product-entry-3'}); h.run();
    h.window.listeners.pageshow();
    h.search.value = 'Alpha';  // Browser restoration occurs after the initial render.
    h.window.timers.shift()();
    assert.equal(h.api().selected, 'product-entry-1');
    assert.equal(h.status.textContent, '1 of 3 customer entries shown');
    assert.equal(h.window.location.hash, '#product-entry-1');
    assert.equal(h.panels[0].hidden, false);
    assert.equal(h.panels[1].hidden, true);
});

test('embedded and empty pages retain stacked reading rather than a miniature application', () => {
    const h = fixture({embedded: true}); h.run();
    h.query('Storage');
    assert.equal(h.root.dataset.sbProductEnhanced, undefined);
    assert.equal(h.api().selected, null);
    assert.ok(h.panels.every(p => !p.hidden));
    assert.ok(h.rows.every(row => row.button.hidden));
    assert.equal(h.trends.length, 0);
    assert.equal(h.status.writes, 0);
    assert.equal(h.api().select('product-entry-3'), false);
    assert.equal(h.notice.hidden, false);
    const empty = fixture({names: [], panelNames: []}); empty.run();
    assert.equal(empty.root.dataset.sbProductEnhanced, undefined);
    assert.equal(empty.status.textContent, '0 of 0 customer entries shown');
});

test('invalid identity keeps the full fallback available and invalid selections fail visibly', () => {
    const bad = fixture({panelNames: ['Orphan']});
    assert.throws(bad.run, /does not match/);
    assert.equal(bad.notice.hidden, false);
    assert.equal(bad.root.dataset.sbProductEnhanced, undefined);
    assert.equal(bad.panels[0].hidden, false);
    const h = fixture(); h.run();
    assert.throws(() => h.api().select('unknown'), /Unknown customer entry/);
    assert.equal(h.notice.hidden, false);
    h.query('Alpha');
    assert.equal(h.api().select('product-entry-3'), false);
    assert.match(h.notice.textContent, /outside the search results/);
    assert.equal(h.api().selected, 'product-entry-1');
});

test('other pages do not mount product controls and Help covers path products, not the directory', () => {
    vm.runInNewContext(source, {window: {}, document: {querySelector: () => null}});
    const help = fs.readFileSync(path.join(__dirname, '../../static/js/page-help.js'), 'utf8');
    for (const pathname of ['/product/SQL/Compute', '/revenue/product/Azure%20Synapse', '/products']) {
        const title = {}, body = {};
        vm.runInNewContext(help + '\nPageHelp.show();', {
            window: {location: {pathname}},
            document: {getElementById: id => id === 'pageHelpModalLabel' ? title : body},
            SBDialog: {toggle() {}},
        });
        if (pathname === '/products') assert.notEqual(title.textContent, 'Product Revenue');
        else {
            assert.equal(title.textContent, 'Product Revenue');
            assert.match(body.innerHTML, /customer\/bucket rows/);
            assert.match(body.innerHTML, /all entries and all imported months/);
        }
    }
});
