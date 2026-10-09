const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {addTask, validateHistory} = require('../../static/js/ui-project-detail.js');
const source = fs.readFileSync('static/js/ui-project-detail.js', 'utf8');

test('project reading history uses raw offset and rejects wrong or invalid identity', () => {
    const state = {id: 3, top: 299.5};
    assert.equal(validateHistory(state, 3), state);
    for (const bad of [null, {}, {...state, id: 4}, {...state, top: -1},
        {...state, top: Infinity}, {...state, top: '100'}]) {
        assert.throws(() => validateHistory(bad, 3));
    }
});

test('manual task writes keep the exact payload and reject HTTP, JSON and identity failures', async () => {
    const original = global.fetch;
    const calls = [];
    try {
        global.fetch = async (url, options) => {
            calls.push({url, options});
            return {ok: true, json: async () => ({success: true, id: 12})};
        };
        assert.equal((await addTask(3, {title: 'Trimmed'})).id, 12);
        assert.equal(calls[0].url, '/api/project/3/action-item');
        assert.equal(calls[0].options.method, 'POST');
        assert.deepEqual(JSON.parse(calls[0].options.body), {title: 'Trimmed'});
        await addTask(3, {title: 'Dated', due_date: '2027-01-01'});
        assert.deepEqual(JSON.parse(calls[1].options.body), {
            title: 'Dated', due_date: '2027-01-01',
        });
        for (const data of [{success: false}, {success: true}, {success: true, id: '12'},
            {success: true, id: -1}, {success: true, id: 1.5}]) {
            global.fetch = async () => ({ok: true, json: async () => data});
            await assert.rejects(addTask(3, {title: 'Retained'}));
        }
        global.fetch = async () => ({ok: false, json: async () => ({success: true, id: 12})});
        await assert.rejects(addTask(3, {title: 'Retained'}));
        global.fetch = async () => ({ok: true, json: async () => { throw Error('Broken JSON'); }});
        await assert.rejects(addTask(3, {title: 'Retained'}));
    } finally { global.fetch = original; }
});

