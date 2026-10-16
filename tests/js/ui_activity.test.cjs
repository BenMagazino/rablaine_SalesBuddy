const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-activity.js'), 'utf8');

function fixture({readyState = 'complete', embedded = false, enabled = true} = {}) {
    const indicator = {hidden: true};
    const documentEvents = new Map(), windowEvents = new Map(), navigationEvents = new Map();
    const timers = new Map(), pending = [];
    let timerId = 0;
    const document = {
        readyState,
        documentElement: {dataset: {sbActivityEnabled: String(enabled)}},
        getElementById: () => embedded ? null : indicator,
        addEventListener: (type, handler) => documentEvents.set(type, handler),
    };
    const nativeFetch = (input, options) => new Promise((resolve, reject) => {
        pending.push({input, options, resolve, reject});
    });
    const window = {
        fetch: nativeFetch,
        addEventListener: (type, handler) => windowEvents.set(type, handler),
        navigation: {addEventListener: (type, handler) => navigationEvents.set(type, handler)},
    };
    vm.runInNewContext(script, {
        document, window, URL, Request,
        location: new URL('http://localhost/customers'),
        setTimeout: handler => { timers.set(++timerId, handler); return timerId; },
        clearTimeout: id => timers.delete(id),
    });
    return {
        indicator, document, documentEvents, windowEvents, navigationEvents, window,
        pending, nativeFetch,
        gesture() { documentEvents.get('click')(); },
        endGesture() {
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach(fn => fn());
        },
        navigate(options = {}) {
            const controller = new AbortController();
            navigationEvents.get('navigate')({
                destination: {url: 'http://localhost/sellers', sameDocument: false},
                downloadRequest: null, signal: controller.signal, ...options,
            });
            return controller;
        },
    };
}

test('incoming pages and their initialization requests do not restart the animation', async () => {
    for (const readyState of ['loading', 'interactive', 'complete']) {
        const f = fixture({readyState});
        assert.equal(f.indicator.hidden, true);
        const request = f.window.fetch('/api/customers');
        assert.equal(f.indicator.hidden, true);
        f.pending[0].resolve('response');
        assert.equal(await request, 'response');
        assert.equal(f.indicator.hidden, true);
    }
});

test('document handoff ends outgoing feedback without replaying it in the incoming page', () => {
    const outgoing = fixture();
    outgoing.navigate();
    assert.equal(outgoing.indicator.hidden, false);
    outgoing.windowEvents.get('pagehide')();
    assert.equal(outgoing.indicator.hidden, true);
    const incoming = fixture({readyState: 'loading'});
    assert.equal(incoming.indicator.hidden, true);
});

test('user actions still receive feedback before the document finishes loading', async () => {
    const f = fixture({readyState: 'interactive'});
    f.gesture();
    const request = f.window.fetch('/api/customers');
    assert.equal(f.indicator.hidden, false);
    f.pending[0].resolve('response');
    await request;
    assert.equal(f.indicator.hidden, true);
});

test('foreground requests start immediately and concurrent work finishes independently', async () => {
    const f = fixture();
    f.gesture();
    const first = f.window.fetch('/api/customers', {method: 'POST'});
    const second = f.window.fetch(new Request('http://localhost/api/sellers'));
    f.endGesture();
    assert.equal(f.indicator.hidden, false);
    f.pending[0].resolve('first');
    await first;
    assert.equal(f.indicator.hidden, false);
    f.pending[1].resolve('second');
    await second;
    assert.equal(f.indicator.hidden, true);
    assert.equal(f.pending[0].options.method, 'POST');
});

test('idle background polling and off-site requests do not animate the header', async () => {
    const f = fixture();
    const poll = f.window.fetch('/api/jobs/operations/fabric');
    assert.equal(f.indicator.hidden, true);
    f.gesture();
    const external = f.window.fetch('https://example.com');
    assert.equal(f.indicator.hidden, true);
    f.pending.forEach(request => request.resolve('response'));
    await Promise.all([poll, external]);
});

