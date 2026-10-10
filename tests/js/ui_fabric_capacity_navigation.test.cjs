const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const overview = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-capacity-overview.js'), 'utf8');
const detail = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-consumption.js'), 'utf8');

function rowLink(row) {
    const code = overview.slice(overview.indexOf('                    const url = new URL('),
        overview.indexOf('                    td.replaceChildren(link);'));
    const link = {};
    vm.runInNewContext(code, {row, link, URL, location: {origin: 'http://localhost:5000'}});
    return new URL(link.href);
}

test('overview links identify the exact tenant and capacity, independent of row numbering', () => {
    const url = rowLink({id: 307, capacity_index: 1,
        capacity: {tenant_id: 'tenant & one', capacity_id: 'capacity/second'}});
    assert.equal(url.searchParams.get('customer_id'), '307');
    assert.equal(url.searchParams.get('capacity'), 'tenant & one|capacity/second');
    assert.equal(rowLink({id: 307, capacity: null}).searchParams.has('capacity'), false);
    assert.equal(rowLink({id: 307, capacity: {capacity_id: 'id'}})
        .searchParams.get('capacity'), '|id');
});

test('detail selects the linked capacity rather than the first capacity', () => {
    const code = detail.slice(detail.indexOf("        const select = find('capacity-select');"),
        detail.indexOf('        renderCapacity();', detail.indexOf(
            "        const select = find('capacity-select');")));
    const options = [];
    const select = {value: '', replaceChildren() { options.length = 0; },
        append(option) { options.push(option); if (options.length === 1) this.value = option.value; }};
    const capacities = [
        {tenant_id: 'tenant', capacity_id: 'first', capacity_index: 1, capacity_total: 2},
        {tenant_id: 'tenant', capacity_id: 'second', capacity_index: 2, capacity_total: 2},
    ];
    for (const [selectedCapacity, expected] of [
        ['tenant|second', 'tenant|second'], ['', 'tenant|first'], ['missing', 'tenant|first'],
    ]) {
        select.value = '';
        vm.runInNewContext(code, {selectedCapacity, customer: {capacities},
            find: () => select, textElement: () => ({}),
            capacityKey: capacity => `${capacity.tenant_id ?? ''}|${capacity.capacity_id}`});
        assert.equal(select.value, expected);
    }
});

test('URL selection survives reloads, clears on customer switch, and reports stale links', () => {
    assert.match(detail, /let selectedCapacity = new URL\(location\.href\)\.searchParams\.get\('capacity'\)/);
    assert.match(detail, /url\.searchParams\.delete\('capacity'\)/);
    assert.match(detail, /url\.searchParams\.set\('capacity', selectedCapacity\)/);
    assert.match(detail, /The linked capacity is no longer available/);
});
