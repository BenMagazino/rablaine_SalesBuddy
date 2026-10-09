const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-home-freshness.js'), 'utf8');
const dates = fs.readFileSync(path.join(__dirname, '../../static/js/ui-local-datetime.js'), 'utf8');
const sources = [
    ['milestones', 'homeMilestonesFreshness', 'Milestones'],
    ['revenue_sync', 'homeACRFreshness', 'ACR'],
    ['accounts', 'homeAccountsFreshness', 'Accounts'],
    ['u2c_import', 'homeU2CFreshness', 'U2C'],
];
const urls = sources.map(([type]) => '/api/admin/sync-status/' + type);
const meetingsURL = '/api/meetings/today-status';
const allURLs = [urls[0], urls[1], meetingsURL, urls[3], urls[2]];
const ok = data => ({ok: true, json: async () => data});
const complete = {state: 'complete', completed_at: '2026-10-02T15:00:00'};
const meetingsComplete = {synced: true, synced_at: complete.completed_at, today: '2026-10-02'};
const format = timestamp => new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

function fixture(overrides = {}, options = {}) {
    const requests = [], errors = [], warnings = [], events = [];
    const handlers = new Map(), windowHandlers = new Map(), timers = new Map();
    const queue = new Map(allURLs.map(url => [url, []]));
    let timerID = 0;
    class Element {
        constructor() { this.dataset = {}; this.attributes = new Map(); this.children = []; }
        get textContent() { return this.children.map(child => child.textContent).join(''); }
        set textContent(value) { this.children = [{textContent: value}]; }
        setAttribute(name, value) { this.attributes.set(name, value); }
        getAttribute(name) { return this.attributes.get(name); }
        matches(selector) { return selector === ':popover-open' && this.open === true; }
        hidePopover() { this.open = false; this.toggle({newState: 'closed'}); }
        focus() { document.activeElement = this; }
        replaceChildren(...children) { this.children = children; }
        querySelectorAll(selector) {
            return this.children.filter(child => selector === '.local-datetime' &&
                child.className === 'local-datetime');
        }
        addEventListener(type, handler) { this[type] = handler; }
    }
    const elements = new Map([...sources.map(([, id]) => id), 'homeMeetingsFreshness', 'homeFreshnessRefresh',
        'homeFreshnessPopover', 'homeFreshnessToggle']
        .map(id => [id, new Element()]));
    const document = {
        hidden: false, readyState: options.readyState || 'loading',
        getElementById: id => elements.get(id),
        createElement: () => new Element(),
        createTextNode: textContent => ({textContent}),
        querySelectorAll: () => [],
        addEventListener: (type, handler) => handlers.set(type, handler),
    };
    const context = {
        document, AbortController,
        console: {error: (...args) => errors.push(args), warn: (...args) => warnings.push(args)},
        fetch: async (url, options) => {
            requests.push({url, options});
            assert.ok(queue.has(url), 'Unexpected freshness endpoint: ' + url);
            const value = queue.get(url).shift() ?? overrides[url] ??
                ok(url === meetingsURL ? meetingsComplete : complete);
            if (value instanceof Error) throw value;
            return typeof value === 'function' ? value(options) : value;
        },
        setTimeout: (fn, delay) => { const id = ++timerID; timers.set(id, {fn, delay}); return id; },
        clearTimeout: id => timers.delete(id),
        setInterval: (fn, delay) => { const id = ++timerID; timers.set(id, {fn, delay}); return id; },
        clearInterval: id => timers.delete(id),
        addEventListener: (type, handler) => windowHandlers.set(type, handler),
        CustomEvent,
        dispatchEvent: event => { events.push(event); windowHandlers.get(event.type)?.(event); },
    };
    context.window = context;
    vm.createContext(context);
    if (!options.deferFormatter) vm.runInContext(dates, context);
    vm.runInContext(source, context);
    const button = elements.get('homeFreshnessRefresh');
    const flush = () => new Promise(resolve => setImmediate(resolve));
    return {elements, document, handlers, windowHandlers, requests, errors, warnings, events, queue,
        timers, button, flush,
        installFormatter() { vm.runInContext(dates, context); },
        async start() { windowHandlers.get('DOMContentLoaded')(); await flush(); },
    };
}