test('failed and aborted action requests stop feedback and preserve their errors', async () => {
    for (const error of [new Error('Network failed'), new DOMException('Aborted', 'AbortError')]) {
        const f = fixture();
        f.gesture();
        const promise = f.window.fetch('/api/customers');
        assert.equal(f.indicator.hidden, false);
        f.pending[0].reject(error);
        await assert.rejects(promise, failure => failure === error);
        assert.equal(f.indicator.hidden, true);
    }
});

test('full navigations start immediately and abort/error/success clear their feedback', () => {
    for (const ending of ['abort', 'navigateerror', 'navigatesuccess']) {
        const f = fixture();
        const controller = f.navigate();
        assert.equal(f.indicator.hidden, false);
        if (ending === 'abort') controller.abort();
        else f.navigationEvents.get(ending)();
        assert.equal(f.indicator.hidden, true);
    }
});

test('hash changes, downloads, and external destinations are not page loading', () => {
    const f = fixture();
    for (const options of [
        {destination: {url: 'http://localhost/customers#details', sameDocument: true}},
        {downloadRequest: 'customers.csv'},
        {destination: {url: 'https://example.com', sameDocument: false}},
    ]) {
        f.navigate(options);
        assert.equal(f.indicator.hidden, true);
    }
});

test('page restore resets old work without corrupting a new request count', async () => {
    const f = fixture();
    f.gesture();
    const old = f.window.fetch('/api/old');
    f.windowEvents.get('pagehide')();
    f.windowEvents.get('pageshow')({persisted: true});
    assert.equal(f.indicator.hidden, true);
    f.gesture();
    const current = f.window.fetch('/api/current');
    f.pending[0].resolve('old');
    await old;
    assert.equal(f.indicator.hidden, false);
    f.pending[1].resolve('current');
    await current;
    assert.equal(f.indicator.hidden, true);
});

test('ending navigation does not hide a concurrent action request', async () => {
    const f = fixture();
    f.navigate();
    f.gesture();
    const action = f.window.fetch('/api/customers');
    f.navigationEvents.get('navigateerror')();
    assert.equal(f.indicator.hidden, false);
    f.pending[0].resolve('response');
    await action;
    assert.equal(f.indicator.hidden, true);
});

test('embedded fragments do not install another request observer', () => {
    const f = fixture({embedded: true});
    assert.equal(f.window.fetch, f.nativeFetch);
});

test('disabled preference suppresses initial, native, web, and request loading feedback', async () => {
    const f = fixture({enabled: false, readyState: 'interactive'});
    assert.equal(f.indicator.hidden, true);
    f.navigate();
    f.document.documentElement.dataset.sbShellLoading = 'true';
    f.windowEvents.get('sb:shell-loading')();
    f.gesture();
    const work = f.window.fetch('/api/customers');
    assert.equal(f.indicator.hidden, true);
    f.pending[0].resolve('response');
    await work;
    assert.equal(f.indicator.hidden, true);
});

test('confirmed preference changes take effect during work without reloading', () => {
    const f = fixture();
    f.navigate();
    assert.equal(f.indicator.hidden, false);
    f.document.documentElement.dataset.sbActivityEnabled = 'false';
    f.windowEvents.get('sb:activity-preference-changed')();
    assert.equal(f.indicator.hidden, true);
    f.document.documentElement.dataset.sbActivityEnabled = 'true';
    f.windowEvents.get('sb:activity-preference-changed')();
    assert.equal(f.indicator.hidden, false);
    f.navigationEvents.get('navigatesuccess')();
    assert.equal(f.indicator.hidden, true);
});

