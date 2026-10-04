const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-sync-status.js'), 'utf8');
const active = (date = '2026-10-02') => ({
    running: true, current_date: date, aura_dates: ['2026-10-02', '2026-10-05'],
});
const response = (state, status = 200) => ({
    ok: status === 200, status, json: async () => state,
});

function controller({position, missing, storageError = false} = {}) {
    const storage = new Map(position === undefined ? [] : [['syncStatusCardPos', position]]);
    const listeners = new Map(), windowListeners = new Map(), timers = new Map();
    const requests = [], queue = [], errors = [], warnings = [], events = [];
    let refreshes = 0, timerId = 0;
    const document = {
        activeElement: null, body: {},
        documentElement: {clientWidth: 1563, clientHeight: 1167},
        getElementById: id => elements.get(id),
        addEventListener: (type, handler) => listeners.set(type, handler),
        removeEventListener: type => listeners.delete(type),
    };
    class Element {
        constructor(id) {
            this.id = id;
            this.hidden = id === 'syncStatusCard' || id === 'syncStatusError';
            this.style = {};
            this.dataset = {};
            this.handlers = new Map();
            this.textContent = '';
            this.disabled = false;
            this.isConnected = true;
            this.offsetWidth = 340;
            this.offsetHeight = 120;
        }
        addEventListener(type, handler) { this.handlers.set(type, handler); }
        getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
        getBoundingClientRect() {
            const left = this.style.left === undefined ? 1207 : parseFloat(this.style.left);
            const top = this.style.top === undefined ? 80 : parseFloat(this.style.top);
            return {left, top, right: left + this.offsetWidth, bottom: top + this.offsetHeight};
        }
        contains(element) { return element === this || element?.inCard === true; }
        closest(selector) {
            if (selector === 'button') return this.button ? this : null;
            return null;
        }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
    }
    const elements = new Map(['syncStatusCard', 'syncStatusCardHeader', 'syncStatusTitle',
        'syncStatusCurrent', 'syncStatusDate', 'syncStatusProgress', 'syncStatusError',
        'syncStatusRetry', 'syncStatusDismiss', 'main-content', 'opener']
        .map(id => [id, new Element(id)]));
    for (const id of ['syncStatusRetry', 'syncStatusDismiss']) {
        elements.get(id).button = true;
        elements.get(id).inCard = true;
    }
    if (missing) elements.delete(missing);
    document.activeElement = elements.get('opener');
    const context = {
        document,
        console: {error: (...args) => errors.push(args), warn: (...args) => warnings.push(args)},
        localStorage: {
            getItem(key) { if (storageError) throw new Error('Storage denied'); return storage.get(key); },
            setItem(key, value) { if (storageError) throw new Error('Storage denied'); storage.set(key, value); },
        },
        fetch: async url => {
            requests.push(url);
            const result = queue.shift();
            if (result instanceof Error) throw result;
            if (!result) throw new Error('Unexpected status request');
            return result;
        },
        setInterval(fn, delay) { const id = ++timerId; timers.set(id, {fn, delay}); return id; },
        clearInterval: id => timers.delete(id),
        addEventListener: (type, handler) => windowListeners.set(type, handler),
        checkTodayStatus: () => { refreshes++; },
        CustomEvent,
        dispatchEvent: event => events.push(event),
        loadCalendar: () => { throw new Error('Full calendar rebuild is forbidden'); },
    };
    context.window = context;
    vm.runInNewContext(source, context);
    return {
        api: context.SyncStatus, elements, document, listeners, windowListeners,
        storage, requests, queue, errors, warnings, timers, events,
        refreshes: () => refreshes,
        async tick() { for (const timer of [...timers.values()]) await timer.fn(); },
        click(id) { return elements.get(id).handlers.get('click')(); },
        drag(target = elements.get('syncStatusCardHeader'), button = 0) {
            const rect = elements.get('syncStatusCard').getBoundingClientRect();
            const event = {target, button, clientX: rect.left + 10,
                clientY: rect.top + 10, preventDefault() {}};
            elements.get('syncStatusCardHeader').handlers.get('mousedown')(event);
        },
    };
}

