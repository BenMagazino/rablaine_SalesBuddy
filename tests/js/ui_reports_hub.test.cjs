const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-reports-hub.js'), 'utf8');

function fixture({state = null, embedded = false, missing = false, writeError = false,
    noReports = false} = {}) {
    const errors = [], writes = [], listeners = {}, handlers = {};
    const input = {value: '', addEventListener(type, fn) { handlers[type] = fn; },
        focus() { this.focused = true; }};
    const clear = {disabled: true, addEventListener(type, fn) { handlers.clear = fn; }};
    const empty = {hidden: true}, notice = {hidden: true}, counter = {};
    const rows = noReports ? [] : [
        {textContent: 'Synapse Customers New and current Azure Synapse usage', hidden: false},
        {textContent: 'Marketing Insights Active sales plays', hidden: false},
        {textContent: 'Initiative Tracker Discussion priorities', hidden: false},
        {textContent: '<img onerror=bad()> Literal & "Quotes"', hidden: false},
    ];
    const groups = noReports ? [] : [
        {dataset: {sbReportGroup: 'Account Insights'}, querySelectorAll: () => rows.slice(0, 2)},
        {dataset: {sbReportGroup: 'Planning & Reviews'}, querySelectorAll: () => rows.slice(2)},
    ];
    const nodes = {'#findReport': input, '[data-sb-reports-clear]': clear,
        '[data-sb-reports-empty]': empty, '[data-sb-reports-filter-notice]': notice,
        '[data-sb-reports-count]': counter};
    const root = {dataset: {sbReportEmbedded: String(embedded)},
        querySelector: selector => nodes[selector],
        querySelectorAll: () => groups};
    const window = {history: {state, replaceState(value) {
        if (writeError) throw new Error('History blocked');
        this.state = value; writes.push(value);
    }}, addEventListener(type, fn) { listeners[type] = fn; }};
    const document = {querySelector: selector => selector === '[data-sb-reports-hub]' ?
        missing ? null : root : counter};
    return {root, rows, groups, input, clear, empty, notice, counter, window, errors, writes,
        run() { vm.runInNewContext(source, {document, window,
            console: {error: (...args) => errors.push(args)}}); },
        search(value) { input.value = value; handlers.input(); },
        reset() { handlers.clear(); },
        fire(name) { listeners[name]?.(); },
    };
}

