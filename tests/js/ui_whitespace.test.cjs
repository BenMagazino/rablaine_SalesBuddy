const assert = require('node:assert/strict');
const test = require('node:test');
const {displayName, formatRevenue, visibleCustomers, matchingCustomers, createLatestReader,
    requireGrid} = require('../../static/js/ui-whitespace.js');

const customers = [
    {id: 1, name: 'Beta', nickname: 'Nickname', tpid: 123456, buckets: {Databases: 1234.56}},
    {id: 2, name: 'Alpha', nickname: null, buckets: {Databases: 3.25, Analytics: 5}},
    {id: 3, name: 'Gamma', buckets: {Analytics: 0}},
];

test('grid retains partial coverage, single-pillar and fully-covered behavior', () => {
    assert.deepEqual(visibleCustomers(customers, ['Databases', 'Analytics'], false)
        .map(customer => customer.id), [1, 3]);
    assert.deepEqual(visibleCustomers(customers, ['Databases', 'Analytics'], true)
        .map(customer => customer.id), [1, 3, 2]);
    assert.deepEqual(visibleCustomers(customers.slice(0, 1), ['Databases'], false), [customers[0]]);
    assert.deepEqual(visibleCustomers([], ['Databases'], true), []);
    assert.deepEqual(customers.map(customer => customer.id), [1, 2, 3]);
});

test('display rounding does not mutate raw revenue or rounded-zero coverage', () => {
    assert.equal(formatRevenue(1234.56), '$1.2K');
    assert.equal(formatRevenue(999.4), '$999');
    assert.equal(formatRevenue(0), '$0');
    assert.equal(customers[0].buckets.Databases, 1234.56);
    assert.equal(displayName(customers[0]), 'Beta (Nickname)');
    assert.equal(displayName(customers[1]), 'Alpha');
    assert.equal(visibleCustomers([customers[2]], ['Databases', 'Analytics'], false).length, 1);
});

test('reverse search matches name, nickname and numeric TPID with bounded results', () => {
    for (const term of ['BE', ' nickname ', '3456']) {
        assert.deepEqual(matchingCustomers(customers, term), [customers[0]]);
    }
    assert.deepEqual(matchingCustomers(customers, 'a'), []);
    assert.deepEqual(matchingCustomers(customers, 'absent'), []);
    assert.equal(matchingCustomers(Array.from({length: 30}, (_, index) =>
        ({id: index + 1, name: 'Customer ' + index})), 'customer').length, 15);
});

test('grid responses must match the requested pillar selection', () => {
    const response = {customers, buckets: ['Databases', 'Analytics']};
    assert.equal(requireGrid(response, ['Databases', 'Analytics']), response);
    assert.throws(() => requireGrid(response, ['Databases']), /Invalid whitespace/);
    assert.throws(() => requireGrid({...response, customers: [{...customers[0],
        buckets: {Databases: '1.2K'}}]}, response.buckets), /Invalid whitespace/);
    assert.throws(() => requireGrid({...response, customers: [{...customers[0],
        buckets: {Unexpected: 1}}]}, response.buckets), /Invalid whitespace/);
});

test('latest read wins even when canceled transport returns late', async () => {
    const pending = [];
    const reader = createLatestReader((url, options) => new Promise(resolve =>
        pending.push({url, options, resolve})));
    const old = reader.read('grid', '/old');
    const current = reader.read('grid', '/new');
    assert.equal(pending[0].options.signal.aborted, true);
    pending[1].resolve({ok: true, json: async () => ({value: 'new'})});
    assert.deepEqual(await current, {data: {value: 'new'}});
    pending[0].resolve({ok: true, json: async () => ({value: 'old'})});
    assert.deepEqual(await old, {stale: true});
});

test('independent panes do not cancel each other; explicit close cancels detail', async () => {
    const pending = [];
    const reader = createLatestReader((url, options) => new Promise(resolve =>
        pending.push({url, options, resolve})));
    const grid = reader.read('grid', '/grid');
    const detail = reader.read('detail', '/detail');
    assert.equal(pending[0].options.signal.aborted, false);
    reader.cancel('detail');
    assert.equal(pending[1].options.signal.aborted, true);
    pending.forEach(request => request.resolve({ok: true, json: async () => []}));
    assert.deepEqual(await grid, {data: []});
    assert.deepEqual(await detail, {stale: true});
});

test('clearing pillars cancels pending reads and reselecting only accepts the latest scope',
    async () => {
        const pending = [];
        const reader = createLatestReader((url, options) => new Promise(resolve =>
            pending.push({url, options, resolve})));
        const first = reader.read('grid', '/AI');
        const second = reader.read('grid', '/Analytics');
        reader.cancel('grid');
        const latest = reader.read('grid', '/Security');
        pending.forEach(request => request.resolve({ok: true, json: async () => request.url}));
        assert.deepEqual(await first, {stale: true});
        assert.deepEqual(await second, {stale: true});
        assert.deepEqual(await latest, {data: '/Security'});
    });

test('HTTP, transport and malformed JSON failures propagate for explicit Retry', async () => {
    const http = createLatestReader(async () => ({ok: false, status: 503}));
    await assert.rejects(http.read('grid', '/grid'), /Request failed \(503\)/);
    const transport = createLatestReader(async () => { throw new Error('Network unavailable'); });
    await assert.rejects(transport.read('grid', '/grid'), /Network unavailable/);
    const json = createLatestReader(async () => ({ok: true, json: async () => {
        throw new SyntaxError('Malformed JSON');
    }}));
    await assert.rejects(json.read('reverse', '/reverse'), /Malformed JSON/);
});
