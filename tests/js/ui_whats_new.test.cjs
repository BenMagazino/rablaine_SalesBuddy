const assert = require('node:assert/strict');
const test = require('node:test');
const {validateFilter, validateCollapsed, validateDays, calendarDate, restrictedTypes,
    matches, auditDate, createTeamChanger, setMembership,
    restoreLookback} = require('../../static/js/ui-whats-new.js');

const available = ['Title', 'Status', 'Est. ACR/mo'];
const filter = {seller: '', area: '', team: '', grouped: true, changeTypes: available};
const row = {section: 'updated', sellerId: '12', area: 'Data', onMyTeam: 'true',
    types: ['Title', 'Status']};

test('seller, area and team intersect, with change types restricted to Updated', () => {
    assert.equal(matches(row, filter, available), true);
    for (const scope of [{seller: '3'}, {area: 'Infra'}, {team: 'off'},
        {changeTypes: ['Est. ACR/mo']}, {changeTypes: []}]) {
        assert.equal(matches(row, {...filter, ...scope}, available), false);
    }
    assert.equal(matches(row, {...filter, seller: '12', area: 'Data', team: 'on',
        changeTypes: ['Status']}, available), true);
    assert.equal(matches({...row, section: 'created'}, {...filter, changeTypes: []},
        available), true);
    assert.equal(restrictedTypes({...filter, changeTypes: null}, []), false);
    assert.equal(matches({...row, types: []}, filter, available), true);
    assert.equal(matches({...row, types: []}, {...filter, changeTypes: ['Title']},
        available), false);
});

test('latest selected audit controls the date, with original-date fallback and all-type reset', () => {
    const audits = {'22': {Title: '2025-12-31T23:59:59', Status: '2026-01-02T01:00:00',
        'Est. ACR/mo': '2026-03-04T09:00:00'}};
    assert.equal(auditDate('22', {...filter, changeTypes: ['Title', 'Status']},
        available, audits), '2026-01-02T01:00:00');
    assert.equal(auditDate('22', filter, available, audits), null);
    assert.equal(auditDate('22', {...filter, changeTypes: []}, available, audits), null);
    assert.equal(auditDate('99', {...filter, changeTypes: ['Title']}, available, audits), null);
    assert.equal(calendarDate('2025-12-31T23:59:59'), '2025-12-31');
    assert.equal(calendarDate('2024-02-29'), '2024-02-29');
    for (const invalid of ['2026-02-29', '2026-04-31', 'bad', null,
        '2026-01-01T99:00:00', '2026-01-01T24:00:00', '2026-01-01T00:00:00Z']) {
        assert.throws(() => calendarDate(invalid), /Invalid milestone calendar date/);
    }
});

test('legacy preferences accept ungrouped, empty selections and safe collapsed paths', () => {
    assert.deepEqual(validateFilter({...filter, grouped: false, changeTypes: []}),
        {...filter, grouped: false, changeTypes: []});
    const collapsed = validateCollapsed({'created:seller:Rick/cust:Customer': true,
        'updated:cust:Customer': false});
    assert.equal(Object.getPrototypeOf(collapsed), null);
    assert.equal(collapsed['created:seller:Rick/cust:Customer'], true);
    for (const value of [null, [], {...filter, grouped: 'true'},
        {...filter, team: 'mine'}, {...filter, changeTypes: 'Title'},
        {...filter, changeTypes: [false]}]) assert.throws(() => validateFilter(value));
    for (const value of [null, [], {bad: true}, {'created:seller:Rick': 'true'}]) {
        assert.throws(() => validateCollapsed(value));
    }
});

test('saved lookback respects the provider range, including non-preset windows', () => {
    for (const value of ['1', '3', '5', '7', '14', '30', '60', '90']) {
        assert.equal(validateDays(value), value);
    }
    for (const value of ['', '0', '91', '-1', '1.5', 'bad', null, undefined]) {
        assert.throws(() => validateDays(value));
    }
});

