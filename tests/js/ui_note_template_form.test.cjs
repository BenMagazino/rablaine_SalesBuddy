const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const lifecycle = fs.readFileSync(require.resolve('../../static/js/ui-milestone-form.js'), 'utf8');
const editorSource = fs.readFileSync(require.resolve('../../static/js/ui-note-template-form.js'), 'utf8');
function harness({posted = false, saved, key = 'edit-1', deferred = false} = {}) {
    const element = extra => ({events: {}, value: '', hidden: true, disabled: false,
        scrollTop: 0, innerHTML: '', attrs: {}, validity: {valid: true},
        addEventListener(t, fn) { (this.events[t] ??= []).push(fn); },
        dispatchEvent(e) { (this.events[e.type] ?? []).forEach(fn => fn(e)); },
        setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
        ...extra});
    const name = element({value: 'Original'}), content = element({value: '<h2>Original</h2>'});
    const reading = element(), cancel = element();
    const form = element({elements: {name, content}, dataset: {formKey: key, posted: String(posted)},
        querySelector: s => s === '[data-template-cancel]' ? cancel : reading});
    const ids = {templateForm: form};
    content.dispatchEvent = e => form.dispatchEvent(e);
    ['Save', 'State', 'Notice', 'Discard', 'DiscardConfirm'].forEach(s =>
        ids['templateForm' + s] = element({innerHTML: 'Update Template'}));
    const listeners = {}, documentEvents = {}, destinations = [], timers = new Map();
    let timerId = 0, writes = 0;
    let quill;
    class Quill {
        constructor() {
            quill = this; this.root = element(); this.selection = null; this.events = {};
            this.clipboard = {convert: html => html};
        }
        update() {}
        setContents(html) { this.root.innerHTML = html; }
        getText() { return this.root.innerHTML.replace(/<[^>]*>/g, ''); }
        getSelection() { return this.selection; }
        setSelection(index, length) { this.selection = {index, length}; }
        on(t, fn) { this.events[t] = fn; }
        focus() { this.focused = true; }
    }
    const root = {document: {getElementById: id => ids[id], querySelector: () => null,
        addEventListener(t, fn) { documentEvents[t] = fn; }}, Quill,
        SBTemplateHTML: {sanitize: html => html},
        history: {state: {other: 'preserved', ...(saved ? {sbTemplateForm: saved} : {})},
            replaceState(value) { this.state = value; writes++; }},
        setTimeout(fn) {
            const id = ++timerId;
            if (deferred) timers.set(id, fn); else fn();
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        addEventListener(t, fn) { listeners[t] = fn; },
        SBDialog: {open(d) { d.open = true; }, close(d) { d.open = false; }},
        location: {assign(url) { destinations.push(url); }}, console};
    class Event { constructor(type) { this.type = type; this.target = content; } }
    vm.runInNewContext(editorSource, {window: root, Event});
    vm.runInNewContext(lifecycle, {window: root});
    return {root, ids, form, name, content, reading, quill, listeners, documentEvents,
        destinations, timers, writes: () => writes};
}
const event = () => ({defaultPrevented: false, button: 0,
    preventDefault() { this.defaultPrevented = true; }});
function leave(h) {
    const e = event(); e.target = {closest: () => ({href: '/preferences', target: '',
        hasAttribute: () => false, getAttribute: () => '/preferences'})};
    h.documentEvents.click(e); return e;
}
function submit(h) {
    const e = event(); h.form.dispatchEvent({...e, type: 'submit',
        preventDefault() { this.defaultPrevented = true; }}); return e;
}
test('New/Edit exact raw HTML stays untouched until a real editor change', () => {
    for (const key of ['new', 'edit-1']) {
        const h = harness({key});
        assert.equal(h.content.value, '<h2>Original</h2>');
        assert.equal(h.quill.root.innerHTML, h.content.value);
        h.quill.root.innerHTML = '<p><strong>Typed</strong></p>';
        h.quill.events['text-change']();
        assert.equal(h.content.value, '<p><strong>Typed</strong></p>');
        assert.equal(h.ids.templateFormState.textContent, 'Unsaved changes');
        assert.equal(h.root.history.state.other, 'preserved');
    }
});
test('Back restores raw HTML, selection, editor and reading scroll with guarded cancellation', () => {
    const h = harness();
    h.quill.root.innerHTML = '<h3>Draft</h3>'; h.quill.events['text-change']();
    h.quill.selection = {index: 2, length: 3}; h.quill.root.scrollTop = 140;
    h.reading.scrollTop = 25; h.reading.dispatchEvent({type: 'scroll'});
    const saved = h.root.history.state.sbTemplateForm;
    const restored = harness({saved});
    assert.equal(restored.quill.root.innerHTML, '<h3>Draft</h3>');
    assert.deepEqual(restored.quill.selection, {index: 2, length: 3});
    assert.equal(restored.quill.root.scrollTop, 140);
    assert.equal(restored.reading.scrollTop, 25);
    assert.equal(leave(restored).defaultPrevented, true);
    assert.equal(restored.ids.templateFormDiscard.open, true);
    restored.root.SBDialog.close(restored.ids.templateFormDiscard);
    assert.equal(restored.content.value, '<h3>Draft</h3>');
    leave(restored);
    restored.ids.templateFormDiscardConfirm.dispatchEvent({type: 'click'});
    assert.equal(restored.root.history.state.sbTemplateForm, undefined);
    assert.deepEqual(restored.destinations, ['/preferences']);
});
test('empty editor prevents lifecycle pending; nonempty POST keeps fields enabled and blocks duplicates', () => {
    const h = harness(); h.quill.root.innerHTML = '<p><br></p>';
    h.quill.events['text-change'](); submit(h);
    assert.equal(h.ids.templateFormSave.disabled, false);
    assert.equal(h.quill.focused, true);
    assert.equal(h.ids.templateFormNotice.textContent, 'Template content cannot be empty.');
    h.quill.root.innerHTML = '<p>Ready</p>'; h.quill.events['text-change'](); submit(h);
    assert.equal(h.ids.templateFormSave.disabled, true);
    assert.equal(h.form.inert, true);
    assert.equal(h.content.disabled, false);
    assert.equal(h.name.disabled, false);
    assert.equal(leave(h).defaultPrevented, true);
    const duplicate = event(); duplicate.type = 'submit'; h.form.dispatchEvent(duplicate);
    assert.equal(duplicate.defaultPrevented, true);
    h.listeners.pageshow(); assert.equal(h.form.inert, false);
});
test('failed raw input beats stale Back state; corrupt editor history is rejected', () => {
    const h = harness(); h.quill.root.innerHTML = '<p>stale</p>'; h.quill.events['text-change']();
    const failed = harness({posted: true, saved: h.root.history.state.sbTemplateForm});
    assert.equal(failed.content.value, '<h2>Original</h2>');
    assert.equal(leave(failed).defaultPrevented, true);
    const {validateTemplateView} = require('../../static/js/ui-milestone-form.js');
    assert.throws(() => validateTemplateView({key: 'new', fields: {name: '', content: ''},
        checked: [], scroll: 0, noteScroll: 0, editor: {scroll: 0, selection: {index: -1, length: 0}}},
    'new', ['name', 'content']));
    assert.doesNotMatch(editorSource, /fetch\(|XMLHttpRequest|setInterval|localStorage/);
});
test('rich typing snapshots debounce and unload flushes the exact final payload', () => {
    const h = harness({deferred: true});
    for (let i = 0; i < 500; i++) {
        h.quill.root.innerHTML = `<p>Draft ${i}</p>`; h.quill.events['text-change']();
    }
    assert.equal(h.writes(), 0);
    assert.equal(h.timers.size, 1);
    h.listeners.beforeunload(event());
    assert.equal(h.writes(), 1);
    assert.equal(h.timers.size, 0);
    assert.equal(h.root.history.state.sbTemplateForm.fields.content, '<p>Draft 499</p>');
});
test('actual Note consumer script keeps arrow selection inert and inserts API HTML by replace/prepend', async () => {
    const source = fs.readFileSync(require.resolve('../../templates/note_form.html'), 'utf8');
    const script = source.split('// --- Template selector logic ---')[1]
        .split('// --- Engagement multi-select dropdown ---')[0];
    const documentEvents = {};
    class Dialog {
        constructor() {
            this.value = '';
            this.open = false;
            this.events = {};
            this.classes = new Set();
            this.classList = {add: name => this.classes.add(name),
                remove: name => this.classes.delete(name)};
        }
        addEventListener(type, handler) { (this.events[type] ??= []).push(handler); }
        dispatchEvent(event) {
            event.target = this;
            (this.events[event.type] ?? []).forEach(handler => handler.call(this, event));
            if (event.bubbles) {
                (documentEvents[event.type] ?? []).forEach(handler => handler(event));
            }
        }
    }
    const elements = Object.fromEntries(['templateSelect', 'templateApplyName', 'templateReplaceBtn',
        'templatePrependBtn', 'templateApplyModal'].map(id => [id, new Dialog()]));
    const quill = {root: {innerHTML: ''}, getText() {
        return this.root.innerHTML.replace(/<[^>]*>/g, ''); }};
    const fetched = [], sanitized = [], window = {};
    const context = vm.createContext({window, queueMicrotask, HTMLDialogElement: Dialog,
        document: {getElementById: id => elements[id], querySelector: () => null,
            querySelectorAll: () => [], addEventListener(type, handler) {
                (documentEvents[type] ??= []).push(handler);
            }}, quill,
        SBTemplateHTML: {sanitize(html) { sanitized.push(html); return html; }},
        SBDialog: {
            open(dialog) {
                dialog.dispatchEvent({type: 'sb:dialog-opening', bubbles: true});
                dialog.open = true;
                dialog.dispatchEvent({type: 'sb:dialog-opened', bubbles: true});
            },
            close(dialog) {
                dialog.open = false;
                dialog.dispatchEvent({type: 'sb:dialog-closed', bubbles: true});
            },
        },
        fetch: async path => { fetched.push(path); return {json: async () => ({
            content: '<h2>Template</h2>', name: 'Example'})}; }});
    const nativeSource = fs.readFileSync(
        require.resolve('../../static/js/ui-note-form-native.js'), 'utf8');
    vm.runInContext(nativeSource, context);
    context.SBNoteForm = window.SBNoteForm;
    vm.runInContext(script, context);
    const select = elements.templateSelect; select.value = '7';
    select.dispatchEvent({type: 'change'}); assert.equal(fetched.length, 0);
    select.dispatchEvent({type: 'keydown', key: 'Enter'});
    select.dispatchEvent({type: 'change'});
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(fetched, ['/api/templates/7']);
    assert.equal(quill.root.innerHTML, '<h2>Template</h2>');
    quill.root.innerHTML = '<p>Existing</p>'; select.value = '7';
    select.dispatchEvent({type: 'mousedown'}); select.dispatchEvent({type: 'change'});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(quill.root.innerHTML, '<p>Existing</p>');
    assert.equal(elements.templateApplyModal.open, true);
    assert.equal(elements.templateApplyModal.classes.has('show'), true);
    elements.templatePrependBtn.dispatchEvent({type: 'click'});
    assert.equal(quill.root.innerHTML, '<h2>Template</h2><hr><p>Existing</p>');
    assert.equal(elements.templateApplyModal.open, false);
    elements.templateReplaceBtn.dispatchEvent({type: 'click'});
    assert.equal(quill.root.innerHTML, '<h2>Template</h2>');
    assert.equal(sanitized.length, 3);
    select.value = '7';
    context.SBDialog.close(elements.templateApplyModal);
    assert.equal(select.value, '');
});
test('sanitizer removes executable nodes and attributes while preserving trusted formats', () => {
    const source = fs.readFileSync(require.resolve('../../static/js/ui-template-html.js'), 'utf8');
    const attributes = [{name: 'onclick', value: 'bad()'}, {name: 'href', value: 'java\nscript:bad()'},
        {name: 'style', value: 'background:url(x)'}, {name: 'class', value: 'ql-indent-1'},
        {name: 'title', value: 'Trusted'}];
    const removed = [], node = {attributes, removeAttribute(n) { removed.push(n); }};
    let discarded = false;
    const fragment = {innerHTML: '<h2>Trusted</h2>', content: {
        querySelectorAll(selector) { return selector === '*' ? [node] : [
            {remove() { discarded = true; }}]; }}};
    const root = {document: {createElement: () => fragment}};
    vm.runInNewContext(source, {window: root});
    assert.equal(root.SBTemplateHTML.sanitize('<h2>Trusted</h2>'), '<h2>Trusted</h2>');
    assert.equal(discarded, true);
    assert.deepEqual(removed, ['onclick', 'href', 'style']);
});
