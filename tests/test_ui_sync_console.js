const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'static', 'js', 'ui-sync-console.js'), 'utf8');

async function consoleRow(job, extra = {}) {
    const elements = new Map();
    const element = selector => {
        if (!elements.has(selector)) elements.set(selector, {
            textContent: '', hidden: false, removeAttribute(name) { delete this[name]; },
            addEventListener() {},
        });
        return elements.get(selector);
    };
    const row = {dataset: {}, querySelector: element};
    const root = {
        querySelector: selector => selector.startsWith('[data-sync-operation=') ?
            row : element(selector),
        querySelectorAll: () => [],
    };
    vm.runInNewContext(source, {
        document: {hidden: false, querySelector: () => root, addEventListener() {}},
        window: {addEventListener() {}},
        fetch: async () => ({ok: true, json: async () => ({
            success: true, worker: {message: 'Worker healthy.'},
            operations: [{operation: 'meeting-aura', latest: job, ...extra}],
        })}),
        setTimeout() {}, clearTimeout() {}, console,
    });
    await new Promise(resolve => setImmediate(resolve));
    return element;
}

const retryJob = {
    id: 10, status: 'running', state: 'running', attempt: 2, max_attempts: 3,
    error: 'worker died (stale heartbeat)',
    progress: {percent: 20, message: 'Refreshing 2026-10-15 (2/5).'},
};

test('the global options toggle shows and hides editors without resetting them', async () => {
    let change;
    const toggle = {checked: false, addEventListener: (event, callback) => { change = callback; }};
    const options = [{hidden: true, editor: {value: '{"force":false}'}}];
    const root = {
        querySelector: selector => selector === '[data-sync-show-options]' ?
            toggle : {addEventListener() {}},
        querySelectorAll: selector => selector === '.sb-sync-options' ? options : [],
    };
    vm.runInNewContext(source, {
        document: {hidden: false, querySelector: () => root, addEventListener() {}},
        window: {addEventListener() {}},
        fetch: async () => ({ok: true, json: async () => ({
            success: true, worker: {message: 'Worker healthy.'}, operations: [],
        })}),
        setTimeout() {}, clearTimeout() {}, console,
    });
    assert.equal(options[0].hidden, true);
    toggle.checked = true;
    change();
    assert.equal(options[0].hidden, false);
    toggle.checked = false;
    change();
    assert.equal(options[0].hidden, true);
    assert.equal(options[0].editor.value, '{"force":false}');
});

test('run diagnostics explain automatic triggers and actual elapsed time', async () => {
    const element = await consoleRow({...retryJob, status: 'done', state: 'done', error: null,
        initiator: 'followup', started_at: '2026-10-15T01:00:00Z',
        finished_at: '2026-10-15T01:02:05Z'});
    assert.equal(element('[data-sync-trigger]').textContent, 'Automatic follow-up');
    assert.match(element('[data-sync-timing]').textContent, /Duration: 2m 5s$/);
    assert.equal(element('[data-sync-heartbeat]').hidden, true);
    const active = await consoleRow({...retryJob, initiator: 'scheduled',
        started_at: '2026-10-15T01:00:00Z', heartbeat_at: '2026-10-15T01:02:00Z',
        progress_at: '2026-10-15T01:01:00Z'});
    assert.equal(active('[data-sync-trigger]').textContent, 'Scheduled automatically');
    assert.equal(active('[data-sync-heartbeat]').hidden, false);
    assert.match(active('[data-sync-heartbeat]').textContent, /Last heartbeat: .*Last progress:/);
});

test('syncs without an options editor still submit an empty options object', async () => {
    let start, submitted;
    const notice = {hidden: true};
    const row = {dataset: {syncOperation: 'milestones'},
        querySelector: selector => selector === '[data-sync-row-error]' ? notice : null};
    const button = {
        closest: () => row,
        addEventListener: (event, callback) => { start = callback; },
    };
    const root = {
        querySelector: () => ({addEventListener() {}}),
        querySelectorAll: selector => selector === '[data-sync-inspect]' ? [] : [button],
    };
    vm.runInNewContext(source, {
        document: {hidden: false, querySelector: () => root, addEventListener() {}},
        window: {addEventListener() {}},
        crypto: {randomUUID: () => 'test-request'},
        fetch: async (url, options) => {
            if (options?.method === 'POST') {
                submitted = {url, body: JSON.parse(options.body)};
                return {ok: true, json: async () => ({accepted: true})};
            }
            return {ok: true, json: async () => ({
                success: true, worker: {message: 'Worker healthy.'}, operations: [],
            })};
        },
        setTimeout() {}, clearTimeout() {}, console,
    });
    await start();
    assert.equal(submitted.url, '/api/jobs/start/milestones');
    assert.deepEqual(submitted.body, {});
    assert.equal(notice.hidden, true);
});

test('a recovered run shows current progress, with the old interruption separately labeled', async () => {
    const element = await consoleRow(retryJob);
    assert.equal(element('[data-sync-state]').textContent, 'Running');
    assert.equal(element('[data-sync-message]').textContent, retryJob.progress.message);
    assert.equal(element('[data-sync-progress]').value, 20);
    assert.equal(element('[data-sync-recovery]').hidden, false);
    assert.equal(element('[data-sync-recovery]').textContent,
        'Previous attempt was interrupted when the worker stopped.' +
        ' Automatically restarted; running again.');
});

