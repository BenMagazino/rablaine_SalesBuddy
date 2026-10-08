/** Entry-local directory reading context and explicit native deletion. */
((window) => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0) {
            throw new Error('Invalid Internal Contacts directory reading context.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateReading};
    if (!window.document) return;
    const root = window.document.querySelector('[data-ic-directory]');
    if (!root) return;
    const reading = root.querySelector('.ic-reading');
    const notice = root.querySelector('.ic-notice');
    const dialog = root.querySelector('#icDeleteDialog');
    const form = dialog.querySelector('form');
    let pending = false;
    let restoring = false;
    function warn(error) {
        window.console.error(error);
        notice.textContent = 'Could not restore or remember Internal Contacts context for Back.';
        notice.hidden = false;
    }
    function save() {
        if (restoring) return;
        try {
            window.history.replaceState({...window.history.state, sbICDirectory: {
                top: reading.scrollTop, left: reading.scrollLeft,
            }}, '');
        } catch (error) { warn(error); }
    }
    function restore() {
        restoring = true;
        try {
            window.SBTableSort?.mount(root);
            const saved = window.history.state?.sbICDirectory;
            if (saved) {
                validateReading(saved);
                reading.scrollTop = saved.top;
                reading.scrollLeft = saved.left;
            }
        } catch (error) { warn(error); }
        restoring = false;
    }
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey) return;
        const deletion = event.target.closest('[data-ic-delete-url]');
        if (deletion) {
            form.action = deletion.dataset.icDeleteUrl;
            dialog.querySelector('[data-ic-delete-identity]').textContent =
                deletion.dataset.icDeleteName;
            window.SBDialog.open(dialog);
            return;
        }
        if (event.target.closest('a,button,input')) return;
        const row = event.target.closest('[data-ic-href]');
        if (row) { save(); window.location.assign(row.dataset.icHref); }
    });
    dialog.addEventListener('sb:dialog-before-close', event => {
        if (pending) event.preventDefault();
    });
    form.addEventListener('submit', event => {
        if (pending || !form.getAttribute('action')) { event.preventDefault(); return; }
        save();
        pending = true;
        form.querySelectorAll('button').forEach(button => { button.disabled = true; });
        form.querySelector('[data-ic-delete-status]').textContent = 'Deleting contact...';
    });
    window.document.addEventListener('click', event => {
        if (event.target.closest('a[href]') && !event.defaultPrevented) save();
    }, true);
    reading.addEventListener('scroll', save, {passive: true});
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', () => {
        pending = false;
        form.querySelectorAll('button').forEach(button => { button.disabled = false; });
        form.querySelector('[data-ic-delete-status]').textContent = '';
        restore();
    });
    restore();
})(typeof window === 'undefined' ? {} : window);
