const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-revenue-product-trend.js'), 'utf8');

function fixture() {
    const charts = [], observers = [], errors = [];
    const theme = {color: '#98b9e2', borderTopColor: '#30353c', fontFamily: 'Segoe UI'};
    class Chart {
        constructor(canvas, config) {
            this.canvas = canvas;
            this.data = config.data; this.options = config.options;
            this.updates = []; this.destroyed = false; charts.push(this);
        }
        update(mode) { this.updates.push(mode); }
        destroy() { this.destroyed = true; }
    }
    const window = {Chart};
    const document = {documentElement: {}};
    class MutationObserver {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target, options) { this.target = target; this.options = options; }
    }
    vm.runInNewContext(source, {window, document, MutationObserver,
        getComputedStyle: () => theme, Intl, console: {error: (...args) => errors.push(args)}});
    function panel(records) {
        const nodes = {
            '[data-sb-product-trend-data]': {textContent: JSON.stringify(records)},
            '[data-sb-product-trend-range]': {textContent: ''},
            '[data-sb-product-trend-gaps]': {hidden: true},
            '.sb-product-trend-plot': {}, canvas: {},
        };
        const figure = {hidden: true, querySelector: selector => nodes[selector]};
        return {querySelector: () => figure, figure, nodes};
    }
    const notice = {hidden: true, textContent: ''};
    const root = {querySelector: () => notice};
    return {api: window.SBProductRevenueTrend, charts, observers, theme, panel, root,
        window, notice, errors};
}

test('series uses calendar order, preserves exact zero/negative values and leaves missing months null', () => {
    const h = fixture();
    const series = h.api.buildSeries([
        {month: '2026-02-01', label: 'FY26-Feb', revenue: -20.25},
        {month: '2025-12-01', label: 'FY26-Dec', revenue: 0},
    ]);
    assert.deepEqual([...series.labels], ['Dec 2025', 'Jan 2026', 'Feb 2026']);
    assert.deepEqual([...series.values], [0, null, -20.25]);
    assert.deepEqual([...series.fiscalMonths], ['FY26-Dec', null, 'FY26-Feb']);
    assert.equal(series.gaps, true);
    assert.equal(h.api.buildSeries([]).labels.length, 0);
    assert.throws(() => h.api.buildSeries([{month: null, revenue: 1, label: 'bad'}]), /invalid/);
    assert.throws(() => h.api.buildSeries([
        {month: '2026-01-01', revenue: '1', label: 'FY26-Jan'},
    ]), /invalid/);
    assert.throws(() => h.api.buildSeries([
        {month: '2026-01-01', revenue: 1, label: 'FY26-Jan'},
        {month: '2026-01-01', revenue: 2, label: 'FY26-Jan'},
    ]), /duplicate/);
});

test('selection owns only one chart, repeated selection preserves it and missing history clears it', () => {
    const h = fixture(), renderer = h.api.create(h.root);
    const first = h.panel([{month: '2025-07-01', label: 'FY26-Jul', revenue: 123.45}]);
    renderer.show(first);
    assert.equal(first.figure.hidden, false);
    assert.equal(h.charts.length, 1);
    assert.equal(h.charts[0].data.datasets[0].pointRadius, 4);
    assert.equal(h.charts[0].options.animation, false);
    assert.equal(h.charts[0].data.datasets[0].spanGaps, false);
    assert.equal(h.charts[0].options.plugins.tooltip.callbacks.label({parsed: {y: 123.45}}),
        '$123.45');
    assert.equal(h.charts[0].options.plugins.tooltip.callbacks.title([{dataIndex: 0}]), 'FY26-Jul');
    renderer.show(first);
    assert.equal(h.charts.length, 1);
    const second = h.panel([
        {month: '2026-02-01', label: 'FY26-Feb', revenue: -1},
        {month: '2025-12-01', label: 'FY26-Dec', revenue: 0},
    ]);
    renderer.show(second);
    assert.equal(h.charts[0].destroyed, true);
    assert.equal(first.figure.hidden, true);
    assert.equal(second.figure.hidden, false);
    assert.equal(second.nodes['[data-sb-product-trend-gaps]'].hidden, false);
    assert.equal(second.nodes['[data-sb-product-trend-range]'].textContent, 'Dec 2025 to Feb 2026');
    renderer.show(null);
    assert.equal(h.charts[1].destroyed, true);
    assert.equal(second.figure.hidden, true);
});

