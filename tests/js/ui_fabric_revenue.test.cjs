const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-revenue.js'), 'utf8');

function node(tag = 'div', text = '') {
    return {
        tag, textContent: text, children: [], hidden: false, attrs: {},
        classList: {add() {}},
        style: {values: {}, setProperty(key, value) { this.values[key] = value; }},
        setAttribute(key, value) { this.attrs[key] = value; },
        append(...items) { this.children.push(...items); },
        replaceChildren(...items) { this.children = items; },
    };
}

function harness() {
    const nodes = Object.fromEntries(
        ['summary', 'months', 'month-headings', 'body', 'context', 'state', 'monthly', 'chart', 'chart-note']
            .map(key => [key, node()]));
    const root = {...node(), querySelector: selector =>
        nodes[selector.match(/data-revenue-(.*)\]/)[1]]};
    const window = {};
    const errors = [];
    vm.runInNewContext(source, {window, document: {createElement: node},
        console: {error: (...items) => errors.push(items)}});
    return {root, nodes, errors, render: customer =>
        window.SBFabricRevenue.render(root, customer)};
}

function text(item) {
    return [item.textContent, ...item.children.map(text)].join(' ');
}

function customer() {
    return {status: 'available', revenue: {
        state: 'available',
        summary: {total_revenue_ytd: 100, reservation_revenue_ytd: 25,
            paygo_revenue_ytd: 75, reservation_share_pct: 25},
        months: [{fiscal_month: 'September 2026', reservation_revenue: 25,
            paygo_revenue: 75, total_revenue: 100}],
        metadata: {fiscal_year_label: 'FY27', latest_month_label: 'September 2026',
            currency_label: 'Source currency'},
    }};
}

test('revenue renders customer-wide YTD metrics and monthly amounts as safe text', () => {
    const h = harness();
    const data = customer();
    data.revenue.months[0].fiscal_month = '<source month>';
    h.render(data);
    assert.match(text(h.nodes.summary), /Total revenue YTD 100\.00/);
    assert.match(text(h.nodes.summary), /Reserved instance revenue YTD 25\.00/);
    assert.match(text(h.nodes.summary), /PAYG revenue YTD 75\.00/);
    assert.match(text(h.nodes.summary), /RI share of revenue YTD 25%/);
    assert.match(text(h.nodes['month-headings']), /<source month>/);
    assert.deepEqual(h.nodes.months.children.map(row => row.children[1].textContent),
        ['25.00', '75.00', '100.00']);
    assert.equal(h.nodes.context.textContent, 'FY27 / through September 2026 / Source currency');
    assert.equal(h.nodes.body.hidden, false);
    assert.equal(h.nodes.state.hidden, true);
    assert.doesNotMatch(source, /innerHTML/);
});

test('zero, unknown, negative adjustments and out-of-range shares are not conflated or capped', () => {
    const h = harness();
    const data = customer();
    data.revenue.summary = {total_revenue_ytd: 0, reservation_revenue_ytd: null,
        paygo_revenue_ytd: -5, reservation_share_pct: 120};
    data.revenue.months[0] = {fiscal_month: 'July 2026', reservation_revenue: 0,
        paygo_revenue: -5, total_revenue: null};
    h.render(data);
    assert.match(text(h.nodes.summary), /Total revenue YTD 0\.00/);
    assert.match(text(h.nodes.summary), /Reserved instance revenue YTD Not reported/);
    assert.match(text(h.nodes.summary), /PAYG revenue YTD -5\.00/);
    assert.match(text(h.nodes.summary), /120%/);
    assert.match(text(h.nodes['month-headings']), /Jul 2026/);
    assert.deepEqual(h.nodes.months.children.map(row => row.children[1].textContent),
        ['0.00', '-5.00', 'Not reported']);
});

test('customer switches clear prior revenue for missing snapshots and empty results', () => {
    const h = harness();
    h.render(customer());
    h.render({status: 'no_data', revenue: {state: 'not_imported'}});
    assert.equal(h.nodes.summary.children.length, 0);
    assert.equal(h.nodes.months.children.length, 0);
    assert.equal(h.nodes['month-headings'].children.length, 0);
    assert.equal(h.nodes.chart.children.length, 0);
    assert.equal(h.nodes.context.textContent, '');
    assert.equal(h.nodes.body.hidden, true);
    assert.match(h.nodes.state.textContent, /has not been imported/);
    h.render({status: 'no_data', revenue: {state: 'no_data'}});
    assert.match(h.nodes.state.textContent, /does not prove zero revenue or no reservations/);
    h.render({status: 'missing_tpid'});
    assert.match(h.nodes.state.textContent, /valid TPID/);
    h.render(null);
    assert.equal(h.root.hidden, true);
});

