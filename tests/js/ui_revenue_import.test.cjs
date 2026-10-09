const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-import.js'), 'utf8');
const result = {
    bucket_rows: 32851, product_rows: 285747, months: 27, customers_with_data: 20,
    customers: 25, linked_pct: 96.5, duration_s: 14.8, review_kept: 3, review_retired: 2,
    taxonomy: {status: 'unchanged'},
};
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const reply = data => ({ok: true, json: async () => data});

function fixture(options = {}) {
    class Element {
        constructor(text = '') {
            this.textContent = text; this.dataset = {}; this.hidden = false;
            this.children = []; this.handlers = {}; this.attributes = {};
        }
        setAttribute(key, value) { this.attributes[key] = String(value); }
        removeAttribute(key) { delete this.attributes[key]; }
        appendChild(child) { this.children.push(child); return child; }
        replaceChildren(...children) { this.children = children; this.textContent = ''; }
        addEventListener(type, fn) { this.handlers[type] = fn; }
        fire(type) { return this.handlers[type](); }
    }
    const elements = {}, errors = [], requests = [], filterCalls = [], rail = new Element();
    for (const name of ['#syncBtn', '#syncProgress', '#syncBar', '#syncText', '#syncResults',
        '#syncLastRun', '[data-sb-import-refresh]', '[data-sb-import-check]', '#bucketNotice',
        '[data-sb-import-notice-body]', '[data-sb-import-notice-error]', '[data-sb-import-dismiss]',
        '#revImportBrainrotCheck', '[data-sb-import-brainrot-error]']) elements[name] = new Element();
    for (const name of ['#syncProgress', '#syncResults', '#bucketNotice',
        '[data-sb-import-notice-error]', '[data-sb-import-brainrot-error]']) elements[name].hidden = true;
    if (options.picker) {
        for (const name of ['#bucketPickerCard', '#bucketPickerList',
            '[data-sb-import-bucket-status]', '[data-sb-import-bucket-retry]',
            '[data-sb-import-bucket-count]']) elements[name] = new Element();
        elements['#bucketPickerCard'].hidden = !!options.empty;
    }
    const root = {dataset: {syncUrl: '/api/revenue/sync', statusUrl: '/api/revenue/sync/status',
        noticeUrl: '/api/revenue/bucket-notice', embedded: String(!!options.embedded)},
        querySelector: selector => elements[selector] || null};
    const context = {
        window: {}, document: {querySelector: selector => selector === '[data-sb-import]' ? null : rail,
            createElement: () => new Element()},
        console: {error: (...args) => errors.push(args)}, TextDecoder,
        localStorage: {getItem: () => {
            if (options.storageError) throw new Error('Storage blocked');
            return '0';
        }},
        RevenueBucketFilter: {
            getSelected: () => ['Fabric', 'Databases'],
            init: async value => { filterCalls.push(value); value.onFilterChange(); },
        },
        fetch: async (url, init) => {
            requests.push({url, init});
            if (options.fetch) return options.fetch(url, init);
            if (url.endsWith('/status')) return reply({
                status: {state: options.state || 'never_run', completed_at: options.completedAt},
                bucket_notice: options.notice ?? null,
            });
            if (url.endsWith('/buckets')) return reply(['Fabric', 'Databases']);
            return reply({success: true});
        },
    };
    vm.createContext(context); vm.runInContext(source, context);
    const api = context.window.SBRevenueImport;
    const controller = options.mount ? api.create(root) : null;
    return {api, controller, root, elements, rail, errors, requests, filterCalls, context};
}

function stream(text, chunkSize = 1, headers = 'text/event-stream; charset=utf-8') {
    const bytes = new TextEncoder().encode(text);
    let offset = 0;
    return new Response(new ReadableStream({
        pull(controller) {
            if (offset >= bytes.length) { controller.close(); return; }
            controller.enqueue(bytes.slice(offset, offset + chunkSize)); offset += chunkSize;
        },
    }), {headers: {'Content-Type': headers}});
}
const terminal = value => 'event: complete\ndata: ' + JSON.stringify(value) + '\n\n';

test('stream parser handles every UTF-8 boundary, CRLF, comments and multiline JSON', async () => {
    const h = fixture(), updates = [];
    const value = await h.api.consume(stream(
        ': heartbeat\r\nevent:start\r\ndata: {"message":\r\ndata: "Sync ✅"}\r\n\r\n' +
        'event: progress\ndata: {"progress":33.5,"message":"Pulling"}\n\n' + terminal(result),
    ), update => updates.push(update));
    assert.deepEqual(JSON.parse(JSON.stringify(value)), result);
    assert.equal(updates[0].message, 'Sync ✅');
    assert.equal(updates[1].progress, 33.5);
});

