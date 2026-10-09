const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../../static/js/ui-milestone-form.js'), 'utf8');
function harness({posted = false, saved, brokenHistory = false} = {}) {
    const element = extra => ({events: {}, value: '', checked: false, disabled: false,
        hidden: true, scrollTop: 0, innerHTML: 'Save Solution Engineer', attrs: {},
        validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, ...extra});
    const name = element({value: 'Original'}), alias = element({value: 'original'});
    const specialty = element({value: 'Azure Data'});
    const boxes = [element({id: 'pod_1', checked: true}), element({id: 'pod_2'})];
    const reading = element(), choices = element(), cancel = element();
    const form = element({elements: {name, alias, specialty},
        dataset: {formKey: 'edit-7', posted: String(posted)},
        querySelectorAll: () => boxes,
        querySelector: s => s === '.sef-choices' ? choices
            : s === '[data-se-cancel]' ? cancel : reading});
    const ids = {seForm: form};
    ['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm']
        .forEach(suffix => { ids['seForm' + suffix] = element(); });
    const events = {}, clicks = {}, destinations = [], errors = [];
    const root = {document: {getElementById: id => ids[id], querySelector: () => null,
        addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {untouched: 5, ...(saved ? {sbSEForm: saved} : {})},
            replaceState(value) {
                if (brokenHistory) throw Error('history');
                this.state = value;
            }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }},
        console: {error(...args) { errors.push(args); }}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, name, alias, specialty, boxes, reading, choices, cancel,
        events, clicks, destinations, errors};
}
const event = target => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/solution-engineer/7', target: '',
    hasAttribute: () => false, getAttribute: () => '/solution-engineer/7'})});
test('Back restores all three fields, selections and two scrolls in this entry only', () => {
    const h = harness();
    h.name.value = 'Draft'; h.alias.value = 'draft'; h.specialty.value = 'Azure Apps and AI';
    h.boxes[0].checked = false; h.boxes[1].checked = true;
    h.form.events.change(event(h.boxes[1]));
    h.reading.scrollTop = 90; h.reading.events.scroll();
    h.choices.scrollTop = 40; h.choices.events.scroll();
    h.name.value = ''; h.alias.value = ''; h.specialty.value = '';
    h.boxes[1].checked = false;
    h.events.pageshow();
    assert.equal(h.name.value, 'Draft');
    assert.equal(h.alias.value, 'draft');
    assert.equal(h.specialty.value, 'Azure Apps and AI');
    assert.deepEqual(h.boxes.map(b => b.checked), [false, true]);
    assert.equal(h.reading.scrollTop, 90);
    assert.equal(h.choices.scrollTop, 40);
    assert.equal(h.root.history.state.untouched, 5);
    assert.equal(h.ids.seFormState.textContent, 'Unsaved changes');
});
test('POD-only drafts guard Cancel; keep editing and discard are distinct', () => {
    const h = harness();
    h.boxes[1].checked = true;
    h.form.events.change(event(h.boxes[1]));
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.equal(h.ids.seFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.seFormDiscard);
    assert.equal(h.boxes[1].checked, true);
    assert.deepEqual(h.destinations, []);
    h.clicks.click(leave());
    h.ids.seFormDiscardConfirm.events.click();
    assert.deepEqual(h.boxes.map(b => b.checked), [true, false]);
    assert.deepEqual(h.destinations, ['/solution-engineer/7']);
    assert.equal(h.root.history.state.sbSEForm, undefined);
    assert.equal(h.root.history.state.untouched, 5);
});
test('manual POST keeps payload enabled; pending save guards leave and duplicate submit', () => {
    const h = harness();
    const submit = event();
    h.form.events.submit(submit);
    assert.equal(submit.prevented, false);
    assert.equal(h.form.inert, true);
    assert.equal(h.ids.seFormSave.disabled, true);
    assert.ok([h.name, h.alias, h.specialty, ...h.boxes].every(e => !e.disabled));
    const duplicate = event();
    h.form.events.submit(duplicate);
    assert.equal(duplicate.prevented, true);
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
    assert.match(h.ids.seFormNotice.textContent, /Wait/);
    const first = event();
    h.events.beforeunload(first);
    assert.equal(first.prevented, false);
    const second = event();
    h.events.beforeunload(second);
    assert.equal(second.prevented, true);
    h.events.pageshow();
    assert.equal(h.form.inert, false);
    assert.equal(h.ids.seFormSave.disabled, false);
});
test('failed server input wins over stale draft and remains guarded', () => {
    const old = harness();
    old.name.value = 'Stale';
    old.form.events.input(event(old.name));
    const h = harness({posted: true, saved: old.root.history.state.sbSEForm});
    assert.equal(h.name.value, 'Original');
    const navigation = leave();
    h.clicks.click(navigation);
    assert.equal(navigation.prevented, true);
});
test('required validation clears feedback after correction', () => {
    const h = harness();
    h.name.validationMessage = 'Name required';
    h.form.events.invalid(event(h.name));
    assert.equal(h.name.attrs['aria-invalid'], 'true');
    assert.equal(h.ids.seFormNotice.textContent, 'Name required');
    h.form.events.input(event(h.name));
    assert.equal(h.name.attrs['aria-invalid'], undefined);
    assert.equal(h.ids.seFormNotice.hidden, true);
});
test('broken history reports honest restore/preserve failure without erasing fields', () => {
    const h = harness({saved: {key: 'edit-7', fields: {name: 5}}});
    assert.equal(h.name.value, 'Original');
    assert.match(h.ids.seFormNotice.textContent, /Could not restore/);
    const broken = harness({brokenHistory: true});
    broken.form.events.input(event(broken.name));
    assert.match(broken.ids.seFormNotice.textContent, /Could not preserve/);
});
test('clean links and unload stay native; Escape takes the guarded Cancel path', () => {
    const h = harness();
    const clean = leave();
    h.clicks.click(clean);
    assert.equal(clean.prevented, false);
    const unload = event();
    h.events.beforeunload(unload);
    assert.equal(unload.prevented, false);
    h.alias.value = 'draft';
    const dirty = event();
    h.events.beforeunload(dirty);
    assert.equal(dirty.prevented, true);
    let clicked = false;
    h.cancel.click = () => { clicked = true; };
    h.clicks.keydown({key: 'Escape', preventDefault() {}});
    assert.equal(clicked, true);
});
test('manual lifecycle has no autosave, network write or persistent storage', () => {
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
