const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateReading} = require('../../static/js/ui-internal-contacts-directory.js');

function harness(saved = {top: 180, left: 4}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true; this.disabled = false; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            const event = {target: this, prevented: false, preventDefault() { this.prevented = true; }, ...extra};
            for (const fn of this.handlers[type] || []) fn(event);
            return event;
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const dialog = new Element(), form = new Element(), identity = new Element(), status = new Element();
    const buttons = [new Element(), new Element(), new Element()];
    const document = new Element(), window = new Element(), navigations = [], opened = [], errors = [];
    document.querySelector = () => root;
    root.querySelector = selector => ({'.ic-reading': reading, '.ic-notice': notice, '#icDeleteDialog': dialog})[selector];
    dialog.querySelector = selector => selector === 'form' ? form : identity;
    form.querySelector = () => status;
    form.querySelectorAll = () => buttons;
    form.getAttribute = () => form.action || null;
    window.history = {state: {keep: 7, sbTableSort: {sort: 1}, sbICDirectory: saved},
        replaceState(value) { this.state = value; }};
    window.location = {assign(url) { navigations.push(url); }};
    window.SBDialog = {open(value) { opened.push(value); }};
    window.console = {error(error) { errors.push(error); }};
    window.document = document;
    vm.runInNewContext(fs.readFileSync('static/js/ui-internal-contacts-directory.js', 'utf8'), {window});
    return {root, reading, notice, dialog, form, identity, status, buttons, document, window, navigations, opened, errors};
}

test('reading offsets require finite nonnegative numbers', () => {
    const value = {top: 8, left: 2};
    assert.equal(validateReading(value), value);
    for (const invalid of [null, {}, {...value, top: -1}, {...value, left: Infinity}, {...value, top: '2'}])
        assert.throws(() => validateReading(invalid));
});

test('Back reading restoration preserves table sorting and unrelated entry state', () => {
    const h = harness();
    assert.equal(h.reading.scrollTop, 180);
    assert.equal(h.reading.scrollLeft, 4);
    h.reading.scrollTop = 320;
    h.reading.fire('scroll');
    assert.equal(h.window.history.state.sbICDirectory.top, 320);
    assert.equal(h.window.history.state.sbTableSort.sort, 1);
    assert.equal(h.window.history.state.keep, 7);
    h.reading.scrollTop = 0;
    h.window.fire('pageshow');
    assert.equal(h.reading.scrollTop, 320);
});

test('row navigation preserves modifiers and independent links/buttons', () => {
    const h = harness(), row = {dataset: {icHref: '/internal-contacts/7/edit'}};
    const target = {closest: selector => selector === '[data-ic-href]' ? row : null};
    for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {defaultPrevented: true}, {button: 1}])
        h.root.fire('click', {target, ...extra});
    h.root.fire('click', {target: {closest: selector => selector === 'a,button,input' ? {} : null}});
    assert.equal(h.navigations.length, 0);
    h.root.fire('click', {target, button: 0});
    assert.deepEqual(h.navigations, ['/internal-contacts/7/edit']);
});

test('delete dialog uses safe identity text and exact POST action, with pending guards', () => {
    const h = harness(), deletion = {dataset: {icDeleteUrl: '/internal-contacts/7/delete', icDeleteName: '<Person>'}};
    h.root.fire('click', {target: {closest: selector => selector === '[data-ic-delete-url]' ? deletion : null}});
    assert.equal(h.form.action, '/internal-contacts/7/delete');
    assert.equal(h.identity.textContent, '<Person>');
    assert.deepEqual(h.opened, [h.dialog]);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.form.fire('submit').prevented, false);
    assert.ok(h.buttons.every(button => button.disabled));
    assert.equal(h.dialog.fire('sb:dialog-before-close').prevented, true);
    assert.equal(h.form.fire('submit').prevented, true);
    h.window.fire('pageshow');
    assert.ok(h.buttons.every(button => !button.disabled));
    assert.equal(h.status.textContent, '');
    assert.equal(h.dialog.fire('sb:dialog-before-close').prevented, false);
});

test('unselected dialog cannot submit and history failures are honest', () => {
    const h = harness({top: -1, left: 0});
    assert.equal(h.form.fire('submit').prevented, true);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
    h.window.history.replaceState = () => { throw Error('history unavailable'); };
    h.window.fire('pagehide');
    assert.equal(h.errors.length, 2);
});
