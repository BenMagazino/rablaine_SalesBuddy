const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-note-form-native.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../../templates/note_form.html'), 'utf8')
    .replace(/\r\n/g, '\n');

function fixture({submit = null, modal = false} = {}) {
    const handlers = {};
    class Dialog {
        constructor() {
            this.open = false;
            this.listeners = {};
            this.classes = new Set();
            this.classList = {add: value => this.classes.add(value),
                remove: value => this.classes.delete(value)};
        }
        addEventListener(type, handler) { this.listeners[type] = handler; }
    }
    const notice = {hidden: true, dataset: {}, setAttribute(key, value) { this[key] = value; }};
    const calls = [];
    const window = {};
    vm.runInNewContext(source, {window, queueMicrotask,
        HTMLDialogElement: Dialog,
        document: {addEventListener: (type, handler) => { handlers[type] = handler; },
            getElementById: () => notice,
            querySelector: selector => selector === '#noteForm button[type="submit"]' ?
                submit : modal,
            querySelectorAll: () => []},
        SBDialog: {open: dialog => { dialog.open = true; dialog.listeners['sb:dialog-opening'](); calls.push('open'); },
            close: dialog => { dialog.open = false; dialog.listeners['sb:dialog-closed'](); calls.push('close'); }},
    });
    return {api: window.SBNoteForm, Dialog, notice, handlers, calls};
}

test('rich note save binding clicks the existing button and suppresses Quill newline handling', () => {
    let clicks = 0;
    const submit = {disabled: false, click() { clicks++; }};
    const {api} = fixture({submit});
    const binding = template.match(/saveNote:\s*(\{[\s\S]*?\n\s{16}\}),/)[1];
    const config = vm.runInNewContext(`(${binding})`, {SBNoteForm: api});
    assert.equal(config.key, 13);
    assert.equal(config.shortKey, true);
    assert.equal(config.handler(), false);
    assert.equal(clicks, 1);
    submit.disabled = true;
    assert.equal(config.handler(), false);
    assert.equal(clicks, 1);
});

test('rich note shortcut cannot save underneath an open modal or without a save control', () => {
    let clicks = 0;
    fixture({submit: {click() { clicks++; }}, modal: true}).api.save();
    fixture().api.save();
    assert.equal(clicks, 0);
});

test('dialog handles reuse SBDialog and preserve queued focus-listener registration', async () => {
    const {api, Dialog, calls} = fixture();
    const element = new Dialog();
    const handle = api.dialog(element);
    assert.equal(api.dialog(element), handle);
    handle.show();
    assert.deepEqual(calls, []);
    await Promise.resolve();
    assert.equal(element.open, true);
    assert.equal(element.classes.has('show'), true);
    handle.toggle();
    assert.equal(element.open, false);
    assert.equal(element.classes.has('show'), false);
    handle.toggle();
    await Promise.resolve();
    handle.hide();
    assert.deepEqual(calls, ['open', 'close', 'open', 'close']);
    assert.throws(() => api.dialog({}), /Invalid note dialog/);
});

test('pending and failed-save feedback is explicit and does not discard the draft', () => {
    const {api, notice} = fixture();
    api.report('Saving note...');
    assert.equal(notice.role, 'status');
    assert.equal(notice.hidden, false);
    api.report('Your draft has been preserved.', 'error');
    assert.equal(notice.role, 'alert');
    assert.equal(notice.dataset.sbState, 'error');
    assert.match(notice.textContent, /preserved/);
    assert.match(template, /if \(submitButton\.disabled\) return;/);
    const failure = template.slice(template.indexOf("console.error('Failed to save engagement:'"),
        template.indexOf('// --- Template selector logic ---'));
    assert.match(failure, /SBNoteForm\.report/);
    assert.doesNotMatch(failure, /requestSubmit/);
});

test('engagement saves reject an unsuccessful result instead of marking it clean', async () => {
    const start = template.indexOf('function _saveOneEngagement(');
    const end = template.indexOf('\nfunction saveAllInlineEngagements()', start);
    const save = template.slice(start, end);
    const values = {textContent: 'Original title', value: 'keep this draft'};
    const card = {querySelector: () => values};
    const context = {_inlineEngCleanStates: {}, _getCardEngState: () => 'clean',
        fetch: async () => ({json: async () => ({success: false, error: 'Save failed'})})};
    vm.runInNewContext(save, context);
    await assert.rejects(context._saveOneEngagement(card, 9), /Save failed/);
    assert.deepEqual(context._inlineEngCleanStates, {});
    context.fetch = async () => ({json: async () => ({success: true})});
    await context._saveOneEngagement(card, 9);
    assert.equal(context._inlineEngCleanStates[9], 'clean');
});

