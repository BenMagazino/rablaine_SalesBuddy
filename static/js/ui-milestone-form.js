/** Explicit native POST, guarded navigation and entry-local milestone drafts. */
(function (root) {
    'use strict';

    function validateView(value, key) {
        if (!value || value.key !== key || typeof value.url !== 'string'
            || typeof value.title !== 'string' || !Number.isFinite(value.scroll)
            || value.scroll < 0) throw new Error('Invalid milestone form history.');
        return value;
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = {validateView};
    if (!root.document) return;
    const document = root.document;
    const form = document.getElementById('milestoneForm');
    if (!form) return;
    const url = form.elements.url, title = form.elements.title;
    const reading = form.querySelector('[data-sb-page-body]');
    const saveButton = document.getElementById('milestoneFormSave');
    const status = document.getElementById('milestoneFormState');
    const notice = document.getElementById('milestoneFormNotice');
    const discard = document.getElementById('milestoneFormDiscard');
    const initial = {
        url: form.dataset.originalUrl ?? url.value,
        title: form.dataset.originalTitle ?? title.value,
    };
    const label = saveButton.innerHTML;
    let pending = false, submitting = false, destination = null, discarded = false;
    let validationNotice = false;

    function dirty() {
        return !discarded && (form.dataset.posted === 'true'
            || url.value !== initial.url || title.value !== initial.title);
    }

    function warn(message, error) {
        validationNotice = false;
        notice.textContent = message;
        notice.hidden = false;
        if (error) root.console.error(message, error);
    }

    function remember() {
        try {
            const state = {...root.history.state};
            if (discarded) delete state.sbMilestoneForm;
            else state.sbMilestoneForm = {
                key: form.dataset.formKey, url: url.value, title: title.value,
                scroll: reading.scrollTop,
            };
            root.history.replaceState(state, '');
        } catch (error) {
            warn('Could not preserve your milestone form for Back. Keep this page open.', error);
        }
    }

    function update() {
        status.textContent = pending ? 'Saving milestone...' : dirty() ? 'Unsaved changes'
            : form.dataset.posted === 'true' ? 'Not saved. Review the error above.'
            : form.dataset.formKey === 'new' ? 'New local milestone' : 'Existing milestone';
    }

    function restore() {
        pending = false;
        submitting = false;
        saveButton.disabled = false;
        saveButton.innerHTML = label;
        url.readOnly = false;
        title.readOnly = false;
        form.removeAttribute('aria-busy');
        const saved = root.history.state?.sbMilestoneForm;
        if (saved !== undefined && form.dataset.posted !== 'true') {
            try {
                const view = validateView(saved, form.dataset.formKey);
                url.value = view.url;
                title.value = view.title;
                reading.scrollTop = view.scroll;
            } catch (error) {
                warn('Could not restore your milestone form. Review the fields before saving.', error);
            }
        }
        update();
    }

    form.addEventListener('input', event => {
        discarded = false;
        if (event.target.validity?.valid) event.target.removeAttribute('aria-invalid');
        if (validationNotice && url.validity.valid && title.validity.valid) {
            notice.hidden = true;
            validationNotice = false;
        }
        update();
        remember();
    });
    form.addEventListener('invalid', event => {
        event.target.setAttribute('aria-invalid', 'true');
        warn(event.target.validationMessage || 'Review the required MSX URL before saving.');
        validationNotice = true;
    }, true);
    form.addEventListener('submit', event => {
        if (pending) { event.preventDefault(); return; }
        pending = true;
        submitting = true;
        remember();
        form.setAttribute('aria-busy', 'true');
        saveButton.disabled = true;
        url.readOnly = true;
        title.readOnly = true;
        saveButton.textContent = 'Saving milestone...';
        update();
    });
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0
            || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
            || link.target === '_blank' || link.hasAttribute('download')
            || link.getAttribute('href').startsWith('#')) return;
        if (!pending && !dirty()) return;
        event.preventDefault();
        if (pending) {
            warn('Saving milestone. Wait before leaving this form.');
            return;
        }
        destination = link.href;
        root.SBDialog.open(discard);
    });
    document.getElementById('milestoneFormDiscardConfirm').addEventListener('click', () => {
        if (pending || !destination) return;
        discarded = true;
        url.value = initial.url;
        title.value = initial.title;
        update();
        remember();
        root.SBDialog.close(discard, 'discard');
        root.location.assign(destination);
    });
    root.addEventListener('beforeunload', event => {
        if (submitting) { submitting = false; return; }
        if (discarded || (!dirty() && !pending)) return;
        event.preventDefault();
        event.returnValue = '';
    });
    root.addEventListener('pagehide', remember);
    root.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? globalThis : window);
