const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-meeting-refresh.js'), 'utf8');
const date = '2026-10-16', next = '2026-10-19';

function job(overrides = {}) {
    return {id: 1, operation: 'meetings', status: 'pending', state: 'pending',
        options: {date}, calendar_dates: [date], progress: {}, ...overrides};
}

function fixture() {
    const window = {};
    vm.runInNewContext(source, {window, Date});
    let snapshots = [], readError = null, startError = null, startJob = job();
    const paints = [], completions = [], errors = [], cleared = [], requests = [], reads = [];
    const timers = new Map();
    let sequence = 0;
    const api = window.SBMeetingRefresh.create({
        read: async watched => {
            reads.push(Array.from(watched));
            if (readError) throw readError;
            return {jobs: snapshots};
        },
        start: async target => {
            requests.push(target);
            if (startError) throw startError;
            return startJob;
        },
        paint: states => paints.push(new Map(states)),
        complete: dates => completions.push(Array.from(dates)),
        showError: (date, message) => errors.push([date, message]),
        clearError: date => cleared.push(date),
        schedule: callback => { timers.set(++sequence, callback); return sequence; },
        cancel: id => timers.delete(id),
    });
    return {api, paints, completions, errors, cleared, requests, reads, timers,
        snapshots: value => { snapshots = value; },
        failRead: value => { readError = value; },
        failStart: value => { startError = value; },
        startJob: value => { startJob = value; },
        states: () => paints.at(-1)};
}

test('fresh page discovers all queued manual dates without submitting new work', async () => {
    const f = fixture();
    f.snapshots([job(), job({id: 2, calendar_dates: [next]})]);
    await f.api.check();
    assert.deepEqual([...f.states().keys()], [date, next]);
    assert.equal(f.states().get(date).state, 'queued');
    assert.deepEqual(f.requests, []);
    assert.equal(f.timers.size, 1);
    f.api.render();
    assert.deepEqual([...f.states().keys()], [date, next], 'month render retains busy state');
});

test('manual refresh admission uses the same lifecycle and prevents duplicate clicks', async () => {
    const f = fixture();
    f.snapshots([job()]);
    await f.api.request(date);
    await f.api.request(date);
    assert.deepEqual(f.requests, [date]);
    assert.equal(f.states().get(date).state, 'queued');
    f.snapshots([job({status: 'done', state: 'done', result: {
        date, synced_at: '2026-10-16T21:00:00Z', meetings: []}})]);
    await f.api.check();
    assert.equal(f.states().size, 0);
    assert.deepEqual(f.completions, [[date]]);
    await f.api.check();
    assert.deepEqual(f.completions, [[date]], 'completion side effects happen once');
});

test('parallel fetches keep every unsaved date busy regardless of current_date ordering', async () => {
    const f = fixture();
    f.snapshots([job({operation: 'meeting-aura', status: 'running', state: 'running',
        calendar_dates: [date, next], progress: {current_date: next,
            date_states: {[date]: 'fetching', [next]: 'queued'}}})]);
    await f.api.check();
    assert.deepEqual([...f.states().keys()], [date, next]);
    assert.deepEqual(f.completions, []);
});

test('automatic saved dates use manual completion handling while remaining dates keep spinning', async () => {
    const f = fixture();
    const aura = job({operation: 'meeting-aura', status: 'running', state: 'running',
        calendar_dates: [date, next], progress: {
            date_states: {[date]: 'complete', [next]: 'saving'}}});
    f.snapshots([aura]);
    await f.api.check();
    assert.deepEqual(f.completions, [[date]]);
    assert.deepEqual([...f.states().keys()], [next]);
    f.snapshots([{...aura, status: 'done', state: 'done', progress: {
        date_states: {[date]: 'complete', [next]: 'complete'}}}]);
    await f.api.check();
    assert.deepEqual(f.completions, [[date], [next]]);
    assert.equal(f.states().size, 0);
});

