const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(template, start, end, extra = {}) {
    const source = fs.readFileSync(template, 'utf8');
    const offset = source.indexOf(start);
    assert.notEqual(offset, -1);
    const script = source.slice(offset, source.indexOf(end, offset))
        .replace('{{ url_for("reports.api_u2c_import_official") }}', '/api/reports/u2c/import-official')
        .replace('{{ url_for("reports.report_u2c") }}', '/reports/u2c')
        .replace(/'\{\{[^\n]+?\}\}'/g, "'false'");
    const fields = new Map();
    const field = id => {
        if (!fields.has(id)) fields.set(id, {
            style: {}, hidden: true, disabled: false, textContent: '', innerHTML: '',
            dataset: {}, handlers: {},
            classList: {add() {}, remove() {}, toggle() {}},
            parentElement: {setAttribute() {}},
            addEventListener(name, handler) { this.handlers[name] = handler; },
            setAttribute(name, value) { this[name] = value; },
            querySelector() { return field(id + 'Label'); },
        });
        return fields.get(id);
    };
    const requests = [], errors = [], ready = [], syncs = new Map();
    const context = {
        document: {getElementById: field, querySelectorAll: () => [field('importOfficialBtn')],
            querySelector: selector => selector},
        window: {SBJobs: {message: job => job.progress.message}, confirm: () => true,
            location: {reload() { ready.push('reload'); }},
            SBSyncProgress: {create(root, handlers) {
                syncs.set(root, handlers);
                return {start: async options => { requests.push({root, options}); }};
            }}},
        location: {href: 'http://localhost/reports/u2c?embed=1'},
        URL, console,
        el: field,
        fetch: (url, options) => new Promise((resolve, reject) => {
            requests.push({url, options, resolve, reject});
        }),
        requestJson: (url, options) => new Promise((resolve, reject) => {
            requests.push({url, options, resolve, reject});
        }),
        SBU2c: {reportError: message => errors.push(message)},
        showMeetingImportModalWithError: message => errors.push(message),
        showMeetingImportModalReady: (...args) => ready.push(args),
        _findBestMeetingMatch: () => null,
        ...extra,
    };
    vm.createContext(context);
    vm.runInContext(script, context);
    return {context, field, requests, errors, ready, syncs};
}

async function settle() {
    for (let i = 0; i < 16; i++) await Promise.resolve();
}

function meetingFixture() {
    const h = fixture('templates/note_form.html',
        'function refreshMeetings()', 'function showMeetingImportModalReady');
    h.field('call_date').value = '2026-10-14';
    return h;
}

test('note refresh keeps queued progress visible and suppresses repeated admission', async () => {
    const h = meetingFixture();
    h.context.refreshMeetings();
    h.context.refreshMeetings();
    assert.equal(h.requests.length, 1);
    assert.equal(h.field('refreshMeetingsBtn').disabled, true);
    const request = h.requests[0];
    assert.equal(request.url, '/api/meetings/refresh');
    assert.deepEqual(JSON.parse(request.options.body), {date: '2026-10-14'});
    request.options.onJobProgress({progress: {message: 'Waiting for calendar worker.'}});
    assert.equal(h.field('meetingRefreshProgress').textContent, 'Waiting for calendar worker.');
    assert.equal(h.ready.length, 0);
    request.resolve({ok: true, json: async () => ({
        meetings: [], date: '2026-10-14', synced_at: '2026-10-14T12:00:00Z',
    })});
    await settle();
    assert.equal(h.field('refreshMeetingsBtn').disabled, false);
    assert.equal(h.ready.length, 1);
    assert.equal(h.errors.length, 0);
});

