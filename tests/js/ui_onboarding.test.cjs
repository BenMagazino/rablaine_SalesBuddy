const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness({autoOpen = false, imported = true, authenticated = true} = {}) {
    const records = new Map(), requests = [], handlers = {}, saved = [];
    let responder = async url => url === '/api/msx/status'
        ? {authenticated} : url === '/api/revenue/buckets' ? [] : {success: true};
    class Element {
        constructor(id) {
            this.id = id; this.handlers = {}; this.dataset = {};
            this.style = {}; this.attributes = {}; this.classes = new Set();
            this.open = false; this.disabled = false; this.value = '';
            this.classList = {
                add: value => this.classes.add(value),
                remove: value => this.classes.delete(value),
                toggle: (value, state) => state ? this.classes.add(value) : this.classes.delete(value),
            };
            records.set(id, this);
        }
        addEventListener(type, handler) { this.handlers[type] = handler; }
        async fire(type, props = {}) {
            const event = {...props, preventDefault() { this.prevented = true; }};
            await this.handlers[type]?.call(this, event); return event;
        }
        getAttribute(name) { return this.attributes[name]; }
        setAttribute(name, value) { this.attributes[name] = value; }
        blur() {}
    }
    const get = id => records.get(id) || new Element(id);
    const root = get('root'); root.attributes['data-sb-mode'] = 'dark';
    const dialog = get('welcomeModal'); dialog.dataset.sbAutoOpen = String(autoOpen);
    const document = {documentElement: root, getElementById: get,
        querySelectorAll: selector => selector === '.onboarding-step'
            ? [get('onboardingStep1'), get('onboardingStep2')] : []};
    const window = {
        addEventListener: (type, fn) => { handlers[type] = fn; }, removeEventListener() {},
        location: {reload() { window.reloaded = true; }},
        SBDialog: {
            open(element) { element.open = true; },
            close(element, reason) {
                const event = {detail: {reason}, preventDefault() { this.prevented = true; }};
                element.handlers['sb:dialog-before-close']?.(event);
                if (!event.prevented) element.open = false;
            },
        },
    };
    const source = fs.readFileSync('templates/partials/_onboarding_js.html', 'utf8')
        .split('<script>')[1].split('</script>')[0]
        .replace(/\{\{[\s\S]*?\}\}/g, expression => {
            if (/accounts_synced|has_milestones|has_revenue/.test(expression)) return String(imported);
            if (/user_role/.test(expression)) return 'se';
            return '';
        });
    vm.runInNewContext(source, {
        window, document, console, TextDecoder,
        fetch: async (url, options = {}) => {
            requests.push({url, method: options.method || 'GET', body: options.body});
            const data = await responder(url, options);
            if (data?.headers && data?.body) return data;
            return {ok: true, json: async () => data};
        },
        localStorage: {getItem: () => null, setItem: (key, value) => saved.push({key, value})},
        setTimeout() {}, setInterval() {}, clearInterval() {},
    });
    handlers.load();
    return {window, records, get, dialog, requests, saved,
        responder: fn => { responder = fn; }};
}

test('completed users do not auto-open setup or send any request on page load', () => {
    const h = harness();
    assert.equal(h.dialog.open, false);
    assert.equal(typeof h.window.openSetupWizard, 'function');
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.saved, []);
});

test('review reopens actual completed progress using GETs only and closes without preference writes', async () => {
    const h = harness(); await h.window.openSetupWizard();
    assert.equal(h.dialog.open, true);
    assert.equal(h.get('onboardingStepBadge').textContent, 'Step 2 of 2');
    for (const phase of ['Accounts', 'Milestones', 'Revenue'])
        assert.equal(h.get(`phase${phase}Status`).textContent, 'Already imported');
    assert.deepEqual(h.requests.map(request => request.method), ['GET', 'GET']);
    assert.equal(h.get('onboardNextBtn').disabled, false);
    await h.get('setupReviewClose').fire('click');
    assert.equal(h.dialog.open, false);
    assert.deepEqual(h.saved, []);
    assert.equal(h.window.reloaded, undefined);
});

test('first-run auto-opens mandatory sign-in without automatically signing in or importing', () => {
    const h = harness({autoOpen: true, imported: false});
    assert.equal(h.dialog.open, true);
    assert.equal(h.get('onboardingStepBadge').textContent, 'Step 1 of 2');
    assert.equal(h.get('onboardNextBtn').disabled, true);
    h.window.SBDialog.close(h.dialog, 'escape');
    assert.equal(h.dialog.open, true);
    assert.deepEqual(h.requests, []);
});

