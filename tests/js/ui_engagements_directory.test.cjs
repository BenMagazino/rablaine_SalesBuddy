const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../../static/js/ui-engagements-directory.js');
const source = fs.readFileSync(require.resolve('../../static/js/ui-engagements-directory.js'), 'utf8');
const data = [
    {id: 9, customer_id: 1, customer_name: 'A', seller_name: 'Same', title: 'New',
        status: 'Won', story_completeness: 80, target_date: '2027-01-02',
        estimated_acr: 1234.56, latest_note_date: '2026-10-06T18:30:00',
        linked_note_count: 2, opportunity_count: 3, milestone_count: 4,
        open_action_item_count: 5, is_favorited: false},
    {id: 8, customer_id: 2, customer_name: 'B', seller_name: 'Other', title: 'Favorite',
        status: 'Active', story_completeness: 0, target_date: null, is_favorited: true},
    {id: 7, customer_id: 1, customer_name: 'A', seller_name: 'Same', title: 'Old',
        status: 'On Hold', story_completeness: 40, target_date: '2026-02-01', is_favorited: false},
];
const state = {filter: '', sort: 'updated', group: true, favoritesOnly: false};
const ids = items => items.map(item => item.id);

test('default provider order and favorites match the complete original dataset', () => {
    assert.deepEqual(ids(api.selectItems(data, state)), [8, 9, 7]);
    assert.deepEqual(ids(api.selectItems(data, {...state, sort: 'updated-asc'})), [8, 7, 9]);
    assert.deepEqual(ids(data), [9, 8, 7]);
});
test('status and favorite filters do not change membership or original records', () => {
    for (const status of ['Active', 'On Hold', 'Won', 'Lost']) {
        assert.deepEqual(api.selectItems(data, {...state, filter: status}),
            data.filter(item => item.status === status));
    }
    assert.deepEqual(ids(api.selectItems(data, {...state, favoritesOnly: true})), [8]);
    assert.deepEqual(api.selectItems(data, {...state, filter: 'Won', favoritesOnly: true}), []);
});
test('story and calendar ordering compare true values both ways with favorites first', () => {
    const plain = data.map(item => ({...item, is_favorited: false}));
    for (const [sort, expected] of [
        ['story-asc', [8, 7, 9]], ['story-desc', [9, 7, 8]],
        ['target', [7, 9, 8]], ['target-desc', [9, 7, 8]],
    ]) assert.deepEqual(ids(api.selectItems(plain, {...state, sort})), expected);
    assert.equal(api.selectItems(data, {...state, sort: 'target-desc'})[0].id, 8);
});
test('seller/customer groups preserve exact membership, original insertion order and role modes', () => {
    const items = api.selectItems(data, state);
    const groups = api.groupItems(items, true, true);
    assert.deepEqual(groups.map(group => [group.seller, group.customer.customer_id, ids(group.items)]),
        [['Other', 2, [8]], ['Same', 1, [9, 7]]]);
    assert.deepEqual(api.groupItems(items, false, true), [{items}]);
    assert.deepEqual(api.groupItems(items, true, false).map(group => group.seller), ['', '']);
    assert.equal(api.groupItems([{...data[0], seller_name: null}], true, true)[0].seller,
        'Unassigned');
});
test('all data columns sort; headings and group membership stay fixed; actions do not sort', () => {
    const html = api.tableHtml(api.groupItems(data, true, true), 'hub-grouped');
    assert.equal((html.match(/data-sb-sort-type=/g) || []).length, 11);
    assert.equal((html.match(/data-export-label=/g) || []).length, 12);
    assert.match(html, /data-sb-sort-fixed/);
    assert.match(html, /data-export-label="Favorite">Star/);
    assert.match(html, /data-sb-sort-type="date">Target/);
    assert.match(html, /data-export-label="Opportunities"/);
});
test('rows retain raw decimal money, precise note timestamps, calendar dates and all counts', () => {
    const html = api.rowHtml(data[0]);
    for (const raw of ['1234.56', '2027-01-02', String(Date.parse(data[0].latest_note_date)),
        '2', '3', '4', '5']) assert.ok(html.includes(`data-sb-sort-value="${raw}"`));
    assert.match(html, /href="\/engagement\/9"/);
    assert.match(html, /href="\/customer\/1"/);
    assert.match(html, /80%/);
    assert.match(html, /data-tone="success"/);
    assert.equal(api.dateLabel('2027-01-02', true), 'Jan 2, 2027');
    assert.equal(api.dateLabel('2026-10-06T18:30:00'), 'Oct 6');
});
test('row HTML escapes names, URLs, source favicon attributes and preserves story thresholds', () => {
    const html = api.rowHtml({...data[0], title: '<script>"unsafe"</script>',
        customer_favicon: '" onerror="bad', customer_nickname: '<nickname>'});
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;nickname&gt;'));
    assert.ok(html.includes('&quot; onerror=&quot;bad'));
    for (const [story, tone] of [[0, 'danger'], [39, 'danger'], [40, 'warning'],
        [79, 'warning'], [80, 'success'], [100, 'success']]) {
        assert.match(api.rowHtml({...data[0], story_completeness: story}),
            new RegExp(`data-tone="${tone}">${story}%`));
    }
});

