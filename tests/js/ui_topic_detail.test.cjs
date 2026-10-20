const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {validateHistory, validateView, plainClick} = require('../../static/js/ui-topic-detail.js');
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
        classList: {toggle() {}},
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
    assert.equal(mounts, 0);
});

function mountTopic({stored = null, saved = null, storageFails = false} = {}) {
    const events = {}, notice = {hidden: true}, values = new Map();
    if (stored !== null) values.set('salesbuddy_topic_detail_view', stored);
    function node(extra = {}) {
        return {...extra, addEventListener(type, fn) {this[type] = fn;}};
    }
    function tableContainer(extra = {}) {
        const table = {pending: true, sortable: false,
            setAttribute(name) {if (name === 'data-sb-sortable') this.sortable = true;},
            removeAttribute(name) {if (name === 'data-topic-sort-pending') this.pending = false;}};
        return {...extra, table, querySelectorAll: () => table.pending ? [table] : []};
    }
    const reading = node({scrollTop: 0, scrollLeft: 0});
    const picker = node({value: 'account'});
    const groups = ['1', '2', 'unassigned'].map(key => {
        const button = node({setAttribute(name, value) {this[name] = value;}});
        const body = {hidden: true};
        const group = node(tableContainer({dataset: {topicAccount: key},
            querySelector: selector => ({
                '[data-topic-toggle]': button, '[data-topic-account-body]': body,
                '.topic-account-name': {textContent: key},
            })[selector],
        }));
        Object.defineProperty(group, 'open', {
            get() {return group.dataset.expanded === 'true';},
            set(value) {group.dataset.expanded = String(value);},
        });
        group.toggle = () => button.click();
        return group;
    });
    const accounts = {}, flat = tableContainer();
    const form = node({querySelector: () => ({}), querySelectorAll: () => []});
    const dialog = node({querySelector: () => form});
    const root = node({dataset: {topicDetail: '4'}, classList: {toggle() {}},
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
    return {window, root, events, reading, picker, groups, accounts, flat,
        notice, errors, choose};
}

test('grouped default, independent disclosures and persistent flat choice across topics', () => {
    const page = mountTopic();
    assert.equal(page.picker.value, 'account');
    assert.equal(page.accounts.hidden, false);
    assert.equal(page.flat.hidden, true);
    assert.ok(page.groups.every(group => !group.open));
    assert.ok(page.groups.every(group => !group.table.sortable));
    assert.equal(page.flat.table.sortable, false);
    page.groups[0].toggle();
    assert.equal(page.groups[0].table.sortable, true);
    assert.equal(page.groups[1].table.sortable, false);
    page.groups[1].toggle();
    assert.equal(JSON.stringify(page.window.history.state.sbTopicDetail.expanded), '["1","2"]');
    page.reading.scrollTop = 100;
    page.choose('flat');
    assert.equal(page.flat.table.sortable, true);
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
    assert.equal(page.flat.table.sortable, false);
    assert.deepEqual(page.groups.map(group => group.table.sortable), [false, true, false]);
    assert.equal(page.reading.scrollTop, 80);
    assert.equal(page.reading.scrollLeft, 15);
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

test('preview links preserve modified-click navigation and load controllers only on demand', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
        assert.equal(plainClick({button: 0, [modifier]: true}), false);
    }
    assert.equal(plainClick({button: 1}), false);
    assert.equal(plainClick({button: 0}), true);
    const page = mountTopic();
    const created = [], opened = [];
    page.window.SBRecordDialog = {create(id, options) {
        created.push({id, options});
        return {open(selection) {opened.push(selection);}};
    }};
    const link = {dataset: {topicPreview: 'note', recordId: '7', recordTitle: 'Note date'}};
    let prevented = 0;
    const event = {button: 0, target: {closest: () => link},
        preventDefault() {prevented++;}};
    page.root.click({...event, ctrlKey: true});
    assert.equal(created.length, 0);
    page.root.click(event);
    page.root.click(event);
    assert.equal(prevented, 2);
    assert.equal(created.length, 1);
    assert.equal(opened.length, 2);
    assert.equal(created[0].options.loadUrl(7), '/api/note/7/detail?topic_id=4');
    assert.equal(created[0].options.fullUrl(7), '/note/7');
    link.dataset = {topicPreview: 'customer', recordId: '8', recordTitle: 'Account'};
    page.root.click(event);
    assert.equal(created[1].id, 'topicAccountPreview');
    assert.equal(created[1].options.loadUrl(8), '/api/customer/8/info?view=preview');
    assert.equal(created[1].options.fullUrl(8), '/customer/8');
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

test('all modified preview clicks retain native navigation without loading a controller', () => {
    const page = mountTopic();
    const calls = [];
    page.window.SBRecordDialog = {create() {calls.push('created');}};
    for (const kind of ['note', 'customer']) {
        const link = {dataset: {topicPreview: kind, recordId: '7', recordTitle: 'Preview'}};
        for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
            page.root.click({button: 0, [modifier]: true, target: {closest: () => link},
                preventDefault() {calls.push('prevented');}});
        }
        for (const extra of [{button: 1}, {button: 2}, {defaultPrevented: true}]) {
            page.root.click({button: 0, ...extra, target: {closest: () => link},
                preventDefault() {calls.push('prevented');}});
        }
    }
    assert.deepEqual(calls, []);
});

test('preview controller failure is visible and the same link can be retried', () => {
    const page = mountTopic();
    const link = {dataset: {topicPreview: 'note', recordId: '7', recordTitle: 'Preview'}};
    const event = {button: 0, target: {closest: () => link}, preventDefault() {}};
    page.window.SBRecordDialog = {create() {throw new Error('Controller unavailable');}};
    page.root.click(event);
    assert.equal(page.notice.hidden, false);
    assert.match(page.notice.textContent, /Could not open the note preview/);
    assert.equal(page.errors.length, 1);
    let selected;
    page.window.SBRecordDialog = {create() {return {open(value) {selected = value;}};}};
    page.root.click(event);
    assert.equal(selected.id, 7);
    assert.equal(selected.title, 'Preview');
});

test('history is topic-local and restores the unassigned disclosure independently', () => {
    const unrelated = mountTopic({stored: 'flat', saved: {
        id: 99, top: 500, left: 0, description: 0, view: 'account', expanded: ['1'],
    }});
    assert.equal(unrelated.picker.value, 'flat');
    assert.equal(unrelated.reading.scrollTop, 0);
    assert.ok(unrelated.groups.every(group => !group.open));
    assert.equal(unrelated.notice.hidden, true);
    const restored = mountTopic({saved: {
        id: 4, top: 90, left: 0, description: 0, view: 'account', expanded: ['unassigned'],
    }});
    assert.deepEqual(restored.groups.map(group => group.open), [false, false, true]);
    restored.groups[0].toggle();
    restored.groups[2].toggle();
    assert.deepEqual(restored.groups.map(group => group.open), [true, false, false]);
    assert.equal(JSON.stringify(restored.window.history.state.sbTopicDetail.expanded), '["1"]');
    assert.equal(restored.window.history.state.sbTableSort.kept, true);
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
