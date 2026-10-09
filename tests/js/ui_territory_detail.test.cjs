const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../../static/js/ui-territory-detail.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-territory-detail.js'), 'utf8');

test('reading history keeps real territory identity, saved mode and independent panes', () => {
    for (const mode of ['accounts', 'notes']) {
        const value = {id: 7, mode, scrolls: {sellers: 100, work: 950}};
        assert.equal(api.validateHistory(value, 7, mode), value);
        for (const changed of [{id: 8}, {mode: 'invented'}, {scrolls: []},
            {scrolls: {unknown: 0}}, {scrolls: {work: -1}},
            {scrolls: {work: NaN}}, {scrolls: {work: '4'}}, {scrolls: null}]) {
            assert.throws(() => api.validateHistory({...value, ...changed}, 7, mode));
        }
    }
});
test('view command sends original exact POST and boolean payload in both modes', async () => {
    for (const accounts of [true, false]) {
        let call;
        await api.savePreference(async (...args) => {
            call = args;
            return {ok: true, json: async () => ({territory_view_accounts: accounts})};
        }, accounts);
        assert.equal(call[0], '/api/preferences/territory-view');
        assert.equal(call[1].method, 'POST');
        assert.deepEqual(call[1].headers, {'Content-Type': 'application/json'});
        assert.deepEqual(JSON.parse(call[1].body), {territory_view_accounts: accounts});
    }
});
test('network, JSON, HTTP and mismatched success never masquerade as a saved preference',
    async () => {
        for (const response of [{ok: false, data: {error: 'Unavailable'}},
            {ok: true, data: {territory_view_accounts: false}}, {ok: true, data: {}}]) {
            await assert.rejects(api.savePreference(async () => ({
                ok: response.ok, json: async () => response.data,
            }), true));
        }
        await assert.rejects(api.savePreference(async () => { throw Error('Network'); }, true));
        await assert.rejects(api.savePreference(async () => ({
            ok: true, json: async () => { throw Error('Invalid JSON'); },
        }), true));
    });

function fixture(saved, mode = 'accounts', fetcher = async () => ({
    ok: true, json: async () => ({territory_view_accounts: false}),
})) {
    const events = {}, errors = [], calls = [];
    const history = {state: {unrelated: 5, ...(saved ? {sbTerritoryDetail: saved} : {})},
        replaceState(value) { this.state = value; }};
    const regions = ['sellers', 'work'].map(key => ({
        dataset: {tdScroll: key}, scrollTop: 0, handlers: {},
        addEventListener(key, handler) { this.handlers[key] = handler; },
    }));
    const radios = ['notes', 'accounts'].map(value => ({
        value, id: value === 'accounts' ? 'viewAccounts' : 'viewCalls',
        checked: value === mode, disabled: false, handlers: {},
        addEventListener(key, handler) { this.handlers[key] = handler; },
    }));
    const notice = {hidden: true, textContent: ''}, status = {textContent: ''};
    const root = {dataset: {sbTerritoryDetail: '7', tdMode: mode},
        querySelectorAll(selector) {
            return selector === '[data-td-scroll]' ? regions : radios;
        },
        querySelector(selector) { return selector === '[data-td-notice]' ? notice : status; },
    };
    const document = {readyState: 'complete', querySelector() { return root; }};
    const window = {document, fetch: fetcher,
        location: {reload() { calls.push('reload'); }},
        addEventListener(key, handler) { events[key] = handler; }};
    vm.runInNewContext(source, {window, document, history,
        console: {error(...args) { errors.push(args); }},
        SBTableSort: {mount() { calls.push('sort'); }}});
    return {history, regions, radios, notice, status, events, errors, calls};
}
test('actual controller restores scroll and unrelated history through pagehide/pageshow', () => {
    const f = fixture({id: 7, mode: 'accounts', scrolls: {sellers: 75, work: 905}});
    assert.equal(f.regions[0].scrollTop, 75);
    assert.equal(f.regions[1].scrollTop, 905);
    f.regions[1].scrollTop = 800;
    f.events.pagehide();
    f.regions[1].scrollTop = 0;
    f.events.pageshow();
    assert.equal(f.regions[1].scrollTop, 800);
    assert.equal(f.history.state.unrelated, 5);
    assert.ok(f.calls.includes('sort'));
});
test('changed preference does not restore offsets from a different population', () => {
    const f = fixture({id: 7, mode: 'notes', scrolls: {sellers: 75, work: 905}});
    assert.equal(f.regions[1].scrollTop, 0);
    assert.equal(f.notice.hidden, true);
});
test('corrupt history shows honest warning without changing the population', () => {
    const f = fixture({id: 7, mode: 'accounts', scrolls: {work: -8}});
    assert.equal(f.notice.hidden, false);
    assert.match(f.notice.textContent, /Could not restore/);
    assert.equal(f.regions[1].scrollTop, 0);
});
test('pending preference guards duplicate writes and departure, then reloads on exact success',
    async () => {
        let resolve, writes = 0;
        const f = fixture(null, 'accounts', () => {
            writes++;
            return new Promise(done => { resolve = done; });
        });
        f.radios[0].checked = true;
        const saved = f.radios[0].handlers.change();
        assert.equal(f.radios.every(input => input.disabled), true);
        assert.equal(f.status.textContent, 'Saving view...');
        await f.radios[0].handlers.change();
        assert.equal(writes, 1);
        let prevented = false;
        f.events.beforeunload({preventDefault() { prevented = true; }});
        assert.equal(prevented, true);
        resolve({ok: true, json: async () => ({territory_view_accounts: false})});
        await saved;
        assert.equal(f.calls.at(-1), 'reload');
        prevented = false;
        f.events.beforeunload({preventDefault() { prevented = true; }});
        assert.equal(prevented, false);
    });
test('failed view restores original radio, unlocks retry and does not reload', async () => {
    const f = fixture(null, 'accounts', async () => { throw Error('Network'); });
    f.radios[0].checked = true;
    f.radios[1].checked = false;
    await f.radios[0].handlers.change();
    assert.equal(f.radios[1].checked, true);
    assert.equal(f.radios[0].checked, false);
    assert.equal(f.radios.every(input => !input.disabled), true);
    assert.equal(f.status.textContent, '');
    assert.match(f.notice.textContent, /current view is unchanged/);
    assert.ok(!f.calls.includes('reload'));
});