function fixture(saved = null) {
    const requests = [], errors = [], documentEvents = {}, windowEvents = {};
    const nodes = new Map();
    class Element {
        constructor(id) { this.id = id; this.dataset = {}; this.handlers = {};
            this.attributes = {}; this.scrollTop = 0; this.scrollLeft = 0; this.options = []; }
        addEventListener(name, handler) { this.handlers[name] = handler; }
        setAttribute(name, value) { this.attributes[name] = value; }
        querySelector(selector) { return selector === 'i' ? (this.icon ||= {}) : null; }
        querySelectorAll() { return []; }
        closest(selector) { return selector === this.selector ? this : null; }
    }
    for (const id of ['engHubBody', 'engHubCount', 'engHubBody_sortSelect',
        'engHubBody_groupToggle', 'engHubBody_favoritesBtn', 'engDirectoryNotice']) {
        nodes.set(id, new Element(id));
    }
    nodes.get('engHubBody_sortSelect').options = ['updated', 'updated-asc', 'story-asc',
        'story-desc', 'target', 'target-desc'].map(value => ({value}));
    const root = new Element('root'), reading = new Element('reading');
    root.dataset = {bodyId: 'engHubBody', countId: 'engHubCount', showSeller: 'true',
        apiUrl: '/api/engagements/all', emptyMsg: 'No engagements match the current filter.'};
    const document = {
        readyState: 'complete', getElementById: id => nodes.get(id),
        querySelector: selector => selector === '[data-eng-directory]' ? root : reading,
        addEventListener: (name, handler) => { documentEvents[name] = handler; },
    };
    const history = {state: saved, replaceState(value) { this.state = value; }};
    const storage = new Map();
    const window = {SBTableSort: {mount() {}},
        addEventListener: (name, handler) => { windowEvents[name] = handler; }};
    vm.runInNewContext(source, {document, history, window, localStorage: {
        getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
    }, console: {error: (...args) => errors.push(args)}, fetch: (url, options) =>
        new Promise((resolve, reject) => requests.push({url, options, resolve, reject}))});
    const reply = (index, result, ok = true) => requests[index].resolve({
        ok, status: ok ? 200 : 500, json: async () => result,
    });
    return {root, reading, nodes, history, requests, errors, documentEvents, windowEvents,
        Element, reply};
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
test('load restores original filters and both reading axes using the same provider', async () => {
    const h = fixture({sbEngDirectory: {...state, filter: 'Won', top: 420, left: 5}});
    assert.equal(h.requests[0].url, '/api/engagements/all');
    h.reply(0, {success: true, count: 3, engagements: data});
    await settle();
    assert.equal(h.reading.scrollTop, 420);
    assert.equal(h.reading.scrollLeft, 5);
    assert.equal(h.nodes.get('engHubCount').textContent, '1 shown / 3 total');
    assert.match(h.nodes.get('engHubBody').innerHTML, /data-engagement-id="9"/);
    assert.ok(!h.nodes.get('engHubBody').innerHTML.includes('data-engagement-id="7"'));
});
test('failed load remains an error and Retry is read-only', async () => {
    const h = fixture();
    h.reply(0, {success: false}, false);
    await settle();
    assert.match(h.nodes.get('engHubBody').innerHTML, /role="alert"/);
    assert.match(h.nodes.get('engHubBody').innerHTML, /data-eng-retry/);
    const retry = new h.Element(); retry.selector = '[data-eng-retry]';
    await h.nodes.get('engHubBody').handlers.click({target: retry});
    assert.equal(h.requests[1].url, '/api/engagements/all');
    assert.equal(h.requests[1].options, undefined);
});
test('favorite POST keeps its payload, suppresses duplicate clicks and guards pending navigation', async () => {
    const h = fixture();
    h.reply(0, {success: true, engagements: data.map(item => ({...item}))});
    await settle();
    const button = new h.Element(); button.selector = '[data-eng-favorite]';
    button.dataset.engFavorite = '9';
    const click = () => h.nodes.get('engHubBody').handlers.click({target: button});
    const pending = click();
    await click();
    const replacement = new h.Element(); replacement.selector = '[data-eng-favorite]';
    replacement.dataset.engFavorite = '9';
    await h.nodes.get('engHubBody').handlers.click({target: replacement});
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].url, '/api/engagement/9/favorite');
    assert.equal(h.requests[1].options.method, 'POST');
    assert.equal(h.requests[1].options.body, undefined);
    const unload = {preventDefault() { this.prevented = true; }};
    h.windowEvents.beforeunload(unload);
    assert.equal(unload.prevented, true);
    const nav = {target: {closest: () => ({})}, preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; }};
    h.documentEvents.click(nav);
    assert.equal(nav.prevented, true);
    h.reply(1, {success: true, is_favorited: true});
    await pending;
    assert.equal(button.disabled, false);
    assert.equal(button.querySelector('i').className, 'bi bi-star-fill');
    const done = {preventDefault() { this.prevented = true; }};
    h.windowEvents.beforeunload(done);
    assert.equal(done.prevented, undefined);
});
test('failed favorite retains its original icon and releases the pending guard', async () => {
    const h = fixture();
    h.reply(0, {success: true, engagements: data.map(item => ({...item}))});
    await settle();
    const button = new h.Element(); button.selector = '[data-eng-favorite]';
    button.dataset.engFavorite = '9'; button.querySelector('i').className = 'bi bi-star';
    const pending = h.nodes.get('engHubBody').handlers.click({target: button});
    h.reply(1, {success: false}, false);
    await pending;
    assert.equal(button.querySelector('i').className, 'bi bi-star');
    assert.equal(button.disabled, false);
    assert.equal(h.nodes.get('engDirectoryNotice').textContent, 'Favorite was not saved. Try again.');
});
