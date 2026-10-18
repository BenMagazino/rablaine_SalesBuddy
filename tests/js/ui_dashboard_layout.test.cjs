const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {overlaps, canPlace, pointerGeometry, keyboardGeometry} =
    require('../../static/js/ui-dashboard-layout.js');
const {createStore, PREFIX} = require('../../static/js/ui-dashboard-drafts.js');

const metric = {id: 1, layout_column: 0, layout_row: 0, column_span: 3, row_span: 4};
const widths = [3, 4, 6, 12];

test('adjacent edges and intentional holes are allowed, but intersections are rejected', () => {
    const second = {...metric, id: 2, layout_column: 3};
    assert.equal(overlaps(metric, second), false);
    assert.equal(canPlace(metric, [metric, second]), true);
    assert.equal(canPlace({...metric, layout_column: 1}, [metric, second]), false);
    assert.equal(canPlace({...metric, layout_row: 12}, [metric, second]), true);
    assert.equal(canPlace({...metric, layout_column: -1}, [metric]), false);
    assert.equal(canPlace({...metric, layout_column: 10}, [metric]), false);
    assert.equal(canPlace({...metric, layout_row: 1.5}, [metric]), false);
    assert.equal(canPlace({...metric, layout_row: 998}, [metric]), false);
});

test('dragging snaps coordinates without modifying a neighbor or its own size', () => {
    const moved = pointerGeometry(metric, 'move', 260, 152, 100, 76, widths, 3);
    assert.deepEqual(moved, {...metric, layout_column: 3, layout_row: 2});
    assert.deepEqual(metric, {id: 1, layout_column: 0, layout_row: 0, column_span: 3, row_span: 4});
    assert.deepEqual(pointerGeometry(metric, 'move', -500, -500, 100, 76, widths, 3), metric);
    assert.equal(pointerGeometry(metric, 'move', 5000, 0, 100, 76, widths, 3).layout_column, 9);
});

test('resizing snaps only to supported spans and respects height and right-edge bounds', () => {
    assert.equal(pointerGeometry(metric, 'resize', 100, 0, 100, 76, widths, 3).column_span, 4);
    assert.equal(pointerGeometry(metric, 'resize', 300, 0, 100, 76, widths, 3).column_span, 6);
    const edge = {...metric, layout_column: 8, column_span: 4};
    assert.equal(pointerGeometry(edge, 'resize', 500, 0, 100, 76, widths, 3).column_span, 4);
    assert.equal(pointerGeometry(metric, 'resize', 0, -500, 100, 76, widths, 3).row_span, 3);
    assert.equal(pointerGeometry(metric, 'resize', 0, 5000, 100, 76, widths, 3).row_span, 20);
});

test('keyboard handles move one cell or step through supported footprints', () => {
    assert.equal(keyboardGeometry(metric, 'move', 'ArrowRight', widths, 3).layout_column, 1);
    assert.equal(keyboardGeometry(metric, 'move', 'ArrowDown', widths, 3).layout_row, 1);
    assert.equal(keyboardGeometry(metric, 'resize', 'ArrowRight', widths, 3).column_span, 4);
    assert.equal(keyboardGeometry(metric, 'resize', 'ArrowDown', widths, 3).row_span, 5);
    assert.equal(keyboardGeometry(metric, 'resize', 'ArrowLeft', widths, 3).column_span, 3);
    const detailed = {...metric, column_span: 6, row_span: 5};
    assert.equal(keyboardGeometry(detailed, 'resize', 'ArrowLeft', [6, 12], 5).column_span, 6);
    assert.equal(keyboardGeometry(detailed, 'resize', 'ArrowUp', [6, 12], 5).row_span, 5);
});

