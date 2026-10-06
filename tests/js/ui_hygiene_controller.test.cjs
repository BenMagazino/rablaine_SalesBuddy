const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-hygiene.js'), 'utf8');
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

function fixture() {
    class Node {
        constructor() {
            this.dataset = {}; this.handlers = {}; this.children = []; this.attributes = [];
            this.style = {}; this.textContent = ''; this.value = ''; this.scrollTop = 0;
            this.map = {}; this.lists = {}; this.open = false;
        }
        addEventListener(type, fn) { this.handlers[type] = fn; }
        setAttribute(name, value) {
            this.attributes = this.attributes.filter(attr => attr.name !== name);
            this.attributes.push({name, value});
        }
        removeAttribute(name) { this.attributes = this.attributes.filter(attr => attr.name !== name); }
        hasAttribute(key) { return key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) in this.dataset; }
        querySelector(key) { return this.map[key]; }
        querySelectorAll(key) { return this.lists[key] || []; }
        appendChild(node) { this.children.push(node); }
        get childNodes() { return this.children; }
        append(...nodes) { this.children.push(...nodes); }
        replaceChildren(...nodes) {
            this.children = nodes;
            if (this.isSelect) this.value = nodes[0]?.value || '';
        }
        createTHead() {
            this.head = new Node();
            return {insertRow: () => this.head};
        }
        createTBody() { const body = new Node(); this.children.push(body); return body; }
        closest(key) { return key === 'button' ? this : this.cell; }
        focus() { document.activeElement = this; }
        reset() { this.values = {title: '', status: 'Active'}; }
        reportValidity() { return true; }
    }
    const makeRow = (id, engagement = false) => {
        const row = new Node();
        row.dataset = engagement ? {engagementId: String(id)} :
            {milestoneId: String(id), onTeam: 'true', sellerName: 'Seller', customerName: 'Acme',
                acr: '10.25', title: 'Milestone'};
        row.cells = Array.from({length: 6}, () => new Node());
        if (engagement) {
            const input = new Node(); input.cell = row.cells[4];
            row.map['.hygiene-note-input'] = input;
            row.map['.sb-hygiene-save-state'] = new Node();
            row.map['[data-note-retry]'] = new Node();
        }
        return row;
    };
    const initialEng = makeRow(1, true), initialMs = makeRow(2);
    const root = new Node(); root.dataset.embedded = 'false';
    for (const key of ['[data-hygiene-eng-tables]', '[data-hygiene-ms-tables]',
        '#onTeamToggle', '#groupBySellerToggle', '[data-hygiene-notice]',
        '[data-hygiene-error]', '[data-hygiene-retry]', '#engagementGapCount',
        '#engagementCount', '#milestoneGapCount', '#msCount', '#engagementAnnotatedCount',
        '[data-hygiene-eng-empty]', '[data-hygiene-ms-empty]']) root.map[key] = new Node();
    root.map['#onTeamToggle'].checked = true;
    root.map['#groupBySellerToggle'].checked = false;
    for (const key of ['[data-hygiene-eng-tables]', '[data-hygiene-ms-tables]']) {
        root.map[key].lists['thead th'] = Array.from({length: 6}, (_, index) => Object.assign(
            new Node(), {dataset: index === 5 ? {exportLabel: 'Fix'} :
                {exportLabel: 'Column', sbSortType: 'text'}}));
    }
    root.lists['.engagement-gap-row'] = [initialEng];
    root.lists['.ms-row'] = [initialMs];
    const panels = ['engagement', 'milestone'].map(kind => {
        const node = new Node(); node.dataset.hygieneQueue = kind;
        node.map['.sb-hygiene-reading'] = new Node(); return node;
    });
    const tabs = ['engagement', 'milestone'].map(kind => {
        const node = new Node(); node.dataset.hygieneTab = kind; return node;
    });
    root.lists['[data-hygiene-queue]'] = panels;
    root.lists['[data-hygiene-tab]'] = tabs;
    const ids = {};
    for (const id of ['linkMilestonesModal', 'addExistingEngagementModal', 'createEngagementModal',
        'linkMilestonesError', 'addExistingEngagementError', 'createEngagementError',
        'saveEngagementMilestones', 'saveExistingEngagement', 'createEngagementSubmit',
        'existingEngagementSelect', 'createEngagementForm', 'hygieneDiscardDialog',
        'hygieneLinkPicker', 'hygieneCreatePicker', 'hygieneDiscardConfirm',
        'createEngagementFromEmptyState', 'linkMilestonesContext',
        'addExistingEngagementContext', 'createEngagementModalLabel', 'noExistingEngagements']) {
        ids[id] = new Node();
    }
    ids.existingEngagementSelect.isSelect = true;
    ids.createEngagementForm.reset();
    for (const id of ['linkMilestonesModal', 'addExistingEngagementModal', 'createEngagementModal']) {
        ids[id].map['[data-hygiene-dialog-retry]'] = new Node();
        ids[id].map['[data-hygiene-confirm-refresh]'] = new Node();
    }
    let freshEng = [makeRow(1, true)], freshMs = [makeRow(2)];
    const refreshSource = new Node();
    refreshSource.map['[data-hygiene-eng-tables] table'] = new Node();
    refreshSource.map['[data-hygiene-ms-tables] table'] = new Node();
    refreshSource.querySelectorAll = key => key === '.engagement-gap-row' ? freshEng : freshMs;
    const document = {readyState: 'complete', body: new Node(), activeElement: null,
        querySelector: key => key === '[data-hygiene]' ? root : new Node(),
        getElementById: id => ids[id], createTextNode: text => ({textContent: text}),
        createElement: tag => {
            const node = new Node();
            if (tag === 'template') node.content = {querySelector: () => refreshSource};
            return node;
        }};
    const calls = [], errors = [], pickers = [], events = {};
    let write = async () => ({success: true, milestone_ids: [2]});
    let choices = [{id: 1, title: 'Engagement', status: 'Active'}];
    const window = {history: {state: {unrelated: 'preserved'},
        replaceState(value) { this.state = value; }},
        addEventListener(type, fn) { events[type] = fn; },
        SBTableSort: {create: () => ({state: null, restore() {}})},
        SBDialog: {
            open(dialog) { dialog.open = true; },
            close(dialog, reason) {
                const event = {detail: {reason}, prevented: false,
                    preventDefault() { this.prevented = true; }};
                dialog.handlers['sb:dialog-before-close']?.(event);
                if (!event.prevented) { dialog.open = false; dialog.handlers['sb:dialog-closed']?.(); }
            },
        },
        SalesBuddyMilestoneMultiPicker: class {
            constructor() { this.selected = []; pickers.push(this); }
            load() { return Promise.resolve([]); }
            getSelectedMilestones() { return this.selected; }
            getSelectedIds() { return this.selected.map(ms => ms.local_milestone_id); }
            cancelLoad() {}
        }};
    vm.runInNewContext(source, {window, document, AbortController,
        localStorage: {getItem: () => null, setItem() {}},
        console: {error: (...args) => errors.push(args)}, setTimeout, clearTimeout,
        FormData: class {constructor(form) { this.form = form; }
            entries() { return Object.entries(this.form.values); }},
        Option: class {constructor(text, value) { this.text = text; this.value = value; }},
        fetch: async (url, options) => {
            calls.push({url, options});
            if (url.includes('?embed=1')) return {ok: true,
                headers: {get: () => 'text/html'}, text: async () => 'authoritative report'};
            const data = options?.method === 'POST' ? await write() : choices;
            return {ok: true, headers: {get: () => 'application/json'}, json: async () => data};
        }});
    const button = kind => {
        const node = new Node();
        node.dataset = kind === 'link' ? {linkEngagementId: '1', linkCustomerId: '3',
            linkEngagementTitle: 'Engagement'} : kind === 'existing' ?
            {addExistingMilestoneId: '2', addExistingCustomerId: '3',
                addExistingMilestoneTitle: 'Milestone'} :
            {createEngagementMilestoneId: '2', createEngagementCustomerId: '3',
                createEngagementMilestoneTitle: 'Milestone'};
        root.handlers.click({target: node}); return node;
    };
    return {root, ids, window, errors, calls, pickers, initialEng, tabs, panels, events, button,
        makeRow, setWrite(fn) { write = fn; }, setChoices(value) { choices = value; },
        setFresh(eng, ms) { freshEng = eng; freshMs = ms; }};
}

