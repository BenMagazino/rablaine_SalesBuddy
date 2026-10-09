const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-revenue-workbench.js'), 'utf8');

function fixture({invalid = false} = {}) {
    class Node {
        constructor(dataset = {}) {
            this.dataset = dataset; this.hidden = false; this.attrs = {}; this.handlers = {};
        }
        addEventListener(type, fn) { this.handlers[type] = fn; }
        dispatchEvent(event) { this.handlers[event.type]?.(event); }
        setAttribute(name, value) { this.attrs[name] = value; }
        focus() { this.focused = true; }
        scrollIntoView() { this.scrolled = true; }
        contains(node) { return node === this || node?.owner === this; }
    }
    const root = new Node(), queue = new Node(), tableView = new Node(), panel = new Node();
    const empty = new Node(), notice = new Node(), fullLink = new Node(), modes = new Node();
    const items = [1, 2].map(id => new Node({sbQueueAlert: String(id),
        customerName: `<Customer "${id}">`, fullUrl: `/customer/${id}`, fullLabel: 'Customer Hub'}));
    const queueItems = [...items];
    const queueList = {appendChild(item) {
        queueItems.splice(queueItems.indexOf(item), 1); queueItems.push(item);
    }};
    queue.querySelectorAll = () => queueItems;
    const rows = [1, 2].map(id => Object.assign(new Node({analysisId: String(id)}),
        {display: 'table-row'}));
    if (invalid) items[1].dataset.sbQueueAlert = '1';
    const buttons = ['queue', 'table'].map(sbRevenueMode => new Node({sbRevenueMode}));
    const table = new Node(), observers = [], loads = [];
    let current = null, busy = false, refreshes = 0, options;
    queue.hidden = true; modes.hidden = true; notice.hidden = true;
    table.querySelectorAll = () => rows;
    modes.querySelectorAll = () => buttons;
    panel.querySelector = () => fullLink;
    const regions = {'[data-sb-queue-error]': notice, '[data-sb-queue-view]': queue,
        '[data-sb-table-view]': tableView, '[data-sb-queue-inspector]': panel,
        '[data-sb-queue-empty]': empty, '#alertsTable': table, '[data-sb-queue-list]': queueList};
    root.querySelector = selector => regions[selector];
    root.querySelectorAll = () => items;
    const document = new Node(), window = new Node(), review = {open: false};
    document.querySelectorAll = () => [];
    document.querySelector = () => modes;
    document.getElementById = () => review;
    const record = {
        open(snapshot) {
            if (busy) return false;
            if (current === snapshot.id && !panel.hidden) return;
            current = snapshot.id; panel.hidden = false; loads.push(snapshot);
            options.onSelection(snapshot);
        },
        clear() { if (busy) return false; current = null; panel.hidden = true; return true; },
        refresh() { refreshes++; },
    };
    const SBRecordDialog = {create(target, config) {
        assert.equal(target, panel); options = config; return record;
    }};
    class MutationObserver {
        constructor(fn) { this.update = fn; observers.push(this); }
        observe(target, config) { this.target = target; this.config = config; }
    }
    vm.runInNewContext(source, {document, window, SBRecordDialog, MutationObserver,
        CustomEvent: class { constructor(type) { this.type = type; } },
        getComputedStyle: row => ({display: row.display})});
    return {root, queue, tableView, panel, empty, notice, modes, items, queueItems, rows, buttons, loads,
        document, window, observers, review, fullLink, record,
        start: () => window.SBRevenueWorkbench.create(root),
        get options() { return options; }, get refreshes() { return refreshes; },
        set busy(value) { busy = value; }};
}

test('queue enhances the comparison table and selects one alert with literal customer identity', () => {
    const h = fixture(); h.start();
    assert.equal(h.queue.hidden, false);
    assert.equal(h.tableView.hidden, true);
    assert.equal(h.modes.hidden, false);
    assert.equal(h.buttons[0].attrs['aria-pressed'], 'true');
    assert.equal(h.loads[0].title, '<Customer "1">');
    assert.equal(h.items[0].attrs['aria-selected'], 'true');
    assert.equal(h.items[0].tabIndex, 0);
    assert.equal(h.items[1].tabIndex, -1);
    assert.equal(h.options.fullUrl(1), '/customer/1');
    assert.equal(h.options.presentation, 'panel');
});

