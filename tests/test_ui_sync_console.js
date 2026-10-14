const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'static', 'js', 'ui-sync-console.js'), 'utf8');

async function consoleRow(job) {
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
            operations: [{operation: 'meeting-aura', latest: job}],
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

test('a failed run keeps its actual error prominent and offers explicit retry', async () => {
    const element = await consoleRow({
        ...retryJob, status: 'failed', state: 'failed', error: 'Sign in to MSX.',
    });
    assert.equal(element('[data-sync-message]').textContent, 'Sign in to MSX.');
    assert.equal(element('[data-sync-recovery]').hidden, true);
    assert.equal(element('[data-sync-retry]').hidden, false);
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