test('reopening review refreshes auth presentation rather than retaining an expired success', async () => {
    const h = harness(); await h.window.openSetupWizard();
    await h.get('setupReviewClose').fire('click');
    h.responder(async url => url === '/api/msx/status' ? {authenticated: false} : []);
    await h.window.openSetupWizard();
    assert.equal(h.get('onboardingStepBadge').textContent, 'Step 1 of 2');
    assert.equal(h.get('signInInitial').classes.has('sb-setup-hidden'), false);
    assert.equal(h.get('signInSuccess').classes.has('sb-setup-hidden'), true);
    assert.ok(h.requests.every(request => request.method === 'GET'));
});

test('review handles a failed status read without POSTs and still allows closing', async () => {
    const h = harness();
    h.responder(async url => {
        if (url === '/api/msx/status') throw new Error('Read unavailable');
        return [];
    });
    await h.window.openSetupWizard();
    assert.equal(h.dialog.open, true);
    assert.equal(h.get('onboardingStepBadge').textContent, 'Step 1 of 2');
    assert.equal(h.get('onboardNextBtn').disabled, false);
    assert.ok(h.requests.every(request => request.method === 'GET'));
    await h.get('onboardNextBtn').fire('click');
    assert.equal(h.get('onboardingStepBadge').textContent, 'Step 2 of 2');
    await h.get('onboardNextBtn').fire('click');
    assert.equal(h.dialog.open, false);
});

test('sign-in writes are made only after the existing human sign-in button is selected', async () => {
    const h = harness({imported: false});
    await h.window.openSetupWizard();
    assert.deepEqual(h.requests, []);
    h.responder(async url => url === '/api/msx/az-login/start'
        ? {error: 'Azure CLI not installed'} : {success: true});
    await h.get('startSignInBtn').fire('click');
    assert.deepEqual(h.requests.map(request => [request.url, request.method]),
        [['/api/msx/az-logout', 'POST'], ['/api/msx/az-login/start', 'POST']]);
    assert.equal(h.get('signInNoCli').classes.has('sb-setup-hidden'), false);
    assert.equal(h.get('onboardNextBtn').disabled, false);
});

test('an active sign-in guards review closing and navigation until its error resolves', async () => {
    const h = harness({imported: false}); await h.window.openSetupWizard();
    let finish;
    h.responder(url => url === '/api/msx/az-logout'
        ? new Promise(resolve => { finish = resolve; })
        : {error: 'Azure CLI not installed'});
    const pending = h.get('startSignInBtn').fire('click');
    assert.equal(h.get('onboardNextBtn').disabled, true);
    await h.get('setupReviewClose').fire('click');
    assert.equal(h.dialog.open, true);
    assert.match(h.get('setupReviewStatus').textContent, /active sign-in or import/);
    finish({success: true}); await pending;
    assert.equal(h.get('onboardNextBtn').disabled, false);
    await h.get('setupReviewClose').fire('click');
    assert.equal(h.dialog.open, false);
});

function streamResponse(chunks, beforeRead = () => {}) {
    const cleanup = {cancelled: 0, released: 0};
    let index = 0;
    const reader = {
        async read() {
            beforeRead(index);
            if (index === chunks.length) return {done: true};
            const chunk = chunks[index++];
            if (chunk instanceof Error) throw chunk;
            return {done: false, value: new TextEncoder().encode(chunk)};
        },
        async cancel() { cleanup.cancelled++; },
        releaseLock() { cleanup.released++; },
    };
    return {ok: true, status: 200, headers: new Headers({'Content-Type': 'text/event-stream'}),
        body: {getReader: () => reader}, cleanup};
}

function event(type, data) {
    return `${type ? `event: ${type}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
}

const phaseCases = [
    {name: 'Accounts', endpoint: '/api/msx/accounts/sync', button: 'phaseAccountsRetry',
        terminal: {complete: true, summary: {customers_created: 3, duration: 2}}},
    {name: 'Milestones', endpoint: '/api/milestone-tracker/sync', button: 'phaseMilestonesRetry',
        terminal: {success: true, synced: 3, created: 4, duration: 2}},
    {name: 'Revenue', endpoint: '/api/revenue/sync', button: 'phaseRevenueRetry',
        terminal: {success: true, customers_with_data: 3, customers: 5, months: 6, duration_s: 2}},
];

