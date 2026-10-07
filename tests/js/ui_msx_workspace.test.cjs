const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const template = fs.readFileSync(
    path.join(__dirname, '../../templates/report_msx_workspace.html'), 'utf8');
const source = template.match(/<script>([\s\S]*?)<\/script>/)[1];

function fixture() {
    const elements = {}, requests = [], dialogs = [], listeners = {}, storage = new Map();
    const timers = new Map();
    const classes = () => {
        const set = new Set();
        return {add: key => set.add(key), remove: key => set.delete(key),
            contains: key => set.has(key),
            toggle: (key, active) => active ? set.add(key) : set.delete(key)};
    };
    function element(id) {
        const node = {id, value: '', innerHTML: '', textContent: '', dataset: {}, style: {},
            classList: classes(), handlers: {}, hidden: false, scrollTop: 0, scrollLeft: 0,
            options: [], selectedIndex: 0, disabled: false,
            addEventListener(event, callback) { this.handlers[event] = callback; },
            setAttribute(name, value) { this[name] = value; },
            append() {}, replaceChildren() {}, focus() {}, remove() {},
            cloneNode() { return element(id); },
            querySelectorAll(selector) {
                if (selector.includes('ms-status-cb')) return [];
                if (selector === '.deal-team-toggle') return this.teamButtons || [];
                if (selector === '.close-task-btn') return this.closeButtons || [];
                return [];
            },
            querySelector() { return null; },
            closest() { return this.parent || this; },
        };
        node.tHead = {cloneNode: () => element('head')};
        return node;
    }
    const get = id => elements[id] ||= element(id);
    const tabs = ['opps-tab', 'ms-tab', 'tasks-tab'].map((id, index) => {
        const tab = get(id);
        tab.dataset.msxPane = ['oppsPane', 'msPane', 'tasksPane'][index];
        return tab;
    });
    let active = tabs[0];
    for (const [index, id] of ['oppsReading', 'msReading', 'tasksReading'].entries()) {
        get(id).parent = get(tabs[index].dataset.msxPane);
    }
    const document = {
        getElementById: get, createElement: tag => element(tag), body: element('body'),
        querySelectorAll(selector) {
            if (selector.includes('.msx-tab') || selector === '[data-msx-pane]') return tabs;
            if (selector === '.msx-reading') {
                return ['oppsReading', 'msReading', 'tasksReading'].map(get);
            }
            return [];
        },
        querySelector(selector) {
            if (selector.includes('msx-tab.active')) {
                active = tabs.find(tab => tab['aria-selected'] === 'true') || active;
                return active;
            }
            if (selector.includes('msx-reading')) {
                active = tabs.find(tab => tab['aria-selected'] === 'true') || active;
                return get(['oppsReading', 'msReading', 'tasksReading'][tabs.indexOf(active)]);
            }
            return null;
        },
    };
    const window = {location: {search: ''}, addEventListener(event, callback) {
        if (event === 'DOMContentLoaded') this.start = callback;
        else listeners[event] = callback;
    }, setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }};
    const history = {state: {}, replaceState(state) { this.state = state; }};
    let reply = async () => ({ok: true, json: async () => ({tasks: []})});
    const context = {window, document, history, URLSearchParams, AbortController,
        localStorage: {getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
        fetch: async (url, options) => { requests.push({url, options}); return reply(url, options); },
        setTimeout: () => 1, console, CSS: {escape: id => id},
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        SBDialog: {open: dialog => dialogs.push(['open', dialog]),
            close: (dialog, reason) => dialogs.push(['close', dialog, reason])},
        SBMilestonePreview: {open() {}},
        confirm: () => true,
    };
    const instrumented = source.replace(/    restoreView\(\);\n\}\);\s*$/, `
    mountSort = () => {};
    window.hooks = {readRecords, renderOpportunities, renderTasks, showTab, saveView,
        mountOpportunityBridge, opportunityDirty,
        restoreView, applyAll, loadOpportunities, loadTasks, allowContextChange,
        setScope: value => appliedScope = value,
        setOpps: value => oppsData = value,
        setTasks: value => tasksData = value,
        setPositions: value => readingPositions = value};
});`);
    assert.notEqual(instrumented, source);
    vm.runInNewContext(instrumented, context);
    window.start();
    return {get, requests, dialogs, history, hooks: window.hooks, listeners, timers,
        reply: fn => { reply = fn; }};
}

test('read errors are explicit and do not become empty successful datasets', async () => {
    const h = fixture();
    h.reply(async () => ({ok: false, status: 503}));
    await assert.rejects(h.hooks.readRecords('tasks', ''), /HTTP 503/);
    h.reply(async () => ({ok: true, json: async () => ({error: 'offline'})}));
    await assert.rejects(h.hooks.readRecords('tasks', ''), /Invalid cached tasks/);
});

