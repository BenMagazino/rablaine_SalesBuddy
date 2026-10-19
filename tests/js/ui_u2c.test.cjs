const test = require('node:test');
const assert = require('node:assert/strict');
const u2c = require('../../static/js/ui-u2c.js');

test('multi-workload trends sum frozen dollar bases, not percentages or live ACR', () => {
    const point = (starting, committed, source = 'published') => ({
        date: '2026-10-19', label: source, source, items: 1, starting_acr: starting,
        committed_acr: committed, msxi_converted_acr: source === 'live' ? null : committed * 2,
        u2c_pct: committed / starting * 100,
    });
    const series = {
        '': [point(10000, 9000)],
        '"Apps: App Service"': [point(100, 100), point(100, 0, 'live')],
        '"Sec: Defender"': [point(900, 0), point(900, 900, 'live')],
    };
    assert.equal(u2c.aggregateTrend(series, []), series['']);
    const points = u2c.aggregateTrend(series, ['Apps', 'Sec']);
    assert.equal(points.length, 2);
    assert.equal(points[0].starting_acr, 1000);
    assert.equal(points[0].committed_acr, 100);
    assert.equal(points[0].u2c_pct, 10);
    assert.equal(points[1].source, 'live');
    assert.equal(points[1].u2c_pct, 90);
    assert.equal(points[1].msxi_converted_acr, null);
    assert.deepEqual(u2c.aggregateTrend(series, ['Unavailable']), []);
    assert.equal(u2c.aggregateTrend(series, ['Sec', 'Sec'])[0].starting_acr, 900);
});

test('multiple publications on the same day retain their identities when combining workloads', () => {
    const make = (version_id, committed_acr) => ({
        version_id, date: '2026-10-19', source: 'published', items: 1,
        starting_acr: 100, committed_acr, msxi_converted_acr: committed_acr,
    });
    const points = u2c.aggregateTrend({
        '"Apps: App Service"': [make(1, 10), make(2, 20)],
        '"Sec: Defender"': [make(1, 30), make(2, 40)],
    }, ['Apps', 'Sec']);
    assert.equal(points.length, 2);
    assert.deepEqual(points.map(point => point.version_id), [1, 2]);
    assert.deepEqual(points.map(point => point.starting_acr), [200, 200]);
    assert.deepEqual(points.map(point => point.committed_acr), [40, 60]);
});

test('one prefix combines every detailed workload without matching another prefix', () => {
    const point = starting_acr => ({
        date: '2026-10-19', source: 'published', items: 1, starting_acr,
        committed_acr: 0, msxi_converted_acr: 0,
    });
    const points = u2c.aggregateTrend({
        '"Data: SQL"': [point(100)],
        '"Data: Cosmos DB"': [point(200)],
        '"Database: Other"': [point(900)],
    }, ['Data']);
    assert.equal(points.length, 1);
    assert.equal(points[0].items, 2);
    assert.equal(points[0].starting_acr, 300);
});

test('all existing data sorts retain both directions', () => {
    for (const column of ['customer', 'milestone', 'workload', 'due_date', 'acr', 'status']) {
        for (const direction of ['asc', 'desc']) {
            assert.deepEqual(u2c.validateSort({column, direction}), {column, direction});
        }
    }
});

test('invalid sorts are rejected rather than silently changing the queue', () => {
    for (const value of [null, {}, {column: 'engagement', direction: 'asc'},
        {column: 'acr', direction: 'down'}]) {
        assert.throws(() => u2c.validateSort(value), /Invalid U2C sort/);
    }
});

test('seller and customer identities accept empty All and positive IDs', () => {
    for (const value of [{seller: '', customer: ''}, {seller: '7', customer: '12'}]) {
        assert.deepEqual(u2c.validateFilters(value), value);
    }
});

test('invalid saved filter identities are explicitly rejected', () => {
    for (const value of [null, {}, {seller: 7, customer: ''},
        {seller: '0', customer: ''}, {seller: '', customer: '-1'}]) {
        assert.throws(() => u2c.validateFilters(value), /Invalid U2C filters/);
    }
});

test('reading state retains an unsubmitted 1:1 draft and offset', () => {
    const value = {scroll: 412.5, composers: [{id: 'u2cAgendaComposer7', text: 'Review scope'}]};
    assert.deepEqual(u2c.validateReading(value), value);
});

test('invalid reading state cannot select arbitrary elements', () => {
    for (const value of [null, {}, {scroll: -1, composers: []},
        {scroll: Infinity, composers: []}, {scroll: 0, composers: null},
        {scroll: 0, composers: [{id: 'u2cAgendaComposer0', text: ''}]},
        {scroll: 0, composers: [{id: 'u2cAgendaComposer7', text: 3}]},
        {scroll: 0, composers: [null]}]) {
        assert.throws(() => u2c.validateReading(value), /Invalid U2C reading/);
    }
});

test('storage failures are logged and displayed without blocking current controls', () => {
    const originalDocument = globalThis.document;
    const originalStorage = globalThis.localStorage;
    const originalError = console.error;
    const notice = {hidden: true, textContent: ''};
    const logged = [];
    globalThis.document = {getElementById: () => notice};
    globalThis.localStorage = {
        getItem() { throw new Error('Storage denied'); },
        setItem() { throw new Error('Storage denied'); },
        removeItem() { throw new Error('Storage denied'); }
    };
    console.error = (...args) => logged.push(args);
    try {
        assert.equal(u2c.readPreference('u2c_sort'), null);
        assert.equal(notice.hidden, false);
        assert.match(notice.textContent, /could not be read/);
        u2c.writePreference('u2c_sort', '{}');
        assert.match(notice.textContent, /could not be saved/);
        u2c.writePreference('u2c_filters', null);
        assert.equal(logged.length, 3);
    } finally {
        globalThis.document = originalDocument;
        globalThis.localStorage = originalStorage;
        console.error = originalError;
    }
});
