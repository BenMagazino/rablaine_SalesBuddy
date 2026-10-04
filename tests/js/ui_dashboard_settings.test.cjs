const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    '../../static/js/ui-dashboard-settings.js'), 'utf8');

function fixture(response) {
    function element() {
        return {dataset: {}, attributes: {}, handlers: {}, disabled: false,
            textContent: '', children: [],
            setAttribute(name, value) { this.attributes[name] = value; },
            getAttribute(name) { return this.attributes[name]; },
            addEventListener(name, callback) { this.handlers[name] = callback; },
            appendChild(child) { this.children.push(child); }};
    }
    const fields = ['copilot_actions_enabled', 'show_stale_milestones', 'show_hygiene_tasks']
        .map((preference, i) => {
            const field = element(), row = element();
            field.id = 'setting' + i;
            field.dataset.preference = preference;
            field.checked = true;
            field.attributes['aria-describedby'] = 'help' + i;
            field.closest = () => row;
            return {field, row};
        });
    const refresh = element(), result = element(), errors = [], requests = [];
    const root = {querySelector: selector => selector === '#refreshCopilotBtn' ? refresh : result,
        querySelectorAll: () => fields.map(entry => entry.field)};
    let reply = response || {ok: true, json: async () => ({success: true, items_created: 2})};
    vm.runInNewContext(source, {
        document: {querySelector: () => root, createElement: element},
        console: {error: (...args) => errors.push(args)},
        fetch: async (url, options) => {
            requests.push({url, options});
            if (typeof reply === 'function') return reply();
            if (reply instanceof Error) throw reply;
            return reply;
        },
    });
    return {fields, refresh, result, errors, requests, setReply: value => { reply = value; }};
}

test('each toggle sends exactly its original field and reports confirmed persistence', async () => {
    for (let i = 0; i < 3; i++) {
        const h = fixture(), {field, row} = h.fields[i];
        field.checked = false;
        h.setReply({ok: true, json: async () => ({
            success: true, [field.dataset.preference]: false,
        })});
        const saving = field.handlers.change();
        assert.equal(field.disabled, true);
        assert.equal(row.children[0].textContent, 'Saving...');
        await saving;
        assert.equal(field.disabled, false);
        assert.equal(field.checked, false);
        assert.equal(row.children[0].textContent, 'Saved.');
        assert.equal(h.requests[0].url, '/api/preferences/dashboard-toggle');
        assert.equal(h.requests[0].options.method, 'POST');
        assert.deepEqual(JSON.parse(h.requests[0].options.body),
            {[field.dataset.preference]: false});
        assert.match(field.attributes['aria-describedby'], /help.*Status/);
    }
});

for (const [description, response] of [
    ['HTTP', {ok: false, status: 503}],
    ['network', new Error('Network unavailable')],
    ['JSON', {ok: true, json: async () => { throw new Error('Invalid JSON'); }}],
    ['rejected', {ok: true, json: async () => ({success: false, error: '<literal error>'})}],
    ['unconfirmed preference', {ok: true, json: async () => ({success: true})}],
]) {
    test(description + ' toggle failures restore the saved value and remain retryable', async () => {
        const h = fixture(response), {field, row} = h.fields[0];
        field.checked = false;
        await field.handlers.change();
        assert.equal(field.checked, true);
        assert.equal(field.disabled, false);
        assert.equal(row.children[0].dataset.state, 'error');
        assert.equal(row.children[0].attributes.role, 'alert');
        assert.equal(h.errors.length, 1);
        h.setReply({ok: true, json: async () => ({
            success: true, copilot_actions_enabled: false,
        })});
        field.checked = false;
        await field.handlers.change();
        assert.equal(field.checked, false);
        assert.equal(row.children[0].dataset.state, 'success');
    });
}

test('rollback uses the last confirmed value, not the value at initial page load', async () => {
    const h = fixture(), {field} = h.fields[0];
    h.setReply({ok: true, json: async () => ({
        success: true, copilot_actions_enabled: false,
    })});
    field.checked = false;
    await field.handlers.change();
    h.setReply(new Error('Offline'));
    field.checked = true;
    await field.handlers.change();
    assert.equal(field.checked, false);
});

test('refresh preserves the POST, reports zero/singular/plural counts and keeps button geometry', async () => {
    for (const count of [0, 1, 3]) {
        const h = fixture({ok: true, json: async () => ({success: true, items_created: count})});
        h.refresh.textContent = 'Refresh';
        const pending = h.refresh.handlers.click();
        assert.equal(h.refresh.disabled, true);
        assert.equal(h.refresh.attributes['aria-busy'], 'true');
        await pending;
        assert.equal(h.requests[0].url, '/api/copilot-actions/sync');
        assert.equal(h.requests[0].options.method, 'POST');
        assert.equal(h.refresh.textContent, 'Refresh');
        assert.equal(h.refresh.disabled, false);
        assert.equal(h.refresh.attributes['aria-busy'], 'false');
        assert.equal(h.result.textContent,
            count + ' action item' + (count === 1 ? '' : 's') + ' created.');
    }
});

test('failed or malformed refresh results stay visible and cannot claim success', async () => {
    for (const response of [
        {ok: false, status: 500}, new Error('Offline'),
        {ok: true, json: async () => ({success: false, error: '<Lookup failed>'})},
        {ok: true, json: async () => ({success: true, items_created: -1})},
        {ok: true, json: async () => ({success: true})},
    ]) {
        const h = fixture(response);
        await h.refresh.handlers.click();
        assert.equal(h.result.dataset.state, 'error');
        assert.equal(h.result.attributes.role, 'alert');
        assert.match(h.result.textContent, /Could not refresh/);
        assert.equal(h.refresh.disabled, false);
        assert.equal(h.errors.length, 1);
    }
});

test('pending refresh and preference saves gate duplicate requests independently', async () => {
    let finish;
    const h = fixture(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.refresh.handlers.click();
    await h.refresh.handlers.click();
    assert.equal(h.requests.length, 1);
    finish({ok: true, json: async () => ({success: true, items_created: 0})});
    await pending;
    let finishSave;
    h.setReply(() => new Promise(resolve => { finishSave = resolve; }));
    const {field} = h.fields[0];
    field.checked = false;
    const save = field.handlers.change();
    await field.handlers.change();
    assert.equal(h.requests.length, 2);
    finishSave({ok: true, json: async () => ({
        success: true, copilot_actions_enabled: false,
    })});
    await save;
});
