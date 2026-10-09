const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {validateView, fields} = require('../../static/js/ui-engagement-form.js');
const source = fs.readFileSync(path.resolve(__dirname,
    '../../static/js/ui-engagement-form.js'), 'utf8');

function element(extra = {}) {
    return {events: {}, attrs: {}, value: '', hidden: true, scrollTop: 0, disabled: false,
        childNodes: [], dataset: {}, innerHTML: 'Save Changes', textContent: '',
        validity: {valid: true}, addEventListener(type, listener) { this.events[type] = listener; },
        setAttribute(name, value) { this.attrs[name] = value; },
        removeAttribute(name) { delete this.attrs[name]; },
        append(...nodes) { this.childNodes.push(...nodes); },
        replaceChildren(...nodes) { this.childNodes = nodes; },
        querySelector(selector) {
            const name = selector.match(/name="([^"]+)"/)?.[1];
            return this.childNodes.find(node => node.name === name) || null;
        }, querySelectorAll() { return this.childNodes; }, ...extra};
}
function harness({saved, posted = false, rejectHistory = false} = {}) {
    const elements = Object.fromEntries(fields.map(name => [name, element({id: name})]));
    elements.status.value = 'Active';
    const reading = [element(), element()];
    const choices = [element({dataset: {linkField: 'note_ids'}})];
    const boxes = [element({id: 'note_ids_1', checked: false}),
        element({id: 'milestone_ids_2', checked: true})];
    const contacts = element();
    const ids = Object.fromEntries(['engagementFormSave', 'engagementFormState',
        'engagementFormNotice', 'engagementFormDiscard', 'engagementFormDiscardConfirm',
        'engagementDeleteOpen', 'engagementDeleteForm'].map(id => [id, element()]));
    ids.selected_contacts = contacts;
    ids.engagementDeleteForm.querySelector = () => ids.deleteButton;
    ids.deleteButton = element();
    const form = element({elements, dataset: {formKey: 'edit-1', posted: String(posted)},
        querySelectorAll(selector) {
            return selector === '.ef-reading' ? reading : selector === '.ef-choices'
                ? choices : boxes;
        },
        checkValidity() { return Object.values(elements).every(e => e.validity.valid); }});
    ids.engagementForm = form;
    const events = {}, docEvents = {}, errors = [], destinations = [];
    const root = {
        document: {getElementById: id => ids[id], querySelector: () => ids.deleteButton,
            createElement: () => element(),
            createTextNode: textContent => ({nodeType: 3, textContent}),
            addEventListener(type, fn) { docEvents[type] = fn; }},
        history: {state: {otherDraft: 'untouched', ...(saved ? {sbEngagementForm: saved} : {})},
            replaceState(value) {
                if (rejectHistory) throw new Error('Unavailable');
                this.state = value;
            }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(dialog) { if (typeof dialog !== 'string') dialog.open = true; },
            close(dialog) { dialog.open = false; }},
        location: {assign(url) { destinations.push(url); }},
        console: {error(...args) { errors.push(args); }},
    };
    vm.runInNewContext(source, {window: root});
    return {root, form, elements, reading, choices, boxes, contacts, ids, events,
        docEvents, errors, destinations};
}
function event(target = {}) {
    return {target, button: 0, prevented: false,
        preventDefault() { this.prevented = true; }};
}
function linkEvent(href = '/customer/1', extra = {}) {
    const link = {href, target: '', hasAttribute: () => false, getAttribute: () => href};
    return Object.assign(event({closest: () => link}), extra);
}
const view = {key: 'edit-1', fields: Object.fromEntries(fields.map(name => [name,
    name === 'status' ? 'On Hold' : name === 'title' ? 'Draft <safe>' : ''])),
    checked: ['note_ids_1'], contacts: [
        {type: 'seller', id: '17', name: 'Seller "safe"', email: ''},
        {type: 'external', id: '', name: 'Outside <safe>', email: '"@example.com'},
    ], scroll: [120, 240], choiceScroll: {note_ids: 36}};