function editorUI(withWidget = false, records = new Map()) {
    const node = () => ({
        disabled: false, hidden: false, style: {
            values: new Map(),
            setProperty(key, value) { this.values.set(key, value); },
        },
        classList: {
            values: new Map(),
            toggle(key, value) { this.values.set(key, value); },
        }, replaceChildren() {},
        dataset: {}, attributes: new Map(),
        setAttribute(key, value) { this.attributes.set(key, value); },
        hasAttribute(key) { return this.attributes.has(key); },
        querySelector() { return null; },
        addEventListener(event, handler) { this[event] = handler; },
        querySelectorAll() { return []; },
        focus() { this.focused = true; this.focusin?.(); },
        setPointerCapture(id) { this.capturedPointer = id; },
        hasPointerCapture(id) { return this.capturedPointer === id; },
        releasePointerCapture() { delete this.capturedPointer; },
    });
    const fields = [
        {...node(), name: 'name', value: 'Original'},
        {...node(), name: 'subtitle', value: ''},
    ];
    const actions = [node(), node(), node()];
    const nodes = Object.fromEntries([
        'dashboardCanvas', 'dashboardReading', 'layoutEditor', 'widgetInspector',
        'layoutState', 'dashboardError', 'canvasWidth', 'saveDashboardLayout',
        'cancelDashboardLayout', 'removeSelectedWidget', 'selectedWidgetTitle',
        'widgetInspectorFields', 'widgetInspectorEmpty',
        'dashboardDisplayStyle',
        'dashboardDetailsState', 'dashboardTitle', 'widgetPreview',
        'previewDashboardDraft', 'exitDashboardDraftPreview', 'dashboardEditorCommands',
        'dashboardDraftPreviewBar', 'dashboardSubtitleEditor', 'dashboardPreviewName',
        'dashboardPreviewSubtitle', 'dashboardEmptyEditor', 'dashboardEmptyPreview',
        'undoDashboardEdit', 'redoDashboardEdit',
    ].map(id => [id, node()]));
    const config = {
        revision: 0, name: 'Original', subtitle: '',
        contentWidth: 'wide', widths: {standard: 1152, wide: 1344},
        displayStyle: 'cards',
        grid: {maxRows: 1000, padding: 16, gap: 12, rowHeight: 64}, catalog: [{
            key: 'test.widget', requirements: ['compensation_buckets'], variants: [{
                key: 'metric', title: 'Metric', widths: [3, 6, 12], min_height: 3,
            }, {
                key: 'detailed', title: 'Detailed', widths: [6, 12], min_height: 5,
            }],
        }],
    };
    const body = node();
    const tile = {
        ...node(),
        dataset: {
            widgetId: '1', widgetKey: 'test.widget', variant: 'metric',
            column: '0', row: '0', columnSpan: '6', rowSpan: '4',
        },
        getAttribute() { return 'Test widget'; },
        querySelector() { return body; },
        hasAttribute(name) { return name === 'data-drag-handle'; },
        closest(selector) { return selector === '[data-widget-requirement]' ? null : this; },
    };
    const resize = {
        ...node(),
        hasAttribute(name) { return name === 'data-resize-handle'; },
        closest(selector) {
            if (selector === '[data-widget-requirement]') return null;
            return selector === '[data-widget-id]' ? tile : this;
        },
    };
    nodes.dashboardCanvas.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 1344, bottom: 760,
    });
    nodes.dashboardCanvas.querySelectorAll = () => withWidget ? [tile] : [];
    nodes.widgetInspector.elements = Object.fromEntries([
        'variant_key', 'column_span', 'layout_column', 'layout_row', 'row_span',
    ].map(name => [name, node()]));
    nodes.openWidgetLibrary = actions[1];
    nodes.widgetInspectorFields.querySelectorAll = () => [
        ...Object.values(nodes.widgetInspector.elements), nodes.removeSelectedWidget,
    ];
    nodes.dashboardConfig = {textContent: JSON.stringify(config)};
    const workspace = node();
    const root = {
        parentElement: workspace,
        dataset: {dashboardId: '21'},
        style: {setProperty() {}},
        classList: node().classList,
        querySelectorAll(selector) {
            if (selector === '[data-dashboard-field]') return fields;
            if (selector.includes('data-sb-dialog')) return actions.slice(0, 1);
            return [];
        },
    };
    nodes.layoutEditor.querySelectorAll = selector => selector.includes('data-sb-dialog')
        ? actions.slice(1) : [];
    const document = {
        readyState: 'complete',
        querySelector(selector) { return selector.startsWith('dialog') ? this.openDialog : root; },
        addEventListener(event, handler) { this[event] = handler; },
        getElementById(id) { return nodes[id]; },
        createElement() { return {}; },
    };
    const storage = {
        getItem(key) { return records.get(key) ?? null; },
        setItem(key, value) { records.set(key, value); },
        removeItem(key) { records.delete(key); },
    };
    const window = {
        document, addEventListener(event, handler) { this[event] = handler; }, animationFrames: 0,
        requestAnimationFrame() { return ++this.animationFrames; },
        cancelAnimationFrame() {},
        confirm() { return true; },
        SBDashboardDrafts: {...createStore(storage), key: id => PREFIX + id},
        SBDashboardDividers: {
            render(canvas, items) {
                canvas.dividerItems = JSON.parse(JSON.stringify(items));
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(
        __dirname, '../../static/js/ui-dashboard-layout.js'), 'utf8'),
    {window, document, console, URLSearchParams});
    return {nodes, fields, actions, tile, resize, root, workspace, window, document, records, body};
}

