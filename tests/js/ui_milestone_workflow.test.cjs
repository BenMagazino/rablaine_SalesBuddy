const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-milestone-workflow.js'), 'utf8');

function harness() {
    const requests = [], timers = new Map(), windowEvents = new Map(), errors = [];
    let nextTimer = 0, reloads = 0;
    class Event {
        constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
        preventDefault() { this.defaultPrevented = true; }
    }
    class Element {
        constructor() {
            this.handlers = new Map(); this.open = false; this.isConnected = true;
            this.value = this.defaultValue = ''; this.dataset = {};
        }
        addEventListener(type, handler, options) {
            if (!this.handlers.has(type)) this.handlers.set(type, new Set());
            this.handlers.get(type).add(handler);
            options?.signal.addEventListener('abort', () => this.handlers.get(type).delete(handler));
        }
        dispatchEvent(event) {
            event.target ||= this;
            for (const handler of this.handlers.get(event.type) || []) handler(event);
            return !event.defaultPrevented;
        }
        matches() { return !!this.child; }
        hasAttribute(name) { return name === 'data-sb-milestone-page' && !!this.standalone; }
    }
    const discard = new Element(), confirm = new Element(), description = new Element();
    const pageState = new Element();
    const document = new Element();
    Object.assign(document, {getElementById: id =>
        ({recordDiscardDialog: discard, recordDiscardConfirm: confirm,
            recordDiscardDescription: description, milestonePageState: pageState})[id],
        createElement: () => new Element()});
    const SBDialog = {
        open(element) { element.open = true; },
        close(element, reason = 'escape') {
            if (!element.open) return;
            const event = new Event('sb:dialog-before-close', {target: element, detail: {reason}});
            element.dispatchEvent(event);
            element.root?.dispatchEvent(event);
            if (event.defaultPrevented) return;
            element.open = false;
            const closed = new Event('sb:dialog-closed', {target: element, detail: {reason}});
            element.dispatchEvent(closed);
            element.root?.dispatchEvent(closed);
        },
    };
    const window = {
        addEventListener: (type, handler) => {
            const handlers = windowEvents.get(type) || [];
            handlers.push(handler); windowEvents.set(type, handlers);
        },
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id),
        location: {reload: () => reloads++, assign: url => { window.destination = url; }},
        history: {state: {unrelated: 'retained'}, replaceState: state => {
            window.history.state = state;
        }},
        fetch: async (url, options) => {
            requests.push({url, options});
            return window.response;
        },
    };
    vm.runInNewContext(source, {window, document, SBDialog, AbortController, DOMException,
        CustomEvent: Event, console: {error: (...args) => errors.push(args), warn() {}}});
    function root(standalone = false, options = {}) {
        const root = new Element(), child = new Element(), field = new Element();
        const comment = new Element(), status = new Element(), form = new Element();
        const notice = new Element(), context = new Element(), forecast = new Element();
        root.standalone = standalone; root.dataset.sbMilestoneId = '880';
        context.dataset.sbMsReading = 'context'; forecast.dataset.sbMsReading = 'forecast';
        context.scrollTop = forecast.scrollTop = 0;
        const spinner = options.restoreAfterRead ? {style: {display: ''}} : null;
        if (spinner) {
            let scroll = 0;
            Object.defineProperty(forecast, 'scrollTop', {
                get: () => scroll,
                set: value => { scroll = spinner.style.display === 'none'
                    ? value : Math.min(value, 100); },
            });
        }
        child.child = true; child.root = root;
        form.reset = () => { field.value = field.defaultValue; };
        child.querySelectorAll = () => [field];
        child.querySelector = selector => ({form, '[data-sb-child-status]': status})[selector] || null;
        root.querySelectorAll = selector => selector === '[data-sb-ms-reading]'
            ? [context, forecast] : selector.startsWith('dialog') ? [child] : [comment];
        root.querySelector = selector => ({'#child': child, '#field': field,
            '#newTaskModal': child, '[data-sb-ms-page-notice]': notice,
            '#detailsSpinner': spinner})[selector] || null;
        root.contains = () => true;
        let scope;
        const api = window.SBMilestoneWorkflow.attach(root, value => {
            scope = value;
            return {};
        }, options);
        return {root, child, field, comment, status, api, scope, context, forecast, notice, spinner};
    }
    return {root, window, requests, errors, discard, confirm, description, SBDialog, Event,
        document, pageState,
        emit(type) { for (const handler of windowEvents.get(type) || []) handler(new Event(type)); },
        flush() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
        unload() { const event = new Event('beforeunload');
            for (const handler of windowEvents.get('beforeunload')) handler(event);
            return event.defaultPrevented || false; },
        get reloads() { return reloads; },
        response(data, type = 'application/json') {
            window.response = {ok: true, status: 200, headers: {get: () => type},
                json: async () => data};
        }};
}

