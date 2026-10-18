const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {saveDashboard} = require('../../static/js/ui-dashboards.js');

function deleteUI({confirmed = true, success = true} = {}) {
    const requests = [];
    const confirmations = [];
    const destinations = [];
    const error = {hidden: true, focus() {}};
    const buttons = [21, 22].map(id => ({
        dataset: {dbDelete: String(id), dashboardName: 'Dashboard ' + id},
        disabled: false,
        addEventListener(name, handler) { this[name] = handler; },
    }));
    const root = {
        dataset: {},
        setAttribute() {},
        querySelector() { return null; },
        querySelectorAll(selector) {
            return selector === '[data-db-toggle]' ? [] : buttons;
        },
    };
    const document = {
        readyState: 'complete',
        querySelector() { return root; },
        getElementById(id) { return id === 'dashboardError' ? error : null; },
    };
    const window = {
        document,
        confirm(message) { confirmations.push(message); return confirmed; },
        location: {assign(url) { destinations.push(url); }},
        async fetch(url, options) {
            requests.push({url, options});
            return {ok: success, json: async () => ({
                success, error: success ? undefined : 'Delete failed',
            })};
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(
        __dirname, '../../static/js/ui-dashboards.js'), 'utf8'),
    {window, document, console: {error() {}}});
    return {buttons, requests, confirmations, destinations, error};
}

test('each dashboard row deletes only its own identity after named confirmation', async () => {
    const ui = deleteUI();
    ui.buttons[1].click();
    ui.buttons[1].click();
    await new Promise(setImmediate);
    assert.equal(ui.confirmations.length, 1);
    assert.match(ui.confirmations[0], /Delete "Dashboard 22"/);
    assert.match(ui.confirmations[0], /customer data will not be deleted/);
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.requests[0].url, '/api/reports/dashboards/22/delete');
    assert.equal(ui.requests[0].options.method, 'POST');
    assert.deepEqual(ui.destinations, ['/reports/dashboards']);
});

test('canceling dashboard deletion sends no write and stays on management', async () => {
    const ui = deleteUI({confirmed: false});
    ui.buttons[0].click();
    await new Promise(setImmediate);
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.destinations.length, 0);
});

test('failed dashboard deletion shows an error and re-enables row actions', async () => {
    const ui = deleteUI({success: false});
    ui.buttons[0].click();
    await new Promise(setImmediate);
    assert.equal(ui.error.hidden, false);
    assert.equal(ui.error.textContent, 'Delete failed');
    assert.equal(ui.destinations.length, 0);
    assert.ok(ui.buttons.every(button => !button.disabled));
});

test('dashboard writes send POST and preserve the exact instance payload', async () => {
    const result = await saveDashboard('/api/reports/dashboards/2/widgets', {
        key: 'connect_goals.u2c',
    }, async (url, request) => {
        assert.equal(url, '/api/reports/dashboards/2/widgets');
        assert.equal(request.method, 'POST');
        assert.deepEqual(JSON.parse(request.body), {key: 'connect_goals.u2c'});
        return {ok: true, json: async () => ({success: true, id: 2})};
    });
    assert.equal(result.id, 2);
});

test('failed responses and unacknowledged writes cannot look successful', async () => {
    for (const [ok, data] of [
        [false, {success: false, error: 'Save rejected'}],
        [true, {success: false, error: 'Save rejected'}],
        [false, {success: true}],
        [true, {}],
    ]) {
        await assert.rejects(saveDashboard('/save', {}, async () => ({
            ok, json: async () => data,
        })), /Save rejected|did not confirm/);
    }
});

test('network errors and malformed response bodies remain visible failures', async () => {
    await assert.rejects(saveDashboard('/save', {}, async () => {
        throw new Error('Disconnected');
    }), /Disconnected/);
    await assert.rejects(saveDashboard('/save', {}, async () => ({
        ok: true, json: async () => { throw new Error('Invalid JSON'); },
    })), /Invalid JSON/);
});
