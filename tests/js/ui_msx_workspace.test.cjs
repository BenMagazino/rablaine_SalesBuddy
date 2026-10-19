const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const template = fs.readFileSync(
    path.join(__dirname, '../../templates/report_msx_workspace.html'), 'utf8');
const source = template.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\r\n/g, '\n');

function fixture({savedFilters = null, initialHistory = {}, query = ''} = {}) {
    const elements = {}, requests = [], dialogs = [], listeners = {}, storage = new Map();
    const storageWrites = [];
    let storageError = null;
    if (savedFilters !== null) storage.set('msxWorkspaceFilters', JSON.stringify(savedFilters));
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
        Object.defineProperty(node, 'innerHTML', {
            get() {
                return this._html ?? this.textContent.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            },
            set(value) { this._html = value; },
        });
        node.tHead = {cloneNode: () => element('head')};
        return node;
    }
    const get = id => elements[id] ||= element(id);
    const statuses = ['On Track', 'At Risk', 'Blocked', 'Completed', 'Cancelled',
        'Lost to Competitor'].map((value, index) => ({value, checked: index < 3,
            addEventListener() {}}));
    get('msStatusFilterWrap').querySelectorAll = selector =>
        selector.endsWith(':checked') ? statuses.filter(cb => cb.checked) : statuses;
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
    const window = {location: {search: query}, addEventListener(event, callback) {
        if (event === 'DOMContentLoaded') this.start = callback;
        else listeners[event] = callback;
    }, setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }};
    const history = {state: initialHistory, replaceState(state) { this.state = state; }};
    let reply = async () => ({ok: true, json: async () =>
        ({tasks: [], milestones: [], opportunities: []})});
    const context = {window, document, history, URLSearchParams, AbortController,
        SBWorkloadFilter: {
            matches: require('../../static/js/ui-workload-filter.js').matches,
            create(host, options) {
                assert.equal(options.storageKey, 'salesbuddy_msx_workspace_workload_prefixes');
                let selected = JSON.parse(storage.get(options.storageKey) || '[]');
                const picker = {
                    getSelected: () => selected,
                    setChoices(values) { host.choices = values; },
                    setSelected(values) {
                        selected = values;
                        storage.set(options.storageKey, JSON.stringify(values));
                        options.onChange();
                    },
                };
                host.picker = picker;
                return picker;
            },
        },
        localStorage: {getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => {
                if (key === 'msxWorkspaceFilters' && storageError) throw storageError;
                storageWrites.push(key);
                storage.set(key, value);
            }, removeItem: key => storage.delete(key)},
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
        SBRecordDialog: {create: (id, options) => ({open: selection => {
            dialogs.push(['opportunity', id, selection, options]);
        }})},
        SBOpportunityWorkflow: {activate() {}},
        confirm: () => true,
    };
    const instrumented = source.replace(/    restoreView\(\);\n\}\);\s*$/, `
    mountSort = () => {};
    window.hooks = {readRecords, renderOpportunities, renderTasks, showTab, saveView,
        openOppDetail,
        restoreView, applyAll, loadOpportunities, loadMilestones, loadTasks,
        allowContextChange, persistFilters,
        setScope: value => appliedScope = value,
        setOpps: value => oppsData = value,
        setTasks: value => tasksData = value,
        setPositions: value => readingPositions = value};
});`);
    assert.notEqual(instrumented, source);
    vm.runInNewContext(instrumented, context);
    window.start();
    return {get, requests, dialogs, history, hooks: window.hooks, listeners, timers, statuses,
        storage, storageWrites, failStorage: error => { storageError = error; },
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
    h.hooks.setScope({seller: '2', customer: '3', search: 'applied scope'});
    h.get('msTeamFilter').value = 'on';
    h.get('msOppFilter').value = '17';
    h.statuses[0].checked = false;
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
    const refreshed = new URL(h.requests[1].url, 'http://localhost');
    assert.equal(refreshed.searchParams.get('seller_id'), null);
    assert.equal(refreshed.searchParams.get('customer_id'), '3');
    assert.equal(refreshed.searchParams.get('search'), 'applied scope');
    assert.equal(h.get('msTeamFilter').value, 'on');
    assert.equal(h.get('msOppFilter').value, '17');
    assert.equal(h.statuses[0].checked, false);
});

