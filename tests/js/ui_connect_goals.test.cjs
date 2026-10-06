const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {missingRequiredBuckets, confirmBuckets, coverageFilter, validateReadingView} =
    require('../../static/js/ui-connect-goals.js');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-connect-goals.js'), 'utf8');
const confirmed = {success: true, fiscal_year: 'FY27', taxonomy_version: 3};
const scope = {area: ['Data'], myTeam: 'off', quarters: [
    'FY27 Q1', 'FY27 Q2', 'FY27 Q3', 'FY27 Q4',
    'FY28 Q1', 'FY28 Q2', 'FY28 Q3', 'FY28 Q4'],
status: ['On Track', 'At Risk', 'Blocked'], seller: '', urgency: '', commitment: '',
favoritesOnly: false};

test('annual scope requires both priority buckets and retains optional choices', () => {
    assert.deepEqual(missingRequiredBuckets([]), ['Databases', 'Fabric']);
    assert.deepEqual(missingRequiredBuckets(['Databases']), ['Fabric']);
    assert.deepEqual(missingRequiredBuckets(['Fabric']), ['Databases']);
    assert.deepEqual(missingRequiredBuckets(['Databases', 'Fabric', 'Infra']), []);
});

test('confirmation sends the original exact payload and accepts taxonomy zero', async () => {
    const selected = ['Databases', 'Fabric', 'Infra'];
    const result = await confirmBuckets(selected, async (url, request) => {
        assert.equal(url, '/api/revenue/compensated-buckets');
        assert.equal(request.method, 'POST');
        assert.deepEqual(JSON.parse(request.body),
            {buckets: selected, confirm_for_fiscal_year: true});
        return {ok: true, json: async () => ({...confirmed, taxonomy_version: 0})};
    });
    assert.equal(result.taxonomy_version, 0);
});

test('HTTP and unsuccessful response bodies cannot masquerade as a saved scope', async () => {
    for (const ok of [false, true]) {
        await assert.rejects(confirmBuckets([], async () => ({
            ok, json: async () => ({success: false, error: 'Scope rejected'}),
        })), /Scope rejected/);
    }
});

test('confirmation rejects missing fiscal year and invalid taxonomy metadata', async () => {
    for (const data of [
        {...confirmed, fiscal_year: null}, {...confirmed, fiscal_year: 'invalid'},
        {...confirmed, taxonomy_version: null}, {...confirmed, taxonomy_version: -1},
        {...confirmed, taxonomy_version: '3'}, {...confirmed, success: undefined},
    ]) {
        await assert.rejects(confirmBuckets([], async () => ({
            ok: true, json: async () => data,
        })), /server did not confirm/);
    }
});

test('network and malformed JSON failures remain explicit', async () => {
    await assert.rejects(confirmBuckets([], async () => {
        throw new Error('Disconnected');
    }), /Disconnected/);
    await assert.rejects(confirmBuckets([], async () => ({
        ok: true, json: async () => { throw new Error('Malformed response'); },
    })), /Malformed response/);
});

test('coverage drill-down preserves the complete off-team scope without mutating its source', () => {
    const result = coverageFilter(scope);
    assert.deepEqual(result, {...scope, allQuarters: scope.quarters});
    assert.notEqual(result.allQuarters, scope.quarters);
    assert.equal(scope.allQuarters, undefined);
});

