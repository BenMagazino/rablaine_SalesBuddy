const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {saveSelection, validateView} = require('../../static/js/ui-pod-form.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-pod-form.js'), 'utf8');
function harness({fetcher = async () => ({ok: true, json: async () => ({success: true})}),
    history, empty = false, detail = false} = {}) {
    const element = extra => ({events: {}, hidden: true, attrs: {},
        prepend() {},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, ...extra});
    const retry = element(), result = element(), reading = element({scrollTop: 0});
    let badge;
    const select = element({id: 'dss-1-1', value: '', selectedIndex: 1, dataset: {
        dssTerritory: '1', dssSpecialty: 'Security'},
        options: [{value: '', text: 'Select'}, {value: '2', text: 'DSS'}],
        before(node) { badge = node; },
        parentElement: {querySelector: s => s === '[data-dss-retry]' ? retry
            : s === '[data-pod-saved-choice]' ? badge : result}});
    const back = element(), ids = {};
    ids.podForm = element({dataset: {podId: '7', ...(detail ? {podDetail: ''} : {})},
        querySelector: s => s === '[data-pod-back]' ? back : reading,
        querySelectorAll: () => empty ? [] : [select]});
    ['podFormNotice', 'podFormState', 'podFormDiscard', 'podFormDiscardConfirm']
        .forEach(id => { ids[id] = element(); });
    const events = {}, clicks = {}, destinations = [], calls = [];
    const root = {document: {getElementById: id => ids[id], querySelector: () => null,
        createElement: () => element({dataset: {}}),
        addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {untouched: 4, ...(history ? {sbPodForm: history} : {})},
            replaceState(value) { this.state = value; }},
        fetch: (...args) => { calls.push(args); return fetcher(...args); },
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console: {error() {}}};
    vm.runInNewContext(source, {window: root});
    return {root, ids, events, clicks, select, reading, retry, result, calls, destinations};
}
const event = target => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/pod/7', target: '',
    hasAttribute: () => false, getAttribute: () => '/pod/7'})});
test('exact existing territory API, string ID and null clear payload', async () => {
    const calls = [];
    const fetcher = async (...args) => { calls.push(args); return {
        ok: true, json: async () => ({success: true})}; };
    await saveSelection(fetcher, 3, 'Security', '22');
    await saveSelection(fetcher, 3, 'Security', '');
    assert.equal(calls[0][0], '/territory/3/dss-selection');
    assert.equal(calls[0][1].method, 'POST');
    assert.deepEqual(JSON.parse(calls[0][1].body),
        {specialty: 'Security', solution_engineer_id: '22'});
    assert.equal(JSON.parse(calls[1][1].body).solution_engineer_id, null);
});
test('HTTP, application, malformed JSON and network failures never report saved', async () => {
    for (const fetcher of [
        async () => ({ok: false, json: async () => ({error: 'failure'})}),
        async () => ({ok: true, json: async () => ({success: false})}),
        async () => ({ok: true, json: async () => { throw Error('JSON'); }}),
        async () => { throw Error('network'); },
    ]) await assert.rejects(saveSelection(fetcher, 1, 'Security', '2'));
});
test('mount and Back restore drafts without autosaving restored selections', () => {
    const h = harness({history: {id: 7, scroll: 50, collapsed: false,
        choices: {'dss-1-1': {value: '2', saved: ''}}}});
    assert.equal(h.select.value, '2');
    assert.equal(h.reading.scrollTop, 50);
    assert.equal(h.calls.length, 0);
    assert.equal(h.retry.hidden, false);
    assert.equal(h.ids.podFormState.textContent, 'Unsaved assignments');
    assert.equal(h.root.history.state.untouched, 4);
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.equal(h.ids.podFormDiscard.open, true);
    h.ids.podFormDiscardConfirm.events.click();
    assert.equal(h.select.value, '');
    assert.deepEqual(h.destinations, ['/pod/7']);
    assert.equal(h.calls.length, 0);
});
test('pending save blocks duplicate change and navigation; success makes clean', async () => {
    let finish;
    const h = harness({fetcher: () => new Promise(resolve => { finish = resolve; })});
    h.select.value = '2';
    const save = h.select.events.change();
    h.select.events.change();
    assert.equal(h.calls.length, 1);
    assert.equal(h.select.disabled, true);
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.equal(h.ids.podFormDiscard.open, undefined);
    const unload = event();
    h.events.beforeunload(unload);
    assert.equal(unload.prevented, true);
    finish({ok: true, json: async () => ({success: true})});
    await save;
    assert.equal(h.select.disabled, false);
    assert.equal(h.result.textContent, 'Saved');
    assert.equal(h.ids.podFormState.textContent, 'Assignments up to date');
    const clean = leave();
    h.clicks.click(clean);
    assert.equal(clean.prevented, false);
});
test('failure retains the draft; retry saves it with no identity or relationship changes', async () => {
    let failed = true;
    const h = harness({fetcher: async () => ({ok: !failed,
        json: async () => ({success: !failed, error: 'storage'})})});
    h.select.value = '2';
    await h.select.events.change();
    assert.equal(h.select.value, '2');
    assert.equal(h.select.disabled, false);
    assert.equal(h.retry.hidden, false);
    assert.equal(h.select.attrs['aria-invalid'], 'true');
    const unload = event();
    h.events.beforeunload(unload);
    assert.equal(unload.prevented, true);
    failed = false;
    await h.retry.events.click();
    assert.equal(h.retry.hidden, true);
    assert.equal(h.select.attrs['aria-invalid'], undefined);
});
test('malformed and unavailable drafts show honest feedback without a network write', () => {
    assert.throws(() => validateView({id: 7}, 7, ['dss-1-1']));
    const h = harness({history: {id: 7, scroll: 1, collapsed: false,
        choices: {'dss-1-1': {value: '9', saved: ''}}}});
    assert.equal(h.select.value, '');
    assert.match(h.ids.podFormNotice.textContent, /Could not restore/);
    assert.equal(h.calls.length, 0);
});
test('empty synced POD safely initializes without a disclosure or any business request', () => {
    const h = harness({empty: true});
    h.events.pageshow();
    h.reading.events.scroll();
    assert.equal(h.ids.podFormNotice.hidden, true);
    assert.equal(h.ids.podFormState.textContent, 'Assignments up to date');
    assert.equal(h.calls.length, 0);
});
test('detail success becomes a static name; failed detail choice remains retryable', async () => {
    const h = harness({detail: true});
    h.select.hidden = false;
    h.select.value = '2';
    await h.select.events.change();
    assert.equal(h.select.hidden, true);
    assert.equal(h.select.parentElement.querySelector('[data-pod-saved-choice]').textContent, 'DSS');
    const failed = harness({detail: true, fetcher: async () => {
        throw Error('network');
    }});
    failed.select.hidden = false;
    failed.select.value = '2';
    await failed.select.events.change();
    assert.equal(failed.select.hidden, false);
    assert.equal(failed.retry.hidden, false);
    assert.equal(failed.select.value, '2');
});
