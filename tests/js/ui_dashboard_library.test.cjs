const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {fitPreviewRows} = require('../../static/js/ui-dashboard-library.js');

const grid = {rowHeight: 64, gap: 12};
const detailed = {min_height: 2, default_height: 8};

test('compact content shrinks to the minimum legal footprint, not the generic default', () => {
    assert.equal(fitPreviewRows(100, detailed, grid), 2);
    assert.equal(fitPreviewRows(140, detailed, grid), 2);
});

test('fitted heights round up at exact dashboard row boundaries, including gaps', () => {
    assert.equal(fitPreviewRows(140.01, detailed, grid), 3);
    assert.equal(fitPreviewRows(216, detailed, grid), 3);
    assert.equal(fitPreviewRows(216.01, detailed, grid), 4);
    assert.equal(fitPreviewRows(263.0625, detailed, grid), 4);
    assert.equal(fitPreviewRows(440, detailed, grid), 6);
});

test('long investigative queues stay capped at their designed starting size', () => {
    assert.equal(fitPreviewRows(596, detailed, grid), 8);
    assert.equal(fitPreviewRows(50000, detailed, grid), 8);
    assert.equal(fitPreviewRows(500, {min_height: 2, default_height: 4}, grid), 4);
});

test('measurements at different widths determine independent fitted sizes', () => {
    assert.equal(fitPreviewRows(350, detailed, grid), 5);
    assert.equal(fitPreviewRows(180, detailed, grid), 3);
    assert.equal(fitPreviewRows(180, {min_height: 4, default_height: 8}, grid), 4);
});

test('unmeasurable previews fail explicitly rather than returning a success-shaped size', () => {
    for (const height of [0, -1, NaN, Infinity, undefined]) {
        assert.throws(() => fitPreviewRows(height, detailed, grid), /could not be measured/);
    }
});

test('library previews inherit dashboard context and additions defer restrictions to the flyout',
    async () => {
        const nodes = {};
        const created = [];
        function element(tag = 'div') {
            const node = {
                tag, children: [], value: '', dataset: {}, style: {}, disabled: false,
                append(...children) { this.children.push(...children); },
                replaceChildren(...children) { this.children = children; },
                addEventListener(type, handler) { this[type] = handler; },
                setAttribute() {},
                querySelectorAll() { return this.children; },
                insertAdjacentHTML(_, html) { this.html = html; },
                getBoundingClientRect() { return {height: 100}; },
            };
            created.push(node);
            return node;
        }
        for (const id of [
            'widgetLibrary', 'dashboardConfig', 'librarySearch', 'libraryReport',
            'libraryWidthFilter', 'libraryVariantFilter', 'libraryResults', 'previewVariant',
            'previewWidth', 'widgetPreview', 'addLibraryWidget', 'libraryError',
            'previewLoading', 'previewDimensions', 'previewTitle',
        ]) nodes[id] = element();
        nodes.dashboardConfig.textContent = JSON.stringify({
            widths: {wide: 1344}, grid: {padding: 16, rowHeight: 64, gap: 12},
            catalog: [{
                key: 'fabric.modernization', title: 'Modernization', report: 'Modernization',
                description: 'Other Analytics', scope: 'Three months',
                supported_filters: ['customer_ids', 'seller_ids'],
                variants: [{
                    key: 'metric', title: 'Summary', widths: [3, 6],
                    min_height: 2, default_height: 4,
                }],
            }],
        });
        const context = {
            dashboard: {scope: {customer_ids: [4]}, live_filters: ['seller_ids']},
            widget: {customer_ids: [], seller_ids: []},
            live: {customer_ids: [], seller_ids: [7]},
        };
        const requests = [];
        const additions = [];
        const closed = [];
        const errors = [];
        const global = {
            document: {
                readyState: 'complete',
                getElementById: id => nodes[id],
                createElement: element,
            },
            AbortController,
            URLSearchParams,
            console: {error: (...args) => errors.push(args)},
            addEventListener() {},
            SBConnectGoals: {init() {}, destroy() {}},
            SBDashboardFilters: {
                context(...args) {
                    assert.equal(args.length, 0);
                    return context;
                },
            },
            SBDashboardEditor: {
                getSettings: () => ({displayStyle: 'cards', contentWidth: 'wide'}),
                async addWidget(spec) { additions.push(spec); },
            },
            SBDialog: {close: (_, result) => closed.push(result)},
            async fetch(url) {
                requests.push(url);
                return {ok: true, async json() {
                    return {success: true, html: '<section>Live saved data</section>'};
                }};
            },
        };
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../static/js/ui-dashboard-library.js'), 'utf8');
        vm.runInNewContext(source, {
            window: global, document: global.document, AbortController, URLSearchParams,
        });
        nodes.widgetLibrary['sb:dialog-opened']();
        await new Promise(setImmediate);
        assert.deepEqual(errors, []);
        assert.equal(requests.length, 1);
        const query = new URL(requests[0], 'http://localhost').searchParams;
        assert.deepEqual(JSON.parse(query.get('filter_context')), context);
        assert.equal(created.some(node => node.tag === 'details' || node.tag === 'input'), false);
        assert.equal(nodes.addLibraryWidget.disabled, false);
        await nodes.addLibraryWidget.click();
        assert.equal(additions.length, 1);
        assert.deepEqual(JSON.parse(JSON.stringify(additions[0])), {
            key: 'fabric.modernization', variant_key: 'metric', column_span: 6, row_span: 2,
        });
        assert.deepEqual(closed, ['added']);
        assert.deepEqual(errors, []);
    });