test('history schema rejects different records, malformed fields, contacts and scrolls', () => {
    assert.equal(validateView(view, 'edit-1'), view);
    for (const value of [null, {}, {...view, key: 'new-1'}, {...view, fields: {}},
        {...view, checked: [4]}, {...view, contacts: [{type: 'invalid'}]},
        {...view, scroll: [-1, 0]}, {...view, scroll: [0, Infinity]},
        {...view, scroll: [0]}, {...view, choiceScroll: null},
        {...view, choiceScroll: {note_ids: -1}},
        {...view, choiceScroll: {unknown_ids: 10}}]) {
        assert.throws(() => validateView(value, 'edit-1'), /Invalid/);
    }
});
test('all fields, selected associations, contacts and both reading positions restore safely', () => {
    const h = harness({saved: view});
    assert.equal(h.elements.title.value, 'Draft <safe>');
    assert.equal(h.elements.status.value, 'On Hold');
    assert.deepEqual(h.boxes.map(box => box.checked), [true, false]);
    assert.deepEqual(h.reading.map(region => region.scrollTop), [120, 240]);
    assert.equal(h.choices[0].scrollTop, 36);
    assert.equal(h.contacts.childNodes.length, 2);
    assert.equal(h.contacts.childNodes[1].querySelector('[name="contact_ext_names"]').value,
        'Outside <safe>');
    assert.equal(h.contacts.childNodes[1].querySelector('[name="contact_ext_emails"]').value,
        '"@example.com');
    h.elements.business_impact.value = 'Further edits';
    h.form.events.input(event(h.elements.business_impact));
    assert.equal(h.root.history.state.sbEngagementForm.fields.business_impact, 'Further edits');
    assert.equal(h.root.history.state.otherDraft, 'untouched');
    h.elements.business_impact.value = '';
    h.events.pageshow();
    assert.equal(h.elements.business_impact.value, 'Further edits');
});
test('clean navigation is native; dirty links guard with shared dialog and Keep editing', () => {
    const h = harness();
    const clean = linkEvent(); h.docEvents.click(clean);
    assert.equal(clean.prevented, false);
    h.elements.title.value = 'Unsaved';
    const dirty = linkEvent(); h.docEvents.click(dirty);
    assert.equal(dirty.prevented, true);
    assert.equal(h.ids.engagementFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.engagementFormDiscard);
    assert.equal(h.elements.title.value, 'Unsaved');
    assert.deepEqual(h.destinations, []);
});
test('modified clicks and fragment navigation retain native behavior', () => {
    const h = harness({saved: view});
    for (const options of [{ctrlKey: true}, {metaKey: true}, {button: 1},
        {shiftKey: true}, {altKey: true}]) {
        const e = linkEvent('/customer/1', options); h.docEvents.click(e);
        assert.equal(e.prevented, false);
    }
    const fragment = linkEvent('#main-content'); h.docEvents.click(fragment);
    assert.equal(fragment.prevented, false);
});
test('confirmed discard clears only this draft and restores original field/relationship state', () => {
    const h = harness({saved: view});
    h.docEvents.click(linkEvent('/customer/1'));
    h.ids.engagementFormDiscardConfirm.events.click();
    assert.deepEqual(h.destinations, ['/customer/1']);
    assert.equal(h.root.history.state.sbEngagementForm, undefined);
    assert.equal(h.root.history.state.otherDraft, 'untouched');
    assert.equal(h.elements.title.value, '');
    assert.deepEqual(h.boxes.map(box => box.checked), [false, true]);
    const e = event(); h.events.beforeunload(e);
    assert.equal(e.prevented, false);
    h.events.pagehide();
    assert.equal(h.root.history.state.sbEngagementForm, undefined);
});
test('submit keeps POST fields enabled, locks editing, blocks duplicates and pending links', () => {
    const h = harness({saved: view});
    const first = event(); h.form.events.submit(first);
    assert.equal(first.prevented, false);
    assert.equal(h.form.inert, true);
    assert.equal(h.form.attrs['aria-busy'], 'true');
    assert.equal(h.ids.engagementFormSave.disabled, true);
    assert.equal(h.elements.title.disabled, false);
    assert.equal(h.elements.title.value, view.fields.title);
    assert.equal(h.boxes[0].checked, true);
    const second = event(); h.form.events.submit(second);
    assert.equal(second.prevented, true);
    const leave = linkEvent(); h.docEvents.click(leave);
    assert.equal(leave.prevented, true);
    assert.match(h.ids.engagementFormNotice.textContent, /Wait/);
    const submission = event(); h.events.beforeunload(submission);
    assert.equal(submission.prevented, false);
    const reload = event(); h.events.beforeunload(reload);
    assert.equal(reload.prevented, true);
    h.events.pageshow();
    assert.equal(h.form.inert, false);
    assert.equal(h.ids.engagementFormSave.disabled, false);
});
test('immediate contact creation blocks form save and navigation, then restores interaction', () => {
    const h = harness();
    h.form.events['sb:engagement-contact-pending']({detail: true});
    assert.equal(h.form.inert, true);
    assert.equal(h.ids.engagementFormSave.disabled, true);
    const save = event(); h.form.events.submit(save);
    assert.equal(save.prevented, true);
    const leave = linkEvent(); h.docEvents.click(leave);
    assert.equal(leave.prevented, true);
    const back = event(); h.events.beforeunload(back);
    assert.equal(back.prevented, true);
    h.form.events['sb:engagement-contact-pending']({detail: false});
    assert.equal(h.form.inert, false);
    assert.equal(h.ids.engagementFormSave.disabled, false);
});
test('server failure values take priority over old Back drafts and remain guarded', () => {
    const h = harness({saved: view, posted: true});
    assert.equal(h.elements.title.value, '');
    assert.equal(h.contacts.childNodes.length, 0);
    const e = event(); h.events.beforeunload(e);
    assert.equal(e.prevented, true);
});
test('browser validity is visible and clearing errors uses no added business validation', () => {
    const h = harness();
    h.elements.title.validity.valid = false;
    h.elements.title.validationMessage = 'Please fill out this field.';
    h.form.events.invalid(event(h.elements.title));
    assert.equal(h.elements.title.attrs['aria-invalid'], 'true');
    assert.match(h.ids.engagementFormNotice.textContent, /fill out/);
    h.elements.title.validity.valid = true;
    h.elements.title.value = 'Valid';
    h.form.events.input(event(h.elements.title));
    assert.equal(h.elements.title.attrs['aria-invalid'], undefined);
    assert.equal(h.ids.engagementFormNotice.hidden, true);
});
test('history read/write failures are visible, non-destructive and logged', () => {
    const malformed = harness({saved: {...view, key: 'edit-999'}});
    assert.equal(malformed.elements.title.value, '');
    assert.match(malformed.ids.engagementFormNotice.textContent, /Could not restore/);
    const h = harness({rejectHistory: true});
    h.elements.title.value = 'Keep this';
    h.form.events.input(event(h.elements.title));
    assert.equal(h.elements.title.value, 'Keep this');
    assert.match(h.ids.engagementFormNotice.textContent, /Keep this page open/);
    assert.equal(h.errors.length, 1);
});
test('contact search is not a saved field or business mutation; contact errors remain visible', () => {
    const h = harness();
    h.form.events.input(event({id: 'contact_search'}));
    assert.equal(h.root.history.state.sbEngagementForm, undefined);
    h.form.events['sb:engagement-contact-error']({detail: 'Could not add the contact.'});
    assert.match(h.ids.engagementFormNotice.textContent, /Could not add/);
});
test('delete submit prevents duplicates and is unlocked when returning through Back', () => {
    const h = harness();
    const first = event(h.ids.engagementDeleteForm);
    h.ids.engagementDeleteForm.events.submit(first);
    assert.equal(first.prevented, false);
    assert.equal(h.ids.deleteButton.disabled, true);
    const duplicate = event(h.ids.engagementDeleteForm);
    h.ids.engagementDeleteForm.events.submit(duplicate);
    assert.equal(duplicate.prevented, true);
    h.events.pageshow();
    assert.equal(h.ids.deleteButton.disabled, false);
});
