const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../static/js/ui-settings.js'), 'utf8');

function fixture() {
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
        'settingsDarkModeSwitch', 'connectImpactSwitch', 'msxAutoWritebackSwitch',
        'workiqPrompt', 'savePromptBtn', 'resetPromptBtn', 'promptStatus', 'templateSelect',
        'viewEditBtn', 'deleteBtn', 'defaultCustomer', 'defaultNoncustomer', 'defaultTemplatesForm',
        'deleteTemplateName', 'deleteTemplateForm',
    ].map(id => [id, element(id)]));
    fields.workiqPrompt.value = 'Saved prompt';
    fields.settingsDarkModeSwitch.checked = true;
    fields.connectImpactSwitch.checked = true;
    fields.templateSelect.options = [{text: 'First template'}];
    fields.templateSelect.selectedIndex = 0;
    const defaultsButton = element('defaultsButton');
    fields.defaultTemplatesForm.querySelector = () => defaultsButton;
    const windowHandlers = {};
    const requests = [], dialogs = [];
    let reply = {ok: true, json: async () => ({success: true})};
    let confirmation = true;
    const history = {state: {}, replaceState(value) { this.state = value; }};
    const documentElement = {dataset: {bsTheme: 'dark', sbMode: 'dark'}};
    vm.runInNewContext(source, {
        document: {
            querySelector: () => ({querySelector: selector => fields[selector.slice(1)]}),
            getElementById: id => id === 'sbSettingsConfig' ?
                {textContent: JSON.stringify({defaultPrompt: 'Default prompt'})} : fields[id],
            createElement: () => element('status'),
            documentElement,
        },
        history, window: {addEventListener: (name, handler) => { windowHandlers[name] = handler; }},
        confirm: () => confirmation, SBDialog: {open: id => dialogs.push(id)},
        fetch: async (url, options) => {
            requests.push({url, options});
            if (reply instanceof Error) throw reply;
            return typeof reply === 'function' ? reply() : reply;
        },
    });
    return {fields, requests, dialogs, history, documentElement, defaultsButton, windowHandlers,
        setReply(value) { reply = value; }, confirm(value) { confirmation = value; }};
}

for (const [id, key] of [
    ['settingsDarkModeSwitch', 'dark_mode'], ['connectImpactSwitch', 'workiq_connect_impact'],
    ['msxAutoWritebackSwitch', 'msx_auto_writeback'],
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
