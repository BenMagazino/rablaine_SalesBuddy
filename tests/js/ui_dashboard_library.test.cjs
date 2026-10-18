const assert = require('node:assert/strict');
const test = require('node:test');
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
