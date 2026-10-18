const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const {readRequirement, refreshSavedWidgets} =
    require('../../static/js/ui-dashboard-requirements.js');

const response = data => ({ok: true, json: async () => ({success: true, ...data})});
const ready = {
    ready: true, available_buckets: ['Fabric'], selected_buckets: ['Fabric'],
    fiscal_year: 'FY27', configured_fiscal_year: 'FY27', reasons: [],
};

test('requirement reads reject unconfirmed, malformed, and failed responses explicitly', async () => {
    const data = {setup: {...ready, ready: false}, html: '<input>'};
    assert.deepEqual(await readRequirement('compensation_buckets', async url => {
        assert.equal(url, '/api/reports/dashboards/requirements/compensation_buckets');
        return response(data);
    }), {success: true, ...data});
    for (const result of [
        response({setup: ready}), response({html: '', setup: {}}),
        {ok: false, json: async () => ({error: 'Setup unavailable'})},
    ]) {
        await assert.rejects(readRequirement('compensation_buckets', async () => result));
    }
});

function tile(id, key = 'compensation_buckets') {
    const element = {
        dataset: {widgetId: String(id), widgetKey: 'connect_goals.u2c',
            columnSpan: '6', variant: 'detailed'},
        querySelectorAll() { return key ? [{dataset: {widgetRequirement: key}}] : []; },
        querySelector() { return {remove() { element.removed = true; }}; },
        insertAdjacentHTML(position, html) { element.html = html; key = null; },
    };
    return element;
}

test('saved views refresh all matching blocked widgets without touching unrelated content', async () => {
    const tiles = [tile(1), tile(2), tile(3, 'different'), tile(4, null)];
    const requests = [];
    const initialized = [];
    await refreshSavedWidgets({querySelectorAll: () => tiles}, 'compensation_buckets',
        async url => { requests.push(url); return response({html: '<div>Live scope</div>'}); },
        {destroy() {}, init(element) { initialized.push(element); }});
    assert.equal(requests.length, 2);
    assert.match(requests[0], /instance_id=1/);
    assert.match(requests[1], /instance_id=2/);
    assert.deepEqual(initialized, tiles.slice(0, 2));
    assert.equal(tiles[2].removed, undefined);
    assert.equal(tiles[3].removed, undefined);
});

test('partial refresh failures wait for all requests and remain retryable', async () => {
    const tiles = [tile(1), tile(2)];
    const root = {querySelectorAll: () => tiles};
    const goals = {destroy() {}, init() {}};
    await assert.rejects(refreshSavedWidgets(root, 'compensation_buckets', async url => {
        if (url.includes('instance_id=1')) throw new Error('Network error');
        return response({html: 'Ready'});
    }, goals), /Network error/);
    assert.equal(tiles[0].removed, undefined);
    assert.equal(tiles[1].removed, true);
    const retried = [];
    await refreshSavedWidgets(root, 'compensation_buckets', async url => {
        retried.push(url);
        return response({html: 'Ready'});
    }, goals);
    assert.equal(retried.length, 1);
    assert.match(retried[0], /instance_id=1/);
});

