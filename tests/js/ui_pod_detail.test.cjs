const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateHistory} = require('../../static/js/ui-pod-detail.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-pod-detail.js'), 'utf8');

test('POD reading history validates identity, known cells and raw offsets', () => {
    const state = {id: 3, scrolls: {coverage: 40, personnel: 80}};
    assert.equal(validateHistory(state, 3), state);
    for (const bad of [null, {id: 4, scrolls: {}}, {id: 3, scrolls: []},
        {id: 3, scrolls: {coverage: -1}}, {id: 3, scrolls: {wrong: 1}},
        {id: 3, scrolls: {personnel: '4'}}]) {
        assert.throws(() => validateHistory(bad, 3));
    }
});
test('independent cells restore on pageshow and preserve sorter and assignment state', () => {
    const regions = ['coverage', 'personnel'].map(key => ({dataset: {pdScroll: key},
        scrollTop: 0, addEventListener(type, fn) { this[type] = fn; }}));
    const events = {}, handlers = {}, destinations = [];
    const root = {dataset: {podId: '3'}, querySelectorAll: () => regions,
        addEventListener(type, fn) { handlers[type] = fn; }};
    let mounts = 0;
    const window = {document: {querySelector: () => root, getElementById: () => ({})},
        history: {state: {sbTableSort: {kept: true}, sbPodForm: {kept: true},
            sbPodDetail: {id: 3, scrolls: {coverage: 40, personnel: 80}}},
            replaceState(value) { this.state = value; }},
        SBTableSort: {mount() { mounts++; }}, console: {error() {}},
        location: {assign(url) { destinations.push(url); }},
        addEventListener(type, fn) { events[type] = fn; }};
    vm.runInNewContext(source, {window});
    assert.equal(regions[0].scrollTop, 40);
    assert.equal(regions[1].scrollTop, 80);
    regions[0].scrollTop = 55;
    regions[0].scroll();
    assert.equal(window.history.state.sbTableSort.kept, true);
    assert.equal(window.history.state.sbPodForm.kept, true);
    regions[1].scrollTop = 0;
    events.pageshow();
    assert.equal(regions[1].scrollTop, 80);
    assert.equal(mounts, 2);
    handlers.click({button: 0, target: {closest: selector =>
        selector === '[data-pd-href]' ? {dataset: {pdHref: '/territory/1'}} : null}});
    assert.deepEqual(destinations, ['/territory/1']);
});
test('initial mounting waits for deferred shared sorter loading', () => {
    let callback;
    let queries = 0;
    const window = {document: {readyState: 'loading',
        querySelector() { queries++; return null; },
        addEventListener(type, fn, options) {
            assert.equal(type, 'DOMContentLoaded');
            assert.equal(options.once, true);
            callback = fn;
        }}};
    vm.runInNewContext(source, {window});
    assert.equal(queries, 0);
    callback();
    assert.equal(queries, 1);
});
