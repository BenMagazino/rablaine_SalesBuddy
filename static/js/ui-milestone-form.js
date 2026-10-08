/** Shared manual record POST lifecycle with entry-local drafts. */
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
    function validateSellerView(value, key, fields) {
        validateProjectView(value, key, fields);
        if (typeof value.territoryName !== 'string' || typeof value.territorySearch !== 'string') {
            throw new Error('Invalid seller form history.');
        }
        return value;
    }
    function validateTemplateView(value, key, fields) {
        validateProjectView(value, key, fields);
        const editor = value.editor;
        if (!editor || !Number.isFinite(editor.scroll) || editor.scroll < 0
            || (editor.selection !== null && (!editor.selection
                || !Number.isInteger(editor.selection.index) || editor.selection.index < 0
                || !Number.isInteger(editor.selection.length) || editor.selection.length < 0))) {
            throw new Error('Invalid template editor history.');
        }
        return value;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {validateView, validateProjectView, validateCustomerView,
            validateSellerView, validateTemplateView};
    }
    if (!root.document) return;
    const document = root.document;
    const customer = document.getElementById('customerForm');
    const project = document.getElementById('projectForm');
    const seller = document.getElementById('sellerForm');
    const territory = document.getElementById('territoryForm');
    const engineer = document.getElementById('seForm');
    const contact = document.getElementById('icForm');
    const topic = document.getElementById('topicForm');
    const specialty = document.getElementById('specialtyForm');
    const partner = document.getElementById('partnerForm');
    const template = document.getElementById('templateForm');
    const form = customer || project || seller || territory || engineer || contact
        || topic || specialty || partner || template || document.getElementById('milestoneForm');
    if (!form) return;
    const record = project || customer || seller || territory || engineer || contact
        || topic || specialty || partner || template;
    const prefix = customer ? 'customerForm' : project ? 'projectForm'
        : seller ? 'sellerForm' : territory ? 'territoryForm' : engineer ? 'seForm'
        : contact ? 'icForm' : topic ? 'topicForm' : specialty ? 'specialtyForm'
        : partner ? 'partnerForm' : template ? 'templateForm' : 'milestoneForm';
    const noun = customer ? 'customer' : project ? 'project' : seller ? 'seller'
        : territory ? 'territory' : engineer ? 'solution engineer'
        : contact ? 'internal contact' : topic ? 'topic' : specialty ? 'specialty'
        : partner ? 'partner' : template ? 'template' : 'milestone';
    const historyKey = customer ? 'sbCustomerForm' : project ? 'sbProjectForm'
        : seller ? 'sbSellerForm' : territory ? 'sbTerritoryForm'
        : engineer ? 'sbSEForm' : contact ? 'sbICForm' : topic ? 'sbTopicForm'
        : specialty ? 'sbSpecialtyForm' : partner ? 'sbPartnerForm'
        : template ? 'sbTemplateForm' : 'sbMilestoneForm';
    const fields = customer ? ['referrer', 'name', 'nickname', 'tpid', 'tpid_url', 'website',
        'seller_id', 'territory_id', ...(form.elements.csam_id ? ['csam_id'] : [])]
        : engineer ? ['name', 'alias', 'specialty'] : contact ? ['name', 'alias', 'role']
        : partner ? ['name', 'website', 'rating', 'overview', 'specialty_search']
        : template ? ['name', 'content']
        : topic || specialty ? ['name', 'description'] : territory ? ['name']
        : seller ? ['name', 'alias', 'seller_type'] : project
        ? ['title', 'description', 'project_type', 'due_date',
        ...(form.elements.status ? ['status'] : [])] : ['url', 'title'];
    const checkboxes = project || engineer
        ? [...form.querySelectorAll(engineer ? '[name="pod_ids"]' : '[name="note_ids"]')] : [];
    const choices = project ? form.querySelector('.pf-choices')
        : engineer ? form.querySelector('.sef-choices') : null;
    const url = form.elements.url, title = form.elements.title;
    const reading = form.querySelector('[data-sb-page-body]');
    const saveButton = document.getElementById(prefix + 'Save');
    const status = document.getElementById(prefix + 'State');
    const notice = document.getElementById(prefix + 'Notice');
    const discard = document.getElementById(prefix + 'Discard');
    const sellerForm = customer ? document.querySelector('#newSellerModal form')
        : seller ? document.querySelector('#newTerritoryModal form') : null;
    const territorySearch = seller ? document.getElementById('territory_search') : null;
    const deleteForm = contact ? document.getElementById('icFormDeletePost') : null;
    function snapshot() {
        return record ? {key: form.dataset.formKey,
            fields: Object.fromEntries(fields.map(name => [name, form.elements[name].value])),
            checked: partner ? root.SBPartnerSpecialties.ids() : seller ? root.SBSellerTerritories.ids()
                : checkboxes.filter(box => box.checked).map(box => box.id),
            scroll: reading.scrollTop, noteScroll: choices?.scrollTop ?? 0,
            ...(template ? {editor: root.SBTemplateEditor.view()} : {}),
            ...(customer ? {sellerName: sellerForm.elements.name.value,
                hiddenOptions: fields.flatMap(name => [...(form.elements[name].options ?? [])]
                    .filter(option => option.style.display === 'none')
                    .map(option => name + ':' + option.value))} : {}),
            ...(seller ? {territoryName: sellerForm.elements.name.value,
                territorySearch: territorySearch.value} : {})}
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
            if (template) root.SBTemplateEditor.restore(value.editor);
            checkboxes.forEach(box => { box.checked = value.checked.includes(box.id); });
            if (choices) choices.scrollTop = value.noteScroll;
            if (partner) root.SBPartnerSpecialties.restore(value.checked);
            if (seller) {
                root.SBSellerTerritories.restore(value.checked);
                sellerForm.elements.name.value = value.territoryName;
                territorySearch.value = value.territorySearch;
            }
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
    let historyTimer = null;

    function dirty() {
        return !discarded && (form.dataset.posted === 'true'
            || (customer && sellerForm.elements.name.value !== initial.sellerName)
            || (seller && (sellerForm.elements.name.value !== initial.territoryName
                || territorySearch.value !== initial.territorySearch))
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
        if (historyTimer !== null) {
            root.clearTimeout(historyTimer);
            historyTimer = null;
        }
        try {
            const state = {...root.history.state};
            if (discarded) delete state[historyKey];
            else state[historyKey] = snapshot();
            root.history.replaceState(state, '');
        } catch (error) {
            warn(`Could not preserve your ${noun} form for Back. Keep this page open.`, error);
        }
    }
    function queueRemember() {
        if (!template) { remember(); return; }
        if (historyTimer !== null) root.clearTimeout(historyTimer);
        historyTimer = root.setTimeout(remember, 200);
    }

    function update() {
        status.textContent = pending ? `Saving ${noun}...` : dirty() ? 'Unsaved changes'
            : form.dataset.posted === 'true' ? 'Not saved. Review the error above.'
            : form.dataset.formKey.startsWith('new') ? customer ? 'New customer'
            : project ? 'New project' : seller ? 'New seller' : territory ? 'New territory'
            : contact ? 'New internal contact' : topic ? 'New topic'
            : specialty ? 'New specialty'
            : partner ? 'New partner' : template ? 'New template' : 'New local milestone'
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
        if (deleteForm) {
            deleteForm.inert = false;
            deleteForm.removeAttribute('aria-busy');
            deleteForm.querySelector('[type="submit"]').disabled = false;
        }
        if (sellerForm) {
            sellerForm.removeAttribute('aria-busy');
            sellerForm.querySelector('[type="submit"]').disabled = false;
        }
        const saved = root.history.state?.[historyKey];
        if (saved !== undefined && form.dataset.posted !== 'true') {
            try {
                const view = customer ? validateCustomerView(saved, form.dataset.formKey, fields)
                    : seller ? validateSellerView(saved, form.dataset.formKey, fields)
                    : template ? validateTemplateView(saved, form.dataset.formKey, fields)
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
        queueRemember();
    }
    form.addEventListener('input', changed);
    if (template) form.addEventListener('sb:template-view', queueRemember);
    if (partner) form.addEventListener('sb:partner-pending', event => {
        pending = event.detail;
        saveButton.disabled = pending;
        form.toggleAttribute('aria-busy', pending);
        update();
        if (pending) status.textContent = 'Creating specialty...';
    });
    if (record) form.addEventListener('change', changed);
    if (record) [reading, choices].filter(Boolean).forEach(region =>
        region.addEventListener('scroll', queueRemember, {passive: true}));
    form.addEventListener('invalid', event => {
        event.target.setAttribute('aria-invalid', 'true');
        warn(event.target.validationMessage || (seller ? 'Review the required seller name before saving.'
            : territory ? 'Review the required territory name before saving.'
            : engineer || contact || topic || specialty || partner
                ? 'Review the required name before saving.'
            : project ? 'Review the required title before saving.'
            : 'Review the required MSX URL before saving.'));
        validationNotice = true;
    }, true);
    form.addEventListener('submit', event => {
        if (event.defaultPrevented) return;
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
    if (deleteForm) deleteForm.addEventListener('submit', event => {
        if (pending) { event.preventDefault(); return; }
        pending = submitting = true;
        remember();
        deleteForm.setAttribute('aria-busy', 'true');
        deleteForm.querySelector('[type="submit"]').disabled = true;
        deleteForm.inert = true;
        update();
        status.textContent = 'Deleting internal contact...';
    });
    if (deleteForm) document.addEventListener('sb:dialog-before-close', event => {
        if (pending && event.target.id === 'icFormDelete') event.preventDefault();
    });
    if (customer || seller) {
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
    if (territory || engineer || contact || topic || specialty || partner || template) document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.defaultPrevented
            && !document.querySelector('dialog[open]')) {
            event.preventDefault();
            if (template && event.target.closest?.('.ql-editor,.ql-toolbar')) return;
            form.querySelector(template ? '[data-template-cancel]'
                : partner ? '[data-partner-cancel]' : topic ? '[data-topic-cancel]'
                : specialty ? '[data-specialty-cancel]'
                : contact ? '[data-ic-cancel]'
                : engineer ? '[data-se-cancel]' : '[data-territory-cancel]').click();
        }
    });
    root.addEventListener('beforeunload', event => {
        if (template) remember();
        if (submitting) { submitting = false; return; }
        if (discarded || (!dirty() && !pending)) return;
        event.preventDefault();
        event.returnValue = '';
    });
    root.addEventListener('pagehide', remember);
    root.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? globalThis : window);
