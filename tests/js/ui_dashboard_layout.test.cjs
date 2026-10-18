const assert = require('node:assert/strict');
const test = require('node:test');
const {overlaps, canPlace, pointerGeometry, keyboardGeometry} =
    require('../../static/js/ui-dashboard-layout.js');

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
