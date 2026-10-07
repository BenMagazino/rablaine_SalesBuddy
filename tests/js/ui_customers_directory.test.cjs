const test = require('node:test');
const assert = require('node:assert/strict');
const {validateReading, post} = require('../../static/js/ui-customers-directory.js');

test('customer reading retains independent offsets and group scope, rejecting invalid state', () => {
    const reading = {top: 174.5, left: 8, expanded: ['seller-12', 'seller-unassigned']};
    assert.equal(validateReading(reading), reading);
    for (const value of [null, {}, {...reading, top: -1}, {...reading, left: Infinity},
        {...reading, top: '7'}, {...reading, expanded: [12]}]) {
        assert.throws(() => validateReading(value));
    }
});

test('manual preference and TPID calls preserve exact URLs/payloads and failures', async () => {
    const original = global.fetch, calls = [];
    try {
        global.fetch = async (url, options) => {
            calls.push({url, options});
            return {ok: true, json: async () => ({success: true})};
        };
        const inputs = [
            ['/api/preferences/customer-sort-by', {customer_sort_by: 'by_calls'}],
            ['/api/preferences/show-customers-without-calls',
                {show_customers_without_calls: false}],
            ['/api/customer/tpid-lookup', {tpid: '9000000001'}],
            ['/api/customer/tpid-import', {account: {tpid: 3, website: 'saved.example'}}],
        ];
        for (const [url, payload] of inputs) {
            await post(url, payload);
            const call = calls.at(-1);
            assert.equal(call.url, url);
            assert.equal(call.options.method, 'POST');
            assert.deepEqual(JSON.parse(call.options.body), payload);
        }
        global.fetch = async () => ({ok: false, json: async () => ({
            success: false, error: 'Already exists', existing_id: 77,
        })});
        await assert.rejects(post('/lookup', {tpid: '3'}),
            error => error.message === 'Already exists' && error.existingId === 77);
        global.fetch = async () => ({ok: true, json: async () => ({success: false})});
        await assert.rejects(post('/import', {}));
        global.fetch = async () => ({ok: true, json: async () => ({})});
        await assert.rejects(post('/api/customer/tpid-import', {}));
        global.fetch = async () => ({ok: true, json: async () => { throw Error('Bad JSON'); }});
        await assert.rejects(post('/import', {}), /Bad JSON/);
        global.fetch = async () => { throw Error('Offline'); };
        await assert.rejects(post('/import', {}), /Offline/);
    } finally { global.fetch = original; }
});

function harness() {
    const fs = require('node:fs'), vm = require('node:vm');
    class Element {
        constructor() {
            this.handlers = {}; this.value = ''; this.hidden = false; this.disabled = false;
            this.dataset = {}; this.scrollTop = 0; this.scrollLeft = 0; this.textContent = '';
        }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        async fire(type, extra = {}) {
            const event = {target: this, preventDefault() { this.defaultPrevented = true; },
                ...extra};
            for (const fn of this.handlers[type] || []) await fn(event);
            return event;
        }
        querySelectorAll() { return []; }
        closest() { return null; }
        append() {}
    }
    const fields = new Map(), field = name => {
        if (!fields.has(name)) fields.set(name, new Element());
        return fields.get(name);
    };
    const root = field('root'), document = new Element(), window = new Element();
    root.querySelector = field;
    root.dataset.showWithoutCalls = 'true';
    document.querySelector = () => root;
    document.getElementById = field;
    const history = {state: {unrelated: 9, sbCustomerDirectory: {
        top: 234, left: 4, expanded: [],
    }}, replaceState(value) { this.state = value; }};
    let reloads = 0;
    window.location = {reload() { reloads++; }, assign() {}};
    window.confirm = () => false;
    const requests = [];
    const fetch = (url, options) => new Promise((resolve, reject) =>
        requests.push({url, options, resolve, reject}));
    const localStorage = {getItem: () => null, setItem() {}};
    vm.runInNewContext(fs.readFileSync('static/js/ui-customers-directory.js', 'utf8'),
        {document, window, history, localStorage, fetch});
    return {field, root, document, window, history, requests, reloads: () => reloads};
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

test('mounted directory restores owned scroll and keeps URL-independent history fields', async () => {
    const h = harness(), reading = h.field('.sb-cust-reading');
    assert.equal(reading.scrollTop, 234);
    assert.equal(reading.scrollLeft, 4);
    reading.scrollTop = 912;
    await reading.fire('scroll');
    assert.equal(h.history.state.sbCustomerDirectory.top, 912);
    assert.equal(h.history.state.unrelated, 9);
});

test('TPID lookup/import are manual, guard busy/drafts and retain preview after save failure', async () => {
    const h = harness(), dialog = h.field('tpidImportModal');
    assert.equal(h.requests.length, 0);
    dialog.open = true;
    await dialog.fire('sb:dialog-opened');
    h.field('tpidInput').value = ' 77 ';
    assert.equal((await dialog.fire('sb:dialog-before-close')).defaultPrevented, true);
    h.field('tpidLookupBtn').fire('click');
    assert.equal(h.requests.length, 1);
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {tpid: '77'});
    assert.equal(h.field('tpidInput').disabled, true);
    assert.equal((await dialog.fire('sb:dialog-before-close')).defaultPrevented, true);
    const account = {tpid: 77, name: 'Exact customer', website: 'saved.example',
        territory_name: 'Exact territory', seller_name: 'Exact seller',
        vertical_category: 'Exact vertical'};
    h.requests[0].resolve({ok: true, json: async () => ({success: true, account})});
    await settle();
    assert.equal(h.field('previewVertical').textContent, 'Exact vertical');
    assert.equal(h.field('previewWebsite').textContent, 'saved.example');
    assert.equal(h.field('tpidStep2').hidden, false);
    h.field('tpidImportBtn').fire('click');
    h.field('tpidImportBtn').fire('click');
    assert.equal(h.requests.length, 2);
    assert.deepEqual(JSON.parse(h.requests[1].options.body), {account});
    h.requests[1].resolve({ok: false, json: async () => ({error: 'Save failed'})});
    await settle();
    assert.equal(h.field('tpidImportError').textContent, 'Save failed');
    assert.equal(h.field('tpidStep2').hidden, false);
    assert.equal(h.field('tpidInput').value, ' 77 ');
    h.field('tpidImportBtn').fire('click');
    h.requests[2].resolve({ok: true, json: async () => ({success: true,
        customer_id: 18, customer_name: 'Exact customer', seller_name: 'Exact seller',
        territory_name: 'Exact territory'})});
    await settle();
    assert.equal(h.field('tpidViewBtn').href, '/customer/18');
    assert.equal(h.field('tpidStep3').hidden, false);
    assert.equal((await dialog.fire('sb:dialog-before-close')).defaultPrevented, undefined);
    assert.equal(h.reloads(), 0);
});

test('failed preference writes remain visibly failed without reloading or changing history', async () => {
    const h = harness();
    h.field('toggleShowWithoutCalls').fire('click');
    assert.deepEqual(JSON.parse(h.requests[0].options.body),
        {show_customers_without_calls: false});
    h.requests[0].reject(Error('Offline'));
    await settle();
    assert.match(h.field('[data-customer-notice]').textContent, /not saved.*Offline/);
    assert.equal(h.reloads(), 0);
    assert.equal(h.history.state.sbCustomerDirectory.top, 234);
});
