const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../../static/js/ui-milestone-form.js'), 'utf8');
function harness({posted = false, saved, key = 'edit-11', broken = false} = {}) {
    const element = extra => ({events: {}, value: '', disabled: false, hidden: true,
        scrollTop: 0, innerHTML: 'Save Changes', attrs: {}, validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, ...extra});
    const name = element({value: 'Original'}), description = element({value: 'Context'});
    const reading = element(), cancel = element();
    const form = element({elements: {name, description},
        dataset: {formKey: key, posted: String(posted)}, querySelector: selector =>
            selector === '[data-specialty-cancel]' ? cancel : reading});
    const ids = {specialtyForm: form};
    ['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm'].forEach(s =>
        ids['specialtyForm' + s] = element());
    const events = {}, clicks = {}, destinations = [];
    const root = {document: {getElementById: id => ids[id], querySelector: () => null,
        addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {sbPartnerForm: {untouched: true},
            ...(saved ? {sbSpecialtyForm: saved} : {})},
            replaceState(value) { if (broken) throw Error('history'); this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console: {error() {}}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, name, description, reading, cancel, events, clicks, destinations};
}
const event = target => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/specialties', target: '',
    hasAttribute: () => false, getAttribute: () => '/specialties'})});
test('raw fields and independent reading restore on actual pageshow without partner state loss', () => {
    const h = harness();
    h.name.value = ' Draft '; h.description.value = ' raw\ncontext ';
    h.form.events.input(event(h.description));
    h.reading.scrollTop = 80; h.reading.events.scroll();
    h.name.value = ''; h.description.value = ''; h.events.pageshow();
    assert.deepEqual([h.name.value, h.description.value], [' Draft ', ' raw\ncontext ']);
    assert.equal(h.reading.scrollTop, 80);
    assert.equal(h.root.history.state.sbPartnerForm.untouched, true);
});
test('dirty Cancel and unload guard drafts; keep preserves input and discard clears history', () => {
    const h = harness(); h.description.value = 'draft'; h.form.events.input(event(h.description));
    const navigation = leave(); h.clicks.click(navigation);
    assert.equal(navigation.prevented, true); assert.equal(h.ids.specialtyFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.specialtyFormDiscard);
    assert.equal(h.description.value, 'draft');
    const unload = event(); h.events.beforeunload(unload); assert.equal(unload.prevented, true);
    h.clicks.click(leave()); h.ids.specialtyFormDiscardConfirm.events.click();
    assert.equal(h.description.value, 'Context'); assert.deepEqual(h.destinations, ['/specialties']);
    assert.equal(h.root.history.state.sbSpecialtyForm, undefined);
});
test('pending manual save blocks duplicates and navigation but leaves POST fields enabled', () => {
    const h = harness(); h.form.events.submit(event());
    assert.equal(h.ids.specialtyFormSave.disabled, true); assert.equal(h.form.inert, true);
    assert.ok([h.name, h.description].every(e => !e.disabled));
    assert.equal(h.ids.specialtyFormState.textContent, 'Saving specialty...');
    const duplicate = event(); h.form.events.submit(duplicate); assert.equal(duplicate.prevented, true);
    const navigation = leave(); h.clicks.click(navigation); assert.equal(navigation.prevented, true);
    const first = event(); h.events.beforeunload(first); assert.equal(first.prevented, false);
    const second = event(); h.events.beforeunload(second); assert.equal(second.prevented, true);
    h.events.pageshow(); assert.equal(h.form.inert, false);
    assert.equal(h.ids.specialtyFormSave.disabled, false);
});
test('failed input wins over stale history and wrong entries or corrupt state show errors', () => {
    const h = harness(); h.name.value = 'stale'; h.form.events.input(event(h.name));
    const failed = harness({posted: true, saved: h.root.history.state.sbSpecialtyForm});
    assert.equal(failed.name.value, 'Original');
    const navigation = leave(); failed.clicks.click(navigation); assert.equal(navigation.prevented, true);
    const wrong = harness({key: 'new', saved: h.root.history.state.sbSpecialtyForm});
    assert.match(wrong.ids.specialtyFormNotice.textContent, /Could not restore/);
    const malformed = harness({saved: {key: 'edit-11', fields: {name: 5}}});
    assert.match(malformed.ids.specialtyFormNotice.textContent, /Could not restore/);
    const broken = harness({broken: true}); broken.form.events.input(event(broken.name));
    assert.match(broken.ids.specialtyFormNotice.textContent, /Could not preserve/);
});
test('required validation correction does not save; Escape and clean Cancel stay native', () => {
    const h = harness({key: 'new'});
    assert.equal(h.ids.specialtyFormState.textContent, 'New specialty');
    const navigation = leave(); h.clicks.click(navigation); assert.equal(navigation.prevented, false);
    h.name.validationMessage = 'Name required'; h.form.events.invalid(event(h.name));
    assert.equal(h.name.attrs['aria-invalid'], 'true');
    h.form.events.input(event(h.name)); assert.equal(h.ids.specialtyFormNotice.hidden, true);
    let clicked = false; h.cancel.click = () => { clicked = true; };
    h.clicks.keydown({key: 'Escape', preventDefault() {}});
    assert.equal(clicked, true);
    h.name.value = 'dirty'; h.form.events.input(event(h.name));
    const modified = leave(); modified.ctrlKey = true;
    h.clicks.click(modified); assert.equal(modified.prevented, false);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
