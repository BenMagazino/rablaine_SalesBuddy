const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-capacity-overview.js'), 'utf8');
const helper = source.slice(source.indexOf('    function isTrialCapacity('),
    source.indexOf('    function render('));

test('trial customer selection includes all capacities, not just trial rows', () => {
    const rows = [
        {id: 1, capacity: {sku: 'FTL64'}},
        {id: 1, capacity: {sku: 'F64'}},
        {id: 2, capacity: {sku: 'FTL4'}},
        {id: 2, capacity: {sku: 'F4'}},
        {id: 3, capacity: {sku: 'F64'}},
        {id: 4, capacity: null},
        {id: 5, capacity: {sku: 'FTL640'}},
        {id: 6, capacity: {sku: null}},
        {id: 7, capacity: {sku: ' ftl4 '}},
    ];
    const ids = vm.runInNewContext(`${helper}\ngetTrialCustomerIds(rows);`, {rows});
    assert.deepEqual(Array.from(ids), [1, 2, 7]);
    assert.deepEqual(rows.filter(row => ids.has(row.id)).map(row => row.capacity.sku),
        ['FTL64', 'F64', 'FTL4', 'F4', ' ftl4 ']);
});

test('audit modes are exclusive, imply capacities, and persist as one preference', () => {
    assert.match(source, /getTrialCustomerIds\(report\.rows\)/);
    assert.match(source, /if \(trialCustomers && !trialCustomers\.has\(row\.id\)\) return false/);
    assert.match(source, /modePreference\.value === 'trials'/);
    assert.match(source, /modePreference\.value === 'p'/);
    assert.match(source, /modePreference\.value !== 'all' && !capacity/);
    assert.match(source, /find\('mode'\), 'salesbuddy_fabric_overview_mode', render/);
});

test('trial-first numbering is per customer, stable within SKU groups, and does not mutate data', () => {
    const rows = [
        {id: 1, capacity_index: 1, capacity_total: 3, capacity: {sku: 'F64'}},
        {id: 1, capacity_index: 2, capacity_total: 3, capacity: {sku: 'FTL4'}},
        {id: 1, capacity_index: 3, capacity_total: 3, capacity: {sku: 'FTL64'}},
        {id: 2, capacity_index: 1, capacity_total: 2, capacity: {sku: 'F4'}},
        {id: 2, capacity_index: 2, capacity_total: 2, capacity: {sku: 'FTL64'}},
    ];
    const ordered = vm.runInNewContext(
        `${helper}\norderMatchingCapacities(rows, isTrialCapacity);`, {rows});
    assert.deepEqual(Array.from(ordered, row => row.capacity.sku),
        ['FTL4', 'FTL64', 'F64', 'FTL64', 'F4']);
    assert.deepEqual(Array.from(ordered, row => row.capacity_index), [1, 2, 3, 1, 2]);
    assert.deepEqual(Array.from(ordered, row => row.capacity_total), [3, 3, 3, 2, 2]);
    assert.deepEqual(rows.map(row => row.capacity_index), [1, 2, 3, 1, 2]);
    assert.equal(rows[0].capacity.sku, 'F64');
    assert.match(source, /trialsOnly \|\| pOnly \? orderMatchingCapacities\(report\.rows/);
});

test('P filter retains other capacities and excludes unrelated SKU families', () => {
    const rows = [
        {id: 1, capacity: {sku: 'P1'}}, {id: 1, capacity: {sku: 'F64'}},
        {id: 2, capacity: {sku: ' p5 '}}, {id: 2, capacity: {sku: 'FTL4'}},
        ...['PP1', 'P1X', 'P0', 'P', 'F64', null].map((sku, index) =>
            ({id: index + 3, capacity: {sku}})),
        {id: 10, capacity: null},
    ];
    const ids = vm.runInNewContext(`${helper}\ngetPCustomerIds(rows);`, {rows});
    assert.deepEqual(Array.from(ids), [1, 2]);
    assert.deepEqual(rows.filter(row => ids.has(row.id)).map(row => row.capacity.sku),
        ['P1', 'F64', ' p5 ', 'FTL4']);
    assert.match(source, /if \(pCustomers && !pCustomers\.has\(row\.id\)\) return false/);
});

test('P-first numbering uses stable capacity identities', () => {
    const rows = ['F64', 'P2', 'FTL64', 'P1'].map((sku, index) => ({
        id: 1, capacity_index: index + 1, capacity_total: 4, capacity: {sku},
    }));
    const pOnly = vm.runInNewContext(
        `${helper}\norderMatchingCapacities(rows, isPCapacity);`, {rows});
    assert.deepEqual(Array.from(pOnly, row => row.capacity.sku), ['P2', 'P1', 'F64', 'FTL64']);
    assert.deepEqual(Array.from(pOnly, row => row.capacity_index), [1, 2, 3, 4]);
    assert.deepEqual(rows.map(row => row.capacity_index), [1, 2, 3, 4]);
    const styling = source.slice(source.indexOf('                if (isPCapacity'),
        source.indexOf('                if (index === 2'));
    assert.match(styling, /index === 3/);
    assert.match(styling, /sb-fabric-p-sku/);
    assert.doesNotMatch(styling, /utilization|trial-color/);
});

test('trial utilization color progresses green to amber to red, capped at 50%', () => {
    const color = value => vm.runInNewContext(
        `${helper}\ngetTrialUtilizationColor(value);`, {value});
    assert.match(color(0), /milestone-rail.*warning\) 0%/);
    assert.match(color(12.5), /warning\) 50%/);
    assert.match(color(25), /warning\) 100%/);
    assert.match(color(37.5), /warning.*danger\) 50%/);
    assert.match(color(50), /danger\) 100%/);
    assert.equal(color(120), color(50));
    assert.equal(color(-1), color(0));
    assert.match(source, /if \(trialsOnly && index === 4 && value != null\)/);
});

test('FTL and P SKU badges appear independently of customer filters', () => {
    const styling = source.slice(source.indexOf('                if (isTrialCapacity(row))'),
        source.indexOf('                if (index === 2'));
    assert.match(styling, /if \(isTrialCapacity\(row\)\)/);
    assert.match(styling, /if \(isPCapacity\(row\) && index === 3\)/);
    assert.doesNotMatch(styling, /if \((trialsOnly|pOnly) && is/);
    assert.match(styling, /sb-fabric-trial-sku/);
    assert.match(styling, /sb-fabric-p-sku/);
});

test('Used % hover includes latest-hour utilization, including zero and missing readings', () => {
    const tooltip = row => vm.runInNewContext(`${helper}\ngetUsedTooltip(row);`,
        {row, percent: value => `${value}%`});
    assert.equal(tooltip({capacity: {latest_utilization_pct: 73.5}}),
        'Latest available hour utilization: 73.5%');
    assert.equal(tooltip({capacity: {latest_utilization_pct: 0}}),
        'Latest available hour utilization: 0%');
    assert.equal(tooltip({capacity: {latest_utilization_pct: null}}),
        'Latest available hour utilization: No measurement');
    assert.equal(tooltip({capacity: null}),
        'Latest available hour utilization: No measurement');
    assert.match(source, /td\.title = getUsedTooltip\(row\)/);
    assert.match(source, /td\.title \+= '\\nTrial utilization/);
    assert.doesNotMatch(source, /name: 'Hour %'/);
    assert.match(source, /\['Capacity consumption', 2\]/);
    assert.match(source, /index >= 6 && value > 0/);
    assert.match(source, /fabric-capacity-overview-v2:/);
});