test('sync stays dormant until explicitly requested, and show does not take page focus', () => {
    const h = controller();
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.timers.size, 0);
    assert.equal(h.requests.length, 0);
    h.api.forceShow(active());
    assert.equal(h.elements.get('syncStatusCard').hidden, false);
    assert.equal(h.elements.get('syncStatusDate').textContent, '2026-10-02');
    assert.equal(h.elements.get('syncStatusProgress').textContent, 'Day 1 of 2');
    assert.equal(h.document.activeElement.id, 'opener');
    h.api.forceShow(active('2026-10-05'));
    assert.equal(h.elements.get('syncStatusProgress').textContent, 'Day 2 of 2');
    assert.equal(h.timers.size, 1);
    assert.equal([...h.timers.values()][0].delay, 3000);
    h.api.forceShow();
    assert.equal(h.elements.get('syncStatusDate').textContent, 'today');
    assert.equal(h.elements.get('syncStatusProgress').textContent, '');
});

test('completed background syncs request an immediate freshness check, unlike visual dismissal', () => {
    const h = controller();
    h.api.forceShow(active());
    h.api.hide();
    assert.equal(h.events.length, 0);
    h.api.hide({reload: true});
    assert.equal(h.events[0].type, 'sb:meetings-cache-updated');
    assert.equal(h.refreshes(), 1);
});

test('check uses the same read-only endpoint and never shows an inactive sync', async () => {
    const h = controller();
    h.queue.push(response({running: false}));
    await h.api.check();
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.timers.size, 0);
    assert.deepEqual(h.requests, ['/api/meetings/sync-status']);
    h.queue.push(response(active()));
    await h.api.check();
    assert.equal(h.elements.get('syncStatusCard').hidden, false);
});

test('visual dismissal preserves polling, page interaction and focus without stopping sync', async () => {
    const h = controller();
    h.api.forceShow(active());
    h.elements.get('syncStatusDismiss').focus();
    h.click('syncStatusDismiss');
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.document.activeElement.id, 'opener');
    assert.equal(h.document.activeElement.focusOptions.preventScroll, true);
    assert.equal(h.timers.size, 1);
    h.queue.push(response(active('2026-10-05')));
    await h.tick();
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.elements.get('syncStatusProgress').textContent, 'Day 2 of 2');
    h.queue.push(response({running: false}));
    await h.tick();
    assert.equal(h.timers.size, 0);
    assert.equal(h.refreshes(), 1);
    assert.equal(h.requests.length, 2);
});

test('public hide stops UI polling and late responses cannot reopen or complete a newer session', async () => {
    const h = controller();
    let resolve;
    h.api.forceShow(active());
    h.queue.push(new Promise(done => { resolve = done; }));
    const pending = h.tick();
    h.api.hide();
    h.api.forceShow(active('2026-10-05'));
    resolve(response({running: false}));
    await pending;
    assert.equal(h.elements.get('syncStatusCard').hidden, false);
    assert.equal(h.elements.get('syncStatusDate').textContent, '2026-10-05');
    assert.equal(h.refreshes(), 0);
    h.api.hide();
    assert.equal(h.timers.size, 0);
});

test('completion restores focused controls to main when the original opener is gone', async () => {
    const h = controller();
    h.api.forceShow(active());
    h.elements.get('opener').isConnected = false;
    h.elements.get('syncStatusDismiss').focus();
    h.queue.push(response({running: false}));
    await h.tick();
    assert.equal(h.document.activeElement.id, 'main-content');
    assert.equal(h.refreshes(), 1);
});

test('completion never steals unrelated page focus or returns focus to a disabled opener', async () => {
    const h = controller();
    h.api.forceShow(active());
    h.elements.get('main-content').focus();
    h.queue.push(response({running: false}));
    await h.tick();
    assert.equal(h.document.activeElement.id, 'main-content');
    h.elements.get('opener').focus();
    h.api.forceShow(active());
    h.elements.get('opener').disabled = true;
    h.elements.get('syncStatusDismiss').focus();
    h.click('syncStatusDismiss');
    assert.equal(h.document.activeElement.id, 'main-content');
});

