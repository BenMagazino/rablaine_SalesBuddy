const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(initial = {}) {
    const elements = new Map(), callbacks = {}, requests = [], events = [];
    const storage = new Map(Object.entries(initial));
    let focused, activeDialog;
    let responder = async () => ({success: true, reply: 'Answer', tools_used: ['search_notes']});
    class Element {
        constructor(id) {
            this.id = id; this.handlers = {}; this.children = []; this.attributes = {};
            this.style = {}; this.hidden = id === 'copilotChatFlyout'; this.value = '';
            this.scrollHeight = 80; this.disabled = false; this.classes = new Set();
            this.classList = {add: x => this.classes.add(x), remove: x => this.classes.delete(x)};
            if (id) elements.set(id, this);
        }
        addEventListener(type, fn) { this.handlers[type] = fn; }
        async fire(type, props = {}) {
            const event = {...props, preventDefault() { this.prevented = true; },
                stopPropagation() { this.stopped = true; }};
            await this.handlers[type]?.call(this, event); return event;
        }
        setAttribute(key, value) { this.attributes[key] = value; }
        removeAttribute(key) { delete this.attributes[key]; }
        focus() { focused = this.id; }
        appendChild(child) { this.children.push(child); if (child.id) elements.set(child.id, child); }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        querySelector() { return null; }
        remove() { elements.delete(this.id); }
        set innerHTML(value) { this.html = value; if (this.id === 'copilotChatMessages') this.children = []; }
        get innerHTML() { return this.html || ''; }
    }
    for (const id of ['copilotChatFlyout', 'navCopilotChat', 'copilotChatMessages',
        'copilotChatInput', 'copilotChatSend', 'copilotChatClear', 'copilotChatClose'])
        new Element(id);
    const body = new Element('body');
    const document = {
        body, getElementById: id => elements.get(id), createElement: () => new Element(),
        createTextNode: text => ({textContent: text}),
        querySelector: selector =>
            selector === '.sb-dialog[open]:not([data-sb-nonmodal="true"])' &&
            activeDialog?.dataset?.sbNonmodal !== 'true' ? activeDialog : null,
        dispatchEvent(event) { events.push(event); },
        addEventListener(type, fn) { callbacks[type] = fn; },
    };
    const window = {location: {pathname: '/customer/42'}};
    const source = fs.readFileSync('templates/partials/_copilot_chat_js.html', 'utf8')
        .split('<script>')[1].split('</script>')[0];
    vm.runInNewContext(source, {
        document, window, sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        requestAnimationFrame: fn => fn(),
        CustomEvent: class {
            constructor(type, options) { this.type = type; this.detail = options.detail; }
        },
        fetch: async (url, options) => {
            requests.push({url, body: JSON.parse(options.body)});
            const data = await responder();
            return {ok: true, json: async () => data};
        },
    });
    callbacks.DOMContentLoaded();
    return {elements, callbacks, requests, events, storage, window,
        focused: () => focused, responder: fn => { responder = fn; },
        setDialog: dialog => { activeDialog = dialog; },
        messages: () => elements.get('copilotChatMessages').children};
}

test('chat opens natively, focuses composer and closes with focus returned without clearing drafts', async () => {
    const h = harness(), pane = h.elements.get('copilotChatFlyout');
    await h.elements.get('navCopilotChat').fire('click');
    assert.equal(pane.hidden, false); assert.equal(h.focused(), 'copilotChatInput');
    h.elements.get('copilotChatInput').value = 'Unsent draft';
    const event = await pane.fire('keydown', {key: 'Escape'});
    assert.equal(event.prevented, true); assert.equal(pane.hidden, true);
    assert.equal(h.focused(), 'navCopilotChat');
    await h.elements.get('navCopilotChat').fire('click');
    assert.equal(h.elements.get('copilotChatInput').value, 'Unsent draft');
    assert.equal(h.requests.length, 0);
    assert.deepEqual(h.events.map(event => [event.type, event.detail.open, event.detail.width]),
        [['sb:chat-opened', true, 500], ['sb:chat-closed', false, 500],
            ['sb:chat-opened', true, 500]]);
});

test('existing open state and messages restore on navigation without requesting AI', () => {
    const h = harness({copilotChatOpen: '1',
        copilotChatHistory: JSON.stringify([{role: 'user', content: 'Saved question'},
            {role: 'assistant', content: '[Source](https://example.test/source)'}])});
    assert.equal(h.elements.get('copilotChatFlyout').hidden, false);
    assert.equal(h.messages().length, 2);
    assert.match(h.messages()[1].innerHTML, /href="https:\/\/example.test\/source"/);
    assert.equal(h.requests.length, 0);
});

test('chat keyboard yields to handled events and active native dialogs', async () => {
    const h = harness(), pane = h.elements.get('copilotChatFlyout');
    const shortcut = {ctrlKey: true, shiftKey: true, key: 'c',
        preventDefault() { this.prevented = true; }};
    h.callbacks.keydown({...shortcut, defaultPrevented: true});
    assert.equal(pane.hidden, true);
    h.setDialog({open: true});
    h.callbacks.keydown(shortcut);
    assert.equal(pane.hidden, true);
    await h.elements.get('navCopilotChat').fire('click');
    await pane.fire('keydown', {key: 'Escape'});
    assert.equal(pane.hidden, false);
    h.elements.get('copilotChatInput').value = 'Handled editor event';
    await h.elements.get('copilotChatInput').fire('keydown',
        {key: 'Enter', defaultPrevented: true});
    assert.equal(h.requests.length, 0);
});