for (const phase of phaseCases) {
    test(`${phase.name}: admission, queue, domain progress and terminal preserve setup results`, async () => {
        const h = harness({imported: phase.name !== 'Accounts'});
        const observed = [];
        const frames = [
            event('accepted', {job_id: 42}),
            event('queued', {message: 'Waiting for another sync'}),
            event('start', {message: 'Worker started', total: 5}),
            event('progress', {message: 'Fetching records', customer: 'Fetching records',
                progress: 40, current: 2, total: 5}),
            event(phase.name === 'Accounts' ? '' : 'complete', phase.terminal),
        ];
        // Split across data, event and CRLF boundaries, not just whole SSE frames.
        const wire = frames.join('').replace(/\n/g, '\r\n');
        const response = streamResponse([...wire].map(char => char), () => {
            observed.push(h.get(`phase${phase.name}Status`).textContent);
        });
        h.responder(async url => {
            if (url === phase.endpoint) return response;
            if (url === '/api/milestone-tracker/sync' || url === '/api/revenue/sync') {
                return streamResponse([event('complete', {success: true})]);
            }
            if (url === '/api/revenue/buckets') return [];
            return {success: true};
        });
        await h.get(phase.button).fire('click');
        assert.ok(observed.includes('Sync accepted, waiting for worker...'));
        assert.ok(observed.includes('Waiting for another sync'));
        assert.ok(observed.includes('Worker started'));
        assert.ok(observed.includes('Fetching records'));
        assert.equal(h.get(`phase${phase.name}Bar`).style.width, '40%');
        assert.equal(h.get(`phase${phase.name}Status`).textContent, 'Done in 2s');
        assert.match(h.get(`phase${phase.name}Summary`).innerHTML, /3/);
        assert.deepEqual(response.cleanup, {cancelled: 1, released: 1});
        assert.ok(!h.requests.some(request => request.url === '/api/msx/sync-marketing'));
        if (phase.name === 'Accounts') {
            assert.equal(h.requests.filter(request =>
                request.url === '/api/admin/fetch-favicons').length, 1);
            assert.ok(h.requests.find(request => request.url === '/api/preferences/match-seller'));
            assert.deepEqual(h.requests.filter(request => phaseCases.some(p =>
                p.endpoint === request.url)).map(request => request.url),
            phaseCases.map(p => p.endpoint));
        }
    });

    for (const failure of [
        {name: 'truncated stream', chunks: [event('accepted', {job_id: 42}),
            event('progress', {progress: 100, message: 'Saving'}), 'event: complete\ndata: {"success":'],
            message: /JSON/},
        {name: 'EOF without terminal', chunks: [event('accepted', {job_id: 42})],
            message: /before completion/},
        {name: 'terminal error', chunks: [event('error', {message: 'Worker failed'})],
            message: /Worker failed/},
        {name: 'unsuccessful completion', chunks: [event('complete',
            {success: false, message: 'Partial import'})], message: /Partial import/},
        {name: 'unconfirmed completion', chunks: [event('complete', {})],
            message: /could not be confirmed/},
        {name: 'network failure', chunks: [new Error('Connection lost')], message: /Connection lost/},
    ]) {
        test(`${phase.name}: ${failure.name} cannot finish setup or admit follow-ups`, async () => {
            const h = harness({imported: false});
            const response = streamResponse(failure.chunks);
            h.responder(async url => url === phase.endpoint ? response : {success: true});
            await h.get(phase.button).fire('click');
            assert.match(h.get(`phase${phase.name}Status`).textContent, failure.message);
            assert.equal(h.get(`phase${phase.name}Status`).classes.has('sb-setup-danger'), true);
            assert.equal(h.get(`phase${phase.name}Summary`).innerHTML, '');
            assert.deepEqual(response.cleanup, {cancelled: 1, released: 1});
            assert.ok(!h.requests.some(request => ['/api/admin/fetch-favicons',
                '/api/preferences/match-seller', '/api/msx/sync-marketing'].includes(request.url)));
            if (phase.name === 'Accounts') {
                assert.ok(!h.requests.some(request => phaseCases.slice(1)
                    .some(p => p.endpoint === request.url)));
            }
        });
    }

    test(`${phase.name}: resolved JSON job result works without parsing an SSE body`, async () => {
        const h = harness({imported: false});
        const result = {success: true, ...phase.terminal};
        h.window.SBJobs = {message: job => job.progress.message};
        h.responder(async (url, options) => {
            if (url === phase.endpoint) {
                options.onJobProgress({status: 'running',
                    progress: {percent: 35, message: 'Observer progress'}});
                assert.equal(h.get(`phase${phase.name}Bar`).style.width, '35%');
                assert.equal(h.get(`phase${phase.name}Status`).textContent, 'Observer progress');
                return new Response(JSON.stringify(result),
                    {headers: {'Content-Type': 'application/json'}});
            }
            if (phaseCases.some(p => p.endpoint === url)) {
                return streamResponse([event('complete', {success: true})]);
            }
            return url === '/api/revenue/buckets' ? [] : {success: true};
        });
        await h.get(phase.button).fire('click');
        assert.equal(h.get(`phase${phase.name}Status`).textContent, 'Done in 2s');
    });

    test(`${phase.name}: unresolved JSON admission is not a successful import`, async () => {
        const h = harness({autoOpen: true, imported: false});
        h.responder(async url => url === phase.endpoint
            ? new Response(JSON.stringify({accepted: true, job_id: 42}), {
                status: 202, headers: {'Content-Type': 'application/json'},
            }) : {success: true});
        await h.get(phase.button).fire('click');
        assert.match(h.get(`phase${phase.name}Status`).textContent, /completion could not be confirmed/);
        assert.equal(h.get('onboardNextBtn').disabled, true);
    });
}

