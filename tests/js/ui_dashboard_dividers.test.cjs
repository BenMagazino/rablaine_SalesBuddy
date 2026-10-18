const assert = require('node:assert/strict');
const test = require('node:test');
const {getDividerSegments, positionDividers, render} =
    require('../../static/js/ui-dashboard-dividers.js');

const widget = (column, row, width, height = 5) => ({
    layout_column: column, layout_row: row, column_span: width, row_span: height,
});
const layout = [widget(0, 0, 12), widget(0, 5, 6), widget(6, 5, 6)];
const grid = {
    columnStep: 100, rowStep: 76, columnGap: 12, rowGap: 12,
    paddingLeft: 16, paddingTop: 16,
};

test('a full-width widget above two halves produces one joined T, not widget borders', () => {
    const before = JSON.stringify(layout);
    const segments = getDividerSegments(layout);
    assert.deepEqual(segments, [
        {axis: 'horizontal', position: 5, start: 0, end: 12},
        {axis: 'vertical', position: 6, start: 5, end: 10},
    ]);
    assert.deepEqual(positionDividers(segments, grid), [
        {x1: 16, y1: 390, x2: 1204, y2: 390},
        {x1: 610, y1: 390, x2: 610, y2: 764},
    ]);
    assert.equal(JSON.stringify(layout), before);
    assert.deepEqual(getDividerSegments([...layout].reverse()), segments);
});

test('empty and single-widget layouts have no exterior or decorative dividers', () => {
    assert.deepEqual(getDividerSegments([]), []);
    assert.deepEqual(getDividerSegments([widget(0, 0, 12)]), []);
    assert.deepEqual(getDividerSegments([widget(3, 6, 6)]), []);
});

test('staggered widgets create a T without drawing through the taller widget', () => {
    const segments = getDividerSegments([
        widget(0, 0, 6, 10), widget(6, 0, 6), widget(6, 5, 6),
    ]);
    assert.deepEqual(segments, [
        {axis: 'horizontal', position: 5, start: 6, end: 12},
        {axis: 'vertical', position: 6, start: 0, end: 10},
    ]);
    const [horizontal, vertical] = positionDividers(segments, grid);
    assert.equal(horizontal.x1, vertical.x1);
    assert.equal(horizontal.y1, 390);
    assert.equal(vertical.y1, 16);
    assert.equal(vertical.y2, 764);
});

test('four neighboring widgets merge both axes into a connected cross', () => {
    const segments = getDividerSegments([
        widget(0, 0, 6), widget(6, 0, 6), widget(0, 5, 6), widget(6, 5, 6),
    ]);
    assert.deepEqual(segments, [
        {axis: 'horizontal', position: 5, start: 0, end: 12},
        {axis: 'vertical', position: 6, start: 0, end: 10},
    ]);
});

test('third- and quarter-width rows have continuous horizontal and vertical separators', () => {
    for (const width of [3, 4]) {
        const widgets = [];
        for (const row of [0, 5]) {
            for (let column = 0; column < 12; column += width) {
                widgets.push(widget(column, row, width));
            }
        }
        const expected = [{axis: 'horizontal', position: 5, start: 0, end: 12}];
        for (let position = width; position < 12; position += width) {
            expected.push({axis: 'vertical', position, start: 0, end: 10});
        }
        assert.deepEqual(getDividerSegments(widgets), expected);
    }
});

test('intentional empty columns, rows, and diagonal corner contacts remain unruled', () => {
    assert.deepEqual(getDividerSegments([widget(0, 0, 3), widget(4, 0, 3)]), []);
    assert.deepEqual(getDividerSegments([widget(0, 0, 12), widget(0, 6, 12)]), []);
    assert.deepEqual(getDividerSegments([widget(0, 0, 6), widget(6, 5, 6)]), []);
    assert.deepEqual(getDividerSegments([
        widget(0, 0, 3, 4), widget(0, 4, 3, 4),
        widget(4, 0, 4, 4), widget(4, 4, 4, 4),
    ]), [
        {axis: 'horizontal', position: 4, start: 0, end: 3},
        {axis: 'horizontal', position: 4, start: 4, end: 8},
    ]);
});

test('a partial-height neighbor only gets a divider along its shared edge', () => {
    const segments = getDividerSegments([widget(0, 0, 6, 10), widget(6, 3, 6, 4)]);
    assert.deepEqual(segments, [{axis: 'vertical', position: 6, start: 3, end: 7}]);
    assert.deepEqual(positionDividers(segments, grid), [
        {x1: 610, y1: 244, x2: 610, y2: 536},
    ]);
});

function dividerCanvas() {
    let layer = null;
    const root = {dataset: {displayStyle: 'dividers'}};
    const canvas = {
        clientWidth: 1220, clientHeight: 780,
        closest() { return root; },
        querySelector() { return layer; },
        querySelectorAll() {
            return layout.map(item => ({dataset: {
                column: String(item.layout_column), row: String(item.layout_row),
                columnSpan: String(item.column_span), rowSpan: String(item.row_span),
            }}));
        },
        append(element) { layer = element; },
        ownerDocument: {
            defaultView: {
                getComputedStyle() {
                    return {
                        columnGap: '12px', rowGap: '12px', gridAutoRows: '64px',
                        paddingLeft: '16px', paddingRight: '16px', paddingTop: '16px',
                    };
                },
            },
            createElementNS(namespace, tag) {
                return {
                    namespace, tag, attributes: {},
                    setAttribute(key, value) { this.attributes[key] = String(value); },
                    replaceChildren(...children) { this.children = children; },
                    remove() { layer = null; },
                };
            },
        },
    };
    return {canvas, root, get layer() { return layer; }};
}

test('saved DOM geometry renders one noninteractive accessible-hidden canvas layer', () => {
    const ui = dividerCanvas();
    render(ui.canvas);
    assert.equal(ui.layer.tag, 'svg');
    assert.equal(ui.layer.attributes['aria-hidden'], 'true');
    assert.equal(ui.layer.attributes.focusable, 'false');
    assert.equal(ui.layer.attributes.viewBox, '0 0 1220 780');
    assert.equal(ui.layer.children.length, 2);
    assert.deepEqual(ui.layer.children[0].attributes, {
        x1: '16', y1: '390', x2: '1204', y2: '390',
    });
    const layer = ui.layer;
    render(ui.canvas);
    assert.equal(ui.layer, layer);
    assert.equal(ui.layer.children.length, 2);
});

test('draft membership changes and Cards remove obsolete divider lines', () => {
    const ui = dividerCanvas();
    render(ui.canvas, layout);
    render(ui.canvas, [layout[0]]);
    assert.equal(ui.layer, null);
    render(ui.canvas, layout);
    ui.root.dataset.displayStyle = 'cards';
    render(ui.canvas, layout);
    assert.equal(ui.layer, null);
    ui.root.dataset.displayStyle = 'dividers';
    render(ui.canvas, [widget(0, 0, 6), widget(6, 0, 6)]);
    assert.equal(ui.layer.children.length, 1);
    assert.equal(ui.layer.children[0].attributes.x1, '610');
});

test('rerendering uses the current canvas width rather than cached pixel geometry', () => {
    const ui = dividerCanvas();
    render(ui.canvas, layout);
    ui.canvas.clientWidth = 1460;
    render(ui.canvas, layout);
    assert.equal(ui.layer.children[0].attributes.x2, '1444');
    assert.equal(ui.layer.children[1].attributes.x1, '730');
    assert.equal(ui.layer.attributes.viewBox, '0 0 1460 780');
});
