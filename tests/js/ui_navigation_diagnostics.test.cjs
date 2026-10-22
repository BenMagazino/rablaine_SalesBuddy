const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-navigation-diagnostics.js'), 'utf8');
const storageKey = 'sb.navbar-diagnostics.v1';

function recorder(options = {}) {
    const storage = options.storage || new Map();
    const timers = new Map();
    const documentListeners = [];
    const windowListeners = new Map();
    const navigationListeners = new Map();
    const warnings = [];
    const errors = [];
    const blobs = [];
    const revoked = [];
    let timerId = 0;
    const location = new URL('http://127.0.0.1:5000/notes/73?private=SECRET#private');
    function element(kind, parent = null) {
        const attributes = new Map();
        const handlers = new Map();
        const node = {
            kind, parent, id: '', dataset: {}, textContent: 'PRIVATE CUSTOMER', value: 'NOTE SECRET',
            target: '', href: 'http://127.0.0.1:5000/reports/hvas?customer=SECRET',
            open: false, attributes, handlers,
            getAttribute(name) { return name === 'href' ? this.href : attributes.get(name); },
            hasAttribute(name) { return attributes.has(name); },
            setAttribute(name, value) { attributes.set(name, value); },
            addEventListener(type, listener) { handlers.set(type, listener); },
            contains(target) {
                for (let node = target; node; node = node.parent) if (node === this) return true;
                return false;
            },
            closest(selector) {
                if (selector === 'a[href]' && kind === 'link') return this;
                if (selector === '.sb-nav-menu' && kind === 'menu') return this;
                if (selector === '[data-sb-menu]' && kind === 'trigger') return this;
                if (selector === '.sb-nav-menu a[href]' && kind === 'link' &&
                    parent?.kind === 'menu') return this;
                if (selector === 'dialog' && kind === 'dialog') return this;
                return parent?.closest(selector) || null;
            },
            matches(selector) {
                if (selector === ':popover-open') return this.open;
                if (selector === '.sb-nav-menu') return kind === 'menu';
                if (selector === '[data-sb-menu], .sb-nav-menu') {
                    return kind === 'menu' || kind === 'trigger';
                }
                return selector.startsWith('input,') && kind === 'input';
            },
            querySelectorAll() { return this.links || []; },
            append(child) { child.parent = this; },
            remove() { this.removed = true; },
            click() {
                emit('click', this, {
                    between(event) {
                        handlers.get('click')?.(event);
                        if (options.cancelDownload) event.preventDefault();
                    },
                });
            },
        };
        return node;
    }
    const body = element('body');
    const bar = element('bar', body);
    const menu = element('menu', bar);
    menu.id = 'browseMenu';
    const trigger = element('trigger', bar);
    trigger.dataset.sbMenu = menu.id;
    const link = element('link', menu);
    menu.links = [link];
    const button = element('button', body);
    const status = element('status', body);
    const document = {
        body, activeElement: body, visibilityState: 'visible',
        hasFocus: () => true,
        getElementById(id) {
            return {browseMenu: menu, navDiagnosticsDownload: button, navDiagnosticsStatus: status}[id];
        },
        querySelector(selector) {
            if (selector === '.sb-app-bar') return options.embedded ? null : bar;
            if (selector === '.sb-nav-menu:popover-open') return menu.open ? menu : null;
            return null;
        },
        addEventListener(type, listener, capture = false) {
            documentListeners.push({type, listener, capture});
        },
        createElement: () => element('link'),
    };
    function emit(type, target = link, extra = {}) {
        const event = {type, target, button: 0, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, ...extra};
        for (const handler of documentListeners) {
            if (handler.type === type && handler.capture) handler.listener(event);
        }
        extra.between?.(event);
        if (extra.bubble !== false) {
            for (const handler of documentListeners) {
                if (handler.type === type && !handler.capture) handler.listener(event);
            }
        }
        return event;
    }
    const window = {
        sessionStorage: {
            getItem(key) {
                if (options.readError) throw options.readError;
                return storage.get(key) || null;
            },
            setItem(key, value) {
                if (options.writeError) throw options.writeError;
                storage.set(key, value);
            },
        },
        addEventListener(type, listener) { windowListeners.set(type, listener); },
    };
    if (!options.noNavigationAPI) {
        window.navigation = {
            addEventListener(type, listener) { navigationListeners.set(type, listener); },
        };
    }
    class BrowserURL extends URL {
        static createObjectURL(blob) {
            if (options.downloadError) throw options.downloadError;
            blobs.push(blob);
            return 'blob:http://127.0.0.1:5000/diagnostic-test';
        }
        static revokeObjectURL(url) { revoked.push(url); }
    }
    vm.runInNewContext(source, {
        document, window, location,
        navigator: {userAgent: 'Chrome/140.0.1 Electron/36.1.0 PRIVATE USER INFO'},
        URL: BrowserURL, Blob,
        console: {warn: (...args) => warnings.push(args), error: (...args) => errors.push(args)},
        setTimeout(callback, delay) { timers.set(++timerId, {callback, delay}); return timerId; },
        clearTimeout(id) { timers.delete(id); },
    });
    return {
        window, document, trigger, menu, link, bar, body, button, status, storage, warnings,
        errors, blobs, revoked, element, emit,
        snapshot: () => JSON.parse(JSON.stringify(window.SBNavDiagnostics.snapshot())),
        windowEvent(type, event = {}) { windowListeners.get(type)?.(event); },
        navigationEvent(type, event) { navigationListeners.get(type)?.(event); },
        timers(delay) {
            for (const [id, timer] of [...timers]) {
                if (timer.delay === delay) { timers.delete(id); timer.callback(); }
            }
        },
    };
}