test('terminal event at EOF is accepted without falsely accepting a truncated stream', async () => {
    const h = fixture();
    assert.equal((await h.api.consume(stream(terminal(result).trimEnd()), () => {})).months, 27);
    await assert.rejects(h.api.consume(stream('event: progress\ndata: {"progress":100}\n\n'),
        () => {}), /without a sync result/);
});

test('stream errors never turn into completion', async t => {
    const h = fixture();
    for (const [text, message] of [
        ['event: error\ndata: {"error":"VPN disconnected"}\n\n', /VPN disconnected/],
        ['event: progress\ndata: malformed\n\n', /JSON|Unexpected/],
        ['event: complete\ndata: []\n\n', /Invalid sync event/],
        ['event: surprise\ndata: {}\n\n', /Unexpected sync event/],
        ['event: progress\ndata: null\n\n', /Invalid sync event/],
    ]) await t.test(text.split('\n')[0] + message, async () => {
        await assert.rejects(h.api.consume(stream(text), () => {}), message);
    });
});

test('HTTP failures, wrong content and missing bodies are explicit', async () => {
    const h = fixture();
    await assert.rejects(h.api.consume(new Response('{"error":"Import accounts first"}', {
        status: 400, headers: {'Content-Type': 'application/json'},
    }), () => {}), /Import accounts first.*400/);
    await assert.rejects(h.api.consume(new Response('Down', {status: 503}), () => {}), /503/);
    await assert.rejects(h.api.consume(stream('{}', 5, 'text/html'), () => {}), /not an event stream/);
    await assert.rejects(h.api.consume(new Response(null, {
        headers: {'Content-Type': 'text/event-stream'},
    }), () => {}), /not an event stream/);
});

test('invalid completion metrics cannot render success or silently manufacture zeroes', () => {
    const h = fixture();
    for (const key of ['bucket_rows', 'product_rows', 'months', 'customers_with_data',
        'customers', 'linked_pct', 'duration_s']) {
        for (const value of [undefined, null, '2', -1, NaN, Infinity]) {
            assert.throws(() => h.api.validateResult({...result, [key]: value}), /Invalid sync/);
        }
    }
    assert.throws(() => h.api.validateResult({...result, months: 1.5}), /Invalid sync/);
    assert.throws(() => h.api.validateResult({...result, linked_pct: 101}), /coverage/);
    assert.throws(() => h.api.validateResult({...result, customers_with_data: 26}), /coverage/);
    assert.throws(() => h.api.validateResult({...result, review_kept: '3'}), /review/);
    h.api.validateResult({...result, bucket_rows: 0, product_rows: 0, months: 0,
        customers_with_data: 0, customers: 0, linked_pct: 0, duration_s: 0});
});

test('sync uses the original empty payload, guards repeated clicks and renders all metrics', async () => {
    let resolve;
    const h = fixture({mount: true, picker: true, empty: true, fetch: (url, init) =>
        init?.method === 'POST' ? new Promise(done => { resolve = done; }) :
            Promise.resolve(reply(url.endsWith('/status') ?
                {status: {state: 'incomplete'}} : ['Fabric', 'Databases']))});
    await settle();
    assert.equal(h.requests.length, 1);
    const sync = h.controller.sync();
    await h.controller.sync();
    assert.equal(h.elements['#syncBtn'].disabled, true);
    assert.equal(h.elements['#syncProgress'].hidden, false);
    const request = h.requests.find(row => row.init?.method === 'POST');
    assert.equal(request.init.headers.Accept, 'text/event-stream');
    assert.equal(request.init.body, '{}');
    resolve(stream(terminal(result), 64)); await sync;
    assert.equal(h.elements['#syncBtn'].disabled, false);
    assert.equal(h.elements['#syncProgress'].hidden, true);
    assert.equal(h.elements['#syncResults'].dataset.tone, 'positive');
    assert.equal(h.elements['[data-sb-import-refresh]'].hidden, false);
    assert.equal(h.elements['#bucketPickerCard'].hidden, false);
    assert.equal(h.elements['#bucketNotice'].hidden, true);
    const text = h.elements['#syncResults'].children[1].children.map(child => child.textContent).join(' ');
    for (const value of ['32,851', '285,747', '27 months', '20 of 25', '96.5%', '14.8s',
        '3 review notes kept; 2 retired']) assert.ok(text.includes(value), text);
    assert.doesNotMatch(source, /innerHTML|bootstrap|data-bs-/);
});

