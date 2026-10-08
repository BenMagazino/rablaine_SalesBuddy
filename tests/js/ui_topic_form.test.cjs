const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../../static/js/ui-milestone-form.js'), 'utf8');
function harness({posted = false, saved, key = 'edit-6', broken = false} = {}) {
    const element = extra => ({events: {}, value: '', disabled: false, hidden: true,
        scrollTop: 0, innerHTML: 'Save Topic', attrs: {}, validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(k, v) { this.attrs[k] = v; },
        removeAttribute(k) { delete this.attrs[k]; }, ...extra});
    const name = element({value: 'Original'}), description = element({value: 'Context'});
    const reading = element(), cancel = element();
    const form = element({elements: {name, description},
        dataset: {formKey: key, posted: String(posted)}, querySelector: selector =>
            selector === '[data-topic-cancel]' ? cancel : reading});
    const ids = {topicForm: form};
    ['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm'].forEach(s =>
        ids['topicForm' + s] = element());
    const events = {}, clicks = {}, destinations = [];
    const root = {document: {getElementById: id => ids[id], querySelector: () => null,
        addEventListener(type, fn) { clicks[type] = fn; }},
        history: {state: {untouched: 5, ...(saved ? {sbTopicForm: saved} : {})},
            replaceState(value) { if (broken) throw Error('history'); this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console: {error() {}}};
    vm.runInNewContext(source, {window: root});
    return {root, form, ids, name, description, reading, cancel, events, clicks, destinations};
}
const event = target => ({target, button: 0, prevented: false,
    preventDefault() { this.prevented = true; }});
const leave = () => event({closest: () => ({href: '/topics', target: '',
    hasAttribute: () => false, getAttribute: () => '/topics'})});
test('raw name/description and reading position restore on Back with independent state', () => {
    const h = harness();
    h.name.value = ' Draft '; h.description.value = ' raw\ncontext ';
    h.form.events.input(event(h.description));
    h.reading.scrollTop = 80; h.reading.events.scroll();
    h.name.value = ''; h.description.value = '';
    h.events.pageshow();
    assert.deepEqual([h.name.value, h.description.value], [' Draft ', ' raw\ncontext ']);
    assert.equal(h.reading.scrollTop, 80);
    assert.equal(h.root.history.state.untouched, 5);
});
test('Cancel keep/discard and unload guard manual drafts and erase discarded history', () => {
    const h = harness();
    h.description.value = 'draft'; h.form.events.input(event(h.description));
    const navigation = leave(); h.clicks.click(navigation);
    assert.equal(navigation.prevented, true); assert.equal(h.ids.topicFormDiscard.open, true);
    h.root.SBDialog.close(h.ids.topicFormDiscard);
    assert.equal(h.description.value, 'draft');
    const unload = event(); h.events.beforeunload(unload); assert.equal(unload.prevented, true);
    h.clicks.click(leave()); h.ids.topicFormDiscardConfirm.events.click();
    assert.equal(h.description.value, 'Context');
    assert.deepEqual(h.destinations, ['/topics']);
    assert.equal(h.root.history.state.sbTopicForm, undefined);
});
test('manual save protects pending payload, duplicate submits, links and Back recovery', () => {
    const h = harness(); h.form.events.submit(event());
    assert.equal(h.ids.topicFormSave.disabled, true); assert.equal(h.form.inert, true);
    assert.ok([h.name, h.description].every(e => !e.disabled));
    assert.equal(h.ids.topicFormState.textContent, 'Saving topic...');
    const duplicate = event(); h.form.events.submit(duplicate); assert.equal(duplicate.prevented, true);
    const navigation = leave(); h.clicks.click(navigation); assert.equal(navigation.prevented, true);
    const first = event(); h.events.beforeunload(first); assert.equal(first.prevented, false);
    const second = event(); h.events.beforeunload(second); assert.equal(second.prevented, true);
    h.events.pageshow(); assert.equal(h.form.inert, false);
    assert.equal(h.ids.topicFormSave.disabled, false);
});
test('failed server input takes precedence and malformed/wrong-entry history is visible', () => {
    const h = harness(); h.name.value = 'stale'; h.form.events.input(event(h.name));
    const failed = harness({posted: true, saved: h.root.history.state.sbTopicForm});
    assert.equal(failed.name.value, 'Original');
    const navigation = leave(); failed.clicks.click(navigation); assert.equal(navigation.prevented, true);
    const wrong = harness({key: 'new', saved: h.root.history.state.sbTopicForm});
    assert.match(wrong.ids.topicFormNotice.textContent, /Could not restore/);
    const malformed = harness({saved: {key: 'edit-6', fields: {name: 5}}});
    assert.match(malformed.ids.topicFormNotice.textContent, /Could not restore/);
    const broken = harness({broken: true}); broken.form.events.input(event(broken.name));
    assert.match(broken.ids.topicFormNotice.textContent, /Could not preserve/);
});
test('native required validation clears when corrected without autosave', () => {
    const h = harness();
    h.name.validationMessage = 'Name required'; h.form.events.invalid(event(h.name));
    assert.equal(h.name.attrs['aria-invalid'], 'true');
    assert.equal(h.ids.topicFormNotice.textContent, 'Name required');
    h.form.events.input(event(h.name)); assert.equal(h.ids.topicFormNotice.hidden, true);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
test('clean new state, Escape and modified navigation use shared native lifecycle', () => {
    const h = harness({key: 'new'}); assert.equal(h.ids.topicFormState.textContent, 'New topic');
    const navigation = leave(); h.clicks.click(navigation); assert.equal(navigation.prevented, false);
    let clicked = false; h.cancel.click = () => { clicked = true; };
    h.clicks.keydown({key: 'Escape', preventDefault() {}});
    assert.equal(clicked, true);
    h.name.value = 'dirty'; h.form.events.input(event(h.name));
    const modified = leave(); modified.ctrlKey = true;
    h.clicks.click(modified); assert.equal(modified.prevented, false);
});
