const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-review.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture() {
    const requests = [], errors = [], events = [], timestamps = [];
    class Event {
        constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
        preventDefault() { this.defaultPrevented = true; }
    }
    class Element {
        constructor(tag = 'div') {
            this.tag = tag; this.handlers = {}; this.attributes = {}; this.dataset = {};
            this.children = []; this.value = ''; this.hidden = false; this.open = false;
            this.textContent = ''; this.checked = false; this.disabled = false;
            this.isConnected = true;
        }
        setAttribute(key, value) { this.attributes[key] = value; }
        getAttribute(key) { return this.attributes[key]; }
        addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
        dispatchEvent(event) {
            event.target ||= this;
            for (const handler of this.handlers[event.type] || []) handler(event);
            if (event.bubbles && this !== document) document.dispatchEvent(event);
            return !event.defaultPrevented;
        }
        appendChild(child) {
            if (child.parentElement) {
                child.parentElement.children = child.parentElement.children.filter(e => e !== child);
            }
            child.parentElement = this;
            this.children.push(child);
        }
        replaceChildren(...children) { this.children = []; children.forEach(c => this.appendChild(c)); }
        remove() { this.removed = true; }
        focus() { document.activeElement = this; }
        closest(selector) {
            if (selector === '.modal.show') return this.legacyParent || null;
            if (selector === '.review-action-btn') return this.dataset.analysisId ? this : null;
            return null;
        }
    }
    const ids = [
        'reviewActionModal', 'reviewActionForm', 'reviewNotes', 'reviewResult',
        'reviewHistoryState', 'reviewHistoryList', 'reviewHistoryRetry', 'reviewDiscardDialog',
        'reviewDiscardConfirm', 'reviewAnalysisId', 'reviewSave',
    ];
    const controls = Object.fromEntries(ids.map(id => [id, new Element()]));
    const get = id => controls[id];
    const dialog = get('reviewActionModal'), discard = get('reviewDiscardDialog');
    const form = get('reviewActionForm'), home = new Element(), legacyParent = new Element();
    home.appendChild(dialog); home.appendChild(discard);
    const radios = ['new', 'to_be_reviewed', 'reviewed', 'actioned', 'dismissed'].map(value => {
        const radio = new Element('input'); radio.value = value; return radio;
    });
    const fields = [...radios, get('reviewNotes'), get('reviewSave'), get('reviewHistoryRetry')];
    form.querySelectorAll = selector => selector === '[name="reviewStatus"]' ? radios : fields;
    const invokers = [new Element('button'), new Element('button')];
    invokers.forEach(button => Object.assign(button.dataset, {
        analysisId: '7', status: 'new', notes: '',
    }));
    const badges = [new Element(), new Element()], rows = [new Element(), new Element()];
    rows.forEach(row => { row.style = {}; });
    const previous = [new Element(), new Element()];
    const document = new Element();
    document.getElementById = id => get(id);
    document.createElement = tag => new Element(tag);
    document.createTextNode = text => { const node = new Element(); node.textContent = text; return node; };
    document.querySelectorAll = selector => {
        if (!selector.includes('"7"')) return [];
        if (selector.startsWith('[data-review-id')) return badges;
        if (selector.startsWith('.review-action-btn')) return invokers;
        if (selector.startsWith('tr[')) return rows;
        if (selector.startsWith('[data-review-previous-id')) return previous;
        throw new Error('Unexpected selector ' + selector);
    };
    document.addEventListener('sb:revenue-review-saved', event => events.push(event));
    const window = new Element();
    const SBDialog = {
        open(node) { node.open = true; },
        close(node, reason = 'escape') {
            if (!node.open) return;
            if (!node.dispatchEvent(new Event('sb:dialog-before-close',
                {detail: {reason}}))) return;
            node.open = false;
            node.dispatchEvent(new Event('sb:dialog-closed'));
        },
    };
    const context = {window, document, Element, AbortController, CustomEvent: Event, SBDialog,
        console: {error: (...args) => errors.push(args)},
        SBLocalDateTime: {render(root) {
            root.children.forEach(row => timestamps.push(row.children[1].children[0].attributes['data-utc']));
        }},
        fetch: (url, options) => new Promise((resolve, reject) =>
            requests.push({url, options, resolve, reject})),
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    const api = window.SBRevenueReview;
    const reply = (index, data, extra = {}) =>
        requests[index].resolve({ok: true, json: async () => data, ...extra});
    const status = value => radios.forEach(radio => { radio.checked = radio.value === value; });
    return {api, get, document, window, dialog, discard, home, legacyParent, radios, fields,
        invokers, badges, rows, previous, SBDialog, Event, requests, reply, status, errors, events,
        timestamps, context, open: (id = 7, value = 'new', text = '') =>
            api.open(id, value, text, invokers[0])};
}

test('editor opens with all statuses, notes, explicit empty history and compatible public entry points', async () => {
    const h = fixture(), pending = h.open(7, 'actioned', 'Existing notes');
    assert.ok(h.dialog.open);
    assert.equal(h.get('reviewAnalysisId').value, 7);
    assert.equal(h.get('reviewNotes').value, 'Existing notes');
    assert.equal(h.radios.find(radio => radio.checked).value, 'actioned');
    assert.equal(h.document.activeElement, h.get('reviewNotes'));
    assert.match(h.get('reviewHistoryState').textContent, /Loading/);
    h.reply(0, {history: []});
    await pending;
    assert.equal(h.get('reviewHistoryState').textContent, 'No reviews yet.');
    assert.equal(h.get('reviewHistoryRetry').hidden, true);
    assert.equal(h.window.openReviewModal, h.api.open);
    assert.equal(h.window.saveReview, h.api.save);
    vm.runInContext(source, h.context);
    assert.equal(h.window.SBRevenueReview, h.api);
});

test('history renders literal notes and passes naive and offset timestamps to the shared converter', async () => {
    const h = fixture(), pending = h.open();
    const notes = '<img onerror="bad()"> & "Quoted"';
    h.reply(0, {history: [
        {review_status: 'reviewed', review_notes: notes, created_at: '2026-10-03T12:00:00'},
        {review_status: 'new', review_notes: null, created_at: '2026-10-02T12:00:00+00:00'},
    ]});
    await pending;
    assert.equal(h.get('reviewHistoryList').children[0].children[1].children[1].textContent, notes);
    assert.deepEqual(h.timestamps, ['2026-10-03T12:00:00', '2026-10-02T12:00:00+00:00']);
    assert.equal(h.get('reviewHistoryState').textContent, '');
    assert.doesNotMatch(source, /innerHTML|bootstrap|alert\(/);
});

test('HTTP, JSON, network and malformed history failures are explicit; Retry retains edits and recovers', async () => {
    for (const failure of ['http', 'json', 'network', 'schema', 'timestamp']) {
        const h = fixture(), pending = h.open();
        h.get('reviewNotes').value = 'Draft remains';
        if (failure === 'network') h.requests[0].reject(new Error('Offline'));
        else h.reply(0, failure === 'schema' ? {history: {}} :
            failure === 'timestamp' ? {history: [
                {review_status: 'new', review_notes: '', created_at: 'bad-date'},
            ]} : {history: []}, failure === 'http' ? {ok: false, status: 503} :
                failure === 'json' ? {json: async () => { throw new Error('Invalid JSON'); }} : {});
        await pending;
        assert.equal(h.errors.length, 1);
        assert.equal(h.get('reviewHistoryState').attributes.role, 'alert');
        assert.equal(h.get('reviewHistoryRetry').hidden, false);
        h.get('reviewHistoryRetry').dispatchEvent(new h.Event('click'));
        h.reply(1, {history: []}); await settle();
        assert.equal(h.get('reviewNotes').value, 'Draft remains');
        assert.equal(h.get('reviewHistoryState').textContent, 'No reviews yet.');
        assert.equal(h.get('reviewHistoryRetry').hidden, true);
    }
});

test('late history replies cannot replace a newer alert or reopen a closed editor', async () => {
    const h = fixture(), first = h.open(7), second = h.open(8);
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.reply(1, {history: []}); await second;
    h.reply(0, {history: [{review_status: 'reviewed', review_notes: 'Old',
        created_at: '2026-10-01T10:00:00'}]}); await first;
    assert.equal(h.get('reviewAnalysisId').value, 8);
    assert.equal(h.get('reviewHistoryList').children.length, 0);
    const third = h.open(9);
    h.SBDialog.close(h.dialog);
    assert.equal(h.requests[2].options.signal.aborted, true);
    h.reply(2, {history: []}); await third;
    assert.equal(h.dialog.open, false);
});

test('dirty Escape offers Keep editing or Discard without losing notes', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    h.get('reviewNotes').value = 'Draft';
    h.SBDialog.close(h.dialog);
    assert.ok(h.dialog.open && h.discard.open);
    h.SBDialog.close(h.discard);
    assert.ok(h.dialog.open);
    assert.equal(h.get('reviewNotes').value, 'Draft');
    h.SBDialog.close(h.dialog);
    h.get('reviewDiscardConfirm').dispatchEvent(new h.Event('click'));
    assert.equal(h.dialog.open, false);
    assert.equal(h.discard.open, false);
});

test('switching alerts protects both status and notes; confirmed discard selects the new alert', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    h.status('dismissed');
    h.open(8, 'reviewed', 'Other alert');
    assert.equal(h.requests.length, 1);
    assert.ok(h.discard.open);
    h.get('reviewDiscardConfirm').dispatchEvent(new h.Event('click'));
    assert.equal(h.get('reviewAnalysisId').value, 8);
    assert.equal(h.get('reviewNotes').value, 'Other alert');
    assert.equal(h.radios.find(radio => radio.checked).value, 'reviewed');
    h.reply(1, {history: []}); await settle();
});