test('recording is bounded, local, and survives full document navigation', () => {
    const first = recorder();
    for (let i = 0; i < 300; i++) first.window.SBNavDiagnostics.menu('open', first.trigger, 'hover');
    first.windowEvent('pagehide', {persisted: false});
    assert.equal(first.snapshot().events.length, 256);
    assert.ok(first.storage.get(storageKey).length < 131072);
    const second = recorder({storage: first.storage});
    const events = second.snapshot().events;
    assert.equal(events.length, 256);
    assert.ok(events.some(event => event.type === 'pagehide' && event.page_id === 1));
    assert.equal(events.at(-1).page_id, 2);
    assert.equal(second.snapshot().environment.persistence, 'tab-session');
});

test('BF-cache restoration merges newer pages and retires old pending observations', () => {
    const first = recorder();
    first.emit('pointerdown');
    first.windowEvent('pagehide', {persisted: true});
    const second = recorder({storage: first.storage});
    second.windowEvent('pagehide', {persisted: true});
    first.windowEvent('pageshow', {persisted: true});
    first.timers(1500);
    const events = first.snapshot().events;
    assert.ok(events.some(event => event.type === 'page-ready' && event.page_id === 2));
    assert.equal(events.at(-1).page_id, 3);
    assert.equal(events.at(-1).persisted, true);
    assert.ok(!events.some(event => event.type === 'activation-not-observed'));
});

test('privacy allowlists strip DOM content, identifiers, URLs, keys, and untrusted storage fields', () => {
    const storage = new Map([[storageKey, JSON.stringify({schema_version: 1, pages: 1, events: [{
        time: Date.now(), page_id: 1, type: 'click', page: 'SECRET CUSTOMER',
        menu: 'SECRET MENU', focus: 'SECRET FIELD', href: 'https://private.example/73',
        key: 'PASSWORD', value: 'NOTE TEXT', id: 987654321, reason: 'PRIVATE REASON',
    }]})]]);
    const rec = recorder({storage});
    rec.emit('pointerdown');
    rec.emit('click');
    rec.timers(600);
    const data = rec.snapshot();
    const text = JSON.stringify(data);
    for (const privateValue of ['SECRET', 'PRIVATE', 'PASSWORD', 'NOTE TEXT',
        '987654321', '127.0.0.1', 'https:', '?private', 'customer=']) {
        assert.ok(!text.includes(privateValue), privateValue);
    }
    assert.deepEqual(data.environment.renderer, ['Chrome/140.0.1', 'Electron/36.1.0']);
    assert.equal(data.events[0].page, 'other');
    assert.equal(data.events.at(-1).item, 0);
    assert.equal(data.events.at(-1).menu, 'browse');
});