test('bad progress, invalid result and lost connection restore controls and keep failure visible', async () => {
    for (const body of [
        'event: progress\ndata: {"progress":101}\n\n',
        terminal({...result, product_rows: undefined}),
        'event: progress\ndata: {"message":"Pulling"}\n\n',
        terminal({...result, taxonomy: {status: 'bad'}}),
    ]) {
        const h = fixture({mount: true, fetch: async (url, init) => init?.method === 'POST' ?
            stream(body, 20) : reply({status: {state: 'never_run'}})});
        await settle(); await h.controller.sync();
        assert.equal(h.elements['#syncBtn'].disabled, false);
        assert.equal(h.elements['#syncResults'].dataset.tone, 'danger');
        assert.equal(h.elements['[data-sb-import-refresh]'].hidden, true);
        assert.ok(h.elements['#syncResults'].textContent.includes('Check status'));
        assert.ok(h.errors.length);
    }
});

test('all status states are truthful and malformed completed timestamps stay retryable', async () => {
    for (const [state, expected] of [
        ['never_run', 'No completed'], ['incomplete', 'incomplete'], ['failed', 'failed'],
        ['in_progress', 'in progress'], ['complete', 'Last synced'],
    ]) {
        const h = fixture({mount: true, state, completedAt: 'Mon, 05 Oct 2026 18:16:15 GMT'});
        await settle();
        assert.ok(h.elements['#syncLastRun'].textContent.includes(expected));
        assert.equal(h.elements['[data-sb-import-check]'].disabled, false);
    }
    const h = fixture({mount: true, state: 'complete', completedAt: null});
    await settle();
    assert.equal(h.elements['#syncLastRun'].dataset.tone, 'danger');
    assert.ok(h.elements['#syncLastRun'].textContent.includes('Invalid completed'));
    h.context.fetch = async () => reply({status: {state: 'incomplete'}});
    await h.controller.status();
    assert.equal(h.elements['#syncLastRun'].textContent, 'Previous sync incomplete');
    assert.equal(h.elements['#syncLastRun'].dataset.tone, undefined);
});

test('first-import and unchanged results have no notice; review/reset names remain literal', async () => {
    for (const state of ['first_import', 'unchanged', 'review', 'reset']) {
        const h = fixture({mount: true, notice: {status: state,
            added: ['<script>literal</script>'], removed: ['Old'], missing_selected: ['Old']}});
        await settle();
        assert.equal(h.elements['#bucketNotice'].hidden, ['first_import', 'unchanged'].includes(state));
        if (!h.elements['#bucketNotice'].hidden) {
            assert.ok(h.elements['[data-sb-import-notice-body]'].children
                .some(child => child.textContent.includes('<script>literal</script>')));
        }
    }
});

test('notice remains until confirmed DELETE and failed dismissal can be retried', async () => {
    let reject, resolve;
    const h = fixture({mount: true, fetch: (url, init) => init?.method === 'DELETE' ?
        new Promise((done, fail) => { resolve = done; reject = fail; }) :
        Promise.resolve(reply({status: {state: 'never_run'}, bucket_notice: {status: 'review'}}))});
    await settle();
    let pending = h.elements['[data-sb-import-dismiss]'].fire('click');
    assert.equal(h.elements['#bucketNotice'].hidden, false);
    reject(new Error('Offline')); await pending;
    assert.equal(h.elements['#bucketNotice'].hidden, false);
    assert.equal(h.elements['[data-sb-import-notice-error]'].hidden, false);
    pending = h.elements['[data-sb-import-dismiss]'].fire('click');
    resolve(reply({success: false})); await pending;
    assert.equal(h.elements['#bucketNotice'].hidden, false);
    pending = h.elements['[data-sb-import-dismiss]'].fire('click');
    resolve(reply({success: true})); await pending;
    assert.equal(h.elements['#bucketNotice'].hidden, true);
});

test('bucket writes are serialized and coalesced, preserving plain array semantics', async () => {
    const writes = [];
    const h = fixture({mount: true, picker: true, fetch: async (url, init) => {
        if (init?.method === 'POST') return new Promise((resolve, reject) => writes.push({
            resolve, reject, value: JSON.parse(init.body),
        }));
        return reply(url.endsWith('/status') ? {status: {state: 'never_run'}} : ['Fabric']);
    }});
    await settle();
    assert.equal(h.filterCalls.length, 1);
    assert.equal(writes.length, 0);
    const pending = h.controller.saveBuckets(['Fabric']);
    await h.controller.saveBuckets(['Databases']);
    await h.controller.saveBuckets([]);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].value, ['Fabric']);
    writes[0].resolve(reply({success: true})); await settle();
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1].value, []);
    writes[1].resolve(reply({success: true})); await pending;
    assert.match(h.elements['[data-sb-import-bucket-status]'].textContent, /Showing every bucket/);
});

