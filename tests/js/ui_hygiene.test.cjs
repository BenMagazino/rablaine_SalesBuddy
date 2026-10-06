const assert = require('node:assert/strict');
const test = require('node:test');
const {createReasonSaver, validateView, validateGapRows, retireFixSorts, jsonRequest} =
    require('../../static/js/ui-hygiene.js');

function deferred() {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return {promise, resolve, reject};
}
function saverFixture(initial = '') {
    const writes = [], states = [], confirmations = [];
    const saver = createReasonSaver(initial, value => {
        const request = deferred(); writes.push({value, ...request}); return request.promise;
    }, (state, message) => states.push({state, message}), value => confirmations.push(value));
    return {saver, writes, states, confirmations};
}

test('saved reasons hydrate without writes and preserve original trimming', async () => {
    const h = saverFixture(' Confirmed ');
    assert.equal(h.saver.confirmed, 'Confirmed');
    assert.equal(h.saver.dirty, false);
    await h.saver.flush();
    assert.equal(h.writes.length, 0);
});
test('blur, debounce and repeated flushes share one request', async () => {
    const h = saverFixture(); h.saver.setDraft(' Reason ');
    const first = h.saver.flush(), second = h.saver.flush();
    assert.equal(first, second);
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].value, 'Reason');
    assert.equal(h.saver.busy, true);
    assert.equal(h.confirmations.length, 0);
    h.writes[0].resolve({success: true}); await first;
    assert.equal(h.saver.busy, false);
    assert.equal(h.saver.dirty, false);
    assert.deepEqual(h.confirmations, ['Reason']);
});
test('pending edits coalesce and cannot overwrite a newer reason with an older response', async () => {
    const h = saverFixture(); h.saver.setDraft('First');
    const saving = h.saver.flush();
    h.saver.setDraft('Intermediate'); h.saver.setDraft('Latest');
    h.writes[0].resolve({success: true});
    await Promise.resolve(); await Promise.resolve();
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1].value, 'Latest');
    assert.equal(h.saver.confirmed, 'First');
    assert.equal(h.saver.dirty, true);
    h.writes[1].resolve({success: true}); await saving;
    assert.deepEqual(h.confirmations, ['First', 'Latest']);
    assert.equal(h.saver.confirmed, 'Latest');
});
test('reverting an in-flight edit sends a compensating save, including empty-note deletion', async () => {
    const h = saverFixture(); h.saver.setDraft('Temporary');
    const saving = h.saver.flush(); h.saver.setDraft('');
    h.writes[0].resolve({success: true});
    await Promise.resolve(); await Promise.resolve();
    assert.equal(h.writes[1].value, '');
    h.writes[1].resolve({success: true}); await saving;
    assert.equal(h.saver.confirmed, '');
    assert.equal(h.saver.dirty, false);
});
test('failed writes remain dirty, never count as confirmed and retry the latest value', async () => {
    const h = saverFixture('Old'); h.saver.setDraft('Not saved');
    const saving = h.saver.flush(); h.writes[0].reject(new Error('Offline')); await saving;
    assert.equal(h.saver.confirmed, 'Old');
    assert.equal(h.saver.dirty, true);
    assert.equal(h.states.at(-1).state, 'error');
    assert.match(h.states.at(-1).message, /Offline/);
    h.saver.setDraft('Retry latest'); const retry = h.saver.flush();
    assert.equal(h.writes[1].value, 'Retry latest');
    h.writes[1].resolve({success: true}); await retry;
    assert.equal(h.saver.confirmed, 'Retry latest');
});
test('success must be a boolean true, not a success-shaped fallback', async () => {
    for (const result of [null, {}, {success: false}, {success: 'true'}, {success: 1}]) {
        const h = saverFixture(); h.saver.setDraft('Draft');
        const saving = h.saver.flush(); h.writes[0].resolve(result); await saving;
        assert.equal(h.saver.confirmed, '');
        assert.equal(h.saver.dirty, true);
        assert.equal(h.states.at(-1).state, 'error');
    }
});
test('disposed rows do not enqueue more saves or emit stale confirmations', async () => {
    const h = saverFixture(); h.saver.setDraft('Pending');
    const saving = h.saver.flush(); h.saver.dispose();
    h.writes[0].resolve({success: true}); await saving;
    assert.equal(h.confirmations.length, 0);
    h.saver.setDraft('Removed'); await h.saver.flush();
    assert.equal(h.writes.length, 1);
});
test('scope schema retains both preferences and rejects malformed restoration', () => {
    assert.deepEqual(validateView({onlyOnTeam: false, groupBySeller: true}),
        {onlyOnTeam: false, groupBySeller: true});
    for (const value of [null, [], {}, 'view', {onlyOnTeam: true},
        {onlyOnTeam: 'true', groupBySeller: false}]) {
        assert.throws(() => validateView(value), /Invalid hygiene milestone view/);
    }
});
test('request adapter rejects HTTP failures, wrong content types and malformed JSON', async () => {
    const original = global.fetch;
    try {
        global.fetch = async () => ({ok: false, status: 500,
            headers: {get: () => 'application/json'}, json: async () => ({success: true})});
        await assert.rejects(jsonRequest('/test'), /HTTP 500/);
        global.fetch = async () => ({ok: false, status: 400,
            headers: {get: () => 'application/json'}, json: async () => ({error: 'Bad request'})});
        await assert.rejects(jsonRequest('/test'), /Bad request/);
        global.fetch = async () => ({ok: true, status: 200,
            headers: {get: () => 'text/html'}});
        await assert.rejects(jsonRequest('/test'), /Expected JSON/);
        global.fetch = async () => ({ok: true, status: 200,
            headers: {get: () => 'application/json'}, json: async () => { throw new Error('JSON'); }});
        await assert.rejects(jsonRequest('/test'), /JSON/);
    } finally { global.fetch = original; }
});
test('authoritative gap rows require unique positive identities and complete columns', () => {
    const row = id => ({dataset: {engagementId: id}, cells: Array(6)});
    const valid = [row('1'), row('2')];
    assert.equal(validateGapRows(valid, 'engagementId'), valid);
    assert.deepEqual(validateGapRows([], 'milestoneId'), []);
    for (const rows of [[row('0')], [row('-1')], [row('')], [row(undefined)],
        [row('1'), row('1')], [{...row('1'), cells: Array(5)}]]) {
        assert.throws(() => validateGapRows(rows, 'engagementId'), /Invalid gap row identities/);
    }
});
test('retired Fix sorts reset only Hygiene action-column state without mutating history', () => {
    const state = {sbHygiene: {queue: 'milestone'}, sbTableSort: {
        'hygiene-engagements': {column: 5, direction: 'ascending'},
        'hygiene-milestones': {column: 3, direction: 'descending'},
        'hygiene-seller-Seller': {column: 5, direction: 'descending'},
        another: {column: 5, direction: 'ascending'},
    }};
    const updated = retireFixSorts(state);
    assert.equal(updated.sbTableSort['hygiene-engagements'], null);
    assert.equal(updated.sbTableSort['hygiene-seller-Seller'], null);
    assert.equal(updated.sbTableSort['hygiene-milestones'], state.sbTableSort['hygiene-milestones']);
    assert.equal(updated.sbTableSort.another, state.sbTableSort.another);
    assert.equal(updated.sbHygiene, state.sbHygiene);
    assert.equal(state.sbTableSort['hygiene-engagements'].column, 5);
    assert.equal(retireFixSorts(updated), updated);
    assert.equal(retireFixSorts(null), null);
});
