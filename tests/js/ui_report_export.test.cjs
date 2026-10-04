const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const template = fs.readFileSync(
    path.join(__dirname, '../../templates/partials/_report_export.html'), 'utf8');

function helper(name, context = {}) {
    const match = template.match(new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`));
    assert.ok(match, 'Export helper must exist');
    const sandbox = {...context};
    vm.runInNewContext(match[0] + `\nglobalThis.invoke = ${name};`, sandbox);
    return sandbox.invoke;
}

test('native sort headers export their literal labels instead of losing button text', () => {
    const clean = helper('cleanCellText');
    const cell = label => ({
        hasAttribute: name => name === 'data-export-label',
        getAttribute: () => label,
        cloneNode() { throw Error('Explicit labels do not need button stripping'); },
    });
    assert.equal(clean(cell('Avg ACR')), 'Avg ACR');
    assert.equal(clean(cell('<Literal "label">')), '<Literal "label">');
});

test('legacy boolean and ordinary cell exports retain their original behavior', () => {
    const clean = helper('cleanCellText');
    assert.equal(clean({hasAttribute: key => key === 'data-export-bool',
        getAttribute: () => 'true'}), 'Yes');
    assert.equal(clean({hasAttribute: key => key === 'data-export-bool',
        getAttribute: () => 'false'}), '');
    assert.equal(clean({hasAttribute: () => false, cloneNode: () => ({
        textContent: '  $5,000   /mo  risk ', querySelectorAll: () => [],
    })}), '$5,000 /mo risk');
});

test('report tables exclude both legacy and native popup containers', () => {
    const pageTable = {closest: () => null}, popupTable = {closest: selector => {
        assert.equal(selector, '.modal, .popover, dialog, [popover]');
        return {};
    }};
    const get = helper('getTables', {TABLE_SELECTOR: '#alertsTable',
        document: {querySelectorAll: selector => {
            assert.equal(selector, '#alertsTable');
            return [pageTable, popupTable];
        }}});
    assert.deepEqual(Array.from(get()), [pageTable]);
});
