const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-capacity-overview.js'), 'utf8');
const helper = source.slice(source.indexOf('    function isTrialCapacity('),
    source.indexOf('    function render('));

test('workload groups follow the chosen reading order and retain unknown workloads', () => {
    const workloads = ['SQLDb', 'Power BI', 'AppDev', 'Copilot', 'DE and DS',
        'Data Integration', 'Data Warehousing Core', 'OneLake', 'Planning',
        'Real Time Intelligence', 'Future workload'];
    const groups = vm.runInNewContext(`${helper}\nworkloadGroups(workloads);`, {workloads});
    assert.deepEqual(Array.from(groups, ([, names]) => Array.from(names)), [
        ['AppDev', 'Planning', 'Real Time Intelligence'],
        ['DE and DS', 'Data Integration', 'Data Warehousing Core'],
        ['OneLake', 'Copilot', 'Power BI'], ['SQLDb'], ['Future workload'],
    ]);
    const partial = vm.runInNewContext(`${helper}\nworkloadGroups(['SQLDb', 'Copilot']);`);
    assert.deepEqual(Array.from(partial, ([, names]) => Array.from(names)), [
        ['Copilot'], ['SQLDb'],
    ]);
});

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
    assert.match(source, /if \(!capacity\) return false/);
    assert.doesNotMatch(source, /modePreference\.value [!=]== 'all'/);
    assert.match(source, /find\('mode'\), 'salesbuddy_fabric_overview_mode', render/);
});

