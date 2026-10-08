const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateContext} = require('../../static/js/ui-search.js');

function harness({saved, missingRoot = false} = {}) {
    class Element {
        constructor() { this.handlers = {}; this.scrollTop = 0; this.scrollLeft = 0; this.hidden = true; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type, extra = {}) {
            for (const fn of this.handlers[type] || []) fn({target: this, ...extra});
        }
        closest() { return null; }
    }
    const root = new Element(), reading = new Element(), notice = new Element();
    const form = new Element(), document = new Element(), window = new Element(), errors = [];
    const q = {name: 'q', tagName: 'INPUT', value: 'submitted'};
    const customer = {name: 'customer_id', tagName: 'SELECT', multiple: false,
        options: [{value: '', selected: true}, {value: '7', selected: false}]};
    const topics = {name: 'topic_ids', tagName: 'SELECT', multiple: true,
        options: [{value: '2', selected: true}, {value: '3', selected: false}]};
    for (const field of [customer, topics]) {
        Object.defineProperty(field, 'selectedOptions', {get() {
            return field.options.filter(o => o.selected);
        }});
    }
    form.querySelectorAll = () => [q, customer, topics];
    root.querySelector = selector => ({
        '.search-reading': reading, '.search-notice': notice, form,
    })[selector];
    document.querySelector = () => missingRoot ? null : root;
    window.document = document;
    window.history = {state: {keep: 7, sbTableSort: {other: 1}, sbSearch: saved},
        replaceState(value) { this.state = value; }};
    window.console = {error(...args) { errors.push(args); }};
    window.fetch = () => { throw Error('Search must not issue requests'); };
    vm.runInNewContext(fs.readFileSync('static/js/ui-search.js', 'utf8'), {window});
    return {root, reading, notice, form, window, q, customer, topics, errors};
}

test('only finite nonnegative reading and string-array fields restore', () => {
    const value = {top: 120, left: 8, fields: {q: ['needle'], topic_ids: ['2', '3']}};
    assert.equal(validateContext(value), value);
    for (const invalid of [null, {}, {...value, top: -1}, {...value, left: Infinity},
        {...value, fields: {q: 'text'}}, {...value, fields: {q: [1]}},
        {...value, fields: []},
        {...value, top: '3'}]) assert.throws(() => validateContext(invalid));
});

test('actual controller restores both reading axes and all repeated selections', () => {
    const h = harness({saved: {top: 400, left: 4,
        fields: {q: ['draft'], customer_id: ['7'], topic_ids: ['2', '3']}}});
    assert.equal(h.reading.scrollTop, 400);
    assert.equal(h.reading.scrollLeft, 4);
    assert.equal(h.q.value, 'draft');
    assert.deepEqual(h.customer.selectedOptions.map(o => o.value), ['7']);
    assert.deepEqual(h.topics.selectedOptions.map(o => o.value), ['2', '3']);
    h.q.value = 'later draft';
    h.form.fire('input');
    assert.equal(h.window.history.state.keep, 7);
    assert.equal(h.window.history.state.sbTableSort.other, 1);
    h.q.value = '';
    h.reading.scrollTop = 0;
    h.window.fire('pageshow');
    assert.equal(h.q.value, 'later draft');
    assert.equal(h.reading.scrollTop, 400);
});

test('changes, submit, scrolling, links and pagehide remember without requesting writes', () => {
    const h = harness();
    for (const event of ['input', 'change', 'submit']) {
        h.q.value = event;
        h.form.fire(event);
        assert.equal(h.window.history.state.sbSearch.fields.q[0], event);
    }
    h.reading.scrollTop = 500;
    h.reading.fire('scroll');
    assert.equal(h.window.history.state.sbSearch.top, 500);
    h.reading.scrollLeft = 20;
    h.root.fire('click', {target: {closest: () => ({})}});
    assert.equal(h.window.history.state.sbSearch.left, 20);
    h.reading.scrollTop = 700;
    h.root.fire('click', {defaultPrevented: true, target: {closest: () => ({})}});
    assert.equal(h.window.history.state.sbSearch.top, 500);
    h.window.fire('pagehide');
    assert.equal(h.window.history.state.sbSearch.top, 700);
});

test('empty topics remain empty, absent seller-mode fields are not created', () => {
    const h = harness({saved: {top: 0, left: 0, fields: {
        q: [''], topic_ids: [], seller_id: ['99'],
    }}});
    assert.equal(h.topics.selectedOptions.length, 0);
    h.form.fire('change');
    assert.equal('seller_id' in h.window.history.state.sbSearch.fields, false);
    assert.equal(h.window.history.state.sbSearch.fields.topic_ids.length, 0);
});

test('invalid or unavailable controls fail visibly without partially restoring fields', () => {
    for (const fields of [
        {q: ['draft'], customer_id: ['999']},
        {q: ['draft'], customer_id: ['', '7']},
        {q: []},
    ]) {
        const h = harness({saved: {top: 300, left: 0, fields}});
        assert.equal(h.q.value, 'submitted');
        assert.equal(h.reading.scrollTop, 0);
        assert.equal(h.notice.hidden, false);
        assert.match(h.notice.textContent, /Could not restore Search/);
        assert.equal(h.errors.length, 1);
    }
});

test('history and malformed reading failures log and surface honest notices', () => {
    const h = harness({saved: {top: -1, left: 0, fields: {}}});
    assert.equal(h.errors.length, 1);
    h.window.history.replaceState = () => { throw Error('Unavailable'); };
    h.form.fire('submit');
    assert.equal(h.errors.length, 2);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /Could not remember Search/);
});

test('unrelated pages are untouched', () => {
    const h = harness({missingRoot: true});
    assert.equal(Object.keys(h.window.handlers).length, 0);
    assert.equal(h.errors.length, 0);
});

test('Search help describes real semantics rather than fictional relevance and type filters', () => {
    const source = fs.readFileSync('static/js/page-help.js', 'utf8');
    const help = source.slice(source.indexOf("{ pattern: /^\\/search/"),
        source.indexOf("// ── Analytics"));
    for (const text of ['case-insensitive substring', 'any selected topic', 'Seller mode',
        'General notes', 'Back restores', 'no date filters', 'pagination or exports']) {
        assert.ok(help.includes(text), text);
    }
    assert.equal(help.includes('ranked by relevance'), false);
    assert.equal(help.includes('across all your notes, customers, and engagements'), false);
});
