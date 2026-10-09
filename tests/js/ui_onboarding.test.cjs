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
        window, document, console,
        fetch: async (url, options = {}) => {
            requests.push({url, method: options.method || 'GET', body: options.body});
            const data = await responder(url, options);
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
