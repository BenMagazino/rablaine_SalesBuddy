const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateReading, pageSizeUrl} = require('../../static/js/ui-notes-directory.js');

function harness({saved = {top: 180, left: 4}, storage = '25',
    href = 'http://localhost/notes?filter=general&per_page=25&page=2',
    storageError = false} = {}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            for (const fn of this.handlers[type] || []) fn({target: this, ...extra});
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const select = new Element(), document = new Element(), window = new Element();
    const navigations = [], replacements = [], errors = [], values = [];
    select.value = '25';
    document.querySelector = () => root;
    root.querySelector = selector => ({
        '.notes-reading': reading, '.notes-notice': notice, '#perPageSelect': select,
    })[selector];
    window.document = document;
    window.history = {state: {keep: 7, sbTableSort: {other: 1}, sbNotesDirectory: saved},
        replaceState(value) { this.state = value; }};
    window.location = {href, assign(url) { navigations.push(url); },
        replace(url) { replacements.push(url); }};
    window.localStorage = {
        getItem(key) {
            assert.equal(key, 'notesList.perPage');
            if (storageError) throw Error('Storage unavailable');
            return storage;
        },
        setItem(key, value) {
            assert.equal(key, 'notesList.perPage');
            if (storageError) throw Error('Storage unavailable');
            values.push(value);
        },
    };
    window.console = {error(...error) { errors.push(error); }};
    window.fetch = () => { throw Error('Notes directory must not request writes'); };
    vm.runInNewContext(fs.readFileSync('static/js/ui-notes-directory.js', 'utf8'),
        {window, URL});
    return {root, reading, notice, select, document, window, navigations, replacements,
        errors, values};
}

test('reading accepts only finite nonnegative offsets', () => {
    const value = {top: 120, left: 8};
    assert.equal(validateReading(value), value);
    for (const invalid of [null, {}, {...value, top: -1}, {...value, left: Infinity},
        {...value, top: '2'}]) assert.throws(() => validateReading(invalid));
});

test('size URL resets page, preserving filters and other context', () => {
    const url = new URL(pageSizeUrl('http://localhost/notes?filter=customer&page=3&keep=1', '100'));
    assert.equal(url.searchParams.get('per_page'), '100');
    assert.equal(url.searchParams.get('filter'), 'customer');
    assert.equal(url.searchParams.get('keep'), '1');
    assert.equal(url.searchParams.has('page'), false);
});

test('restores both offsets and merges unrelated history on Back', () => {
    const h = harness();
    assert.equal(h.reading.scrollTop, 180);
    assert.equal(h.reading.scrollLeft, 4);
    h.reading.scrollTop = 420;
    h.reading.scrollLeft = 12;
    h.reading.fire('scroll');
    assert.equal(h.window.history.state.keep, 7);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    h.reading.scrollTop = 0;
    h.reading.scrollLeft = 0;
    h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 420);
    assert.equal(h.reading.scrollLeft, 12);
});

test('row navigation respects existing links, canceled events and modifiers', () => {
    const h = harness(), row = {dataset: {noteHref: '/note/7'}};
    const target = {closest: selector => selector === '[data-note-href]' ? row : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true},
        {altKey: true}, {defaultPrevented: true}, {button: 1}]) {
        h.root.fire('click', {target, ...extra});
    }
    h.root.fire('click', {target: {closest: selector =>
        selector === 'a,button,input,select' ? {} : null}});
    assert.equal(h.navigations.length, 0);
    h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.navigations, ['/note/7']);
});

test('link and pagehide store reading without writing or navigating', () => {
    const h = harness();
    h.reading.scrollTop = 900;
    h.document.fire('click', {target: {closest: () => ({})}});
    assert.equal(h.window.history.state.sbNotesDirectory.top, 900);
    h.reading.scrollTop = 1200;
    h.window.fire('pagehide');
    assert.equal(h.window.history.state.sbNotesDirectory.top, 1200);
    assert.equal(h.navigations.length, 0);
});

test('saved page size applies once only when URL omits per_page', () => {
    const h = harness({storage: '100', href: 'http://localhost/notes?filter=general&page=3'});
    assert.deepEqual(h.replacements, ['http://localhost/notes?filter=general&per_page=100']);
    assert.equal(h.values.length, 0);
    const explicit = harness({storage: '100'});
    assert.equal(explicit.replacements.length, 0);
    assert.deepEqual(explicit.values, ['25']);
});

test('changing page size remembers the value and starts the same scope at page one', () => {
    const h = harness();
    h.select.value = '50';
    h.select.fire('change');
    assert.deepEqual(h.navigations, ['http://localhost/notes?filter=general&per_page=50']);
    assert.deepEqual(h.values, ['25', '50']);
    assert.equal(h.window.history.state.sbNotesDirectory.top, 180);
});

test('storage failure is explicit and still allows page size navigation', () => {
    const h = harness({storageError: true});
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
    h.select.value = '100';
    h.select.fire('change');
    assert.equal(h.errors.length, 2);
    assert.deepEqual(h.navigations, ['http://localhost/notes?filter=general&per_page=100']);
});

test('malformed restoration and history failures log and surface alerts', () => {
    const h = harness({saved: {top: -1, left: 0}});
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
    h.window.history.replaceState = () => { throw Error('Unavailable'); };
    h.reading.fire('scroll');
    assert.equal(h.errors.length, 2);
    assert.match(h.notice.textContent, /Could not remember Notes reading context/);
});