function savedScope() {
    return {values: {
        filterSeller: '2', filterCustomer: '3', filterSearch: 'saved scope',
        oppStatusFilter: 'open', oppTeamFilter: 'on', msTeamFilter: 'on',
        msOppFilter: '17',
    }, statuses: ['At Risk', 'Blocked'], tab: 'ms-tab'};
}

test('a fresh report window restores localStorage filters without history or preference requests',
    async () => {
        const h = fixture({savedFilters: savedScope()});
        await h.hooks.restoreView();
        assert.equal(h.get('filterSearch').value, 'saved scope');
        assert.equal(h.get('msOppFilter').value, '17');
        assert.equal(h.get('ms-tab')['aria-selected'], 'true');
        assert.deepEqual(h.statuses.filter(cb => cb.checked).map(cb => cb.value),
            ['At Risk', 'Blocked']);
        const url = new URL(h.requests.find(r => r.url.includes('/milestones?')).url,
            'http://localhost');
        assert.equal(url.searchParams.get('customer_id'), '3');
        assert.equal(url.searchParams.get('opportunity_id'), '17');
        assert.equal(h.requests.length, 3);
        assert.equal(h.storageWrites.includes('msxWorkspaceFilters'), false);
    });

test('history retains its local scope while an explicit URL chooses the tab', async () => {
    const historyScope = savedScope();
    historyScope.values.filterSearch = 'history draft';
    historyScope.appliedScope = {seller: '2', customer: '3', search: 'history applied'};
    historyScope.positions = {};
    const h = fixture({savedFilters: savedScope(),
        initialHistory: {sbMsxWorkspace: historyScope}, query: '?tab=tasks'});
    await h.hooks.restoreView();
    assert.equal(h.get('filterSearch').value, 'history draft');
    assert.equal(h.get('tasks-tab')['aria-selected'], 'true');
    const url = new URL(h.requests.find(r => r.url.includes('/tasks?')).url, 'http://localhost');
    assert.equal(url.searchParams.get('search'), 'history applied');
});

test('persistence saves applied scope, not unsubmitted edits or reading positions', async () => {
    const h = fixture();
    h.hooks.setScope({seller: '2', customer: '3', search: 'applied'});
    h.get('filterSearch').value = 'not applied';
    h.get('msTeamFilter').value = 'on';
    h.hooks.setPositions({opps: {top: 99}});
    await h.hooks.persistFilters();
    const saved = JSON.parse(h.storage.get('msxWorkspaceFilters'));
    assert.equal(saved.values.filterSearch, 'applied');
    assert.equal(saved.values.msTeamFilter, 'on');
    assert.equal(saved.positions, undefined);
    assert.equal(saved.milestoneId, undefined);
    h.hooks.saveView();
    assert.equal(h.requests.length, 0);
    assert.deepEqual(h.storageWrites, ['msxWorkspaceFilters']);
});

test('failed persistence is visible and Apply can retry the same state', async () => {
    const h = fixture();
    h.failStorage(new Error('Disk unavailable'));
    await h.hooks.persistFilters();
    assert.match(h.get('taskEditorStatus').textContent, /not saved.*Disk unavailable/);
    h.failStorage(null);
    await h.hooks.persistFilters();
    assert.ok(h.storage.has('msxWorkspaceFilters'));
    assert.equal(h.requests.length, 0);
});

test('Clear persists the default scope and active milestone statuses', async () => {
    const h = fixture({savedFilters: savedScope()});
    await h.hooks.restoreView();
    h.get('btnClearFilters').handlers.click();
    const saved = JSON.parse(h.storage.get('msxWorkspaceFilters'));
    assert.deepEqual(saved.values, {
        filterSeller: '', filterCustomer: '', filterSearch: '', oppStatusFilter: 'open',
        oppTeamFilter: '', msTeamFilter: '', msOppFilter: '',
    });
    assert.deepEqual(saved.statuses, ['On Track', 'At Risk', 'Blocked']);
});