test('a late cached read cannot replace a more recent scope', async () => {
    const h = fixture();
    const resolvers = [];
    h.reply(() => new Promise(resolve => resolvers.push(resolve)));
    const old = h.hooks.readRecords('tasks', 'search=old');
    const next = h.hooks.readRecords('tasks', 'search=new');
    resolvers[1]({ok: true, json: async () => ({tasks: [{subject: 'new'}]})});
    assert.equal((await next).tasks[0].subject, 'new');
    resolvers[0]({ok: true, json: async () => ({tasks: [{subject: 'old'}]})});
    assert.equal(await old, null);
});

test('a stale failed read cannot replace a later successful scope with an error', async () => {
    const h = fixture();
    const resolvers = [];
    h.reply(() => new Promise(resolve => resolvers.push(resolve)));
    const old = h.hooks.readRecords('tasks', 'search=old');
    const next = h.hooks.readRecords('tasks', 'search=new');
    resolvers[1]({ok: true, json: async () => ({tasks: []})});
    await next;
    resolvers[0]({ok: false, status: 503});
    assert.equal(await old, null);
});

test('scope prioritizes customer over seller and preserves literal keyword payload', async () => {
    const h = fixture();
    h.hooks.setScope({customer: '12', seller: '3', search: 'demo & owner'});
    h.reply(async () => ({ok: true, json: async () => ({opportunities: []})}));
    await h.hooks.loadOpportunities();
    const url = new URL(h.requests[0].url, 'http://localhost');
    assert.equal(url.searchParams.get('customer_id'), '12');
    assert.equal(url.searchParams.get('seller_id'), null);
    assert.equal(url.searchParams.get('search'), 'demo & owner');
});

test('task creation retains exact category, GUID and UTC due-date payload', async () => {
    const h = fixture();
    h.get('taskMilestoneId').value = 'ms-guid';
    h.get('taskSubject').value = ' Demo ';
    h.get('taskCategory').value = '861980002';
    h.get('taskDescription').value = ' Customer demo ';
    h.get('taskDueDate').value = '2026-10-08';
    h.reply(async (url, options) => ({ok: true, json: async () =>
        options?.method === 'POST' ? {success: true} : {tasks: []}}));
    await h.get('btnSubmitTask').handlers.click.call(h.get('btnSubmitTask'));
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {
        milestone_id: 'ms-guid', subject: 'Demo', task_category: 861980002,
        description: 'Customer demo', due_date: '2026-10-08T00:00:00Z',
    });
    assert.equal(h.requests[0].url, '/api/msx/tasks');
    assert.equal(h.get('taskSubject').value, '');
    assert.deepEqual(h.dialogs[0], ['close', 'createTaskModal', 'saved']);
    assert.equal(h.get('btnSubmitTask').disabled, false);
});

test('failed task creation keeps the draft and re-enables retry', async () => {
    const h = fixture();
    h.get('taskMilestoneId').value = 'ms-guid';
    h.get('taskSubject').value = 'Keep me';
    h.get('taskCategory').value = '861980002';
    h.reply(async () => ({ok: true, json: async () => ({success: false, error: 'Offline'})}));
    await h.get('btnSubmitTask').handlers.click.call(h.get('btnSubmitTask'));
    assert.equal(h.get('taskSubject').value, 'Keep me');
    assert.equal(h.get('btnSubmitTask').disabled, false);
    assert.equal(h.dialogs.length, 0);
    assert.equal(h.get('taskEditorStatus').textContent, 'Offline');
});

test('pending creation blocks dismissal and drafted fields protect scope changes', async () => {
    const h = fixture();
    h.get('taskMilestoneId').value = 'ms-guid';
    h.get('taskSubject').value = 'Keep me';
    h.get('taskCategory').value = '1';
    assert.equal(h.hooks.allowContextChange(), false);
    let resolve;
    h.reply(() => new Promise(done => { resolve = done; }));
    const pending = h.get('btnSubmitTask').handlers.click.call(h.get('btnSubmitTask'));
    let blocked = false;
    h.get('createTaskModal').handlers['sb:dialog-before-close']({
        preventDefault() { blocked = true; },
    });
    assert.equal(blocked, true);
    resolve({ok: true, json: async () => ({success: false, error: 'Rejected'})});
    await pending;
    assert.equal(h.get('taskSubject').value, 'Keep me');
});

test('task validation makes no request without a subject or milestone', async () => {
    const h = fixture();
    await h.get('btnSubmitTask').handlers.click.call(h.get('btnSubmitTask'));
    h.get('taskMilestoneId').value = 'ms-guid';
    await h.get('btnSubmitTask').handlers.click.call(h.get('btnSubmitTask'));
    assert.equal(h.requests.length, 0);
});

