const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateReading} = require('../../static/js/ui-pods-directory.js');

test('reading offsets are finite nonnegative numbers', () => {
    const state = {top: 154, left: 4};
    assert.equal(validateReading(state), state);
    for (const input of [null, {}, {...state, top: -1}, {...state, left: Infinity},
        {...state, top: '1'}]) assert.throws(() => validateReading(input));
});

function harness(saved = {top: 120, left: 4}) {
    class Element {
        constructor() {
            this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true;
        }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            for (const fn of this.handlers[type] || []) fn({target: this, ...extra});
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const document = new Element(), window = new Element(), navigations = [];
    document.querySelector = () => root;
    root.querySelector = selector => selector === '.sb-pods-reading' ? reading : notice;
    const history = {state: {unrelated: 7, sbTableSort: {keep: 1},
        sbPodsDirectory: saved}, replaceState(value) { this.state = value; }};
    window.location = {assign(url) { navigations.push(url); }};
    vm.runInNewContext(fs.readFileSync('static/js/ui-pods-directory.js', 'utf8'),
        {root, document, window, history});
    return {root, reading, notice, document, window, history, navigations};
}

test('mounted history restores on Back and preserves independent sorter state', () => {
    const h = harness();
    assert.equal(h.reading.scrollTop, 120);
    assert.equal(h.reading.scrollLeft, 4);
    h.reading.scrollTop = 260;
    h.reading.fire('scroll');
    assert.equal(h.history.state.sbPodsDirectory.top, 260);
    assert.equal(h.history.state.sbTableSort.keep, 1);
    assert.equal(h.history.state.unrelated, 7);
    h.reading.scrollTop = 0;
    h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 260);
    h.window.fire('pagehide');
});

test('row navigation ignores explicit links, modifiers, consumed and nonprimary clicks', () => {
    const h = harness(), row = {dataset: {podHref: '/pod/8'}};
    const target = {closest: selector => selector === '[data-pod-href]' ? row : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true},
        {altKey: true}, {defaultPrevented: true}, {button: 1}]) {
        h.root.fire('click', {target, ...extra});
    }
    const link = {closest: () => ({})};
    h.root.fire('click', {target: link});
    h.document.fire('click', {target: link});
    assert.equal(h.navigations.length, 0);
    h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.navigations, ['/pod/8']);
});

test('malformed reading history is surfaced without crashing the directory', () => {
    const h = harness({top: -1, left: 0});
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /Invalid POD/);
    assert.equal(h.reading.scrollTop, 0);
});
