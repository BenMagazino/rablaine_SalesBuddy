const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {validDate, initialDate, validateView} = require('../../static/js/ui-impact.js');
const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-impact.js'), 'utf8');

test('calendar dates reject impossible days and handle Gregorian leap years', () => {
    for (const date of ['2026-05-01', '2024-02-29', '2000-02-29', '0001-01-01',
        '9999-12-31']) assert.equal(validDate(date), true, date);
    for (const date of ['', null, 20260501, '2026-5-01', '2026-02-29', '1900-02-29',
        '2026-04-31', '0000-01-01', '2026-13-01', '2026-00-01', '2026-01-00',
        '2026-05-01T00:00:00Z']) assert.equal(validDate(date), false, String(date));
});

test('explicit scope uses effective server date and saved dates apply only on first entry', () => {
    assert.equal(initialDate(false, '2026-05-01', '2026-01-01'), '2026-01-01');
    assert.equal(initialDate(true, '2026-05-01', '2026-01-01'), '2026-05-01');
    assert.equal(initialDate(false, '2026-05-01', '2026-02-31'), '2026-05-01');
    assert.throws(() => initialDate(false, 'bad', null), /Invalid report start date/);
});

test('Back state belongs to its date scope and retains independent reading offsets', () => {
    const saved = {since: '2026-05-01', selected: '12', listScroll: 100, detailScroll: 300};
    assert.equal(validateView(saved, saved.since), saved);
    assert.equal(validateView(saved, '2026-06-01'), null);
    assert.equal(validateView({...saved, selected: null}, saved.since).selected, null);
    for (const value of [null, [], {...saved, selected: 12}, {...saved, selected: '0'},
        {...saved, since: 'bad'}, {...saved, listScroll: -1},
        {...saved, detailScroll: Infinity}, {...saved, listScroll: '300'}]) {
        assert.throws(() => validateView(value, saved.since), /Invalid saved Connect Impact view/);
    }
});

function controller({query = '', saved = null, embedded = false, storageFailure = false,
    navigationFailure = false} = {}) {
    const events = [];
    const handlers = new Map();
    const inputHandlers = new Map();
    const presetHandlers = new Map();
    const input = {value: '2026-05-01', focus() { this.focused = true; },
        addEventListener: (key, fn) => inputHandlers.set(key, fn)};
    const preset = {value: '', options: [{value: ''}, {value: '2026-07-01'},
        {value: '2026-10-01'}, {value: '2027-01-01'}, {value: '2027-04-01'}],
        addEventListener: (key, fn) => presetHandlers.set(key, fn)};
    const notice = {hidden: true, textContent: ''};
    const root = {
        dataset: {since: '2026-05-01', embedded: String(embedded)},
        querySelector: selector => selector === '#impactSinceDate' ? input :
            selector === '#impactDatePreset' ? preset :
            selector === '.sb-impact-notice' ? notice : null,
        querySelectorAll: () => [],
        addEventListener() {},
    };
    const location = {
        href: 'http://127.0.0.1:5000/reports/connect-impact' + query,
        replace(url) {
            if (navigationFailure) throw new Error('Navigation unavailable');
            events.push({type: 'replace', url});
        },
        assign(url) {
            if (navigationFailure) throw new Error('Navigation unavailable');
            events.push({type: 'assign', url, input: input.value});
        },
    };
    const history = {
        state: {keep: 'existing'},
        replaceState(state, unused, url) {
            this.state = state;
            if (url) location.href = url;
            events.push({type: 'history', url});
        },
    };
    const storage = {
        value: saved,
        getItem() { if (storageFailure) throw new Error('Unavailable'); return this.value; },
        setItem(key, value) {
            if (storageFailure) throw new Error('Unavailable');
            this.value = value; events.push({type: 'storage', value});
        },
    };
    const window = {document: true, location, history, localStorage: storage,
        addEventListener: (key, fn) => handlers.set(key, fn)};
    const document = {readyState: 'complete', querySelector: selector =>
        selector === '[data-sb-impact]' ? root : null, addEventListener() {}};
    vm.runInNewContext(source, {window, document, URL, console: {error() {}}});
    return {events, input, preset, notice, history, location, storage, handlers,
        choose(value) { preset.value = value; presetHandlers.get('change')(); },
        change(value) { input.value = value; inputHandlers.get('change')(); }};
}

