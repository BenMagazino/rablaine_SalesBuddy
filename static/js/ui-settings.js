/* Preferences retain confirmed values and recover editable drafts after navigation. */
(() => {
    'use strict';
    const root = document.querySelector('.sb-admin-settings');
    if (!root) return;
    const prompt = root.querySelector('#workiqPrompt');
    const save = root.querySelector('#savePromptBtn');
    const reset = root.querySelector('#resetPromptBtn');
    const status = root.querySelector('#promptStatus');
    const config = JSON.parse(document.getElementById('sbSettingsConfig').textContent);
    let savedPrompt = prompt.value;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    function show(element, message, error = false) {
        element.textContent = message;
        element.classList.toggle('sb-admin-text-danger', error);
        element.setAttribute('role', error ? 'alert' : 'status');
    }
    async function request(url, payload) {
        const response = await fetch(url, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || data.error || data.success === false) {
            throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
        }
        return data;
    }
    for (const [id, resultId, key, url, label] of [
        ['settingsThemeFamily', 'settingsThemeResult', 'theme_family',
            '/api/preferences/theme-family', 'theme'],
        ['settingsSeSpecialty', 'settingsSeSpecialtyResult', 'se_specialty',
            '/api/preferences/se-specialty', 'specialty'],
    ]) {
        const input = root.querySelector('#' + id);
        if (!input) continue;
        const result = root.querySelector('#' + resultId);
        let confirmed = input.value;
        input.addEventListener('change', async () => {
            if (input.disabled) return;
            const value = input.value;
            input.disabled = true;
            show(result, 'Saving...');
            try {
                const data = await request(url, {[key]: value});
                if (data[key] !== value) {
                    throw new Error(`The selected ${label} was not confirmed.`);
                }
                confirmed = value;
                if (key === 'theme_family') document.documentElement.dataset.sbFamily = value;
                show(result, 'Saved.');
            } catch (error) {
                input.value = confirmed;
                show(result, `Could not save ${label}. Try again. ${error.message}`, true);
            } finally {
                input.disabled = false;
            }
        });
    }
    for (const [id, key, url] of [
        ['settingsDarkModeSwitch', 'dark_mode', '/api/preferences/dark-mode'],
        ['connectImpactSwitch', 'workiq_connect_impact', '/api/preferences/workiq-connect-impact'],
        ['msxAutoWritebackSwitch', 'msx_auto_writeback', '/api/preferences/msx-auto-writeback'],
    ]) {
        const input = root.querySelector('#' + id);
        let confirmed = input.checked;
        const result = document.createElement('p');
        result.id = id + 'Result';
        result.className = 'sb-admin-help';
        result.setAttribute('aria-live', 'polite');
        input.setAttribute('aria-describedby', result.id);
        input.closest('.sb-admin-check')?.append(result);
        input.setAttribute('aria-label', {
            settingsDarkModeSwitch: 'Dark appearance',
            connectImpactSwitch: 'Extract Connect and Engagement Signals',
            msxAutoWritebackSwitch: 'Automatically sync to MSX milestones and opportunities',
        }[id]);
        input.addEventListener('change', async () => {
            if (input.disabled) return;
            const value = input.checked;
            input.disabled = true;
            show(result, 'Saving...');
            try {
                const data = await request(url, {[key]: value});
                if (data[key] !== value) throw new Error('The selected value was not confirmed.');
                confirmed = value;
                if (key === 'dark_mode') {
                    document.documentElement.dataset.bsTheme = value ? 'dark' : 'light';
                    document.documentElement.dataset.sbMode = value ? 'dark' : 'light';
                }
                show(result, 'Saved.');
            } catch (error) {
                input.checked = confirmed;
                show(result, `Could not save. Try again. ${error.message}`, true);
            } finally {
                input.disabled = false;
            }
        });
    }
    async function savePrompt(clear) {
        if (save.disabled) return;
        if (clear && !confirm('Reset to the default prompt?')) return;
        const value = clear ? '' : prompt.value.trim();
        save.disabled = reset.disabled = prompt.disabled = true;
        show(status, 'Saving...');
        try {
            const data = await request('/api/preferences/workiq-prompt',
                {workiq_summary_prompt: value});
            if (data.success !== true || (data.workiq_summary_prompt || '') !== value) {
                throw new Error('The server did not confirm this prompt.');
            }
            prompt.value = clear ? config.defaultPrompt : value;
            savedPrompt = prompt.value;
            persist();
            show(status, clear ? 'Default prompt restored.' : 'Prompt saved.');
        } catch (error) {
            show(status, `Could not save. Your draft is retained. ${error.message}`, true);
        } finally {
            save.disabled = reset.disabled = prompt.disabled = false;
        }
    }
    save.addEventListener('click', () => savePrompt(false));
    reset.addEventListener('click', () => savePrompt(true));
    const select = root.querySelector('#templateSelect');
    const edit = root.querySelector('#viewEditBtn');
    const remove = root.querySelector('#deleteBtn');
    function templateSelection() {
        if (!select) return;
        edit.href = select.value ? `/templates/${select.value}/edit` : '#';
        edit.style.pointerEvents = select.value ? 'auto' : 'none';
        edit.style.opacity = select.value ? '1' : '.5';
        edit.setAttribute('aria-disabled', String(!select.value));
        edit.tabIndex = select.value ? 0 : -1;
        remove.disabled = !select.value;
    }
    select?.addEventListener('change', templateSelection);
    remove?.addEventListener('click', () => {
        if (!select.value) return;
        document.getElementById('deleteTemplateName').textContent =
            select.options[select.selectedIndex].text;
        document.getElementById('deleteTemplateForm').action =
            `/api/templates/${select.value}/delete`;
        SBDialog.open('deleteTemplateModal');
    });
    const draftFields = [prompt, select, root.querySelector('#defaultCustomer'),
        root.querySelector('#defaultNoncustomer')].filter(Boolean);
    function persist() {
        history.replaceState({...history.state, sbPreferencesDraft:
            Object.fromEntries(draftFields.map(field => [field.id, field.value]))}, '');
    }
    for (const field of draftFields) {
        const value = history.state?.sbPreferencesDraft?.[field.id];
        if (typeof value === 'string') field.value = value;
        field.addEventListener('input', persist);
        field.addEventListener('change', persist);
    }
    templateSelection();
    const defaults = root.querySelector('#defaultTemplatesForm');
    const defaultsButton = defaults.querySelector('button[type="submit"]');
    let defaultsSubmitting = false;
    defaults.addEventListener('submit', event => {
        if (defaultsSubmitting) {
            event.preventDefault();
            return;
        }
        defaultsSubmitting = true;
        defaultsButton.disabled = true;
        defaultsButton.textContent = 'Saving Defaults...';
    });
    window.addEventListener('pageshow', () => {
        defaultsSubmitting = false;
        defaultsButton.disabled = false;
        defaultsButton.textContent = 'Save Defaults';
    });
    prompt.addEventListener('input', () => show(status,
        prompt.value === savedPrompt ? '' : 'Unsaved prompt changes.'));
    window.addEventListener('beforeunload', event => {
        if (!defaultsSubmitting && (prompt.value !== savedPrompt || save.disabled)) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
})();