test('revenue remains available without telemetry and does not guess a currency or a fiscal year', () => {
    const h = harness();
    const data = customer();
    data.status = 'no_data';
    data.revenue.metadata = {};
    data.revenue.months = [];
    h.render(data);
    assert.equal(h.nodes.body.hidden, false);
    assert.equal(h.nodes.monthly.hidden, true);
    assert.equal(h.nodes.chart.children.length, 0);
    assert.equal(h.nodes.context.textContent,
        'Microsoft fiscal YTD (July-June) / Source revenue (CD)');
    assert.doesNotMatch(h.nodes.context.textContent, /USD|FY27/);
});

test('revenue-specific freshness does not borrow the capacity import timestamp', () => {
    const h = harness();
    const data = customer();
    data.revenue.metadata.imported_at = '2026-10-12T16:23:52Z';
    h.render(data);
    assert.match(h.nodes.context.textContent, /Revenue imported/);
    data.revenue.metadata.imported_at = 'not a date';
    h.render(data);
    assert.match(h.nodes.context.textContent, /Revenue import date unavailable/);
});

test('an invalid saved revenue status surfaces an error rather than claiming no data', () => {
    const h = harness();
    h.render({status: 'available', revenue: {state: 'failed'}});
    assert.match(h.nodes.state.textContent, /status is invalid/);
    assert.equal(h.nodes.state.attrs.role, 'alert');
    assert.equal(h.nodes.body.hidden, true);
    assert.equal(h.errors.length, 1);
});

test('monthly bars are 100% stacks with RI below PAYG, not absolute revenue columns', () => {
    const h = harness();
    const data = customer();
    data.revenue.months.push({fiscal_month: 'October 2026', reservation_revenue: 630,
        paygo_revenue: 370, total_revenue: 1000});
    h.render(data);
    const columns = h.nodes.chart.children[0].children;
    assert.equal(columns.length, 2);
    const [ri, paygo] = columns[0].children[0].children;
    assert.match(ri.className, /segment--ri/);
    assert.match(paygo.className, /segment--paygo/);
    assert.equal(ri.style.height, '25%');
    assert.equal(paygo.style.height, '75%');
    assert.equal(ri.textContent, '25%');
    assert.equal(paygo.textContent, '75%');
    const next = columns[1].children[0];
    assert.equal(next.children[0].style.height, '63%');
    assert.equal(next.children[1].style.height, '37%');
    assert.match(next.attrs['aria-label'], /October 2026.*RI 630\.00.*PAYG 370\.00.*63%.*37%/);
    assert.equal(next.attrs.tabindex, '0');
    assert.equal(h.nodes['chart-note'].hidden, true);
});

test('missing, zero, negative and unreconciled data remain unplotted rather than invented', () => {
    const h = harness();
    const data = customer();
    data.revenue.months = [
        {fiscal_month: 'Missing', reservation_revenue: null, paygo_revenue: 100, total_revenue: null},
        {fiscal_month: 'Zero', reservation_revenue: 0, paygo_revenue: 0, total_revenue: 0},
        {fiscal_month: 'Adjustment', reservation_revenue: -5, paygo_revenue: 105, total_revenue: 100},
        {fiscal_month: 'Mismatch', reservation_revenue: 30, paygo_revenue: 60, total_revenue: 100},
    ];
    h.render(data);
    const bars = h.nodes.chart.children[0].children.map(column => column.children[0]);
    assert.ok(bars.every(bar => bar.children[0].textContent === 'No mix'));
    assert.match(bars[0].title, /Missing revenue/);
    assert.match(bars[1].title, /percentage mix is undefined/);
    assert.match(bars[2].title, /Negative adjustment/);
    assert.match(bars[3].title, /do not reconcile/);
    assert.equal(h.nodes['chart-note'].hidden, false);
    assert.match(text(h.nodes.months), /-5\.00/);
    assert.match(text(h.nodes.months), /Not reported/);
});

test('a single reported revenue category fills the bar without rewriting missing amounts', () => {
    for (const absent of [null, undefined, 0]) {
        for (const kind of ['ri', 'paygo']) {
            const h = harness();
            const data = customer();
            data.revenue.months = [{fiscal_month: 'Single category',
                reservation_revenue: kind === 'ri' ? 100 : absent,
                paygo_revenue: kind === 'paygo' ? 100 : absent,
                total_revenue: 100}];
            h.render(data);
            const bar = h.nodes.chart.children[0].children[0].children[0];
            const [ri, paygo] = bar.children;
            const full = kind === 'ri' ? ri : paygo;
            const empty = kind === 'ri' ? paygo : ri;
            assert.equal(full.style.height, '100%');
            assert.equal(full.textContent, '100%');
            assert.equal(empty.style.height, '0%');
            assert.match(full.className, new RegExp(`segment--${kind}`));
            assert.equal(h.nodes['chart-note'].hidden, true);
            const missingRow = kind === 'ri' ? 1 : 0;
            assert.equal(h.nodes.months.children[missingRow].children[1].textContent,
                absent === 0 ? '0.00' : 'Not reported');
            if (absent == null) assert.match(bar.title, /Only one revenue category was reported/);
        }
    }
});

