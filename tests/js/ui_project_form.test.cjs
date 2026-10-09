const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').resolve(__dirname,
    '../../static/js/ui-milestone-form.js'), 'utf8');
const {validateProjectView} = require('../../static/js/ui-milestone-form.js');
const fields = ['title', 'description', 'project_type', 'due_date', 'status'];
const view = {key: 'edit-2', fields: {title: 'Draft', description: '<literal>',
    project_type: 'training', due_date: '2028-01-02', status: 'Completed'},
    checked: ['note_2'], scroll: 24, noteScroll: 18};
function harness({saved, posted = false, badHistory = false} = {}) {
    const element = (extra = {}) => ({events: {}, value: '', checked: false, disabled: false,
        hidden: true, scrollTop: 0, innerHTML: 'Save', attrs: {}, validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; }, ...extra});
    const elements = Object.fromEntries(fields.map(name => [name, element()]));
    elements.title.value = 'Original';
    elements.project_type.value = 'general';
    elements.status.value = 'Active';
    const boxes = [element({id: 'note_1', checked: true}), element({id: 'note_2'})];
    const reading = element(), choices = element();
    const ids = Object.fromEntries(['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm']
        .map(name => ['projectForm' + name, element()]));
    const form = element({elements, dataset: {formKey: 'edit-2', posted: String(posted)},
        querySelectorAll: () => boxes,
        querySelector: selector => selector === '.pf-choices' ? choices : reading});
    ids.projectForm = form;
    const events = {}, clicks = {}, destinations = [], errors = [];
    const root = {document: {getElementById: id => ids[id],
        addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {otherDraft: 123, ...(saved ? {sbProjectForm: saved} : {})},
            replaceState(value) {
                if (badHistory) throw Error('Unavailable');
                this.state = value;
            }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(dialog) { dialog.open = true; }, close(dialog) { dialog.open = false; }},
        location: {assign(url) { destinations.push(url); }},
        console: {error(...args) { errors.push(args); }}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, events, clicks, destinations, elements, boxes, reading, choices, errors};
}
function event(target = {}) {
    return {target, button: 0, prevented: false,
        preventDefault() { this.prevented = true; }};
}
function link(href = '/project/2', options = {}) {
    return Object.assign(event({closest: () => ({href, target: '',
        hasAttribute: () => false, getAttribute: () => href})}), options);
}
test('record-keyed project draft validation rejects malformed data', () => {
    assert.equal(validateProjectView(view, 'edit-2', fields), view);
    for (const bad of [null, {}, {...view, key:'new'}, {...view, checked: [1]},
        {...view, scroll: -1}, {...view, noteScroll: Infinity},
        {...view, fields: {...view.fields, description: null}}]) {
        assert.throws(() => validateProjectView(bad, 'edit-2', fields));
    }
});
test('Back restores fields, selections and both scrolls without touching another draft', () => {
    const h = harness({saved: view});
    assert.equal(h.elements.description.value, '<literal>');
    assert.deepEqual(h.boxes.map(b => b.checked), [false, true]);
    assert.equal(h.reading.scrollTop, 24);
    assert.equal(h.choices.scrollTop, 18);
    h.elements.title.value = 'Further';
    h.form.events.input(event(h.elements.title));
    h.reading.scrollTop = 84;
    h.reading.events.scroll();
    h.elements.title.value = '';
    h.events.pageshow();
    assert.equal(h.elements.title.value, 'Further');
    assert.equal(h.reading.scrollTop, 84);
    assert.equal(h.root.history.state.otherDraft, 123);
});
test('selection changes alone guard navigation; keep editing and discard are distinct', () => {
    const h = harness();
    h.boxes[1].checked = true;
    h.form.events.change(event(h.boxes[1]));
    const leave = link();
    h.clicks.click(leave);
    assert.equal(leave.prevented, true);
    assert.equal(h.ids.projectFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.projectFormDiscard);
    assert.equal(h.boxes[1].checked, true);
    assert.deepEqual(h.destinations, []);
    h.clicks.click(link());
    h.ids.projectFormDiscardConfirm.events.click();
    assert.deepEqual(h.destinations, ['/project/2']);
    assert.deepEqual(h.boxes.map(b => b.checked), [true, false]);
    assert.equal(h.root.history.state.sbProjectForm, undefined);
    assert.equal(h.root.history.state.otherDraft, 123);
    const unload = event();
    h.events.beforeunload(unload);
    assert.equal(unload.prevented, false);
});
test('native submit retains enabled payload fields and blocks duplicates/pending leave', () => {
    const h = harness({saved:view});
    const submit = event();
    h.form.events.submit(submit);
    assert.equal(submit.prevented, false);
    assert.equal(h.form.inert, true);
    assert.equal(h.ids.projectFormSave.disabled, true);
    assert.equal(h.form.attrs['aria-busy'], 'true');
    assert.equal(h.elements.status.value, 'Completed');
    assert.ok(Object.values(h.elements).every(e => !e.disabled));
    const duplicate = event();
    h.form.events.submit(duplicate);
    assert.equal(duplicate.prevented, true);
    const leave = link();
    h.clicks.click(leave);
    assert.equal(leave.prevented, true);
    assert.match(h.ids.projectFormNotice.textContent, /Wait/);
    const navigation = event();
    h.events.beforeunload(navigation);
    assert.equal(navigation.prevented, false);
    const pending = event();
    h.events.beforeunload(pending);
    assert.equal(pending.prevented, true);
    h.events.pageshow();
    assert.equal(h.form.inert, false);
    assert.equal(h.ids.projectFormSave.disabled, false);
});
test('failed POST retains server input instead of stale entry history and remains guarded', () => {
    const h = harness({saved:view, posted:true});
    assert.equal(h.elements.title.value, 'Original');
    const e = event();
    h.events.beforeunload(e);
    assert.equal(e.prevented, true);
    h.elements.description.value = 'Retry';
    h.form.events.input(event(h.elements.description));
    assert.equal(h.root.history.state.sbProjectForm.fields.description, 'Retry');
});
test('clean/modified links preserve native behavior; history failure visibly reports', () => {
    const clean = harness();
    const native = link();
    clean.clicks.click(native);
    assert.equal(native.prevented, false);
    const h = harness({saved:view});
    for (const e of [link('#main-content'), link('/project/2', {ctrlKey:true}),
        link('/project/2', {button:1})]) {
        h.clicks.click(e);
        assert.equal(e.prevented, false);
    }
    const invalid = harness({saved:{...view, key:'new'}});
    assert.equal(invalid.errors.length, 1);
    const failure = harness({badHistory:true});
    failure.form.events.input(event(failure.elements.title));
    assert.equal(failure.errors.length, 1);
    assert.match(failure.ids.projectFormNotice.textContent, /Keep this page open/);
});
test('required-title error clears after correction; reverting changes removes guard', () => {
    const h = harness();
    h.elements.title.validationMessage = 'Title required';
    h.form.events.invalid(event(h.elements.title));
    assert.equal(h.elements.title.attrs['aria-invalid'], 'true');
    h.form.events.input(event(h.elements.title));
    assert.equal(h.ids.projectFormNotice.hidden, true);
    assert.equal(h.elements.title.attrs['aria-invalid'], undefined);
    const clean = event();
    h.events.beforeunload(clean);
    assert.equal(clean.prevented, false);
});
