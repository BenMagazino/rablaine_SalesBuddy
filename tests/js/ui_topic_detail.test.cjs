const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateHistory, validateView} = require('../../static/js/ui-topic-detail.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-topic-detail.js'), 'utf8');

test('Topic reading history validates identity and both axes', () => {
    const saved = {id: 4, top: 60, left: 20, description: 10};
    assert.equal(validateHistory(saved, 4), saved);
    for (const bad of [null, {...saved, id: 5}, {...saved, top: -1},
        {...saved, left: NaN}, {...saved, description: '10'}]) {
        assert.throws(() => validateHistory(bad, 4));
    }
    for (const bad of [{...saved, view: 'invalid'}, {...saved, expanded: '1'},
        {...saved, expanded: [1]}, {...saved, expanded: ['bad']}, {...saved, expanded: ['0']}]) {
        assert.throws(() => validateHistory(bad, 4));
    }
    const grouped = {...saved, view: 'account', expanded: ['1', 'unassigned']};
    assert.equal(validateHistory(grouped, 4), grouped);
    for (const view of ['account', 'flat']) assert.equal(validateView(view), view);
    assert.throws(() => validateView(null));
});

test('Back keeps sorts and reading; native deletion guards repeat submit and navigation', () => {
    const events = {}, handlers = {}, status = {}, buttons = [{disabled: false}];
    const reading = {scrollTop: 0, scrollLeft: 0,
        addEventListener(type, fn) {this[type] = fn;}};
    const description = {...reading};
    const picker = {value: 'account', addEventListener() {}};
    const form = {querySelector: () => status, querySelectorAll: () => buttons,
        addEventListener(type, fn) {this[type] = fn;}};
    const dialog = {querySelector: () => form,
        addEventListener(type, fn) {this[type] = fn;}};
    const root = {dataset: {topicDetail: '4'},
        querySelector: selector => ({
            '.topic-reading': reading, '.topic-description': description,
            '#deleteTopicDialog': dialog, '.topic-notice': {},
            '[data-topic-view]': picker,
        })[selector], querySelectorAll: () => [],
        addEventListener(type, fn) {handlers[type] = fn;}};
    let mounts = 0;
    const destinations = [];
    const window = {document: {querySelector: () => root}, console: {error() {}},
        localStorage: {getItem: () => null},
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

function mountTopic({stored = null, saved = null, storageFails = false} = {}) {
    const events = {}, notice = {hidden: true}, values = new Map();
    if (stored !== null) values.set('salesbuddy_topic_detail_view', stored);
    function node(extra = {}) {
        return {...extra, addEventListener(type, fn) {this[type] = fn;}};
    }
    const reading = node({scrollTop: 0, scrollLeft: 0});
    const picker = node({value: 'account'});
    const groups = ['1', '2', 'unassigned'].map(key =>
        node({dataset: {topicAccount: key}, open: false}));
    const accounts = {}, flat = {};
    const form = node({querySelector: () => ({}), querySelectorAll: () => []});
    const dialog = node({querySelector: () => form});
    const root = node({dataset: {topicDetail: '4'},
        querySelector: selector => ({
            '.topic-reading': reading, '[data-topic-view]': picker,
            '[data-topic-accounts]': accounts, '[data-topic-flat]': flat,
            '#deleteTopicDialog': dialog, '.topic-notice': notice,
        })[selector],
        querySelectorAll: () => groups});
    const errors = [];
    const window = {document: {querySelector: () => root},
        console: {error(error) {errors.push(error);}},
        localStorage: {
            getItem(key) {
                if (storageFails) throw new Error('Storage blocked');
                return values.get(key) ?? null;
            },
            setItem(key, value) {
                if (storageFails) throw new Error('Storage blocked');
                values.set(key, value);
            },
        },
        history: {state: {sbTopicDetail: saved, sbTableSort: {kept: true}},
            replaceState(value) {this.state = value;}},
        SBTableSort: {mount() {}},
        addEventListener(type, fn) {events[type] = fn;}};
    vm.runInNewContext(source, {window});
    function choose(view) {picker.value = view; picker.change();}
    return {window, events, reading, picker, groups, accounts, flat, notice, errors, choose};
}

test('grouped default, independent disclosures and persistent flat choice across topics', () => {
    const page = mountTopic();
    assert.equal(page.picker.value, 'account');
    assert.equal(page.accounts.hidden, false);
    assert.equal(page.flat.hidden, true);
    assert.ok(page.groups.every(group => !group.open));
    page.groups[0].open = true;
    page.groups[0].toggle();
    page.groups[1].open = true;
    page.groups[1].toggle();
    assert.equal(JSON.stringify(page.window.history.state.sbTopicDetail.expanded), '["1","2"]');
    page.reading.scrollTop = 100;
    page.choose('flat');
    assert.equal(page.accounts.hidden, true);
    assert.equal(page.flat.hidden, false);
    assert.equal(page.reading.scrollTop, 0);
    assert.ok(page.groups.every(group => !group.open));
    assert.equal(page.window.localStorage.getItem('salesbuddy_topic_detail_view'), 'flat');
    const next = mountTopic({stored: page.window.localStorage.getItem(
        'salesbuddy_topic_detail_view')});
    assert.equal(next.picker.value, 'flat');
    page.choose('account');
    assert.ok(page.groups.every(group => !group.open));
});

test('Back entry restores view, open groups and scroll over newer global preference', () => {
    const page = mountTopic({stored: 'flat', saved: {
        id: 4, top: 80, left: 15, description: 0, view: 'account', expanded: ['2', '999'],
    }});
    assert.equal(page.picker.value, 'account');
    assert.deepEqual(page.groups.map(group => group.open), [false, true, false]);
    assert.equal(page.reading.scrollTop, 80);
    assert.equal(page.reading.scrollLeft, 15);
    page.groups[0].open = true;
    page.groups[0].toggle();
    page.groups.forEach(group => {group.open = false;});
    page.events.pageshow();
    assert.deepEqual(page.groups.map(group => group.open), [true, true, false]);
    assert.equal(page.window.history.state.sbTableSort.kept, true);
    const legacy = mountTopic({stored: 'flat', saved: {
        id: 4, top: 45, left: 0, description: 0,
    }});
    assert.equal(legacy.picker.value, 'flat');
    assert.equal(legacy.reading.scrollTop, 45);
});

test('storage and invalid history errors are visible and do not disable view changes', () => {
    const page = mountTopic({storageFails: true});
    assert.equal(page.notice.hidden, false);
    assert.match(page.notice.textContent, /restore.*preference/);
    page.choose('flat');
    assert.equal(page.flat.hidden, false);
    assert.match(page.notice.textContent, /remember.*future visits/);
    assert.equal(page.errors.length, 2);
    const invalid = mountTopic({stored: 'bad', saved: {
        id: 4, top: 10, left: 0, description: 0, view: 'bad',
    }});
    assert.equal(invalid.picker.value, 'account');
    assert.equal(invalid.notice.hidden, false);
    assert.equal(invalid.errors.length, 2);
    const historyFailure = mountTopic();
    historyFailure.window.history.replaceState = () => {throw new Error('History blocked');};
    historyFailure.choose('flat');
    assert.equal(historyFailure.flat.hidden, false);
    assert.equal(historyFailure.notice.hidden, false);
    assert.match(historyFailure.notice.textContent, /remember Topic context for Back/);
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
