const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {filterRows, validateState, capturePaneState, restorePaneState, activateEngagementScripts} =
    require('../../static/js/ui-action-items.js');

test('seller filtering keeps row identity, order and unassigned records', () => {
    const rows = ['2', '', '1', '2'].map(sellerId => ({dataset: {sellerId}}));
    assert.equal(filterRows(rows, '2'), 2);
    assert.deepEqual(rows.map(row => row.hidden), [false, true, true, false]);
    assert.equal(filterRows(rows, ''), 4);
    assert.deepEqual(rows.map(row => row.dataset.sellerId), ['2', '', '1', '2']);
    assert.equal(filterRows(rows, 'missing'), 0);
});

test('Back reading state retains both axes and exact seller scope', () => {
    const state = {seller: '4', top: 320, left: 15};
    assert.equal(validateState(state), state);
    for (const bad of [null, {}, {...state, top: -1}, {...state, left: NaN},
        {...state, seller: 4}]) assert.throws(() => validateState(bad));
});

test('dashboard Back retains independent cell reading and accepts prior queue history', () => {
    const panes = [
        {id: 'actions-project-body', scrollTop: 120, scrollLeft: 0},
        {id: 'staleMilestonesBody', scrollTop: 430, scrollLeft: 12},
    ];
    const positions = capturePaneState(panes);
    assert.deepEqual(positions, {
        'actions-project-body': {top: 120, left: 0},
        staleMilestonesBody: {top: 430, left: 12},
    });
    assert.equal(validateState({seller: '4', top: 0, left: 0, panes: positions}).panes,
        positions);
    panes.forEach(pane => { pane.scrollTop = 0; pane.scrollLeft = 0; });
    restorePaneState(panes, positions);
    assert.equal(panes[0].scrollTop, 120);
    assert.equal(panes[1].scrollTop, 430);
    assert.equal(panes[1].scrollLeft, 12);
    restorePaneState(panes, {});
    assert.equal(panes[1].scrollTop, 430);
    for (const invalid of [null, [], 'bad', {cell: null}, {cell: {top: -1, left: 0}},
        {cell: {top: 0, left: Infinity}}]) {
        assert.throws(() => validateState({seller: '', top: 0, left: 0, panes: invalid}));
    }
});

test('engagement scripts wait for dependencies without exporting scoped handlers globally', async () => {
    const activated = [];
    global.document = {createElement: () => ({})};
    const dependency = {src: '/sortable.js', replaceWith(script) { activated.push(script); }};
    const actions = {textContent: 'function createTask() {}\nfunction deleteTask() {}',
        replaceWith(script) { activated.push(script); }};
    try {
        const pending = activateEngagementScripts(
            {querySelectorAll: () => [dependency, actions]}, () => true);
        assert.equal(activated.length, 1);
        activated[0].onload();
        await pending;
        assert.equal(activated.length, 2);
        assert.equal(activated[1].textContent, actions.textContent);
        activated.length = 0;
        await activateEngagementScripts({querySelectorAll: () => [actions]}, () => false);
        assert.equal(activated.length, 0);
    } finally { delete global.document; }
});

test('failed engagement dependency stops activation rather than pretending success', async () => {
    let dependency;
    global.document = {createElement: () => ({})};
    try {
        const pending = activateEngagementScripts({querySelectorAll: () => [
            {src: '/failed.js', replaceWith(script) { dependency = script; }},
        ]}, () => true);
        dependency.onerror();
        await assert.rejects(pending, /dependency failed/);
    } finally { delete global.document; }
});

test('nested child closes retain the engagement parent cleanup and original Copilot context', async () => {
    const listeners = new Map();
    const parentContext = {page: 'action-items'};
    let disposed = 0, signal;
    const dialog = {
        open: false,
        addEventListener(type, fn) { listeners.set(type, fn); },
        removeEventListener(type, fn) {
            if (listeners.get(type) === fn) listeners.delete(type);
        },
    };
    const body = {removeAttribute() {}, querySelectorAll: () => [],
        querySelector: () => ({_engagement: {dispose() { disposed++; }}})};
    const elements = {actionItemsEngagementModal: dialog, aiEngBody: body,
        aiEngTitle: {}, aiEngBadge: {dataset: {}}, aiEngFullLink: {}};
    const window = {copilotContext: parentContext};
    vm.runInNewContext(fs.readFileSync('static/js/ui-action-items.js', 'utf8'), {
        window, document: {readyState: 'loading', addEventListener() {},
            getElementById: id => elements[id]},
        AbortController, console, SBDialog: {open() { dialog.open = true; }},
        fetch: async (url, options) => {
            signal = options.signal;
            window.copilotContext = {page: 'engagement_view'};
            return {ok: true, text: async () => '<section></section>'};
        },
    });
    await window.openActionItemsEngagement(7, 'Engagement', 'Active');
    const close = listeners.get('sb:dialog-closed');
    close({target: {}});
    assert.equal(signal.aborted, false);
    assert.equal(listeners.get('sb:dialog-closed'), close);
    close({target: dialog});
    assert.equal(signal.aborted, true);
    assert.equal(window.copilotContext, parentContext);
    assert.equal(dialog._engagementClosed, null);
    assert.equal(disposed, 2);
});