test('milestone customer errors stay progress while a successful terminal reports partial counts', async () => {
    const h = harness();
    const response = streamResponse([
        event('progress', {current: 1, total: 2, customer: 'Account A', status: 'error',
            error: 'Customer unavailable'}),
        event('complete', {success: true, synced: 1, failed: 1}),
    ]);
    h.responder(async url => url === '/api/milestone-tracker/sync' ? response : {success: true});
    await h.get('phaseMilestonesRetry').fire('click');
    assert.equal(h.get('phaseMilestonesStatus').textContent, 'Done');
    assert.match(h.get('phaseMilestonesSummary').innerHTML, /1 failed/);
});

test('revenue accepts a fully decoded final terminal frame at EOF', async () => {
    const h = harness();
    const response = streamResponse(['event: complete\ndata: {"success":true,"months":12}']);
    h.responder(async url => url === '/api/revenue/sync' ? response : []);
    await h.get('phaseRevenueRetry').fire('click');
    assert.equal(h.get('phaseRevenueStatus').textContent, 'Done');
    assert.match(h.get('phaseRevenueSummary').innerHTML, /12 months/);
    assert.deepEqual(response.cleanup, {cancelled: 1, released: 1});
});

test('VPN terminal errors show the existing VPN banner and free the reader', async () => {
    const h = harness();
    let banners = 0;
    h.window.showVpnBanner = () => { banners++; };
    const response = streamResponse([event('vpn_blocked', {message: 'Connect to VPN'})]);
    h.responder(async url => url === '/api/milestone-tracker/sync' ? response : {success: true});
    await h.get('phaseMilestonesRetry').fire('click');
    assert.equal(banners, 1);
    assert.match(h.get('phaseMilestonesStatus').textContent, /Connect to VPN/);
    assert.deepEqual(response.cleanup, {cancelled: 1, released: 1});
});

test('generic worker start has no made-up customer total and event names reset for each frame', async () => {
    const h = harness();
    const observed = [];
    const response = streamResponse([
        event('accepted', {job_id: 42}),
        event('start', {phase: 'starting'}),
        event('progress', {message: 'Worker progress'}),
        event('', {message: 'Loading milestones'}),
        event('complete', {success: true}),
    ], () => observed.push(h.get('phaseMilestonesStatus').textContent));
    h.responder(async url => url === '/api/milestone-tracker/sync' ? response : {success: true});
    await h.get('phaseMilestonesRetry').fire('click');
    assert.ok(observed.includes('Worker started this sync...'));
    assert.ok(observed.includes('Worker progress'));
    assert.ok(observed.includes('Loading milestones'));
    assert.ok(!observed.some(label => /undefined|Syncing 0 customers/.test(label)));
});
