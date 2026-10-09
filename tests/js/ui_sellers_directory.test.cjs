const test = require('node:test');
const assert = require('node:assert/strict');
const {activate, validateReading} = require('../../static/js/ui-sellers-directory.js');

test('seller reading preserves independent offsets and expansion IDs', () => {
    const state = {top: 154, left: 4, expanded: ['14', '3']};
    assert.equal(validateReading(state), state);
    for (const input of [null, {}, {...state, top: -1}, {...state, left: Infinity},
        {...state, top: '1'}, {...state, expanded: [14]}]) {
        assert.throws(() => validateReading(input));
    }
});

test('View as uses the exact existing seller-mode API and validates its actual output', async () => {
    const original = global.fetch, calls = [];
    try {
        global.fetch = async (url, options) => {
            calls.push({url, options});
            return {ok: true, json: async () => ({seller_mode: true, seller_id: 14})};
        };
        assert.deepEqual(await activate('14'), {seller_mode: true, seller_id: 14});
        assert.deepEqual(calls, [{
            url: '/api/seller-mode/activate/14', options: {method: 'POST'},
        }]);
        for (const result of [{}, {success: true}, {seller_mode: false, seller_id: 14},
            {seller_mode: true, seller_id: 15}]) {
            global.fetch = async () => ({ok: true, json: async () => result});
            await assert.rejects(activate('14'), /did not confirm/);
        }
        global.fetch = async () => ({ok: false, json: async () => ({error: 'Not found'})});
        await assert.rejects(activate('14'), /Not found/);
        global.fetch = async () => { throw Error('Offline'); };
        await assert.rejects(activate('14'), /Offline/);
        global.fetch = async () => ({ok: true, json: async () => { throw Error('Bad JSON'); }});
        await assert.rejects(activate('14'), /Bad JSON/);
    } finally { global.fetch = original; }
});

function harness() {
    const fs = require('node:fs'), vm = require('node:vm');
    class Element {
        constructor() {
            this.handlers = {}; this.dataset = {}; this.disabled = false;
            this.hidden = false; this.open = false; this.textContent = '';
            this.scrollTop = 0; this.scrollLeft = 0; this.attributes = {};
        }
        addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
        async fire(type, extra = {}) {
            const event = {target: this, preventDefault() { this.defaultPrevented = true; },
                ...extra};
            for (const handler of this.handlers[type] || []) await handler(event);
            return event;
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        closest() { return null; }
    }
    const elements = new Map(), field = key => {
        if (!elements.has(key)) elements.set(key, new Element());
        return elements.get(key);
    };
    const root = field('root'), document = new Element(), window = new Element();
    const records = ['14', '3'].map(id => {
        const record = new Element(); record.dataset.sellerId = id; return record;
    });
    const buttons = ['14', '3'].map(id => {
        const button = new Element(); button.dataset.viewAs = id;
        button.closest = selector => selector === '[data-view-as]' ? button : null;
        return button;
    });
    root.querySelector = field;
    root.querySelectorAll = selector => selector === '[data-seller-id]' ? records : buttons;
    field('#toggleAllBtn').querySelector = field;
    document.querySelector = () => root;
    const history = {state: {unrelated: 9, sbTableSort: {keep: 1}, sbSellersDirectory: {
        top: 234, left: 4, expanded: ['14'],
    }}, replaceState(value) { this.state = value; }};
    const navigations = [], requests = [];
    window.location = {assign(url) { navigations.push(url); }};
    const fetch = (url, options) => new Promise((resolve, reject) =>
        requests.push({url, options, resolve, reject}));
    vm.runInNewContext(fs.readFileSync('static/js/ui-sellers-directory.js', 'utf8'),
        {document, window, history, fetch});
    return {field, root, document, window, history, records, buttons, requests, navigations};
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

test('mounted directory restores reading, expands/collapses all and preserves sorter history', async () => {
    const h = harness(), reading = h.field('.sb-sellers-reading');
    assert.equal(reading.scrollTop, 234);
    assert.equal(reading.scrollLeft, 4);
    assert.deepEqual(h.records.map(record => record.open), [true, false]);
    assert.equal(h.requests.length, 0);
    await h.field('#toggleAllBtn').fire('click');
    assert.deepEqual(h.records.map(record => record.open), [true, true]);
    assert.equal(h.field('#toggleAllBtn').attributes['aria-expanded'], 'true');
    await h.field('#toggleAllBtn').fire('click');
    assert.deepEqual(h.records.map(record => record.open), [false, false]);
    assert.equal(h.field('span').textContent, 'Expand All');
    reading.scrollTop = 912;
    await reading.fire('scroll');
    assert.equal(h.history.state.sbSellersDirectory.top, 912);
    assert.equal(h.history.state.unrelated, 9);
    assert.equal(h.history.state.sbTableSort.keep, 1);
});

test('pending View as is deduplicated and guarded, failures retain context, success leaves cleanly', async () => {
    const h = harness();
    const event = {target: h.buttons[0]};
    h.root.fire('click', event);
    h.root.fire('click', event);
    assert.equal(h.requests.length, 1);
    assert(h.buttons.every(button => button.disabled));
    assert.equal((await h.window.fire('beforeunload')).defaultPrevented, true);
    const link = {closest: selector => selector === 'a[href]' ? {} : null};
    assert.equal((await h.document.fire('click', {target: link})).defaultPrevented, true);
    h.requests[0].resolve({ok: false, json: async () => ({error: 'Failed'})});
    await settle();
    assert(h.buttons.every(button => !button.disabled));
    assert.equal(h.navigations.length, 0);
    assert.match(h.field('.sb-seller-notice').textContent, /Failed/);
    assert.equal(h.field('.sb-seller-notice').hidden, false);
    assert.equal(h.field('.sb-sellers-reading').scrollTop, 234);
    h.root.fire('click', event);
    h.requests[1].resolve({ok: true, json: async () => ({seller_mode: true, seller_id: 14})});
    await settle();
    assert.deepEqual(h.navigations, ['/']);
    assert.equal((await h.window.fire('beforeunload')).defaultPrevented, undefined);
});