test('all five refresh statuses use read-only APIs, with Milestones and ACR first', async () => {
    const f = fixture();
    assert.equal(f.requests.length, 0);
    await f.start();
    assert.deepEqual(f.requests.map(r => r.url), allURLs);
    assert.ok(f.requests.every(r => !r.options.method));
    for (const [, id, label] of sources) {
        assert.equal(f.elements.get(id).textContent, label + ': ' + format(complete.completed_at + 'Z'));
        assert.equal(f.elements.get(id).dataset.state, 'neutral');
        const time = f.elements.get(id).children[1];
        assert.equal(time.getAttribute('datetime'), complete.completed_at);
        assert.ok(time.title.includes(complete.completed_at));
    }
    assert.equal(f.button.getAttribute('aria-disabled'), 'false');
    assert.equal(f.errors.length, 0);
});

test('interactive startup waits for the later deferred timestamp formatter', async () => {
    const f = fixture({}, {readyState: 'interactive', deferFormatter: true});
    f.handlers.get('visibilitychange')();
    assert.equal(f.requests.length, 0);
    f.installFormatter();
    await f.start();
    assert.deepEqual(f.requests.map(r => r.url), allURLs);
    assert.equal(f.errors.length, 0);
    assert.equal(f.elements.get('homeMilestonesFreshness').dataset.state, 'neutral');
});

test('already-complete pages start immediately without waiting for a past DOM event', async () => {
    const f = fixture({}, {readyState: 'complete'});
    await f.flush();
    assert.deepEqual(f.requests.map(r => r.url), allURLs);
    assert.equal(f.errors.length, 0);
});
test('fresh meetings show their recorded local timestamp and publish the same status to Today', async () => {
    const f = fixture();
    await f.start();
    const element = f.elements.get('homeMeetingsFreshness');
    assert.equal(element.textContent,
        "Today's Meetings: " + format(meetingsComplete.synced_at + 'Z'));
    assert.equal(element.dataset.state, 'neutral');
    assert.equal(f.events.length, 1);
    assert.equal(f.events[0].type, 'sb:meetings-today-status');
    assert.deepEqual(f.events[0].detail, meetingsComplete);
});

test('completed meeting pulls recheck freshness immediately instead of waiting for the minute poll', async () => {
    const f = fixture({[meetingsURL]: ok({synced: false, synced_at: null})});
    await f.start();
    f.queue.get(meetingsURL).push(ok(meetingsComplete));
    f.windowHandlers.get('sb:meetings-cache-updated')();
    await f.flush();
    assert.equal(f.requests.length, allURLs.length * 2);
    assert.equal(f.elements.get('homeMeetingsFreshness').dataset.state, 'neutral');
    assert.equal(f.events.at(-1).detail.synced, true);
});

test('cache updates during an older check wait for it and then read the newly written cache', async () => {
    let finish;
    const f = fixture({[meetingsURL]: () => new Promise(resolve => { finish = resolve; })});
    await f.start();
    f.queue.get(meetingsURL).push(ok(meetingsComplete));
    f.windowHandlers.get('sb:meetings-cache-updated')();
    assert.equal(f.requests.length, allURLs.length);
    finish(ok({synced: false, synced_at: null}));
    await f.flush();
    assert.equal(f.requests.length, allURLs.length * 2);
    assert.equal(f.elements.get('homeMeetingsFreshness').dataset.state, 'neutral');
    assert.equal(f.events.at(-1).detail.synced, true);
});

test('queued completion checks do not restart reads after the page exits', async () => {
    let finish;
    const f = fixture({[meetingsURL]: () => new Promise(resolve => { finish = resolve; })});
    await f.start();
    f.windowHandlers.get('sb:meetings-cache-updated')();
    f.windowHandlers.get('pagehide')();
    finish(ok(meetingsComplete));
    await f.flush();
    assert.equal(f.requests.length, allURLs.length);
    assert.equal(f.events.length, 0);
});

for (const synced_at of [null, '2026-10-01T12:00:00Z']) {
    test('unrefreshed meetings stay a warning, including stale cache timestamp ' + synced_at, async () => {
        const data = {synced: false, synced_at, today: '2026-10-02'};
        const f = fixture({[meetingsURL]: ok(data)});
        await f.start();
        const element = f.elements.get('homeMeetingsFreshness');
        assert.equal(element.textContent, "Today's Meetings: Not Pulled");
        assert.equal(element.dataset.state, 'warning');
        assert.equal(element.dataset.freshnessStamp, undefined);
        assert.deepEqual(f.events[0].detail, data);
    });
}