test('immediate workload and empty status changes are persisted without applying scope drafts',
    async () => {
        const h = fixture({savedFilters: savedScope()});
        await h.hooks.restoreView();
        h.get('filterSearch').value = 'not applied';
        h.get('msWorkloadFilter').picker.setSelected(['Apps', 'Sec']);
        let saved = JSON.parse(h.storage.get('msxWorkspaceFilters'));
        assert.deepEqual(JSON.parse(h.storage.get('salesbuddy_msx_workspace_workload_prefixes')),
            ['Apps', 'Sec']);
        assert.equal(saved.values.msWorkloadFilter, undefined);
        assert.equal(saved.values.filterSearch, 'saved scope');
        h.get('msStatusNone').handlers.click();
        saved = JSON.parse(h.storage.get('msxWorkspaceFilters'));
        assert.deepEqual(saved.statuses, []);
        const lastRead = new URL(h.requests.at(-1).url, 'http://localhost');
        assert.equal(lastRead.searchParams.has('status'), false);
    });

test('MSX workload selection matches prefixes and leaves unavailable selections restrictive',
    async () => {
        const h = fixture();
        const milestones = [
            {id: 1, title: 'App work', workload: 'Apps: App Service'},
            {id: 2, title: 'Defender work', workload: 'Sec: Defender'},
            {id: 3, title: 'Unselected Infra work', workload: 'Infra: Networking'},
        ];
        h.reply(async () => ({ok: true, json: async () => ({milestones})}));
        await h.hooks.loadMilestones();
        h.get('msWorkloadFilter').picker.setSelected(['Apps', 'Sec']);
        assert.match(h.get('msBody').innerHTML, /App work/);
        assert.match(h.get('msBody').innerHTML, /Defender work/);
        assert.doesNotMatch(h.get('msBody').innerHTML, /Unselected Infra work/);
        assert.equal(h.get('msCount').textContent, 2);
        h.get('msWorkloadFilter').picker.setSelected(['Unavailable']);
        assert.match(h.get('msBody').innerHTML, /No milestones found/);
        assert.equal(h.get('msCount').textContent, 0);
    });

test('unreadable localStorage filters are reported and Apply can replace them', async () => {
    const h = fixture();
    h.storage.set('msxWorkspaceFilters', '{broken');
    await h.hooks.restoreView();
    assert.match(h.get('taskEditorStatus').textContent, /could not be restored/);
    h.get('filterSearch').value = 'replacement';
    await h.hooks.applyAll();
    assert.equal(JSON.parse(h.storage.get('msxWorkspaceFilters')).values.filterSearch,
        'replacement');
});

for (const change of [{statuses: ['Invalid']}, {values: {}}, {tab: 'unknown'}]) {
    test(`invalid localStorage filter state is reported: ${JSON.stringify(change)}`, async () => {
        const h = fixture({savedFilters: {...savedScope(), ...change}});
        await h.hooks.restoreView();
        assert.match(h.get('taskEditorStatus').textContent, /Invalid saved report filters/);
        assert.equal(h.get('filterSearch').value, '');
    });
}

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

test('opportunity previews use the shared guarded lifecycle and exact destinations', async () => {
    const h = fixture();
    h.hooks.openOppDetail('17', 'Deal', 'https://example.com/deal');
    const [, id, selection, options] = h.dialogs[0];
    assert.equal(id, 'msxOppDetailModal');
    assert.equal(selection.id, 17);
    assert.equal(selection.title, 'Deal');
    assert.equal(options.loadUrl(17), '/api/opportunity/17/detail');
    assert.equal(options.fullUrl(17), '/opportunity/17');
    assert.equal(options.identityAttribute, 'data-sb-opportunity-id');
    assert.equal(options.stateEvent, 'sb:record-state');
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