function controller({selected = ['Databases', 'Fabric'], setup = false,
    storageFailure = false, reloadFailure = false, withReading = false,
    savedView, embedded = false, historyFailure = false, fetcher} = {}) {
    const events = [];
    const inputs = selected.map(value => ({value, disabled: false}));
    const submit = {disabled: false, textContent: 'Save Comp Buckets'};
    const controls = [...inputs, submit];
    const formHandlers = new Map();
    const dialogHandlers = new Map();
    const windowHandlers = new Map();
    const form = {
        querySelectorAll: selector => selector === 'input:checked' ? inputs : controls,
        querySelector: () => submit,
        addEventListener: (event, fn) => formHandlers.set(event, fn),
        setAttribute(key, value) { this[key] = value; },
    };
    const status = {textContent: '', classList: {toggle() {}}};
    const notice = {hidden: true};
    const dialog = {addEventListener: (event, fn) => dialogHandlers.set(event, fn)};
    const histories = [
        {dataset: {goalsHistoryKey: 'Fabric:12'}, open: false},
        {dataset: {goalsHistoryKey: 'Databases:13'}, open: false},
    ];
    const reading = {scrollTop: 0, querySelectorAll: () => histories};
    const nodes = {
        connectGoalsData: {textContent: JSON.stringify({teamFilter: scope, u2c: null})},
        connectNavigationStatus: notice,
        ...(withReading ? {connectGoalsReading: reading} : {}),
        ...(setup ? {connectSetupForm: form, connectSetupStatus: status} : {
            connectBucketModalForm: form, connectBucketModalStatus: status,
            connectBucketModal: dialog,
        }),
    };
    const document = {readyState: 'complete',
        querySelector: () => ({dataset: {embedded: String(embedded)}}),
        getElementById: id => nodes[id] || null};
    const window = {
        document,
        history: {
            state: {other: 'preserved',
                ...(savedView === undefined ? {} : {sbConnectGoals: savedView})},
            replaceState(state) {
                if (historyFailure) throw new Error('History unavailable');
                this.state = state;
                events.push({type: 'history'});
            },
        },
        addEventListener: (event, fn) => windowHandlers.set(event, fn),
        fetch: async (...args) => {
            events.push({type: 'fetch', payload: JSON.parse(args[1].body)});
            return fetcher ? fetcher(...args) : {ok: true, json: async () => confirmed};
        },
        location: {
            reload() {
                if (reloadFailure) throw new Error('Reload unavailable');
                events.push({type: 'reload'});
            },
            assign: url => events.push({type: 'navigate', url}),
        },
        localStorage: {setItem(key, value) {
            if (storageFailure) throw new Error('Storage unavailable');
            events.push({type: 'storage', key, value});
        }},
    };
    vm.runInNewContext(source, {window, document, console: {error() {}}});
    return {events, form, status, controls, submit, notice, window,
        reading, histories, windowHandlers,
        submitForm: () => formHandlers.get('submit')({preventDefault() {}}),
        close() {
            let prevented = false;
            dialogHandlers.get('sb:dialog-before-close')({
                preventDefault() { prevented = true; },
            });
            return prevented;
        }};
}

test('missing required selections never send a write', async () => {
    const page = controller({selected: ['Databases']});
    await page.submitForm();
    assert.match(page.status.textContent, /Select Fabric/);
    assert.deepEqual(page.events, []);
});

test('pending saves disable controls and block duplicate submission and native dismissal', async () => {
    let finish;
    const page = controller({fetcher: () => new Promise(resolve => { finish = resolve; })});
    const pending = page.submitForm();
    assert.ok(page.controls.every(control => control.disabled));
    assert.equal(page.form['aria-busy'], 'true');
    assert.equal(page.close(), true);
    await page.submitForm();
    assert.equal(page.events.length, 1);
    finish({ok: true, json: async () => confirmed});
    await pending;
    assert.ok(page.controls.every(control => !control.disabled));
    assert.equal(page.close(), false);
    assert.equal(page.events.at(-1).type, 'reload');
});

test('save failure keeps the dialog available for correction without reload or preference writes',
    async () => {
        const page = controller({fetcher: async () => ({
            ok: false, json: async () => ({error: 'Rejected'}),
        })});
        await page.submitForm();
        assert.match(page.status.textContent, /Could not confirm.*Rejected/);
        assert.deepEqual(page.events.map(event => event.type), ['fetch']);
        assert.ok(page.controls.every(control => !control.disabled));
    });

test('server-confirmed save with unavailable browser preferences offers reload, not another write',
    async () => {
        const page = controller({storageFailure: true});
        await page.submitForm();
        assert.match(page.status.textContent, /Buckets saved.*Local preferences/);
        assert.equal(page.submit.textContent, 'Reload report');
        assert.deepEqual(page.events.map(event => event.type), ['fetch']);
        await page.submitForm();
        assert.deepEqual(page.events.map(event => event.type), ['fetch', 'reload']);
    });

