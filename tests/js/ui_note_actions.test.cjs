const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-note-actions.js'), 'utf8');

function editor({missing, noteId = '7'} = {}) {
    const windowListeners = new Map(), queue = [], requests = [], errors = [];
    const document = {querySelectorAll: () => [], activeElement: null};
    class Element {
        constructor(value = '') {
            this.value = value; this.dataset = {}; this.handlers = new Map();
            this.hidden = true; this.disabled = false; this.isConnected = true;
        }
        addEventListener(type, handler, options) {
            this.handlers.set(type, handler);
            options?.signal.addEventListener('abort', () => this.handlers.delete(type));
        }
        focus() { document.activeElement = this; }
        dispatchEvent() { return true; }
    }
    const fields = new Map([
        ['form', new Element()], ['#noteTaskTitle', new Element()],
        ['#noteTaskEngagement', new Element('42')], ['#noteTaskDue', new Element('2026-10-05')],
        ['#noteTaskResult', new Element()], ['button[type="submit"]', new Element()],
    ]);
    if (missing) fields.delete(missing);
    const root = new Element();
    root.dataset.sbNoteId = noteId;
    root.querySelector = selector => fields.get(selector);
    const context = {
        window: {addEventListener: (type, handler) => windowListeners.set(type, handler)},
        document, AbortController,
        CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
        console: {error: (...args) => errors.push(args)},
        fetch: async (url, options) => {
            requests.push({url, options});
            const result = queue.shift();
            if (result instanceof Error) throw result;
            return result;
        },
    };
    vm.runInNewContext(source, context);
    const mount = () => context.window.SBNoteActions.mount({querySelectorAll: () => [root]});
    const instance = mount();
    const submit = () => fields.get('form').handlers.get('submit')({preventDefault() {}});
    const reply = (payload, ok = true) => ({ok, json: async () => payload});
    return {instance, fields, root, document, queue, requests, errors, mount, submit, reply,
        unload() { const e = {prevented: false, preventDefault() { this.prevented = true; }};
            windowListeners.get('beforeunload')(e); return e; }};
}

test('shared action editor saves the same payload, resets only title and marks the draft clean', async () => {
    const h = editor();
    assert.equal(h.instance.isDirty(), false);
    h.fields.get('#noteTaskTitle').value = '  Follow up  ';
    assert.equal(h.instance.isDirty(), true);
    assert.equal(h.unload().prevented, true);
    h.queue.push(h.reply({success: true}));
    await h.submit();
    assert.equal(h.requests[0].url, '/engagement/42/action-items');
    assert.equal(h.requests[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(h.requests[0].options.body),
        {title: 'Follow up', due_date: '2026-10-05', note_id: 7});
    assert.equal(h.fields.get('#noteTaskTitle').value, '');
    assert.equal(h.fields.get('#noteTaskDue').value, '2026-10-05');
    assert.equal(h.fields.get('#noteTaskResult').dataset.sbState, 'success');
    assert.equal(h.instance.isDirty(), false);
    assert.equal(h.unload().prevented, false);
});

test('in-flight saves disable controls and duplicate submissions do not create duplicate writes', async () => {
    const h = editor();
    h.fields.get('#noteTaskTitle').value = 'Follow up';
    let resolve;
    h.queue.push(new Promise(done => { resolve = done; }));
    const pending = h.submit();
    assert.equal(h.instance.isBusy(), true);
    assert.equal(h.fields.get('#noteTaskTitle').disabled, true);
    await h.submit();
    assert.equal(h.requests.length, 1);
    assert.equal(h.unload().prevented, true);
    resolve(h.reply({success: true}));
    await pending;
    assert.equal(h.instance.isBusy(), false);
    assert.equal(h.fields.get('#noteTaskTitle').disabled, false);
});

test('failed, malformed and network saves retain the draft and report a retryable error', async () => {
    for (const bad of [h => h.reply({success: false, error: 'Invalid date'}, false),
        h => h.reply({}), () => new Error('Network unavailable'),
        () => ({ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); }})]) {
        const h = editor();
        h.fields.get('#noteTaskTitle').value = 'Draft';
        h.queue.push(bad(h));
        await h.submit();
        assert.equal(h.fields.get('#noteTaskTitle').value, 'Draft');
        assert.equal(h.instance.isDirty(), true);
        assert.equal(h.fields.get('#noteTaskResult').dataset.sbState, 'error');
        assert.equal(h.errors.length, 1);
        assert.equal(h.instance.isBusy(), false);
    }
});

test('blank titles and invalid engagements never send a write', async () => {
    const h = editor();
    await h.submit();
    assert.equal(h.document.activeElement, h.fields.get('#noteTaskTitle'));
    h.fields.get('#noteTaskTitle').value = 'Draft';
    h.fields.get('#noteTaskEngagement').value = 'invalid';
    await h.submit();
    assert.equal(h.requests.length, 0);
    assert.equal(h.fields.get('#noteTaskResult').hidden, false);
});

test('engagement/date changes are dirty, restoring values is clean, disconnected editors do not warn', () => {
    const h = editor();
    for (const [selector, changed] of [['#noteTaskEngagement', '43'],
        ['#noteTaskDue', '2026-10-06']]) {
        const field = h.fields.get(selector), original = field.value;
        field.value = changed;
        assert.equal(h.instance.isDirty(), true);
        field.value = original;
        assert.equal(h.instance.isDirty(), false);
    }
    h.fields.get('#noteTaskTitle').value = 'Draft';
    h.root.isConnected = false;
    assert.equal(h.unload().prevented, false);
});

test('mount is idempotent and disposal removes handlers and unload guards', () => {
    const h = editor();
    h.mount();
    assert.equal(h.fields.get('form').handlers.size, 1);
    h.fields.get('#noteTaskTitle').value = 'Draft';
    h.instance.dispose();
    assert.equal(h.fields.get('form').handlers.size, 0);
    assert.equal(h.unload().prevented, false);
    const reopened = h.mount();
    assert.equal(reopened.isDirty(), false);
    assert.equal(h.fields.get('form').handlers.size, 1);
});

test('required markup and note identity fail explicitly instead of mounting a broken editor', () => {
    assert.throws(() => editor({missing: '#noteTaskDue'}), /Missing note action control/);
    assert.throws(() => editor({noteId: 'invalid'}), /Invalid note action ID/);
    assert.doesNotMatch(source, /bootstrap|createTaskFromNote/);
});
