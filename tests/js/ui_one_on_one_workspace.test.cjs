const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {createSaveQueue} = require('../../static/js/ui-one-on-one-save.js');
const {validateView, createReadingController} = require('../../static/js/ui-one-on-one-reading.js');

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('initial rendering and clean blur never write or mark notes dirty', async () => {
    let value = '<p>Rich table</p>';
    const writes = [];
    const queue = createSaveQueue({read: () => value, write: v => writes.push(v), state() {}});
    value += '<div>Editor chrome, not an edit</div>';
    assert.equal(queue.dirty(), false);
    await queue.save();
    assert.deepEqual(writes, []);
    queue.dispose();
});

test('changes during a save are serialized and the newest value is persisted', async () => {
    let value = '';
    const requests = [], states = [];
    const queue = createSaveQueue({
        read: () => value, state: v => states.push(v),
        write(v) { const request = deferred(); requests.push({v, ...request}); return request.promise; },
    });
    value = 'First'; queue.change();
    const first = queue.save();
    await tick();
    value = 'Newest'; queue.change();
    assert.equal(queue.save(), first);
    assert.equal(queue.dirty(), true);
    requests[0].resolve();
    await tick();
    assert.deepEqual(requests.map(r => r.v), ['First', 'Newest']);
    requests[1].resolve();
    await first;
    assert.equal(queue.dirty(), false);
    assert.equal(states.at(-1), 'saved');
    queue.dispose();
});

test('failure retains pending protection and explicit retry sends the unchanged draft', async () => {
    let value = '';
    let attempts = 0;
    const states = [];
    const queue = createSaveQueue({
        read: () => value, state: v => states.push(v),
        write() { if (++attempts === 1) throw new Error('Offline'); },
    });

    value = 'Draft'; queue.change();
    await assert.rejects(queue.save(), /Offline/);
    assert.equal(queue.dirty(), true);
    assert.equal(states.at(-1), 'failed');
    await queue.save();
    assert.equal(queue.dirty(), false);
    assert.equal(attempts, 2);
    queue.dispose();
});

test('reverting a draft before debounce restores Saved without a redundant write', async () => {
    let value = 'Original';
    const writes = [], states = [];
    const queue = createSaveQueue({
        read: () => value, write: v => writes.push(v), state: v => states.push(v),
    });
    value = 'Draft'; queue.change();
    value = 'Original'; queue.change();
    await queue.save();
    assert.equal(queue.dirty(), false);
    assert.equal(states.at(-1), 'saved');
    assert.deepEqual(writes, []);
    queue.dispose();
});

test('debounce retains rich table-only and empty values', async () => {
    let value = '';
    const writes = [];
    const queue = createSaveQueue({
        read: () => value, write: v => writes.push(v), state() {}, delay: 5,
    });
    value = '<table><tr><td><br></td></tr></table>'; queue.change();
    await new Promise(resolve => setTimeout(resolve, 15));
    value = ''; queue.change();
    await queue.save();
    assert.deepEqual(writes, ['<table><tr><td><br></td></tr></table>', '']);
    queue.dispose();
});

test('disposing a replaced embedded workspace cancels delayed writes', async () => {
    let value = '';
    const writes = [];
    const queue = createSaveQueue({read: () => value, write: v => writes.push(v), state() {}, delay: 5});
    value = 'Do not leak to replaced host'; queue.change(); queue.dispose();
    await new Promise(resolve => setTimeout(resolve, 15));
    await queue.save();
    assert.deepEqual(writes, []);
});

function element() {
    const values = new Set();
    return {
        value: '', textContent: '', dataset: {}, style: {}, hidden: false, children: [],
        classList: {add: v => values.add(v), remove: v => values.delete(v),
            contains: v => values.has(v), toggle(v, on) { on ? values.add(v) : values.delete(v); }},
        events: {}, addEventListener(name, fn) { this.events[name] = fn; },
        setAttribute() {}, append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
        focus() {}, querySelector() { return element(); }, querySelectorAll() { return []; },
    };
}

