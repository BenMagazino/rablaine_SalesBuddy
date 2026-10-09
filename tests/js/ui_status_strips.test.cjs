const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '../../templates/base.html'), 'utf8');
const section = template.slice(template.indexOf('<!-- Global Auth-Required Detection.'),
    template.indexOf('{% block extra_js %}'));
const scripts = [...section.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 2);

function response(payload, status = 200, contentType = 'application/json', body) {
    return {
        status, ok: status >= 200 && status < 300,
        headers: {get: () => contentType},
        json: async () => payload,
        clone: () => ({text: async () => body ?? JSON.stringify(payload)}),
    };
}

function strips(initial = {}) {
    const store = new Map(Object.entries(initial));
    const elements = new Map(['vpnBlockedBanner', 'vpnRetryBtn', 'vpnRetryStatus',
        'authRequiredBanner', 'authSignInBtn', 'authBannerStatus']
        .map(id => [id, {id, hidden: id.endsWith('Banner'), disabled: false,
            dataset: {}, textContent: '', className: id.endsWith('Status') ?
                'sb-status-detail' : 'sb-status-strip'}]));
    const requests = [];
    const queue = [];
    const intervals = new Map();
    const timeouts = [];
    let now = 0, nextTimer = 0, reloads = 0;
    const context = {
        document: {getElementById: id => elements.get(id)},
        sessionStorage: {
            getItem: key => store.get(key) ?? null,
            setItem: (key, value) => store.set(key, value),
            removeItem: key => store.delete(key),
        },
        fetch: async (url, options) => {
            requests.push({url, options});
            const result = queue.shift();
            if (result instanceof Error) throw result;
            if (!result) throw new Error('Unexpected fetch: ' + url);
            return result;
        },
        setInterval(fn, delay) { const id = ++nextTimer; intervals.set(id, {fn, delay}); return id; },
        clearInterval(id) { intervals.delete(id); },
        setTimeout(fn, delay) { timeouts.push({fn, delay}); },
        Date: {now: () => now},
        location: {reload: () => { reloads++; }},
        console,
    };
    context.window = context;
    for (const script of scripts) vm.runInNewContext(script, context);
    return {
        api: context, store, elements, requests, queue, intervals, timeouts,
        reloads: () => reloads,
        advance(ms) { now += ms; },
        async tick(delay) {
            for (const timer of [...intervals.values()]) if (timer.delay === delay) await timer.fn();
        },
    };
}