test('draft preview uses the unsaved state without rewriting the draft or publishing', () => {
    const ui = editorUI(true);
    let published = false;
    ui.window.SBDashboards = {request() { published = true; }};
    ui.fields[0].value = 'Unsaved title <not HTML>';
    ui.fields[0].input();
    ui.fields[1].value = 'Draft subtitle';
    ui.fields[1].input();
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    const stored = ui.records.get(PREFIX + '21');
    ui.nodes.previewDashboardDraft.click();
    assert.equal(ui.nodes.dashboardEditorCommands.hidden, true);
    assert.equal(ui.nodes.dashboardDraftPreviewBar.hidden, false);
    assert.equal(ui.nodes.widgetInspector.hidden, true);
    assert.equal(ui.fields[0].hidden, true);
    assert.equal(ui.nodes.dashboardSubtitleEditor.hidden, true);
    assert.equal(ui.nodes.dashboardPreviewName.textContent, 'Unsaved title <not HTML>');
    assert.equal(ui.nodes.dashboardPreviewSubtitle.textContent, 'Draft subtitle');
    assert.equal(ui.nodes.dashboardPreviewSubtitle.hidden, false);
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
    assert.equal(ui.root.classList.values.get('is-editing'), false);
    assert.equal(ui.body.inert, false);
    assert.equal(ui.tile.tabIndex, -1);
    assert.equal(ui.nodes.dashboardCanvas.style.values.get('--db-rows'), 4);
    assert.equal(ui.nodes.exitDashboardDraftPreview.focused, true);
    assert.equal(ui.records.get(PREFIX + '21'), stored);
    ui.nodes.saveDashboardLayout.click();
    assert.equal(published, false);
    assert.match(ui.nodes.layoutState.textContent, /Draft preview/);
    ui.nodes.exitDashboardDraftPreview.click();
    assert.equal(ui.nodes.dashboardEditorCommands.hidden, false);
    assert.equal(ui.nodes.dashboardDraftPreviewBar.hidden, true);
    assert.equal(ui.nodes.widgetInspector.hidden, false);
    assert.equal(ui.fields[0].hidden, false);
    assert.equal(ui.nodes.dashboardSubtitleEditor.hidden, false);
    assert.equal(ui.nodes.dashboardPreviewName.hidden, true);
    assert.equal(ui.root.classList.values.get('is-editing'), true);
    assert.equal(ui.body.inert, true);
    assert.equal(ui.tile.tabIndex, 0);
    assert.equal(ui.nodes.dashboardCanvas.style.values.get('--db-rows'), 10);
    assert.equal(ui.nodes.previewDashboardDraft.focused, true);
    assert.equal(ui.fields[0].value, 'Unsaved title <not HTML>');
    assert.equal(ui.records.get(PREFIX + '21'), stored);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, false);
});

test('prerequisite prompts stay interactive in editing and cannot start widget drags', () => {
    const ui = editorUI(true);
    ui.body.attributes.set('data-widget-requirements', '');
    ui.nodes.previewDashboardDraft.click();
    ui.nodes.exitDashboardDraftPreview.click();
    assert.equal(ui.body.inert, false);
    ui.nodes.dashboardCanvas.pointerdown({
        target: {closest: selector => selector === '[data-widget-requirement]' ? {} : ui.tile},
        preventDefault() { assert.fail('Setup action must not be consumed by dragging'); },
        button: 0,
    });
    assert.equal(ui.tile.capturedPointer, undefined);
});

test('resolving a prerequisite refreshes content without changing draft or undo history', async () => {
    const ui = editorUI(true);
    ui.fields[0].value = 'Local unsaved name';
    ui.fields[0].input();
    const draft = ui.records.get(PREFIX + '21');
    const requests = [];
    ui.window.fetch = async url => {
        requests.push(url);
        return {ok: true, json: async () => ({success: true, html: '<div>Ready</div>'})};
    };
    ui.window.SBConnectGoals = {destroy() {}, init() {}};
    ui.body.remove = () => {};
    ui.tile.insertAdjacentHTML = () => {};
    await ui.window.SBDashboardEditor.refreshRequirement('compensation_buckets');
    assert.equal(requests.length, 1);
    assert.equal(ui.body.inert, true);
    assert.equal(ui.records.get(PREFIX + '21'), draft);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, false);
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.fields[0].value, 'Original');
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
});

