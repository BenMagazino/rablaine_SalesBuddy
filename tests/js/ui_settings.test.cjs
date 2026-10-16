const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-settings.js'), 'utf8');

function fixture({seMode = true} = {}) {
    function element(id, value = '') {
        return {id, value, checked: false, disabled: false, textContent: '', style: {},
            attributes: {}, handlers: {}, children: [],
            classList: {toggle() {}},
            setAttribute(name, value) { this.attributes[name] = value; },
            addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); },
            append(child) { this.children.push(child); },
            closest() { return this; },
            async fire(name, event = {}) {
                await Promise.all((this.handlers[name] || []).map(handler => handler(event)));
            }};
    }
    const fields = Object.fromEntries([
        'settingsDarkModeSwitch', 'settingsLoadingIndicatorSwitch',
        'connectImpactSwitch', 'msxAutoWritebackSwitch',
        'workiqPrompt', 'savePromptBtn', 'resetPromptBtn', 'promptStatus', 'templateSelect',
        'viewEditBtn', 'deleteBtn', 'defaultCustomer', 'defaultNoncustomer', 'defaultTemplatesForm',
        'deleteTemplateName', 'deleteTemplateForm',
        'settingsThemeFamily', 'settingsThemeResult',
        'settingsSeSpecialty', 'settingsSeSpecialtyResult',
    ].map(id => [id, element(id)]));
    fields.workiqPrompt.value = 'Saved prompt';
    fields.settingsThemeFamily.value = 'graphite';
    fields.settingsSeSpecialty.value = 'data';
    if (!seMode) {
        delete fields.settingsSeSpecialty;
        delete fields.settingsSeSpecialtyResult;
    }
    fields.settingsDarkModeSwitch.checked = true;
    fields.settingsLoadingIndicatorSwitch.checked = true;
    fields.connectImpactSwitch.checked = true;
    fields.templateSelect.options = [{text: 'First template'}];
    fields.templateSelect.selectedIndex = 0;
    const defaultsButton = element('defaultsButton');
    fields.defaultTemplatesForm.querySelector = () => defaultsButton;
    const windowHandlers = {};
    const requests = [], dialogs = [], events = [];
    let reply = {ok: true, json: async () => ({success: true})};
    let confirmation = true;
    const history = {state: {}, replaceState(value) { this.state = value; }};
    const documentElement = {dataset: {bsTheme: 'dark', sbMode: 'dark', sbFamily: 'graphite'}};
    vm.runInNewContext(source, {
        document: {
            querySelector: () => ({querySelector: selector => fields[selector.slice(1)]}),
            getElementById: id => id === 'sbSettingsConfig' ?
                {textContent: JSON.stringify({defaultPrompt: 'Default prompt'})} : fields[id],
            createElement: () => element('status'),
            documentElement,
        },
        history, Event, window: {
            addEventListener: (name, handler) => { windowHandlers[name] = handler; },
            dispatchEvent: event => events.push(event.type),
        },
        confirm: () => confirmation, SBDialog: {open: id => dialogs.push(id)},
        fetch: async (url, options) => {
            requests.push({url, options});
            if (reply instanceof Error) throw reply;
            return typeof reply === 'function' ? reply() : reply;
        },
    });
    return {fields, requests, dialogs, events, history, documentElement, defaultsButton, windowHandlers,
        setReply(value) { reply = value; }, confirm(value) { confirmation = value; }};
}

for (const [id, key] of [
    ['settingsDarkModeSwitch', 'dark_mode'], ['connectImpactSwitch', 'workiq_connect_impact'],
    ['msxAutoWritebackSwitch', 'msx_auto_writeback'],
    ['settingsLoadingIndicatorSwitch', 'loading_indicator_enabled'],
]) {
    test(`${id} saves its original payload only after confirmation`, async () => {
        const h = fixture(), input = h.fields[id];
        input.checked = false;
        h.setReply({ok: true, json: async () => ({[key]: false, success: true})});
        const pending = input.fire('change');
        assert.equal(input.disabled, true);
        await pending;
        assert.deepEqual(JSON.parse(h.requests[0].options.body), {[key]: false});
        assert.equal(input.disabled, false);
        assert.equal(input.checked, false);
        assert.equal(input.children[0].textContent, 'Saved.');
    });
}

test('loading feedback changes only after a confirmed save and notifies the active page', async () => {
    const h = fixture();
    const input = h.fields.settingsLoadingIndicatorSwitch;
    input.checked = false;
    let finish;
    h.setReply(() => new Promise(resolve => { finish = resolve; }));
    const pending = input.fire('change');
    assert.equal(h.documentElement.dataset.sbActivityEnabled, undefined);
    assert.deepEqual(h.events, []);
    assert.equal(h.requests[0].url, '/api/preferences/loading-indicator');
    await input.fire('change');
    assert.equal(h.requests.length, 1);
    finish({ok: true, json: async () => ({loading_indicator_enabled: false})});
    await pending;
    assert.equal(h.documentElement.dataset.sbActivityEnabled, 'false');
    assert.deepEqual(h.events, ['sb:activity-preference-changed']);
});

