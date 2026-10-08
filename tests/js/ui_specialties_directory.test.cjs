const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateReading} = require('../../static/js/ui-specialties-directory.js');

function harness(saved = {top: 180, left: 4}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            const event = {target: this, ...extra};
            for (const fn of this.handlers[type] || []) fn(event);
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const document = new Element(), window = new Element(), navigations = [], errors = [];
    let mounts = 0;
    document.querySelector = () => root;
    root.querySelector = selector => ({'.specialties-reading': reading, '.specialties-notice': notice})[selector];
    window.history = {state: {keep: 7, sbTableSort: {'specialties-directory': {column: 2, direction: 'ascending'}, other: 1}, sbSpecialtiesDirectory: saved},
        replaceState(value) { this.state = value; }};
    window.location = {assign(url) { navigations.push(url); }};
    window.console = {error(...error) { errors.push(error); }};
    window.SBTableSort = {mount(value) { assert.equal(value, root); mounts++; }};
    window.fetch = () => { throw Error('Directory must not make writes or requests'); };
    window.document = document;
    vm.runInNewContext(fs.readFileSync('static/js/ui-specialties-directory.js', 'utf8'), {window});
    return {root, reading, notice, document, window, navigations, errors, mounts: () => mounts};
}

test('reading offsets require finite nonnegative numbers', () => {
    const value = {top: 8, left: 2};
    assert.equal(validateReading(value), value);
    for (const invalid of [null, {}, {...value, top: -1}, {...value, left: Infinity}, {...value, top: '2'}])
        assert.throws(() => validateReading(invalid));
});

test('restores nonzero reading offsets and preserves sorter and unrelated history', () => {
    const h = harness();
    assert.equal(h.reading.scrollTop, 180);
    assert.equal(h.reading.scrollLeft, 4);
    h.reading.scrollTop = 420;
    h.reading.fire('scroll');
    assert.equal(h.window.history.state.sbSpecialtiesDirectory.top, 420);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    assert.equal(h.window.history.state.keep, 7);
    h.reading.scrollTop = 0;
    h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 420);
    assert.equal(h.mounts(), 2);
});

test('row navigation respects modifiers, existing controls and canceled events', () => {
    const h = harness(), row = {dataset: {specialtyHref: '/specialties/7'}};
    const target = {closest: selector => selector === '[data-specialty-href]' ? row : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {defaultPrevented: true}, {button: 1}])
        h.root.fire('click', {target, ...extra});
    h.root.fire('click', {target: {closest: selector => selector === 'a,button,input' ? {} : null}});
    assert.equal(h.navigations.length, 0);
    h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.navigations, ['/specialties/7']);
    assert.equal(h.window.history.state.sbSpecialtiesDirectory.top, 180);
});

test('links and pagehide save current reading context without navigating or writing', () => {
    const h = harness();
    h.reading.scrollTop = 900;
    h.document.fire('click', {target: {closest: () => ({})}});
    assert.equal(h.window.history.state.sbSpecialtiesDirectory.top, 900);
    h.reading.scrollTop = 1200;
    h.window.fire('pagehide');
    assert.equal(h.window.history.state.sbSpecialtiesDirectory.top, 1200);
    assert.equal(h.navigations.length, 0);
});

test('malformed restoration and unavailable history surface explicit errors', () => {
    const h = harness({top: -1, left: 0});
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
    h.window.history.replaceState = () => { throw Error('Unavailable'); };
    h.reading.fire('scroll');
    assert.equal(h.errors.length, 2);
    assert.match(h.notice.textContent, /Could not restore or remember/);
});
