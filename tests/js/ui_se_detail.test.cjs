const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateHistory} = require('../../static/js/ui-se-detail.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-se-detail.js'), 'utf8');

test('SE history validates identity and raw independent reading offsets', () => {
    const saved = {id: 3, scrolls: {pods: 40, territories: 80}};
    assert.equal(validateHistory(saved, 3), saved);
    for (const bad of [null, {id: 4, scrolls: {}}, {id: 3, scrolls: []},
        {id: 3, scrolls: {pods: -1}}, {id: 3, scrolls: {wrong: 1}},
        {id: 3, scrolls: {territories: '4'}}]) {
        assert.throws(() => validateHistory(bad, 3));
    }
});

test('Back restores both panes and sorter state; deletion guards repeat submit and dismissal', () => {
    const regions = ['pods', 'territories'].map(key => ({dataset: {sedScroll: key},
        scrollTop: 0, addEventListener(type, fn) { this[type] = fn; }}));
    const buttons = [{disabled: false}, {disabled: false}], status = {};
    const form = {querySelectorAll: () => buttons, querySelector: () => status,
        addEventListener(type, fn) { this[type] = fn; }};
    const dialog = {querySelector: () => form,
        addEventListener(type, fn) { this[type] = fn; }};
    const events = {}, handlers = {}, destinations = [];
    const root = {dataset: {seDetail: '3'}, querySelectorAll: () => regions,
        querySelector: selector => selector === '#seDeleteDialog' ? dialog : {},
        addEventListener(type, fn) { handlers[type] = fn; }};
    let mounts = 0;
    const window = {document: {querySelector: () => root},
        history: {state: {sbTableSort: {kept: true},
            sbSeDetail: {id: 3, scrolls: {pods: 40, territories: 80}}},
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
    regions[1].scrollTop = 0;
    events.pageshow();
    assert.equal(regions[1].scrollTop, 80);
    assert.equal(mounts, 2);
    handlers.click({button: 0, target: {closest: selector =>
        selector === '[data-sed-href]' ? {dataset: {sedHref: '/territory/1'}} : null}});
    assert.deepEqual(destinations, ['/territory/1']);
    let prevented = 0;
    const event = {preventDefault() { prevented++; }};
    form.submit(event);
    assert.equal(buttons[0].disabled, true);
    assert.equal(status.textContent, 'Deleting solution engineer...');
    form.submit(event);
    dialog['sb:dialog-before-close'](event);
    assert.equal(prevented, 2);
    events.pageshow();
    assert.equal(buttons[0].disabled, false);
    dialog['sb:dialog-before-close'](event);
    assert.equal(prevented, 2);
    vm.runInNewContext(source, {window});
    assert.equal(mounts, 3);
});

test('initial mount waits for shared sorter and dialog initialization', () => {
    let callback, queries = 0;
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
