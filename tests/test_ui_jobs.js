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
