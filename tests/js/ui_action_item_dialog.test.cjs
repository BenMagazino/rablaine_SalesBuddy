const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-action-item-dialog.js'), 'utf8');
const partial = fs.readFileSync(path.join(__dirname,
    '../../templates/partials/_action_item_detail_modal.html'), 'utf8');

function fixture() {
    const requests = [], errors = [], navigations = [], events = {};
    let reloads = 0;
    class Element {
        constructor(id = '') {
            this.id = id; this.handlers = {}; this.attributes = {}; this.dataset = {};
            this.hidden = false; this.disabled = false; this.checked = false;
            this.value = ''; this.textContent = ''; this.children = []; this.parent = null;
        }
        addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); }
        dispatch(name, extra = {}) {
            const event = {target: this, detail: {}, preventDefault() {
                this.defaultPrevented = true;
            }, ...extra};
            for (const handler of this.handlers[name] || []) handler(event);
            return event;
        }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        getAttribute(name) { return this.attributes[name] || null; }
        removeAttribute(name) { delete this.attributes[name]; }
        focus() { if (!this.disabled) document.activeElement = this; }
        reportValidity() { return true; }
        appendChild(child) { child.parent = this; this.children.push(child); }
        replaceChildren() { this.children = []; }
        get childElementCount() { return this.children.length; }
        set innerHTML(value) { this.textContent = value.replace(/<[^>]*>/g, ''); this.html = value; }
        get innerHTML() { return this.html; }
        contains(element) {
            for (let node = element; node; node = node.parent) if (node === this) return true;
            return false;
        }
        closest(selector) {
            if (selector === '[hidden]') {
                for (let node = this; node; node = node.parent) if (node.hidden) return node;
                return null;
            }
            return selector === 'a[href]' && this.href ? this : null;
        }
    }
    const dialog = new Element(), discard = new Element(), confirm = new Element();
    const fields = new Map([...partial.matchAll(/id="([^"]+)"/g)]
        .map(match => [match[1], new Element(match[1])]));
    const close = new Element('close');
    fields.forEach(element => { element.parent = dialog; });
    close.parent = dialog;
    const form = fields.get('aiDetailEditMode');
    form.hidden = true;
    ['aiEditTitle', 'aiEditDue', 'aiEditPriority', 'aiEditContact', 'aiEditDesc']
        .forEach(id => { fields.get(id).parent = form; });
    dialog.querySelector = selector => selector.startsWith('#') ?
        fields.get(selector.slice(1)) : close;
    dialog.querySelectorAll = () => [...fields.values(), close];
    discard.querySelector = () => confirm;
    const document = {activeElement: null,
        getElementById: id => id === 'actionItemDetailModal' ? dialog :
            id === 'aiDiscardDialog' ? discard : null,
        createElement: () => new Element()};
    const SBDialog = {
        open(element) { element.open = true; },
        close(element, reason = 'button') {
            if (!element.open) return;
            const event = element.dispatch('sb:dialog-before-close', {detail: {reason}});
            if (event.defaultPrevented) return;
            element.open = false;
            element.dispatch('sb:dialog-closed');
        },
    };
    const window = {addEventListener: (name, handler) => { events[name] = handler; },
        removeEventListener: (name, handler) => {
            if (events[name] === handler) delete events[name];
        }};
    const context = {document, window, SBDialog, URL, AbortController,
        location: {href: 'http://127.0.0.1:5000/', reload: () => reloads++,
            assign: url => navigations.push(url)},
        console: {error: (...args) => errors.push(args)},
        fetch: (url, options) => new Promise((resolve, reject) =>
            requests.push({url, options, resolve, reject}))};
    vm.runInNewContext(source, context);
    const task = (id = 9, extra = {}) => ({
        id, title: '<literal title>', status: 'open', source: 'project',
        description: '<p>Rich description</p>', priority: 'normal', ...extra,
    });
    const reply = (index, data, extra = {}) => requests[index].resolve({
        ok: true, status: 200, json: async () => data, ...extra,
    });
    const field = id => fields.get(id);
    return {requests, errors, dialog, discard, confirm, document, SBDialog, window, events,
        close, field, task, reply, context, navigations, reloads: () => reloads,
        open: (id = 9, opts) => window.viewActionItem(id, opts)};
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
async function ready(h, task = h.task(), opts) {
    const pending = h.open(task.id, opts);
    h.reply(h.requests.length - 1, {success: true, task});
    await pending;
}

