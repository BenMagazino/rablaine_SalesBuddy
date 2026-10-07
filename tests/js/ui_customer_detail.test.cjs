const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname,
    '../../static/js/ui-customer-detail.js'), 'utf8');
const {validateHistory} = require('../../static/js/ui-customer-detail.js');
const saved = () => ({id: 12, tab: 'cdNotes', context: 27, work: 180,
    scrolls: {cdNotes: 180}, search: 'fabric', fields: [['contextTextarea', 'draft']],
    removed: [], newContacts: [], contextOpen: true, contactsOpen: false});

function harness(history) {
    function element(extra = {}) {
        return {events: {}, attrs: {}, style: {}, scrollTop: 0, hidden: false,
            value: '', defaultValue: '', dataset: {}, isConnected: true,
            addEventListener(type, callback) {
                (this.events[type] ||= []).push(callback);
            },
            emit(type, event = {}) {
                return Promise.all((this.events[type] || []).map(callback => callback(event)));
            },
            setAttribute(key, value) { this.attrs[key] = value; },
            getAttribute(key) { return this.attrs[key]; },
            removeAttribute(key) { delete this.attrs[key]; },
            querySelector() { return null; }, querySelectorAll() { return []; },
            append() {}, prepend() {}, after() {}, focus() {}, replaceChildren() {},
            ...extra};
    }
    const context = element(), reading = element(), input = element({id: 'contextTextarea'});
    const panels = ['cdWorkstreams', 'cdNotes', 'cdPipeline', 'cdRevenue']
        .map(id => element({id}));
    const tabs = panels.map(panel => element({attrs: {'aria-controls': panel.id}}));
    const form = element({style: {display: 'none'}, action: '/customer/12/overview'});
    const submit = element();
    const display = element();
    form.querySelector = () => submit;
    reading.querySelectorAll = () => panels;
    const discard = element({open: false}), confirm = element(), description = element();
    const notice = element();
    const search = element();
    const ids = {
        '.cd-context': context, '.cd-reading': reading, '.cd-header': element(),
        '#contextTextarea': input, '#contextForm': form,
        '#contextDisplay p': display, '#contactsEditMode': element({style: {display: 'none'}}),
        '#contactsNewRows': element(), '#cdEssentials': element(), '#cdPipelineSearch': search,
    };
    const actions = {deletedContacts: () => [], clearDeletedContacts() {},
        toggleContextEdit() { form.style.display = 'block'; },
        cancelContextEdit() { form.style.display = 'none'; input.value = input.defaultValue; },
        toggleContactEdit() {}, cancelContactEdit() {}};
    const root = element({dataset: {sbCustomerDetail: '12'}, _customerActions: actions,
        querySelector: key => ids[key], querySelectorAll(key) {
            if (key === '#cdPipeline, #cdRevenue') return panels.slice(2);
            if (key === '[role="tab"]') return tabs;
            return [];
        }});
    const document = {
        createElement: () => notice,
        getElementById: id => ({recordDiscardDialog: discard,
            recordDiscardConfirm: confirm, recordDiscardDescription: description})[id],
    };
    const requests = [], destinations = [], events = {};
    const window = {document, history: {state: {unrelatedDraft: 'protected',
        ...(history ? {sbCustomerDetail: history} : {})},
        replaceState(value) { this.state = value; }},
        location: {href: 'http://localhost/customer/12',
            assign(value) { destinations.push(value); }, reload() { destinations.push('reload'); }},
        console, addEventListener(type, callback) { events[type] = callback; },
        fetch: async (url, options) => {
            requests.push({url, options});
            return {ok: false, status: 500, json: async () => ({error: 'Isolated failure'})};
        }};
    const SBDialog = {open(dialog) { dialog.open = true; },
        close(dialog) { dialog.open = false; }};
    vm.runInNewContext(source, {window, document, SBDialog, URL, FormData: class {}});
    const api = window.SBCustomerDetail.mount(root);
    return {window, root, api, input, reading, context, panels, tabs, form, submit,
        discard, confirm, description, notice, search, requests, destinations, events};
}

