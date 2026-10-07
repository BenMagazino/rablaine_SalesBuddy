/** Shared manual milestone/project/customer POST lifecycle with entry-local drafts. */
(function (root) {
    'use strict';

    function validateView(value, key) {
        if (!value || value.key !== key || typeof value.url !== 'string'
            || typeof value.title !== 'string' || !Number.isFinite(value.scroll)
            || value.scroll < 0) throw new Error('Invalid milestone form history.');
        return value;
    }

    function validateProjectView(value, key, fields) {
        if (!value || value.key !== key || !value.fields
            || fields.some(name => typeof value.fields[name] !== 'string')
            || !Array.isArray(value.checked) || value.checked.some(id => typeof id !== 'string')
            || !Number.isFinite(value.scroll) || value.scroll < 0
            || !Number.isFinite(value.noteScroll) || value.noteScroll < 0) {
            throw new Error('Invalid project form history.');
        }
        return value;
    }
    function validateCustomerView(value, key, fields) {
        validateProjectView(value, key, fields);
        if (typeof value.sellerName !== 'string' || !Array.isArray(value.hiddenOptions)
            || value.hiddenOptions.some(option => typeof option !== 'string')) {
            throw new Error('Invalid customer form history.');
        }
        return value;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {validateView, validateProjectView, validateCustomerView};
    }
    if (!root.document) return;
    const document = root.document;
    const customer = document.getElementById('customerForm');
    const project = document.getElementById('projectForm');
    const form = customer || project || document.getElementById('milestoneForm');
    if (!form) return;
    const record = project || customer;
    const prefix = customer ? 'customerForm' : project ? 'projectForm' : 'milestoneForm';
    const noun = customer ? 'customer' : project ? 'project' : 'milestone';
    const historyKey = customer ? 'sbCustomerForm' : project ? 'sbProjectForm' : 'sbMilestoneForm';
    const fields = customer ? ['referrer', 'name', 'nickname', 'tpid', 'tpid_url', 'website',
        'seller_id', 'territory_id', ...(form.elements.csam_id ? ['csam_id'] : [])]
        : project ? ['title', 'description', 'project_type', 'due_date',
        ...(form.elements.status ? ['status'] : [])] : ['url', 'title'];
    const checkboxes = project ? [...form.querySelectorAll('[name="note_ids"]')] : [];
    const choices = project ? form.querySelector('.pf-choices') : null;
    const url = form.elements.url, title = form.elements.title;
    const reading = form.querySelector('[data-sb-page-body]');
    const saveButton = document.getElementById(prefix + 'Save');
    const status = document.getElementById(prefix + 'State');
    const notice = document.getElementById(prefix + 'Notice');
    const discard = document.getElementById(prefix + 'Discard');
    const sellerForm = customer ? document.querySelector('#newSellerModal form') : null;
    function snapshot() {
        return record ? {key: form.dataset.formKey,
            fields: Object.fromEntries(fields.map(name => [name, form.elements[name].value])),
            checked: checkboxes.filter(box => box.checked).map(box => box.id),
            scroll: reading.scrollTop, noteScroll: choices?.scrollTop ?? 0,
            ...(customer ? {sellerName: sellerForm.elements.name.value,
                hiddenOptions: fields.flatMap(name => [...(form.elements[name].options ?? [])]
                    .filter(option => option.style.display === 'none')
                    .map(option => name + ':' + option.value))} : {})}
            : {key: form.dataset.formKey, url: url.value, title: title.value,
                scroll: reading.scrollTop};
    }
    const initial = record ? snapshot() : {
        url: form.dataset.originalUrl ?? url.value,
        title: form.dataset.originalTitle ?? title.value,
    };
    if (customer) {
        initial.fields = Object.fromEntries(fields.map(name => {
            const field = form.elements[name];
            const original = field.options
                ? [...field.options].find(option => option.defaultSelected)?.value
                    ?? field.options[0]?.value ?? ''
                : field.defaultValue ?? field.value;
            return [name, original];
        }));
        initial.sellerName = sellerForm.elements.name.defaultValue ?? '';
    }
    function apply(value) {
        if (record) {
            fields.forEach(name => { form.elements[name].value = value.fields[name]; });
            checkboxes.forEach(box => { box.checked = value.checked.includes(box.id); });
            if (choices) choices.scrollTop = value.noteScroll;
            if (customer) {
                sellerForm.elements.name.value = typeof value.sellerName === 'string'
                    ? value.sellerName : '';
                fields.forEach(name => {
                    [...(form.elements[name].options ?? [])].forEach(option => {
                        option.style.display = value.hiddenOptions?.includes(
                            name + ':' + option.value) ? 'none' : '';
                    });
                });
                ['seller-auto-msg', 'territory-auto-msg'].forEach(id => {
                    const message = document.getElementById(id);
                    if (message) message.style.display = 'none';
                });
                form.dataset.draftRestored = 'true';
            }
        } else {
            url.value = value.url;
            title.value = value.title;
        }
        reading.scrollTop = value.scroll ?? 0;
    }
    const label = saveButton.innerHTML;
    let pending = false, submitting = false, destination = null, discarded = false;
    let validationNotice = false;

    function dirty() {
        return !discarded && (form.dataset.posted === 'true'
            || (customer && sellerForm.elements.name.value !== initial.sellerName)
            || (record ? JSON.stringify([snapshot().fields, snapshot().checked])
                !== JSON.stringify([initial.fields, initial.checked])
                : url.value !== initial.url || title.value !== initial.title));
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
            if (discarded) delete state[historyKey];
            else state[historyKey] = snapshot();
            root.history.replaceState(state, '');
        } catch (error) {
            warn(`Could not preserve your ${noun} form for Back. Keep this page open.`, error);
        }
    }

    function update() {
        status.textContent = pending ? `Saving ${noun}...` : dirty() ? 'Unsaved changes'
            : form.dataset.posted === 'true' ? 'Not saved. Review the error above.'
            : form.dataset.formKey.startsWith('new') ? customer ? 'New customer' : project ? 'New project' : 'New local milestone'
            : `Existing ${noun}`;
        if (record) form.inert = pending;
    }

    function restore() {
        pending = false;
        submitting = false;
        saveButton.disabled = false;
        saveButton.innerHTML = label;
        if (url) url.readOnly = false;
        if (title) title.readOnly = false;
        form.removeAttribute('aria-busy');
        if (sellerForm) {
            sellerForm.removeAttribute('aria-busy');
            sellerForm.querySelector('[type="submit"]').disabled = false;
        }
        const saved = root.history.state?.[historyKey];
        if (saved !== undefined && form.dataset.posted !== 'true') {
            try {
                const view = customer ? validateCustomerView(saved, form.dataset.formKey, fields)
                    : record ? validateProjectView(saved, form.dataset.formKey, fields)
                    : validateView(saved, form.dataset.formKey);
                apply(view);
            } catch (error) {
                warn(`Could not restore your ${noun} form. Review the fields before saving.`, error);
            }
        }
        update();
    }

    function changed(event) {
        discarded = false;
        if (event.target.validity?.valid) event.target.removeAttribute('aria-invalid');
        if (validationNotice && fields.every(name => form.elements[name].validity.valid)) {
            notice.hidden = true;
            validationNotice = false;
        }
        update();
        remember();
    }
    form.addEventListener('input', changed);
    if (record) form.addEventListener('change', changed);
    if (record) [reading, choices].filter(Boolean).forEach(region =>
        region.addEventListener('scroll', remember, {passive: true}));
    form.addEventListener('invalid', event => {
        event.target.setAttribute('aria-invalid', 'true');
        warn(event.target.validationMessage || (project ? 'Review the required title before saving.'
            : 'Review the required MSX URL before saving.'));
        validationNotice = true;
    }, true);
    form.addEventListener('submit', event => {
        if (pending) { event.preventDefault(); return; }
        pending = true;
        submitting = true;
        remember();
        form.setAttribute('aria-busy', 'true');
        saveButton.disabled = true;
        if (url) url.readOnly = true;
        if (title) title.readOnly = true;
        saveButton.textContent = `Saving ${noun}...`;
        update();
    });
    if (customer) {
        sellerForm.addEventListener('input', () => {
            discarded = false;
            update();
            remember();
        });
        sellerForm.addEventListener('submit', event => {
            if (pending) { event.preventDefault(); return; }
            pending = submitting = true;
            remember();
            sellerForm.setAttribute('aria-busy', 'true');
            sellerForm.querySelector('[type="submit"]').disabled = true;
            update();
        });
    }
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0
            || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
            || link.target === '_blank' || link.hasAttribute('download')
            || link.getAttribute('href').startsWith('#')) return;
        if (!pending && !dirty()) return;
        event.preventDefault();
        if (pending) {
            warn(`Saving ${noun}. Wait before leaving this form.`);
            return;
        }
        destination = link.href;
        root.SBDialog.open(discard);
    });
    document.getElementById(prefix + 'DiscardConfirm').addEventListener('click', () => {
        if (pending || !destination) return;
        discarded = true;
        apply(initial);
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