for (const [description, failure] of [
    ['HTTP', {ok: false, status: 503}], ['network', new Error('Offline')],
    ['JSON', {ok: true, json: async () => { throw new Error('Invalid JSON'); }}],
    ['invalid flag', ok({synced: 'true'})],
    ['missing timestamp', ok({synced: true, synced_at: null})],
    ['invalid timestamp', ok({synced: true, synced_at: 'invalid'})],
]) {
    test('meeting ' + description + ' errors remain visible and retryable without changing Today', async () => {
        const f = fixture({[meetingsURL]: failure});
        await f.start();
        assert.equal(f.elements.get('homeMeetingsFreshness').textContent,
            "Today's Meetings: status unavailable");
        assert.equal(f.elements.get('homeMeetingsFreshness').dataset.state, 'error');
        assert.equal(f.events.length, 0);
        assert.equal(f.errors.length, 1);
        for (const [, id] of sources) assert.equal(f.elements.get(id).dataset.state, 'neutral');
        f.queue.get(meetingsURL).push(ok(meetingsComplete));
        await f.button.click();
        assert.equal(f.elements.get('homeMeetingsFreshness').dataset.state, 'neutral');
        assert.equal(f.events.length, 1);
    });
}

test('late meeting responses cannot repaint Today after disposal or replace a newer check', async () => {
    let finish;
    const f = fixture({[meetingsURL]: () => new Promise(resolve => { finish = resolve; })});
    await f.start();
    const pending = f.button.click();
    f.windowHandlers.get('pagehide')();
    f.queue.get(meetingsURL).push(ok(meetingsComplete));
    f.windowHandlers.get('pageshow')();
    await f.flush();
    finish(ok({synced: false, synced_at: null}));
    await pending;
    assert.equal(f.elements.get('homeMeetingsFreshness').dataset.state, 'neutral');
    assert.equal(f.events.length, 1);
    assert.equal(f.events[0].detail.synced, true);
});

test('opening refresh details checks status; dismissing only closes observation UI', async () => {
    const f = fixture();
    await f.start();
    const popover = f.elements.get('homeFreshnessPopover');
    const toggle = f.elements.get('homeFreshnessToggle');
    popover.toggle({newState: 'open'});
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(f.button.getAttribute('aria-busy'), 'true');
    assert.equal(f.requests.length, allURLs.length * 2);
    popover.toggle({newState: 'closed'});
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(f.requests.length, allURLs.length * 2);
    assert.ok(f.requests.every(r => !r.options.signal.aborted));
    assert.ok(f.requests.every(r => !r.options.method));
    await f.flush();
    assert.equal(f.button.getAttribute('aria-busy'), 'false');
});