test('scoped document isolates duplicate fragment IDs and disposal aborts reads/timers', async () => {
    const h = harness(), first = h.root(), second = h.root();
    assert.notEqual(first.scope.document.getElementById('field'),
        second.scope.document.getElementById('field'));
    assert.equal(h.window.SBMilestoneWorkflow.attach(first.root, () => { throw Error(); }), first.api);
    h.response({success: true});
    await first.scope.fetch('/read');
    first.scope.setTimeout(() => { throw Error('Disposed timer ran'); }, 1500);
    first.api.dispose();
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.flush();
    assert.equal(h.unload(), false);
});

test('standalone restores both reading regions without changing unrelated history', () => {
    const h = harness(), view = h.root(true);
    view.context.scrollTop = 240; view.forecast.scrollTop = 640;
    view.context.dispatchEvent(new h.Event('scroll'));
    assert.equal(h.window.history.state.unrelated, 'retained');
    assert.equal(h.window.history.state.sbMilestoneReading['880'].forecast, 640);
    view.context.scrollTop = view.forecast.scrollTop = 0;
    h.emit('pageshow'); h.flush();
    assert.equal(view.context.scrollTop, 240);
    assert.equal(view.forecast.scrollTop, 640);
});

test('opportunity Back keeps the original position until asynchronous comments restore height', () => {
    const h = harness();
    h.window.history.state.sbMilestoneReading = {
        'opportunity-880': {context: 0, forecast: 620},
    };
    const view = h.root(true, {readingKey: 'opportunity-880', restoreAfterRead: true});
    assert.equal(view.forecast.scrollTop, 100);
    view.forecast.dispatchEvent(new h.Event('scroll'));
    assert.equal(h.window.history.state.sbMilestoneReading['opportunity-880'].forecast, 620);
    view.spinner.style.display = 'none';
    view.root.dispatchEvent(new h.Event('sb:record-state'));
    assert.equal(view.forecast.scrollTop, 620);
    view.forecast.scrollTop = 300;
    view.forecast.dispatchEvent(new h.Event('scroll'));
    assert.equal(h.window.history.state.sbMilestoneReading['opportunity-880'].forecast, 300);
});

test('standalone Keep editing preserves comment and confirmed leave clears only its draft', () => {
    const h = harness(), view = h.root(true);
    view.comment.value = 'Draft';
    view.root.dispatchEvent(new h.Event('input'));
    assert.equal(h.pageState.textContent, 'Unsaved milestone draft');
    const link = {href: '/milestone/880/edit', getAttribute: () => '/milestone/880/edit',
        hasAttribute: () => false};
    const click = () => {
        const event = new h.Event('click', {button: 0, target: {closest: () => link}});
        h.document.dispatchEvent(event);
        return event;
    };
    assert.equal(click().defaultPrevented, true);
    assert.equal(h.discard.open, true);
    h.SBDialog.close(h.discard);
    assert.equal(view.comment.value, 'Draft');
    assert.equal(h.window.destination, undefined);
    click();
    h.confirm.dispatchEvent(new h.Event('click'));
    assert.equal(h.window.destination, '/milestone/880/edit');
    assert.equal(view.comment.value, '');
    assert.equal(view.api.isDirty(), false);
    assert.equal(h.window.history.state.unrelated, 'retained');
    h.emit('pageshow'); h.flush();
    view.comment.value = 'New draft after Back';
    view.root.dispatchEvent(new h.Event('input'));
    assert.equal(view.api.isDirty(), true);
    assert.equal(h.unload(), true);
});