test('unknown or invalid revenue components do not fabricate a single-category mix', () => {
    const h = harness();
    const data = customer();
    data.revenue.months = [
        {reservation_revenue: null, paygo_revenue: null, total_revenue: 100},
        {reservation_revenue: null, paygo_revenue: 60, total_revenue: 100},
        {reservation_revenue: NaN, paygo_revenue: 100, total_revenue: 100},
        {reservation_revenue: null, paygo_revenue: -100, total_revenue: -100},
    ];
    h.render(data);
    const bars = h.nodes.chart.children[0].children.map(column => column.children[0]);
    assert.ok(bars.every(bar => bar.children[0].textContent === 'No mix'));
});

test('rounded labels total 100 and tiny known shares are not mislabeled as zero', () => {
    const h = harness();
    const data = customer();
    data.revenue.months = [
        {fiscal_month: 'Rounding', reservation_revenue: 50.5, paygo_revenue: 49.5, total_revenue: 100},
        {fiscal_month: 'Small', reservation_revenue: 99.6, paygo_revenue: 0.4, total_revenue: 100},
        {fiscal_month: 'All PAYG', reservation_revenue: 0, paygo_revenue: 100, total_revenue: 100},
    ];
    h.render(data);
    const bars = h.nodes.chart.children[0].children.map(column => column.children[0]);
    assert.equal(bars[0].children[0].textContent, '51%');
    assert.equal(bars[0].children[1].textContent, '49%');
    assert.equal(bars[1].children[0].textContent, '>99%');
    assert.equal(bars[1].children[1].textContent, '');
    assert.match(bars[1].title, /PAYG 0\.4%/);
    assert.equal(bars[2].children[0].style.height, '0%');
    assert.equal(bars[2].children[1].style.height, '100%');
});

test('only source-precision rounding is tolerated and a zero denominator never creates a bar', () => {
    const h = harness();
    const data = customer();
    data.revenue.months = [
        {fiscal_month: 'Rounding', reservation_revenue: 25, paygo_revenue: 75,
            total_revenue: 100.00005},
        {fiscal_month: 'Mismatch', reservation_revenue: 25, paygo_revenue: 75,
            total_revenue: 100.0002},
        {fiscal_month: 'Zero components', reservation_revenue: 0, paygo_revenue: 0,
            total_revenue: 0.00001},
    ];
    h.render(data);
    const bars = h.nodes.chart.children[0].children.map(column => column.children[0]);
    assert.equal(bars[0].children[0].style.height, '25%');
    assert.equal(bars[1].children[0].textContent, 'No mix');
    assert.equal(bars[2].children[0].textContent, 'No mix');
    assert.doesNotMatch(text(h.nodes.chart), /NaN|Infinity/);
});

test('bar descriptions retain the source revenue precision without changing the compact table', () => {
    const h = harness();
    const data = customer();
    data.revenue.months = [{fiscal_month: 'October 2025', reservation_revenue: 5098.1412,
        paygo_revenue: 24.0783, total_revenue: 5122.2195}];
    h.render(data);
    const bar = h.nodes.chart.children[0].children[0].children[0];
    assert.match(bar.title, /5,098\.1412.*24\.0783.*5,122\.2195/);
    assert.deepEqual(h.nodes.months.children.map(row => row.children[1].textContent),
        ['5,098.14', '24.08', '5,122.22']);
});

test('monthly matrix has months across columns and fixed RI, PAYG and total rows', () => {
    const h = harness();
    const data = customer();
    data.revenue.months.push({fiscal_month: 'October, 2026', reservation_revenue: 63,
        paygo_revenue: 37, total_revenue: 100});
    h.render(data);
    const headers = h.nodes['month-headings'].children;
    assert.deepEqual(headers.map(header => header.textContent), ['Revenue', 'Sep 2026', 'Oct 2026']);
    assert.ok(headers.every(header => header.attrs.scope === 'col'));
    assert.equal(headers[2].title, 'October, 2026');
    assert.equal(headers[2].attrs['aria-label'], 'October, 2026');
    const rows = h.nodes.months.children;
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(row => row.children[0].textContent),
        ['Reserved instance (RI)', 'PAYG revenue', 'Total revenue']);
    assert.ok(rows.every(row => row.children[0].tag === 'th' &&
        row.children[0].attrs.scope === 'row'));
    assert.deepEqual(rows.map(row => row.children.slice(1).map(cell => cell.textContent)),
        [['25.00', '63.00'], ['75.00', '37.00'], ['100.00', '100.00']]);
});
