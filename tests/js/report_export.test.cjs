const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const template = fs.readFileSync(path.join(__dirname,
    '../../templates/partials/_report_export.html'), 'utf8');

async function copyFixture(native = true, failHtml = false) {
    const cell = label => ({
        hasAttribute: key => key === 'data-export-label',
        getAttribute: key => key === 'data-export-label' ? label : null,
        querySelector: () => null,
    });
    const row = (values, display = '') => ({style: {display}, offsetParent: {},
        querySelectorAll: () => values.map(cell), closest: () => null});
    const table = (heading, rows, dialog = false) => ({
        querySelector: () => null,
        closest: () => dialog ? {} : null,
        querySelectorAll: selector => selector === 'thead th' ?
            [cell(heading), cell('Reason / Notes')] : rows,
    });
    const tables = [
        table('Engagement', [row(['SQL Migration', 'Confirmed <reason>'])]),
        table('Milestone (Seller: Rick Bowles)', [
            row(['SQLMI migration', '']), row(['Filtered off-team', ''], 'none'),
        ]),
        table('Dialog choices', [row(['Not report data', ''])], true),
    ];
    const copied = [], fallback = [];
    const toast = {cloneNode() { return this; }, dataset: {}, setAttribute() {},
        querySelector: () => ({}), contains: () => false, remove() {}, style: {}};
    const script = template.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/const NATIVE_EXPORT = .*?;/, `const NATIVE_EXPORT = ${native};`)
        .replace(/const TABLE_SELECTOR = .*?;/, "const TABLE_SELECTOR = 'table';")
        .replace(/const FILENAME = .*?;/, "const FILENAME = 'hygiene';")
        .replace(/const CUSTOM_TITLE = .*?;/, "const CUSTOM_TITLE = 'Hygiene';");
    const window = {};
    vm.runInNewContext(script, {window, Blob,
        document: {querySelectorAll: () => tables, querySelector: () => null,
            getElementById: id => id === 'reportExportNoticeTemplate' ?
                {content: {firstElementChild: toast}} : null,
            createElement: () => ({...toast, textContent: '',
                get innerHTML() {
                    return this.html ?? this.textContent.replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
                },
                set innerHTML(value) { this.html = value; },
            }), body: {appendChild() {}}},
        navigator: {clipboard: {
            write: async items => { if (failHtml) throw new Error('Unsupported HTML'); copied.push(...items); },
            writeText: async text => fallback.push(text),
        }},
        ClipboardItem: class {constructor(types) { this.types = types; }},
        setTimeout() {}, requestAnimationFrame() {}});
    window.copyReportForEmail();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    return {copied, fallback};
}
test('native clipboard exports both queues in HTML and text with seller and confirmed-note context', async () => {
    const h = await copyFixture();
    const html = await h.copied[0].types['text/html'].text();
    const plain = await h.copied[0].types['text/plain'].text();
    for (const text of ['SQL Migration', 'SQLMI migration', 'Seller: Rick Bowles']) {
        assert.ok(html.includes(text)); assert.ok(plain.includes(text));
    }
    assert.ok(html.includes('Confirmed &lt;reason&gt;'));
    assert.ok(plain.includes('Confirmed <reason>'));
    assert.equal((html.match(/<table /g) || []).length, 2);
    for (const text of ['Filtered off-team', 'Not report data']) {
        assert.ok(!html.includes(text)); assert.ok(!plain.includes(text));
    }
});
test('native plaintext clipboard fallback retains every filtered export table', async () => {
    const h = await copyFixture(true, true);
    assert.equal(h.fallback.length, 1);
    assert.ok(h.fallback[0].includes('SQL Migration'));
    assert.ok(h.fallback[0].includes('SQLMI migration'));
    assert.ok(!h.fallback[0].includes('Filtered off-team'));
});
test('legacy consumers keep the previous first-table plaintext contract', async () => {
    const h = await copyFixture(false);
    const html = await h.copied[0].types['text/html'].text();
    const plain = await h.copied[0].types['text/plain'].text();
    assert.ok(html.includes('SQLMI migration'));
    assert.ok(plain.includes('SQL Migration'));
    assert.ok(!plain.includes('SQLMI migration'));
});