test('tab changes restore independent scroll positions rather than hidden-pane zeroes', () => {
    const h = fixture();
    h.get('oppsReading').scrollTop = 120;
    h.hooks.setPositions({oppsReading: [120, 0], msReading: [340, 25]});
    h.hooks.showTab('ms-tab');
    assert.equal(h.get('msReading').scrollTop, 340);
    assert.equal(h.get('msReading').scrollLeft, 25);
    assert.equal(h.history.state.sbMsxWorkspace.positions.oppsReading[0], 120);
    h.hooks.showTab('opps-tab');
    assert.equal(h.get('oppsReading').scrollTop, 120);
    assert.equal(h.get('msPane').hidden, true);
    assert.equal(h.get('opps-tab')['aria-selected'], 'true');
});

test('legacy opportunity requests, timers and selectors belong to their native host', async () => {
    const h = fixture();
    const child = {id: 'commentText'};
    const host = {isConnected: true, querySelector: selector =>
        selector === '#commentText' ? child : null, querySelectorAll: () => []};
    const bridge = h.hooks.mountOpportunityBridge(host);
    assert.equal(bridge.document.getElementById('commentText'), child);
    assert.equal(bridge.document.getElementById('taskSubject'), null);
    let resolve;
    h.reply(() => new Promise(done => { resolve = done; }));
    const pending = bridge.fetch('/api/opportunity/17/comment',
        {method: 'PUT', body: '{"comment":"draft"}'});
    assert.equal(bridge.busy, true);
    assert.equal(h.requests[0].options.body, '{"comment":"draft"}');
    assert.equal(h.requests[0].options.signal.aborted, false);
    let retries = 0;
    bridge.setTimeout(() => retries++, 1500);
    assert.equal(h.timers.size, 1);
    bridge.dispose();
    assert.equal(h.requests[0].options.signal.aborted, true);
    assert.equal(h.timers.size, 0);
    resolve({ok: true, json: async () => ({success: true})});
    const response = await pending;
    assert.equal(bridge.busy, true);
    await response.json();
    assert.equal(bridge.busy, false);
    assert.equal(retries, 0);
});

test('legacy inline team actions use local controller functions with unchanged IDs', () => {
    const h = fixture();
    const calls = [];
    const buttons = ['joinDealTeam(17)', 'leaveDealTeam(18)'].map(inline => ({
        getAttribute: () => inline, removeAttribute(name) { this.removed = name; },
        addEventListener(event, handler) { this.click = handler; },
    }));
    const bridge = h.hooks.mountOpportunityBridge({querySelectorAll: () => buttons});
    bridge.bindTeam(id => calls.push(['join', id]), id => calls.push(['leave', id]));
    buttons.forEach(button => button.click());
    assert.deepEqual(calls, [['join', 17], ['leave', 18]]);
    assert.equal(buttons[0].removed, 'onclick');
});

test('deal-team success keeps the established payload and raw membership key', async () => {
    const h = fixture();
    const button = h.get('team');
    const cell = h.get('teamCell');
    button.parent = cell;
    button.dataset = {id: '17', onTeam: '0'};
    h.get('oppsBody').teamButtons = [button];
    h.hooks.setOpps([{id: 17, name: 'Deal', on_deal_team: false}]);
    h.hooks.renderOpportunities();
    h.reply(async () => ({ok: true, json: async () => ({success: true})}));
    await button.handlers.click.call(button, {preventDefault() {}, stopPropagation() {}});
    assert.equal(h.requests[0].url, '/api/msx/join-deal-team');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {opportunity_id: 17});
    assert.equal(cell.dataset.sbSortValue, 1);
    assert.match(cell.innerHTML, /data-on-team="1"/);
});

test('rejected team action keeps the original membership and permits retry', async () => {
    const h = fixture();
    const button = h.get('team');
    const cell = h.get('teamCell');
    button.parent = cell;
    button.dataset = {id: '17', onTeam: '1'};
    cell.dataset.sbSortValue = '1';
    h.get('oppsBody').teamButtons = [button];
    h.hooks.setOpps([{id: 17, name: 'Deal', on_deal_team: true}]);
    h.hooks.renderOpportunities();
    h.reply(async () => ({ok: true, json: async () => ({success: false, error: 'Rejected'})}));
    await button.handlers.click.call(button, {preventDefault() {}, stopPropagation() {}});
    assert.equal(h.requests[0].url, '/api/msx/leave-deal-team');
    assert.equal(cell.dataset.sbSortValue, '1');
    assert.equal(button.disabled, false);
});
