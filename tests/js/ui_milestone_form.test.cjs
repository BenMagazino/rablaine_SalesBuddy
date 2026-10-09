const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').resolve(__dirname,
    '../../static/js/ui-milestone-form.js'), 'utf8');
const {validateView} = require('../../static/js/ui-milestone-form.js');

function harness({saved, posted = false, rejectHistory = false} = {}) {
    const element = (extra = {}) => ({
        events: {}, value: '', scrollTop: 0, hidden: true, textContent: '',
        innerHTML: 'Create Milestone', disabled: false, attrs: {}, validity: {valid: true},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; }, ...extra,
    });
    const url = element(), title = element(), reading = element();
    const ids = Object.fromEntries(['milestoneFormSave', 'milestoneFormState',
        'milestoneFormNotice', 'milestoneFormDiscard', 'milestoneFormDiscardConfirm']
        .map(id => [id, element()]));
    const form = element({elements: {url, title},
        dataset: {formKey: 'new', posted: String(posted)}, querySelector: () => reading});
    ids.milestoneForm = form;
    const events = {}, docEvents = {}, errors = [], destinations = [];
    const root = {
        document: {getElementById: id => ids[id],
            addEventListener(type, fn) { docEvents[type] = fn; }},
        history: {state: {otherDraft: 'untouched', ...(saved ? {sbMilestoneForm: saved} : {})},
            replaceState(value) {
                if (rejectHistory) throw new Error('Unavailable');
                this.state = value;
            }},
        addEventListener(type, fn) { events[type] = fn; },
        SBDialog: {open(dialog) { dialog.open = true; }, close(dialog) { dialog.open = false; }},
        location: {assign(url) { destinations.push(url); }},
        console: {error(...args) { errors.push(args); }},
    };
    vm.runInNewContext(source, {window: root});
    return {root, ids, form, url, title, reading, events, docEvents, errors, destinations};
}

function event(target = {}) {
    return {target, button: 0, prevented: false,
        preventDefault() { this.prevented = true; }};
}
function linkEvent(href = '/milestones', extra = {}) {
    const link = {href, target: '', hasAttribute: () => false, getAttribute: () => href};
    return Object.assign(event({closest: () => link}), extra);
}
const view = {key: 'new', url: 'https://example.com/draft', title: 'Draft', scroll: 48};

test('history validation rejects malformed or different record drafts without coercion', () => {
    assert.equal(validateView(view, 'new'), view);
    for (const value of [null, {}, {...view, key: 'edit-1'}, {...view, url: null},
        {...view, title: 4}, {...view, scroll: -1}, {...view, scroll: Infinity}]) {
        assert.throws(() => validateView(value, 'new'), /Invalid/);
    }
});

test('draft and reading restoration preserves unrelated native history without storage writes', () => {
    const h = harness({saved: view});
    assert.equal(h.url.value, view.url);
    assert.equal(h.title.value, view.title);
    assert.equal(h.reading.scrollTop, 48);
    h.title.value = 'Further edits';
    h.form.events.input(event(h.title));
    assert.equal(h.root.history.state.sbMilestoneForm.title, 'Further edits');
    assert.equal(h.root.history.state.otherDraft, 'untouched');
    h.title.value = '';
    h.events.pageshow();
    assert.equal(h.title.value, 'Further edits');
});

test('dirty navigation opens native discard; Keep editing makes no transition', () => {
    const h = harness();
    h.title.value = 'Not submitted';
    const e = linkEvent();
    h.docEvents.click(e);
    assert.equal(e.prevented, true);
    assert.equal(h.ids.milestoneFormDiscard.open, true);
    assert.deepEqual(h.destinations, []);
    h.root.SBDialog.close(h.ids.milestoneFormDiscard);
    assert.equal(h.title.value, 'Not submitted');
});

test('confirmed discard removes only this entry draft and retains Cancel destination', () => {
    const h = harness({saved: view});
    h.docEvents.click(linkEvent('/milestone/17'));
    h.ids.milestoneFormDiscardConfirm.events.click();
    assert.deepEqual(h.destinations, ['/milestone/17']);
    assert.equal(h.root.history.state.sbMilestoneForm, undefined);
    assert.equal(h.root.history.state.otherDraft, 'untouched');
    assert.equal(h.url.value, '');
    assert.equal(h.title.value, '');
    const e = event();
    h.events.beforeunload(e);
    assert.equal(e.prevented, false);
    h.events.pagehide();
    assert.equal(h.root.history.state.sbMilestoneForm, undefined);
});