test('saved initial preference replaces rather than pushes a navigation entry', () => {
    const page = controller({saved: '2026-01-01'});
    assert.deepEqual(page.events, [{type: 'replace',
        url: 'http://127.0.0.1:5000/reports/connect-impact?since=2026-01-01'}]);
});

test('effective scope is pinned before navigation and pending date never survives Back', () => {
    const page = controller();
    assert.ok(page.location.href.endsWith('?since=2026-05-01'));
    page.change('2026-06-01');
    assert.equal(page.storage.value, '2026-06-01');
    assert.equal(page.history.state.sbImpact.since, '2026-05-01');
    assert.equal(page.history.state.keep, 'existing');
    assert.deepEqual(page.events.at(-1), {type: 'assign',
        url: 'http://127.0.0.1:5000/reports/connect-impact?since=2026-06-01',
        input: '2026-05-01'});
    page.input.value = '2026-06-01';
    page.handlers.get('pageshow')();
    assert.equal(page.input.value, '2026-05-01');
});

test('invalid URL and empty date input cannot persist a misleading scope', () => {
    const page = controller({query: '?since=2026-02-31', saved: '2026-01-01'});
    assert.equal(page.storage.value, '2026-05-01');
    assert.ok(page.location.href.endsWith('?since=2026-05-01'));
    assert.match(page.notice.textContent, /Invalid start date/);
    page.change('');
    assert.equal(page.input.value, '2026-05-01');
    assert.match(page.notice.textContent, /Choose a valid start date/);
    assert.equal(page.events.some(event => event.type === 'assign'), false);
});

test('blocked storage reports a failure but explicit date navigation still works', () => {
    const page = controller({storageFailure: true});
    assert.equal(page.notice.hidden, false);
    page.change('2026-06-01');
    assert.match(page.notice.textContent, /Applying it for this visit only/);
    assert.equal(page.events.at(-1).type, 'assign');
});

test('failed date navigation retains the rendered scope and offers an explicit retry', () => {
    const page = controller({saved: '2026-01-01', navigationFailure: true});
    assert.match(page.notice.textContent, /Could not open the saved date/);
    page.change('2026-06-01');
    assert.match(page.notice.textContent, /Select it again to retry/);
    assert.equal(page.input.value, '2026-05-01');
    assert.equal(page.history.state.sbImpact.since, '2026-05-01');
    assert.equal(page.events.some(event => event.type === 'assign'), false);
});

test('embedded date changes retain embed context without reading or changing preferences', () => {
    const page = controller({query: '?embed=1', saved: '2026-01-01', embedded: true});
    assert.equal(page.events.length, 0);
    page.change('2026-06-01');
    assert.equal(page.storage.value, '2026-01-01');
    assert.ok(page.events.at(-1).url.endsWith('?embed=1&since=2026-06-01'));
    assert.equal(page.history.state.sbImpact, undefined);
});

test('fiscal shortcuts reuse date navigation and cannot leave pending controls on Back', () => {
    for (const since of ['2026-07-01', '2026-10-01', '2027-01-01', '2027-04-01']) {
        const page = controller();
        page.choose(since);
        assert.equal(page.storage.value, since);
        assert.ok(page.events.at(-1).url.endsWith('?since=' + since));
        assert.equal(page.input.value, '2026-05-01');
        assert.equal(page.preset.value, '');
        assert.equal(page.history.state.sbImpact.since, '2026-05-01');
        page.preset.value = since;
        page.handlers.get('pageshow')();
        assert.equal(page.preset.value, '');
    }
});

test('Custom date focuses the picker without changing scope or preferences', () => {
    const page = controller();
    const before = page.events.length;
    page.choose('');
    assert.equal(page.input.focused, true);
    assert.equal(page.events.length, before);
    assert.equal(page.storage.value, '2026-05-01');
});

test('embedded shortcuts keep their URL context and never write the saved date', () => {
    const page = controller({query: '?embed=1', embedded: true, saved: '2026-01-01'});
    page.choose('2026-10-01');
    assert.ok(page.events.at(-1).url.endsWith('?embed=1&since=2026-10-01'));
    assert.equal(page.storage.value, '2026-01-01');
});