test('theme changes repaint the active chart without replacing selection or data', () => {
    const h = fixture(), renderer = h.api.create(h.root);
    renderer.show(h.panel([{month: '2026-01-01', label: 'FY26-Jan', revenue: 10}]));
    const chart = h.charts[0], values = chart.data.datasets[0].data;
    h.theme.color = '#274c73'; h.theme.borderTopColor = '#d9dfe3';
    h.observers[0].callback();
    assert.equal(chart.data.datasets[0].borderColor, '#274c73');
    assert.equal(chart.options.scales.y.grid.color, '#d9dfe3');
    assert.equal(chart.options.scales.x.ticks.font.family, 'Segoe UI');
    assert.equal(chart.options.scales.yRight.ticks.color, '#274c73');
    assert.equal(chart.options.scales.yRight.ticks.font.family, 'Segoe UI');
    assert.equal(chart.options.scales.yRight.grid.drawOnChartArea, false);
    assert.equal(chart.options.scales.yRight.border.display, false);
    assert.equal(chart.data.datasets[0].data, values);
    assert.equal(h.charts.length, 1);
    assert.deepEqual([...h.observers[0].options.attributeFilter],
        ['data-sb-mode', 'data-sb-family']);
});

test('right dollar scale mirrors the left bounds and exact ticks without another grid or series', () => {
    const h = fixture(), renderer = h.api.create(h.root);
    renderer.show(h.panel([{month: '2026-01-01', label: 'FY26-Jan', revenue: 10}]));
    const chart = h.charts[0], right = chart.options.scales.yRight;
    assert.equal(chart.data.datasets.length, 1);
    assert.equal(right.position, 'right');
    assert.equal(right.grid.drawOnChartArea, false);
    assert.equal(right.grid.drawTicks, false);
    assert.equal(right.border.display, false);
    assert.equal(right.ticks.autoSkip, false);
    for (const values of [[0, 5000, 10000, 15000], [-100, -50, 0], [0, 0.5, 1]]) {
        const scale = {chart: {scales: {y: {
            min: values[0], max: values.at(-1), ticks: values.map(value => ({value})),
        }}}};
        right.afterDataLimits(scale);
        scale.min -= 1;
        scale.max += 1;  // Chart.js can round the mirrored limits during tick generation.
        right.afterBuildTicks(scale);
        assert.equal(scale.min, values[0]);
        assert.equal(scale.max, values.at(-1));
        assert.deepEqual([...scale.ticks].map(tick => tick.value), values);
        assert.notEqual(scale.ticks, scale.chart.scales.y.ticks);
        for (const value of values) {
            assert.equal(right.ticks.callback(value), chart.options.scales.y.ticks.callback(value));
        }
    }
});

test('empty history stays hidden and missing chart library reports failure without inventing data', () => {
    const h = fixture(), renderer = h.api.create(h.root);
    const empty = h.panel([]);
    renderer.show(empty);
    assert.equal(empty.figure.hidden, true);
    assert.equal(h.charts.length, 0);
    h.window.Chart = undefined;
    const panel = h.panel([{month: '2026-01-01', label: 'FY26-Jan', revenue: 10}]);
    assert.throws(() => renderer.show(panel), /library is unavailable/);
    assert.equal(panel.figure.hidden, true);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /Exact history remains available/);
    h.window.Chart = class {
        constructor(canvas, config) { this.data = config.data; this.options = config.options; }
        update() {}
    };
    renderer.show(panel);
    assert.equal(panel.figure.hidden, false);
});

test('invalid chart data reports and logs the failure, leaving the exact-value fallback available', () => {
    const h = fixture(), renderer = h.api.create(h.root);
    const panel = h.panel([{month: null, label: 'FY26-Jan', revenue: 10}]);
    assert.throws(() => renderer.show(panel), /invalid/);
    assert.equal(panel.figure.hidden, true);
    assert.equal(h.notice.hidden, false);
    assert.match(h.notice.textContent, /Exact values remain available/);
    assert.equal(h.errors.length, 1);
});