test('native review and discard dialogs stay inside a legacy parent focus boundary until close', async () => {
    const h = fixture(); h.invokers[0].legacyParent = h.legacyParent;
    const pending = h.open(); h.reply(0, {history: []}); await pending;
    assert.equal(h.dialog.parentElement, h.legacyParent);
    assert.equal(h.discard.parentElement, h.legacyParent);
    h.get('reviewNotes').value = 'Draft';
    h.SBDialog.close(h.dialog);
    assert.equal(h.discard.parentElement, h.legacyParent);
    h.get('reviewDiscardConfirm').dispatchEvent(new h.Event('click'));
    assert.equal(h.dialog.parentElement, h.home);
    assert.equal(h.discard.parentElement, h.home);
});

test('confirmed saves PATCH exact fields, update all hosts and emit one saved event', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    h.status('reviewed'); h.get('reviewNotes').value = '  <Quoted "note">  ';
    const save = h.api.save();
    assert.equal(h.requests[1].url, '/api/revenue/analysis/7/review');
    assert.equal(h.requests[1].options.method, 'PATCH');
    assert.deepEqual(JSON.parse(h.requests[1].options.body),
        {review_status: 'reviewed', review_notes: '  <Quoted "note">  '});
    assert.ok(h.fields.every(field => field.disabled));
    assert.equal(h.get('reviewResult').textContent, 'Saving review...');
    h.reply(1, {success: true, review_status: 'reviewed', review_notes: '<Quoted "note">'});
    await save;
    assert.equal(h.dialog.open, false);
    assert.ok(h.fields.every(field => !field.disabled));
    assert.ok(h.badges.every(node => node.children[0].title === '<Quoted "note">'));
    assert.ok(h.invokers.every(node => node.dataset.status === 'reviewed' &&
        node.dataset.notes === '<Quoted "note">'));
    assert.ok(h.rows.every(row => row.style.opacity === '0.6'));
    assert.ok(h.previous.every(node => node.removed));
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].target, h.invokers[0]);
    assert.equal(h.events[0].detail.analysisId, 7);
});

