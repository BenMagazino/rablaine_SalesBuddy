const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const records = new Map(), requests = [], emissions = [], socketHandlers = {};
    const timers = [], checks = [], users = [], windowHandlers = {}, documentHandlers = {};
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    class Element {
        constructor(id) {
            this.id = id; this.handlers = {}; this.dataset = {}; this.style = {};
            this.classList = {toggle() {}}; this.open = false; this.disabled = false;
            if (id) records.set(id, this);
        }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        fire(type) {
            const event = {prevented: false, preventDefault() { this.prevented = true; }};
            for (const fn of this.handlers[type] || []) fn.call(this, event);
            return event;
        }
        set textContent(value) { this.text = value; }
        get textContent() { return this.text; }
        set innerHTML(value) {
            this.html = value;
            if (this.id === 'shareImportReviewBody') {
                checks.length = 0;
                for (const match of value.matchAll(/<input type="checkbox"[^>]+>/g)) {
                    const html = match[0], cb = new Element();
                    cb.value = html.match(/value="([^"]*)"/)[1];
                    cb.dataset.action = html.match(/data-action="([^"]*)"/)[1];
                    cb.checked = / checked/.test(html);
                    checks.push(cb);
                }
            }
            if (this.id === 'shareModalBody' && value.includes('shareUserSearch')) {
                new Element('shareUserSearch');
                users.length = 0;
                for (const match of value.matchAll(/data-share-email="([^"]*)"/g)) {
                    const user = new Element(); user.dataset.shareEmail = match[1];
                    user.dataset.name = 'peer'; user.dataset.email = match[1]; users.push(user);
                }
            }
        }
        get innerHTML() { return this.html ?? escape(this.text || ''); }
        querySelectorAll(selector) {
            if (selector === '[data-share-email]') return users;
            if (selector === '[data-share-decline]') return [new Element(), new Element()];
            return [];
        }
        querySelector() { return new Element(); }
        appendChild(element) { if (element.id) records.set(element.id, element); }
        setAttribute() {}
        focus() {}
        remove() {}
    }
    for (const id of ['shareModal', 'shareModalBody', 'shareImportReviewModal',
        'shareImportReviewBody', 'shareImportConfirmBtn', 'shareImportStatus']) new Element(id);
    const document = {
        title: 'Isolated - Sales Buddy',
        body: new Element(),
        getElementById: id => records.get(id),
        createElement: () => new Element(),
        addEventListener(type, fn) { documentHandlers[type] = fn; },
        dispatchEvent() {},
        querySelectorAll(selector) {
            if (selector === '.share-import-check') return checks;
            if (selector === '.share-import-check:checked') return checks.filter(cb => cb.checked);
            if (selector === '.share-user-item') return users;
            return [];
        },
    };
    let responder = async url => {
        if (url === '/api/share/connection-info') return {success: true, token: 'isolated', gateway_url: 'isolated'};
        if (url === '/api/share/directory') return {success: true, partners: [{name: 'Export'}]};
        if (url.startsWith('/api/share/partner/')) return {success: true, partner: {name: 'One'}};
        if (url.startsWith('/api/share/note/')) return {success: true, note: {content: 'Test'}};
        if (url === '/api/share/preview') return {success: true, previews: [
            {name: 'Canonical', action: 'update', has_changes: true, changes: {specialties: ['New']}},
            {name: 'New', action: 'create', incoming: {rating: 0, contacts: [{name: 'Contact', email: 'c@test', is_primary: true}], overview: 'A'.repeat(140), specialties: ['Spec'], website: 'example.test', favicon_b64: 'cached'}},
            {name: 'Same', action: 'update', has_changes: false},
        ]};
        return {success: true, created: 1, updated: 1, skipped: 0};
    };
    const window = {
        addEventListener(type, fn) { windowHandlers[type] = fn; },
        location: {pathname: '/partners', reload() { window.reloaded = true; }},
        SBDialog: {
            open(id) { records.get(id).open = true; },
            close(id) {
                const dialog = records.get(id);
                if (dialog.fire('sb:dialog-before-close').prevented) return;
                dialog.open = false; dialog.fire('sb:dialog-closed');
            },
        },
    };
    const socket = {on(type, fn) { socketHandlers[type] = fn; },
        emit(type, payload) { emissions.push({type, payload}); }};
    vm.runInNewContext(fs.readFileSync('static/js/share.js', 'utf8'), {
        window, document, io: () => socket, console: {warn() {}},
        CustomEvent: class {}, setTimeout: fn => timers.push(fn),
        fetch: async (url, options) => {
            requests.push({url, options});
            const data = await responder(url, options);
            return data.response || {ok: true, status: 200, json: async () => data};
        },
    });
    return {api: window.Share, records, requests, emissions, socketHandlers, checks, users,
        window, windowHandlers, documentHandlers, timers,
        responder(fn) { responder = fn; },
        async connect() {
            await window.Share.init();
            socketHandlers.connect();
            socketHandlers.online_users({users: [{name: 'Peer', email: 'peer@test'}]});
        },
        async receive() {
            await socketHandlers.share_payload({share_type: 'directory', sender_name: 'Sender',
                partners: [{name: ''}, {name: 'Canonical Inc.'}, {name: 'New'}, {name: 'Same'}]});
        }};
}