test('note refresh never treats failed or admission-only responses as an empty calendar', async () => {
    for (const [ok, data] of [
        [false, {error: 'Source failed.'}],
        [true, {accepted: true, job_id: 12}],
        [true, {}],
        [true, {meetings: [], date: '2026-10-13', synced_at: '2026-10-14T12:00:00Z'}],
        [true, {meetings: [], date: '2026-10-14', synced_at: 'bad'}],
    ]) {
        const h = meetingFixture();
        h.context.refreshMeetings();
        h.requests[0].resolve({ok, json: async () => data});
        await settle();
        assert.equal(h.errors.length, 1);
        assert.equal(h.ready.length, 0);
        assert.equal(h.field('refreshMeetingsBtn').disabled, false);
    }
});

function u2cFixture() {
    return fixture('templates/report_u2c.html',
        'const u2cSync =', '</script>');
}

test('U2C uses shared admission and navigates only after a confirmed terminal quarter', async () => {
    const h = u2cFixture();
    assert.equal(h.requests.length, 0);
    await h.context.importOfficialSnapshot();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].root, '[data-sb-sync-progress="u2c"]');
    assert.equal(h.context.location.href, 'http://localhost/reports/u2c?embed=1');
    h.syncs.values().next().value.onComplete({result: {fiscal_quarter: 'FY27 Q2'}});
    const target = new URL(h.context.location.href);
    assert.equal(target.pathname, '/reports/u2c');
    assert.equal(target.searchParams.get('fq'), 'FY27 Q2');
    assert.equal(target.searchParams.get('embed'), '1');
});

test('U2C cannot navigate on admission-only or malformed completion results', async () => {
    for (const data of [
        {success: false, error: 'Official source unavailable.'},
        {success: true, accepted: true, job_id: 8},
    ]) {
        const h = u2cFixture();
        assert.throws(() => h.syncs.values().next().value.onComplete({result: data}),
            /Could not confirm/);
        assert.equal(h.context.location.href, 'http://localhost/reports/u2c?embed=1');
    }
});

function coverageFixture() {
    return fixture('templates/report_activity_coverage.html',
        '    var matchButton = document.getElementById', "    window.addEventListener('pageshow'");
}

for (const [button, operation, label] of [
    ['matchMilestonesButton', 'meeting-preparation', 'Match Milestones'],
    ['populationButton', 'calendar-population', 'Import Calendar'],
]) {
    test(button + ' uses the common observer and reloads only after terminal completion', async () => {
        const h = coverageFixture();
        assert.equal(h.requests.length, 0);
        h.field(button).handlers.click();
        const key = '[data-sb-sync-progress="' + operation + '"]';
        assert.equal(h.requests[0].root, key);
        const handlers = h.syncs.get(key);
        handlers.onChange({status: 'running'});
        assert.equal(h.field(button + 'Label').textContent, 'Syncing...');
        handlers.onChange({status: 'failed'});
        assert.equal(h.field(button + 'Label').textContent, label);
        assert.equal(h.ready.length, 0);
        handlers.onComplete();
        await settle();
        assert.deepEqual(h.ready, ['reload']);
    });
}

test('rerunning matching retains its destructive confirmation and force option', async () => {
    const h = coverageFixture();
    h.field('matchMilestonesButton').dataset.rerun = 'true';
    h.context.window.confirm = () => false;
    h.field('matchMilestonesButton').handlers.click();
    assert.equal(h.requests.length, 0);
    h.context.window.confirm = () => true;
    h.field('matchMilestonesButton').handlers.click();
    assert.equal(h.requests[0].options.force, true);
});

for (const lens of ['milestones', 'caip']) {
    test(lens + ' reconciliation waits for the shared assets before initializing', () => {
        const template = fs.readFileSync(
            'templates/partials/activity_coverage_' + lens + '.html', 'utf8');
        const script = template.match(/<script>([\s\S]*?)<\/script>/)[1]
            .replace(/\{\{.*?\}\}/g, 'null');
        const events = [];
        vm.runInNewContext(script, {
            document: {addEventListener: (event, handler) => events.push({event, handler})},
        });
        assert.equal(events.length, 1);
        assert.equal(events[0].event, 'DOMContentLoaded');
        assert.equal(typeof events[0].handler, 'function');
    });
}