for (const reply of [
    new Error('Offline'),
    {ok: false, status: 500, json: async () => ({error: 'Unavailable'})},
    {ok: true, json: async () => ({loading_indicator_enabled: true})},
]) {
    test('failed loading preference saves preserve the confirmed display and allow retry', async () => {
        const h = fixture();
        const input = h.fields.settingsLoadingIndicatorSwitch;
        input.checked = false;
        h.setReply(reply);
        await input.fire('change');
        assert.equal(input.checked, true);
        assert.equal(input.disabled, false);
        assert.equal(h.documentElement.dataset.sbActivityEnabled, undefined);
        assert.deepEqual(h.events, []);
        assert.match(input.children[0].textContent, /Could not save/);
        assert.equal(input.children[0].attributes.role, 'alert');
    });
}

test('theme saves once, applies only after confirmation and preserves dark appearance', async () => {
    const h = fixture();
    let finish;
    h.fields.settingsThemeFamily.value = 'harbor';
    h.setReply(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.fields.settingsThemeFamily.fire('change');
    await h.fields.settingsThemeFamily.fire('change');
    assert.equal(h.requests.length, 1);
    assert.equal(h.documentElement.dataset.sbFamily, 'graphite');
    assert.equal(h.fields.settingsThemeFamily.disabled, true);
    assert.equal(h.requests[0].url, '/api/preferences/theme-family');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {theme_family: 'harbor'});
    finish({ok: true, json: async () => ({theme_family: 'harbor'})});
    await pending;
    assert.equal(h.documentElement.dataset.sbFamily, 'harbor');
    assert.equal(h.documentElement.dataset.sbMode, 'dark');
    assert.equal(h.documentElement.dataset.bsTheme, 'dark');
    assert.equal(h.fields.settingsThemeResult.textContent, 'Saved.');
    assert.equal(h.fields.settingsThemeFamily.disabled, false);
});

test('specialty saves only the preference with duplicate writes guarded', async () => {
    const h = fixture();
    let finish;
    h.fields.settingsSeSpecialty.value = 'apps_ai';
    h.setReply(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.fields.settingsSeSpecialty.fire('change');
    await h.fields.settingsSeSpecialty.fire('change');
    assert.equal(h.requests.length, 1);
    assert.equal(h.fields.settingsSeSpecialty.disabled, true);
    assert.equal(h.requests[0].url, '/api/preferences/se-specialty');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {se_specialty: 'apps_ai'});
    finish({ok: true, json: async () => ({se_specialty: 'apps_ai'})});
    await pending;
    assert.equal(h.fields.settingsSeSpecialty.value, 'apps_ai');
    assert.equal(h.fields.settingsSeSpecialty.disabled, false);
    assert.equal(h.fields.settingsSeSpecialtyResult.textContent, 'Saved.');
    assert.deepEqual(h.documentElement.dataset,
        {bsTheme: 'dark', sbMode: 'dark', sbFamily: 'graphite'});
});

for (const [name, reply] of [
    ['network', new Error('Offline')],
    ['HTTP', {ok: false, status: 403, json: async () => ({error: 'SE Mode only'})}],
    ['unconfirmed', {ok: true, json: async () => ({se_specialty: 'other'})}],
]) {
    test(`${name} specialty failure rolls back and permits retry`, async () => {
        const h = fixture();
        h.fields.settingsSeSpecialty.value = 'infra';
        h.setReply(reply);
        await h.fields.settingsSeSpecialty.fire('change');
        assert.equal(h.fields.settingsSeSpecialty.value, 'data');
        assert.equal(h.fields.settingsSeSpecialty.disabled, false);
        assert.match(h.fields.settingsSeSpecialtyResult.textContent, /Could not save specialty/);
        assert.equal(h.fields.settingsSeSpecialtyResult.attributes.role, 'alert');
    });
}

test('DSS settings initialize safely without a specialty picker', async () => {
    const h = fixture({seMode: false});
    h.fields.settingsThemeFamily.value = 'carbon';
    h.setReply({ok: true, json: async () => ({theme_family: 'carbon'})});
    await h.fields.settingsThemeFamily.fire('change');
    assert.equal(h.documentElement.dataset.sbFamily, 'carbon');
    assert.equal(h.requests.length, 1);
});

for (const [name, reply] of [
    ['network', new Error('Offline')],
    ['HTTP', {ok: false, status: 500, json: async () => ({error: 'Unavailable'})}],
    ['unconfirmed', {ok: true, json: async () => ({theme_family: 'carbon'})}],
]) {
    test(`${name} theme failure restores the confirmed picker and stays retryable`, async () => {
        const h = fixture();
        h.fields.settingsThemeFamily.value = 'midnight';
        h.setReply(reply);
        await h.fields.settingsThemeFamily.fire('change');
        assert.equal(h.fields.settingsThemeFamily.value, 'graphite');
        assert.equal(h.documentElement.dataset.sbFamily, 'graphite');
        assert.equal(h.fields.settingsThemeFamily.disabled, false);
        assert.match(h.fields.settingsThemeResult.textContent, /Could not save theme/);
        assert.equal(h.fields.settingsThemeResult.attributes.role, 'alert');
    });
}