function harness() {
    const ids = {}, requests = [], timers = new Map(), windowEvents = {}, reloads = [];
    let timerId = 0;
    let confirmed = false, failed = false;
    for (const name of ['workspaceNotes', 'workspaceSaveState', 'workspaceRetrySave',
        'saveEngagementDetails', 'editEngagementError', 'editEngagementTitle',
        'editEngagementStatus', 'editEngagementProblem', 'editEngagementImpact',
        'editEngagementResources', 'editEngagementAcr', 'editEngagementTarget',
        'agendaCandidates', 'candidateError', 'agendaCandidateSearch', 'addAgendaModal',
        'editEngagementModal', 'editEngagementCustomer', 'editEngagementFullLink']) {
        ids[name] = element();
    }
    const root = element(); root.isConnected = true;
    const state = element(), retry = element(), points = element(), draft = element();
    const row = element(); row.dataset.agendaItemId = '7';
    const composer = element(), noteError = element(), flow = element(), titleInput = element();
    titleInput.value = 'Linked work';
    const flowError = element();
    const noteSave = element(), create = element(), edit = element();
    edit.dataset.editEngagement = '9';
    const actions = ['discuss', 'restore', 'delete'].map(action => {
        const button = element(); button.dataset.agendaAction = action; button.closest = () => row;
        return button;
    });
    const selectors = {'[data-item-save-state]': state, '[data-item-retry]': retry,
        '[data-note-composer]': composer, 'small.ow-muted': {textContent: 'Original customer'}};
    row.querySelector = name => selectors[name] || element();
    points.closest = () => row;
    draft.closest = () => composer;
    composer.querySelector = selector => selector === '[data-discussion-note]' ? draft : noteError;
    flow.querySelector = selector => selector === '[data-engagement-title]' ? titleInput : flowError;
    create.closest = selector => selector === '[data-engagement-flow]' ? flow : row;
    edit.closest = () => row;
    noteSave.closest = selector => selector === '[data-note-composer]' ? composer : row;
    root.querySelectorAll = () => [draft];
    const rich = element(); rich.innerHTML = '<p>Standing context</p>'; rich.querySelector = () => null;
    const quillEvents = {}, toolbar = element(); toolbar.lastElementChild = element();
    const document = {
        querySelector: () => root,
        getElementById: name => ids[name],
        querySelectorAll: selector => ({
            '[data-talking-points]': [points], '[data-agenda-action]': actions,
            '[data-create-engagement]': [create], '[data-note-save]': [noteSave],
            '[data-edit-engagement]': [edit],
        })[selector] || [],
        createElement: () => element(), addEventListener() {}, removeEventListener() {},
    };
    const window = {
        addEventListener: (name, fn) => { windowEvents[name] = fn; },
        removeEventListener() {}, location: {reload: () => reloads.push(true), assign() {}},
    };
    const context = {
        window, document, SBOneOnOneSave: {createSaveQueue},
        SBOneOnOneReading: {createReadingController: () => ({dispose() {}})},
        quillBetterTable: {keyboardBindings: {}},
        localStorage: {getItem: () => null}, sessionStorage: {getItem: () => null, setItem() {}},
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        confirm: () => confirmed, alert() {},
        fetch: async (url, options) => {
            requests.push({url, ...options});
            return {ok: !failed, json: async () => ({title: 'Current engagement', status: 'Active',
                error: 'Offline', results: [{
                    id: 99, title: 'Candidate work', customer_name: 'Scoped customer',
                    status: 'Active', acr: 18000, on_my_team: true,
                }]})};
        },
        Quill: class {
            static register() {}
            constructor() { this.root = rich; }
            getText() { return rich.innerHTML.replace(/<[^>]*>/g, ''); }
            getModule() { return {container: toolbar}; }
            on(name, fn) { quillEvents[name] = fn; }
        },
        SBDialog: {open() {}},
    };
    let source = fs.readFileSync('templates/partials/one_on_one_workspace_content.html', 'utf8')
        .split('<script>')[1].split('</script>')[0]
        .replace(/\{% if parent_modal_id is defined %\}[\s\S]*?\{% endif %\}/g, '')
        .replace(/\{\{ 'true' if parent_modal_id is defined or request.args.get\('embed'\) else 'false' \}\}/g, 'false')
        .replace('{{ workspace.id }}', '42');
    vm.runInNewContext(source, context);
    return {window, windowEvents, ids, requests, points, retry, draft, rich, quillEvents, reloads,
        actions, noteSave, create, edit, flowError, noteError,
        confirm(value) { confirmed = value; }, fail(value) { failed = value; }};
}

test('real inline editor sends exact standing HTML and talking-point PATCH payloads', async () => {
    const h = harness();
    assert.equal(h.window.SBOneOnOneWorkspace.hasPendingEdits(), false);
    h.rich.innerHTML = '<p><strong>Changed</strong></p>';
    h.quillEvents['text-change']({}, {}, 'user');
    h.points.value = 'Question for next call'; h.points.events.input();
    await h.window.SBOneOnOneWorkspace.flush();
    assert.equal(h.requests.length, 2);
    assert.deepEqual(h.requests.map(r => [r.url, r.method, JSON.parse(r.body)]), [
        ['/api/one-on-one/42', 'PATCH', {notes: '<p><strong>Changed</strong></p>'}],
        ['/api/one-on-one/agenda/7', 'PATCH', {talking_points: 'Question for next call'}],
    ]);
    assert.equal(h.window.SBOneOnOneWorkspace.hasPendingEdits(), false);
});

