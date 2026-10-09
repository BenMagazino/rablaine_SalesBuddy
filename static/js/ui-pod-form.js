/** Territory-scoped autosaves with native dialog and entry-local recovery lifecycle. */
((root) => {
    'use strict';
    async function saveSelection(fetcher, territory, specialty, value) {
        const response = await fetcher('/territory/' + territory + '/dss-selection', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
            body: JSON.stringify({specialty, solution_engineer_id: value || null}),
        });
        const data = await response.json();
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || 'The assignment was not saved.');
        }
        return data;
    }
    function validateView(value, id, keys) {
        if (!value || value.id !== id || !Number.isFinite(value.scroll) || value.scroll < 0
            || typeof value.collapsed !== 'boolean' || !value.choices
            || keys.some(key => !value.choices[key]
                || typeof value.choices[key].value !== 'string'
                || typeof value.choices[key].saved !== 'string')) {
            throw new Error('Invalid POD edit history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {saveSelection, validateView};
    if (!root.document) return;
    const document = root.document, form = document.getElementById('podForm');
    if (!form) return;
    const id = Number(form.dataset.podId), reading =
        form.querySelector('[data-pod-assignment-reading]') || form.querySelector('[data-sb-page-body]');
    const selects = [...form.querySelectorAll('[data-dss-territory]')];
    const notice = document.getElementById('podFormNotice');
    const status = document.getElementById('podFormState');
    const toggle = document.getElementById('podDssToggle');
    const body = document.getElementById('dssCardBody');
    const dialog = document.getElementById('podFormDiscard');
    const saved = new Map(selects.map(select => [select.id, select.value]));
    const pending = new Set();
    let destination = null;
    function showSavedChoice(select) {
        if (form.dataset.podDetail === undefined || !saved.get(select.id)
            || select.value !== saved.get(select.id)) return;
        let badge = select.parentElement.querySelector('[data-pod-saved-choice]');
        if (!badge) {
            badge = document.createElement('span');
            badge.dataset.podSavedChoice = '';
            select.before(badge);
        }
        badge.textContent = select.options[select.selectedIndex].text;
        const icon = document.createElement('i');
        icon.className = 'bi bi-person';
        icon.setAttribute('aria-hidden', 'true');
        badge.prepend(icon, ' ');
        select.hidden = true;
    }
    const dirty = () => selects.some(select => select.value !== saved.get(select.id));
    function warn(message, error) {
        notice.textContent = message;
        notice.hidden = false;
        if (error) root.console.error(message, error);
    }
    function update() {
        status.textContent = pending.size ? 'Saving assignments...'
            : dirty() ? 'Unsaved assignments' : 'Assignments up to date';
    }
    function remember() {
        try {
            root.history.replaceState({...root.history.state, sbPodForm: {
                id, scroll: reading.scrollTop, collapsed: body?.hidden ?? false,
                choices: Object.fromEntries(selects.map(select => [select.id,
                    {value: select.value, saved: saved.get(select.id)}])),
            }}, '');
        } catch (error) { warn('Could not remember POD edit context for Back.', error); }
    }
    function collapse(value) {
        if (!body) return;
        body.hidden = value;
        toggle.setAttribute('aria-expanded', String(!value));
        toggle.querySelector('i').className = 'bi bi-chevron-' + (value ? 'down' : 'up');
    }
    function restore() {
        const view = root.history.state?.sbPodForm;
        if (view && view.id === id) {
            try {
                validateView(view, id, selects.map(select => select.id));
                selects.forEach(select => {
                    const choice = view.choices[select.id];
                    if (![...select.options].some(option => option.value === choice.value)
                        || ![...select.options].some(option => option.value === choice.saved)) {
                        throw new Error('Unavailable DSS draft selection.');
                    }
                });
                selects.forEach(select => {
                    select.value = view.choices[select.id].value;
                    saved.set(select.id, view.choices[select.id].saved);
                    const failed = select.value !== saved.get(select.id);
                    select.parentElement.querySelector('[data-dss-retry]').hidden = !failed;
                    if (failed) {
                        select.setAttribute('aria-invalid', 'true');
                        select.parentElement.querySelector('[role="status"]').textContent =
                            'Not saved. Retry this assignment.';
                    }
                    showSavedChoice(select);
                });
                collapse(view.collapsed);
                reading.scrollTop = view.scroll;
            } catch (error) { warn('Could not restore POD edits. Review assignments before changing them.', error); }
        }
        update();
    }
    async function save(select) {
        if (pending.has(select.id)) return;
        pending.add(select.id);
        select.disabled = true;
        select.setAttribute('aria-busy', 'true');
        const retry = select.parentElement.querySelector('[data-dss-retry]');
        const result = select.parentElement.querySelector('[role="status"]');
        retry.hidden = true;
        result.textContent = 'Saving...';
        notice.hidden = true;
        update();
        remember();
        try {
            await saveSelection(root.fetch.bind(root), select.dataset.dssTerritory,
                select.dataset.dssSpecialty, select.value);
            saved.set(select.id, select.value);
            select.removeAttribute('aria-invalid');
            result.textContent = 'Saved';
            showSavedChoice(select);
        } catch (error) {
            select.setAttribute('aria-invalid', 'true');
            result.textContent = 'Not saved. Your selection is retained.';
            retry.hidden = false;
            warn('Could not save this assignment. Retry before leaving, or discard unsaved changes.', error);
        } finally {
            pending.delete(select.id);
            select.disabled = false;
            select.removeAttribute('aria-busy');
            update();
            remember();
        }
    }
    selects.forEach(select => {
        select.addEventListener('change', () => save(select));
        select.parentElement.querySelector('[data-dss-retry]').addEventListener('click',
            () => save(select));
    });
    if (toggle) {
        try { collapse(root.localStorage.getItem('dss_collapsed_pod_' + id) === '1'); }
        catch (error) { warn('Could not restore assignment disclosure preference.', error); }
        toggle.addEventListener('click', () => {
            collapse(!body.hidden);
            try {
                if (body.hidden) root.localStorage.setItem('dss_collapsed_pod_' + id, '1');
                else root.localStorage.removeItem('dss_collapsed_pod_' + id);
            } catch (error) { warn('Could not remember assignment disclosure preference.', error); }
            remember();
        });
    }
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey
            || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank'
            || link.hasAttribute('download') || link.getAttribute('href').startsWith('#')
            || (!pending.size && !dirty())) return;
        event.preventDefault();
        if (pending.size) { warn('Saving assignments. Wait before leaving this POD.'); return; }
        destination = link.href;
        root.SBDialog.open(dialog);
    });
    document.getElementById('podFormDiscardConfirm').addEventListener('click', () => {
        if (pending.size || !destination) return;
        selects.forEach(select => { select.value = saved.get(select.id); });
        remember();
        root.SBDialog.close(dialog, 'discard');
        root.location.assign(destination);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
            event.preventDefault();
            form.querySelector('[data-pod-back]').click();
        }
    });
    root.addEventListener('beforeunload', event => {
        if (!pending.size && !dirty()) return;
        event.preventDefault();
        event.returnValue = '';
    });
    reading.addEventListener('scroll', remember, {passive: true});
    root.addEventListener('pagehide', remember);
    root.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? {} : window);
