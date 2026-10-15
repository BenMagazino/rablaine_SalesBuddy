const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('static/js/ui-sync-progress.js', 'utf8');
const run = (overrides = {}) => ({
    id: 7, operation: 'milestones', status: 'running', state: 'running',
    progress: {percent: 37, message: 'Fetching milestone tasks.'}, ...overrides,
});
const done = () => run({status: 'done', state: 'done',
    finished_at: '2026-10-15T03:00:00Z', result: {success: true}});

function fixture(initial = null, options = {}) {
    class Element {
        constructor() {
            this.dataset = {}; this.hidden = false; this.disabled = false;
            this.textContent = ''; this.attributes = {}; this.handlers = {};
        }
        addEventListener(name, handler) { this.handlers[name] = handler; }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; if (name === 'value') delete this.value; }
    }
    const fields = new Map(), field = key => {
        if (!fields.has(key)) fields.set(key, new Element());
        return fields.get(key);
    };
    const buttons = [new Element(), new Element()];
    const root = new Element(), timers = new Map(), events = {};
    root.dataset = {sbSyncProgress: 'milestones', syncControls: '#syncBtn, #syncBtnEmpty'};
    root.querySelector = field;
    field('[data-sync-running]').querySelector = () => field('bar');
    let current = initial, readError = null, admissions = 0, nextId = 1;
    const errors = [], completed = [], reads = [];
    const context = {
        document: {
            querySelectorAll: () => buttons,
            addEventListener() {},
        },
        window: {
            SBJobs: {
                latest: async operation => {
                    reads.push(operation);
                    if (readError) throw readError;
                    return current;
                },
                start: async () => { admissions++; current = run(); return current; },
                message: job => job.progress.message,
            },
            addEventListener: (name, handler) => { events[name] = handler; },
        },
        console: {error: (...args) => errors.push(args)},
        setTimeout: fn => { const id = nextId++; timers.set(id, fn); return id; },
        clearTimeout: id => timers.delete(id),
    };
    vm.runInNewContext(source, context);
    const api = context.window.SBSyncProgress.create(root, {
        onComplete: job => completed.push(job.id), ...options,
    });
    return {
        api, root, field, buttons, events, errors, completed, reads, context,
        admissions: () => admissions,
        setJob: value => { current = value; },
        failRead: value => { readError = value; },
        async tick() {
            const callbacks = [...timers.values()];
            timers.clear();
            for (const fn of callbacks) fn();
            await settle();
        },
    };
}
async function settle() { for (let i = 0; i < 16; i++) await Promise.resolve(); }

test('arriving during a run immediately shows measured progress without starting another job', async () => {
    const h = fixture(run());
    assert.ok(h.buttons.every(button => button.disabled));
    await settle();
    assert.equal(h.field('[data-sync-running]').hidden, false);
    assert.equal(h.field('bar').value, 37);
    assert.match(h.field('[data-sync-message]').textContent, /37%.*Fetching milestone tasks/);
    assert.ok(h.buttons.every(button => button.disabled));
    assert.equal(h.admissions(), 0);
    await h.api.start();
    assert.equal(h.admissions(), 0);
});

test('refreshing the page attaches to the same job and never needs an admission POST', async () => {
    const first = fixture(run()), refreshed = fixture(run());
    await settle();
    assert.equal(first.api.job.id, refreshed.api.job.id);
    assert.equal(refreshed.field('bar').value, 37);
    assert.equal(refreshed.admissions(), 0);
});

test('an external start while a page is open is discovered by read-only polling', async () => {
    const h = fixture();
    await settle();
    assert.ok(h.buttons.every(button => !button.disabled));
    h.setJob(run());
    await h.tick();
    assert.equal(h.field('[data-sync-running]').hidden, false);
    assert.ok(h.buttons.every(button => button.disabled));
    assert.equal(h.admissions(), 0);
});

test('start preflight attaches to an externally admitted run even before the next poll', async () => {
    const h = fixture();
    await settle();
    h.setJob(run());
    const job = await h.api.start();
    assert.equal(job.id, 7);
    assert.equal(h.admissions(), 0);
});

test('manual start is admitted once, with both controls guarded against repeated clicks', async () => {
    const h = fixture();
    await settle();
    const first = h.api.start(), repeated = h.api.start();
    assert.equal(first, repeated);
    await first;
    assert.equal(h.admissions(), 1);
    assert.ok(h.buttons.every(button => button.disabled));
    assert.equal(h.field('[data-sync-running]').hidden, false);
});

test('queued and unmeasured phases are indeterminate instead of pretending to be zero percent', async () => {
    const h = fixture(run());
    await settle();
    h.setJob(run({status: 'pending', state: 'waiting_for_group',
        progress: {percent: null, message: 'Waiting for another sync.'}}));
    await h.api.check();
    assert.equal(h.field('bar').value, undefined);
    assert.equal(h.field('[data-sync-message]').textContent, 'Waiting for another sync.');
    assert.equal(h.field('[data-sync-last]').textContent, 'Sync queued');
});

