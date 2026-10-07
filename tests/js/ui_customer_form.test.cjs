const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').resolve(__dirname,
    '../../static/js/ui-milestone-form.js'), 'utf8');
const fields = ['referrer', 'name', 'nickname', 'tpid', 'tpid_url', 'website',
    'seller_id', 'territory_id', 'csam_id'];
function harness({saved, posted = false, badHistory = false, key = 'edit-107'} = {}) {
    const element = (extra = {}) => ({events: {}, value: '', disabled: false, hidden: true,
        scrollTop: 0, innerHTML: 'Save Customer', attrs: {}, validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, ...extra});
    const elements = Object.fromEntries(fields.map(name => [name, element()]));
    Object.assign(elements.name, {value: 'Original'});
    elements.tpid.value = '1008555';
    elements.seller_id.value = '3';
    elements.territory_id.value = '11';
    const ids = Object.fromEntries(['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm']
        .map(name => ['customerForm' + name, element()]));
    const reading = element(), sellerSave = element();
    const seller = element({elements: {name: element()},
        querySelector: () => sellerSave});
    const options = [element({value: '3', defaultSelected: true, style: {display: ''}}),
        element({value: 'other', style: {display: 'none'}})];
    elements.seller_id.options = options;
    const form = element({elements, dataset: {formKey: key, posted: String(posted)},
        querySelectorAll: () => options, querySelector: () => reading});
    ids.customerForm = form;
    const events = {}, clicks = {}, destinations = [], errors = [];
    const root = {document: {getElementById: id => ids[id],
        querySelector: () => seller, addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {otherDraft: 123, ...(saved ? {sbCustomerForm: saved} : {})},
            replaceState(value) { if (badHistory) throw Error('Unavailable'); this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }},
        console: {error(...args) { errors.push(args); }}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, events, clicks, destinations, elements, reading, errors,
        seller, sellerSave, options};
}
const event = (target = {}) => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const link = (href = '/customers') => event({closest: () => ({href, target: '',
    hasAttribute: () => false, getAttribute: () => href})});
test('customer Back restores every field and scroll without storage/provider writes', () => {
    const h = harness();
    for (const [name, field] of Object.entries(h.elements)) field.value = 'draft-' + name;
    h.form.events.change(event(h.elements.csam_id));
    h.reading.scrollTop = 82;
    h.reading.events.scroll();
    h.elements.name.value = '';
    h.events.pageshow();
    assert.equal(h.elements.name.value, 'draft-name');
    assert.equal(h.elements.csam_id.value, 'draft-csam_id');
    assert.equal(h.reading.scrollTop, 82);
    assert.equal(h.options[1].style.display, 'none');
    assert.equal(h.form.dataset.draftRestored, 'true');
    assert.equal(h.root.history.state.otherDraft, 123);
});
test('customer Cancel guard preserves destination; discard cleans only this draft', () => {
    const h = harness();
    h.elements.nickname.value = 'QA';
    h.form.events.input(event(h.elements.nickname));
    const leave = link();
    h.clicks.click(leave);
    assert.equal(leave.prevented, true);
    assert.equal(h.ids.customerFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.customerFormDiscard);
    assert.equal(h.elements.nickname.value, 'QA');
    h.clicks.click(link());
    h.ids.customerFormDiscardConfirm.events.click();
    assert.deepEqual(h.destinations, ['/customers']);
    assert.equal(h.elements.nickname.value, '');
    assert.equal(h.root.history.state.sbCustomerForm, undefined);
    assert.equal(h.root.history.state.otherDraft, 123);
});
test('native save retains enabled payloads, blocks duplicate and pending navigation', () => {
    const h = harness();
    const save = event();
    h.form.events.submit(save);
    assert.equal(save.prevented, false);
    assert.equal(h.form.inert, true);
    assert.equal(h.ids.customerFormSave.disabled, true);
    assert.ok(Object.values(h.elements).every(e => !e.disabled));
    const duplicate = event();
    h.form.events.submit(duplicate);
    assert.equal(duplicate.prevented, true);
    const leave = link();
    h.clicks.click(leave);
    assert.equal(leave.prevented, true);
    h.events.pageshow();
    assert.equal(h.form.inert, false);
    assert.equal(h.ids.customerFormSave.disabled, false);
});
test('server failure takes precedence over stale Back history', () => {
    const stale = harness();
    stale.form.events.input(event(stale.elements.name));
    const saved = stale.root.history.state.sbCustomerForm;
    saved.fields.name = 'stale';
    const h = harness({saved, posted: true});
    assert.equal(h.elements.name.value, 'Original');
    const unload = event();
    h.events.beforeunload(unload);
    assert.equal(unload.prevented, true);
});
test('record and role mismatch or failed history visibly report recovery limits', () => {
    const original = harness();
    original.form.events.input(event(original.elements.name));
    const saved = original.root.history.state.sbCustomerForm;
    assert.equal(harness({saved, key: 'edit-108'}).errors.length, 1);
    assert.equal(harness({saved, key: 'edit-107-seller-3'}).errors.length, 1);
    const h = harness({badHistory: true});
    h.form.events.input(event(h.elements.name));
    assert.equal(h.errors.length, 1);
    assert.match(h.ids.customerFormNotice.textContent, /Keep this page open/);
});
test('native invalid fields show an error and correction clears it', () => {
    const h = harness();
    h.elements.tpid.validationMessage = 'TPID required';
    h.form.events.invalid(event(h.elements.tpid));
    assert.equal(h.elements.tpid.attrs['aria-invalid'], 'true');
    assert.equal(h.ids.customerFormNotice.textContent, 'TPID required');
    h.form.events.input(event(h.elements.tpid));
    assert.equal(h.elements.tpid.attrs['aria-invalid'], undefined);
    assert.equal(h.ids.customerFormNotice.hidden, true);
});
test('inline seller draft guards leave and submit is manual, single and recoverable', () => {
    const h = harness();
    h.seller.elements.name.value = 'Draft seller';
    h.seller.events.input();
    const leave = link();
    h.clicks.click(leave);
    assert.equal(leave.prevented, true);
    const first = event(), second = event();
    h.seller.events.submit(first);
    h.seller.events.submit(second);
    assert.equal(first.prevented, false);
    assert.equal(second.prevented, true);
    assert.equal(h.sellerSave.disabled, true);
    h.events.pageshow();
    assert.equal(h.sellerSave.disabled, false);
    assert.equal(h.seller.elements.name.value, 'Draft seller');
});