test('reactive access strips restore independent session state and use native hidden properties', () => {
    const h = strips({salesbuddy_auth_required: '1', salesbuddy_vpn_blocked: '1'});
    assert.equal(h.elements.get('authRequiredBanner').hidden, false);
    assert.equal(h.elements.get('vpnBlockedBanner').hidden, false);
    h.api.hideAuthBanner();
    assert.equal(h.api.isAuthRequired(), false);
    assert.equal(h.elements.get('authRequiredBanner').hidden, true);
    assert.equal(h.api.isVpnBlocked(), true);
    h.api.hideVpnBanner();
    h.api.showAuthBanner();
    h.api.showVpnBanner();
    assert.equal(h.store.get('salesbuddy_auth_required'), '1');
    assert.equal(h.store.get('salesbuddy_vpn_blocked'), '1');
    assert.doesNotMatch(section, /d-none|text-light|text-warning|className = 'small/);
});

test('VPN detection stays separate from auth and only intended fetch responses change banners', async () => {
    const h = strips();
    h.queue.push(response({error: 'IP address is blocked'}, 403));
    const blocked = await h.api.fetch('/api/msx/example');
    assert.equal(h.api.isVpnBlocked(), true);
    assert.equal(h.api.isAuthRequired(), false);
    assert.equal(h.api.isAuthFailure(401, 'IP address is blocked'), false);
    assert.equal((await blocked.json()).error, 'IP address is blocked');
    h.queue.push(response({error: 'not authenticated'}, 401));
    await h.api.fetch('/api/ai/example');
    assert.equal(h.api.isAuthRequired(), true);
    h.queue.push(response({success: true}));
    await h.api.fetch('/api/unrelated');
    assert.equal(h.api.isAuthRequired(), true);
    h.queue.push(response({success: true}));
    await h.api.fetch('/api/milestone/example');
    assert.equal(h.api.isAuthRequired(), false);
    assert.equal(h.api.isVpnBlocked(), false);
});

test('streaming fetch bodies are never cloned or interpreted as status failures', async () => {
    const h = strips();
    const stream = response({}, 401, 'text/event-stream');
    stream.clone = () => { throw new Error('Stream was cloned'); };
    h.queue.push(stream);
    assert.equal(await h.api.fetch('/api/msx/stream'), stream);
    assert.equal(h.api.isAuthRequired(), false);
});

test('VPN retry preserves waiting, failure, network error and delayed recovery behavior', async () => {
    const h = strips();
    h.api.showVpnBanner();
    h.queue.push(response({success: false, message: 'Still blocked.'}));
    await h.api.checkVpnRecovery();
    assert.equal(h.elements.get('vpnRetryBtn').disabled, false);
    assert.equal(h.elements.get('vpnRetryStatus').textContent, 'Still blocked.');
    assert.equal(h.elements.get('vpnRetryStatus').dataset.sbState, 'warning');
    h.queue.push(new Error('Network unavailable'));
    await h.api.checkVpnRecovery();
    assert.match(h.elements.get('vpnRetryStatus').textContent, /Network error/);
    h.queue.push(response({success: true, message: 'Connected.'}));
    await h.api.checkVpnRecovery();
    assert.equal(h.elements.get('vpnRetryBtn').disabled, true);
    assert.equal(h.elements.get('vpnRetryStatus').dataset.sbState, 'neutral');
    assert.equal(h.requests[0].url, '/api/msx/vpn-check');
    assert.equal(h.requests[0].options.method, 'POST');
    assert.equal(h.timeouts[0].delay, 1500);
    h.timeouts[0].fn();
    assert.equal(h.elements.get('vpnBlockedBanner').hidden, true);
    assert.equal(h.reloads(), 1);
});

test('sign-in errors stay visible and re-enable the existing action without starting timers', async () => {
    const h = strips();
    h.api.showAuthBanner();
    h.queue.push(response({error: 'CLI unavailable'}, 503));
    await h.api.startAuthSignIn();
    assert.equal(h.elements.get('authSignInBtn').disabled, false);
    assert.equal(h.elements.get('authBannerStatus').textContent, 'CLI unavailable');
    assert.equal(h.intervals.size, 0);
    h.queue.push(new Error('Network unavailable'));
    await h.api.startAuthSignIn();
    assert.equal(h.elements.get('authBannerStatus').textContent, 'Could not start sign-in.');
    assert.equal(h.elements.get('authRequiredBanner').hidden, false);
});

test('sign-in polling preserves elapsed progress, endpoints, completion and delayed reload', async () => {
    const h = strips();
    h.api.showAuthBanner();
    h.queue.push(response({success: true}));
    await h.api.startAuthSignIn();
    assert.equal(h.elements.get('authSignInBtn').disabled, true);
    assert.equal(h.intervals.size, 2);
    h.advance(1000);
    await h.tick(1000);
    assert.match(h.elements.get('authBannerStatus').textContent, /\(1s\)/);
    h.queue.push(response({logged_in: true}), response({success: true}));
    await h.tick(2000);
    assert.equal(h.intervals.size, 0);
    assert.equal(h.elements.get('authBannerStatus').textContent, 'Signed in! Reloading...');
    assert.deepEqual(h.requests.map(r => r.url), [
        '/api/msx/az-login/start', '/api/msx/az-status', '/api/msx/az-login/complete',
    ]);
    assert.equal(h.requests[0].options.method, 'POST');
    assert.equal(h.requests[2].options.method, 'POST');
    assert.equal(h.timeouts[0].delay, 1200);
    h.timeouts[0].fn();
    assert.equal(h.reloads(), 1);
});

test('sign-in timeout and completion failure stop polling and keep a retryable button', async () => {
    const timeout = strips();
    timeout.queue.push(response({success: true}));
    await timeout.api.startAuthSignIn();
    timeout.advance(180001);
    await timeout.tick(2000);
    assert.equal(timeout.intervals.size, 0);
    assert.equal(timeout.elements.get('authSignInBtn').disabled, false);
    assert.equal(timeout.elements.get('authBannerStatus').textContent, 'Sign-in timed out. Try again.');
    const failed = strips();
    failed.queue.push(response({success: true}));
    await failed.api.startAuthSignIn();
    failed.queue.push(response({logged_in: true}),
        response({success: false, error: 'CRM token unavailable'}, 503));
    await failed.tick(2000);
    assert.equal(failed.intervals.size, 0);
    assert.equal(failed.elements.get('authSignInBtn').disabled, false);
    assert.equal(failed.elements.get('authBannerStatus').textContent, 'CRM token unavailable');
});

test('status styles are app-owned, keyboard-visible and hide dormant strips without Bootstrap', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../static/css/ui-feedback.css'), 'utf8');
    assert.match(css, /\.sb-status-strip\[hidden\]\s*\{\s*display:\s*none/);
    assert.match(css, /\.sb-status-button:disabled/);
    assert.match(css, /\.sb-status-button:focus-visible/);
    assert.match(css, /\.sb-status-copy\s*\{[^}]*overflow-wrap:\s*anywhere/);
    assert.match(css, /\.sb-status-actions\s*\{[^}]*max-width:\s*50%/);
});