test('readonly initial Quill normalization and clean blur produce no network writes', async () => {
    const h = harness();
    h.rich.innerHTML += '<div>Editor normalization</div>';
    h.quillEvents['text-change']({}, {}, 'api');
    h.rich.events.blur();
    h.points.events.blur();
    await tick();
    assert.equal(h.requests.length, 0);
    assert.equal(h.window.SBOneOnOneWorkspace.hasPendingEdits(), false);
});

test('pending editor changes and unsent discussion notes protect unload and navigation', async () => {
    const h = harness();
    let prevented = false;
    h.points.value = 'Pending'; h.points.events.input();
    const event = {preventDefault() { prevented = true; }};
    h.windowEvents.beforeunload(event);
    assert.equal(prevented, true);
    assert.equal(event.returnValue, '');
    await h.window.SBOneOnOneWorkspace.flush();
    h.draft.value = 'Unsent discussion';
    await assert.rejects(h.window.SBOneOnOneWorkspace.flush(), /still open/);
    assert.equal(h.window.SBOneOnOneWorkspace.hasPendingEdits(), true);
    assert.deepEqual(h.reloads, []);
});

for (const [action, method, payload] of [
    ['discuss', 'PATCH', {status: 'discussed'}],
    ['restore', 'PATCH', {status: 'active'}],
    ['delete', 'DELETE', undefined],
]) {
    test(`${action} preserves the agenda payload and flushes talking points before mutation`, async () => {
        const h = harness(); h.confirm(true);
        h.points.value = 'Pending points'; h.points.events.input();
        await h.actions.find(b => b.dataset.agendaAction === action).events.click();
        await tick();
        assert.equal(h.requests[0].method, 'PATCH');
        assert.deepEqual(JSON.parse(h.requests[0].body), {talking_points: 'Pending points'});
        assert.equal(h.requests[1].url, '/api/one-on-one/agenda/7');
        assert.equal(h.requests[1].method, method);
        assert.deepEqual(h.requests[1].body ? JSON.parse(h.requests[1].body) : undefined, payload);
        assert.equal(h.reloads.length, 1);
    });
}

test('milestone conversion retains its exact title payload and retryable failure state', async () => {
    const h = harness();
    h.fail(true);
    await h.create.events.click(); await tick();
    assert.deepEqual(JSON.parse(h.requests[0].body), {title: 'Linked work'});
    assert.equal(h.requests[0].url, '/api/one-on-one/agenda/7/engagement');
    assert.equal(h.requests[0].method, 'POST');
    assert.equal(h.create.disabled, false);
    assert.equal(h.flowError.textContent, 'Offline');
    assert.equal(h.flowError.classList.contains('ow-hidden'), false);
});

test('discussion note save keeps the content payload and clears only a successfully saved draft', async () => {
    const h = harness();
    h.draft.value = '  Decisions and next steps  ';
    await h.noteSave.events.click(); await tick();
    assert.equal(h.requests[0].url, '/api/one-on-one/agenda/7/notes');
    assert.equal(h.requests[0].method, 'POST');
    assert.deepEqual(JSON.parse(h.requests[0].body), {content: 'Decisions and next steps'});
    assert.equal(h.draft.value, '');
    assert.equal(h.reloads.length, 1);
});

test('inline engagement edits retain all seven PUT fields and protect unsaved Cancel', async () => {
    const h = harness();
    h.edit.events.click(); await tick();
    assert.equal(h.requests[0].url, '/api/engagement/9');
    h.ids.editEngagementTitle.value = 'Changed title';
    h.ids.editEngagementStatus.value = 'On Hold';
    h.ids.editEngagementProblem.value = 'Problem';
    h.ids.editEngagementImpact.value = 'Impact';
    h.ids.editEngagementResources.value = 'Resources';
    h.ids.editEngagementAcr.value = '18000';
    h.ids.editEngagementTarget.value = '2026-10-31';
    h.ids.editEngagementModal.events.input();
    let prevented = false;
    h.ids.editEngagementModal.events['sb:dialog-before-close']({
        preventDefault() { prevented = true; },
    });
    assert.equal(prevented, true);
    await h.ids.saveEngagementDetails.events.click.call(h.ids.saveEngagementDetails); await tick();
    assert.equal(h.requests[1].url, '/api/engagement/9');
    assert.equal(h.requests[1].method, 'PUT');
    assert.deepEqual(JSON.parse(h.requests[1].body), {
        title: 'Changed title', status: 'On Hold', technical_problem: 'Problem',
        business_impact: 'Impact', solution_resources: 'Resources',
        estimated_acr: '18000', target_date: '2026-10-31',
    });
    assert.equal(h.reloads.length, 1);
});

