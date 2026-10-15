const assert = require('node:assert/strict');
const test = require('node:test');
const {formatDate, dateValue, money, filterRows, renewalStyle, renewalExplanation} =
    require('../../static/js/ui-ptof.js');

test('expiration uses the actual day and an explicit UTC calendar date', () => {
    assert.equal(formatDate('2027-06-01'), '01-Jun-27');
    assert.equal(formatDate('2027-06-19'), '19-Jun-27');
    assert.equal(dateValue('2027-06-01').getTime(), 1811808000000);
    assert.equal(formatDate(null), 'Not supplied');
    for (const value of ['Jun 2027', '2027-02-30', '', '2027-06-01T00:00:00Z']) {
        assert.throws(() => formatDate(value), /Invalid renewal date/);
    }
});

test('source blanks are not zero', () => {
    assert.equal(money(null), 'Not supplied');
    assert.equal(money(0), '$0.00');
    assert.equal(money(46363.56), '$46,363.56');
});

test('customer search matches names anywhere, source aliases and TPIDs', () => {
    const rows = [{customer_name: 'Hanger', source_customer_name: 'Hanger Inc.', tpid: 1008555},
        {customer_name: 'CRAWFORD AND COMPANY', tpid: 642956}];
    assert.deepEqual(filterRows(rows, ' anD '), [rows[1]]);
    assert.deepEqual(filterRows(rows, 'inc.'), [rows[0]]);
    assert.deepEqual(filterRows(rows, '8555'), [rows[0]]);
    assert.deepEqual(filterRows(rows, ''), rows);
    assert.deepEqual(filterRows(rows, 'no match'), []);
});

test('renewal colors and icons distinguish successful, pending and failed renewals', () => {
    for (const status of ['PSKU Renewed + New Fabric', 'PSKU Renewed', 'P-to-F Renewed']) {
        assert.deepEqual(renewalStyle(status),
            {tone: 'success', icon: 'bi-check-circle-fill'});
    }
    for (const status of ['Pending Renewal', 'Partial P-to-F']) {
        assert.deepEqual(renewalStyle(status),
            {tone: 'warning', icon: 'bi-exclamation-circle-fill'});
    }
    assert.deepEqual(renewalStyle('Not Renewed'),
        {tone: 'danger', icon: 'bi-x-circle-fill'});
    for (const status of [null, '', 'New source status', '__proto__']) {
        assert.deepEqual(renewalStyle(status),
            {tone: 'neutral', icon: 'bi-question-circle'});
    }
});

test('renewal help explains inclusive source thresholds without inventing undocumented rules', () => {
    assert.equal(renewalExplanation('P-to-F Renewed'),
        'F-SKU renewal is at least 75%, while P-SKU renewal is below 75%.');
    assert.equal(renewalExplanation('PSKU Renewed'),
        'P-SKU renewal is at least 75%, while F-SKU renewal is below 75%.');
    assert.equal(renewalExplanation('PSKU Renewed + New Fabric'),
        'Both P-SKU and F-SKU renewal percentages are at least 75%.');
    assert.equal(renewalExplanation('Partial P-to-F'),
        'F-SKU renewal is at least 30% but below 75%, and P-SKU renewal is below 75%.');
    assert.equal(renewalExplanation('Pending Renewal'),
        'P-SKU renewal is below 75% and F-SKU renewal is below 30%.');
    assert.match(renewalExplanation('Not Renewed'), /does not guess a percentage threshold/);
    assert.match(renewalExplanation('New source status'), /does not provide an explanation/);
});