test('partial automatic failures report the affected day without claiming it refreshed', async () => {
    const f = fixture();
    f.snapshots([job({operation: 'meeting-aura', status: 'failed', state: 'failed',
        calendar_dates: [date, next], error: 'One date failed', progress: {
            date_states: {[date]: 'complete', [next]: 'failed'},
            date_errors: {[next]: 'Calendar source unavailable'}}})]);
    await f.api.check();
    assert.deepEqual(f.completions, [[date]]);
    assert.deepEqual(f.errors, [[next, 'Calendar source unavailable']]);
    assert.equal(f.states().size, 0);
});

test('observer includes older active identities until their final outcomes are received', async () => {
    const f = fixture();
    f.snapshots([job(), job({id: 2, calendar_dates: [next]})]);
    await f.api.check();
    f.snapshots([job({status: 'failed', state: 'failed', error: 'Source failure'}),
        job({id: 2, calendar_dates: [next]})]);
    await f.api.check();
    assert.deepEqual(f.reads[1], [1, 2]);
    assert.deepEqual(f.errors, [[date, 'Source failure']]);
    assert.deepEqual([...f.states().keys()], [next]);
});

test('read failures retain known busy dates, surface an error and keep retrying', async () => {
    const f = fixture();
    f.snapshots([job()]);
    await f.api.check();
    f.failRead(new Error('Network unavailable'));
    await f.api.check();
    assert.equal(f.states().has(date), true);
    assert.match(f.errors.at(-1)[1], /Reconnecting.*Network unavailable/);
    assert.equal(f.errors.at(-1)[0], null);
    assert.equal(f.timers.size, 1);
    f.failRead(null);
    await f.api.check();
    assert.equal(f.cleared.at(-1), null);
    assert.deepEqual(f.completions, []);
});

test('admission failure clears only its temporary busy state and never announces completion', async () => {
    const f = fixture();
    f.failStart(new Error('Could not admit refresh'));
    await f.api.request(date);
    assert.equal(f.states().size, 0);
    assert.deepEqual(f.errors, [[date, 'Could not admit refresh']]);
    assert.deepEqual(f.completions, []);
});

test('invalid cache timestamps and invalid discovery cannot produce success-shaped refreshes', async () => {
    for (const result of [{}, {date, synced_at: 'invalid'}, {date: next, synced_at: '2026-10-16'}]) {
        const f = fixture();
        f.snapshots([job({status: 'done', result})]);
        await f.api.check();
        assert.match(f.errors[0][1], /valid cache timestamp/);
        assert.deepEqual(f.completions, []);
    }
    const f = fixture();
    f.snapshots(null);
    await f.api.check();
    assert.match(f.errors[0][1], /invalid jobs/);
    assert.deepEqual(f.completions, []);
});

test('idle polling continues to discover automatic jobs started after the calendar opened', async () => {
    const f = fixture();
    await f.api.check();
    assert.equal(f.timers.size, 1);
    f.snapshots([job({operation: 'meeting-aura', calendar_dates: [date, next]})]);
    const callback = [...f.timers.values()][0];
    await callback();
    assert.deepEqual([...f.states().keys()], [date, next]);
    f.api.stop();
    assert.equal(f.timers.size, 0);
    await f.api.check();
    assert.equal(f.timers.size, 1, 'cached-back navigation can resume observation');
});

test('missing observed identities are explicit read errors rather than false completion', async () => {
    const f = fixture();
    f.snapshots([job()]);
    await f.api.check();
    f.snapshots([]);
    await f.api.check();
    assert.equal(f.states().has(date), true);
    assert.match(f.errors.at(-1)[1], /observed meeting refresh is missing/);
    assert.deepEqual(f.completions, []);
});

test('recovered attempts can repaint dates saved by a previous interrupted attempt', async () => {
    const f = fixture();
    const aura = job({operation: 'meeting-aura', status: 'running', state: 'running',
        attempt: 1, progress: {date_states: {[date]: 'complete'}}});
    f.snapshots([aura]);
    await f.api.check();
    f.snapshots([{...aura, attempt: 2}]);
    await f.api.check();
    assert.deepEqual(f.completions, [[date], [date]]);
});