test('filters preserve a visible selection, replace an excluded selection and clear zero results', () => {
    const h = fixture(), api = h.start();
    api.sync(); assert.equal(h.loads.length, 1);
    h.rows[0].display = 'none'; h.observers[0].update();
    assert.equal(h.items[0].hidden, true);
    assert.equal(h.loads.at(-1).id, 2);
    h.rows[1].hidden = true; api.sync();
    assert.equal(h.empty.hidden, false);
    assert.equal(h.panel.hidden, true);
    assert.equal(h.items[1].attrs['aria-selected'], 'false');
    h.rows[1].hidden = false; api.sync();
    assert.equal(h.loads.at(-1).id, 2);
    assert.equal(h.empty.hidden, true);
});

test('Table comparison retains selection across view changes and shares current filtering', () => {
    const h = fixture(), api = h.start();
    h.items[1].handlers.click();
    api.setMode('table');
    assert.equal(h.queue.hidden, true);
    assert.equal(h.tableView.hidden, false);
    assert.equal(h.buttons[1].attrs['aria-pressed'], 'true');
    api.setMode('queue');
    assert.equal(h.loads.at(-1).id, 2);
    h.busy = true;
    assert.equal(api.setMode('table'), false);
    assert.equal(h.queue.hidden, false);
    assert.equal(h.options.mount().isBusy(), false);
    h.review.open = true;
    assert.equal(h.options.mount().isBusy(), true);
});

test('queue keyboard navigation skips filtered alerts and uses a single roving tab stop', () => {
    const h = fixture(); h.start();
    const event = {key: 'End', preventDefault() { this.prevented = true; }};
    h.items[0].handlers.keydown(event);
    assert.equal(event.prevented, true);
    assert.equal(h.items[1].focused, true);
    assert.equal(h.items[1].scrolled, true);
    assert.equal(h.items[1].tabIndex, 0);
    assert.equal(h.items[0].tabIndex, -1);
    h.rows[0].display = 'none'; h.observers[0].update();
    h.items[1].handlers.keydown({key: 'Home', preventDefault() {}});
    assert.equal(h.loads.at(-1).id, 2);
});

test('only a confirmed selected-pane review refreshes detail after Review closes', () => {
    const h = fixture(); h.start();
    h.document.handlers['sb:dialog-closed']({target: {id: 'reviewActionModal'}});
    assert.equal(h.refreshes, 0);
    h.document.handlers['sb:revenue-review-saved']({
        target: {owner: h.panel}, detail: {analysisId: 1},
    });
    h.document.handlers['sb:dialog-closed']({target: {id: 'reviewActionModal'}});
    assert.equal(h.refreshes, 1);
    h.document.handlers['sb:revenue-review-saved']({
        target: {owner: h.panel}, detail: {analysisId: 1},
    });
    h.rows[0].display = 'none';
    h.document.handlers['sb:dialog-closed']({target: {id: 'reviewActionModal'}});
    assert.equal(h.loads.at(-1).id, 2);
    assert.equal(h.refreshes, 1);
});

test('cached-history return resumes the selected read without resetting filters', () => {
    const h = fixture(); h.start();
    h.items[1].handlers.click();
    h.window.handlers.pagehide();
    assert.equal(h.panel.hidden, true);
    h.window.handlers.pageshow({persisted: true});
    assert.equal(h.loads.at(-1).id, 2);
});

test('queue and keyboard navigation follow sorted table order without replacing selection', () => {
    const h = fixture(), api = h.start();
    h.rows.reverse(); api.sync();
    assert.deepEqual(h.queueItems.map(item => item.dataset.sbQueueAlert), ['2', '1']);
    assert.equal(h.loads.length, 1);
    assert.equal(h.items[0].attrs['aria-selected'], 'true');
    h.items[0].handlers.keydown({key: 'Home', preventDefault() {}});
    assert.equal(h.loads.at(-1).id, 2);
    assert.equal(h.items[1].focused, true);
});

test('invalid or duplicate queue identities fail visibly and retain the original table', () => {
    const h = fixture({invalid: true});
    assert.throws(h.start, /does not match/);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.tableView.hidden, false);
    assert.equal(h.modes.hidden, true);
});