function setupUI() {
    const node = () => ({
        hidden: false, disabled: false, textContent: '', attributes: {},
        classList: {toggle() {}},
        addEventListener(name, callback) { this[name] = callback; },
        setAttribute(name, value) { this.attributes[name] = value; },
        replaceChildren() {},
    });
    const nodes = Object.fromEntries([
        'dashboardRequirementDialog', 'dashboardRequirementForm', 'dashboardRequirementChoices',
        'dashboardRequirementStatus', 'confirmDashboardRequirement',
    ].map(id => [id, node()]));
    const input = {checked: true, value: 'Fabric', disabled: false};
    nodes.dashboardRequirementChoices.querySelectorAll = selector =>
        selector === 'input:checked' && !input.checked ? [] : [input];
    const document = {
        readyState: 'complete', getElementById: id => nodes[id],
        addEventListener(name, callback) { this[name] = callback; },
    };
    const events = [];
    const records = new Map();
    const window = {
        document, fetch: async () => response({setup: ready, html: '<input>'}),
        localStorage: {setItem(key, value) { records.set(key, value); }},
        SBDialog: {
            open(dialog) { dialog.open = true; },
            close(dialog) { dialog.open = false; },
        },
        SBConnectGoals: {async confirmBuckets(selected) {
            events.push(['save', selected]); return {taxonomy_version: 2};
        }},
        SBDashboardEditor: {async refreshRequirement(key) { events.push(['refresh', key]); }},
        dispatchEvent(event) { events.push(['event', event.detail.key]); },
    };
    vm.runInNewContext(fs.readFileSync(
        require.resolve('../../static/js/ui-dashboard-requirements.js'), 'utf8'),
    {window, document, console: {error() {}}, URLSearchParams,
        CustomEvent: class { constructor(type, options) { Object.assign(this, options); } }});
    return {nodes, input, window, events, records,
        async open() {
            document.click({target: {closest: () => ({
                dataset: {widgetRequirement: 'compensation_buckets'},
            })}});
            await new Promise(setImmediate);
        },
        submit: () => nodes.dashboardRequirementForm.submit({preventDefault() {}}),
    };
}

test('one server-confirmed selection refreshes the shared requirement without reloading', async () => {
    const ui = setupUI();
    await ui.open();
    await ui.submit();
    assert.deepEqual(JSON.parse(JSON.stringify(ui.events)), [
        ['save', ['Fabric']], ['refresh', 'compensation_buckets'],
        ['event', 'compensation_buckets'],
    ]);
    assert.equal(ui.records.get('salesbuddy_revenue_bucket_filter'), '["Fabric"]');
    assert.equal(ui.nodes.dashboardRequirementDialog.open, false);
});

test('empty selection and rejected saves never refresh widgets', async () => {
    const ui = setupUI();
    await ui.open();
    ui.input.checked = false;
    await ui.submit();
    assert.equal(ui.events.length, 0);
    assert.match(ui.nodes.dashboardRequirementStatus.textContent, /at least one/);
    ui.input.checked = true;
    ui.window.SBConnectGoals.confirmBuckets = async () => { throw new Error('Offline'); };
    await ui.submit();
    assert.equal(ui.events.length, 0);
    assert.match(ui.nodes.dashboardRequirementStatus.textContent, /Offline/);
    assert.equal(ui.nodes.dashboardRequirementDialog.open, true);
    assert.equal(ui.input.disabled, false);
});

test('failed refresh retries without saving preferences again or closing during a request', async () => {
    const ui = setupUI();
    await ui.open();
    let finish;
    ui.window.SBDashboardEditor.refreshRequirement = () => new Promise((resolve, reject) => {
        finish = reject;
    });
    const pending = ui.submit();
    await new Promise(setImmediate);
    let prevented = false;
    ui.nodes.dashboardRequirementDialog['sb:dialog-before-close']({
        preventDefault() { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.equal(ui.nodes.confirmDashboardRequirement.disabled, true);
    finish(new Error('Widget offline'));
    await pending;
    assert.equal(ui.nodes.confirmDashboardRequirement.textContent, 'Retry refresh');
    assert.equal(ui.input.disabled, true);
    assert.match(ui.nodes.dashboardRequirementStatus.textContent, /Buckets saved/);
    ui.window.SBDashboardEditor.refreshRequirement = async () => {};
    await ui.submit();
    assert.equal(ui.events.filter(event => event[0] === 'save').length, 1);
    assert.equal(ui.nodes.dashboardRequirementDialog.open, false);
});

test('browser-storage failure is visible but does not block server-backed widget refresh', async () => {
    const ui = setupUI();
    await ui.open();
    ui.window.localStorage.setItem = () => { throw new Error('Storage blocked'); };
    await ui.submit();
    assert.ok(ui.events.some(event => event[0] === 'refresh'));
    assert.match(ui.nodes.dashboardRequirementStatus.textContent, /could not be updated/);
    assert.equal(ui.nodes.dashboardRequirementDialog.open, true);
    assert.equal(ui.nodes.confirmDashboardRequirement.textContent, 'Done');
    await ui.submit();
    assert.equal(ui.nodes.dashboardRequirementDialog.open, false);
});