test('editing a note cannot overwrite its customer or general creation draft', () => {
    const start = template.indexOf('function getDraftKey()');
    const end = template.indexOf('// Get customer name', start);
    const context = {CURRENT_NOTE_ID: 285, DRAFT_KEY_PREFIX: 'salesbuddy_draft_',
        document: {getElementById: () => ({value: '107'})}};
    vm.runInNewContext(template.slice(start, end), context);
    assert.equal(context.getDraftKey(), 'salesbuddy_draft_note_285');
    context.CURRENT_NOTE_ID = null;
    assert.equal(context.getDraftKey(), 'salesbuddy_draft_107');
    context.document.getElementById = () => null;
    assert.equal(context.getDraftKey(), 'salesbuddy_draft_general');
    context.CURRENT_NOTE_ID = 202;
    assert.equal(context.getDraftKey(), 'salesbuddy_draft_note_202');
});

test('legacy edit recovery migrates only the same saved note, never a creation draft', () => {
    const start = template.indexOf('function restoreDraft()');
    const end = template.indexOf('        const draft = JSON.parse(draftJson);', start);
    const migration = template.slice(start, end) +
        'return draftJson; } catch (error) { return false; } }';
    const storage = new Map([['salesbuddy_draft_107', '{"note_id":null,"content":"protected"}']]);
    const context = {CURRENT_NOTE_ID: 285, DRAFT_KEY_PREFIX: 'salesbuddy_draft_',
        getDraftKey: () => 'salesbuddy_draft_note_285',
        document: {getElementById: () => ({value: '107'})},
        localStorage: {getItem: key => storage.get(key),
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)}};
    vm.runInNewContext(migration, context);
    assert.equal(context.restoreDraft(), false);
    assert.equal(storage.get('salesbuddy_draft_107'), '{"note_id":null,"content":"protected"}');
    storage.set('salesbuddy_draft_107', '{"note_id":285,"content":"legacy edit"}');
    assert.equal(context.restoreDraft(), '{"note_id":285,"content":"legacy edit"}');
    assert.equal(storage.get('salesbuddy_draft_note_285'), '{"note_id":285,"content":"legacy edit"}');
    assert.equal(storage.has('salesbuddy_draft_107'), false);
});

test('read-only editor navigation never creates or replaces a draft', () => {
    const start = template.indexOf("window.addEventListener('beforeunload', function(e)");
    const end = template.indexOf('// Clear draft only after successful form submission', start);
    let unload, saves = 0;
    const context = {CURRENT_NOTE_ID: 285, draftNeedsSave: false,
        formSubmittedSuccessfully: false, draftDiscarded: false,
        document: {getElementById: () => ({value: '107'})},
        saveDraft: () => { saves++; },
        window: {addEventListener: (type, handler) => { unload = handler; }}};
    vm.runInNewContext(template.slice(start, end), context);
    unload({});
    assert.equal(saves, 0);
    context.draftNeedsSave = true;
    unload({});
    assert.equal(saves, 1);
    context.CURRENT_NOTE_ID = null;
    context.draftNeedsSave = false;
    unload({});
    assert.equal(saves, 1);
    context.document.getElementById = () => null;
    unload({});
    assert.equal(saves, 1);
    context.draftNeedsSave = true;
    unload({});
    assert.equal(saves, 2);
    context.draftDiscarded = true;
    unload({});
    assert.equal(saves, 2);
    context.draftDiscarded = false;
    context.formSubmittedSuccessfully = true;
    unload({});
    assert.equal(saves, 2);
});

test('context changes select native paired/single layout without legacy shell widths', () => {
    const start = template.indexOf('function _updateColumnLayout()');
    const end = template.indexOf('// Related Notes (dynamically loaded)', start);
    const classes = new Set(['sb-directory-frame']);
    const row = {dataset: {}, classList: {toggle: (name, enabled) =>
        enabled ? classes.add(name) : classes.delete(name)}}, left = {};
    let cards = [], notes = {childElementCount: 0};
    const right = {style: {}, querySelectorAll: () => cards, querySelector: () => notes};
    const context = {document: {getElementById: id => ({
        noteFormRow: row, noteFormLeftCol: left, noteFormRightCol: right,
    })[id]}};
    const layout = template.slice(start, end);
    vm.runInNewContext(layout, context);
    context._updateColumnLayout();
    assert.equal(row.dataset.sbNotePaired, 'false');
    assert.equal(right.style.display, 'none');
    assert.equal(classes.has('sb-directory-frame'), true);
    cards = [{}];
    context._updateColumnLayout();
    assert.equal(row.dataset.sbNotePaired, 'true');
    assert.equal(right.style.display, '');
    assert.equal(classes.has('sb-directory-frame'), false);
    cards = [];
    notes.childElementCount = 2;
    context._updateColumnLayout();
    assert.equal(row.dataset.sbNotePaired, 'true');
    assert.equal(classes.has('sb-directory-frame'), false);
    notes.childElementCount = 0;
    context._updateColumnLayout();
    assert.equal(row.dataset.sbNotePaired, 'false');
    assert.equal(classes.has('sb-directory-frame'), true);
    assert.doesNotMatch(layout, /1900|main\.container|maxWidth|paddingLeft|col-md/);
});

