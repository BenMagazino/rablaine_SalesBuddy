const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-synapse-mode.js'), 'utf8');

function fixture({query = '', mode = 'new', saved = null, readError = false,
    writeError = false, redirectError = false} = {}) {
    const notice = {hidden: true, textContent: ''}, warnings = [], writes = [];
    let ready, replacement;
    const document = {
        currentScript: {dataset: {mode}},
        addEventListener(name, callback) {
            assert.equal(name, 'DOMContentLoaded');
            ready = callback;
        },
        getElementById(id) { assert.equal(id, 'synapseModeNotice'); return notice; },
    };
    const location = {
        href: 'http://127.0.0.1:5000/reports/synapse-customers' + query,
        replace(url) {
            if (redirectError) throw new Error('navigation denied');
            replacement = url;
        },
    };
    const localStorage = {
        getItem(key) {
            assert.equal(key, 'synapseCustomersMode');
            if (readError) throw new Error('storage read denied');
            return saved;
        },
        setItem(key, value) {
            if (writeError) throw new Error('storage write denied');
            writes.push([key, value]);
        },
    };
    vm.runInNewContext(source, {document, location, localStorage, URL,
        console: {warn: (...args) => warnings.push(args)}});
    return {notice, warnings, writes, replacement, ready: () => ready()};
}

test('saved current mode redirects before paint and retains embed, query and fragment', () => {
    const h = fixture({saved: 'current', query: '?embed=1&context=literal#seller'});
    assert.equal(h.replacement,
        'http://127.0.0.1:5000/reports/synapse-customers?embed=1&context=literal&mode=current#seller');
    h.ready();
    assert.equal(h.writes.length, 0);
});

test('explicit mode always wins and records the server-normalized scope', () => {
    for (const mode of ['new', 'current']) {
        const h = fixture({mode, saved: mode === 'new' ? 'current' : 'new',
            query: '?mode=' + mode, readError: true});
        assert.equal(h.replacement, undefined);
        h.ready();
        assert.deepEqual(h.writes, [['synapseCustomersMode', mode]]);
        assert.equal(h.warnings.length, 0);
        assert.equal(h.notice.hidden, true);
    }
    const invalid = fixture({query: '?mode=invalid', saved: 'current'});
    invalid.ready();
    assert.deepEqual(invalid.writes, [['synapseCustomersMode', 'new']]);
});

test('absent or matching preferences do not redirect or flash a warning', () => {
    for (const saved of [null, 'new']) {
        const h = fixture({saved});
        h.ready();
        assert.equal(h.replacement, undefined);
        assert.equal(h.notice.hidden, true);
        assert.deepEqual(h.writes, [['synapseCustomersMode', 'new']]);
    }
});

test('unavailable storage is logged and surfaced without disabling mode navigation', () => {
    for (const errors of [{readError: true}, {writeError: true},
        {readError: true, writeError: true}]) {
        const h = fixture(errors);
        h.ready();
        assert.equal(h.replacement, undefined);
        assert.equal(h.notice.hidden, false);
        assert.match(h.notice.textContent, /still switch between New and Current/);
        assert.ok(h.warnings.length > 0);
    }
});

test('malformed saved scope is reported, never used as a redirect destination', () => {
    const h = fixture({saved: 'https://example.test/'});
    h.ready();
    assert.equal(h.replacement, undefined);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.warnings.length, 1);
    assert.deepEqual(h.writes, [['synapseCustomersMode', 'new']]);
});

test('failed preference redirect still renders explicit feedback on the usable report', () => {
    const h = fixture({saved: 'current', redirectError: true});
    h.ready();
    assert.equal(h.replacement, undefined);
    assert.equal(h.notice.hidden, false);
    assert.equal(h.warnings.length, 1);
});
