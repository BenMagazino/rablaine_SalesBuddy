const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const native = require('../../static/js/ui-u2c.js');

const scripts = JSON.parse(fs.readFileSync(0, 'utf8'));
const elements = {};
for (const id of [
    'u2cTrendChart', 'trendEmpty', 'trendScope', 'workloadFilter', 'filterSeller',
    'filterCustomer', 'cardU2cPct', 'cardU2cPctBar',
]) {
    elements[id] = {
        value: '', style: {}, className: '', textContent: '',
        classList: {toggle() {}},
    };
}
let remaining = [];
let committed = [];
let chart;
const context = vm.createContext({
    document: {
        body: {},
        getElementById: id => elements[id] || null,
        addEventListener() {},
        querySelectorAll: selector => {
            if (selector === '#remainingBody tr[data-workload]') return remaining;
            if (selector === '#committedBody tr[data-workload]') return committed;
            return [];
        },
    },
    localStorage: {setItem() {}, removeItem() {}},
    SBU2c: {...native, writePreference() {}, chartColors: () => ({
        muted: 'rgb(150, 150, 150)', grid: 'rgb(70, 70, 70)', text: 'rgb(220, 220, 220)',
        committed: 'rgb(90, 170, 130)', goal: 'rgb(130, 180, 220)'
    })},
    getComputedStyle: () => ({getPropertyValue: () => ''}),
    Chart: class {
        constructor(canvas, config) {
            this.data = config.data;
            this.options = config.options;
            chart = this;
        }
        update() {}
        destroy() {}
    },
});
scripts.forEach(script => vm.runInContext(script, context));
elements.workloadFilter.value = 'Data';
vm.runInContext("renderU2cTrend('Data')", context);
assert.equal(chart.data.datasets.length, 3);
assert.equal(chart.data.datasets[1].label, 'Total pipeline (starting uncommitted)');
assert.equal(chart.data.datasets[2].label, '40% goal');
assert.equal(chart.data.datasets[2].data.at(-1).y, 6151.2);
assert.ok(chart.data.datasets[0].data.at(-1).y > chart.data.datasets[2].data.at(-1).y);
const tooltip = chart.options.plugins.tooltip.callbacks.label;
const lastIndex = chart.data.datasets[0].data.length - 1;
assert.equal(tooltip({datasetIndex: 1, dataIndex: lastIndex}), ' Total pipeline $15,378');
assert.equal(tooltip({datasetIndex: 2, dataIndex: lastIndex}), ' 40% goal $6,151');
for (const prefix of ['Infra', '']) {
    elements.workloadFilter.value = prefix;
    vm.runInContext(`renderU2cTrend('${prefix}')`, context);
    chart.data.datasets[1].data.forEach((point, index) => {
        assert.equal(chart.data.datasets[2].data[index].y, point.y * 40 / 100);
    });
}
function row(acr) {
    return {style: {}, dataset: {workload: 'Data: Fabric', acr: String(acr), liveAcr: '0'}};
}
elements.workloadFilter.value = 'Data';
for (const percentage of [0, 39.9, 40, 48, 100]) {
    remaining = [row(100 - percentage)];
    committed = [row(percentage)];
    vm.runInContext('applyAllFilters()', context);
    const tone = percentage >= 40 ? 'success' : 'warning';
    assert.equal(elements.cardU2cPct.textContent, `${percentage}%`);
    assert.equal(elements.cardU2cPct.className, `u2c-value is-${tone}`);
    assert.equal(elements.cardU2cPctBar.className, `u2c-progress-fill is-${tone}`);
}
assert.equal(chart.options.plugins.colors.enabled, false);
assert.equal(chart.data.datasets[0].pointBackgroundColor, 'rgb(90, 170, 130)');
assert.equal(chart.data.datasets[2].borderColor, 'rgb(130, 180, 220)');

(async function verifyAgendaSave() {
    const classes = new Set();
    const composerClasses = new Set();
    const attributes = new Map();
    const note = {value: '  Review scope  ', readOnly: false, focus() {}};
    const error = {textContent: '', classList: {
        add: name => classes.add(name), remove: name => classes.delete(name)
    }};
    const cancel = {disabled: false};
    const toggle = {setAttribute() {}};
    const action = {replaceChildren(link) { this.link = link; }};
    const composer = {
        getAttribute: name => attributes.get(name),
        setAttribute: (name, value) => attributes.set(name, value),
        classList: {add: name => composerClasses.add(name)},
        parentElement: {querySelector: () => toggle},
        closest: () => action,
        querySelector: selector => ({
            textarea: note, '.u2c-agenda-error': error, '.js-u2c-agenda-cancel': cancel
        })[selector]
    };
    const button = {
        closest: () => composer, disabled: false, innerHTML: 'Add to 1:1',
        dataset: {endpoint: '/api/seller/7/one-on-one/u2c', milestoneId: '12'}
    };
    let resolve;
    let calls = 0;
    context.console = {error() {}};
    context.fetch = (url, options) => {
        calls++;
        assert.equal(url, button.dataset.endpoint);
        assert.deepEqual(JSON.parse(options.body), {
            milestone_id: '12', talking_points: 'Review scope'
        });
        return new Promise(done => { resolve = done; });
    };
    const pending = context.addU2cAgendaContext(button);
    await context.addU2cAgendaContext(button);
    context.closeU2cAgendaComposer(composer);
    assert.equal(calls, 1);
    assert.equal(attributes.get('aria-busy'), 'true');
    assert.equal(composerClasses.has('is-hidden'), false);
    assert.equal(cancel.disabled, true);
    assert.equal(note.readOnly, true);
    resolve({ok: false, json: async () => ({success: false, error: 'Save failed'})});
    await pending;
    assert.equal(error.textContent, 'Save failed');
    assert.equal(attributes.get('aria-busy'), 'false');
    assert.equal(button.disabled, false);
    assert.equal(cancel.disabled, false);
    assert.equal(note.readOnly, false);

    context.document.createElement = () => ({});
    context.fetch = async () => ({
        ok: true, json: async () => ({success: true, workspace_url: '/seller/7/one-on-one'})
    });
    await context.addU2cAgendaContext(button);
    assert.equal(action.link.href, '/seller/7/one-on-one');
    assert.equal(action.link.className.trim().replace(/\s+/g, ' '), 'u2c-command is-success');
    note.value = ' ';
    await context.addU2cAgendaContext(button);
    assert.equal(error.textContent, 'Enter a discussion note before adding this item.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