test('an automatic retry wait shows its schedule, not stale progress', async () => {
    const element = await consoleRow({
        ...retryJob, status: 'pending', state: 'retry_waiting',
        retry_at: '2026-10-14T20:50:00Z',
    });
    assert.match(element('[data-sync-message]').textContent, /^Automatic retry scheduled for /);
    assert.match(element('[data-sync-recovery]').textContent, /^Previous attempt was interrupted/);
    assert.doesNotMatch(element('[data-sync-recovery]').textContent, /running again/);
});

test('a failed run keeps its actual error visible and enables a fresh start', async () => {
    const element = await consoleRow({
        ...retryJob, status: 'failed', state: 'failed', error: 'Sign in to MSX.',
    });
    assert.equal(element('[data-sync-message]').textContent, 'Sign in to MSX.');
    assert.equal(element('[data-sync-recovery]').hidden, true);
    assert.equal(element('[data-sync-start]').disabled, false);
    assert.equal(element('[data-sync-details]').href, '/api/jobs/10');
});

test('healthy and completed runs hide previous-attempt diagnostics', async () => {
    for (const job of [
        {...retryJob, error: null},
        {...retryJob, status: 'done', state: 'done', error: null,
            progress: {percent: 100, message: 'Sync completed with warnings.'}},
    ]) {
        const element = await consoleRow(job);
        assert.equal(element('[data-sync-recovery]').hidden, true);
        assert.equal(element('[data-sync-recovery]').textContent, '');
        assert.equal(element('[data-sync-message]').textContent, job.progress.message);
    }
});

test('compact rows separate schedule, success, live progress and hover diagnostics', async () => {
    const element = await consoleRow(retryJob, {
        schedule: {label: 'Daily · 7:00 AM local', detail: 'Also catches up at startup.',
            triggers: ['After Account Sync unless skipped.']},
        last_success_at: '2026-10-14T12:00:00Z',
    });
    assert.equal(element('[data-sync-schedule]').textContent, 'Daily · 7:00 AM local');
    assert.equal(element('[data-sync-schedule-inspect]').hidden, false);
    assert.equal(element('[data-sync-schedule-triggers]').textContent,
        'After Account Sync unless skipped.');
    assert.equal(element('[data-sync-success]').textContent,
        new Date('2026-10-14T12:00:00Z').toLocaleString());
    assert.equal(element('[data-sync-live-progress]').hidden, false);
    assert.equal(element('[data-sync-progress-label]').textContent, '20%');
    assert.equal(element('[data-sync-progress-message]').textContent, retryJob.progress.message);
    assert.match(element('[data-sync-run]').textContent, /Job 10 · attempt 2\/3/);
    const done = await consoleRow({...retryJob, status: 'done', state: 'done'});
    assert.equal(done('[data-sync-live-progress]').hidden, true);
});

test('schedule icons are hidden when there are no automatic triggers', async () => {
    const element = await consoleRow(null, {
        schedule: {label: 'On demand', detail: 'No recurring schedule.', triggers: []},
    });
    assert.equal(element('[data-sync-schedule-inspect]').hidden, true);
    assert.equal(element('[data-sync-schedule-triggers]').textContent, '');
});

test('queued and unavailable-worker states explain what happens next', async () => {
    for (const state of ['queued', 'waiting_for_worker']) {
        const element = await consoleRow({
            ...retryJob, status: 'pending', state, error: null,
        });
        assert.match(element('[data-sync-message]').textContent, /[Ww]aiting|will start/);
        assert.notEqual(element('[data-sync-message]').textContent, retryJob.progress.message);
    }
});

test('a currently stale worker is not described as successfully recovered', async () => {
    const element = await consoleRow({...retryJob, state: 'interrupted'});
    assert.equal(element('[data-sync-state]').textContent, 'Interrupted');
    assert.equal(element('[data-sync-message]').textContent,
        'The worker stopped reporting. Waiting for recovery.');
    assert.doesNotMatch(element('[data-sync-recovery]').textContent, /running again/);
});

test('other previous-attempt failures remain visible without replacing current progress', async () => {
    const element = await consoleRow({...retryJob, error: 'Source timed out.'});
    assert.equal(element('[data-sync-message]').textContent, retryJob.progress.message);
    assert.match(element('[data-sync-recovery]').textContent,
        /^Previous attempt failed: Source timed out\./);
});

test('group waits and database waits identify their real blocker', async () => {
    const blocker = {id: 7, name: 'Fabric 360'};
    const group = await consoleRow({...retryJob, status: 'pending',
        state: 'waiting_for_group', blocker, error: null});
    assert.equal(group('[data-sync-state]').textContent, 'Waiting for another sync');
    assert.equal(group('[data-sync-message]').textContent, 'Waiting for Fabric 360, job 7.');
    const writer = await consoleRow({...retryJob, state: 'waiting_for_write', blocker});
    assert.equal(writer('[data-sync-state]').textContent, 'Waiting to save');
    assert.equal(writer('[data-sync-message]').textContent,
        'Waiting for Fabric 360 to finish saving.');
});
