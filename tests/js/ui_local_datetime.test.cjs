const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-local-datetime.js'), 'utf8');

test('initial and injected timestamps preserve all formats, naive UTC and explicit offsets', () => {
    const entries = [
        ['2026-10-02T18:30:00', 'datetime'], ['2026-10-02T18:30:00Z', 'short'],
        ['2026-10-02T11:30:00-07:00', 'time'], ['2026-10-02T20:30:00+02:00', 'datetime'],
        ['2026-10-02T18:30:00Z', 'date'],
    ].map(([utc, format]) => ({utc, format,
        getAttribute(name) { return name === 'data-utc' ? this.utc : this.format; }}));
    const label = {}, warnings = [];
    const document = {querySelectorAll: selector => selector === '.local-datetime' ? entries : [label]};
    const window = {};
    vm.runInNewContext(source, {window, document, Date,
        console: {warn: (...args) => warnings.push(args)}});
    const date = new Date('2026-10-02T18:30:00Z');
    assert.equal(entries[0].textContent, date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true}));
    assert.equal(entries[1].textContent, date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true}));
    assert.equal(entries[2].textContent, date.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true}));
    assert.equal(entries[3].textContent, entries[0].textContent);
    assert.equal(entries[4].textContent, date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    }));
    const original = entries.map(entry => entry.textContent);
    window.SBLocalDateTime.render(document);
    assert.deepEqual(entries.map(entry => entry.textContent), original);
    assert.match(label.textContent, /^\(.+\)$/);
    entries[0].utc = 'not-a-timestamp';
    window.SBLocalDateTime.render(document);
    assert.equal(entries[0].textContent, 'Unavailable');
    assert.equal(warnings.length, 1);
});