test('failed autosave prevents a destructive agenda action from reaching the server', async () => {
    const h = harness(); h.fail(true); h.confirm(true);
    h.points.value = 'Keep draft'; h.points.events.input();
    await h.actions[2].events.click(); await tick();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].method, 'PATCH');
    assert.equal(h.window.SBOneOnOneWorkspace.hasPendingEdits(), true);
    assert.equal(h.retry.hidden, false);
    h.window.SBOneOnOneWorkspace.dispose();
});

test('native agenda choices keep the scoped GET and exact selection POST contract', async () => {
    const h = harness();
    h.ids.agendaCandidateSearch.value = ' scoped customer ';
    h.ids.addAgendaModal.events['sb:dialog-opening']();
    await tick();
    assert.equal(h.requests[0].url,
        '/api/one-on-one/42/candidates?type=engagement&q=scoped%20customer');
    assert.equal(h.ids.agendaCandidates.children.length, 1);
    h.ids.agendaCandidates.children[0].events.click();
    await tick();
    assert.equal(h.requests[1].url, '/api/one-on-one/42/agenda');
    assert.equal(h.requests[1].method, 'POST');
    assert.deepEqual(JSON.parse(h.requests[1].body), {item_type: 'engagement', entity_id: 99});
    assert.equal(h.reloads.length, 1);
});

test('reading state validates all independent regions and disclosure without accepting corruption', () => {
    const view = {id: 42, agenda: 120, surface: 60, editor: 30, historyOpen: true};
    assert.equal(validateView(view), view);
    for (const value of [null, {}, {...view, id: -1}, {...view, agenda: Infinity},
        {...view, surface: -1}, {...view, editor: '30'}, {...view, historyOpen: 'true'}]) {
        assert.throws(() => validateView(value), /Invalid saved/);
    }
});

function readingHarness({saved, embedded = false, unavailable = false} = {}) {
    const regions = Object.fromEntries(['agenda', 'surface', 'editor', 'history', 'notice']
        .map(key => [key, {...element(), scrollTop: 0, open: false, hidden: true,
            removeEventListener() {}}]));
    const events = {}, errors = [];
    const window = {
        history: {state: {otherState: 'kept', sbOneOnOneWorkspace: saved},
            replaceState(value) { if (unavailable) throw new Error('Unavailable'); this.state = value; }},
        addEventListener: (name, fn) => { events[name] = fn; },
        removeEventListener: name => { delete events[name]; },
        console: {error: (...args) => errors.push(args)},
    };
    const controller = createReadingController({window, id: 42, embedded, ...regions});
    return {window, regions, events, controller, errors};
}

test('record Back restores both note regions, agenda and history without replacing other state', () => {
    const h = readingHarness();
    h.regions.agenda.scrollTop = 120;
    h.regions.surface.scrollTop = 60;
    h.regions.editor.scrollTop = 30;
    h.regions.history.open = true;
    h.events.pagehide();
    assert.equal(h.window.history.state.otherState, 'kept');
    const restored = readingHarness({saved: h.window.history.state.sbOneOnOneWorkspace});
    assert.equal(restored.regions.agenda.scrollTop, 120);
    assert.equal(restored.regions.surface.scrollTop, 60);
    assert.equal(restored.regions.editor.scrollTop, 30);
    assert.equal(restored.regions.history.open, true);
    restored.controller.dispose();
    assert.deepEqual(restored.events, {});
});

test('embedded reading never reads or writes the host history', () => {
    const h = readingHarness({embedded: true, saved: {id: 42, agenda: -1}, unavailable: true});
    assert.deepEqual(h.events, {});
    assert.equal(h.errors.length, 0);
    assert.equal(h.regions.agenda.scrollTop, 0);
});

test('invalid and unavailable reading state is visible instead of silently discarded', () => {
    const invalid = readingHarness({saved: {id: 42}});
    assert.equal(invalid.regions.notice.hidden, false);
    assert.equal(invalid.errors.length, 1);
    const unavailable = readingHarness({unavailable: true});
    unavailable.events.pagehide();
    assert.equal(unavailable.regions.notice.hidden, false);
    assert.equal(unavailable.errors.length, 1);
});
