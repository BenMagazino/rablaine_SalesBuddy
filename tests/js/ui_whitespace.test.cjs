const assert = require('node:assert/strict');
const test = require('node:test');
const {displayName, formatRevenue, visibleBuckets, visibleCustomers, matchingCustomers,
    createLatestReader, requireGrid, parsePreferences, sellerGroups, entryPreset} =
    require('../../static/js/ui-whitespace.js');

test('Database widget entry selects every contributing pillar and sorts by Databases', () => {
    assert.deepEqual(entryPreset('?view=database-whitespace'), {
        key: 'database-whitespace-v2',
        pillars: ['AI', 'Analytics', 'Apps', 'Databases'],
        sortPillar: 'Databases',
        focus: 'Databases',
    });
    for (const search of ['', '?view=fabric-acquisition', '?view=unknown']) {
        assert.equal(entryPreset(search), null);
    }
});

const customers = [
    {id: 1, name: 'Beta', nickname: 'Nickname', tpid: 123456, buckets: {Databases: 1234.56}},
    {id: 2, name: 'Alpha', nickname: null, buckets: {Databases: 3.25, Analytics: 5}},
    {id: 3, name: 'Gamma', buckets: {Analytics: 0}},
];

test('focused pillar is hidden without changing selected columns or their order', () => {
    const selected = ['AI', 'Analytics', 'Apps', 'Databases', 'Developer', 'Infra', 'Security'];
    const original = [...selected];
    for (const focus of selected) {
        assert.deepEqual(visibleBuckets(selected, focus), selected.filter(bucket => bucket !== focus));
    }
    assert.deepEqual(visibleBuckets(selected), original);
    assert.deepEqual(visibleBuckets(['AI'], 'Databases'), ['AI']);
    assert.deepEqual(visibleBuckets(['Databases'], 'Databases'), []);
    assert.deepEqual(visibleBuckets([], 'Databases'), []);
    assert.deepEqual(selected, original);
});

test('grid retains partial coverage, single-pillar and fully-covered behavior', () => {
    assert.deepEqual(visibleCustomers(customers, ['Databases', 'Analytics'], false)
        .map(customer => customer.id), [1, 3]);
    assert.deepEqual(visibleCustomers(customers, ['Databases', 'Analytics'], true)
        .map(customer => customer.id), [1, 3, 2]);
    assert.deepEqual(visibleCustomers(customers.slice(0, 1), ['Databases'], false), [customers[0]]);
    assert.deepEqual(visibleCustomers([], ['Databases'], true), []);
    assert.deepEqual(customers.map(customer => customer.id), [1, 2, 3]);
});

test('focus excludes target coverage independently of spend columns and show-all', () => {
    for (const showAll of [false, true]) {
        for (const columns of [[], ['Databases'], ['Analytics'], ['Databases', 'Analytics']]) {
            assert.deepEqual(visibleCustomers(customers, columns, showAll, 'Databases')
                .map(customer => customer.id), [3]);
        }
    }
    assert.deepEqual(visibleCustomers(customers, ['AI'], false, 'Analytics')
        .map(customer => customer.id), [1]);
    assert.equal(visibleCustomers(customers, ['AI'], false, 'AI').length, 3);
    assert.deepEqual(visibleCustomers([{id: 4, name: 'No coverage', buckets: {}}],
        [], true, 'Databases'), []);
    assert.deepEqual(customers.map(customer => customer.id), [1, 2, 3]);
});

test('focus preferences are additive and reject invalid types', () => {
    const preferences = {version: 1, pillars: ['AI'], focus: 'Databases', sorts: {}};
    assert.deepEqual(parsePreferences(JSON.stringify(preferences)), preferences);
    assert.equal(parsePreferences(JSON.stringify({...preferences, focus: ''})).focus, '');
    for (const focus of [null, 1, true, [], {}]) {
        assert.throws(() => parsePreferences(JSON.stringify({...preferences, focus})),
            /Invalid whitespace focus/);
    }
});

