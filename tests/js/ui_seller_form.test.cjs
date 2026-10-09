const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {matches} = require('../../static/js/ui-seller-form.js');
const {validateSellerView} = require('../../static/js/ui-milestone-form.js');
const source = fs.readFileSync(path.resolve(__dirname,
    '../../static/js/ui-milestone-form.js'), 'utf8');
function harness({posted = false, saved} = {}) {
    const element = (extra = {}) => ({events: {}, value: '', disabled: false,
        hidden: true, scrollTop: 0, innerHTML: 'Save Seller', attrs: {},
        validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; }, ...extra});
    const elements = {name: element({value: 'Original'}), alias: element({value: 'alias'}),
        seller_type: element({value: 'Growth'})};
    const reading = element(), inlineSave = element();
    const inline = element({elements: {name: element()},
        querySelector: () => inlineSave});
    const form = element({elements, dataset: {formKey: 'edit-7', posted: String(posted)},
        querySelector: () => reading});
    const ids = Object.fromEntries(['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm']
        .map(suffix => ['sellerForm' + suffix, element()]));
    Object.assign(ids, {sellerForm: form, territory_search: element()});
    const events = {}, clicks = {}, destinations = [];
    let selected = ['11'];
    const root = {document: {getElementById: id => ids[id],
        querySelector: () => inline, addEventListener(type, fn) { clicks[type] = fn; }},
        SBSellerTerritories: {ids: () => [...selected], restore(value) { selected = [...value]; }},
        history: {state: {untouched: 5, ...(saved ? {sbSellerForm: saved} : {})},
            replaceState(value) { this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(dialog) { dialog.open = true; }, close(dialog) { dialog.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console: {error() {}}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, elements, events, clicks, destinations, reading,
        inline, inlineSave, choose(values) { selected = values; }};
}
const event = (target = {}) => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/sellers', target: '',
    hasAttribute: () => false, getAttribute: () => '/sellers'})});
test('territory matching ignores case/whitespace and excludes every selected ID', () => {
    const choices = [{id: 1, name: 'East'}, {id: 2, name: "O'Brien East"}];
    assert.deepEqual(matches(choices, '  EAST ', ['1']), [choices[1]]);
    assert.deepEqual(matches(choices, '', []), []);
});
test('seller history validates exact entry and all dynamic choice and inline fields', () => {
    const value = {key: 'new', fields: {name: '', alias: '', seller_type: 'Growth'},
        checked: ['1'], scroll: 0, noteScroll: 0, territoryName: '', territorySearch: ''};
    assert.equal(validateSellerView(value, 'new', ['name', 'alias', 'seller_type']), value);
    assert.throws(() => validateSellerView(value, 'edit-1', ['name']));
    assert.throws(() => validateSellerView({...value, territoryName: null}, 'new', ['name']));
});
test('Back restores complete seller, repeated IDs, inline draft, search and reading', () => {
    const h = harness();
    h.elements.name.value = 'Draft';
    h.elements.alias.value = 'draft@microsoft.com';
    h.elements.seller_type.value = 'Acquisition';
    h.choose(['11', '12']);
    h.inline.elements.name.value = 'Inline draft';
    h.ids.territory_search.value = 'East';
    h.reading.scrollTop = 90;
    h.form.events.change(event());
    h.elements.name.value = '';
    h.choose([]);
    h.events.pageshow();
    assert.equal(h.elements.name.value, 'Draft');
    assert.equal(h.elements.alias.value, 'draft@microsoft.com');
    assert.equal(h.elements.seller_type.value, 'Acquisition');
    assert.deepEqual(h.root.SBSellerTerritories.ids(), ['11', '12']);
    assert.equal(h.inline.elements.name.value, 'Inline draft');
    assert.equal(h.ids.territory_search.value, 'East');
    assert.equal(h.reading.scrollTop, 90);
    assert.equal(h.root.history.state.untouched, 5);
});
test('choice-only drafts guard Cancel; discard restores fields and choices only', () => {
    const h = harness();
    h.choose([]);
    h.form.events.change(event());
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.equal(h.ids.sellerFormDiscard.open, true);
    h.ids.sellerFormDiscardConfirm.events.click();
    assert.deepEqual(h.root.SBSellerTerritories.ids(), ['11']);
    assert.equal(h.root.history.state.sbSellerForm, undefined);
    assert.equal(h.root.history.state.untouched, 5);
    assert.deepEqual(h.destinations, ['/sellers']);
});
test('native main and inline submits preserve payloads and prevent duplicates', () => {
    for (const inline of [false, true]) {
        const h = harness();
        const active = inline ? h.inline : h.form;
        active.events.submit(event());
        assert.equal(h.form.inert, true);
        assert.ok(Object.values(h.elements).every(field => !field.disabled));
        const second = event();
        active.events.submit(second);
        assert.equal(second.prevented, true);
        const navigation = leave();
        h.clicks.click(navigation);
        assert.equal(navigation.prevented, true);
        h.events.pageshow();
        assert.equal(h.form.inert, false);
        assert.equal(h.inlineSave.disabled, false);
        assert.equal(h.ids.sellerFormSave.disabled, false);
    }
});
test('server failures override stale history and native invalid state clears', () => {
    const original = harness();
    original.elements.name.value = 'Stale';
    original.form.events.input(event(original.elements.name));
    const h = harness({posted: true, saved: original.root.history.state.sbSellerForm});
    assert.equal(h.elements.name.value, 'Original');
    h.elements.name.validationMessage = 'Name required';
    h.form.events.invalid(event(h.elements.name));
    assert.equal(h.ids.sellerFormNotice.textContent, 'Name required');
    h.form.events.input(event(h.elements.name));
    assert.equal(h.ids.sellerFormNotice.hidden, true);
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
});