test('confirmed repair refreshes both queues and retains unrelated history', async () => {
    const h = fixture(); h.button('existing'); await tick();
    h.setFresh([], []);
    h.ids.saveExistingEngagement.handlers.click(); await tick();
    assert.equal(h.root.map['#engagementGapCount'].textContent, 0);
    assert.equal(h.root.map['#milestoneGapCount'].textContent, 0);
    assert.equal(h.ids.addExistingEngagementModal.open, false);
    assert.equal(h.calls.filter(call => call.options?.method === 'POST').length, 1);
    assert.equal(h.window.history.state.unrelated, 'preserved');
});
test('invalid second queue cannot partially mutate the first queue or claim zero gaps', async () => {
    const h = fixture(); h.button('existing'); await tick();
    const invalid = h.makeRow(2); invalid.cells.pop();
    h.setFresh([], [invalid]);
    h.ids.saveExistingEngagement.handlers.click(); await tick();
    assert.equal(h.root.map['#engagementGapCount'].textContent, 1);
    assert.equal(h.root.map['#milestoneGapCount'].textContent, 1);
    assert.match(h.root.map['[data-hygiene-error]'].textContent, /Repair saved, but/);
    h.setFresh([], []);
    h.root.map['[data-hygiene-retry]'].handlers.click(); await tick();
    assert.equal(h.root.map['#engagementGapCount'].textContent, 0);
    assert.equal(h.calls.filter(call => call.options?.method === 'POST').length, 1);
});
test('uncertain unseeded creation cannot automatically retry after unchanged queues refresh', async () => {
    const h = fixture(); h.button('create'); await tick();
    h.pickers[1].selected = [];
    h.ids.createEngagementForm.values.title = 'Create once';
    h.setWrite(async () => { throw new Error('Connection lost'); });
    const submit = () => h.ids.createEngagementForm.handlers.submit({preventDefault() {}});
    submit(); await tick();
    assert.match(h.root.map['[data-hygiene-error]'].textContent, /could not be confirmed/);
    h.ids.createEngagementModal.map['[data-hygiene-confirm-refresh]'].handlers.click();
    await tick(); submit(); await tick();
    assert.match(h.root.map['[data-hygiene-error]'].textContent, /creation is still unconfirmed/);
    assert.equal(h.calls.filter(call => call.options?.method === 'POST').length, 1);
});
test('uncertain seeded creation closes only after authoritative source resolution', async () => {
    const h = fixture(); h.button('create'); await tick();
    h.setWrite(async () => { throw new Error('Connection lost'); });
    h.ids.createEngagementForm.handlers.submit({preventDefault() {}}); await tick();
    h.setFresh([h.makeRow(1, true)], []);
    h.ids.createEngagementModal.map['[data-hygiene-confirm-refresh]'].handlers.click(); await tick();
    assert.equal(h.ids.createEngagementModal.open, false);
    assert.equal(h.root.map['[data-hygiene-error]'].textContent, '');
});
test('edited creation requires explicit discard, and unsaved fields survive cancellation', async () => {
    const h = fixture(); h.button('create'); await tick();
    h.ids.createEngagementForm.values.title = 'Draft';
    h.window.SBDialog.close(h.ids.createEngagementModal, 'cancel');
    assert.equal(h.ids.createEngagementModal.open, true);
    assert.equal(h.ids.hygieneDiscardDialog.open, true);
    h.window.SBDialog.close(h.ids.hygieneDiscardDialog, 'cancel');
    assert.equal(h.ids.createEngagementForm.values.title, 'Draft');
    h.window.SBDialog.close(h.ids.createEngagementModal, 'cancel');
    h.ids.hygieneDiscardConfirm.handlers.click();
    assert.equal(h.ids.createEngagementModal.open, false);
    assert.equal(h.calls.filter(call => call.options?.method === 'POST').length, 0);
});
test('closing during a write is blocked, including the discard escape path', async () => {
    const h = fixture(); h.button('existing'); await tick();
    let finish;
    h.setWrite(() => new Promise(resolve => { finish = resolve; }));
    h.ids.saveExistingEngagement.handlers.click(); await tick();
    h.window.SBDialog.close(h.ids.addExistingEngagementModal, 'cancel');
    assert.equal(h.ids.addExistingEngagementModal.open, true);
    assert.match(h.ids.addExistingEngagementError.textContent, /Saving repair/);
    h.setFresh([], []); finish({success: true, milestone_ids: [2]}); await tick();
    assert.equal(h.ids.addExistingEngagementModal.open, false);
});
test('obsolete engagement choices cannot overwrite a reopened repair dialog', async () => {
    const h = fixture();
    let finish;
    h.setChoices(new Promise(resolve => { finish = resolve; }));
    h.button('existing'); await tick();
    h.window.SBDialog.close(h.ids.addExistingEngagementModal, 'cancel');
    h.setChoices([{id: 7, title: 'Current choice', status: 'Active'}]);
    h.button('existing'); await tick();
    finish([{id: 99, title: 'Obsolete choice', status: 'Active'}]); await tick();
    assert.equal(h.ids.existingEngagementSelect.value, '7');
    assert.equal(h.ids.existingEngagementSelect.children[0].text, 'Current choice (Active)');
});
test('explicit rejected repairs remain editable without triggering a success refresh', async () => {
    const h = fixture(); h.button('existing'); await tick();
    h.setWrite(async () => ({success: false, error: 'Rejected'}));
    h.ids.saveExistingEngagement.handlers.click(); await tick();
    assert.equal(h.ids.addExistingEngagementModal.open, true);
    assert.equal(h.ids.addExistingEngagementError.textContent, 'Rejected');
    assert.equal(h.root.map['[data-hygiene-error]'].textContent, '');
    assert.equal(h.calls.filter(call => call.url.includes('?embed=1')).length, 0);
});
test('unsaved note guards prevent repair and protect navigation without sending a write', () => {
    const h = fixture(), input = h.initialEng.querySelector('.hygiene-note-input');
    input.value = 'Unsaved reason'; input.handlers.input();
    h.button('existing');
    assert.equal(h.ids.addExistingEngagementModal.open, false);
    assert.match(h.root.map['[data-hygiene-error]'].textContent, /unsaved reason notes/);
    let prevented = false;
    h.events.beforeunload({preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    input.value = ''; input.handlers.input(); input.handlers.blur();
    assert.equal(h.calls.length, 0);
});
test('refresh preserves note identity but removes stale export URLs from other cells', async () => {
    const h = fixture(), input = h.initialEng.querySelector('.hygiene-note-input');
    h.initialEng.cells[1].setAttribute('data-export-url', 'https://old-account.example');
    h.button('existing'); await tick();
    h.ids.saveExistingEngagement.handlers.click(); await tick();
    assert.equal(h.initialEng.cells[1].attributes.length, 0);
    assert.equal(h.initialEng.querySelector('.hygiene-note-input'), input);
});
test('rebuilt ungrouped and seller tables leave Fix as a non-sortable heading', () => {
    const h = fixture();
    const check = () => {
        for (const key of ['[data-hygiene-eng-tables]', '[data-hygiene-ms-tables]']) {
            for (const table of h.root.map[key].children.filter(node => node.head)) {
                assert.equal(table.head.children.length, 6);
                assert.equal(table.head.children[5].dataset.exportLabel, 'Fix');
                assert.equal(table.head.children[5].dataset.sbSortType, undefined);
                assert.ok(table.head.children.slice(0, 5).every(th => th.dataset.sbSortType));
            }
        }
    };
    check();
    h.root.map['#groupBySellerToggle'].checked = true;
    h.root.map['#groupBySellerToggle'].handlers.change();
    check();
});
