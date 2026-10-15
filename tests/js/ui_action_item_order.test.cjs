const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const {compareItems} = require('../../static/js/ui-action-item-order.js');
const source = fs.readFileSync('static/js/ui-action-item-order.js', 'utf8');

test('due dates use real calendar keys, retain undated last and completed after open', () => {
    const rows = [
        {id: 1, due: '2027-04-01', status: 'open', rank: 0},
        {id: 2, due: '', status: 'open', rank: 1},
        {id: 3, due: '2026-12-31', status: 'open', rank: 2},
        {id: 4, due: '2020-01-01', status: 'completed', rank: 3},
        {id: 5, due: '2027-04-01', status: 'open', rank: 4},
    ];
    const order = mode => [...rows].sort((a, b) => compareItems(a, b, mode)).map(row => row.id);
    assert.deepEqual(order('due'), [3, 1, 5, 2, 4]);
    assert.deepEqual(order('due-desc'), [1, 5, 3, 2, 4]);
    assert.deepEqual(order('manual'), [1, 2, 3, 5, 4]);
});

function harness({saved = null, storageFails = false, separateCompleted = false} = {}) {
    class Element {
        constructor(dataset = {}) {
            this.dataset = dataset; this.children = []; this.handlers = {};
            this.value = 'due'; this.hidden = false; this.disabled = false;
        }
        hasAttribute(name) { return name === 'data-action-order-id' && !!this.dataset.actionOrderId; }
        setAttribute(name, value) { this[name] = value; }
        addEventListener(name, fn) { this.handlers[name] = fn; }
        focus() { this.focused = true; }
        emit(name) { return this.handlers[name]?.({stopPropagation() {}}); }
        append(...nodes) {
            for (const node of nodes) {
                if (node.parentElement) node.parentElement.children =
                    node.parentElement.children.filter(child => child !== node);
                node.parentElement = this;
                this.children.push(node);
            }
        }
        insertBefore(node, next) {
            node.parentElement.children = node.parentElement.children.filter(el => el !== node);
            this.children.splice(this.children.indexOf(next), 0, node);
            node.parentElement = this;
        }
    }
    const picker = new Element(), notice = new Element(), group = new Element();
    const completed = separateCompleted ? new Element() : group;
    const rows = ['2027-04-01', '', '2027-01-01', ''].map((due, index) => new Element({
        actionOrderId: String(index + 1), actionOrderDue: due,
        actionOrderStatus: index === 3 ? 'completed' : 'open',
    }));
    rows.forEach((row, index) => (index === 3 ? completed : group).append(row));
    const groups = separateCompleted ? [group, completed] : [group];
    const root = {querySelector: selector => selector === '[data-action-order]' ? picker : notice,
        querySelectorAll: selector => selector === '[data-action-order-list]' ? groups : []};
    const storage = new Map(saved === null ? [] : [['order:project:1', saved]]);
    const requests = [], errors = [], drag = [];
    const window = {document: {createElement: () => new Element()},
        localStorage: {
            getItem: key => { if (storageFails) throw Error('Blocked'); return storage.get(key) ?? null; },
            setItem: (key, value) => { if (storageFails) throw Error('Blocked'); storage.set(key, value); },
        },
        fetch: (url, options) => new Promise((resolve, reject) =>
            requests.push({url, options, resolve, reject})),
    };
    vm.runInNewContext(source, {window, console: {error: (...args) => errors.push(args)}});
    let busy = false;
    const api = window.SBActionItemOrder.mount(root, {
        key: 'order:project:1', url: '/reorder', isBusy: () => busy,
        sortable: {option: (...args) => drag.push(args), destroy: () => drag.push('destroy')},
    });
    return {rows, picker, notice, requests, storage, errors, api, drag, root,
        order: () => group.children.map(row => Number(row.dataset.actionOrderId)),
        mode(value) { picker.value = value; picker.emit('change'); },
        move(index, direction) { rows[index].children[0].children[direction].emit('click'); },
        busy(value) { busy = value; }};
}