test('scoped nested task controller uses local discard and disposes pending reads and global guards', async () => {
    const h = fixture();
    let changed = 0;
    const controller = h.window.SBActionItemDialog.mount(h.dialog, {
        discard: h.discard, onChanged: () => changed++,
    });
    const pending = controller.open(9);
    h.reply(0, {success: true, task: h.task()});
    await pending;
    assert.equal(controller.isBusy(), false);
    h.field('aiDetailEditBtn').dispatch('click');
    h.field('aiEditTitle').value = 'Changed title';
    assert.equal(controller.isDirty(), true);
    h.field('aiDetailEditMode').dispatch('submit');
    assert.equal(controller.isBusy(), true);
    h.reply(1, {success: true, task: h.task(9, {title: 'Changed title'})});
    await settle();
    assert.equal(controller.isBusy(), false);
    h.SBDialog.close(h.dialog);
    assert.equal(changed, 1);
    assert.equal(h.reloads(), 0);
    controller.open(12);
    controller.dispose();
    assert.equal(h.requests[2].options.signal.aborted, true);
    assert.deepEqual(Object.keys(h.events), []);
});

test('local queue project context and page-exit guard preserve unsaved edits', async () => {
    const h = fixture();
    await ready(h, h.task(9, {project_id: 3}), {showProjectLink: true});
    assert.equal(h.field('aiDetailMeta').children.at(-1).href, '/project/3');
    h.field('aiDetailEditBtn').dispatch('click');
    h.field('aiEditTitle').value = 'Unsubmitted draft';
    const event = {preventDefault() { this.prevented = true; }};
    h.events.beforeunload(event);
    assert.equal(event.prevented, true);
    assert.equal(event.returnValue, '');
    assert.equal(h.requests.length, 1);
});

