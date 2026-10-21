const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {formatDate, dateValue, money, filterRows, renewalStyle, renewalExplanation} =
    require('../../static/js/ui-ptof.js');

function statusHarness(statuses) {
    class Element {
        constructor() {
            this.dataset = {};
            this.children = [];
            this.attrs = {};
            this.events = {};
            this.style = {};
        }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        setAttribute(key, value) { this.attrs[key] = value; }
        addEventListener(type, listener) { this.events[type] = listener; }
        getBoundingClientRect() { return {left: 20, top: 40, bottom: 60, width: 200, height: 80}; }
        showPopover() { this.open = true; }
        hidePopover() { this.open = false; }
        matches(selector) { return selector === ':popover-open' && this.open === true; }
    }
    const cells = statuses.map(status => {
        const cell = new Element();
        cell.dataset.ptofRenewalStatus = status;
        cell.dataset.sbSortValue = status;
        cell.textContent = status || 'Not supplied';
        return cell;
    });
    const document = {
        createElement: () => new Element(),
        querySelectorAll: selector => selector === '[data-ptof-renewal-status]' ? cells : [],
    };
    const window = {};
    const source = fs.readFileSync(path.resolve(__dirname, '../../static/js/ui-ptof.js'), 'utf8');
    vm.runInNewContext(source, {document, window, innerWidth: 1000, innerHeight: 800});
    return {cells, document, mount: window.SBPToF.mountStatuses};
}

test('widget statuses reuse report indicators, descriptions and raw sort values', () => {
    const values = ['Pending Renewal; P-to-F Renewed', 'Not Renewed', 'New status', ''];
    const h = statusHarness(values);
    const ids = new Set();
    for (const [index, cell] of h.cells.entries()) {
        assert.equal(cell.dataset.sbSortValue, values[index]);
        assert.equal(cell.children.length, values[index] ? values[index].split('; ').length : 0);
        for (const [part, indicator] of cell.children.entries()) {
            const status = values[index].split('; ')[part];
            const [icon, label, help] = indicator.children;
            assert.equal(label.textContent, status);
            assert.equal(indicator.className, 'sb-ptof-status is-' + renewalStyle(status).tone);
            assert.equal(icon.className, 'bi ' + renewalStyle(status).icon);
            assert.equal(indicator.tabIndex, 0);
            assert.equal(indicator.attrs['aria-describedby'], help.id);
            assert.equal(help.attrs.role, 'tooltip');
            assert.ok(help.textContent.startsWith(renewalExplanation(status)));
            assert.match(help.textContent, /not capacity utilization/);
            ids.add(help.id);
        }
    }
    assert.equal(ids.size, 4);
    const first = h.cells[0].children[0];
    h.mount(h.document);
    assert.equal(h.cells[0].children[0], first);
    assert.equal(h.cells[3].textContent, 'Not supplied');
});

test('shared renewal descriptions open on hover or focus and dismiss on leave, blur or Escape', () => {
    const h = statusHarness(['Pending Renewal']);
    const indicator = h.cells[0].children[0];
    const help = indicator.children[2];
    indicator.events.mouseenter();
    assert.equal(help.open, true);
    assert.equal(indicator.attrs['aria-expanded'], 'true');
    assert.equal(indicator.attrs['data-sb-dialog-escape-owner'], '');
    indicator.events.mouseleave();
    assert.equal(help.open, false);
    indicator.events.focus();
    assert.equal(help.open, true);
    let prevented = false, stopped = false;
    indicator.events.keydown({key: 'Escape',
        preventDefault() { prevented = true; },
        stopPropagation() { stopped = true; },
    });
    assert.equal(help.open, false);
    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.equal(indicator.attrs['aria-expanded'], 'false');
    indicator.events.keydown({key: 'Escape'});
    indicator.events.focus();
    indicator.events.blur();
    assert.equal(help.open, false);
});

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
