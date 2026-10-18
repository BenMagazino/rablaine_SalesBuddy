const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {confirmBuckets, coverageFilter,
    quarterChartSeries} =
    require('../../static/js/ui-connect-goals.js');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-connect-goals.js'), 'utf8');
const confirmed = {success: true, fiscal_year: 'FY27', taxonomy_version: 3};
const scope = {area: ['Data'], myTeam: 'off', quarters: [
    'FY27 Q1', 'FY27 Q2', 'FY27 Q3', 'FY27 Q4',
    'FY28 Q1', 'FY28 Q2', 'FY28 Q3', 'FY28 Q4'],
status: ['On Track', 'At Risk', 'Blocked'], seller: '', urgency: '', commitment: '',
favoritesOnly: false};

test('confirmation sends the original exact payload and accepts taxonomy zero', async () => {
    const selected = ['Infra', 'AI'];
    const result = await confirmBuckets(selected, async (url, request) => {
        assert.equal(url, '/api/revenue/compensated-buckets');
        assert.equal(request.method, 'POST');
        assert.deepEqual(JSON.parse(request.body),
            {buckets: selected, confirm_for_fiscal_year: true});
        return {ok: true, json: async () => ({...confirmed, taxonomy_version: 0})};
    });
    assert.equal(result.taxonomy_version, 0);
});

test('HTTP and unsuccessful response bodies cannot masquerade as a saved scope', async () => {
    for (const ok of [false, true]) {
        await assert.rejects(confirmBuckets([], async () => ({
            ok, json: async () => ({success: false, error: 'Scope rejected'}),
        })), /Scope rejected/);
    }
});

test('confirmation rejects missing fiscal year and invalid taxonomy metadata', async () => {
    for (const data of [
        {...confirmed, fiscal_year: null}, {...confirmed, fiscal_year: 'invalid'},
        {...confirmed, taxonomy_version: null}, {...confirmed, taxonomy_version: -1},
        {...confirmed, taxonomy_version: '3'}, {...confirmed, success: undefined},
    ]) {
        await assert.rejects(confirmBuckets([], async () => ({
            ok: true, json: async () => data,
        })), /server did not confirm/);
    }
});

test('network and malformed JSON failures remain explicit', async () => {
    await assert.rejects(confirmBuckets([], async () => {
        throw new Error('Disconnected');
    }), /Disconnected/);
    await assert.rejects(confirmBuckets([], async () => ({
        ok: true, json: async () => { throw new Error('Malformed response'); },
    })), /Malformed response/);
});

test('coverage drill-down preserves the complete off-team scope without mutating its source', () => {
    const result = coverageFilter(scope);
    assert.deepEqual(result, {...scope, allQuarters: scope.quarters});
    assert.notEqual(result.allQuarters, scope.quarters);
    assert.equal(scope.allQuarters, undefined);
});

test('quarter chart uses actual dates and spans the complete fiscal quarter without fake history',
    () => {
        const widget = {
            period_start: '2026-10-01', period_end: '2026-12-31', target: 40,
            trend: [
                {date: '2026-10-06', label: 'Oct 06', u2c_pct: 8.0},
                {date: '2026-10-06', label: 'Today (Oct 06, live)', u2c_pct: 8.4,
                    committed_acr: 840, source: 'live'},
            ],
        };
        const series = quarterChartSeries(widget);
        assert.equal(series.start, Date.parse('2026-10-01'));
        assert.equal(series.end, Date.parse('2026-12-31'));
        assert.deepEqual(series.committed, [{
            ...widget.trend[0], x: Date.parse('2026-10-06'), y: 8.0,
        }]);
        assert.deepEqual(series.live, [{
            ...widget.trend[1], x: Date.parse('2026-10-06'), y: 8.4,
        }]);
        assert.deepEqual(series.goal, [
            {x: series.start, y: 40}, {x: series.end, y: 40},
        ]);
        assert.equal(widget.trend.length, 2);
    });