test('captures final default cancellation and stopped propagation after dispatch', () => {
    const rec = recorder();
    rec.emit('pointerdown');
    const click = rec.emit('click', rec.link, {
        bubble: false, between: event => event.preventDefault(),
    });
    assert.equal(click.defaultPrevented, true);
    rec.timers(600);
    const result = rec.snapshot().events.find(event => event.type === 'click-result');
    assert.equal(result.default_prevented, true);
    assert.equal(result.propagation_stopped, true);
    assert.equal(rec.snapshot().events.find(event =>
        event.type === 'navigation-not-observed').default_prevented, true);
});

test('records pointer activation without a click as an observation, not a diagnosis', () => {
    const rec = recorder();
    rec.emit('pointerdown');
    rec.emit('pointerup');
    rec.timers(1500);
    assert.equal(rec.snapshot().events.at(-1).type, 'activation-not-observed');
});

test('a quick second attempt cannot overwrite the first canceled click', () => {
    const rec = recorder();
    rec.emit('pointerdown');
    rec.emit('click', rec.link, {between: event => event.preventDefault()});
    rec.emit('pointerdown');
    rec.emit('click');
    rec.timers(600);
    const results = rec.snapshot().events.filter(event => event.type === 'click-result');
    assert.deepEqual(results.map(event => event.default_prevented), [true, false]);
});

test('accepted navigation and pagehide flush the final click before leaving', () => {
    const rec = recorder();
    rec.emit('pointerdown');
    rec.emit('click');
    rec.navigationEvent('navigate', {navigationType: 'push',
        destination: {sameDocument: false, url: 'https://PRIVATE/SECRET'},
        signal: new AbortController().signal});
    rec.windowEvent('pagehide', {persisted: false});
    rec.timers(600);
    const events = JSON.parse(rec.storage.get(storageKey)).events;
    assert.ok(events.some(event => event.type === 'navigation-start'));
    assert.equal(events.find(event => event.type === 'click-result').default_prevented, false);
    assert.ok(!events.some(event => event.type === 'navigation-not-observed'));
});

