const test = require('node:test');
const assert = require('node:assert/strict');
const u2c = require('../../static/js/ui-u2c.js');

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