test('nonmodal note drawers do not disable chat shortcuts, Escape, drafts or navigation', async () => {
    const h = harness(), pane = h.elements.get('copilotChatFlyout');
    h.setDialog({open: true, dataset: {sbNonmodal: 'true'}});
    h.window.copilotContext = {page: 'customer_view', customer_id: 42};
    const shortcut = {ctrlKey: true, shiftKey: true, key: 'c',
        preventDefault() { this.prevented = true; }};
    h.callbacks.keydown(shortcut);
    assert.equal(pane.hidden, false);
    assert.equal(shortcut.prevented, true);
    h.elements.get('copilotChatInput').value = 'Independent chat draft';
    const escape = await pane.fire('keydown', {key: 'Escape'});
    assert.equal(escape.prevented, true);
    assert.equal(pane.hidden, true);
    assert.equal(h.elements.get('copilotChatInput').value, 'Independent chat draft');
    await h.elements.get('navCopilotChat').fire('click');
    assert.equal(pane.hidden, false);
    assert.equal(h.elements.get('copilotChatInput').value, 'Independent chat draft');
    await h.elements.get('copilotChatSend').fire('click');
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].body.message, 'Independent chat draft');
    assert.equal(h.requests[0].body.context.customer_id, 42);
});

test('sending preserves detected context, tools, native markdown tables and citation links', async () => {
    const h = harness();
    h.responder(async () => ({success: true,
        reply: '| Name | Value |\n| --- | --- |\n| A | 1 |\n\n[Source](https://example.test)',
        tools_used: ['search_notes']}));
    h.elements.get('copilotChatInput').value = 'Question';
    await h.elements.get('copilotChatSend').fire('click');
    assert.equal(h.requests[0].url, '/api/ai/chat');
    assert.equal(h.requests[0].body.context.page, 'customer_view');
    assert.equal(h.requests[0].body.message, 'Question');
    assert.ok(h.messages().some(e => /sb-chat-table/.test(e.innerHTML)));
    assert.ok(h.messages().some(e => /href="https:\/\/example.test"/.test(e.innerHTML)));
    const tools = h.messages().find(e => e.className === 'copilot-tools-badge');
    assert.equal(tools.children[1].textContent, ' search_notes');
    assert.equal(h.elements.get('copilotChatSend').disabled, false);
    assert.equal(h.elements.get('copilotChatClear').disabled, false);
    assert.equal(JSON.parse(h.storage.get('copilotChatHistory')).length, 2);
});

test('pending request prevents duplicate sends and clearing the conversation', async () => {
    const h = harness(); let finish;
    h.responder(() => new Promise(resolve => { finish = resolve; }));
    h.elements.get('copilotChatInput').value = 'Question';
    const pending = h.elements.get('copilotChatSend').fire('click');
    assert.equal(h.elements.get('copilotChatClear').disabled, true);
    await h.elements.get('copilotChatClear').fire('click');
    h.elements.get('copilotChatInput').value = 'Next question';
    await h.elements.get('copilotChatSend').fire('click');
    assert.equal(h.requests.length, 1);
    assert.equal(JSON.parse(h.storage.get('copilotChatHistory')).length, 1);
    finish({success: true, reply: 'Finished'}); await pending;
    assert.equal(h.elements.get('copilotChatClear').disabled, false);
});

for (const kind of ['api', 'network']) {
    test(`${kind} failure removes pending state and leaves the conversation retryable`, async () => {
        const h = harness();
        h.responder(async () => {
            if (kind === 'network') throw new Error('Offline');
            return {success: false, error: 'Unavailable'};
        });
        h.elements.get('copilotChatInput').value = 'Question';
        await h.elements.get('copilotChatSend').fire('click');
        assert.equal(h.elements.has('copilotTyping'), false);
        assert.equal(h.elements.get('copilotChatSend').disabled, false);
        assert.equal(h.elements.get('copilotChatMessages').attributes['aria-busy'], undefined);
        assert.ok(h.messages().some(e => /Unavailable|Network error/.test(e.innerHTML)));
    });
}

test('Enter sends, Shift+Enter stays a newline and page-specific context takes precedence', async () => {
    const h = harness(); h.window.copilotContext = {page: 'note_view', note_id: 17};
    const input = h.elements.get('copilotChatInput'); input.value = 'Question';
    await input.fire('keydown', {key: 'Enter', shiftKey: true});
    assert.equal(h.requests.length, 0);
    await input.fire('keydown', {key: 'Enter', shiftKey: false});
    assert.equal(h.requests[0].body.context.note_id, 17);
});

test('clear removes stored history and restores the original empty-state invitation', async () => {
    const h = harness({copilotChatHistory: JSON.stringify([{role: 'user', content: 'Saved'}])});
    await h.elements.get('copilotChatClear').fire('click');
    assert.equal(h.storage.has('copilotChatHistory'), false);
    assert.match(h.elements.get('copilotChatMessages').innerHTML, /sb-chat-welcome/);
    assert.equal(h.requests.length, 0);
});

test('Ctrl+Shift+C accepts either browser casing and persists open state', () => {
    const h = harness();
    for (const key of ['c', 'C']) {
        const event = {key, ctrlKey: true, shiftKey: true,
            preventDefault() { this.prevented = true; }};
        h.callbacks.keydown(event);
        assert.equal(event.prevented, true);
    }
    assert.equal(h.elements.get('copilotChatFlyout').hidden, true);
    assert.equal(h.storage.get('copilotChatOpen'), '0');
});