for (const [name, reply] of [
    ['network', new Error('Offline')],
    ['HTTP', {ok: false, status: 503, json: async () => ({error: 'Unavailable'})}],
    ['unconfirmed', {ok: true, json: async () => ({success: true})}],
]) {
    test(`${name} toggle failure rolls back and stays retryable`, async () => {
        const h = fixture(), input = h.fields.settingsDarkModeSwitch;
        input.checked = false;
        h.setReply(reply);
        await input.fire('change');
        assert.equal(input.checked, true);
        assert.equal(input.disabled, false);
        assert.equal(h.documentElement.dataset.sbMode, 'dark');
        assert.match(input.children[0].textContent, /Could not save/);
        assert.equal(input.children[0].attributes.role, 'alert');
    });
}

test('failed prompt save retains exact draft and releases both commands', async () => {
    const h = fixture();
    h.fields.workiqPrompt.value = '  unsaved <literal> draft  ';
    h.setReply(new Error('Offline'));
    await h.fields.savePromptBtn.fire('click');
    assert.equal(h.fields.workiqPrompt.value, '  unsaved <literal> draft  ');
    assert.match(h.fields.promptStatus.textContent, /draft is retained/);
    assert.equal(h.fields.savePromptBtn.disabled, false);
    assert.equal(h.fields.resetPromptBtn.disabled, false);
});

test('prompt pending gates duplicate saves and successful response persists exact submitted value', async () => {
    const h = fixture();
    let finish;
    h.fields.workiqPrompt.value = '  Native prompt  ';
    h.setReply(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.fields.savePromptBtn.fire('click');
    await h.fields.savePromptBtn.fire('click');
    assert.equal(h.requests.length, 1);
    assert.equal(h.fields.workiqPrompt.disabled, true);
    finish({ok: true, json: async () => ({success: true, workiq_summary_prompt: 'Native prompt'})});
    await pending;
    assert.equal(h.fields.workiqPrompt.value, 'Native prompt');
    assert.equal(h.history.state.sbPreferencesDraft.workiqPrompt, 'Native prompt');
});

test('reset cancellation is write-free and failed reset never destroys the draft', async () => {
    const h = fixture();
    h.fields.workiqPrompt.value = 'Important draft';
    h.confirm(false);
    await h.fields.resetPromptBtn.fire('click');
    assert.equal(h.requests.length, 0);
    h.confirm(true);
    h.setReply(new Error('Offline'));
    await h.fields.resetPromptBtn.fire('click');
    assert.equal(h.fields.workiqPrompt.value, 'Important draft');
});

test('confirmed default reset replaces the draft only after server confirmation', async () => {
    const h = fixture();
    h.fields.workiqPrompt.value = 'Previous draft';
    h.setReply({ok: true, json: async () => ({
        success: true, workiq_summary_prompt: null,
    })});
    await h.fields.resetPromptBtn.fire('click');
    assert.equal(h.fields.workiqPrompt.value, 'Default prompt');
    assert.equal(h.history.state.sbPreferencesDraft.workiqPrompt, 'Default prompt');
    assert.equal(h.fields.promptStatus.textContent, 'Default prompt restored.');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), {workiq_summary_prompt: ''});
});

test('template selection and delete open only native confirmation without posting', async () => {
    const h = fixture();
    h.fields.templateSelect.value = '42';
    await h.fields.templateSelect.fire('change');
    assert.equal(h.fields.viewEditBtn.href, '/templates/42/edit');
    assert.equal(h.fields.viewEditBtn.tabIndex, 0);
    assert.equal(h.fields.deleteBtn.disabled, false);
    await h.fields.deleteBtn.fire('click');
    assert.equal(h.fields.deleteTemplateForm.action, '/api/templates/42/delete');
    assert.deepEqual(h.dialogs, ['deleteTemplateModal']);
    assert.equal(h.requests.length, 0);
    h.fields.templateSelect.value = '';
    await h.fields.templateSelect.fire('change');
    assert.equal(h.fields.viewEditBtn.tabIndex, -1);
    assert.equal(h.fields.deleteBtn.disabled, true);
});

test('manual defaults submit guards duplicate navigation and Back restores a usable command', async () => {
    const h = fixture();
    let prevented = false;
    await h.fields.defaultTemplatesForm.fire('submit', {preventDefault() { prevented = true; }});
    assert.equal(h.defaultsButton.disabled, true);
    await h.fields.defaultTemplatesForm.fire('submit', {preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    h.windowHandlers.pageshow();
    assert.equal(h.defaultsButton.disabled, false);
    assert.equal(h.defaultsButton.textContent, 'Save Defaults');
});