test('native drawer stack uses dialog open state and retains earlier context panes', () => {
    const start = template.indexOf("(function() {\n    const ids = ['partnerFlyout'");
    const end = template.indexOf('})();', start) + 5;
    assert.ok(start >= 0 && end > start, 'the actual drawer-stack controller is selected');
    const ids = ['partnerFlyout', 'engagementFlyout', 'contactsFlyout',
        'customerInfoFlyout', 'projectFlyout'];
    const documentListeners = {};
    const drawers = Object.fromEntries(ids.map(id => {
        const classes = new Set(), listeners = {};
        return [id, {open: false, classes, listeners,
            classList: {remove: (...values) => values.forEach(x => classes.delete(x)),
                add: value => classes.add(value)},
            addEventListener: (type, handler) => {
                (listeners[type] ??= []).push(handler);
            }}];
    }));
    vm.runInNewContext(template.slice(start, end), {
        document: {getElementById: id => drawers[id],
            addEventListener: (type, handler) => {
                (documentListeners[type] ??= []).push(handler);
            }},
    });
    function dispatch(id, type) {
        const event = {type, target: drawers[id], bubbles: true};
        (drawers[id].listeners[type] ?? []).forEach(handler => handler(event));
        (documentListeners[type] ?? []).forEach(handler => handler(event));
    }
    function open(id) {
        dispatch(id, 'sb:dialog-opening');
        drawers[id].open = true;
        dispatch(id, 'sb:dialog-opened');
    }
    open('partnerFlyout');
    open('projectFlyout');
    open('engagementFlyout');
    assert.equal(drawers.partnerFlyout.classes.has('sb-note-drawer-shift-2'), true);
    assert.equal(drawers.projectFlyout.classes.has('sb-note-drawer-shift-1'), true);
    assert.equal(drawers.engagementFlyout.classes.size, 0);
    drawers.engagementFlyout.open = false;
    dispatch('engagementFlyout', 'sb:dialog-closed');
    assert.equal(drawers.partnerFlyout.classes.has('sb-note-drawer-shift-1'), true);
    assert.equal(drawers.projectFlyout.classes.size, 0);
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-note-form.css'), 'utf8');
    assert.match(css, /\.sb-nf-drawer\s*\{[^}]*position:fixed;z-index:1045;/);
    assert.match(css, /body\.copilot-chat-open \.sb-nf-drawer\[open\].*--sb-chat-context-inset,0px/);
    assert.doesNotMatch(template.slice(start, end), /offcanvas|flyout-shifted/);
});

test('a pending note save blocks duplicates and a failed response keeps draft recovery', async () => {
    const start = template.indexOf("document.getElementById('noteForm').addEventListener('submit', async");
    const end = template.indexOf('// Discard draft function', start);
    let submit, respond, clears = 0, requests = 0;
    const button = {disabled: false, innerHTML: ''};
    const form = {action: '/note/new', querySelector: () => button};
    const notices = [];
    const context = {
        document: {getElementById: id => id === 'noteForm' ?
            {addEventListener: (type, handler) => { submit = handler; }} : null},
        selectedMilestones: [], taskCategories: [], formSubmittedSuccessfully: false,
        autoSaveTimeout: null,
        SBNoteForm: {report: (...args) => notices.push(args)},
        FormData: class {},
        fetch: () => { requests++; return new Promise(resolve => { respond = resolve; }); },
        clearDraft: () => { clears++; },
        window: {location: {href: ''}},
        console: {log() {}, error() {}, warn() {}}, clearTimeout() {},
    };
    vm.runInNewContext(template.slice(start, end), context);
    const event = {target: form, preventDefault() {}};
    await submit({...event, defaultPrevented: true});
    assert.equal(requests, 0);
    assert.equal(button.disabled, false);
    await submit(event);
    assert.equal(button.disabled, true);
    await submit(event);
    assert.equal(requests, 1);
    respond({ok: false, redirected: false, status: 500});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(clears, 0);
    assert.equal(context.formSubmittedSuccessfully, false);
    assert.equal(button.disabled, false);
    assert.match(notices.at(-1)[0], /draft has been preserved/);
    await submit(event);
    respond({ok: true, redirected: true, status: 200, url: '/note/9'});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(clears, 1);
    assert.equal(context.formSubmittedSuccessfully, true);
    assert.equal(context.window.location.href, '/note/9');
});