test('native partial retains every field, label and action without Bootstrap hooks', () => {
    assert.match(partial, /<dialog[^>]+id="actionItemDetailModal"/);
    assert.match(partial, /aria-labelledby="aiDetailTitle"/);
    assert.doesNotMatch(partial, /bootstrap|data-bs-|class="(?:modal|btn |form-control)/);
    for (const id of ['aiEditTitle', 'aiEditDue', 'aiEditPriority', 'aiEditContact',
        'aiEditDesc', 'aiDetailSaveDue', 'aiDetailCompleted']) {
        assert.match(partial, new RegExp('for="' + id + '"'));
    }
});

test('read opens immediately, validates identity, retains rich text and safe literal metadata', async () => {
    const h = fixture();
    const pending = h.open(9, {showEngagementLink: true});
    assert.equal(h.dialog.open, true);
    assert.equal(h.field('aiDetailLoading').hidden, false);
    assert.equal(h.requests[0].url, '/action-item/9');
    assert.equal(h.requests[0].options.method, 'GET');
    h.reply(0, {success: true, task: h.task(9, {priority: 'high', is_overdue: true,
        due_date: '2026-09-01', contact: '<contact>', source_url: 'https://example.com',
        note_id: 4, engagement_id: 2})});
    await pending;
    assert.equal(h.field('aiDetailTitle').textContent, '<literal title>');
    assert.equal(h.field('aiDetailDesc').innerHTML, '<p>Rich description</p>');
    assert.equal(h.field('aiDetailMeta').children[1].textContent, '<contact>');
    const link = h.field('aiDetailMeta').children[2];
    assert.equal(link.rel, 'noopener noreferrer');
    assert.match(h.field('aiDetailDueBadge').textContent, /overdue/);
    assert.equal(h.field('aiDetailEngLink').href, '/engagement/2');
    assert.equal(h.field('aiDetailEngLink').hidden, false);
    assert.equal(h.field('aiDetailSaveGroup').hidden, true);
    h.open(9);
    assert.equal(h.requests.length, 1);
    h.SBDialog.close(h.dialog);
    assert.equal(h.reloads(), 0);
});

test('HTTP, network, JSON, missing and wrong-record failures show Retry rather than stale content', async () => {
    for (const failure of ['http', 'network', 'json', 'missing', 'wrong']) {
        const h = fixture(), pending = h.open();
        if (failure === 'network') h.requests[0].reject(new Error('Offline'));
        else h.reply(0, failure === 'missing' ? {} :
            {success: true, task: h.task(failure === 'wrong' ? 8 : 9)},
        failure === 'http' ? {ok: false, status: 503} : failure === 'json' ?
            {json: async () => { throw new Error('Invalid JSON'); }} : {});
        await pending;
        assert.equal(h.field('aiDetailReadError').hidden, false);
        assert.equal(h.field('aiDetailViewMode').hidden, true);
        assert.equal(h.errors.length, 1);
        h.field('aiDetailRetry').dispatch('click');
        assert.equal(h.document.activeElement, h.close);
        h.reply(1, {success: true, task: h.task()});
        await settle();
        assert.equal(h.field('aiDetailReadError').hidden, true);
        assert.equal(h.field('aiDetailViewMode').hidden, false);
    }
});

test('new selection and dismissal abort and invalidate all late successes/failures', async () => {
    for (const failed of [false, true]) {
        const h = fixture(), old = h.open(9), newer = h.open(10);
        assert.equal(h.requests[0].options.signal.aborted, true);
        h.reply(1, {success: true, task: h.task(10, {title: 'New record'})});
        await newer;
        if (failed) h.requests[0].reject(new Error('Late failure'));
        else h.reply(0, {success: true, task: h.task(9)});
        await old;
        assert.equal(h.field('aiDetailTitle').textContent, 'New record');
        assert.equal(h.errors.length, 0);
        h.SBDialog.close(h.dialog);
        const reopening = h.open(9);
        h.SBDialog.close(h.dialog);
        assert.equal(h.requests[2].options.signal.aborted, true);
        h.reply(2, {success: true, task: h.task()});
        await reopening;
        assert.equal(h.dialog.open, false);
        assert.equal(h.field('aiDetailViewMode').hidden, true);
    }
});

test('editing retains description HTML, guards dirty close/cancel and preserves failed drafts', async () => {
    const h = fixture();
    await ready(h);
    h.field('aiDetailEditBtn').dispatch('click');
    assert.equal(h.field('aiEditDesc').value, '<p>Rich description</p>');
    assert.equal(h.document.activeElement, h.field('aiEditTitle'));
    h.field('aiEditTitle').value = 'Edited title';
    h.SBDialog.close(h.dialog);
    assert.equal(h.dialog.open, true);
    assert.equal(h.discard.open, true);
    h.SBDialog.close(h.discard);
    assert.equal(h.field('aiEditTitle').value, 'Edited title');
    h.field('aiDetailEditMode').dispatch('submit');
    assert.equal(h.requests[1].options.method, 'PUT');
    assert.equal(JSON.parse(h.requests[1].options.body).title, 'Edited title');
    h.SBDialog.close(h.dialog);
    assert.equal(h.dialog.open, true);
    h.reply(1, {success: false, error: '<save failed>'}, {ok: false, status: 400});
    await settle();
    assert.equal(h.field('aiEditTitle').value, 'Edited title');
    assert.match(h.field('aiDetailResult').textContent, /<save failed>/);
    assert.equal(h.field('aiDetailResult').attributes.role, 'alert');
    assert.equal(h.field('aiEditSaveBtn').disabled, false);
    h.field('aiDetailCancelEdit').dispatch('click');
    h.confirm.dispatch('click');
    assert.equal(h.field('aiDetailEditMode').hidden, true);
    assert.equal(h.field('aiDetailViewMode').hidden, false);
    assert.equal(h.reloads(), 0);
});

test('blank title is explicit; successful PUT returns to view and reloads only on close', async () => {
    const h = fixture();
    await ready(h);
    h.field('aiDetailEditBtn').dispatch('click');
    h.field('aiEditTitle').value = '  ';
    h.field('aiDetailEditMode').dispatch('submit');
    assert.equal(h.requests.length, 1);
    assert.equal(h.field('aiEditTitle').attributes['aria-invalid'], 'true');
    h.field('aiEditTitle').value = 'New title';
    h.field('aiDetailEditMode').dispatch('submit');
    h.reply(1, {success: true, task: h.task(9, {title: 'New title'})});
    await settle();
    assert.equal(h.field('aiDetailTitle').textContent, 'New title');
    assert.equal(h.field('aiDetailEditMode').hidden, true);
    assert.equal(h.document.activeElement, h.close);
    assert.equal(h.reloads(), 0);
    h.SBDialog.close(h.dialog);
    assert.equal(h.reloads(), 1);
});

test('completion gates duplicate writes and restores checked state on failures', async () => {
    const h = fixture();
    await ready(h);
    h.field('aiDetailCompleted').checked = true;
    h.field('aiDetailCompleted').dispatch('change');
    h.field('aiDetailCompleted').dispatch('change');
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].url, '/action-item/9/toggle');
    h.requests[1].reject(new Error('Offline'));
    await settle();
    assert.equal(h.field('aiDetailCompleted').checked, false);
    h.field('aiDetailCompleted').checked = true;
    h.field('aiDetailCompleted').dispatch('change');
    h.reply(2, {success: true, task: h.task(9, {status: 'completed'})});
    await settle();
    assert.equal(h.field('aiDetailCompleted').checked, true);
    h.SBDialog.close(h.dialog);
    assert.equal(h.reloads(), 1);
});