test('all five statuses save, and new/to-be-reviewed retain normal row opacity', async () => {
    for (const value of ['new', 'to_be_reviewed', 'reviewed', 'actioned', 'dismissed']) {
        const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
        h.status(value);
        const save = h.api.save();
        h.reply(1, {success: true, review_status: value, review_notes: null}); await save;
        assert.equal(h.dialog.open, false);
        assert.ok(h.rows.every(row => row.style.opacity ===
            (['new', 'to_be_reviewed'].includes(value) ? '' : '0.6')));
    }
});

test('pending saves block duplicate writes, close and alert replacement', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    const save = h.api.save();
    await h.api.save();
    h.SBDialog.close(h.dialog);
    h.open(8);
    assert.equal(h.requests.length, 2);
    assert.ok(h.dialog.open);
    assert.equal(h.discard.open, false);
    assert.match(h.get('reviewResult').textContent, /Please wait/);
    h.reply(1, {success: true, review_status: 'new', review_notes: null}); await save;
});

test('failed/unconfirmed saves retain edits, emit no success and permit retry', async () => {
    for (const failure of ['http', 'network', 'json', 'success', 'status', 'notes']) {
        const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
        h.status('actioned'); h.get('reviewNotes').value = 'Draft';
        const save = h.api.save();
        if (failure === 'network') h.requests[1].reject(new Error('Offline'));
        else h.reply(1, {success: failure !== 'success',
            review_status: failure === 'status' ? 'dismissed' : 'actioned',
            review_notes: failure === 'notes' ? 'Mismatch' : 'Draft'},
        failure === 'http' ? {ok: false, status: 500} :
            failure === 'json' ? {json: async () => { throw new Error('Invalid JSON'); }} : {});
        await save;
        assert.equal(h.get('reviewResult').attributes.role, 'alert');
        assert.ok(h.dialog.open);
        assert.equal(h.get('reviewNotes').value, 'Draft');
        assert.equal(h.events.length, 0);
        assert.ok(h.fields.every(field => !field.disabled));
        const retry = h.api.save();
        h.reply(2, {success: true, review_status: 'actioned', review_notes: 'Draft'}); await retry;
        assert.equal(h.events.length, 1);
        assert.equal(h.dialog.open, false);
    }
});

