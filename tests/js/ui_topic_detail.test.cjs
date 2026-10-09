const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateHistory} = require('../../static/js/ui-topic-detail.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-topic-detail.js'), 'utf8');

test('Topic reading history validates identity and both axes', () => {
    const saved = {id: 4, top: 60, left: 20, description: 10};
    assert.equal(validateHistory(saved, 4), saved);
    for (const bad of [null, {...saved, id: 5}, {...saved, top: -1},
        {...saved, left: NaN}, {...saved, description: '10'}]) {
        assert.throws(() => validateHistory(bad, 4));
    }
});

test('Back keeps sorts and reading; native deletion guards repeat submit and navigation', () => {
    const events = {}, handlers = {}, status = {}, buttons = [{disabled: false}];
    const reading = {scrollTop: 0, scrollLeft: 0,
        addEventListener(type, fn) {this[type] = fn;}};
    const description = {...reading};
    const form = {querySelector: () => status, querySelectorAll: () => buttons,
        addEventListener(type, fn) {this[type] = fn;}};
    const dialog = {querySelector: () => form,
        addEventListener(type, fn) {this[type] = fn;}};
    const root = {dataset: {topicDetail: '4'},
        querySelector: selector => ({
            '.topic-reading': reading, '.topic-description': description,
            '#deleteTopicDialog': dialog, '.topic-notice': {},
        })[selector], addEventListener(type, fn) {handlers[type] = fn;}};
    let mounts = 0;
    const destinations = [];
    const window = {document: {querySelector: () => root}, console: {error() {}},
        history: {state: {sbTableSort: {kept: true},
            sbTopicDetail: {id: 4, top: 60, left: 20, description: 10}},
            replaceState(value) {this.state = value;}},
        SBTableSort: {mount() {mounts++;}},
        location: {assign(url) {destinations.push(url);}},
        addEventListener(type, fn) {events[type] = fn;}};
    vm.runInNewContext(source, {window});
    assert.equal(reading.scrollTop, 60);
    assert.equal(reading.scrollLeft, 20);
    assert.equal(description.scrollTop, 10);
    reading.scrollTop = 90;
    reading.scroll();
    assert.equal(window.history.state.sbTableSort.kept, true);
    reading.scrollTop = 0;
    events.pageshow();
    assert.equal(reading.scrollTop, 90);
    handlers.click({button: 0, target: {closest: selector =>
        selector === '[data-topic-note-href]' ?
            {dataset: {topicNoteHref: '/note/1'}} : null}});
    assert.deepEqual(destinations, ['/note/1']);
    handlers.click({button: 0, ctrlKey: true, target: {closest: () => null}});
    assert.deepEqual(destinations, ['/note/1']);
    let prevented = 0;
    const event = {target: {closest: () => true}, preventDefault() {prevented++;}};
    form.submit(event);
    assert.equal(buttons[0].disabled, true);
    assert.equal(status.textContent, 'Deleting topic...');
    form.submit(event);
    dialog['sb:dialog-before-close'](event);
    events.beforeunload(event);
    handlers.click(event);
    assert.equal(prevented, 4);
    events.pageshow();
    assert.equal(buttons[0].disabled, false);
    dialog['sb:dialog-before-close'](event);
    assert.equal(prevented, 4);
    vm.runInNewContext(source, {window});
    assert.equal(mounts, 3);
});

test('mount waits for shared initialization and ignores unrelated pages', () => {
    let callback, queries = 0;
    const window = {document: {readyState: 'loading',
        querySelector() {queries++; return null;},
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
