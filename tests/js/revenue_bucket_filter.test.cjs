const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/revenue-bucket-filter.js'), 'utf8');

async function fixture() {
    const classes = new Set(['d-none']);
    const count = {textContent: '', classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
    }};
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map(bucket => ({
        dataset: {bucket}, style: {},
    }));
    const storage = new Map([
        ['salesbuddy_revenue_bucket_filter', '["A"]'],
        ['salesbuddy_revenue_bucket_taxonomy_version', '0'],
    ]);
    const container = {appendChild: button => { container.button = button; }};
    const document = {
        createElement: () => ({style: {}, setAttribute() {}, addEventListener() {}}),
        getElementById: id => id === 'bucketFilterContainer' ? container :
            (id === 'bucketFilterCount' ? count : null),
        querySelectorAll: selector => selector === '[data-bucket]' ? rows : [],
    };
    const context = {
        document, console,
        bootstrap: {Popover: function () {}},
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        fetch: async () => ({json: async () => ({bucket_taxonomy_version: 0})}),
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    const visible = [];
    context.RevenueBucketFilter.init({
        containerId: 'bucketFilterContainer', onFilterChange: total => visible.push(total),
    });
    await new Promise(resolve => setImmediate(resolve));
    return {api: context.RevenueBucketFilter, container, count, classes, rows, storage, visible};
}

test('bucket control renders a plain label and fraction without an icon or styled tag', async () => {
    const {container, count, classes} = await fixture();
    assert.equal(container.button.innerHTML,
        'Buckets <span id="bucketFilterCount" class="d-none"></span>');
    assert.equal(count.textContent, '1/6');
    assert.equal(classes.has('d-none'), false);
});

test('plain fraction still updates and persists selections while filtering the same rows', async () => {
    const {api, count, rows, storage, visible} = await fixture();
    assert.deepEqual(rows.map(row => row.style.display), ['', 'none', 'none', 'none', 'none', 'none']);
    api.toggle('B');
    assert.equal(count.textContent, '2/6');
    assert.deepEqual(rows.map(row => row.style.display), ['', '', 'none', 'none', 'none', 'none']);
    assert.deepEqual(JSON.parse(storage.get('salesbuddy_revenue_bucket_filter')), ['A', 'B']);
    assert.equal(visible.at(-1), 2);
});

test('selecting all or none retains the existing hidden-count and no-filter behavior', async () => {
    const {api, classes, rows, count} = await fixture();
    api.selectAll();
    assert.equal(classes.has('d-none'), true);
    assert.ok(rows.every(row => row.style.display === ''));
    api.selectNone();
    assert.equal(classes.has('d-none'), true);
    assert.ok(rows.every(row => row.style.display === ''));
    api.toggle('C');
    assert.equal(count.textContent, '1/6');
    assert.equal(classes.has('d-none'), false);
});