test('annual setup shares confirmed save and local preference behavior', async () => {
    const page = controller({setup: true});
    await page.submitForm();
    assert.deepEqual(page.events.map(event => event.type),
        ['fetch', 'storage', 'storage', 'reload']);
    assert.equal(page.events[2].value, '3');
});

test('failed reload does not misrepresent a confirmed server save as a write failure', async () => {
    const page = controller({reloadFailure: true});
    await page.submitForm();
    assert.match(page.status.textContent, /Buckets saved.*could not reload/);
    assert.equal(page.submit.textContent, 'Reload report');
    assert.equal(page.events.filter(event => event.type === 'fetch').length, 1);
});

test('coverage navigation saves exactly the existing tracker scope before following its link', () => {
    const page = controller();
    page.window.openMilestoneCoverage();
    assert.deepEqual(JSON.parse(page.events[0].value),
        {...scope, allQuarters: scope.quarters});
    assert.deepEqual(page.events[1], {type: 'navigate', url: '/reports/milestone-tracker'});
});

test('failed tracker preference writes show an error and do not navigate unscoped', () => {
    const page = controller({storageFailure: true});
    page.window.openMilestoneCoverage();
    assert.equal(page.notice.hidden, false);
    assert.match(page.notice.textContent, /Could not open.*Storage unavailable/);
    assert.deepEqual(page.events, []);
});

test('saved reading state accepts only valid offsets and identifiable history rows', () => {
    const valid = {scroll: 120, expanded: ['Fabric:12', 'Databases:13']};
    assert.equal(validateReadingView(valid), valid);
    for (const value of [
        null, {scroll: -1, expanded: []}, {scroll: Infinity, expanded: []},
        {scroll: '120', expanded: []}, {scroll: 0, expanded: null},
        {scroll: 0, expanded: ['Fabric:0']}, {scroll: 0, expanded: [12]},
    ]) {
        assert.throws(() => validateReadingView(value), /Invalid saved Connect Goals/);
    }
});

test('native reading pane restores offset and expanded histories on Back', () => {
    const page = controller({withReading: true,
        savedView: {scroll: 120, expanded: ['Fabric:12']}});
    assert.equal(page.reading.scrollTop, 120);
    assert.equal(page.histories[0].open, true);
    assert.equal(page.histories[1].open, false);
    page.reading.scrollTop = 320;
    page.histories[1].open = true;
    page.windowHandlers.get('pagehide')();
    assert.equal(page.window.history.state.other, 'preserved');
    assert.deepEqual(JSON.parse(JSON.stringify(page.window.history.state.sbConnectGoals)),
        {scroll: 320, expanded: ['Fabric:12', 'Databases:13']});
    page.reading.scrollTop = 0;
    page.histories.forEach(detail => { detail.open = false; });
    page.windowHandlers.get('pageshow')();
    assert.equal(page.reading.scrollTop, 320);
    assert.ok(page.histories.every(detail => detail.open));
});

test('embedded dashboard does not take over its hosts reading history', () => {
    const page = controller({withReading: true, embedded: true,
        savedView: {scroll: 120, expanded: ['Fabric:12']}});
    assert.equal(page.windowHandlers.size, 0);
    assert.equal(page.reading.scrollTop, 0);
});

test('invalid saved reading state reports an error without breaking report controls', () => {
    const page = controller({withReading: true, savedView: {scroll: -1, expanded: []}});
    assert.equal(page.notice.hidden, false);
    assert.match(page.notice.textContent, /Could not restore/);
    page.window.openMilestoneCoverage();
    assert.equal(page.events.at(-1).type, 'navigate');
});

test('blocked browser history writes report the failed Back persistence explicitly', () => {
    const page = controller({withReading: true, historyFailure: true});
    page.windowHandlers.get('pagehide')();
    assert.equal(page.notice.hidden, false);
    assert.match(page.notice.textContent, /Could not save.*for Back/);
});
