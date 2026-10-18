const assert = require('node:assert/strict');
const test = require('node:test');
const {createStore, PREFIX} = require('../../static/js/ui-dashboard-drafts.js');

function memoryStore() {
    const records = new Map();
    const storage = {
        getItem(key) { return records.get(key) ?? null; },
        setItem(key, value) { records.set(key, value); },
        removeItem(key) { records.delete(key); },
    };
    return {records, storage, store: createStore(storage)};
}

function draft() {
    return {
        version: 1, revision: 2, name: '', subtitle: 'Draft text',
        base_name: 'Saved', base_subtitle: '',
        content_width: 'wide', display_style: 'dividers',
        widgets: [{
            id: -1, key: 'connect_goals.u2c', variant_key: 'metric',
            layout_column: 3, layout_row: 5, column_span: 3, row_span: 4,
        }],
    };
}

test('drafts round-trip complete configuration without storing rendered report data', () => {
    const {store, storage} = memoryStore();
    assert.equal(store.read(2), null);
    const saved = store.write(2, draft(), null);
    assert.equal(typeof saved.saved_at, 'string');
    assert.deepEqual(createStore(storage).read(2), saved);
    assert.equal(saved.name, '');
    assert.equal(saved.widgets[0].id, -1);
});

test('changing or removing one dashboard draft preserves other dashboards', () => {
    const {store} = memoryStore();
    const first = store.write(2, draft(), null);
    const other = store.write(3, draft(), null);
    const changed = store.write(2, {...draft(), name: 'Edited'}, first);
    assert.equal(store.read(2).name, 'Edited');
    store.remove(2, changed);
    assert.equal(store.read(2), null);
    assert.deepEqual(store.read(3), other);
});

test('another window cannot silently overwrite or delete a newer local draft', () => {
    const {store} = memoryStore();
    const original = store.write(2, draft(), null);
    const changed = store.write(2, {...draft(), name: 'Other window'}, original);
    assert.throws(() => store.write(2, draft(), original), /another window/);
    assert.throws(() => store.remove(2, original), /another window/);
    assert.deepEqual(store.read(2), changed);
    store.remove(2);
    assert.throws(() => store.write(2, draft(), changed), /another window/);
});

test('corrupt and unsupported drafts stay intact and produce explicit read errors', () => {
    for (const value of ['{', JSON.stringify({...draft(), version: 9}),
        JSON.stringify({...draft(), widgets: [null]})]) {
        const {store, records} = memoryStore();
        records.set(PREFIX + '2', value);
        assert.throws(() => store.read(2));
        assert.equal(records.get(PREFIX + '2'), value);
        store.remove(2);
        assert.equal(store.read(2), null);
    }
});

test('quota and storage permission errors propagate instead of claiming persistence', () => {
    const {storage} = memoryStore();
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    assert.throws(() => createStore(storage).write(2, draft(), null), /Quota exceeded/);
    storage.getItem = () => { throw new Error('Storage denied'); };
    assert.throws(() => createStore(storage).read(2), /Storage denied/);
});