test('rendered chart binds quarter dates to a linear axis and retains the live tooltip', () => {
    const widget = {
        period_start: '2026-10-01', period_end: '2026-12-31', target: 40, value: 8.4,
        trend: [
            {date: '2026-10-06', label: 'Oct 06', u2c_pct: 8.0},
            {date: '2026-10-06', label: 'Today (Oct 06, live)', u2c_pct: 8.4,
                committed_acr: 840, source: 'live'},
        ],
    };
    const canvas = {};
    let chart;
    let pointColorsAtCreation;
    const document = {
        readyState: 'complete', documentElement: {},
        querySelectorAll: () => [{dataset: {embedded: 'true'}, querySelectorAll: () => []}],
        getElementById: id => ({
            connectGoalsData: {textContent: JSON.stringify({teamFilter: scope, u2c: widget})},
            connectU2cChart: canvas,
        })[id] || null,
        createElement: () => ({getContext: () => ({
            clearRect() {}, fillRect() {}, getImageData: () => ({data: [1, 2, 3, 255]}),
        })}),
    };
    const window = {
        document,
        Chart: class {
            constructor(element, config) {
                assert.equal(element, canvas);
                this.data = config.data;
                this.options = config.options;
                chart = this;
                pointColorsAtCreation = config.data.datasets.map(d => d.pointBackgroundColor);
            }
            update() {}
        },
        MutationObserver: class { observe() {} },
        getComputedStyle: () => ({getPropertyValue: () => 'rgb(1, 2, 3)'}),
    };
    vm.runInNewContext(source, {window, document});
    assert.equal(chart.options.scales.x.type, 'linear');
    assert.equal(chart.options.scales.x.min, Date.parse('2026-10-01'));
    assert.equal(chart.options.scales.x.max, Date.parse('2026-12-31'));
    assert.equal(chart.data.datasets[0].data.length, 1);
    assert.equal(chart.data.datasets[0].data[0].x, Date.parse('2026-10-06'));
    assert.equal(chart.data.datasets[0].data[0].y, 8.0);
    assert.equal(chart.data.datasets[1].data[0].x, chart.options.scales.x.min);
    assert.equal(chart.data.datasets[1].data[1].x, chart.options.scales.x.max);
    assert.equal(chart.data.datasets[2].data.length, 1);
    assert.equal(chart.data.datasets[2].data[0].x, chart.data.datasets[0].data[0].x);
    assert.equal(chart.data.datasets[2].data[0].y, 8.4);
    assert.equal(chart.data.datasets[2].showLine, false);
    assert.equal(chart.data.datasets[2].pointStyle, 'rectRot');
    assert.equal(pointColorsAtCreation[0], 'rgb(1, 2, 3)');
    assert.equal(pointColorsAtCreation[2], 'rgb(1, 2, 3)');
    const liveContext = {
        dataset: chart.data.datasets[2], datasetIndex: 2,
        raw: chart.data.datasets[2].data[0],
        parsed: {x: Date.parse('2026-10-06'), y: 8.4},
    };
    assert.equal(chart.options.plugins.tooltip.callbacks.title([liveContext]),
        'Today (Oct 06, live)');
    assert.match(chart.options.plugins.tooltip.callbacks.label(liveContext), /840.*committed/);
    const legendFilter = chart.options.plugins.legend.labels.filter;
    assert.equal(legendFilter({datasetIndex: 2}, chart.data), true);
    assert.equal(legendFilter({datasetIndex: 2}, {datasets: [{}, {}, {data: []}]}), false);
});

test('Today can be shown without inventing a published snapshot series', () => {
    const series = quarterChartSeries({
        period_start: '2026-10-01', period_end: '2026-12-31', target: 40,
        trend: [{date: '2026-10-06', label: 'Today (Oct 06, live)',
            source: 'live', committed_acr: 840, u2c_pct: 8.4}],
    });
    assert.deepEqual(series.committed, []);
    assert.equal(series.live.length, 1);
    assert.equal(series.live[0].y, 8.4);
});

test('dashboard instances initialize separate charts and bind drill-downs to their own scope', () => {
        const charts = [];
        const handlers = [];
        const writes = [];
        const roots = [1, 2, 3, 4].map(id => {
            const canvas = id <= 2 ? {instance: id} : null;
            const button = {addEventListener: (_, handler) => handlers.push(handler)};
            const nodes = {
                connectGoalsData: {textContent: JSON.stringify({
                    teamFilter: {...scope, seller: String(id)},
                    u2c: canvas ? {
                        value: id, target: 40,
                        period_start: '2026-10-01', period_end: '2026-12-31',
                        trend: [{date: '2026-10-16', u2c_pct: id}],
                    } : null,
                })},
                connectU2cChart: canvas,
            };
            return {
                dataset: {embedded: 'true', widgetPrefix: `dw${id}-`},
                querySelector: selector => nodes[selector.replace(`#dw${id}-`, '')] || null,
                querySelectorAll: () => canvas ? [] : [button],
            };
        });
        const document = {
            readyState: 'complete', documentElement: {},
            querySelectorAll: () => roots,
            getElementById() { throw new Error('Dashboard instances must use scoped queries'); },
            createElement: () => ({getContext: () => ({
                clearRect() {}, fillRect() {}, getImageData: () => ({data: [1, 2, 3, 255]}),
            })}),
        };
        const window = {
            document,
            Chart: class {
                constructor(canvas, config) { charts.push({canvas, config}); }
            },
            MutationObserver: class { observe() {} },
            getComputedStyle: () => ({getPropertyValue: () => 'rgb(1, 2, 3)'}),
            localStorage: {setItem: (key, value) => writes.push(JSON.parse(value))},
            location: {assign() {}},
        };
        vm.runInNewContext(source, {window, document});
        assert.deepEqual(charts.map(chart => chart.canvas.instance), [1, 2]);
        assert.deepEqual(charts.map(chart => chart.config.data.datasets[0].data[0].y), [1, 2]);
        handlers[0]();
        handlers[1]();
        assert.deepEqual(writes.map(filter => filter.seller), ['3', '4']);
});
test('failed widget tracker preference writes show an error rather than navigating unscoped', () => {
    const notice = {hidden: true};
    let click;
    const root = {
        dataset: {widgetPrefix: 'widget-'},
        querySelectorAll: () => [{addEventListener(event, fn) { click = fn; }}],
        querySelector: selector => ({
            '#widget-connectGoalsData': {textContent: JSON.stringify({teamFilter: scope})},
            '#widget-connectNavigationStatus': notice,
        })[selector],
    };
    const document = {readyState: 'complete', querySelectorAll: () => [root]};
    const window = {
        document,
        localStorage: {setItem() { throw new Error('Storage unavailable'); }},
        location: {assign() { assert.fail('Must not navigate without scope'); }},
    };
    vm.runInNewContext(source, {window, document, console: {error() {}}});
    click();
    assert.equal(notice.hidden, false);
    assert.match(notice.textContent, /Could not open.*Storage unavailable/);
});