test('default date ordering works with combined or separate completed lists', () => {
    for (const separateCompleted of [false, true]) {
        const h = harness({separateCompleted});
        assert.deepEqual(h.order(), separateCompleted ? [3, 1, 2] : [3, 1, 2, 4]);
        assert.equal(h.rows[0].children[0].hidden, true);
        assert.equal(h.requests.length, 0);
    }
});

test('saved modes restore manual order without overwriting it with a date view', () => {
    const h = harness({saved: 'manual'});
    assert.deepEqual(h.order(), [1, 2, 3, 4]);
    assert.equal(h.rows[0].children[0].children[0].disabled, true);
    h.mode('due-desc');
    assert.deepEqual(h.order(), [1, 3, 2, 4]);
    h.mode('manual');
    assert.deepEqual(h.order(), [1, 2, 3, 4]);
    assert.equal(h.storage.get('order:project:1'), 'manual');
    assert.equal(h.requests.length, 0);
});

test('manual moves persist open IDs, guard pending writes and update the saved rank', async () => {
    const h = harness({saved: 'manual'});
    h.move(2, 0);
    assert.deepEqual(h.order(), [1, 3, 2, 4]);
    assert.equal(h.api.isBusy(), true);
    assert.equal(h.picker.disabled, true);
    assert.equal(h.rows[0].parentElement.inert, true);
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {task_ids: [1, 3, 2]});
    h.move(0, 1);
    assert.equal(h.requests.length, 1);
    h.requests[0].resolve({ok: true, json: async () => ({success: true})});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.api.isBusy(), false);
    assert.equal(h.rows[0].parentElement.inert, false);
    assert.equal(h.rows[2].children[0].children[0].focused, true);
    h.mode('due');
    h.mode('manual');
    assert.deepEqual(h.order(), [1, 3, 2, 4]);
});

test('HTTP, server, JSON and network failures visibly restore the previous manual order', async () => {
    for (const failure of ['http', 'server', 'json', 'network']) {
        const h = harness({saved: 'manual'});
        h.move(0, 1);
        const request = h.requests[0];
        if (failure === 'network') request.reject(Error('Disconnected'));
        else request.resolve({ok: failure !== 'http', json: async () => {
            if (failure === 'json') throw Error('Bad JSON');
            return {success: failure !== 'server', error: 'Not saved'};
        }});
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(h.order(), [1, 2, 3, 4], failure);
        assert.equal(h.notice.hidden, false, failure);
        assert.match(h.notice.textContent, /Order was not saved/);
        assert.equal(h.api.isBusy(), false);
    }
});

test('other pending task changes block manual writes; invalid preferences surface errors', () => {
    const h = harness({saved: 'manual'});
    h.busy(true);
    h.move(0, 1);
    assert.equal(h.requests.length, 0);
    assert.deepEqual(h.order(), [1, 2, 3, 4]);
    for (const config of [{saved: 'bad'}, {storageFails: true}]) {
        const failed = harness(config);
        assert.equal(failed.picker.value, 'due');
        assert.equal(failed.notice.hidden, false);
        assert.ok(failed.errors.length);
    }
    h.api.dispose();
    assert.equal(h.drag.at(-1), 'destroy');
});

test('dragging uses the same atomic save and can restore the previous order on failure', async () => {
    const h = harness({saved: 'manual', separateCompleted: true});
    h.rows[0].parentElement.insertBefore(h.rows[2], h.rows[0]);
    const pending = h.api.save();
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {task_ids: [3, 1, 2]});
    h.requests[0].resolve({ok: false, json: async () => ({success: false, error: 'Stale'})});
    await pending;
    assert.deepEqual(h.order(), [1, 2, 3]);
    assert.match(h.notice.textContent, /Stale/);
});
