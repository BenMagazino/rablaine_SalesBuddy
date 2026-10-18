const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {saveDashboard} = require('../../static/js/ui-dashboards.js');

function deleteUI({confirmed = true, success = true, externalToolbar = false} = {}) {
    const requests = [], confirmations = [], destinations = [], removedDrafts = [];
    const error = {hidden: true, focus() {}};
    const buttons = [21, 22].map(id => ({
        dataset: {dbDelete: String(id), dashboardName: 'Dashboard ' + id},
        disabled: false,
        addEventListener(name, handler) { this[name] = handler; },
    }));
    const root = {
        dataset: {}, setAttribute() {}, querySelector() { return null; },
        querySelectorAll(selector) {
            if (externalToolbar) return [];
            return selector === '[data-db-delete]' || selector === 'button, input, select'
                ? buttons : [];
        },
    };
    const toolbar = {querySelectorAll(selector) {
        return selector === '[data-db-delete]' || selector === 'button, input, select'
            ? buttons : [];
    }};
    const document = {
        readyState: 'complete',
        querySelector() { return root; },
        getElementById(id) {
            if (id === 'layoutEditor' && externalToolbar) return toolbar;
            return id === 'dashboardError' ? error : null;
        },
    };
    const window = {
        document,
        SBDashboardDrafts: {remove(id) { removedDrafts.push(id); }},
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
    return {buttons, requests, confirmations, destinations, error, removedDrafts};
}

test('dashboard deletion removes only its own local draft after confirmed server success', async () => {
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
    assert.deepEqual(ui.removedDrafts, ['22']);
    assert.deepEqual(ui.destinations, ['/reports/dashboards']);
});

test('canceling deletion keeps the dashboard and local draft', async () => {
    const ui = deleteUI({confirmed: false});
    ui.buttons[0].click();
    await new Promise(setImmediate);
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.destinations.length, 0);
    assert.deepEqual(ui.removedDrafts, []);
});

test('failed dashboard deletion keeps drafts and re-enables row actions', async () => {
    const ui = deleteUI({success: false});
    ui.buttons[0].click();
    await new Promise(setImmediate);
    assert.equal(ui.error.hidden, false);
    assert.equal(ui.error.textContent, 'Delete failed');
    assert.equal(ui.destinations.length, 0);
    assert.deepEqual(ui.removedDrafts, []);
    assert.ok(ui.buttons.every(button => !button.disabled));
});

test('the full-width editor toolbar can delete the bounded dashboard', async () => {
    const ui = deleteUI({externalToolbar: true});
    ui.buttons[0].click();
    await new Promise(setImmediate);
    assert.equal(ui.requests[0].url, '/api/reports/dashboards/21/delete');
    assert.deepEqual(ui.destinations, ['/reports/dashboards']);
});

test('dashboard writes send POST and preserve the exact payload', async () => {
    const result = await saveDashboard('/save', {name: 'Updated'}, async (url, request) => {
        assert.equal(url, '/save');
        assert.equal(request.method, 'POST');
        assert.deepEqual(JSON.parse(request.body), {name: 'Updated'});
        return {ok: true, json: async () => ({success: true, id: 2})};
    });
    assert.equal(result.id, 2);
});

test('failed responses and unacknowledged writes cannot look successful', async () => {
    for (const [ok, data] of [
        [false, {success: false, error: 'Save rejected'}],
        [true, {success: false, error: 'Save rejected'}],
        [false, {success: true}], [true, {}],
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

test('Manage Dashboards marks drafts, offers Edit draft, and refreshes on storage changes', () => {
    const badge = {}, edit = {};
    const row = {
        dataset: {dashboardRow: '21'},
        querySelector(selector) { return selector === '[data-dashboard-draft]' ? badge : edit; },
    };
    const root = {
        querySelectorAll(selector) { return selector === '[data-dashboard-row]' ? [row] : []; },
        querySelector() { return null; },
    };
    const error = {hidden: true, focus() {}};
    let draft = {name: 'Draft name'};
    const listeners = {};
    const document = {
        readyState: 'complete', querySelector() { return root; },
        getElementById(id) { return id === 'dashboardError' ? error : null; },
    };
    const window = {
        document, SBDashboardDrafts: {read() { return draft; }},
        addEventListener(event, callback) { listeners[event] = callback; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(
        __dirname, '../../static/js/ui-dashboards.js'), 'utf8'), {window, document, console});
    assert.equal(badge.hidden, false);
    assert.equal(edit.textContent, 'Edit draft');
    draft = null;
    listeners.storage();
    assert.equal(badge.hidden, true);
    assert.equal(edit.textContent, 'Edit');
});