test('aborted and failed navigation retain only safe error names', () => {
    const rec = recorder();
    const abort = new AbortController();
    rec.navigationEvent('navigate', {navigationType: 'traverse',
        destination: {sameDocument: false}, signal: abort.signal});
    abort.abort(Object.assign(new Error('SECRET URL'), {name: 'AbortError'}));
    rec.navigationEvent('navigateerror', {error: new TypeError('SECRET URL')});
    const events = rec.snapshot().events;
    assert.equal(events.at(-2).type, 'navigation-abort');
    assert.equal(events.at(-2).error, 'AbortError');
    assert.equal(events.at(-1).error, 'TypeError');
    assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('download navigation and cancellation are labeled separately without exposing filenames', () => {
    const rec = recorder();
    const abort = new AbortController();
    rec.navigationEvent('navigate', {navigationType: 'push', downloadRequest: 'SECRET.json',
        destination: {sameDocument: false}, signal: abort.signal});
    abort.abort(new Error('SECRET'));
    rec.navigationEvent('navigateerror', {error: new Error('SECRET')});
    const events = rec.snapshot().events.slice(-3);
    assert.ok(events.every(event => event.download === true));
    assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('modified, other-window, download, cross-origin and hash links are not failed navigation attempts', () => {
    for (const customize of [
        rec => rec.link.target = '_blank',
        rec => rec.link.attributes.set('download', ''),
        rec => rec.link.href = '#section',
        rec => rec.link.href = 'http://127.0.0.1:5000/notes/73?private=SECRET#another',
        rec => rec.link.href = 'https://example.com',
    ]) {
        const rec = recorder();
        customize(rec);
        rec.emit('click');
        rec.timers(600);
        assert.equal(rec.snapshot().events.at(-1).expected_navigation, false);
    }
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
        const rec = recorder();
        rec.emit('click', rec.link, {[modifier]: true});
        rec.timers(600);
        assert.equal(rec.snapshot().events.at(-1).expected_navigation, false);
        assert.equal(rec.snapshot().events.at(-1).modified, true);
    }
    const secondary = recorder();
    secondary.emit('click', secondary.link, {button: 1});
    assert.equal(secondary.snapshot().events.at(-1).expected_navigation, false);
});

test('unavailable Navigation API does not prevent recording or ordinary event defaults', () => {
    const rec = recorder({noNavigationAPI: true});
    const event = rec.emit('click');
    assert.equal(event.defaultPrevented, false);
    rec.windowEvent('pagehide', {persisted: false});
    assert.equal(rec.snapshot().environment.navigation_api, false);
    assert.ok(rec.storage.get(storageKey));
});

test('storage read and write failures warn explicitly and preserve a memory-only export', () => {
    for (const options of [
        {readError: Object.assign(new Error('SECRET'), {name: 'SecurityError'})},
        {writeError: Object.assign(new Error('SECRET'), {name: 'QuotaExceededError'})},
    ]) {
        const rec = recorder(options);
        rec.timers(300);
        assert.equal(rec.snapshot().environment.persistence, 'page-memory-only');
        assert.ok(rec.warnings.length);
        assert.match(rec.status.textContent, /this page only/);
        assert.ok(rec.snapshot().events.some(event => event.type === 'storage-unavailable'));
        assert.ok(!JSON.stringify(rec.snapshot()).includes('SECRET'));
    }
});

test('malformed, oversized, and invalid-event histories are reset with visible feedback', () => {
    for (const raw of ['not json', 'x'.repeat(131073),
        JSON.stringify({schema_version: 1, pages: 2, events: [{type: 'SECRET'}]})]) {
        const rec = recorder({storage: new Map([[storageKey, raw]])});
        assert.ok(rec.warnings.length);
        assert.match(rec.status.textContent, /unreadable/);
        assert.equal(rec.snapshot().events.at(-1).type, 'history-reset');
    }
});

test('focus and popover observations contain regions rather than field values', () => {
    const rec = recorder();
    rec.menu.open = true;
    const input = rec.element('input', rec.body);
    rec.document.activeElement = input;
    rec.emit('focusin', input);
    rec.emit('beforetoggle', rec.menu, {newState: 'closed'});
    rec.emit('pointerenter', rec.trigger);
    const events = rec.snapshot().events;
    assert.equal(events.at(-3).focus, 'page-input');
    assert.equal(events.at(-2).type, 'popover-close');
    assert.equal(events.at(-1).type, 'pointerenter');
    assert.ok(!JSON.stringify(events).includes('NOTE SECRET'));
});

test('export finalizes pending cancellation, downloads JSON, and releases its object URL', async () => {
    const rec = recorder();
    rec.emit('click', rec.link, {between: event => event.preventDefault()});
    rec.button.handlers.get('click')();
    assert.equal(rec.blobs.length, 1);
    const data = JSON.parse(await rec.blobs[0].text());
    assert.equal(data.schema_version, 1);
    assert.match(data.captured_at, /^\d{4}-\d\d-\d\dT.*Z$/);
    assert.ok(data.events.some(event =>
        event.type === 'click-result' && event.default_prevented));
    assert.equal(data.events.at(-1).type, 'diagnostics-export');
    assert.match(rec.status.textContent, /Download requested/);
    rec.timers(1000);
    assert.equal(rec.revoked.length, 1);
});

test('download errors and canceled downloads are visible and allow explicit retry', async () => {
    for (const options of [{downloadError: new Error('SECRET')}, {cancelDownload: true}]) {
        const rec = recorder(options);
        rec.button.handlers.get('click')();
        assert.equal(rec.errors.length, 1);
        assert.equal(rec.status.attributes.get('role'), 'alert');
        assert.match(rec.status.textContent, /Could not download/);
        options.downloadError = null;
        options.cancelDownload = false;
        rec.button.handlers.get('click')();
        assert.equal(rec.status.attributes.get('role'), 'status');
        assert.match(rec.status.textContent, /Download requested/);
        assert.ok(JSON.parse(await rec.blobs.at(-1).text()));
    }
});

test('headerless embeds neither record a second history nor attach an export action', () => {
    const rec = recorder({embedded: true});
    assert.equal(rec.window.SBNavDiagnostics, undefined);
    assert.equal(rec.storage.size, 0);
    assert.equal(rec.button.handlers.size, 0);
});
