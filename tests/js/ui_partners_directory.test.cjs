const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateReading} = require('../../static/js/ui-partners-directory.js');

function harness(saved = {top: 180, left: 4}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            for (const fn of this.handlers[type] || []) fn({target: this, ...extra});
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const share = new Element(), document = new Element(), window = new Element();
    const navigations = [], shares = [], errors = [];
    document.querySelector = () => root;
    root.querySelector = selector => ({
        '.partners-reading': reading, '.partners-notice': notice, '[data-share-directory]': share,
    })[selector];
    window.history = {state: {keep: 7, sbTableSort: {other: 1}, sbPartnersDirectory: saved},
        replaceState(value) { this.state = value; }};
    window.location = {assign(url) { navigations.push(url); }};
    window.console = {error(...error) { errors.push(error); }};
    window.Share = {openShareModal(type) { shares.push(type); }};
    window.document = document;
    vm.runInNewContext(fs.readFileSync('static/js/ui-partners-directory.js', 'utf8'), {window});
    return {root, reading, notice, share, document, window, navigations, shares, errors};
}

test('only finite nonnegative reading positions restore', () => {
    assert.deepEqual(validateReading({top: 2, left: 1}), {top: 2, left: 1});
    for (const value of [null, {}, {top: -1, left: 0}, {top: 0, left: Infinity}])
        assert.throws(() => validateReading(value));
});

test('mount performs no share/write; Back merges sorter and restores reading', () => {
    const h = harness();
    assert.equal(h.shares.length, 0);
    assert.equal(h.reading.scrollTop, 180);
    h.reading.scrollTop = 420;
    h.reading.fire('scroll');
    assert.equal(h.window.history.state.sbPartnersDirectory.top, 420);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    assert.equal(h.window.history.state.keep, 7);
    h.reading.scrollTop = 0;
    h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 420);
    h.share.fire('click');
    assert.deepEqual(h.shares, ['directory']);
});

test('row navigation respects direct specialty links and modified activation', () => {
    const h = harness(), row = {dataset: {partnerHref: '/partners/7'}};
    const target = {closest: selector => selector === '[data-partner-href]' ? row : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true},
        {altKey: true}, {defaultPrevented: true}, {button: 1}]) h.root.fire('click', {target, ...extra});
    h.root.fire('click', {target: {closest: selector => selector === 'a,button,input' ? {} : null}});
    assert.equal(h.navigations.length, 0);
    h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.navigations, ['/partners/7']);
});

test('malformed or inaccessible history reports a real failure, without business writes', () => {
    const h = harness({top: -1, left: 0});
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /Could not restore/);
    h.window.history.replaceState = () => { throw Error('denied'); };
    h.reading.fire('scroll');
    assert.match(h.notice.textContent, /Could not remember/);
    assert.equal(h.shares.length, 0);
});