test('native menu navigation stays busy until the Electron loading lifecycle stops', () => {
    const f = fixture();
    f.document.documentElement.dataset.sbShellLoading = 'true';
    f.windowEvents.get('sb:shell-loading')();
    assert.equal(f.indicator.hidden, false);
    f.document.documentElement.dataset.sbShellLoading = 'false';
    f.windowEvents.get('sb:shell-loading')();
    assert.equal(f.indicator.hidden, true);
});

test('page-local preview can run with loading feedback disabled and resets on page handoff', () => {
    const f = fixture({enabled: false});
    f.document.documentElement.dataset.sbActivityPreview = 'true';
    f.windowEvents.get('sb:activity-preview-changed')();
    assert.equal(f.indicator.hidden, false);
    assert.equal(f.document.documentElement.dataset.sbActivityEnabled, 'false');
    delete f.document.documentElement.dataset.sbActivityPreview;
    f.windowEvents.get('sb:activity-preview-changed')();
    assert.equal(f.indicator.hidden, true);
    f.document.documentElement.dataset.sbActivityPreview = 'true';
    f.windowEvents.get('sb:activity-preview-changed')();
    f.windowEvents.get('pagehide')();
    assert.equal(f.indicator.hidden, true);
    assert.equal(f.document.documentElement.dataset.sbActivityPreview, undefined);
    f.windowEvents.get('pageshow')({persisted: true});
    assert.equal(f.indicator.hidden, true);
});

test('stopping preview leaves real navigation feedback intact', () => {
    const f = fixture();
    f.navigate();
    f.document.documentElement.dataset.sbActivityPreview = 'true';
    f.windowEvents.get('sb:activity-preview-changed')();
    delete f.document.documentElement.dataset.sbActivityPreview;
    f.windowEvents.get('sb:activity-preview-changed')();
    assert.equal(f.indicator.hidden, false);
    f.navigationEvents.get('navigatesuccess')();
    assert.equal(f.indicator.hidden, true);
});

test('preload relays only a primitive loading flag without exposing Electron APIs', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../electron/preload.js'), 'utf8')
        .split('const FIND_BAR_ID')[0];
    const handlers = new Map(), events = [];
    const root = {dataset: {}};
    vm.runInNewContext(source, {
        require: () => ({ipcRenderer: {on: (type, callback) => handlers.set(type, callback)}}),
        document: {documentElement: root},
        window: {dispatchEvent: event => events.push(event.type)},
        Event,
    });
    handlers.get('shell:loading')({}, true);
    assert.equal(root.dataset.sbShellLoading, 'true');
    handlers.get('shell:loading')({}, false);
    assert.equal(root.dataset.sbShellLoading, 'false');
    assert.deepEqual(events, ['sb:shell-loading', 'sb:shell-loading']);
});

test('shared shell loads the observer before job/save wrappers and supports reduced motion', () => {
    const base = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
    assert.ok(base.indexOf("filename='js/ui-activity.js'") <
        base.indexOf("filename='js/ui-jobs.js'"));
    assert.match(base, /id="sbActivity" role="progressbar"/);
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-activity.css'), 'utf8');
    assert.match(css, /pointer-events: none/);
    assert.match(css, /opacity: var\(--sb-activity-opacity, 1\)/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none/);
});

test('activity comet uses logo green, static SVG gradients, and transform-only travel', () => {
    const base = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-activity.css'), 'utf8');
    assert.match(base, /linearGradient id="sbActivityTrail"/);
    assert.match(base, /radialGradient id="sbActivityHalo"/);
    assert.match(base, /cx="310" cy="10" rx="24" ry="9"/);
    assert.match(css, /--sb-activity-color: #33e1ae/);
    assert.match(css, /inset: -10\.5px 0 auto;\s*height: 20px/);
    assert.match(css, /from \{ transform: translateX\(-336px\); \}/);
    assert.match(css, /to \{ transform: translateX\(100%\); \}/);
    assert.doesNotMatch(base.slice(base.indexOf('id="sbActivity"'),
        base.indexOf('<div class="sb-bar-grid">')), /<filter|<animate/);
});