test('prerequisite refresh errors remain retryable without a stale reload warning', async () => {
    const ui = editorUI(true);
    ui.nodes.dashboardError.hidden = true;
    ui.window.fetch = async () => { throw new Error('Offline'); };
    await assert.rejects(
        ui.window.SBDashboardEditor.refreshRequirement('compensation_buckets'), /Retry/,
    );
    assert.equal(ui.nodes.dashboardError.hidden, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
    ui.window.fetch = async () => ({
        ok: true, json: async () => ({success: true, html: '<div>Ready</div>'}),
    });
    ui.window.SBConnectGoals = {destroy() {}, init() {}};
    ui.body.remove = () => {};
    ui.tile.insertAdjacentHTML = () => {};
    await ui.window.SBDashboardEditor.refreshRequirement('compensation_buckets');
    assert.equal(ui.tile.dataset.loadedPresentation, 'metric:6');
});

test('preview blocks widget editing while preserving normal widget interactions', async () => {
    const ui = editorUI(true);
    ui.nodes.previewDashboardDraft.click();
    ui.tile.click();
    ui.nodes.dashboardCanvas.pointerdown(pointerEvent(ui.tile));
    ui.nodes.dashboardCanvas.pointermove(pointerEvent(ui.tile, 300, 300));
    ui.nodes.dashboardCanvas.pointerup();
    ui.nodes.dashboardCanvas.keydown({
        target: ui.tile, key: 'ArrowDown',
        preventDefault() { assert.fail('Preview must not intercept widget keys'); },
    });
    ui.nodes.widgetInspector.change({target: {name: 'row_span', value: '8'}});
    ui.nodes.removeSelectedWidget.click();
    await assert.rejects(ui.window.SBDashboardEditor.addWidget({}), /not editable/);
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(ui.tile.capturedPointer, undefined);
    assert.equal(ui.window.animationFrames, 0);
    assert.equal(ui.body.inert, false);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
});

test('empty draft previews use the viewing empty state and omit blank subtitles', () => {
    const ui = editorUI();
    ui.nodes.previewDashboardDraft.click();
    assert.equal(ui.nodes.dashboardEmptyEditor.hidden, true);
    assert.equal(ui.nodes.dashboardEmptyPreview.hidden, false);
    assert.equal(ui.nodes.dashboardPreviewSubtitle.hidden, true);
    ui.nodes.exitDashboardDraftPreview.click();
    assert.equal(ui.nodes.dashboardEmptyEditor.hidden, false);
    assert.equal(ui.nodes.dashboardEmptyPreview.hidden, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
});

function pointerEvent(target, x = 100, y = 100) {
    return {
        target, clientX: x, clientY: y, pointerId: 1, button: 0,
        preventDefault() {},
    };
}

test('clicking widget content selects without starting a drag or changing the layout', () => {
    const ui = editorUI(true);
    const canvas = ui.nodes.dashboardCanvas;
    canvas.pointerdown(pointerEvent(ui.tile));
    canvas.pointermove(pointerEvent(ui.tile, 102, 101));
    canvas.pointerup();
    assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    assert.equal(ui.window.animationFrames, 0);
    assert.equal(ui.tile.hasPointerCapture(1), false);
});

test('dragging widget content moves it, while Escape restores its original placement', () => {
    const ui = editorUI(true);
    const canvas = ui.nodes.dashboardCanvas;
    const content = {closest(selector) {
        return selector === '[data-widget-requirement]' ? null : ui.tile;
    }};
    canvas.pointerdown(pointerEvent(content));
    canvas.pointermove(pointerEvent(content, 210, 176));
    assert.equal(ui.tile.style.gridColumn, '2 / span 6');
    assert.equal(ui.tile.style.gridRow, '2 / span 4');
    canvas.keydown({key: 'Escape', preventDefault() {}, stopPropagation() {}});
    assert.equal(ui.nodes.dashboardReading.classList.values.get('is-quiet-focus'), true);
    assert.equal(ui.tile.style.gridColumn, '1 / span 6');
    assert.equal(ui.tile.style.gridRow, '1 / span 4');
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    canvas.pointerdown(pointerEvent(content));
    canvas.pointermove(pointerEvent(content, 210, 176));
    canvas.pointerup();
    assert.equal(ui.nodes.widgetInspector.elements.layout_column.value, 2);
    assert.equal(ui.nodes.widgetInspector.elements.layout_row.value, 2);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, false);
});

test('the resize corner changes dimensions instead of dragging the whole widget', () => {
    const ui = editorUI(true);
    const canvas = ui.nodes.dashboardCanvas;
    const icon = {closest(selector) {
        return selector === '[data-widget-requirement]' ? null : ui.resize;
    }};
    canvas.pointerdown(pointerEvent(icon));
    canvas.pointermove(pointerEvent(icon, 100, 176));
    canvas.pointerup();
    assert.equal(ui.tile.style.gridColumn, '1 / span 6');
    assert.equal(ui.tile.style.gridRow, '1 / span 5');
    assert.equal(ui.nodes.widgetInspector.elements.layout_row.value, 1);
    assert.equal(ui.nodes.widgetInspector.elements.row_span.value, 5);
    assert.equal(ui.resize.hasPointerCapture(1), false);
});

test('keyboard focus selects the widget and arrow keys move or resize the focused surface', () => {
    const ui = editorUI(true);
    ui.tile.focus();
    assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
    const key = target => ({
        target, key: 'ArrowDown', preventDefault() {}, stopPropagation() {},
    });
    ui.nodes.dashboardCanvas.keydown(key(ui.tile));
    assert.equal(ui.nodes.widgetInspector.elements.layout_row.value, 2);
    ui.nodes.dashboardCanvas.keydown(key(ui.resize));
    assert.equal(ui.nodes.widgetInspector.elements.layout_row.value, 2);
    assert.equal(ui.nodes.widgetInspector.elements.row_span.value, 5);
});

test('editor starts ready to arrange widgets with editable title and subtitle', () => {
    const ui = editorUI();
    assert.equal(ui.nodes.layoutEditor.hidden, false);
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(ui.nodes.widgetInspectorEmpty.hidden, false);
    assert.equal(ui.nodes.canvasWidth.value, 'wide');
    assert.equal(ui.nodes.layoutState.textContent, 'Editing dashboard');
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    assert.ok(ui.fields.every(field => !field.disabled));
    assert.ok(ui.actions.every(action => !action.disabled));
});

test('layout drafts keep text editable and reset without leaving the editor', () => {
    const ui = editorUI();
    ui.nodes.canvasWidth.value = 'standard';
    ui.nodes.canvasWidth.change();
    assert.equal(ui.nodes.saveDashboardLayout.disabled, false);
    assert.ok(ui.fields.every(field => !field.disabled));
    assert.ok(ui.actions.every(action => !action.disabled));
    assert.match(ui.nodes.layoutState.textContent, /Choose Save/);
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.nodes.canvasWidth.value, 'wide');
    assert.equal(ui.nodes.layoutEditor.hidden, false);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    assert.ok(ui.fields.every(field => !field.disabled));
    assert.ok(ui.actions.every(action => !action.disabled));
});

