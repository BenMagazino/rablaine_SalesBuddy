const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const panel = fs.readFileSync(path.join(__dirname, '..', 'templates', 'admin_panel.html'), 'utf8');
const gallery = fs.readFileSync(path.join(__dirname, '..', 'templates', 'admin_favicons.html'), 'utf8');
const helper = panel.slice(panel.indexOf('async function readAdminSync('),
    panel.indexOf("document.addEventListener('DOMContentLoaded'"));
const named = panel.slice(panel.indexOf('function runAdminMilestoneSync()'),
    panel.indexOf('async function backupAllNotes()'));
const fy = panel.slice(panel.indexOf('async function runFYSync('),
    panel.indexOf('function cancelFYTransition()'));
const importHandler = panel.slice(panel.indexOf('const accountsSync ='),
    panel.indexOf('// Setup Wizard chevron rotation'));
const favicon = panel.slice(panel.indexOf('async function _faviconAction('),
    panel.indexOf("document.getElementById('fetchFaviconsBtn').addEventListener"));
const milestoneStatus = panel.slice(panel.indexOf('function loadMilestoneSyncStatus()'),
    panel.indexOf('function toggleMilestoneSync()'));

function stream(text, chunkSize = 7) {
    const bytes = new TextEncoder().encode(text);
    let offset = 0;
    const cleanup = {cancelled: false, released: false};
    return {ok: true, cleanup, body: {getReader() { return {
        async read() {
            if (offset >= bytes.length) return {done: true};
            const value = bytes.slice(offset, offset += chunkSize);
            return {done: false, value};
        },
        async cancel() { cleanup.cancelled = true; },
        releaseLock() { cleanup.released = true; },
    }; }}};
}

function event(type, data, ending = '\n\n') {
    return `${type ? 'event: ' + type + '\n' : ''}data: ${JSON.stringify(data)}${ending}`;
}

function harness(source = helper, fetch = async () => stream('')) {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, {
            disabled: false, innerHTML: '', textContent: '', style: {}, dataset: {},
            classList: {add() {}, remove() {}},
            setAttribute(name, value) { this[name] = value; },
            addEventListener(name, callback) { this[name] = callback; },
            scrollIntoView() {}, querySelector() { return get(id + '-child'); },
        });
        return elements.get(id);
    };
    const calls = [], syncs = [];
    const context = {
        document: {
            getElementById: get, querySelectorAll: () => [get('fetchFaviconsBtn'), get('refreshFaviconsBtn')],
            querySelector: selector => selector,
        },
        window: {addEventListener() {}, removeEventListener() {},
            SBJobs: {message: job => job.message},
            SBSyncProgress: {create(root, handlers) {
                const sync = {root, handlers, starts: 0, start: async () => {
                    sync.starts++;
                    if (context.startError) throw context.startError;
                    return {id: 5, status: 'pending'};
                }};
                syncs.push(sync);
                return sync;
            }}},
        TextDecoder, console, setTimeout() {}, confirm: () => true,
        loadMilestoneSyncStatus() {}, loadSyncStatus() {},
        fetch: async (...args) => { calls.push(args); return fetch(...args); },
        _faviconAction() {},
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return {context, get, calls, syncs};
}

test('admin script remains valid JavaScript after rendering template URLs', () => {
    const script = panel.match(/<script>([\s\S]*?)<\/script>/)[1];
    new vm.Script(script.replace(/\{\{.*?\}\}/g, '/customers'));
});

test('milestone last-run badge correctly parses explicit UTC offsets', async () => {
    const completed = '2026-03-23T15:05:00+00:00';
    const {context, get} = harness(milestoneStatus, async () => ({
        json: async () => ({enabled: true, sync_time: '15:00', last_sync: completed}),
    }));
    context.loadMilestoneSyncStatus();
    await new Promise(setImmediate);
    const label = get('milestoneSyncStatus').innerHTML;
    assert.ok(!label.includes('Invalid Date'));
    assert.ok(label.includes(new Date(completed).toLocaleTimeString()));
    assert.equal(get('milestoneSyncToggle').checked, true);
});

test('admin observer reads split CRLF, accepted and unterminated account terminal frames', async () => {
    const {context} = harness();
    const response = stream((
        event('accepted', {job_id: 17}) +
        event('start', {message: 'Worker started.'}) +
        event('', {message: 'Café accounts', progress: 50}) +
        event('', {complete: true, summary: {customers_created: 2}}, '')
    ).replace(/\n/g, '\r\n'), 1);
    const observed = [];
    const data = await context.readAdminSync(response, (type, value) => observed.push([type, value]), true);
    assert.equal(data.summary.customers_created, 2);
    assert.match(observed[0][1].message, /accepted.*17.*Queued/);
    assert.equal(observed[2][1].message, 'Café accounts');
    assert.deepEqual(response.cleanup, {cancelled: true, released: true});
});