test('initialization does only connection bookkeeping; directory data waits for acceptance', async () => {
    const h = harness(); await h.connect();
    assert.deepEqual(h.requests.map(r => r.url), ['/api/share/connection-info']);
    assert.deepEqual(h.emissions.map(e => e.type), ['get_online_users']);
    h.api.openShareModal('directory');
    assert.equal(h.records.get('shareModal').open, true);
    assert.match(h.records.get('shareModalBody').innerHTML, /Find a teammate/);
    h.api.sendShareRequest('peer@test');
    h.api.sendShareRequest('peer@test');
    assert.equal(h.emissions.filter(e => e.type === 'share_request').length, 1);
    assert.equal(h.requests.length, 1);
    await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
    assert.equal(h.requests[1].url, '/api/share/directory');
    const emitted = h.emissions.find(e => e.type === 'share_data');
    assert.deepEqual(JSON.parse(JSON.stringify(emitted.payload)), {
        recipient_email: 'peer@test', share_type: 'directory', partners: [{name: 'Export'}],
    });
    assert.equal(h.records.get('shareModal').open, false);
});

for (const close of ['cancel', 'escape', 'button', 'backdrop']) {
    test(`share ${close} clears intent, so late acceptance never exports`, async () => {
        const h = harness(); await h.connect(); h.api.openShareModal('directory');
        h.api.sendShareRequest('peer@test');
        if (close === 'cancel') h.api.cancelShare();
        else h.window.SBDialog.close('shareModal', close);
        await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
        assert.equal(h.requests.length, 1);
        assert.equal(h.emissions.filter(e => e.type === 'share_data').length, 0);
    });
}

test('wrong-recipient, duplicate acceptance and failed export cannot send private data', async () => {
    const h = harness(); await h.connect(); h.api.openShareModal('directory');
    h.api.sendShareRequest('peer@test');
    await h.socketHandlers.share_accepted({recipient_email: 'other@test'});
    assert.equal(h.requests.length, 1);
    h.responder(async () => ({response: {ok: false, status: 503, json: async () => ({error: 'Failed'})}}));
    await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
    await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
    assert.equal(h.requests.length, 2);
    assert.equal(h.emissions.filter(e => e.type === 'share_data').length, 0);
});