test('initial directory retains every entry and menu order without history writes', () => {
    const h = fixture(); h.run();
    assert.ok(h.rows.every(row => !row.hidden));
    assert.ok(h.groups.every(group => !group.hidden));
    assert.equal(h.counter.textContent, '4 reports across 2 groups');
    assert.equal(h.clear.disabled, true);
    assert.equal(h.empty.hidden, true);
    assert.equal(h.writes.length, 0);
    assert.doesNotMatch(source, /innerHTML|fetch\(|localStorage|bootstrap|data-bs-/);
});

test('case-insensitive name, purpose and group filtering keeps literal nodes and order', () => {
    const h = fixture(); h.run(); const nodes = h.rows.slice();
    for (const [query, expected] of [
        ['  SYNAPSE  ', [false, true, true, true]],
        ['sales   plays', [true, false, true, true]],
        ['PLANNING & reviews', [true, true, false, false]],
        ['<img onerror=bad()>', [true, true, true, false]],
    ]) {
        h.search(query);
        assert.deepEqual(h.rows.map(row => row.hidden), expected);
        assert.deepEqual(h.rows, nodes);
    }
    assert.equal(h.counter.textContent, '1 of 4 reports across 1 group');
    assert.equal(h.writes.length, 0);
});

test('no matches are explicit and Clear restores every group with focus', () => {
    const h = fixture(); h.run(); h.search('No match');
    assert.equal(h.empty.hidden, false);
    assert.equal(h.empty.textContent, 'No reports match your filter.');
    assert.ok(h.groups.every(group => group.hidden));
    assert.equal(h.counter.textContent, '0 of 4 reports across 0 groups');
    h.reset();
    assert.equal(h.input.value, '');
    assert.ok(h.rows.every(row => !row.hidden));
    assert.ok(h.groups.every(group => !group.hidden));
    assert.equal(h.empty.hidden, true);
    assert.equal(h.clear.disabled, true);
    assert.equal(h.input.focused, true);
});

test('empty report sources do not manufacture entries', () => {
    const h = fixture({noReports: true}); h.run();
    assert.equal(h.empty.hidden, false);
    assert.equal(h.empty.textContent, 'No reports available.');
    assert.equal(h.counter.textContent, '0 reports across 0 groups');
});

test('Back restores query before reading and merges unrelated sort/reading/draft state', () => {
    const state = {sbReportsHub: {query: 'Synapse'}, sbReportReading: {'reports-hub': {scroll: 140}},
        sbTableSort: {other: {column: 2, direction: 'ascending'}}, draft: 'preserved'};
    const h = fixture({state}); h.run();
    assert.equal(h.input.value, 'Synapse');
    assert.equal(h.counter.textContent, '1 of 4 reports across 1 group');
    h.search('Planning'); h.fire('pagehide');
    assert.equal(h.window.history.state.sbReportsHub.query, 'Planning');
    assert.equal(h.window.history.state.sbReportReading, state.sbReportReading);
    assert.equal(h.window.history.state.sbTableSort, state.sbTableSort);
    assert.equal(h.window.history.state.draft, 'preserved');
    h.window.history.state = {sbReportsHub: {query: 'Marketing'}};
    h.fire('popstate'); assert.equal(h.input.value, 'Marketing');
    h.window.history.state = {};
    h.fire('pageshow'); assert.equal(h.input.value, '');
});

test('embeds keep filtering local and never consume or overwrite parent history', () => {
    const state = {sbReportsHub: 'invalid parent'};
    const h = fixture({state, embedded: true}); h.run();
    h.search('Synapse'); h.reset(); h.fire('pagehide'); h.fire('pageshow');
    assert.equal(h.window.history.state, state);
    assert.equal(h.writes.length, 0);
    assert.equal(h.notice.hidden, true);
});

test('malformed owned state is visible and explicit Clear repairs only the owned key', () => {
    for (const value of [null, 2, [], 'query', {}, {query: 2}]) {
        const h = fixture({state: {sbReportsHub: value, draft: 'untouched'}});
        assert.throws(() => h.run(), /Invalid report directory/);
        assert.equal(h.notice.hidden, false);
        assert.equal(h.clear.disabled, false);
        assert.equal(h.errors.length, 1);
        h.reset();
        assert.equal(h.window.history.state.sbReportsHub.query, '');
        assert.equal(h.window.history.state.draft, 'untouched');
        assert.equal(h.notice.hidden, true);
        assert.equal(h.clear.disabled, true);
    }
});

test('blocked history is visible without falsely replacing saved context', () => {
    const state = {draft: 'untouched'};
    const h = fixture({state, writeError: true}); h.run(); h.search('Synapse');
    assert.throws(() => h.fire('pagehide'), /History blocked/);
    assert.equal(h.window.history.state, state);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.errors.length, 1);
});

test('Clear still clears the local view and focuses search when persistence is blocked', () => {
    const h = fixture({writeError: true}); h.run(); h.search('Synapse');
    assert.throws(() => h.reset(), /History blocked/);
    assert.equal(h.input.value, '');
    assert.ok(h.rows.every(row => !row.hidden));
    assert.ok(h.groups.every(group => !group.hidden));
    assert.equal(h.counter.textContent, '4 reports across 2 groups');
    assert.equal(h.input.focused, true);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.clear.disabled, false);
});

test('unrelated pages have no directory side effects', () => {
    const h = fixture({missing: true}); h.run();
    assert.equal(h.writes.length, 0);
    assert.equal(h.counter.textContent, undefined);
});
