const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-revenue-reports.js'), 'utf8');

function fixture({state = null, embedded = false, missing = false, writeError = false} = {}) {
    const reading = {scrollTop: 0}, notice = {hidden: true, textContent: ''}, errors = [];
    const root = {
        dataset: {sbReportKey: 'synapse-current', sbReportEmbedded: String(embedded)},
        querySelector: selector => selector === '[data-sb-page-body]' ? reading : notice,
    };
    const document = {querySelector: () => missing ? null : root};
    const window = {
        history: {state, replaceState(value) {
            if (writeError) throw new Error('history denied');
            this.state = value;
        }},
        listeners: {}, timers: [],
        addEventListener(name, callback) { this.listeners[name] = callback; },
        setTimeout(callback) { this.timers.push(callback); },
    };
    return {reading, notice, errors, root, window,
        run() { vm.runInNewContext(source, {
            document, window, console: {error: (...args) => errors.push(args)},
        }); },
        fire(name) { window.listeners[name]?.(); },
        flush() { window.timers.splice(0).forEach(callback => callback()); },
    };
}

test('restores current report only and preserves sort and unrelated feature state', () => {
    const state = {sbTableSort: {'synapse-current-owner': {column: 2, direction: 'asc'}},
        draft: 'untouched', sbReportReading: {
            'synapse-current': {scroll: 420}, 'synapse-new': {scroll: 90},
        }};
    const h = fixture({state}); h.run();
    assert.equal(h.reading.scrollTop, 420);
    assert.equal(h.window.history.state, state);
    h.reading.scrollTop = 580; h.fire('pagehide');
    assert.equal(h.window.history.state.sbReportReading['synapse-current'].scroll, 580);
    assert.equal(h.window.history.state.sbReportReading['synapse-new'].scroll, 90);
    assert.equal(h.window.history.state.sbTableSort, state.sbTableSort);
    assert.equal(h.window.history.state.draft, 'untouched');
});

test('new visits retain zero position and persist the current actual offset', () => {
    const h = fixture(); h.run();
    assert.equal(h.reading.scrollTop, 0);
    h.reading.scrollTop = 160; h.fire('pagehide');
    assert.equal(h.window.history.state.sbReportReading['synapse-current'].scroll, 160);
});

test('pageshow restores after sorting and popstate restores the entry context', () => {
    const h = fixture(); h.run();
    h.window.history.state = {sbReportReading: {'synapse-current': {scroll: 210}}};
    h.fire('pageshow');
    assert.equal(h.reading.scrollTop, 0);
    h.flush();
    assert.equal(h.reading.scrollTop, 210);
    h.window.history.state.sbReportReading['synapse-current'].scroll = 360;
    h.fire('popstate');
    assert.equal(h.reading.scrollTop, 360);
});

test('embeds and unrelated pages never read or write parent history', () => {
    for (const options of [{embedded: true}, {missing: true}]) {
        const h = fixture({...options, state: {sbReportReading: 'invalid parent'}});
        h.run(); h.fire('pagehide'); h.fire('pageshow'); h.flush();
        assert.equal(Object.keys(h.window.listeners).length, 0);
        assert.equal(h.window.history.state.sbReportReading, 'invalid parent');
        assert.equal(h.notice.hidden, true);
    }
});

test('malformed registry or owned offset is surfaced before changing reading position', () => {
    for (const saved of [null, 10, [], {'synapse-current': null},
        {'synapse-current': []}, {'synapse-current': {scroll: -1}},
        {'synapse-current': {scroll: '100'}}, {'synapse-current': {scroll: Infinity}}]) {
        const h = fixture({state: {sbReportReading: saved}});
        h.reading.scrollTop = 75;
        assert.throws(() => h.run(), /Invalid revenue report/);
        assert.equal(h.reading.scrollTop, 75);
        assert.equal(h.window.history.state.sbReportReading, saved);
        assert.equal(h.notice.hidden, false);
        assert.equal(h.errors.length, 1);
    }
});

test('history write failure is logged, visible and leaves previous state intact', () => {
    const state = {draft: 'untouched'};
    const h = fixture({state, writeError: true}); h.run();
    assert.throws(() => h.fire('pagehide'), /history denied/);
    assert.equal(h.window.history.state, state);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /could not be saved/);
    assert.equal(h.errors.length, 1);
});