test('failed bucket save stays explicit and Retry sends only the latest selection', async () => {
    let attempt = 0;
    const h = fixture({mount: true, picker: true, fetch: async (url, init) => {
        if (init?.method === 'POST') return ++attempt === 1 ? {ok: false, status: 503} : reply({success: true});
        return reply(url.endsWith('/status') ? {status: {state: 'never_run'}} : ['Fabric']);
    }});
    await settle(); await h.controller.saveBuckets(['Fabric']);
    assert.match(h.elements['[data-sb-import-bucket-status]'].textContent, /applies locally.*not confirmed.*503/);
    assert.equal(h.elements['[data-sb-import-bucket-retry]'].hidden, false);
    await h.elements['[data-sb-import-bucket-retry]'].fire('click');
    assert.equal(h.elements['[data-sb-import-bucket-retry]'].hidden, true);
    assert.equal(h.requests.filter(row => row.init?.method === 'POST').length, 2);
});

test('failed bucket reads disable stale choices and Retry restores the shared inline host', async () => {
    let failure = true;
    const h = fixture({mount: true, picker: true, fetch: async url => url.endsWith('/status') ?
        reply({status: {state: 'never_run'}}) : failure ? {ok: false, status: 503} : reply(['Fabric'])});
    await settle();
    assert.equal(h.elements['#bucketPickerList'].inert, true);
    assert.equal(h.elements['[data-sb-import-bucket-retry]'].hidden, false);
    failure = false; await h.elements['[data-sb-import-bucket-retry]'].fire('click');
    assert.equal(h.elements['#bucketPickerList'].inert, false);
    assert.equal(h.filterCalls[0].inline, true);
    assert.equal(h.elements['[data-sb-import-bucket-count]'].textContent, '2 selected');
    assert.equal(h.requests.some(row => row.init?.method === 'POST'), false);
});

test('DSS does not read bucket endpoints; embeds do not write parent shell status', async () => {
    const h = fixture({mount: true, embedded: true});
    await settle();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, '/api/revenue/sync/status');
    assert.equal(h.rail.textContent, '');
    assert.equal(h.context.window.showBucketPicker, undefined);
});

test('brainrot uses the existing bridge, never opens media during hydration and reports storage errors', async () => {
    const h = fixture({mount: true, storageError: true}), calls = [];
    h.context.window.setBrainrot = enabled => calls.push(enabled);
    h.context.window.showBrainrotPanel = () => calls.push('show');
    h.context.window.hideBrainrotPanel = () => calls.push('hide');
    await settle();
    assert.deepEqual(calls, []);
    assert.equal(h.elements['[data-sb-import-brainrot-error]'].hidden, false);
    assert.equal(h.elements['#syncLastRun'].textContent, 'No completed sync yet');
    h.elements['#revImportBrainrotCheck'].checked = true;
    h.elements['#revImportBrainrotCheck'].fire('change');
    assert.deepEqual(calls, [true, 'show']);
    assert.equal(h.elements['[data-sb-import-brainrot-error]'].hidden, true);
});

test('late status reads cannot erase a newer completion or resurrect a dismissed notice', async () => {
    const reads = [];
    const h = fixture({mount: true, fetch: (url, init) => init?.method === 'DELETE' ?
        Promise.resolve(reply({success: true})) : new Promise(resolve => reads.push(resolve))});
    h.controller.completed({...result, taxonomy: {status: 'reset', missing_selected: ['Old']}});
    reads[0](reply({status: {state: 'incomplete'}, bucket_notice: null})); await settle();
    assert.equal(h.elements['#syncLastRun'].textContent, 'Last sync completed just now');
    assert.equal(h.elements['#bucketNotice'].hidden, false);
    assert.equal(h.elements['[data-sb-import-check]'].disabled, false);
    const pending = h.controller.status();
    await h.elements['[data-sb-import-dismiss]'].fire('click');
    reads[1](reply({status: {state: 'incomplete'}, bucket_notice: {status: 'review'}}));
    await pending;
    assert.equal(h.elements['#bucketNotice'].hidden, true);
});

test('bucket refresh failure cannot relabel a completed server sync as failed', async () => {
    const h = fixture({mount: true, picker: true, empty: true, fetch: async (url, init) =>
        init?.method === 'POST' ? stream(terminal(result), 100) :
            url.endsWith('/status') ? reply({status: {state: 'never_run'}}) : {ok: false, status: 503}});
    await settle(); await h.controller.sync();
    assert.equal(h.elements['#syncResults'].dataset.tone, 'positive');
    assert.equal(h.elements['[data-sb-import-bucket-status]'].dataset.tone, 'danger');
    assert.equal(h.elements['[data-sb-import-refresh]'].hidden, false);
});