test('widget properties appear on selection and return to guidance after resetting', () => {
    const ui = editorUI(true);
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    ui.tile.click();
    assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
    assert.equal(ui.nodes.widgetInspectorEmpty.hidden, true);
    assert.equal(ui.nodes.selectedWidgetTitle.textContent, 'Test widget');
    assert.equal(ui.nodes.widgetInspector.elements.layout_column.value, 1);
    assert.equal(ui.nodes.widgetInspector.elements.row_span.value, 4);
    ui.nodes.dashboardCanvas.click({target: {closest() { return null; }}});
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(ui.nodes.widgetInspectorEmpty.hidden, false);
    ui.tile.click();
    assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(ui.nodes.widgetInspectorEmpty.hidden, false);
    assert.equal(ui.nodes.selectedWidgetTitle.textContent, 'No widget selected');
});

test('display style previews and resets independently of saved widget geometry', () => {
    const ui = editorUI(true);
    const geometry = () => ['column', 'row', 'columnSpan', 'rowSpan']
        .map(key => Number(ui.tile.dataset[key]));
    const savedGeometry = geometry();
    assert.equal(ui.root.dataset.displayStyle, 'cards');
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
    assert.equal(ui.nodes.saveDashboardLayout.disabled, false);
    assert.deepEqual(geometry(), savedGeometry);
    assert.ok(ui.fields.every(field => !field.disabled));
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.root.dataset.displayStyle, 'cards');
    assert.equal(ui.nodes.dashboardDisplayStyle.value, 'cards');
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    assert.deepEqual(geometry(), savedGeometry);
});

test('saving a style-only draft sends the exact style and unchanged widget placement', async () => {
    const ui = editorUI(true);
    const requests = [];
    let reloaded = false;
    ui.window.SBDashboards = {
        async request(url, payload) { requests.push({url, payload}); },
    };
    ui.window.location = {reload() { reloaded = true; }};
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    await ui.nodes.saveDashboardLayout.click();
    assert.equal(requests[0].url, '/api/reports/dashboards/21/save');
    assert.equal(requests[0].payload.display_style, 'dividers');
    assert.equal(requests[0].payload.revision, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(requests[0].payload.widgets)), [{
        id: 1, key: 'test.widget', variant_key: 'metric',
        layout_column: 0, layout_row: 0, column_span: 6, row_span: 4,
    }]);
    assert.equal(reloaded, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
});

test('failed display saves keep a visible, retryable draft that can still be reset', async () => {
    const ui = editorUI(true);
    ui.window.SBDashboards = {
        async request() { throw new Error('Display could not be saved'); },
    };
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    await ui.nodes.saveDashboardLayout.click();
    assert.equal(ui.nodes.dashboardError.hidden, false);
    assert.match(ui.nodes.dashboardError.textContent, /Display could not be saved/);
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
    assert.equal(ui.nodes.saveDashboardLayout.disabled, false);
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.root.dataset.displayStyle, 'cards');
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
});

test('each text edit persists locally and restores alongside display and geometry after reload', () => {
    const first = editorUI(true);
    first.fields[0].value = 'Draft name';
    first.fields[0].input();
    assert.equal(first.window.SBDashboardDrafts.read(21).name, 'Draft name');
    first.fields[1].value = 'Not published yet';
    first.fields[1].input();
    first.nodes.dashboardDisplayStyle.value = 'dividers';
    first.nodes.dashboardDisplayStyle.change();
    first.tile.focus();
    first.nodes.dashboardCanvas.keydown({
        target: first.tile, key: 'ArrowDown', preventDefault() {}, stopPropagation() {},
    });
    const resumed = editorUI(true, first.records);
    assert.equal(resumed.fields[0].value, 'Draft name');
    assert.equal(resumed.fields[1].value, 'Not published yet');
    assert.equal(resumed.root.dataset.displayStyle, 'dividers');
    assert.equal(resumed.tile.style.gridRow, '2 / span 4');
    assert.equal(resumed.nodes.saveDashboardLayout.disabled, false);
    assert.ok(resumed.actions.every(action => !action.disabled));
});

test('valid numeric layout edits persist on input without waiting for blur', () => {
    const ui = editorUI(true);
    ui.tile.focus();
    ui.nodes.widgetInspector.input({target: {
        tagName: 'INPUT', name: 'layout_row', value: '5', checkValidity() { return true; },
    }});
    assert.equal(ui.window.SBDashboardDrafts.read(21).widgets[0].layout_row, 4);
});

test('removing widgets changes only the local draft and discard restores all saved details', () => {
    const ui = editorUI(true);
    ui.fields[0].value = 'Draft name';
    ui.fields[0].input();
    ui.tile.click();
    ui.nodes.removeSelectedWidget.click();
    assert.equal(ui.window.SBDashboardDrafts.read(21).widgets.length, 0);
    assert.equal(ui.tile.hidden, true);
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.fields[0].value, 'Original');
    assert.equal(ui.tile.hidden, false);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
});

test('stale drafts remain stored for review and cannot overwrite newer saved dashboards', () => {
    const first = editorUI(true);
    first.fields[0].value = 'Keep this work';
    first.fields[0].input();
    const draft = first.window.SBDashboardDrafts.read(21);
    first.records.set(PREFIX + '21', JSON.stringify({...draft, revision: 9}));
    const resumed = editorUI(true, first.records);
    assert.equal(resumed.fields[0].value, 'Keep this work');
    assert.match(resumed.nodes.dashboardError.textContent, /saved dashboard changed/);
    assert.equal(resumed.nodes.saveDashboardLayout.disabled, true);
    assert.equal(resumed.window.SBDashboardDrafts.read(21).revision, 9);
});

