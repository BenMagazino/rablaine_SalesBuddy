const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../../static/js/ui-milestone-form.js'), 'utf8');
function harness({posted = false, saved, key = 'edit-6', broken = false} = {}) {
    const element = extra => ({events: {}, value: '', disabled: false, hidden: true,
        scrollTop: 0, innerHTML: 'Save Changes', attrs: {}, validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, ...extra});
    const name = element({value: 'Original'}), alias = element({value: 'original'});
    const role = element({value: 'DAE'}), reading = element(), cancel = element();
    const form = element({elements: {name, alias, role},
        dataset: {formKey: key, posted: String(posted)},
        querySelector: s => s === '[data-ic-cancel]' ? cancel : reading});
    const deleteButton = element();
    const deletion = element({querySelector: () => deleteButton});
    const ids = {icForm: form, icFormDeletePost: deletion};
    ['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm'].forEach(s => ids['icForm' + s] = element());
    const events = {}, clicks = {}, destinations = [];
    const root = {document: {getElementById: id => ids[id], querySelector: () => null,
        addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {untouched: 5, ...(saved ? {sbICForm: saved} : {})},
            replaceState(value) { if (broken) throw Error('history'); this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console: {error() {}}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, name, alias, role, reading, cancel, deletion, deleteButton,
        events, clicks, destinations};
}
const event = target => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/internal-contacts', target: '',
    hasAttribute: () => false, getAttribute: () => '/internal-contacts'})});
test('all raw fields and reading position restore on Back without overwriting other state', () => {
    const h = harness();
    h.name.value = ' Draft '; h.alias.value = ' alias '; h.role.value = 'custom role';
    h.form.events.input(event(h.role));
    h.reading.scrollTop = 80; h.reading.events.scroll();
    h.name.value = ''; h.alias.value = ''; h.role.value = '';
    h.events.pageshow();
    assert.deepEqual([h.name.value, h.alias.value, h.role.value], [' Draft ', ' alias ', 'custom role']);
    assert.equal(h.reading.scrollTop, 80);
    assert.equal(h.root.history.state.untouched, 5);
});
test('Cancel keep/discard and browser unload preserve unsaved manual entries', () => {
    const h = harness();
    h.role.value = 'draft'; h.form.events.input(event(h.role));
    const navigation = leave(); h.clicks.click(navigation);
    assert.equal(navigation.prevented, true); assert.equal(h.ids.icFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.icFormDiscard);
    assert.equal(h.role.value, 'draft');
    const unload = event(); h.events.beforeunload(unload);
    assert.equal(unload.prevented, true);
    h.clicks.click(leave()); h.ids.icFormDiscardConfirm.events.click();
    assert.equal(h.role.value, 'DAE');
    assert.deepEqual(h.destinations, ['/internal-contacts']);
    assert.equal(h.root.history.state.sbICForm, undefined);
});
test('manual save blocks duplicate submit/navigation without disabling payload', () => {
    const h = harness(); h.form.events.submit(event());
    assert.equal(h.ids.icFormSave.disabled, true);
    assert.equal(h.form.inert, true);
    assert.ok([h.name, h.alias, h.role].every(e => !e.disabled));
    const duplicate = event(); h.form.events.submit(duplicate); assert.equal(duplicate.prevented, true);
    const navigation = leave(); h.clicks.click(navigation); assert.equal(navigation.prevented, true);
    const first = event(); h.events.beforeunload(first); assert.equal(first.prevented, false);
    h.events.pageshow(); assert.equal(h.form.inert, false);
});
test('delete submits only explicitly, protects pending navigation and restores on Back', () => {
    const h = harness();
    assert.equal(h.deleteButton.disabled, false);
    h.deletion.events.submit(event());
    assert.equal(h.deleteButton.disabled, true);
    assert.equal(h.ids.icFormState.textContent, 'Deleting internal contact...');
    const duplicate = event(); h.deletion.events.submit(duplicate);
    assert.equal(duplicate.prevented, true);
    const dismiss = event({id: 'icFormDelete'});
    h.clicks['sb:dialog-before-close'](dismiss);
    assert.equal(dismiss.prevented, true);
    const first = event(); h.events.beforeunload(first); assert.equal(first.prevented, false);
    h.events.pageshow(); assert.equal(h.deleteButton.disabled, false);
});
test('server input wins over stale history; validation and wrong-entry history are honest', () => {
    const h = harness(); h.name.value = 'stale'; h.form.events.input(event(h.name));
    const failed = harness({posted: true, saved: h.root.history.state.sbICForm});
    assert.equal(failed.name.value, 'Original');
    const navigation = leave(); failed.clicks.click(navigation); assert.equal(navigation.prevented, true);
    const wrong = harness({key: 'new', saved: h.root.history.state.sbICForm});
    assert.match(wrong.ids.icFormNotice.textContent, /Could not restore/);
    h.name.validationMessage = 'Name required'; h.form.events.invalid(event(h.name));
    assert.equal(h.name.attrs['aria-invalid'], 'true');
    h.form.events.input(event(h.name)); assert.equal(h.ids.icFormNotice.hidden, true);
    const broken = harness({broken: true}); broken.form.events.input(event(broken.name));
    assert.match(broken.ids.icFormNotice.textContent, /Could not preserve/);
});
test('clean links/new state and Escape use native guarded paths; no autosave exists', () => {
    const h = harness({key: 'new'});
    assert.equal(h.ids.icFormState.textContent, 'New internal contact');
    const navigation = leave(); h.clicks.click(navigation); assert.equal(navigation.prevented, false);
    let clicked = false; h.cancel.click = () => { clicked = true; };
    h.clicks.keydown({key: 'Escape', preventDefault() {}});
    assert.equal(clicked, true);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