test('Database entry requires AI, Analytics or Apps coverage independently of visible columns', () => {
    const preset = entryPreset('?view=database-whitespace');
    const rows = [
        {id: 1, name: 'AI', buckets: {AI: 0}},
        {id: 2, name: 'Analytics', buckets: {Analytics: 10, Infra: 1000}},
        {id: 3, name: 'Apps', buckets: {Apps: 25}},
        {id: 4, name: 'Infra only', buckets: {Infra: 1000}},
        {id: 5, name: 'Developer and security', buckets: {Developer: 10, Security: 20}},
        {id: 6, name: 'Database user', buckets: {AI: 20, Databases: 0}},
        {id: 7, name: 'No coverage', buckets: {}},
    ];
    for (const columns of [[], ['AI'], ['Infra'], preset.pillars]) {
        for (const showAll of [false, true]) {
            assert.deepEqual(visibleCustomers(rows, columns, showAll, preset.focus, preset.pillars)
                .map(row => row.id).sort(), [1, 2, 3]);
        }
    }
    assert.equal(visibleCustomers(rows, [], false, 'Databases').length, 5);
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

test('seller grouping keeps distinct identities, unassigned last and input order intact', () => {
    const rows = [
        {id: 1, seller: null},
        {id: 2, seller: {id: 3, name: 'Beta'}},
        {id: 3, seller: {id: 2, name: 'Alpha'}},
        {id: 4, seller: {id: 1, name: 'Alpha'}},
        {id: 5, seller: {id: 2, name: 'Alpha'}},
        {id: 6},
    ];
    const groups = sellerGroups(rows);
    assert.deepEqual(groups.map(group => group.seller?.id ?? null), [1, 2, 3, null]);
    assert.deepEqual(groups.map(group => group.rows.map(row => row.id)), [[4], [3, 5], [2], [1, 6]]);
    assert.deepEqual(rows.map(row => row.id), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(sellerGroups([]), []);
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
    for (const seller of [{id: '1', name: 'Owner'}, {id: 0, name: 'Owner'}, {id: 1}]) {
        assert.throws(() => requireGrid({...response, customers: [{...customers[0], seller}]},
            response.buckets), /Invalid whitespace/);
    }
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

const gridKey = 'whitespace:gridTable:' + JSON.stringify([
    ['Customer', 'text'], ['AI', 'number'], ['Gaps', 'number'],
]);
const otherGridKey = 'whitespace:gridTable:' + JSON.stringify([
    ['Customer', 'text'], ['Analytics', 'number'], ['Security', 'number'], ['Gaps', 'number'],
]);
const penetrationKey = 'whitespace:penetrationTable:' + JSON.stringify([
    ['Pillar', 'text'], ['Customers with Spend', 'number'],
    ['Adoption Rate', 'number'], ['Gap', 'number'],
]);

test('missing preferences keep default pillars distinct from an intentionally empty selection', () => {
    assert.deepEqual(parsePreferences(null), {version: 1, sorts: {}});
    assert.deepEqual(parsePreferences(JSON.stringify({version: 1, pillars: [], sorts: {}})),
        {version: 1, pillars: [], sorts: {}});
});

test('stored preferences round-trip independent grid scopes, penetration and explicit sort reset', () => {
    const preferences = {
        version: 1, pillars: ['AI', 'Security'],
        sorts: {
            [gridKey]: {column: 1, direction: 'descending'},
            [otherGridKey]: {column: 2, direction: 'ascending'},
            [penetrationKey]: {column: 3, direction: 'descending'},
        },
    };
    assert.deepEqual(parsePreferences(JSON.stringify(preferences)), preferences);
    preferences.sorts[gridKey] = null;
    assert.equal(parsePreferences(JSON.stringify(preferences)).sorts[gridKey], null);
});

test('malformed, obsolete or invalid selections cannot masquerade as saved preferences', () => {
    assert.throws(() => parsePreferences('{'), SyntaxError);
    for (const value of [null, [], {}, {version: 0, sorts: {}},
        {version: 1, pillars: null, sorts: {}}, {version: 1, pillars: [42], sorts: {}},
        {version: 1, sorts: []}]) {
        assert.throws(() => parsePreferences(JSON.stringify(value)));
    }
});

test('saved sorts reject wrong table keys, broken column schemas and invalid direction or index', () => {
    const invalid = [
        ['otherTable', {column: 1, direction: 'ascending'}],
        ['whitespace:gridTable:invalid-json', null],
        ['whitespace:gridTable:[]', null],
        ['whitespace:gridTable:[["Customer","invalid"]]', null],
        [gridKey, {column: 9, direction: 'ascending'}],
        [gridKey, {column: -1, direction: 'ascending'}],
        [gridKey, {column: '1', direction: 'ascending'}],
        [gridKey, {column: 1, direction: 'sideways'}],
    ];
    for (const [key, state] of invalid) {
        assert.throws(() => parsePreferences(JSON.stringify({
            version: 1, pillars: ['AI'], sorts: {[key]: state},
        })));
    }
});