test('storage failures leave an explicit warning and allow publishing the in-memory draft', () => {
    const ui = editorUI(true);
    ui.window.SBDashboardDrafts.write = () => { throw new Error('Quota exceeded'); };
    ui.fields[1].value = 'Still here';
    ui.fields[1].input();
    assert.match(ui.nodes.dashboardError.textContent, /Quota exceeded/);
    assert.match(ui.nodes.layoutState.textContent, /only in memory/);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, false);
});

test('corrupt drafts stay intact until the user confirms discarding them', () => {
    const records = new Map([[PREFIX + '21', '{broken']]);
    const ui = editorUI(true, records);
    assert.match(ui.nodes.dashboardError.textContent, /not been deleted/);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    assert.equal(records.get(PREFIX + '21'), '{broken');
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(records.has(PREFIX + '21'), false);
    assert.equal(ui.fields[0].value, 'Original');
});

test('canceling discard leaves draft text and storage unchanged', () => {
    const ui = editorUI(true);
    ui.fields[0].value = 'Keep this draft';
    ui.fields[0].input();
    ui.window.confirm = () => false;
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.fields[0].value, 'Keep this draft');
    assert.equal(ui.window.SBDashboardDrafts.read(21).name, 'Keep this draft');
});

test('successful publishing with failed local cleanup is reported as saved, not retryable', async () => {
    const ui = editorUI(true);
    ui.fields[0].value = 'Published draft';
    ui.fields[0].input();
    ui.window.SBDashboards = {async request() { return {success: true}; }};
    ui.window.SBDashboardDrafts.remove = () => { throw new Error('Storage denied'); };
    await ui.nodes.saveDashboardLayout.click();
    assert.match(ui.nodes.dashboardError.textContent, /Dashboard saved, but/);
    assert.equal(ui.nodes.saveDashboardLayout.disabled, true);
    assert.equal(ui.nodes.dashboardDetailsState.textContent, 'Saved');
});

test('discarding a variation change prevents late report responses from replacing saved content', async () => {
    const ui = editorUI(true);
    let finish;
    ui.window.fetch = () => new Promise(resolve => { finish = resolve; });
    ui.window.SBConnectGoals = {
        destroy() { throw new Error('Stale report content was applied'); },
    };
    ui.tile.focus();
    ui.nodes.widgetInspector.change({target: {name: 'variant_key', value: 'detailed'}});
    ui.nodes.cancelDashboardLayout.click();
    finish({ok: true, json: async () => ({success: true, html: '<div>Detailed</div>'})});
    await new Promise(setImmediate);
    assert.equal(ui.tile.dataset.loadedPresentation, 'metric:6');
    assert.equal(ui.nodes.dashboardError.hidden, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
});

test('report content arriving during preview stays interactive and locks again on return', async () => {
    const ui = editorUI(true);
    let finish;
    ui.window.fetch = () => new Promise(resolve => { finish = resolve; });
    ui.window.SBConnectGoals = {destroy() {}, init() {}};
    ui.body.remove = () => {};
    ui.tile.insertAdjacentHTML = () => {};
    ui.tile.focus();
    ui.nodes.widgetInspector.change({target: {name: 'variant_key', value: 'detailed'}});
    ui.nodes.previewDashboardDraft.click();
    finish({ok: true, json: async () => ({success: true, html: '<div>Detailed</div>'})});
    await new Promise(setImmediate);
    assert.equal(ui.tile.dataset.loadedPresentation, 'detailed:6');
    assert.equal(ui.body.inert, false);
    assert.equal(ui.nodes.dashboardError.hidden, true);
    ui.nodes.exitDashboardDraftPreview.click();
    assert.equal(ui.body.inert, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21).widgets[0].variant_key, 'detailed');
});

function shortcut(ui, key, extra = {}) {
    const event = {
        key, target: {tagName: 'DIV'}, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...extra,
    };
    ui.document.keydown(event);
    return event;
}

test('undo and redo restore complete draft settings and update their buttons', () => {
    const ui = editorUI(true);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    assert.equal(ui.nodes.redoDashboardEdit.disabled, true);
    ui.nodes.canvasWidth.value = 'standard';
    ui.nodes.canvasWidth.change();
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    assert.equal(ui.nodes.undoDashboardEdit.disabled, false);
    shortcut(ui, 'z', {ctrlKey: true});
    assert.equal(ui.root.dataset.displayStyle, 'cards');
    assert.equal(ui.nodes.canvasWidth.value, 'standard');
    assert.equal(ui.nodes.redoDashboardEdit.disabled, false);
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.nodes.canvasWidth.value, 'wide');
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    shortcut(ui, 'y', {ctrlKey: true});
    assert.equal(ui.nodes.canvasWidth.value, 'standard');
    shortcut(ui, 'Z', {ctrlKey: true, shiftKey: true});
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
    assert.equal(ui.window.SBDashboardDrafts.read(21).display_style, 'dividers');
    assert.equal(ui.nodes.redoDashboardEdit.disabled, true);
});

