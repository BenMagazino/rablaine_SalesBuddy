/** Native POST and entry-local drafts, following the manual milestone form lifecycle. */
(function (root) {
    'use strict';
    const fields = ['title', 'status', 'technical_problem', 'business_impact',
        'solution_resources', 'estimated_acr', 'target_date'];
    const types = ['customer_contact', 'partner_contact', 'se', 'seller',
        'internal_contact', 'external'];
    function validateView(value, key) {
        if (!value || value.key !== key || !value.fields
            || fields.some(name => typeof value.fields[name] !== 'string')
            || !Array.isArray(value.checked) || value.checked.some(id => typeof id !== 'string')
            || !Array.isArray(value.contacts) || value.contacts.some(contact =>
                !types.includes(contact.type) || ['id', 'name', 'email'].some(
                    name => typeof contact[name] !== 'string'))
            || !Array.isArray(value.scroll) || value.scroll.length !== 2
            || value.scroll.some(n => !Number.isFinite(n) || n < 0)
            || !value.choiceScroll || Array.isArray(value.choiceScroll)
            || typeof value.choiceScroll !== 'object'
            || Object.entries(value.choiceScroll).some(([field, n]) =>
                !['note_ids', 'opportunity_ids', 'milestone_ids'].includes(field)
                || !Number.isFinite(n) || n < 0)) {
            throw new Error('Invalid engagement form history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateView, fields};
    if (!root.document) return;
    const document = root.document, form = document.getElementById('engagementForm');
    if (!form) return;
    const save = document.getElementById('engagementFormSave');
    const state = document.getElementById('engagementFormState');
    const notice = document.getElementById('engagementFormNotice');
    const discard = document.getElementById('engagementFormDiscard');
    const contacts = document.getElementById('selected_contacts');
    const reading = [...form.querySelectorAll('.ef-reading')];
    const choices = [...form.querySelectorAll('.ef-choices')];
    const checkboxes = [...form.querySelectorAll('input[type="checkbox"]')];
    const label = save.innerHTML;
    let pending = false, contactPending = false, submitting = false, discarded = false;
    let destination = null, validationNotice = false;
    function snapshot() {
        return {key: form.dataset.formKey,
            fields: Object.fromEntries(fields.map(name => [name, form.elements[name].value])),
            checked: checkboxes.filter(box => box.checked).map(box => box.id),
            contacts: [...contacts.querySelectorAll('.ef-contact')].map(contact => ({
                type: contact.dataset.contactType, id: contact.dataset.contactId,
                name: contact.querySelector('[name="contact_ext_names"]')?.value
                    ?? [...contact.childNodes].filter(node => node.nodeType === 3)
                        .map(node => node.textContent).join('').trim(),
                email: contact.querySelector('[name="contact_ext_emails"]')?.value ?? '',
            })),
            scroll: reading.map(region => region.scrollTop),
            choiceScroll: Object.fromEntries(choices.map(region =>
                [region.dataset.linkField, region.scrollTop]))};
    }
    const initial = snapshot();
    function signature(value) {
        return JSON.stringify([value.fields, value.checked, value.contacts]);
    }
    function dirty() {
        return !discarded && (form.dataset.posted === 'true'
            || signature(snapshot()) !== signature(initial));
    }
    function warn(message, error) {
        notice.textContent = message;
        notice.hidden = false;
        validationNotice = false;
        if (error) root.console.error(message, error);
    }
    function remember() {
        try {
            const history = {...root.history.state};
            if (discarded) delete history.sbEngagementForm;
            else history.sbEngagementForm = snapshot();
            root.history.replaceState(history, '');
        } catch (error) {
            warn('Could not preserve this form for Back. Keep this page open.', error);
        }
    }
    function update() {
        state.textContent = pending ? 'Saving engagement...' : contactPending ? 'Adding contact...'
            : dirty() ? 'Unsaved changes' : form.dataset.formKey.startsWith('edit-')
                ? 'Existing engagement' : 'New engagement';
        save.disabled = pending || contactPending;
        form.inert = pending || contactPending;
    }
    function apply(value) {
        fields.forEach(name => { form.elements[name].value = value.fields[name]; });
        checkboxes.forEach(box => { box.checked = value.checked.includes(box.id); });
        contacts.replaceChildren();
        const icons = ['bi-person-circle', 'bi-building', 'bi-tools', 'bi-person',
            'bi-person-badge', 'bi-person-dash'];
        value.contacts.forEach(contact => {
            const tag = document.createElement('span');
            tag.className = 'ef-contact';
            tag.dataset.contactType = contact.type;
            tag.dataset.contactId = contact.id;
            const icon = document.createElement('i');
            icon.className = 'bi ' + icons[types.indexOf(contact.type)];
            icon.setAttribute('aria-hidden', 'true');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ef-contact-remove';
            button.textContent = '×';
            button.setAttribute('aria-label', 'Remove ' + contact.name);
            button.addEventListener('click', () => root.removeContact(button));
            tag.append(icon, document.createTextNode(contact.name), button);
            const payload = {contact_types: contact.type, contact_ref_ids: contact.id};
            if (contact.type === 'external') {
                payload.contact_ext_names = contact.name;
                payload.contact_ext_emails = contact.email;
            }
            Object.entries(payload).forEach(([name, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden'; input.name = name; input.value = value;
                tag.append(input);
            });
            contacts.append(tag);
        });
        reading.forEach((region, index) => { region.scrollTop = value.scroll[index]; });
        choices.forEach(region => {
            region.scrollTop = value.choiceScroll[region.dataset.linkField] ?? 0;
        });
    }
    function restore() {
        pending = contactPending = submitting = false;
        form.removeAttribute('aria-busy');
        save.innerHTML = label;
        const deleteButton = document.querySelector('#engagementDeleteForm button[type="submit"]');
        if (deleteButton) deleteButton.disabled = false;
        const saved = root.history.state?.sbEngagementForm;
        if (saved !== undefined && form.dataset.posted !== 'true') {
            try { apply(validateView(saved, form.dataset.formKey)); }
            catch (error) { warn('Could not restore this form. Review the fields before saving.', error); }
        }
        update();
    }
    function changed(event) {
        if (event.target.id === 'contact_search') return;
        discarded = false;
        if (event.target.validity?.valid) event.target.removeAttribute('aria-invalid');
        if (validationNotice && form.checkValidity()) {
            notice.hidden = true;
            validationNotice = false;
        }
        update();
        remember();
    }
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);
    [...reading, ...choices].forEach(region =>
        region.addEventListener('scroll', remember, {passive: true}));
    form.addEventListener('invalid', event => {
        event.target.setAttribute('aria-invalid', 'true');
        warn(event.target.validationMessage || 'Review the highlighted field before saving.');
        validationNotice = true;
    }, true);
    form.addEventListener('submit', event => {
        if (pending || contactPending) { event.preventDefault(); return; }
        remember();
        pending = submitting = true;
        form.setAttribute('aria-busy', 'true');
        save.textContent = 'Saving engagement...';
        update();
    });
    form.addEventListener('sb:engagement-contact-pending', event => {
        contactPending = event.detail;
        update();
    });
    form.addEventListener('sb:engagement-contact-error', event => warn(event.detail));
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0
            || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
            || link.target === '_blank' || link.hasAttribute('download')
            || link.getAttribute('href').startsWith('#')) return;
        if (!pending && !contactPending && !dirty()) return;
        event.preventDefault();
        if (pending || contactPending) { warn('Saving. Wait before leaving this form.'); return; }
        destination = link.href;
        root.SBDialog.open(discard);
    });
    document.getElementById('engagementFormDiscardConfirm').addEventListener('click', () => {
        if (pending || contactPending || !destination) return;
        discarded = true;
        apply(initial);
        update();
        remember();
        root.SBDialog.close(discard, 'discard');
        root.location.assign(destination);
    });
    document.getElementById('engagementDeleteOpen')?.addEventListener('click', () => {
        if (!pending && !contactPending) root.SBDialog.open('engagementDeleteDialog');
    });
    document.getElementById('engagementDeleteForm')?.addEventListener('submit', event => {
        if (pending || contactPending) { event.preventDefault(); return; }
        pending = submitting = true;
        event.target.querySelector('button[type="submit"]').disabled = true;
        update();
    });
    root.addEventListener('beforeunload', event => {
        if (submitting) { submitting = false; return; }
        if (discarded || (!dirty() && !pending && !contactPending)) return;
        event.preventDefault(); event.returnValue = '';
    });
    root.addEventListener('pagehide', remember);
    root.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? globalThis : window);