test('failed HTTP, malformed state, JSON and network reads are visible, logged and retryable', async () => {
    for (const bad of [
        response({}, 503), response({}), response({running: 'yes'}),
        response({...active(), aura_dates: [42]}),
        {ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); }},
        new Error('Network unavailable'),
    ]) {
        const h = controller();
        h.queue.push(bad);
        await h.api.check();
        assert.equal(h.elements.get('syncStatusCard').hidden, false);
        assert.equal(h.elements.get('syncStatusError').hidden, false);
        assert.equal(h.elements.get('syncStatusCard').dataset.sbState, 'error');
        assert.equal(h.errors.length, 1);
        assert.equal(h.elements.get('syncStatusRetry').disabled, false);
        h.elements.get('syncStatusRetry').focus();
        h.queue.push(response(active()));
        await h.click('syncStatusRetry');
        assert.equal(h.elements.get('syncStatusError').hidden, true);
        assert.equal(h.document.activeElement.id, 'syncStatusDismiss');
        assert.equal(h.elements.get('syncStatusProgress').textContent, 'Day 1 of 2');
    }
});

test('automatic recovery and failures after dismissal never resurface a hidden card', async () => {
    const h = controller();
    h.api.forceShow(active());
    h.click('syncStatusDismiss');
    h.queue.push(new Error('Network unavailable'));
    await h.tick();
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.elements.get('syncStatusError').hidden, false);
    h.queue.push(response(active()));
    await h.tick();
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.elements.get('syncStatusError').hidden, true);
});

test('dismissing during an explicit retry prevents its late result from reopening the card', async () => {
    const h = controller();
    h.api.forceShow(active());
    let resolve;
    h.queue.push(new Promise(done => { resolve = done; }));
    const pending = h.api.check();
    h.click('syncStatusDismiss');
    resolve(response(active()));
    await pending;
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.equal(h.timers.size, 1);
});

test('overlapping status polls share one read rather than racing duplicate requests', async () => {
    const h = controller();
    h.api.forceShow(active());
    let resolve;
    h.queue.push(new Promise(done => { resolve = done; }));
    const first = h.tick(), second = h.tick();
    assert.equal(h.requests.length, 1);
    resolve(response(active('2026-10-05')));
    await Promise.all([first, second]);
    assert.equal(h.elements.get('syncStatusProgress').textContent, 'Day 2 of 2');
});

test('saved positions and dragging use the existing key and keep the entire card visible', () => {
    const h = controller({position: JSON.stringify({left: 9000, top: 9000})});
    h.api.forceShow(active());
    assert.equal(h.elements.get('syncStatusCard').style.left, '1223px');
    assert.equal(h.elements.get('syncStatusCard').style.top, '1047px');
    h.drag();
    h.listeners.get('mousemove')({clientX: -50, clientY: -50});
    h.listeners.get('mouseup')();
    assert.equal(h.elements.get('syncStatusCard').style.left, '0px');
    assert.deepEqual(JSON.parse(h.storage.get('syncStatusCardPos')), {left: 0, top: 0});
    assert.equal(h.listeners.size, 0);
    h.drag(h.elements.get('syncStatusDismiss'));
    assert.equal(h.listeners.size, 0);
    h.drag(undefined, 2);
    assert.equal(h.listeners.size, 0);
    h.elements.get('syncStatusCard').style.left = '9000px';
    h.windowListeners.get('resize')();
    assert.equal(h.elements.get('syncStatusCard').style.left, '1223px');
});

test('bad or unavailable position storage is reported without preventing sync feedback', () => {
    for (const options of [{position: '{bad'}, {position: '{"left":null,"top":3}'},
        {storageError: true}]) {
        const h = controller(options);
        h.api.forceShow(active());
        assert.equal(h.elements.get('syncStatusCard').hidden, false);
        assert.equal(h.warnings.length, 1);
    }
});

test('missing markup and invalid explicit snapshots fail rather than silently showing success', () => {
    assert.throws(() => controller({missing: 'syncStatusRetry'}), /Missing meeting-sync control/);
    const h = controller();
    assert.throws(() => h.api.forceShow('invalid'), /response is invalid/);
    assert.equal(h.elements.get('syncStatusCard').hidden, true);
    assert.doesNotMatch(source, /bootstrap|loadCalendar\(/);
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-feedback.css'), 'utf8');
    assert.match(css, /\.sb-sync-status\[hidden\].*display:\s*none/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
