const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-record-dialog.js'), 'utf8');

function record() {
    const requests = [], mounts = [], errors = [], navigations = [];
    class Event {
        constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
        preventDefault() { this.defaultPrevented = true; }
    }
    class Element {
        constructor() {
            this.handlers = new Map(); this.attributes = new Map();
            this.hidden = true; this.open = false; this.textContent = '';
        }
        addEventListener(type, handler) {
            if (!this.handlers.has(type)) this.handlers.set(type, []);
            this.handlers.get(type).push(handler);
        }
        dispatchEvent(event) {
            event.target ||= this;
            for (const handler of this.handlers.get(event.type) || []) handler(event);
            return !event.defaultPrevented;
        }
        setAttribute(name, value) { this.attributes.set(name, value); }
        getAttribute(name) { return this.attributes.get(name) || null; }
        hasAttribute(name) { return this.attributes.has(name); }
        focus() {}
        replaceChildren(fragment) { this.fragment = fragment || null; }
        closest() { return this.href ? this : null; }
    }
    const dialog = new Element(), discard = new Element(), confirm = new Element();
    const fields = new Map(['title', 'full-link', 'content', 'loading', 'error', 'retry', 'status']
        .map(name => [`[data-sb-record-${name}]`, new Element()]));
    fields.set('[data-sb-dialog-close]', new Element());
    dialog.querySelector = selector => fields.get(selector);
    const document = {
        getElementById: id => id === 'recordDiscardDialog' ? discard : confirm,
        createElement(tag) {
            assert.equal(tag, 'template');
            const template = {content: {querySelector: () => ({
                getAttribute: () => template.innerHTML.match(/data-id="(\d+)"/)?.[1] || null,
            })}};
            return template;
        },
    };
    const SBDialog = {
        open(element) { element.open = true; },
        close(element, reason = 'close') {
            if (!element.open) return;
            if (!element.dispatchEvent(new Event('sb:dialog-before-close', {
                cancelable: true, detail: {reason},
            }))) return;
            element.open = false;
            element.dispatchEvent(new Event('sb:dialog-closed'));
        },
    };
    const window = {};
    vm.runInNewContext(source, {window, document, Element, CustomEvent: Event, URL, AbortController,
        location: {href: 'http://127.0.0.1:5000/', assign: url => navigations.push(url)},
        SBDialog, SBLocalDateTime: {render() {}},
        console: {error: (...args) => errors.push(args)},
        fetch: (url, options) => new Promise((resolve, reject) =>
            requests.push({url, options, resolve, reject})),
    });
    const options = {
        loadUrl: id => `/api/note/${id}/detail`, fullUrl: id => `/note/${id}`,
        fragmentSelector: '[data-detail]', identityAttribute: 'data-id',
        mount() {
            const state = {dirty: false, busy: false, disposed: 0};
            mounts.push(state);
            return {isDirty: () => state.dirty, isBusy: () => state.busy,
                dispose: () => state.disposed++};
        },
    };
    const api = window.SBRecordDialog.create(dialog, options);
    const field = name => fields.get(`[data-sb-record-${name}]`);
    const reply = (index, id, extra = {}) => requests[index].resolve({
        ok: true, headers: {get: () => 'text/html; charset=utf-8'},
        text: async () => `<div data-detail data-id="${id}"></div>`, ...extra,
    });
    const open = id => api.open({id, title: `Note ${id}`});
    return {api, open, reply, fields, field, requests, mounts, errors, navigations,
        dialog, discard, confirm, SBDialog, Event, Element, options, window,
        clickLink(attributes = {}, modifiers = {}) {
            const link = new Element();
            link.href = 'http://127.0.0.1:5000/note/7';
            link.setAttribute('href', '/note/7');
            Object.assign(link, attributes);
            const event = new Event('click', {target: link, ...modifiers});
            dialog.dispatchEvent(event);
            return event;
        }};
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('record loads lazily, preserves identity/Full Page and mounts/disposes once', async () => {
    const h = record();
    const pending = h.open(7);
    assert.equal(h.field('loading').hidden, false);
    assert.equal(h.field('full-link').href, '/note/7');
    assert.equal(h.field('title').textContent, 'Note 7');
    h.reply(0, 7);
    await pending;
    assert.equal(h.field('content').hidden, false);
    h.open(7);
    assert.equal(h.requests.length, 1);
    h.SBDialog.close(h.dialog);
    assert.equal(h.mounts[0].disposed, 1);
    assert.equal(h.field('content').fragment, null);
    assert.equal(h.window.SBRecordDialog.create(h.dialog, h.options), h.api);
});

test('HTTP, response-type, identity and network failures are explicit and Retry can recover', async () => {
    for (const failure of ['http', 'type', 'identity', 'network']) {
        const h = record();
        const pending = h.open(7);
        if (failure === 'network') h.requests[0].reject(new Error('Network failure'));
        else h.reply(0, failure === 'identity' ? 8 : 7,
            failure === 'http' ? {ok: false, status: 503} :
                failure === 'type' ? {headers: {get: () => 'application/json'}} : {});
        await pending;
        assert.equal(h.field('error').hidden, false);
        assert.equal(h.errors.length, 1);
        assert.equal(h.mounts.length, 0);
        h.field('retry').dispatchEvent(new h.Event('click'));
        h.reply(1, 7);
        await settle();
        assert.equal(h.field('content').hidden, false);
        assert.equal(h.field('error').hidden, true);
        assert.equal(h.mounts.length, 1);
    }
});

test('closed/replaced reads are aborted and late replies cannot overwrite the current record', async () => {
    const h = record();
    const first = h.open(7), second = h.open(8);
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.reply(1, 8);
    await second;
    h.reply(0, 7);
    await first;
    assert.equal(h.mounts.length, 1);
    assert.equal(h.field('title').textContent, 'Note 8');
    const third = h.open(9);
    h.SBDialog.close(h.dialog);
    assert.equal(h.requests[2].options.signal.aborted, true);
    h.reply(2, 9);
    await third;
    assert.equal(h.field('content').fragment, null);
    assert.equal(h.mounts[0].disposed, 1);
});

test('Keep editing retains the draft, Discard executes the captured close or record switch', async () => {
    const h = record();
    const pending = h.open(7); h.reply(0, 7); await pending;
    h.mounts[0].dirty = true;
    h.SBDialog.close(h.dialog, 'escape');
    assert.equal(h.dialog.open, true);
    assert.equal(h.discard.open, true);
    h.SBDialog.close(h.discard, 'escape');
    assert.equal(h.dialog.open, true);
    assert.equal(h.mounts[0].disposed, 0);
    h.open(8);
    h.confirm.dispatchEvent(new h.Event('click'));
    assert.equal(h.field('title').textContent, 'Note 8');
    assert.equal(h.mounts[0].disposed, 1);
    h.reply(1, 8); await settle();
    h.mounts[1].dirty = true;
    h.SBDialog.close(h.dialog, 'button');
    h.confirm.dispatchEvent(new h.Event('click'));
    assert.equal(h.dialog.open, false);
    assert.equal(h.mounts[1].disposed, 1);
});

test('in-flight saves block close, record replacement and same-tab navigation', async () => {
    const h = record();
    const pending = h.open(7); h.reply(0, 7); await pending;
    h.mounts[0].busy = true;
    h.SBDialog.close(h.dialog);
    h.open(8);
    assert.equal(h.clickLink().defaultPrevented, true);
    assert.equal(h.dialog.open, true);
    assert.equal(h.discard.open, false);
    assert.equal(h.requests.length, 1);
    assert.equal(h.mounts[0].disposed, 0);
    h.mounts[0].busy = false;
    h.dialog.dispatchEvent(new h.Event('sb:note-action-state'));
    assert.doesNotMatch(h.field('status').textContent, /Saving/);
    h.SBDialog.close(h.dialog);
    assert.equal(h.dialog.open, false);
});

test('guarded links navigate only after Discard; modified/new-tab/download links keep native behavior', async () => {
    const h = record();
    const pending = h.open(7); h.reply(0, 7); await pending;
    h.mounts[0].dirty = true;
    assert.equal(h.clickLink().defaultPrevented, true);
    h.confirm.dispatchEvent(new h.Event('click'));
    assert.deepEqual(h.navigations, ['http://127.0.0.1:5000/note/7']);
    assert.equal(h.mounts[0].disposed, 1);
    for (const [attributes, modifiers] of [[{target: '_blank'}, {}], [{target: 'other'}, {}],
        [{hasAttribute: () => true}, {}], [{}, {ctrlKey: true}], [{}, {button: 1}],
        [{}, {defaultPrevented: true}]]) {
        h.clickLink(attributes, modifiers);
        assert.equal(h.discard.open, false);
    }
});

test('invalid selections fail explicitly and fragments never invoke arbitrary script activation', () => {
    const h = record();
    for (const snapshot of [null, {id: 0, title: 'bad'}, {id: '7', title: 'bad'}, {id: 7}]) {
        assert.throws(() => h.api.open(snapshot), /Invalid record selection/);
    }
    assert.doesNotMatch(source, /eval\(|createElement\(['"]script|new Function|bootstrap/);
});

test('mount failures clear partial content and surface a visible load error', async () => {
    const h = record();
    h.options.mount = () => { throw new Error('Broken editor markup'); };
    const pending = h.open(7);
    h.reply(0, 7);
    await pending;
    assert.equal(h.field('content').fragment, null);
    assert.equal(h.field('error').hidden, false);
    assert.equal(h.errors.length, 1);
});