test('Back resets the retained pending dropdown to the immutable server window', () => {
    const select = {value: '3'};
    assert.equal(restoreLookback(select, '14'), '14');
    assert.equal(select.value, '14');
    select.value = '90';
    restoreLookback(select, '5');
    assert.equal(select.value, '5');
    assert.throws(() => restoreLookback(select, '91'));
    assert.equal(select.value, '5');
});

test('confirmed membership updates all occurrences, export booleans, raw sorting and scope', () => {
    function entry(section, id) {
        const label = {}, icon = {};
        const button = {dataset: {}, setAttribute(key, value) { this[key] = value; },
            querySelector: selector => selector === 'span' ? label : icon};
        const cell = {dataset: {}, querySelector: () => button};
        return {...row, section, id, element: {dataset: {},
            cells: [{dataset: {sbSortValue: 'Full milestone title'}}, {}, {}, {}, cell]}};
    }
    const rows = [entry('created', '22'), entry('updated', '22'), entry('updated', '23')];
    setMembership(rows, '22', false);
    for (const entry of rows.slice(0, 2)) {
        assert.equal(entry.onMyTeam, 'false');
        assert.equal(entry.element.dataset.onMyTeam, 'false');
        const cell = entry.element.cells[4], button = cell.querySelector('button');
        assert.equal(cell.dataset.exportBool, 'false');
        assert.equal(cell.dataset.sbSortValue, '0');
        assert.equal(button.dataset.onTeam, 'false');
        assert.equal(button['aria-label'], 'Join milestone team: Full milestone title');
        assert.equal(button.querySelector('span').textContent, 'Join');
        assert.equal(button.querySelector('i').className, 'bi bi-person-plus');
    }
    assert.equal(rows.filter(entry => matches(entry, {...filter, team: 'on'}, available)).length, 1);
    assert.equal(rows[2].onMyTeam, 'true');
    setMembership(rows, '22', true);
    assert.equal(rows.filter(entry => matches(entry, {...filter, team: 'on'}, available)).length, 3);
    assert.equal(rows[0].element.cells[4].dataset.sbSortValue, '1');
});

test('membership is serialized and changes only after a boolean success confirmation', async () => {
    let release;
    const changes = [];
    const changer = createTeamChanger(() => new Promise(resolve => { release = resolve; }),
        (id, flag) => changes.push([id, flag]));
    const first = changer.change('22', true);
    assert.equal(changer.busy, true);
    assert.deepEqual(changes, []);
    await assert.rejects(changer.change('23', true), /Membership needs review/);
    release({success: true});
    await first;
    assert.deepEqual(changes, [['22', true]]);
    assert.equal(changer.busy, false);
    assert.equal(changer.uncertain.size, 0);
});

test('explicit rejection can be retried manually; transport and malformed responses cannot', async () => {
    let calls = 0;
    const rejected = createTeamChanger(async () => {
        calls++;
        return calls === 1 ? {success: false, error: 'Access denied'} : {success: true};
    }, () => {});
    await assert.rejects(rejected.change('22', true), /Access denied/);
    assert.equal(rejected.uncertain.size, 0);
    await rejected.change('22', true);
    for (const response of [null, {}, {success: 'true'}]) {
        const changer = createTeamChanger(async () => response, () => assert.fail());
        await assert.rejects(changer.change('22', true), /Invalid membership confirmation/);
        assert.equal(changer.uncertain.has('22'), true);
        await assert.rejects(changer.change('22', true), /Membership needs review/);
    }
    let writes = 0;
    const transport = createTeamChanger(async () => { writes++; throw new Error('Disconnected'); },
        () => assert.fail());
    await assert.rejects(transport.change('22', false), /Disconnected/);
    await assert.rejects(transport.change('22', false), /Membership needs review/);
    assert.equal(writes, 1);
    assert.equal(transport.busy, false);
});