test('preview retains groups, zero rating, contacts, primary, overview and original identity', async () => {
    const h = harness(); await h.connect(); await h.receive();
    assert.equal(h.requests.at(-1).url, '/api/share/preview');
    assert.equal(h.requests.at(-1).options.method, 'POST');
    const html = h.records.get('shareImportReviewBody').innerHTML;
    for (const text of ['New (1)', 'Updated (1)', 'No Changes (1)', '☆☆☆☆☆',
        'primary', 'c@test', 'Favicon included', 'example.test', 'Select New Only'])
        assert.ok(html.includes(text), text);
    assert.match(html, /title="A{140}"/);
    assert.deepEqual(h.checks.map(cb => [cb.value, cb.checked]), [['2', true], ['1', true], ['3', false]]);
    assert.equal(h.records.get('shareImportConfirmBtn').textContent, 'Import Selected (2)');
    assert.ok(!/bootstrap|class="(?:btn |badge |list-group)/.test(html));
    h.api.selectNewOnly();
    assert.deepEqual(h.checks.map(cb => cb.checked), [true, false, false]);
    h.api.toggleAllImport(false);
    assert.equal(h.records.get('shareImportConfirmBtn').disabled, true);
    await h.api.confirmImport();
    assert.equal(h.requests.filter(r => r.url === '/api/share/receive').length, 0);
    h.api.toggleAllImport(true);
    assert.equal(h.records.get('shareImportConfirmBtn').textContent, 'Import Selected (3)');
});

test('import posts selected original incoming records, including canonical name matches', async () => {
    const h = harness(); await h.connect(); await h.receive();
    await h.api.confirmImport();
    const request = h.requests.find(r => r.url === '/api/share/receive');
    assert.deepEqual(JSON.parse(request.options.body), {sender_name: 'Sender',
        partners: [{name: 'Canonical Inc.'}, {name: 'New'}]});
    assert.equal(request.options.method, 'POST');
    assert.equal(h.records.get('shareImportReviewModal').open, false);
    assert.equal(h.window.reloaded, undefined);
    h.timers.at(-1)();
    assert.equal(h.window.reloaded, true);
});

test('cancel import clears payload without receive, reload or remote emits', async () => {
    const h = harness(); await h.connect(); await h.receive();
    h.window.SBDialog.close('shareImportReviewModal', 'cancel');
    await h.api.confirmImport();
    assert.equal(h.requests.filter(r => r.url === '/api/share/receive').length, 0);
    assert.equal(h.window.reloaded, undefined);
    assert.deepEqual(h.emissions.map(e => e.type), ['get_online_users']);
});

for (const kind of ['HTTP', 'business', 'JSON', 'network']) {
    test(`failed import ${kind} keeps selection and permits retry without false success`, async () => {
        const h = harness(); await h.connect(); await h.receive(); h.api.selectNewOnly();
        h.responder(async () => {
            if (kind === 'network') throw Error('offline');
            if (kind === 'JSON') return {response: {ok: true, json: async () => { throw Error('bad JSON'); }}};
            if (kind === 'HTTP') return {response: {ok: false, status: 503, json: async () => ({error: 'Fail'})}};
            return {success: false, error: 'Fail'};
        });
        await h.api.confirmImport();
        assert.equal(h.records.get('shareImportReviewModal').open, true);
        assert.match(h.records.get('shareImportStatus').textContent, /selection is retained/);
        assert.deepEqual(h.checks.map(cb => cb.checked), [true, false, false]);
        assert.equal(h.records.get('shareImportConfirmBtn').disabled, false);
        assert.equal(h.window.reloaded, undefined);
        h.responder(async () => ({success: true, created: 1, updated: 0}));
        await h.api.confirmImport();
        assert.equal(h.records.get('shareImportReviewModal').open, false);
    });
}

test('pending import blocks duplicate submits, selector changes, close and navigation', async () => {
    const h = harness(); await h.connect(); await h.receive();
    let finish; h.responder(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.api.confirmImport();
    await h.api.confirmImport(); h.api.toggleAllImport(false); h.api.selectNewOnly();
    h.window.SBDialog.close('shareImportReviewModal');
    assert.equal(h.records.get('shareImportReviewModal').open, true);
    assert.ok(h.checks.every(cb => cb.disabled));
    const event = {prevented: false, preventDefault() { this.prevented = true; }, target: {closest: () => ({})}};
    h.windowHandlers.beforeunload(event);
    assert.equal(event.prevented, true);
    event.prevented = false; h.documentHandlers.click(event); assert.equal(event.prevented, true);
    assert.equal(h.requests.filter(r => r.url === '/api/share/receive').length, 1);
    finish({success: false, error: 'Failed'}); await pending;
    assert.ok(h.checks.every(cb => !cb.disabled));
});

test('note and single-partner consumers retain original export paths and payloads', async () => {
    for (const type of ['note', 'partner']) {
        const h = harness(); await h.connect(); h.api.openShareModal(type, 7);
        h.api.sendShareRequest('peer@test');
        await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
        assert.equal(h.requests.at(-1).url, `/api/share/${type}/7`);
        assert.equal(h.emissions.at(-1).payload.share_type, type);
        assert.ok(h.emissions.at(-1).payload[type === 'note' ? 'note' : 'partners']);
    }
});

test('existing automatic accepted-note import still uses its separate POST', async () => {
    const h = harness(); await h.connect();
    await h.socketHandlers.share_payload({share_type: 'note', sender_name: 'Sender',
        note: {customer: {name: 'Customer'}, content: 'Isolated'}});
    assert.equal(h.requests.at(-1).url, '/api/share/receive-note');
    assert.equal(h.requests.at(-1).options.method, 'POST');
    assert.equal(h.records.get('shareImportReviewModal').open, false);
});

test('teammate search only filters local rows without any requests or emits', async () => {
    const h = harness(); await h.connect(); h.api.openShareModal('directory');
    const search = h.records.get('shareUserSearch');
    const count = h.requests.length, emits = h.emissions.length;
    search.value = 'not-in-list';
    search.fire('input');
    assert.equal(h.users[0].hidden, true);
    search.value = 'peer@test';
    search.fire('input');
    assert.equal(h.users[0].hidden, false);
    assert.equal(h.requests.length, count);
    assert.equal(h.emissions.length, emits);
});

test('failed preview shows no review, no import and preserves the local directory', async () => {
    const h = harness(); await h.connect();
    h.responder(async () => ({success: false, error: 'Preview failed'}));
    await h.receive();
    assert.equal(h.records.get('shareImportReviewModal').open, false);
    await h.api.confirmImport();
    assert.equal(h.requests.filter(r => r.url === '/api/share/receive').length, 0);
    assert.equal(h.window.reloaded, undefined);
});

test('decline, share error and disconnect clear waiting state without exporting', async () => {
    for (const event of ['share_declined', 'share_error', 'disconnect']) {
        const h = harness(); await h.connect(); h.api.openShareModal('directory');
        h.api.sendShareRequest('peer@test');
        h.socketHandlers[event]({recipient_name: 'Peer', error: 'Failed'});
        await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
        assert.equal(h.requests.length, 1);
        assert.equal(h.emissions.filter(e => e.type === 'share_data').length, 0);
    }
});

test('existing partner review and selection cannot be overwritten by another offer/payload', async () => {
    const h = harness(); await h.connect(); await h.receive(); h.api.selectNewOnly();
    const count = h.requests.length;
    h.api.acceptOffer('second@test', 'offer');
    await h.receive();
    assert.equal(h.requests.length, count);
    assert.equal(h.emissions.filter(e => e.type === 'share_accept').length, 0);
    assert.deepEqual(h.checks.map(cb => cb.checked), [true, false, false]);
});

test('invalid successful export shapes cannot emit partner, directory or note data', async () => {
    for (const type of ['note', 'partner', 'directory']) {
        const h = harness(); await h.connect(); h.api.openShareModal(type, 7);
        h.api.sendShareRequest('peer@test');
        h.responder(async () => ({success: true}));
        await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
        assert.equal(h.emissions.filter(e => e.type === 'share_data').length, 0);
    }
});

test('pending export guards dismissal and duplicate acceptance; disconnection prevents send', async () => {
    const h = harness(); await h.connect(); h.api.openShareModal('directory');
    h.api.sendShareRequest('peer@test');
    let finish; h.responder(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
    h.api.cancelShare(); h.window.SBDialog.close('shareModal');
    assert.equal(h.records.get('shareModal').open, true);
    await h.socketHandlers.share_accepted({recipient_email: 'peer@test'});
    assert.equal(h.requests.filter(r => r.url === '/api/share/directory').length, 1);
    h.socketHandlers.disconnect();
    finish({success: true, partners: [{name: 'Export'}]}); await pending;
    assert.equal(h.emissions.filter(e => e.type === 'share_data').length, 0);
    assert.equal(h.records.get('shareModal').open, false);
});

test('Partners help retains exact five headings, original commands and explicit import/cancel', () => {
    const source = fs.readFileSync('static/js/page-help.js', 'utf8');
    const section = source.split('// ── Partners ──')[1].split("title: 'New Partner'")[0];
    for (const text of ['Name, Rating, Specialties, Contacts or Notes', 'Back restores',
        'New Partner', 'Manage Specialties', 'Share Directory', 'Select All', 'Deselect All',
        'Select New Only', 'Import Selected', 'Cancel', 'Failed imports'])
        assert.ok(section.includes(text), text);
    assert.ok(!section.includes('phone'));
});

test('offline offers cannot queue accept or decline for a later reconnection', async () => {
    const h = harness(); await h.connect();
    h.socketHandlers.disconnect();
    h.api.acceptOffer('peer@test', 'offer');
    h.api.declineOffer('peer@test', 'offer');
    assert.equal(h.emissions.filter(e => ['share_accept', 'share_decline'].includes(e.type)).length, 0);
    assert.equal(h.requests.length, 1);
});

test('unused Bootstrap sharing client is removed, native client remains the single implementation', () => {
    assert.deepEqual(fs.readdirSync('static/js').filter(name => /^share.*\.js$/.test(name)),
        ['share.js']);
    const source = fs.readFileSync('static/js/share.js', 'utf8');
    assert.ok(!/\bbootstrap\.|data-bs-|spinner-border|class="(?:toast|btn|list-group)/.test(source));
    assert.ok(source.includes("window.SBDialog.open('shareImportReviewModal')"));
});