test('admin observer rejects EOF, malformed frames, errors, missing summary and failed terminal', async () => {
    const {context} = harness();
    for (const [text, account, error] of [
        [event('accepted', {job_id: 1}), false, /before completion/],
        ['data: not-json\n\n', false, /JSON|Unexpected/],
        [event('error', {error: 'Not signed in'}), true, /Not signed in/],
        [event('vpn_blocked', {message: 'Connect VPN'}), false, /Connect VPN/],
        [event('complete', {success: false, errors: ['Partial failure']}), false, /Partial failure/],
        [event('complete', {}), false, /Sync failed/],
        [event('', {complete: true}), true, /without a summary/],
    ]) {
        const response = stream(text);
        await assert.rejects(context.readAdminSync(response, () => {}, account), error);
        assert.deepEqual(response.cleanup, {cancelled: true, released: true});
    }
    await assert.rejects(context.readAdminSync({
        ok: false, status: 409, json: async () => ({error: 'Already running'}),
    }, () => {}), /Already running/);
});

test('admin observer cleans up transport and event-handler failures and stops at the terminal', async () => {
    const {context} = harness();
    const broken = stream('');
    broken.body.getReader = () => ({
        read: async () => { throw new Error('Network disconnected'); },
        cancel: async () => { broken.cleanup.cancelled = true; },
        releaseLock: () => { broken.cleanup.released = true; },
    });
    await assert.rejects(context.readAdminSync(broken, () => {}), /Network disconnected/);
    assert.deepEqual(broken.cleanup, {cancelled: true, released: true});
    const callbackFailure = stream(event('progress', {progress: 10}));
    await assert.rejects(context.readAdminSync(callbackFailure, () => {
        throw new Error('Could not save FY status');
    }), /Could not save FY status/);
    assert.deepEqual(callbackFailure.cleanup, {cancelled: true, released: true});
    const terminal = stream(event('complete', {success: true}) +
        event('error', {error: 'Must not overwrite terminal success'}), 1000);
    await context.readAdminSync(terminal, () => {});
    assert.deepEqual(terminal.cleanup, {cancelled: true, released: true});
});

for (const [name, operation] of [['runAdminMilestoneSync', 'milestones'],
    ['runAdminMarketingSync', 'marketing']]) {
    test(`${name} delegates its complete lifecycle to the shared operation observer`, async () => {
        const {context, calls, syncs} = harness(helper + named);
        await context[name]();
        assert.equal(syncs[0].root, `[data-sb-sync-progress="${operation}"]`);
        assert.equal(syncs[0].starts, 1);
        assert.equal(calls.length, 0, 'no legacy SSE admission or duplicate follow-up');
    });
    test(`${name} leaves already-reported admission errors on the shared panel`, async () => {
        const {context, calls, syncs} = harness(helper + named);
        context.startError = new Error('The shared panel reports this error');
        await context[name]();
        assert.equal(syncs[0].starts, 1);
        assert.equal(calls.length, 0);
    });
}

test('normal account import only follows a validated terminal summary with favicons', async () => {
    for (const success of [false, true]) {
        const {context, get, syncs} = harness(helper + importHandler);
        let followups = 0;
        context._faviconAction = () => { followups++; };
        await get('importFromMsxBtn').click.call(get('importFromMsxBtn'));
        assert.equal(followups, 0);
        assert.equal(syncs[0].starts, 1);
        if (success) syncs[0].handlers.onComplete({result: {summary: {customers_created: 2}}});
        else assert.throws(() => syncs[0].handlers.onComplete({result: {}}), /summary/);
        assert.equal(followups, success ? 1 : 0);
        if (success) assert.match(get('msxImportSummary').innerHTML, /Customers: 2 created/);
    }
});

for (const suffix of ['', '2']) {
    test(`FY initial/resume ${suffix || 'initial'} does not save completion on EOF or worker error`, async () => {
        const {context, get, calls} = harness(helper + fy, async () => stream(event('accepted', {job_id: 3})));
        await context.runFYSync(suffix);
        assert.equal(calls.length, 1);
        assert.match(get('fySyncError' + suffix + '-child').textContent, /before completion/);
        assert.equal(get('fySyncSection' + suffix).dataset.syncRunning, 'false');
    });
    test(`FY ${suffix || 'initial'} completion is saved only after a successful terminal account event`, async () => {
        const {context, get, calls} = harness(helper + fy, async url => url.includes('accounts/sync') ?
            stream(event('', {complete: true, summary: {customers_created: 3}})) : {ok: true});
        await context.runFYSync(suffix);
        assert.deepEqual(calls.map(call => call[0]), [
            '/api/msx/accounts/sync', '/api/admin/fy/sync-complete', '/api/admin/fetch-favicons',
        ]);
        assert.match(get('fySyncResults' + suffix).innerHTML, /Customers: 3 created/);
    });
}