function harness(embedded = false) {
    class Element {
        constructor() {
            this.handlers = {}; this.value = ''; this.hidden = false; this.disabled = false;
            this.dataset = {}; this.attributes = {}; this.scrollTop = 0;
        }
        addEventListener(name, fn) { (this.handlers[name] ||= new Set()).add(fn); }
        removeEventListener(name, fn) { this.handlers[name]?.delete(fn); }
        dispatch(name, extra = {}) {
            const event = {target: this, detail: {}, preventDefault() {
                this.defaultPrevented = true;
            }, ...extra};
            for (const handler of this.handlers[name] || []) handler(event);
            return event;
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        getAttribute(name) { return this.attributes[name]; }
        hasAttribute(name) { return name in this.attributes; }
        reportValidity() { return true; }
        closest() { return this; }
    }
    const fields = new Map();
    const field = name => {
        if (!fields.has(name)) fields.set(name, new Element());
        return fields.get(name);
    };
    const root = new Element(), parent = embedded ? new Element() : null;
    root.isConnected = true;
    root.dataset.sbProjectDetail = '3';
    root.closest = () => parent;
    root.contains = el => [...fields.values()].includes(el);
    root.classList = {contains: () => !embedded};
    root.querySelector = field;
    root.querySelectorAll = () => [field('task')];
    field('task').dataset.projectTask = '9';
    field('#addTaskForm').querySelector = () => field('save');
    const window = new Element(), requests = [], opens = [], errors = [];
    let reloads = 0, back = 0, disposed = 0, taskDirty = false, taskBusy = false;
    window.confirm = () => false;
    window.document = {referrer: 'http://127.0.0.1:5000/reports/initiative-tracker'};
    window.location = {origin: 'http://127.0.0.1:5000', reload: () => reloads++};
    window.history = {length: 2, state: {keep: 'parent', sbProjectDetail: {id: 3, top: 84}},
        back: () => back++, replaceState(value) { this.state = value; }};
    window.fetch = (url, options) => new Promise((resolve, reject) =>
        requests.push({url, options, resolve, reject}));
    window.SBActionItemDialog = {mount: (_dialog, options) => ({
        open: id => opens.push(id), isDirty: () => taskDirty, isBusy: () => taskBusy,
        dispose: () => disposed++, onChanged: options.onChanged,
    })};
    vm.runInNewContext(source, {window, console: {error: (...args) => errors.push(args)}});
    const api = window.SBProjectDetail.mount(root);
    return {window, root, parent, field, api, requests, opens, errors,
        reloads: () => reloads, back: () => back, disposed: () => disposed,
        setTask: (dirty, busy) => { taskDirty = dirty; taskBusy = busy; }};
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

test('quick-add prevents duplicate saves and retains drafts on failure for successful retry', async () => {
    const h = harness();
    h.field('#newTaskTitle').value = '  New follow-up  ';
    h.field('#newTaskDue').value = '2027-01-02';
    h.field('#addTaskForm').dispatch('submit');
    h.field('#addTaskForm').dispatch('submit');
    assert.equal(h.requests.length, 1);
    assert.equal(h.api.isBusy(), true);
    assert.equal(h.field('save').disabled, true);
    assert.deepEqual(JSON.parse(h.requests[0].options.body),
        {title: 'New follow-up', due_date: '2027-01-02'});
    h.requests[0].reject(Error('Offline'));
    await settle();
    assert.equal(h.api.isBusy(), false);
    assert.equal(h.field('save').disabled, false);
    assert.equal(h.field('#newTaskTitle').value, '  New follow-up  ');
    assert.equal(h.field('#newTaskDue').value, '2027-01-02');
    assert.match(h.field('[data-project-notice]').textContent, /retained.*Retry/);
    assert.equal(h.reloads(), 0);
    h.field('#addTaskForm').dispatch('submit');
    h.requests[1].resolve({ok: true, json: async () => ({success: true, id: 10})});
    await settle();
    assert.equal(h.reloads(), 1);
});

test('full page keeps actual Back context, reading offset and mounted task identity', () => {
    const h = harness();
    assert.equal(h.field('[data-project-reading]').scrollTop, 84);
    h.field('[data-project-reading]').scrollTop = 220;
    h.field('[data-project-reading]').dispatch('scroll');
    assert.equal(h.window.history.state.sbProjectDetail.top, 220);
    assert.equal(h.window.history.state.keep, 'parent');
    const link = h.field('link');
    link.attributes.href = '/engagements';
    link.attributes['data-project-back'] = '';
    h.root.dispatch('click', {target: link});
    assert.equal(h.back(), 1);
    h.field('task').dispatch('click');
    assert.deepEqual(h.opens, [9]);
    h.field('#newTaskTitle').value = 'Draft';
    h.root.dispatch('click', {target: link});
    assert.equal(h.back(), 1);
    assert.equal(h.window.dispatch('beforeunload').defaultPrevented, true);
    assert.equal(h.requests.length, 0);
});

test('nested task drafts guard parent close, replacement and full-page navigation, not child closes', () => {
    const h = harness(true);
    h.setTask(true, false);
    assert.equal(h.api.isDirty(), true);
    assert.equal(h.parent.dispatch('sb:dialog-before-close').defaultPrevented, true);
    assert.equal(h.parent.dispatch('sb:dialog-before-close', {
        target: h.field('#actionItemDetailModal'),
    }).defaultPrevented, undefined);
    const full = h.field('full');
    full.id = 'managerWorkFullLink';
    full.attributes.href = '/project/3';
    assert.equal(h.parent.dispatch('click', {target: full}).defaultPrevented, true);
    h.setTask(false, true);
    assert.equal(h.parent.dispatch('sb:dialog-before-close').defaultPrevented, true);
    h.setTask(false, false);
    assert.equal(h.parent.dispatch('sb:dialog-before-close').defaultPrevented, undefined);
    h.api.dispose();
    h.api.dispose();
    assert.equal(h.disposed(), 1);
    assert.equal(h.window.handlers.beforeunload.size, 0);
    assert.equal(h.parent.handlers['sb:dialog-before-close'].size, 0);
});