test('Copilot Save retains optional due payload and immediately reflects conversion to project', async () => {
    for (const due of ['', '2026-10-09']) {
        const h = fixture();
        await ready(h, h.task(9, {source: 'copilot'}));
        assert.equal(h.field('aiDetailSaveGroup').hidden, false);
        assert.equal(h.field('aiDetailEditBtn').hidden, true);
        h.field('aiDetailSaveDue').value = due;
        h.field('aiDetailSaveBtn').dispatch('click');
        assert.equal(h.requests[1].url, '/action-item/9/save');
        assert.deepEqual(JSON.parse(h.requests[1].options.body), due ? {due_date: due} : {});
        h.reply(1, {success: true, task: h.task()});
        await settle();
        assert.equal(h.field('aiDetailSaveGroup').hidden, true);
        assert.equal(h.field('aiDetailEditBtn').hidden, false);
        assert.equal(h.field('aiDetailDismissBtn').hidden, true);
    }
});

test('Dismiss and Not Useful retain POST contracts, close only after confirmed success', async () => {
    for (const [control, suffix] of [['aiDetailDismissBtn', '/dismiss'],
        ['aiDetailNotUsefulBtn', '/not-useful']]) {
        const h = fixture();
        await ready(h, h.task(9, {source: 'copilot'}));
        h.field(control).dispatch('click');
        assert.equal(h.requests[1].url, '/action-item/9' + suffix);
        assert.equal(h.requests[1].options.method, 'POST');
        h.reply(1, {success: false, error: 'Rejected'});
        await settle();
        assert.equal(h.dialog.open, true);
        assert.equal(h.field(control).disabled, false);
        h.field(control).dispatch('click');
        h.reply(2, {success: true});
        await settle();
        assert.equal(h.dialog.open, false);
        assert.equal(h.reloads(), 1);
    }
});

test('external Engagement editor closes preview first and receives original task ID', async () => {
    const h = fixture(), edits = [];
    await ready(h, h.task(), {onEdit: id => edits.push({id, open: h.dialog.open})});
    h.field('aiDetailEditBtn').dispatch('click');
    assert.deepEqual(edits, [{id: 9, open: false}]);
    assert.equal(h.requests.length, 1);
});

test('page exit invalidates pending reads and repeated script activation stays idempotent', async () => {
    const h = fixture(), api = h.window.SBActionItemDialog;
    vm.runInNewContext(source, h.context);
    assert.equal(h.window.SBActionItemDialog, api);
    const pending = h.open();
    h.events.pagehide();
    assert.equal(h.requests[0].options.signal.aborted, true);
    h.reply(0, {success: true, task: h.task()});
    await pending;
    assert.equal(h.field('aiDetailViewMode').hidden, true);
    h.events.pageshow({persisted: true});
    h.reply(1, {success: true, task: h.task()});
    await settle();
    assert.equal(h.field('aiDetailViewMode').hidden, false);
});

test('dirty record replacement and navigation require explicit discard; busy writes block both', async () => {
    const h = fixture();
    await ready(h);
    h.field('aiDetailEditBtn').dispatch('click');
    h.field('aiEditTitle').value = 'Draft';
    h.open(10);
    assert.equal(h.discard.open, true);
    assert.equal(h.requests.length, 1);
    h.SBDialog.close(h.discard);
    const link = {href: 'http://127.0.0.1:5000/note/2', target: '',
        closest: () => link, getAttribute: () => '/note/2'};
    const event = h.dialog.dispatch('click', {target: link});
    assert.equal(event.defaultPrevented, true);
    h.confirm.dispatch('click');
    assert.deepEqual(h.navigations, [link.href]);
    h.field('aiDetailEditMode').dispatch('submit');
    const requestCount = h.requests.length;
    h.open(10);
    assert.equal(h.requests.length, requestCount);
    h.reply(requestCount - 1, {success: true, task: h.task()});
    await settle();
});

test('unsupported source schemes are not made clickable or silently substituted', async () => {
    const h = fixture();
    await ready(h, h.task(9, {source_url: 'javascript:alert(1)'}));
    const meta = h.field('aiDetailMeta');
    assert.equal(meta.children[0].textContent, 'Source link unavailable');
    assert.equal(meta.children[0].href, undefined);
    assert.equal(h.errors.length, 1);
});

test('legacy null options keep the default preview behavior', async () => {
    const h = fixture();
    await ready(h, h.task(), null);
    assert.equal(h.field('aiDetailViewMode').hidden, false);
    assert.equal(h.field('aiDetailEngLink').hidden, true);
    assert.equal(h.errors.length, 0);
});