test('Escape closes details and returns focus without invoking global cancel shortcuts', async () => {
    const f = fixture();
    await f.start();
    const popover = f.elements.get('homeFreshnessPopover');
    const toggle = f.elements.get('homeFreshnessToggle');
    let prevented = 0, stopped = 0;
    for (const target of [popover, toggle]) {
        popover.open = true;
        target.keydown({key: 'Escape', preventDefault: () => prevented++,
            stopPropagation: () => stopped++});
        assert.equal(popover.open, false);
        assert.equal(toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(f.document.activeElement, toggle);
    }
    toggle.keydown({key: 'Enter'});
    assert.equal(prevented, 2);
    assert.equal(stopped, 2);
});

for (const [state, text, tone] of [
    ['never_run', 'not refreshed yet', 'neutral'], ['in_progress', 'refreshing...', 'neutral'],
    ['failed', 'last refresh failed', 'error'], ['incomplete', 'last refresh interrupted', 'warning'],
]) {
    test(state + ' cannot imply a successful refresh for any of the four sources', async () => {
        const f = fixture(Object.fromEntries(urls.map(url => [url, ok({state})])));
        await f.start();
        for (const [, id, label] of sources) {
            assert.equal(f.elements.get(id).textContent, label + ': ' + text);
            assert.equal(f.elements.get(id).dataset.state, tone);
        }
    });
}

test('explicit timezone offsets are preserved instead of having UTC appended twice', async () => {
    const f = fixture({[urls[1]]: ok({state: 'complete', completed_at: '2026-10-02T12:00:00-05:00'})});
    await f.start();
    assert.equal(f.elements.get('homeACRFreshness').textContent,
        'ACR: ' + format('2026-10-02T17:00:00Z'));
});

for (const [description, failure] of [
    ['HTTP', {ok: false, status: 500}],
    ['JSON', {ok: true, json: async () => { throw new Error('Invalid JSON'); }}],
    ['network', new Error('Offline')],
    ['state', ok({state: 'toString'})],
    ['missing timestamp', ok({state: 'complete', completed_at: null})],
    ['invalid timestamp', ok({state: 'complete', completed_at: 'invalid'})],
]) {
    test(description + ' failures affect only the failed source and can be retried', async () => {
        const f = fixture({[urls[1]]: failure});
        await f.start();
        assert.equal(f.elements.get('homeACRFreshness').textContent, 'ACR: status unavailable');
        for (const [, id, label] of sources.filter(([, id]) => id !== 'homeACRFreshness')) {
            assert.equal(f.elements.get(id).textContent, label + ': ' + format(complete.completed_at + 'Z'));
        }
        assert.equal(f.errors.length, 1);
        assert.equal(f.button.getAttribute('aria-disabled'), 'false');
        f.queue.get(urls[1]).push(ok(complete));
        await f.button.click();
        assert.equal(f.elements.get('homeACRFreshness').textContent,
            'ACR: ' + format(complete.completed_at + 'Z'));
    });
}

test('Accounts and U2C failures stay visible without hiding the priority timestamps', async () => {
    const f = fixture({
        [urls[2]]: ok({state: 'failed'}), [urls[3]]: ok({state: 'incomplete'}),
    });
    await f.start();
    assert.equal(f.elements.get('homeAccountsFreshness').dataset.state, 'error');
    assert.equal(f.elements.get('homeU2CFreshness').dataset.state, 'warning');
    assert.equal(f.elements.get('homeMilestonesFreshness').dataset.state, 'neutral');
    assert.equal(f.elements.get('homeACRFreshness').dataset.state, 'neutral');
});

test('polling skips hidden pages, return refreshes, and unchanged timestamps retain their DOM', async () => {
    const f = fixture();
    await f.start();
    const timestamp = f.elements.get('homeMilestonesFreshness').children[1];
    const poll = [...f.timers.values()].find(t => t.delay === 60000);
    f.document.hidden = true;
    poll.fn();
    assert.equal(f.requests.length, allURLs.length);
    f.document.hidden = false;
    f.handlers.get('visibilitychange')();
    await f.flush();
    assert.equal(f.requests.length, allURLs.length * 2);
    assert.equal(f.elements.get('homeMilestonesFreshness').children[1], timestamp);
});

test('duplicate checks coalesce, page exit aborts all reads, and late replies cannot overwrite', async () => {
    let finish;
    const deferred = new Promise(resolve => { finish = resolve; });
    const f = fixture({[urls[1]]: () => deferred});
    f.windowHandlers.get('DOMContentLoaded')();
    const same = f.button.click();
    assert.equal(f.requests.length, allURLs.length);
    assert.equal(f.button.getAttribute('aria-disabled'), 'true');
    f.windowHandlers.get('pagehide')();
    assert.ok(f.requests.every(r => r.options.signal.aborted));
    f.queue.get(urls[1]).push(ok(complete));
    f.windowHandlers.get('pageshow')();
    await f.flush();
    finish(ok({state: 'never_run'}));
    await same;
    assert.equal(f.elements.get('homeACRFreshness').textContent,
        'ACR: ' + format(complete.completed_at + 'Z'));
    assert.equal(f.errors.length, 0);
    assert.equal(f.button.getAttribute('aria-disabled'), 'false');
});

test('timed-out checks show a retryable failure instead of leaving the bar busy', async () => {
    const hang = ({signal}) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Timed out')));
    });
    const f = fixture(Object.fromEntries(allURLs.map(url => [url, hang])));
    f.windowHandlers.get('DOMContentLoaded')();
    [...f.timers.values()].find(t => t.delay === 10000).fn();
    await f.flush();
    assert.equal(f.errors.length, allURLs.length);
    assert.equal(f.button.getAttribute('aria-disabled'), 'false');
    assert.equal(f.button.getAttribute('aria-busy'), 'false');
});
