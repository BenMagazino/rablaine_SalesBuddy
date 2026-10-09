const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateHistory} = require('../../static/js/ui-specialty-detail.js');
const source = fs.readFileSync('static/js/ui-specialty-detail.js', 'utf8');

function harness(saved = {id: 6, top: 60, left: 20, description: 10}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            const event = {target: {closest: () => null}, preventDefault() {this.prevented = true;},
                ...extra};
            for (const fn of this.handlers[type] || []) fn(event);
            return event;
        }
    }
    const root = new Element(), reading = new Element(), description = new Element();
    const dialog = new Element(), form = new Element(), document = new Element();
    const window = new Element(), notice = {}, status = {}, buttons = [{disabled: false}];
    const errors = [], destinations = [];
    let mounts = 0;
    root.dataset = {specialtyDetail: '6'};
    root.querySelector = selector => ({'.specialty-reading': reading,
        '.specialty-description': description, '#deleteSpecialtyDialog': dialog,
        '.specialty-notice': notice})[selector];
    dialog.querySelector = () => form;
    form.querySelector = () => status;
    form.querySelectorAll = () => buttons;
    document.querySelector = () => root;
    window.document = document;
    window.history = {state: {keep: 7, sbTableSort: {other: 1}, sbSpecialtyDetail: saved},
        replaceState(value) {this.state = value;}};
    window.SBTableSort = {mount(value) {assert.equal(value, root); mounts++;}};
    window.location = {assign(url) {destinations.push(url);}};
    window.console = {error(...args) {errors.push(args);}};
    window.fetch = () => {throw Error('Detail must not make requests');};
    vm.runInNewContext(source, {window});
    return {root, reading, description, dialog, form, document, window, notice, status,
        buttons, errors, destinations, mounts: () => mounts};
}

test('history validates identity and all reading axes without coerced defaults', () => {
    const saved = {id: 6, top: 2, left: 5, description: 8};
    assert.equal(validateHistory(saved, 6), saved);
    for (const bad of [null, {}, {...saved, id: 7}, {...saved, top: -1},
        {...saved, left: Infinity}, {...saved, description: '8'}])
        assert.throws(() => validateHistory(bad, 6));
});

test('Back restores both reading axes and description without losing sorts or other state', () => {
    const h = harness();
    assert.equal(h.reading.scrollTop, 60);
    assert.equal(h.reading.scrollLeft, 20);
    assert.equal(h.description.scrollTop, 10);
    h.reading.scrollTop = 180;
    h.description.scrollTop = 70;
    h.reading.fire('scroll');
    assert.equal(h.window.history.state.keep, 7);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    h.reading.scrollTop = 0;
    h.description.scrollTop = 0;
    h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 180);
    assert.equal(h.description.scrollTop, 70);
    assert.equal(h.mounts(), 2);
    vm.runInNewContext(source, {window: h.window});
    assert.equal(h.mounts(), 2);
});

test('native pending deletion guards duplicate submit, close, shell links and unload', () => {
    const h = harness();
    h.form.fire('submit');
    assert.equal(h.buttons[0].disabled, true);
    assert.equal(h.status.textContent, 'Deleting specialty...');
    assert.equal(h.form.fire('submit').prevented, true);
    assert.equal(h.dialog.fire('sb:dialog-before-close').prevented, true);
    assert.equal(h.window.fire('beforeunload').prevented, true);
    assert.equal(h.document.fire('click', {target: {closest: () => ({})}}).prevented, true);
    h.window.fire('pageshow');
    assert.equal(h.buttons[0].disabled, false);
    assert.equal(h.status.textContent, '');
    assert.equal(h.dialog.fire('sb:dialog-before-close').prevented, undefined);
    assert.equal(h.window.fire('beforeunload').prevented, undefined);
});

test('row navigation respects links, modifiers and canceled events', () => {
    const h = harness(), target = {closest: selector =>
        selector === '[data-specialty-partner-href]' ?
            {dataset: {specialtyPartnerHref: '/partners/4'}} : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {altKey: true}, {shiftKey: true},
        {button: 1}, {defaultPrevented: true}]) h.root.fire('click', {target, ...extra});
    h.root.fire('click', {target: {closest: () => ({})}});
    assert.deepEqual(h.destinations, []);
    h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.destinations, ['/partners/4']);
});

test('history failures are logged and visible; other identities do not restore', () => {
    const h = harness({id: 6, top: -1, left: 0, description: 0});
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
    h.window.history.replaceState = () => {throw Error('Unavailable');};
    h.window.fire('pagehide');
    assert.equal(h.errors.length, 2);
    assert.match(h.notice.textContent, /Could not restore or remember/);
    const other = harness({id: 8, top: 600, left: 0, description: 0});
    assert.equal(other.reading.scrollTop, 0);
});

test('initialization waits for shared native APIs and ignores unrelated pages', () => {
    let callback, queries = 0;
    vm.runInNewContext(source, {window: {document: {readyState: 'loading',
        querySelector() {queries++; return null;},
        addEventListener(type, fn, options) {
            assert.equal(type, 'DOMContentLoaded');
            assert.equal(options.once, true);
            callback = fn;
        }}}});
    assert.equal(queries, 0);
    callback();
    assert.equal(queries, 1);
});
