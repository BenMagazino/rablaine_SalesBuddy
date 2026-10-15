const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'static', 'js', 'ui-jobs.js'), 'utf8');
const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: {'Content-Type': 'application/json'},
});
const receipt = () => json({accepted: true, job_id: 7, status_url: '/api/jobs/7'}, 202);

function observer(responses) {
    const calls = [];
    const window = {
        location: {href: 'http://localhost/', origin: 'http://localhost'},
        fetch: async (url, options) => {
            calls.push({url: url instanceof Request ? url.url : String(url), options});
            assert.ok(responses.length, 'Unexpected request');
            return responses.shift();
        },
    };
    vm.runInNewContext(source, {
        window, URL, Request, Response, DOMException,
        setTimeout: callback => callback(),
    });
    return {window, calls};
}

test('canonical admission returns promptly without polling', async () => {
    const {window, calls} = observer([receipt()]);
    const response = await window.fetch('/api/jobs/start/favicons', {method: 'POST'});
    assert.equal(response.status, 202);
    assert.equal(calls.length, 1);
});

test('operation discovery is read-only and accepts an operation with no runs', async () => {
    const {window, calls} = observer([json({success: true, job: null})]);
    assert.equal(await window.SBJobs.latest('milestones'), null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/jobs/operations/milestones');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.notEqual(calls[0].options.method, 'POST');
});

test('operation discovery rejects wrong identities, statuses and malformed payloads', async () => {
    for (const job of [
        {id: 7, operation: 'revenue', status: 'running'},
        {id: -1, operation: 'milestones', status: 'running'},
        {id: 7, operation: 'milestones', status: 'accepted'},
        {},
    ]) {
        const {window} = observer([json({success: true, job})]);
        await assert.rejects(window.SBJobs.latest('milestones'));
    }
});

test('shared start returns the canonical receipt without waiting or observing an interactive save', async () => {
    const job = {id: 7, operation: 'milestones', status: 'pending'};
    const {window, calls} = observer([json({success: true, accepted: true, job_id: 7, job}, 202)]);
    window.fetch = () => { throw new Error('Must use the captured native fetch'); };
    assert.equal((await window.SBJobs.start('milestones')).id, 7);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/jobs/start/milestones');
    assert.equal(calls[0].options.body, '{}');
});

test('shared start refuses a mismatched or invalid receipt instead of manufacturing success', async () => {
    for (const job of [
        {id: 8, operation: 'milestones', status: 'pending'},
        {id: 7, operation: 'revenue', status: 'pending'},
        {id: 7, operation: 'milestones', status: 'unknown'},
    ]) {
        const {window} = observer([json({accepted: true, job_id: 7, job}, 202)]);
        await assert.rejects(window.SBJobs.start('milestones'));
    }
});

test('a POST Request observes progress and returns the actual terminal result', async () => {
    const {window, calls} = observer([
        receipt(), json({job: {id: 7, status: 'running'}}),
        json({job: {id: 7, status: 'done', result: {refreshed: 5}}}),
    ]);
    const response = await window.fetch(new Request(
        'http://localhost/api/admin/fetch-favicons', {method: 'POST'}));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {success: true, refreshed: 5, job_id: 7});
    assert.equal(calls.length, 3);
});

test('a URL cache miss is re-read after the durable refresh finishes', async () => {
    const {window, calls} = observer([
        receipt(), json({job: {id: 7, status: 'done'}}), json({meetings: ['cached']}),
    ]);
    const response = await window.fetch(new URL('http://localhost/api/meetings?date=2026-04-01'));
    assert.deepEqual(await response.json(), {meetings: ['cached']});
    assert.equal(calls[0].url, calls[2].url);
});

test('domain failure is not converted into a successful legacy response', async () => {
    const {window} = observer([receipt(), json({job: {id: 7, status: 'failed', error: 'VPN'}})]);
    const response = await window.fetch('/api/refresh', {method: 'POST'});
    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);
});

test('aborting observation never requests cancellation of the backend job', async () => {
    const controller = new AbortController();
    controller.abort();
    const {window, calls} = observer([receipt()]);
    await assert.rejects(window.fetch('/api/refresh', {
        method: 'POST', signal: controller.signal,
    }), {name: 'AbortError'});
    assert.equal(calls.length, 1);
});

test('SSE and unrelated accepted responses are passed through', async () => {
    const sse = new Response('event: accepted\n\n', {
        headers: {'Content-Type': 'text/event-stream'},
    });
    const unrelated = json({accepted: true, upload: 1}, 202);
    const {window, calls} = observer([sse, unrelated]);
    assert.equal(await window.fetch('/api/sync'), sse);
    assert.equal(await window.fetch('/api/upload'), unrelated);
    assert.equal(calls.length, 2);
});

test('a forged cross-origin status URL is rejected before requesting it', async () => {
    const {window, calls} = observer([
        json({accepted: true, job_id: 7, status_url: 'https://other.example/api/jobs/7'}, 202),
    ]);
    await assert.rejects(window.fetch('/api/sync'), /invalid job status URL/);
    assert.equal(calls.length, 1);
});

test('JSON callers receive queued and live progress without treating admission as completion',
    async () => {
        const states = [];
        const {window, calls} = observer([
            receipt(), json({job: {id: 7, status: 'pending', state: 'waiting_for_group',
                blocker: {name: 'Accounts', id: 4}}}),
            json({job: {id: 7, status: 'running', progress: {percent: 40, message: 'Fetching'}}}),
            json({job: {id: 7, status: 'done', result: {refreshed: 5}}}),
        ]);
        const response = await window.fetch('/api/refresh', {
            method: 'POST', onJobProgress: job => states.push(window.SBJobs.message(job)),
        });
        assert.deepEqual(states, ['Waiting for Accounts, job 4.', 'Fetching', 'Sync completed.']);
        assert.equal((await response.json()).refreshed, 5);
        assert.equal(calls[0].options.onJobProgress, undefined);
    });

test('existing jobs can be reattached without admitting another sync', async () => {
    const {window, calls} = observer([
        json({job: {id: 7, status: 'running'}}),
        json({job: {id: 7, status: 'done', result: {refreshed: 5}}}),
    ]);
    const job = await window.SBJobs.observe(7);
    assert.equal(job.result.refreshed, 5);
    assert.deepEqual(calls.map(call => call.url), ['/api/jobs/7', '/api/jobs/7']);
    assert.ok(calls.every(call => call.options.method !== 'POST'));
});

test('mismatched job identities and unknown states are observation failures', async () => {
    for (const job of [{id: 8, status: 'done'}, {id: 7, status: 'unknown'}]) {
        const {window} = observer([json({job})]);
        await assert.rejects(window.SBJobs.observe(7), /Could not observe/);
    }
});
