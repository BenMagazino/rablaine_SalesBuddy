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

test('boolean and ordinary cell exports retain their original behavior', () => {
    const clean = helper('cleanCellText');
    assert.equal(clean({hasAttribute: key => key === 'data-export-bool',
        getAttribute: () => 'true'}), 'Yes');
    assert.equal(clean({hasAttribute: key => key === 'data-export-bool',
        getAttribute: () => 'false'}), '');
    assert.equal(clean({hasAttribute: () => false, cloneNode: () => ({
        textContent: '  $5,000   /mo  risk ', querySelectorAll: () => [],
    })}), '$5,000 /mo risk');
});

test('report tables exclude native popup containers', () => {
    const pageTable = {closest: () => null}, popupTable = {closest: selector => {
        assert.equal(selector, 'dialog, [popover]');
        return {};
    }};
    const get = helper('getTables', {TABLE_SELECTOR: '#alertsTable',
        document: {querySelectorAll: selector => {
            assert.equal(selector, '#alertsTable');
            return [pageTable, popupTable];
        }}});
    assert.deepEqual(Array.from(get()), [pageTable]);
});

function noticeFixture() {
    const timers = [], appended = [], removed = [];
    const body = {};
    const toast = {dataset: {}, style: {}, body, attributes: {},
        querySelector: () => body,
        setAttribute(name, value) { this.attributes[name] = value; },
        contains(target) { return target === this; },
        remove() { removed.push(this); },
    };
    const previous = {remove() { removed.push(this); }};
    const document = {
        activeElement: null,
        getElementById: id => id === 'exportToast' ? previous :
            {content: {firstElementChild: {cloneNode: () => toast}}},
        createElement: () => toast,
        body: {appendChild(node) { appended.push(node); }},
    };
    const show = helper('showExportToast', {document,
        setTimeout: callback => { timers.push(callback); }});
    return {show, document, toast, previous, appended, removed, timers};
}

test('native export feedback keeps messages literal and uses the shared dismiss control', () => {
    const fixture = noticeFixture();
    fixture.show('<Literal "export">', 'success');
    assert.equal(fixture.toast.body.textContent, '<Literal "export">');
    assert.equal(fixture.toast.innerHTML, undefined);
    assert.equal(fixture.toast.dataset.sbTone, 'success');
    assert.equal(fixture.toast.attributes.role, 'status');
    assert.deepEqual(fixture.appended, [fixture.toast]);
    assert.deepEqual(fixture.removed, [fixture.previous]);
    fixture.timers[0]();
    assert.equal(fixture.removed.at(-1), fixture.toast);
    assert.match(template, /data-sb-notice-dismiss aria-label="Dismiss export notification"/);
});

test('native warning/error feedback persists and success feedback never removes focused controls', () => {
    for (const type of ['danger', 'warning']) {
        const fixture = noticeFixture();
        fixture.show('Export needs attention', type);
        assert.equal(fixture.toast.attributes.role, 'alert');
        assert.equal(fixture.timers.length, 0);
    }
    const fixture = noticeFixture();
    fixture.show('Copied', 'success');
    fixture.document.activeElement = fixture.toast;
    fixture.timers[0]();
    assert.deepEqual(fixture.removed, [fixture.previous]);
});

test('report export defaults to native commands and feedback without a presentation flag', () => {
    assert.match(template, /class="sb-revenue-export" role="group"/);
    assert.match(template, /<template id="reportExportNoticeTemplate">/);
    assert.doesNotMatch(template, /report_export_native|NATIVE_EXPORT|btn-group|alert alert-/);
});