test('connection failures stay visible, prevent blind starts and recover by reading the same job', async () => {
    const h = fixture(run());
    await settle();
    h.failRead(new Error('Network unavailable.'));
    await assert.rejects(h.api.check(), /Network unavailable/);
    assert.match(h.field('[data-sync-result]').textContent, /status unavailable.*Network/);
    assert.ok(h.buttons.every(button => button.disabled));
    h.failRead(null);
    await h.tick();
    assert.equal(h.api.job.id, 7);
    assert.equal(h.field('[data-sync-result]').hidden, true);
    assert.equal(h.admissions(), 0);
    assert.equal(h.errors.length, 1);
});

test('terminal failures show the actual error and never call completion or reload', async () => {
    const h = fixture(run());
    await settle();
    h.setJob(run({status: 'failed', state: 'failed', error: 'Connect to the corporate VPN.'}));
    await h.api.check();
    assert.equal(h.field('[data-sync-running]').hidden, true);
    assert.equal(h.field('[data-sync-result]').textContent, 'Connect to the corporate VPN.');
    assert.equal(h.field('[data-sync-result]').attributes.role, 'alert');
    assert.equal(h.completed.length, 0);
    assert.ok(h.buttons.every(button => !button.disabled));
});

test('observed completion fires once and its result persists through later status reads', async () => {
    const h = fixture(run());
    await settle();
    h.setJob(done());
    await h.api.check();
    await settle();
    assert.deepEqual(h.completed, [7]);
    assert.equal(h.field('[data-sync-running]').hidden, true);
    assert.equal(h.field('[data-sync-result]').hidden, false);
    await h.api.check();
    assert.deepEqual(h.completed, [7]);
    assert.equal(h.field('[data-sync-result]').hidden, false);
});

test('an already completed run on arrival does not create a reload loop', async () => {
    const h = fixture(done());
    await settle();
    assert.equal(h.completed.length, 0);
    assert.match(h.field('[data-sync-last]').textContent, /Last synced/);
    assert.ok(h.buttons.every(button => !button.disabled));
});

test('leaving stops observation, not the source job, and Back reconnects', async () => {
    const h = fixture(run());
    await settle();
    const reads = h.reads.length;
    h.events.pagehide();
    await h.tick();
    assert.equal(h.reads.length, reads);
    h.events.pageshow({persisted: true});
    await settle();
    assert.ok(h.reads.length > reads);
    assert.equal(h.admissions(), 0);
});

test('static prerequisites remain disabled when no sync is active', async () => {
    const h = fixture();
    h.buttons[0].dataset.syncUnavailable = 'true';
    await settle();
    assert.equal(h.buttons[0].disabled, true);
    assert.equal(h.buttons[1].disabled, false);
});

test('a successful read clears a transient status error even for the same terminal job', async () => {
    const h = fixture(done());
    await settle();
    h.failRead(new Error('Connection lost'));
    await assert.rejects(h.api.check(), /Connection lost/);
    assert.equal(h.field('[data-sync-result]').dataset.tone, 'danger');
    h.failRead(null);
    await h.api.check();
    assert.equal(h.field('[data-sync-result]').hidden, true);
    assert.ok(h.buttons.every(button => !button.disabled));
    assert.equal(h.completed.length, 0);
});

test('page-specific completion hooks can attach after the global auto-mount', async () => {
    const h = fixture(run());
    await settle();
    const completed = [];
    const second = h.context.window.SBSyncProgress.create(h.root, {
        onComplete: job => completed.push(job.id),
    });
    assert.equal(second, h.api);
    h.context.window.SBSyncProgress.create(h.root);
    h.setJob(done());
    await h.api.check();
    await settle();
    assert.deepEqual(completed, [7]);
    assert.equal(h.completed.length, 0);
    assert.equal(h.admissions(), 0);
});

test('an uncertain admission reconnects read-only instead of automatically repeating the POST', async () => {
    const h = fixture();
    await settle();
    let starts = 0;
    h.context.window.SBJobs.start = async () => {
        starts++;
        h.setJob(run());
        throw new Error('Response lost after server accepted the request');
    };
    await assert.rejects(h.api.start(), /Response lost/);
    assert.ok(h.buttons.every(button => button.disabled));
    assert.match(h.field('[data-sync-result]').textContent, /Could not confirm/);
    await h.tick();
    assert.equal(h.api.job.id, 7);
    assert.equal(starts, 1);
    assert.equal(h.field('[data-sync-running]').hidden, false);
});

test('a sync that completes before its admission response still updates the page once', async () => {
    const h = fixture();
    await settle();
    h.context.window.SBJobs.start = async () => done();
    await h.api.start();
    await settle();
    assert.deepEqual(h.completed, [7]);
    assert.ok(h.buttons.every(button => !button.disabled));
    assert.equal(h.field('[data-sync-running]').hidden, true);
});
