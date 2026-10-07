const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {validateView, filterSellers} = require('../../static/js/ui-one-on-one-hub.js');
const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'static', 'js',
    'ui-one-on-one-hub.js'), 'utf8');
const view = {filter: ' BETA ', scroll: {directory: 220, launcher: 30, sellers: 10},
    draft: {name: 'Unsaved manager', type: 'Other'}};

test('seller filtering preserves case-insensitive substring and whitespace behavior', () => {
    const links = ['alpha seller', 'beta seller', 'béta seller']
        .map(name => ({dataset: {sellerName: name}, hidden: false}));
    assert.equal(filterSellers(links, ' BETA '), 1);
    assert.deepEqual(links.map(link => link.hidden), [true, false, true]);
    assert.equal(filterSellers(links, 'BÉTA'), 1);
    assert.equal(filterSellers(links, 'nobody'), 0);
    assert.equal(filterSellers(links, ''), 3);
    assert.equal(filterSellers([], ''), 0);
});

test('state validation keeps complete drafts and rejects corrupted reading shapes', () => {
    assert.equal(validateView(view), view);
    assert.equal(validateView({...view, draft: {name: 'x'.repeat(200), type: 'Manager'}})
        .draft.name.length, 200);
    for (const value of [null, [], {}, {...view, filter: null},
        {...view, scroll: []}, {...view, scroll: {directory: 1, launcher: 1}},
        {...view, scroll: {...view.scroll, directory: -1}},
        {...view, scroll: {...view.scroll, sellers: Infinity}},
        {...view, draft: {name: 'x'.repeat(201), type: 'Manager'}},
        {...view, draft: {name: '', type: 'Seller'}}]) {
        assert.throws(() => validateView(value), /Invalid saved/);
    }
});

function harness({saved, embedded = false, rejectSave = false, noSellers = false} = {}) {
    const ids = Object.fromEntries(['sellerWorkspaceFilter', 'hubSellerEmpty', 'hubSellerStatus',
        'hubDirectoryReading', 'hubLauncherReading', 'sellerLaunchList', 'hubPersonName',
        'hubPersonType', 'hubReadingNotice'].map(id => [id, {
        value: '', hidden: false, scrollTop: 0, events: {},
        addEventListener(type, listener) { this.events[type] = listener; },
    }]));
    ids.hubPersonType.value = 'Manager';
    ids.hubReadingNotice.hidden = true;
    const links = ['alpha seller', 'beta seller']
        .map(name => ({dataset: {sellerName: name}, hidden: false}));
    if (noSellers) {
        delete ids.sellerWorkspaceFilter;
        delete ids.sellerLaunchList;
        delete ids.hubSellerEmpty;
        links.length = 0;
    }
    const events = {}, errors = [];
    const root = {
        document: {
            readyState: 'complete', getElementById: id => ids[id],
            querySelector: () => ({
                dataset: {embedded: String(embedded)}, querySelectorAll: () => links,
            }),
        },
        history: {
            state: {...(saved ? {sbOneOnOneHub: saved} : {}), sbTableSort: {kept: true}},
            replaceState(value) {
                if (rejectSave) throw new Error('History unavailable');
                this.state = value;
            },
        },
        console: {error: (...args) => errors.push(args)},
        requestAnimationFrame: callback => callback(),
        addEventListener: (type, listener) => { events[type] = listener; },
    };
    vm.runInNewContext(source, {window: root});
    return {root, ids, links, events, errors};
}

test('local filtering reports zero matches without removing seller links', () => {
    const {ids, links} = harness();
    ids.sellerWorkspaceFilter.value = 'nobody';
    ids.sellerWorkspaceFilter.events.input();
    assert.equal(ids.hubSellerEmpty.hidden, false);
    assert.equal(ids.hubSellerStatus.textContent, '0 of 2 sellers available to start');
    assert.equal(links.length, 2);
    ids.sellerWorkspaceFilter.value = '';
    ids.sellerWorkspaceFilter.events.input();
    assert.equal(ids.hubSellerEmpty.hidden, true);
    assert.equal(links.every(link => !link.hidden), true);
});

test('Back restores filter, all reading regions, drafts and shared table state', () => {
    const {root, ids, links, events} = harness({saved: view});
    assert.equal(ids.sellerWorkspaceFilter.value, ' BETA ');
    assert.deepEqual(links.map(link => link.hidden), [true, false]);
    assert.equal(ids.hubPersonName.value, 'Unsaved manager');
    assert.equal(ids.hubPersonType.value, 'Other');
    assert.equal(ids.hubDirectoryReading.scrollTop, 220);
    assert.equal(ids.hubLauncherReading.scrollTop, 30);
    assert.equal(ids.sellerLaunchList.scrollTop, 10);
    ids.hubDirectoryReading.scrollTop = 0;
    events.pageshow();
    assert.equal(ids.hubDirectoryReading.scrollTop, 220);
    events.pagehide();
    assert.deepEqual(JSON.parse(JSON.stringify(root.history.state.sbOneOnOneHub)), view);
    assert.deepEqual(root.history.state.sbTableSort, {kept: true});
});

test('embeds keep filtering local without reading or mutating parent history', () => {
    const {root, ids, events} = harness({saved: view, embedded: true});
    assert.equal(ids.sellerWorkspaceFilter.value, '');
    assert.equal(ids.hubPersonName.value, '');
    assert.equal(events.pagehide, undefined);
    assert.equal(root.history.state.sbOneOnOneHub, view);
});

test('zero available sellers safely omit their picker while preserving the creation draft', () => {
    const {root, ids, events} = harness({noSellers: true});
    ids.hubPersonName.value = 'Draft person';
    events.pagehide();
    assert.equal(root.history.state.sbOneOnOneHub.filter, '');
    assert.equal(root.history.state.sbOneOnOneHub.scroll.sellers, 0);
    assert.equal(root.history.state.sbOneOnOneHub.draft.name, 'Draft person');
});

test('history failures remain visible and logged', () => {
    const invalid = harness({saved: {...view, filter: null}});
    assert.equal(invalid.ids.hubReadingNotice.hidden, false);
    assert.match(invalid.ids.hubReadingNotice.textContent, /Could not restore/);
    assert.equal(invalid.errors.length, 1);
    const unavailable = harness({rejectSave: true});
    unavailable.events.pagehide();
    assert.equal(unavailable.ids.hubReadingNotice.hidden, false);
    assert.match(unavailable.ids.hubReadingNotice.textContent, /Could not save/);
    assert.equal(unavailable.errors.length, 1);
});
