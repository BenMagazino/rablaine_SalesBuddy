const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,
    '../../static/js/ui-fabric-consumption.js'), 'utf8');

function harness(hidden = true, revenueState = null, fail = false) {
    const elements = new Map();
    function element() {
        return {hidden: false, dataset: {}, events: {}, style: {},
            setAttribute() {}, removeAttribute() {},
            append() {}, replaceChildren() {}, replaceWith() {},
            cloneNode: element, querySelector: element, querySelectorAll: () => [],
            addEventListener(name, callback) { this.events[name] = callback; }};
    }
    for (const name of ['detail', 'error', 'detail-body', 'customer-title', 'detail-state',
        'freshness', 'revenue', 'capacity-select', 'series-prev', 'series-next',
        'operations-prev', 'operations-next', 'capacity-detail-state', 'capacity-summary',
        'capacity-chart', 'capacity-metrics', 'series-page', 'series']) {
        elements.set(name, element());
    }
    const panel = {hidden};
    const root = {dataset: {fabricCustomerId: '42', reportUrl: '/api/reports/fabric-consumption'},
        closest: () => panel,
        querySelector(selector) {
            return elements.get(selector.match(/data-fabric-(.+)\]/)[1]) ?? null;
        }};
    const requests = [], saves = [], imports = [], revenues = [];
    const history = {state: {sbCustomerDetail: {tab: 'cdFabric', work: 120}},
        replaceState(state, _, url) { saves.push({state, url: String(url)}); }};
    let observe;
    const context = {URL, console,
        location: {href: 'http://localhost/customer/42?customer_id=99', origin: 'http://localhost'},
        history,
        document: {querySelector: () => root, createElement: element},
        MutationObserver: class {
            constructor(callback) { observe = callback; }
            observe(target, options) {
                assert.equal(target, panel);
                assert.deepEqual(Array.from(options.attributeFilter), ['hidden']);
            }
        },
        fetch: async url => {
            requests.push(String(url));
            if (fail) throw new Error('Saved snapshot unavailable');
            return {ok: true, json: async () => ({success: true, snapshot: null,
                customers: [], customer: {id: 42, name: 'Pinned customer', tpid: 123,
                    revenue: revenueState ? {state: revenueState} : null,
                    status: 'no_data', capacities: []}})};
        },
        window: {
            SBFabricPreferences: {
                customerSelection() { throw new Error('Embedded tabs must not use report selection'); },
                bindCheckbox() { throw new Error('Embedded tabs have no directory filters'); },
            },
            SBFabricCapacityLabel: {close() {}},
            SBFabricRevenue: {render(_, customer) { revenues.push(customer); }},
            SBFabricImport: {create(target) {
                imports.push(target);
                return {setImportedAt() {}};
            }},
        }};
    vm.runInNewContext(source, context);
    return {root, panel, elements, requests, history, saves, imports, revenues, observe,
        flush: () => new Promise(resolve => setImmediate(resolve))};
}

test('customer Fabric is lazy, pinned to its host and independent of report selection', async () => {
    const h = harness();
    assert.equal(h.requests.length, 0);
    assert.equal(h.imports.length, 0);
    h.panel.hidden = false;
    h.observe();
    await h.flush();
    assert.equal(h.requests.length, 1);
    assert.equal(new URL(h.requests[0]).searchParams.get('customer_id'), '42');
    assert.equal(h.imports.length, 0);
    assert.equal(h.revenues[0].id, 42);
    assert.equal(h.elements.get('error').textContent, '');
    assert.equal(h.elements.get('detail-state').hidden, true);
    assert.equal(h.root.hidden, true);
    assert.equal(h.elements.get('revenue').hidden, true);
});

test('a restored Fabric tab reads immediately without starting an import observer', async () => {
    const h = harness(false);
    await h.flush();
    assert.equal(h.requests.length, 1);
    h.panel.hidden = true;
    h.observe();
    assert.equal(h.requests.length, 1);
    h.panel.hidden = false;
    h.observe();
    await h.flush();
    assert.equal(h.requests.length, 2);
    assert.equal(h.imports.length, 0);
});

test('customer revenue remains visible without Fabric telemetry', async () => {
    const h = harness(false, 'available');
    await h.flush();
    assert.equal(h.root.hidden, false);
    assert.equal(h.elements.get('revenue').hidden, false);
    assert.equal(h.elements.get('detail-body').hidden, true);
});

test('absent customer revenue hides while invalid saved states remain visible', async () => {
    for (const state of ['not_imported', 'no_data', 'invalid']) {
        const h = harness(false, state);
        await h.flush();
        assert.equal(h.root.hidden, state !== 'invalid');
        assert.equal(h.elements.get('revenue').hidden, state !== 'invalid');
    }
});

test('saved-data read errors remain visible even when there is no data', async () => {
    const h = harness(false, null, true);
    await h.flush();
    assert.equal(h.root.hidden, false);
    assert.equal(h.elements.get('error').hidden, false);
    assert.match(h.elements.get('error').textContent, /Saved snapshot unavailable/);
});

test('capacity changes preserve the customer reading history', async () => {
    const h = harness(false);
    await h.flush();
    h.elements.get('capacity-select').value = 'tenant|capacity';
    h.elements.get('capacity-select').events.change();
    assert.equal(h.saves[0].state, h.history.state);
    assert.equal(new URL(h.saves[0].url).searchParams.get('capacity'), 'tenant|capacity');
});