test('clean navigation, fragments and modified/new-tab clicks preserve native behavior', () => {
    const clean = harness();
    const e = linkEvent();
    clean.docEvents.click(e);
    assert.equal(e.prevented, false);
    const dirty = harness({saved: view});
    for (const options of [{ctrlKey: true}, {metaKey: true}, {button: 1},
        {shiftKey: true}, {altKey: true}]) {
        const modified = linkEvent('/milestones', options);
        dirty.docEvents.click(modified);
        assert.equal(modified.prevented, false);
    }
    const fragment = linkEvent('#main-content');
    dirty.docEvents.click(fragment);
    assert.equal(fragment.prevented, false);
});

test('Back/reload are guarded while dirty, and reverting fields removes the guard', () => {
    const h = harness();
    h.title.value = 'Changed';
    const dirty = event();
    h.events.beforeunload(dirty);
    assert.equal(dirty.prevented, true);
    assert.equal(dirty.returnValue, '');
    h.title.value = '';
    const clean = event();
    h.events.beforeunload(clean);
    assert.equal(clean.prevented, false);
});

test('native POST retains field names/values, prevents duplicate submit and pending navigation', () => {
    const h = harness({saved: view});
    const first = event();
    h.form.events.submit(first);
    assert.equal(first.prevented, false);
    assert.equal(h.form.attrs['aria-busy'], 'true');
    assert.equal(h.ids.milestoneFormSave.disabled, true);
    assert.equal(h.url.readOnly, true);
    assert.equal(h.url.disabled, false);
    assert.equal(h.url.value, view.url);
    const duplicate = event();
    h.form.events.submit(duplicate);
    assert.equal(duplicate.prevented, true);
    const leave = linkEvent();
    h.docEvents.click(leave);
    assert.equal(leave.prevented, true);
    assert.match(h.ids.milestoneFormNotice.textContent, /Wait/);
    const submission = event();
    h.events.beforeunload(submission);
    assert.equal(submission.prevented, false);
    const laterNavigation = event();
    h.events.beforeunload(laterNavigation);
    assert.equal(laterNavigation.prevented, true);
    h.events.pageshow();
    assert.equal(h.url.readOnly, false);
    assert.equal(h.ids.milestoneFormSave.disabled, false);
    assert.equal(h.form.attrs['aria-busy'], undefined);
});

test('server-error render never replaces submitted fields with stale history and stays guarded', () => {
    const h = harness({saved: view, posted: true});
    assert.equal(h.url.value, '');
    const e = event();
    h.events.beforeunload(e);
    assert.equal(e.prevented, true);
});

test('native validity is visible and corrected fields clear aria-invalid', () => {
    const h = harness();
    h.url.validationMessage = 'Please enter a URL.';
    h.form.events.invalid(event(h.url));
    assert.equal(h.url.attrs['aria-invalid'], 'true');
    assert.equal(h.ids.milestoneFormNotice.hidden, false);
    assert.equal(h.ids.milestoneFormNotice.textContent, 'Please enter a URL.');
    h.url.validity = {valid: true};
    h.form.events.input(event(h.url));
    assert.equal(h.url.attrs['aria-invalid'], undefined);
    assert.equal(h.ids.milestoneFormNotice.hidden, true);
});

test('failed history writes and corrupt restoration surface explicit errors', () => {
    const unavailable = harness({rejectHistory: true});
    unavailable.events.pagehide();
    assert.equal(unavailable.ids.milestoneFormNotice.hidden, false);
    assert.match(unavailable.ids.milestoneFormNotice.textContent, /Could not preserve/);
    assert.equal(unavailable.errors.length, 1);
    const malformed = harness({saved: {...view, title: null}});
    assert.match(malformed.ids.milestoneFormNotice.textContent, /Could not restore/);
    assert.equal(malformed.errors.length, 1);
});