test('completed drags and resizes are single undo steps and canceled drags add none', () => {
    const ui = editorUI(true);
    const canvas = ui.nodes.dashboardCanvas;
    canvas.pointerdown(pointerEvent(ui.tile));
    canvas.pointermove(pointerEvent(ui.tile, 100, 252));
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    canvas.pointerup();
    assert.equal(ui.tile.style.gridRow, '3 / span 4');
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.tile.style.gridRow, '1 / span 4');
    assert.equal(ui.nodes.dashboardCanvas.dividerItems[0].layout_row, 0);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    ui.nodes.redoDashboardEdit.click();
    canvas.pointerdown(pointerEvent(ui.resize));
    canvas.pointermove(pointerEvent(ui.resize, 100, 176));
    canvas.pointerup();
    assert.equal(ui.tile.dataset.rowSpan, 5);
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.tile.dataset.rowSpan, 4);
    assert.equal(ui.tile.style.gridRow, '3 / span 4');
    assert.equal(ui.nodes.dashboardCanvas.dividerItems[0].layout_row, 2);
    canvas.pointerdown(pointerEvent(ui.tile));
    canvas.pointermove(pointerEvent(ui.tile, 100, 328));
    canvas.keydown({
        key: 'Escape', preventDefault() {}, stopPropagation() {},
    });
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(ui.tile.style.gridRow, '3 / span 4');
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.tile.style.gridRow, '1 / span 4');
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
});

test('undo cancels pending variation content before it can replace restored report content', async () => {
    const ui = editorUI(true);
    let finish;
    ui.window.fetch = () => new Promise(resolve => { finish = resolve; });
    ui.window.SBConnectGoals = {
        destroy() { assert.fail('Undone content must not be applied'); },
    };
    ui.tile.focus();
    ui.nodes.widgetInspector.change({target: {name: 'variant_key', value: 'detailed'}});
    ui.nodes.undoDashboardEdit.click();
    finish({ok: true, json: async () => ({success: true, html: '<div>Detailed</div>'})});
    await new Promise(setImmediate);
    assert.equal(ui.tile.dataset.loadedPresentation, 'metric:6');
    assert.equal(ui.nodes.dashboardError.hidden, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
    assert.equal(ui.nodes.redoDashboardEdit.disabled, false);
});

test('metadata typing is grouped until blur and a new edit clears redo', () => {
    const ui = editorUI();
    ui.fields[0].focus();
    for (const value of ['N', 'New', 'New title']) {
        ui.fields[0].value = value;
        ui.fields[0].input();
    }
    ui.fields[0].blur();
    ui.fields[1].value = 'Subtitle';
    ui.fields[1].input();
    ui.fields[1].blur();
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.fields[1].value, '');
    assert.equal(ui.fields[0].value, 'New title');
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.fields[0].value, 'Original');
    ui.nodes.redoDashboardEdit.click();
    assert.equal(ui.fields[0].value, 'New title');
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    assert.equal(ui.nodes.redoDashboardEdit.disabled, true);
    ui.nodes.redoDashboardEdit.click();
    assert.equal(ui.fields[1].value, '');
});

test('native text undo or reverting a field does not leave an empty dashboard undo step', () => {
    const ui = editorUI();
    ui.nodes.canvasWidth.value = 'standard';
    ui.nodes.canvasWidth.change();
    ui.fields[0].focus();
    ui.fields[0].value = 'Edited';
    ui.fields[0].input();
    ui.fields[0].value = 'Original';
    ui.fields[0].input();
    ui.fields[0].blur();
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.nodes.canvasWidth.value, 'wide');
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    ui.fields[0].focus();
    for (const value of ['Edit', 'Original', 'Edit again']) {
        ui.fields[0].value = value;
        ui.fields[0].input();
    }
    ui.fields[0].blur();
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.fields[0].value, 'Original');
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
});

test('delete and backspace remove a selected widget locally and undo restores selection', () => {
    for (const key of ['Delete', 'Backspace']) {
        const ui = editorUI(true);
        ui.tile.click();
        assert.equal(shortcut(ui, key).defaultPrevented, true);
        assert.equal(ui.tile.hidden, true);
        assert.equal(ui.window.SBDashboardDrafts.read(21).widgets.length, 0);
        assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
        assert.equal(ui.nodes.dashboardReading.focused, true);
        shortcut(ui, 'z', {ctrlKey: true});
        assert.equal(ui.tile.hidden, false);
        assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
        assert.equal(ui.window.SBDashboardDrafts.read(21), null);
        shortcut(ui, 'y', {ctrlKey: true});
        assert.equal(ui.tile.hidden, true);
        assert.equal(ui.window.SBDashboardDrafts.read(21).widgets.length, 0);
    }
});

test('escape deselects without altering the draft and delete then has no target', () => {
    const ui = editorUI(true);
    ui.tile.click();
    const stored = ui.records.get(PREFIX + '21');
    assert.equal(shortcut(ui, 'Escape').defaultPrevented, true);
    assert.equal(ui.nodes.dashboardReading.focused, true);
    assert.equal(ui.nodes.dashboardReading.classList.values.get('is-quiet-focus'), true);
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(shortcut(ui, 'Delete').defaultPrevented, false);
    assert.equal(ui.tile.hidden, false);
    assert.equal(ui.records.get(PREFIX + '21'), stored);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    ui.nodes.dashboardReading.blur();
    ui.nodes.dashboardReading.focus();
    assert.equal(ui.nodes.dashboardReading.classList.values.get('is-quiet-focus'), false);
});