test('history rejects invalid raw coordinates and draft/output shapes', () => {
    assert.equal(validateHistory(saved(), 12).tab, 'cdNotes');
    for (const change of [
        {id: 99}, {fields: [['missing']]}, {removed: ['7']},
        {newContacts: [['name']]}, {work: NaN}, {context: -1},
        {scrolls: {cdNotes: Infinity}}, {scrolls: {other: 10}},
    ]) assert.throws(() => validateHistory({...saved(), ...change}, 12));
});
test('tabs own one visible region and retain independent reading positions', async () => {
    const h = harness();
    assert.deepEqual(h.panels.map(panel => panel.hidden), [false, true, true, true]);
    h.reading.scrollTop = 55;
    await h.tabs[1].emit('click');
    assert.equal(h.reading.scrollTop, 0);
    h.reading.scrollTop = 120;
    await h.tabs[0].emit('click');
    assert.equal(h.reading.scrollTop, 55);
    await h.tabs[1].emit('click');
    assert.equal(h.reading.scrollTop, 120);
    assert.equal(h.window.history.state.unrelatedDraft, 'protected');
    assert.equal(h.requests.length, 0);
});
test('Back restores actual tab, draft, filter and reading without autosaving', () => {
    const h = harness(saved());
    assert.equal(h.input.value, 'draft');
    assert.equal(h.form.style.display, 'block');
    assert.equal(h.context.scrollTop, 27);
    assert.equal(h.reading.scrollTop, 180);
    assert.equal(h.search.value, 'fabric');
    assert.equal(h.api.isDirty(), true);
    assert.equal(h.requests.length, 0);
});
test('native discard keeps draft until confirmation and preserves the exact destination', async () => {
    const h = harness();
    h.input.value = 'unsaved';
    assert.equal(h.api.navigate(() => h.destinations.push('/customer/12/edit')), false);
    assert.equal(h.discard.open, true);
    assert.equal(h.input.value, 'unsaved');
    await h.confirm.emit('click');
    assert.deepEqual(h.destinations, ['/customer/12/edit']);
    assert.equal(h.input.value, '');
    assert.equal(h.window.history.state.unrelatedDraft, 'protected');
});
test('failed context save retains exact input, reports failure and does not navigate', async () => {
    const h = harness();
    h.input.value = 'retained draft';
    await h.form.emit('submit', {preventDefault() {}, currentTarget: h.form});
    assert.equal(h.input.value, 'retained draft');
    assert.equal(h.api.isDirty(), true);
    assert.equal(h.notice.textContent, 'Isolated failure');
    assert.equal(h.submit.disabled, false);
    assert.equal(h.requests[0].options.method, 'POST');
    assert.equal(h.requests[0].options.headers['X-Requested-With'], 'XMLHttpRequest');
    assert.deepEqual(h.destinations, []);
});
test('pending requests guard navigation and reject a duplicate write', async () => {
    const h = harness();
    let finish;
    h.window.fetch = () => new Promise(resolve => { finish = resolve; });
    const first = h.window.SBCustomerDetail.request(h.root, '/contacts', {method: 'POST'});
    assert.equal(h.api.isBusy(), true);
    assert.equal(h.api.navigate(() => h.destinations.push('unsafe')), false);
    await assert.rejects(h.window.SBCustomerDetail.request(h.root, '/contacts',
        {method: 'POST'}), /still saving/);
    finish({ok: true, clone: () => ({text: async () => ''})});
    await first;
    assert.equal(h.api.isBusy(), false);
    assert.deepEqual(h.destinations, []);
});
test('write guards remain active while the successful response body is pending', async () => {
    const h = harness();
    let finishBody;
    h.window.fetch = async () => ({
        ok: true, clone: () => ({
            text: () => new Promise(resolve => { finishBody = resolve; }),
        }),
    });
    const first = h.window.SBCustomerDetail.request(h.root, '/contacts', {method: 'POST'});
    await Promise.resolve();
    assert.equal(h.api.isBusy(), true);
    assert.equal(h.api.navigate(() => h.destinations.push('unsafe')), false);
    await assert.rejects(h.window.SBCustomerDetail.request(h.root, '/contacts',
        {method: 'POST'}), /still saving/);
    finishBody('{}');
    await first;
    assert.equal(h.api.isBusy(), false);
    assert.deepEqual(h.destinations, []);
});