test('blank notes still require explicit server confirmation of saved notes', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    const save = h.api.save();
    h.reply(1, {success: true, review_status: 'new'}); await save;
    assert.ok(h.dialog.open);
    assert.equal(h.events.length, 0);
    assert.match(h.get('reviewResult').textContent, /Could not confirm/);
});

test('UI failure after confirmed save is distinguished from an unconfirmed write', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    h.badges[0].replaceChildren = () => { throw new Error('Consumer update failed'); };
    const save = h.api.save();
    h.reply(1, {success: true, review_status: 'new', review_notes: null}); await save;
    assert.ok(h.dialog.open);
    assert.match(h.get('reviewResult').textContent, /Review saved, but the page could not update/);
    assert.doesNotMatch(h.get('reviewResult').textContent, /Try Save again/);
    const exit = new h.Event('beforeunload'); h.window.dispatchEvent(exit);
    assert.equal(exit.defaultPrevented, undefined);
});

test('disconnected review opener falls back to a single document save event', async () => {
    const h = fixture(), pending = h.open(); h.reply(0, {history: []}); await pending;
    h.invokers[0].isConnected = false;
    const save = h.api.save();
    h.reply(1, {success: true, review_status: 'new', review_notes: null}); await save;
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].target, h.document);
    assert.equal(h.dialog.open, false);
});

test('a save invalidates pending history so a late timeline cannot mutate the next review', async () => {
    const h = fixture(), history = h.open(), save = h.api.save();
    h.reply(1, {success: true, review_status: 'new', review_notes: null}); await save;
    assert.equal(h.requests[0].options.signal.aborted, true);
    const next = h.open(8);
    h.reply(2, {history: []}); await next;
    h.reply(0, {history: []}); await history;
    assert.equal(h.get('reviewAnalysisId').value, 8);
    assert.ok(h.dialog.open);
});

test('leaving a dirty/busy page warns, page exit aborts history and cached return resumes it', async () => {
    const h = fixture(), pending = h.open();
    const clean = new h.Event('beforeunload'); h.window.dispatchEvent(clean);
    assert.equal(clean.defaultPrevented, undefined);
    h.get('reviewNotes').value = 'Draft';
    const dirty = new h.Event('beforeunload'); h.window.dispatchEvent(dirty);
    assert.equal(dirty.defaultPrevented, true);
    h.window.dispatchEvent(new h.Event('pagehide'));
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.window.dispatchEvent(new h.Event('pageshow', {persisted: true}));
    assert.equal(h.requests.length, 2);
    h.reply(0, {history: []}); await pending;
    h.reply(1, {history: []}); await settle();
    assert.equal(h.get('reviewNotes').value, 'Draft');
});

test('invalid selections fail explicitly and missing status reports validation without writing', async () => {
    const h = fixture();
    assert.throws(() => h.open(0), /Invalid/);
    assert.throws(() => h.open(7, 'bad'), /Invalid/);
    assert.throws(() => h.open(7, 'new', {}), /Invalid/);
    const pending = h.open(); h.reply(0, {history: []}); await pending;
    h.status('none'); await h.api.save();
    assert.equal(h.requests.length, 1);
    assert.equal(h.get('reviewResult').attributes.role, 'alert');
});
