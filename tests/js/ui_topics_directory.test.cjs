const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateReading, savePreference} = require('../../static/js/ui-topics-directory.js');

function harness(saved = {top: 180, left: 4}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true; this.disabled = false; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        async fire(type, extra = {}) {
            const event = {target: this, prevented: false, preventDefault() { this.prevented = true; }, ...extra};
            for (const fn of this.handlers[type] || []) await fn(event);
            return event;
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const toggle = new Element(), status = new Element(), document = new Element();
    const window = new Element(), navigations = [], errors = [], requests = [];
    let reloads = 0;
    root.dataset = {defaultByNotes: 'false'};
    document.querySelector = selector => selector === '[data-topics-directory]' ? root : status;
    root.querySelector = selector => ({'.topics-reading': reading, '.topics-notice': notice, '#sortToggle': toggle})[selector];
    window.history = {state: {keep: 7, sbTableSort: {'topics-directory': {column: 2, direction: 'ascending'}, other: 1}, sbTopicsDirectory: saved},
        replaceState(value) { this.state = value; }};
    window.location = {assign(url) { navigations.push(url); }, reload() { reloads++; }};
    window.console = {error(...error) { errors.push(error); }};
    window.fetch = async (url, options) => {
        requests.push({url, options});
        return {ok: true, json: async () => ({topic_sort_by_calls: true})};
    };
    window.document = document;
    vm.runInNewContext(fs.readFileSync('static/js/ui-topics-directory.js', 'utf8'), {window});
    return {root, reading, notice, toggle, status, document, window, navigations, errors, requests, reloads: () => reloads};
}

test('reading offsets require finite nonnegative numbers', () => {
    const value = {top: 8, left: 2};
    assert.equal(validateReading(value), value);
    for (const invalid of [null, {}, {...value, top: -1}, {...value, left: Infinity}, {...value, top: '2'}])
        assert.throws(() => validateReading(invalid));
});

test('exact explicit preference POST checks HTTP and returned value', async () => {
    let observed;
    await savePreference(async (url, options) => {
        observed = {url, options};
        return {ok: true, json: async () => ({topic_sort_by_calls: false})};
    }, false);
    assert.equal(observed.url, '/api/preferences/topic-sort');
    assert.equal(observed.options.method, 'POST');
    assert.equal(observed.options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(observed.options.body), {topic_sort_by_calls: false});
    for (const response of [{ok: false, json: async () => ({error: 'Failure'})},
        {ok: true, json: async () => ({topic_sort_by_calls: false})},
        {ok: true, json: async () => { throw Error('Invalid JSON'); }}])
        await assert.rejects(savePreference(async () => response, true));
});

test('no mount writes; actual reading state merges sorter and unrelated history', async () => {
    const h = harness();
    assert.equal(h.requests.length, 0);
    assert.equal(h.reading.scrollTop, 180);
    h.reading.scrollTop = 420;
    await h.reading.fire('scroll');
    assert.equal(h.window.history.state.sbTopicsDirectory.top, 420);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    assert.equal(h.window.history.state.keep, 7);
    h.reading.scrollTop = 0;
    await h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 420);
});

test('non-control row navigation respects modifiers and retains reading offsets', async () => {
    const h = harness(), row = {dataset: {topicHref: '/topic/7'}};
    const target = {closest: selector => selector === '[data-topic-href]' ? row : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {defaultPrevented: true}, {button: 1}])
        await h.root.fire('click', {target, ...extra});
    await h.root.fire('click', {target: {closest: selector => selector === 'a,button,input' ? {} : null}});
    assert.equal(h.navigations.length, 0);
    await h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.navigations, ['/topic/7']);
    assert.equal(h.window.history.state.sbTopicsDirectory.top, 180);
});

test('successful saved default clears only this entry temporary sort and resets reading', async () => {
    const h = harness();
    await h.toggle.fire('click');
    assert.equal(h.requests.length, 1);
    assert.equal(h.reloads(), 1);
    assert.equal(h.window.history.state.sbTableSort['topics-directory'], undefined);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    assert.equal(h.window.history.state.keep, 7);
    assert.equal(h.window.history.state.sbTopicsDirectory.top, 0);
});

test('pending saves guard duplicate clicks, navigation and unload; failure retains order', async () => {
    const h = harness();
    let finish;
    h.window.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = h.toggle.fire('click');
    assert.equal(h.toggle.disabled, true);
    await h.toggle.fire('click');
    assert.equal((await h.window.fire('beforeunload')).prevented, true);
    assert.equal((await h.document.fire('click', {target: {closest: () => ({})}})).prevented, true);
    finish({ok: false, json: async () => ({error: 'Failed save'})});
    await pending;
    assert.equal(h.toggle.disabled, false);
    assert.equal(h.reloads(), 0);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /unchanged/);
    assert.equal(h.window.history.state.sbTableSort['topics-directory'].column, 2);
    assert.equal((await h.window.fire('beforeunload')).prevented, false);
});

test('history failure after successful save still reloads without claiming save failed', async () => {
    const h = harness();
    h.window.history.replaceState = () => { throw Error('history unavailable'); };
    await h.toggle.fire('click');
    assert.equal(h.reloads(), 1);
    assert.match(h.notice.textContent, /Default order saved/);
});

test('malformed history displays honest restoration failure', () => {
    const h = harness({top: -1, left: 0});
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
});
