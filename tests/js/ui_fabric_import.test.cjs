const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-import.js'), 'utf8');

async function fixture(statuses, postError = null) {
    const nodes = Object.fromEntries(['import', 'progress', 'import-error'].map(key => [key, {
        disabled: false, hidden: true, textContent: '', events: {}, dataset: {},
        addEventListener(event, handler) { this.events[event] = handler; },
    }]));
    const timers = [];
    const requests = [];
    const errors = [];
    let reloads = 0;
    const context = {
        window: {}, console: {error: (...args) => errors.push(args)},
        setTimeout(callback) { timers.push(callback); return timers.length; },
        clearTimeout() {},
        async fetch(url, options) {
            requests.push({url, method: options.method ?? 'GET'});
            const payload = url === '/import' ?
                (postError ? {success: false, error: postError} : {success: true}) :
                {status: statuses.shift()};
            return {ok: !payload.error, status: payload.error ? 409 : 200,
                json: async () => payload};
        },
    };
    vm.runInNewContext(source, context);
    const controller = context.window.SBFabricImport.create({
        dataset: {statusUrl: '/status', importUrl: '/import'},
        querySelector: selector => nodes[selector.slice(13, -1)],
    }, async () => { reloads++; });
    await new Promise(setImmediate);
    return {nodes, timers, requests, errors, controller, reloads: () => reloads};
}

test('opening a view only checks status, never starts an import or reloads a completed snapshot', async () => {
    const h = await fixture([{state: 'complete', details: null}]);
    assert.deepEqual(h.requests, [{url: '/status', method: 'GET'}]);
    assert.equal(h.reloads(), 0);
    assert.equal(h.nodes.import.disabled, false);
    assert.equal(h.nodes.progress.textContent, 'No successful import yet');
});

test('active imports survive tab navigation and refresh the current view on completion', async () => {
    const h = await fixture([
        {state: 'in_progress', details: 'Pulling capacities'},
        {state: 'complete', details: JSON.stringify({
            phase: 'complete', capacity_row_count: 3, workload_row_count: 9, trend_row_count: 20,
        })},
    ]);
    assert.equal(h.nodes.import.disabled, true);
    assert.equal(h.nodes.progress.textContent, 'Importing: Pulling capacities');
    await h.timers.shift()();
    assert.equal(h.reloads(), 1);
    assert.equal(h.nodes.import.disabled, false);
    assert.equal(h.nodes.progress.textContent, 'No successful import yet');
});

test('running progress includes source percentage and message, but completion remains concise', async () => {
    const h = await fixture([
        {state: 'in_progress', details: JSON.stringify({
            phase: 'customer_totals', progress: 49, message: 'Batch 7/11: querying customer_totals.',
        })},
        {state: 'complete', details: '{"capacity_row_count":233}'},
    ]);
    assert.equal(h.nodes.progress.textContent,
        'Importing: 49% / Batch 7/11: querying customer_totals.');
    assert.equal(h.nodes.progress.title, h.nodes.progress.textContent);
    await h.timers.shift()();
    assert.equal(h.nodes.progress.textContent, 'No successful import yet');
    assert.equal(h.reloads(), 1);
});

test('status shows the successful snapshot date, not counts or failed attempt dates', async () => {
    const h = await fixture([{state: 'failed', details: 'Capacity import failed'}]);
    h.controller.setImportedAt('2026-10-09T22:15:53Z');
    assert.match(h.nodes.progress.textContent, /^Import error \/ Last successful import: /);
    assert.ok(h.nodes.progress.textContent.endsWith(
        new Date('2026-10-09T22:15:53Z').toLocaleDateString()));
    assert.match(h.nodes['import-error'].textContent, /Capacity import failed/);
    assert.throws(() => h.controller.setImportedAt('invalid'), /timestamp is invalid/);
    const completed = await fixture([{state: 'complete', details: '{"capacity_row_count":233}'}]);
    completed.controller.setImportedAt('2026-10-09T22:15:53Z');
    assert.match(completed.nodes.progress.textContent, /^Last successful import:/);
    assert.doesNotMatch(completed.nodes.progress.textContent, /233|capacities|rows|points/);
});

test('running status omits the saved date and selects stable left-aligned presentation', async () => {
    const h = await fixture([{state: 'in_progress', details: JSON.stringify({
        progress: 49, message: 'Querying customer totals',
    })}]);
    h.controller.setImportedAt('2026-10-09T22:15:53Z');
    assert.equal(h.nodes.progress.textContent, 'Importing: 49% / Querying customer totals');
    assert.equal(h.nodes.progress.dataset.running, 'true');
    assert.doesNotMatch(h.nodes.progress.title, /Last successful/);
});

test('a saved snapshot remains imported when no telemetry job-status record exists', async () => {
    const h = await fixture([{state: 'never_run', details: null}]);
    assert.equal(h.nodes.progress.textContent, 'Not imported yet');
    h.controller.setImportedAt('2026-10-10T22:04:00Z');
    assert.equal(h.nodes.progress.textContent,
        `Last successful import: ${new Date('2026-10-10T22:04:00Z').toLocaleDateString()}`);
    assert.equal(h.nodes['import-error'].hidden, true);
    assert.equal(h.reloads(), 0);
    assert.deepEqual(h.requests, [{url: '/status', method: 'GET'}]);
});

test('the shared import command posts once and refreshes the active view after completion', async () => {
    const h = await fixture([
        {state: 'never_run', details: null},
        {state: 'complete', details: null},
    ]);
    await h.nodes.import.events.click();
    assert.equal(h.nodes.import.disabled, true);
    assert.deepEqual(h.requests.at(-1), {url: '/import', method: 'POST'});
    await h.timers.shift()();
    assert.equal(h.reloads(), 1);
});

test('rejected commands and malformed progress are explicit, not successful-looking fallbacks', async () => {
    const h = await fixture([{state: 'complete', details: null}], 'Already importing');
    await h.nodes.import.events.click();
    assert.equal(h.nodes['import-error'].hidden, false);
    assert.match(h.nodes['import-error'].textContent, /Already importing/);
    assert.equal(h.nodes.import.disabled, false);
    assert.equal(h.reloads(), 0);
    const malformed = await fixture([{state: 'in_progress', details: '{broken'}]);
    assert.equal(malformed.errors.length, 1);
    assert.match(malformed.nodes['import-error'].textContent, /Could not check import status/);
});
