/** Entry-local Search drafts and reading position; searches remain explicit GET submits. */
((window) => {
    'use strict';
    function validateContext(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0 ||
                !value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields) ||
                !Object.values(value.fields).every(values =>
                    Array.isArray(values) && values.every(v => typeof v === 'string'))) {
            throw new Error('Invalid Search reading context.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateContext};
    if (!window.document) return;
    const root = window.document.querySelector('[data-search-workbench]');
    if (!root) return;
    const reading = root.querySelector('.search-reading');
    const form = root.querySelector('form');
    const notice = root.querySelector('.search-notice');
    const fields = Array.from(form.querySelectorAll('input[name],select[name]'));
    let restoring = false;
    function warn(message, error) {
        window.console.error(message, error);
        notice.textContent = message;
        notice.hidden = false;
    }
    function save() {
        if (restoring) return;
        try {
            window.history.replaceState({...window.history.state, sbSearch: {
                top: reading.scrollTop, left: reading.scrollLeft,
                fields: Object.fromEntries(fields.map(field => [field.name,
                    field.tagName === 'SELECT' ?
                        Array.from(field.selectedOptions, o => o.value) : [field.value]])),
            }}, '');
        } catch (error) { warn('Could not remember Search context for Back.', error); }
    }
    function restore() {
        restoring = true;
        try {
            const saved = window.history.state?.sbSearch;
            if (saved) {
                validateContext(saved);
                for (const field of fields) {
                    const values = saved.fields[field.name];
                    if (!values) continue;
                    if (!field.multiple && values.length !== 1) {
                        throw new Error('Invalid saved Search control.');
                    }
                    if (field.tagName === 'SELECT') {
                        if (values.some(v => !Array.from(field.options).some(o => o.value === v))) {
                            throw new Error('A saved Search filter is no longer available.');
                        }
                    }
                }
                for (const field of fields) {
                    const values = saved.fields[field.name];
                    if (!values) continue;
                    if (field.tagName === 'SELECT') {
                        for (const option of field.options) option.selected = values.includes(option.value);
                    } else field.value = values[0] ?? '';
                }
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { warn('Could not restore Search context for Back.', error); }
        restoring = false;
    }
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('submit', save);
    root.addEventListener('click', event => {
        if (!event.defaultPrevented && event.target.closest('a[href]')) save();
    }, true);
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', restore);
    restore();
})(typeof window === 'undefined' ? {} : window);
