const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname,
    '../../static/js/ui-milestone-form.js'), 'utf8');
function harness({posted = false, saved} = {}) {
    const element = (extra = {}) => ({events: {}, value: '', disabled: false,
        hidden: true, scrollTop: 0, innerHTML: 'Save Territory', attrs: {},
        validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; }, ...extra});
    const name = element({value: 'Original'}), reading = element(), cancel = element();
    const form = element({elements: {name}, dataset: {formKey: 'edit-7', posted: String(posted)},
        querySelector: selector => selector === '[data-territory-cancel]' ? cancel : reading});
    const ids = Object.fromEntries(['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm']
        .map(suffix => ['territoryForm' + suffix, element()]));
    ids.territoryForm = form;
    const events = {}, clicks = {}, destinations = [];
    const root = {document: {getElementById: id => ids[id],
        querySelector: () => null, addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {untouched: 5, ...(saved ? {sbTerritoryForm: saved} : {})},
            replaceState(value) { this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(dialog) { dialog.open = true; }, close(dialog) { dialog.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console: {error() {}}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, name, events, clicks, destinations, reading, cancel};
}
const event = (target = {}) => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/territories', target: '',
    hasAttribute: () => false, getAttribute: () => '/territories'})});
test('Back restores the name and reading position without altering other history', () => {
    const h = harness();
    h.name.value = 'Draft';
    h.reading.scrollTop = 90;
    h.form.events.input(event(h.name));
    h.name.value = '';
    h.events.pageshow();
    assert.equal(h.name.value, 'Draft');
    assert.equal(h.reading.scrollTop, 90);
    assert.equal(h.root.history.state.untouched, 5);
    assert.equal(h.ids.territoryFormState.textContent, 'Unsaved changes');
});
test('Cancel guards dirty entries; discard restores only this entry and original name', () => {
    const h = harness();
    h.name.value = 'Draft';
    h.form.events.input(event(h.name));
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.equal(h.ids.territoryFormDiscard.open, true);
    h.ids.territoryFormDiscardConfirm.events.click();
    assert.equal(h.name.value, 'Original');
    assert.equal(h.root.history.state.sbTerritoryForm, undefined);
    assert.equal(h.root.history.state.untouched, 5);
    assert.deepEqual(h.destinations, ['/territories']);
});
test('pending manual POST retains enabled payload, guards navigation and resets on Back', () => {
    const h = harness();
    h.form.events.submit(event());
    assert.equal(h.form.inert, true);
    assert.equal(h.name.disabled, false);
    assert.equal(h.ids.territoryFormSave.disabled, true);
    const second = event();
    h.form.events.submit(second);
    assert.equal(second.prevented, true);
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.equal(h.ids.territoryFormDiscard.open, undefined);
    h.events.pageshow();
    assert.equal(h.form.inert, false);
    assert.equal(h.ids.territoryFormSave.disabled, false);
});
test('server failure input takes precedence over stale history and stays guarded', () => {
    const original = harness();
    original.name.value = 'Stale';
    original.form.events.input(event(original.name));
    const h = harness({posted: true, saved: original.root.history.state.sbTerritoryForm});
    assert.equal(h.name.value, 'Original');
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
});
test('required validation exposes and clears accessible feedback', () => {
    const h = harness();
    h.name.validationMessage = 'Name required';
    h.form.events.invalid(event(h.name));
    assert.equal(h.ids.territoryFormNotice.textContent, 'Name required');
    assert.equal(h.name.attrs['aria-invalid'], 'true');
    h.form.events.input(event(h.name));
    assert.equal(h.ids.territoryFormNotice.hidden, true);
    assert.equal(h.name.attrs['aria-invalid'], undefined);
});
test('invalid draft shape is reported honestly rather than overwriting input', () => {
    const h = harness({saved: {key: 'edit-7', fields: {name: 5}}});
    assert.equal(h.name.value, 'Original');
    assert.match(h.ids.territoryFormNotice.textContent, /Could not restore/);
});
test('browser unload guards only dirty entries and Escape uses the guarded cancel link', () => {
    const h = harness();
    const clean = event();
    h.events.beforeunload(clean);
    assert.equal(clean.prevented, false);
    h.name.value = 'Draft';
    const dirty = event();
    h.events.beforeunload(dirty);
    assert.equal(dirty.prevented, true);
    let clicked = false;
    h.cancel.click = () => { clicked = true; };
    h.clicks.keydown({key: 'Escape', preventDefault() {}});
    assert.equal(clicked, true);
});
test('manual lifecycle has no network write, autosave or persistent storage implementation', () => {
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