test('trial-to-paid selects trials without any paid F SKU and retains P capacity context', () => {
    const rows = [
        {id: 1, capacity: {sku: 'FTL64'}},
        {id: 1, capacity: {sku: 'F64'}},
        {id: 2, capacity: {sku: ' ftl4 '}},
        {id: 2, capacity: {sku: ' p2 '}},
        {id: 3, capacity: {sku: 'FTL64'}},
        {id: 3, capacity: {sku: ' f4 '}},
        {id: 4, capacity: {sku: 'FTL4'}},
        {id: 4, capacity: {sku: 'F0'}},
        {id: 4, capacity: {sku: 'F64X'}},
        {id: 5, capacity: null},
        {id: 6, capacity: {sku: 'FTL640'}},
        {id: 7, capacity: {sku: 'P1'}},
    ];
    const ids = vm.runInNewContext(`${helper}\ngetTrialToPaidCustomerIds(rows);`, {rows});
    assert.deepEqual(Array.from(ids), [2, 4]);
    const scoped = rows.filter(row => ids.has(row.id));
    assert.deepEqual(scoped.map(row => row.capacity.sku),
        [' ftl4 ', ' p2 ', 'FTL4', 'F0', 'F64X']);
    const customers = vm.runInNewContext(`${helper}\ncustomerRows(rows, true);`, {rows: scoped});
    assert.deepEqual(Array.from(customers, row => row.id), [2, 4]);
    assert.equal(customers[0].measuredTotal, 1);
    assert.match(source, /modePreference\.value === 'trial_to_paid'/);
    assert.match(source, /trialToPaid \? getTrialToPaidCustomerIds\(report\.rows\)/);
    assert.equal(vm.runInNewContext(`${helper}\ngetTrialToPaidCustomerIds([]).size;`), 0);
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
    assert.match(source, /trialsOnly \|\| fOnly \? orderMatchingCapacities\(report\.rows/);
});

test('P SKU badges retain valid source classification and do not color utilization', () => {
    const skus = ['P1', ' p5 ', 'PP1', 'P1X', 'P0', 'P', 'F64', null];
    const flags = vm.runInNewContext(
        `${helper}\nskus.map(sku => isPCapacity({capacity: {sku}}));`, {skus});
    assert.deepEqual(Array.from(flags), [true, true, false, false, false, false, false, false]);
    const styling = source.slice(source.indexOf('                if (isPCapacity'),
        source.indexOf('                if (index === 2 && row.customerMode)'));
    assert.match(styling, /index === 2/);
    assert.match(styling, /sb-fabric-p-sku/);
    assert.doesNotMatch(styling, /utilization|trial-color/);
});

test('paid F audit selects customers, preserves P/trial context, and numbers F capacities first', () => {
    const rows = [
        {id: 1, capacity_index: 1, capacity: {sku: 'P1'}},
        {id: 1, capacity_index: 2, capacity: {sku: 'FTL64'}},
        {id: 1, capacity_index: 3, capacity: {sku: ' f8 '}},
        {id: 1, capacity_index: 4, capacity: {sku: 'F4'}},
        {id: 2, capacity_index: 1, capacity: {sku: 'FTL4'}},
        {id: 3, capacity_index: 1, capacity: {sku: 'P2'}},
        ...['F0', 'F64X', 'FTL640', null].map((sku, index) =>
            ({id: index + 4, capacity_index: 1, capacity: {sku}})),
        {id: 9, capacity: null},
    ];
    const ids = vm.runInNewContext(`${helper}\ngetFCustomerIds(rows);`, {rows});
    assert.deepEqual(Array.from(ids), [1]);
    const scoped = rows.filter(row => ids.has(row.id));
    assert.equal(scoped.length, 4);
    const ordered = vm.runInNewContext(
        `${helper}\norderMatchingCapacities(rows, isFCapacity);`, {rows: scoped});
    assert.deepEqual(Array.from(ordered, row => row.capacity.sku), [' f8 ', 'F4', 'P1', 'FTL64']);
    assert.deepEqual(Array.from(ordered, row => row.capacity_index), [1, 2, 3, 4]);
    assert.equal(rows[0].capacity_index, 1);
    const customers = vm.runInNewContext(`${helper}\ncustomerRows(rows, false);`, {rows: scoped});
    assert.equal(customers.length, 1);
    assert.equal(customers[0].capacityMix.length, 4);
    assert.match(source, /modePreference\.value === 'f'/);
    assert.match(source, /getFCustomerIds\(report\.rows\)/);
    assert.match(source, /if \(fCustomers && !fCustomers\.has\(row\.id\)\) return false/);
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
    assert.match(source, /if \(trialsOnly && index === 3 && value != null\)/);
});

test('FTL and P SKU badges appear independently of customer filters', () => {
    const styling = source.slice(source.indexOf('                if (isTrialCapacity(row))'),
        source.indexOf('                if (index === 2 && row.customerMode)'));
    assert.match(styling, /if \(isTrialCapacity\(row\)\)/);
    assert.match(styling, /if \(isPCapacity\(row\) && index === 2\)/);
    assert.doesNotMatch(styling, /if \(trialsOnly && is/);
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
    assert.doesNotMatch(source, /sb-fabric-column-groups|name: 'Cap\.'|name: 'CU hours'/);
    assert.match(source, /index >= 4 && value > 0/);
    assert.match(source, /fabric-capacity-overview-v4:/);
});

test('customer rows average trials in trial audit and all capacities otherwise', () => {
    const rows = [
        {id: 1, name: 'First', capacity: {sku: 'FTL64', utilization_pct: 0}},
        {id: 1, name: 'First', capacity: {sku: 'FTL64', utilization_pct: 10}},
        {id: 1, name: 'First', capacity: {sku: 'P1', utilization_pct: 80}},
        {id: 1, name: 'First', capacity: {sku: 'F64', utilization_pct: null}},
        {id: 2, name: 'Empty', capacity: null},
    ];
    const trial = vm.runInNewContext(`${helper}\ncustomerRows(rows, true);`, {rows});
    assert.equal(trial.length, 2);
    assert.equal(trial[0].capacity.utilization_pct, 5);
    assert.equal(trial[0].measuredCount, 2);
    assert.equal(trial[0].measuredTotal, 2);
    assert.deepEqual(Array.from(trial[0].capacityMix, pair => Array.from(pair)),
        [['F64', 1], ['FTL64', 2], ['P1', 1]]);
    assert.equal(trial[1].capacity.utilization_pct, null);
    const all = vm.runInNewContext(`${helper}\ncustomerRows(rows, false);`, {rows});
    assert.equal(all[0].capacity.utilization_pct, 30);
    assert.equal(all[0].measuredCount, 3);
    assert.equal(all[0].measuredTotal, 4);
    assert.equal(rows[0].capacity.utilization_pct, 0);
});

test('seller grouping preserves customer rows, separates same-name sellers, and puts unassigned last', () => {
    const rows = [
        {id: 1, seller: {id: 2, name: 'Zed'}},
        {id: 2, seller: null},
        {id: 3, seller: {id: 1, name: 'Alex'}},
        {id: 4, seller: {id: 1, name: 'Alex'}},
        {id: 5, seller: {id: 3, name: 'Alex'}},
    ];
    const groups = vm.runInNewContext(`${helper}\nsellerGroups(rows, true);`, {rows});
    assert.deepEqual(Array.from(groups, group => group.seller?.id ?? null), [1, 3, 2, null]);
    assert.deepEqual(Array.from(groups[0].rows, row => row.id), [3, 4]);
    const plain = vm.runInNewContext(`${helper}\nsellerGroups(rows, false);`, {rows});
    assert.equal(plain.length, 1);
    assert.equal(plain[0].rows.length, 5);
    assert.equal(vm.runInNewContext(`${helper}\nsellerGroups([], true);`).length, 0);
});