test('gutter clicks deselect without changing draft history or stealing focus', () => {
    const ui = editorUI(true);
    ui.tile.click();
    const stored = ui.records.get(PREFIX + '21');
    ui.workspace.click({target: ui.workspace});
    assert.equal(ui.nodes.widgetInspectorFields.hidden, true);
    assert.equal(ui.nodes.widgetInspectorEmpty.hidden, false);
    assert.equal(ui.nodes.selectedWidgetTitle.textContent, 'No widget selected');
    assert.equal(ui.tile.classList.values.get('is-selected'), false);
    assert.equal(ui.nodes.dashboardReading.focused, undefined);
    assert.equal(ui.records.get(PREFIX + '21'), stored);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    assert.equal(shortcut(ui, 'Delete').defaultPrevented, false);
    assert.equal(ui.tile.hidden, false);
    for (const target of [ui.tile, ui.resize, ui.fields[0], ui.nodes.widgetInspector,
        ui.nodes.openWidgetLibrary]) {
        ui.tile.click();
        ui.workspace.click({target});
        assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
    }
});

test('Add widget is independent of selection but still respects draft conflicts', () => {
    const empty = editorUI();
    assert.equal(empty.nodes.openWidgetLibrary.disabled, false);
    assert.equal(empty.nodes.removeSelectedWidget.disabled, true);
    const ui = editorUI(true);
    ui.tile.click();
    assert.equal(ui.nodes.openWidgetLibrary.disabled, false);
    assert.equal(ui.nodes.removeSelectedWidget.disabled, false);
    ui.workspace.click({target: ui.workspace});
    assert.equal(ui.nodes.openWidgetLibrary.disabled, false);
    assert.equal(ui.nodes.removeSelectedWidget.disabled, true);
    ui.tile.click();
    shortcut(ui, 'Escape');
    assert.equal(ui.nodes.openWidgetLibrary.disabled, false);
    assert.equal(ui.nodes.removeSelectedWidget.disabled, true);
    ui.window.storage({key: PREFIX + '21'});
    assert.equal(ui.nodes.openWidgetLibrary.disabled, true);
});

test('typing, composing, prevented events, and dialogs retain their own shortcuts', () => {
    const ui = editorUI(true);
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    ui.tile.click();
    for (const extra of [
        {target: {tagName: 'INPUT'}},
        {target: {tagName: 'TEXTAREA'}},
        {target: {tagName: 'SELECT'}},
        {target: {tagName: 'SPAN', isContentEditable: true}},
        {isComposing: true},
        {altKey: true},
        {defaultPrevented: true},
    ]) {
        shortcut(ui, 'z', {ctrlKey: true, ...extra});
        shortcut(ui, 'Delete', extra);
        shortcut(ui, 'Backspace', extra);
        shortcut(ui, 'Escape', extra);
        assert.equal(ui.tile.hidden, false);
        assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
        assert.equal(ui.root.dataset.displayStyle, 'dividers');
    }
    ui.document.openDialog = {};
    shortcut(ui, 'z', {ctrlKey: true});
    shortcut(ui, 'Delete');
    shortcut(ui, 'Escape');
    assert.equal(ui.tile.hidden, false);
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
    assert.equal(ui.nodes.widgetInspectorFields.hidden, false);
});

test('undo history starts at the resumed draft and discard starts a fresh history', () => {
    const first = editorUI(true);
    first.nodes.canvasWidth.value = 'standard';
    first.nodes.canvasWidth.change();
    const ui = editorUI(true, first.records);
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.nodes.canvasWidth.value, 'standard');
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    assert.equal(ui.nodes.redoDashboardEdit.disabled, false);
    ui.nodes.cancelDashboardLayout.click();
    assert.equal(ui.nodes.canvasWidth.value, 'wide');
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    assert.equal(ui.nodes.redoDashboardEdit.disabled, true);
    assert.equal(ui.window.SBDashboardDrafts.read(21), null);
});

test('preview and cross-window conflicts cannot replay or delete dashboard edits', () => {
    const ui = editorUI(true);
    ui.nodes.dashboardDisplayStyle.value = 'dividers';
    ui.nodes.dashboardDisplayStyle.change();
    ui.nodes.previewDashboardDraft.click();
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    assert.ok(ui.fields.every(field => field.disabled));
    assert.equal(shortcut(ui, 'z', {ctrlKey: true}).defaultPrevented, true);
    assert.equal(shortcut(ui, 'y', {ctrlKey: true}).defaultPrevented, true);
    shortcut(ui, 'Delete');
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
    assert.equal(ui.tile.hidden, false);
    ui.nodes.exitDashboardDraftPreview.click();
    assert.ok(ui.fields.every(field => !field.disabled));
    assert.equal(ui.nodes.undoDashboardEdit.disabled, false);
    ui.window.storage({key: PREFIX + '21'});
    ui.nodes.undoDashboardEdit.click();
    assert.equal(ui.nodes.undoDashboardEdit.disabled, true);
    assert.equal(ui.root.dataset.displayStyle, 'dividers');
});