test('standalone pending save blocks navigation without opening discard', async () => {
    const h = harness(), view = h.root(true);
    h.response({success: true});
    const response = await view.scope.fetch('/write', {method: 'POST'});
    const link = {href: '/customer/1', getAttribute: () => '/customer/1',
        hasAttribute: () => false};
    const event = new h.Event('click', {button: 0, target: {closest: () => link}});
    h.document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(h.discard.open, false);
    assert.match(view.notice.textContent, /Wait before leaving/);
    assert.equal(h.window.destination, undefined);
    await response.json(); h.flush();
});

test('invalid standalone history is visible and never hides content', () => {
    const h = harness();
    h.window.history.state.sbMilestoneReading = {'880': {context: -1, forecast: 0}};
    const view = h.root(true);
    assert.equal(view.notice.hidden, false);
    assert.match(view.notice.textContent, /All content is available/);
    assert.equal(h.errors.length, 1);
});

test('writes stay busy through JSON handling, deduplicate and are never aborted on disposal', async () => {
    const h = harness(), view = h.root();
    h.response({success: true});
    const response = await view.scope.fetch('/write', {method: 'POST'});
    assert.equal(view.api.isBusy(), true);
    assert.equal(h.unload(), true);
    await assert.rejects(view.scope.fetch('/write', {method: 'POST'}), /still saving/);
    await response.json();
    assert.equal(view.api.isBusy(), true);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].options.signal, undefined);
    view.api.dispose();
    view.api.reload();
    assert.equal(h.reloads, 0);
    h.flush();
    assert.equal(view.api.isBusy(), false);
    assert.equal(h.unload(), false);
});

test('non-JSON and malformed JSON writes release the busy guard rather than trapping the editor', async () => {
    const h = harness(), view = h.root();
    h.response({}, 'text/html');
    await view.scope.fetch('/write', {method: 'POST'});
    assert.equal(view.api.isBusy(), false);
    h.response({});
    h.window.response.json = async () => { throw new SyntaxError('Malformed JSON'); };
    const response = await view.scope.fetch('/write', {method: 'POST'});
    await assert.rejects(response.json(), /Malformed JSON/);
    h.flush();
    assert.equal(view.api.isBusy(), false);
    assert.equal(h.errors.length, 1);
});

test('nested editor Keep editing retains fields and Discard resets only the child', () => {
    const h = harness(), view = h.root();
    view.api.openChild('child');
    view.field.value = 'Draft';
    h.SBDialog.close(view.child);
    assert.equal(h.discard.open, true);
    assert.equal(view.child.open, true);
    h.SBDialog.close(h.discard);
    assert.equal(view.field.value, 'Draft');
    h.SBDialog.close(view.child);
    h.confirm.dispatchEvent(new h.Event('click'));
    assert.equal(view.child.open, false);
    assert.equal(view.field.value, '');
    assert.equal(view.api.isDirty(), false);
});

test('pending writes block nested Escape and provide an explicit wait message', async () => {
    const h = harness(), view = h.root();
    h.response({success: true});
    view.api.openChild('child');
    const response = await view.scope.fetch('/write', {method: 'POST'});
    h.SBDialog.close(view.child);
    assert.equal(view.child.open, true);
    assert.equal(h.discard.open, false);
    assert.match(view.status.textContent, /Saving/);
    await response.json(); h.flush();
    h.SBDialog.close(view.child);
    assert.equal(view.child.open, false);
});

test('successful task refresh protects unrelated comment drafts and cannot silently discard them', () => {
    const h = harness(), view = h.root();
    view.api.openChild('child');
    view.comment.value = 'Unsaved comment';
    view.api.reload();
    assert.equal(h.reloads, 0);
    assert.equal(h.discard.open, true);
    assert.equal(view.child.open, false);
    h.SBDialog.close(h.discard);
    assert.equal(view.comment.value, 'Unsaved comment');
    assert.equal(view.api.isDirty(), true);
    view.api.reload();
    h.confirm.dispatchEvent(new h.Event('click'));
    assert.equal(h.reloads, 1);
    assert.equal(h.unload(), false);
});

test('comment edits compare default content, unload warns only for connected active drafts', () => {
    const h = harness(), view = h.root();
    view.comment.value = view.comment.defaultValue = 'Existing comment';
    assert.equal(view.api.isDirty(), false);
    view.comment.value = 'Edited comment';
    assert.equal(h.unload(), true);
    view.root.isConnected = false;
    assert.equal(h.unload(), false);
});