test('FY finalization never starts destructive purge after account stream truncation', async () => {
    const {context, calls} = harness(helper + fy, async () => stream(event('accepted', {job_id: 3})));
    await context.finalizeFY();
    assert.deepEqual(calls.map(call => call[0]), ['/api/msx/accounts/sync']);
});

test('FY failed status save prevents Continue and destructive purge despite successful account sync', async () => {
    const admission = async url => url.includes('accounts/sync') ?
        stream(event('', {complete: true, summary: {customers_created: 3}})) : {ok: false};
    const initial = harness(helper + fy, admission);
    await initial.context.runFYSync('');
    assert.match(initial.get('fySyncError-child').textContent, /FY status could not be saved/);
    assert.doesNotMatch(initial.get('fySyncResults').innerHTML, /Continue/);
    const final = harness(helper + fy, admission);
    await final.context.finalizeFY();
    assert.deepEqual(final.calls.map(call => call[0]), [
        '/api/msx/accounts/sync', '/api/admin/fy/sync-complete',
    ]);
});

test('panel favicon actions expose admission/progress and reject accepted-only or failed results', async () => {
    for (const data of [{accepted: true, success: true}, {success: false, error: 'Unavailable'},
        {success: true, message: 'Fetched 3 icons'}]) {
        const {context, get} = harness(favicon, async (url, options) => {
            options.onJobProgress({message: 'Queued behind account sync'});
            assert.equal(get('faviconStatus').textContent, 'Queued behind account sync');
            return {ok: true, json: async () => data};
        });
        await context._faviconAction('/api/admin/fetch-favicons', get('fetchFaviconsBtn'));
        assert.equal(get('fetchFaviconsBtn').disabled, false);
        assert.equal(get('refreshFaviconsBtn').disabled, false);
        assert.equal(get('fetchFaviconsBtn')['aria-busy'], 'false');
        assert.match(get('faviconStatus').textContent, data.accepted || !data.success ?
            /^Favicon sync failed:/ : /Fetched 3 icons/);
    }
});

test('gallery favicon actions use terminal JSON observer and retain busy progress until completion', async () => {
    for (const data of [{accepted: true, success: true},
        {success: false, error: 'Worker failed'}, {success: true, message: 'Fetched 3 icons'}]) {
        let ready;
        const script = gallery.match(/<script>([\s\S]*?)<\/script>/)[1];
        const {context, get} = harness('', async (url, options) => {
            options.onJobProgress({message: 'Queued behind account sync'});
            assert.equal(get('statusAlert').textContent, 'Queued behind account sync');
            return {ok: true, json: async () => data};
        });
        context.document.addEventListener = (name, callback) => { ready = callback; };
        context.document.querySelectorAll = () => [get('fetchMissingBtn'), get('refreshAllBtn')];
        vm.runInContext(script, context);
        ready();
        get('fetchMissingBtn').click.call(get('fetchMissingBtn'));
        await new Promise(resolve => setImmediate(resolve));
        assert.match(get('statusAlert').textContent, !data.success || data.accepted ?
            /Error:/ : /Fetched 3 icons/);
        assert.equal(get('fetchMissingBtn').disabled, false);
        assert.equal(get('refreshAllBtn').disabled, false);
    }
});

test('gallery retains unavailable counts and worker warnings after terminal success without reloading', async () => {
    const result = {
        success: true, fetched: 0, failed: 40, skipped: 0,
        message: 'Refreshed 0 favicons, 40 unavailable.',
        warnings: ['40 unit(s) failed; inspect the result details.'],
    };
    for (const message of [result.message, undefined]) {
        let ready;
        let reloads = 0;
        const timers = [];
        const {context, get} = harness('', async (url, options) => {
            options.onJobProgress({message: 'Accepted, waiting for the worker'});
            assert.equal(get('fetchMissingBtn').disabled, true);
            assert.equal(get('refreshAllBtn').disabled, true);
            return {ok: true, json: async () => ({...result, message})};
        });
        context.document.addEventListener = (name, callback) => { ready = callback; };
        context.document.querySelectorAll = () => [get('fetchMissingBtn'), get('refreshAllBtn')];
        context.setTimeout = callback => { timers.push(callback); };
        context.location = {reload() {
            reloads++;
            get('statusAlert').textContent = '';
        }};
        vm.runInContext(gallery.match(/<script>([\s\S]*?)<\/script>/)[1], context);
        ready();
        get('fetchMissingBtn').click.call(get('fetchMissingBtn'));
        await new Promise(resolve => setImmediate(resolve));
        timers.forEach(callback => callback());
        assert.equal(reloads, 0);
        assert.match(get('statusAlert').textContent, /40 unavailable/);
        assert.match(get('statusAlert').textContent, /40 unit\(s\) failed/);
        assert.match(get('statusAlert').className, /sb-admin-alert-warning/);
        assert.equal(get('fetchMissingBtn').disabled, false);
        assert.equal(get('refreshAllBtn').disabled, false);
        assert.equal(get('fetchMissingBtn')['aria-busy'], 'false');
    }
});
