/** Entry-local specialty reading context and guarded native deletion. */
((window) => {
    'use strict';
    function validateHistory(value, id) {
        if (!value || value.id !== id || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0 ||
                !Number.isFinite(value.description) || value.description < 0) {
            throw new Error('Invalid Specialty reading history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateHistory};
    if (!window.document) return;
    function mount() {
        const root = window.document.querySelector('[data-specialty-detail]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const id = Number(root.dataset.specialtyDetail);
        const reading = root.querySelector('.specialty-reading');
        const description = root.querySelector('.specialty-description');
        const dialog = root.querySelector('#deleteSpecialtyDialog');
        const form = dialog.querySelector('form');
        const status = form.querySelector('[data-specialty-delete-status]');
        let pending = false;
        let restoring = false;
        function warn(error) {
            window.console.error('Specialty detail history:', error);
            const notice = root.querySelector('.specialty-notice');
            notice.textContent = 'Could not restore or remember Specialty context for Back.';
            notice.hidden = false;
        }
        function save() {
            if (restoring) return;
            try {
                window.history.replaceState({...window.history.state, sbSpecialtyDetail: {
                    id, top: reading.scrollTop, left: reading.scrollLeft,
                    description: description?.scrollTop || 0,
                }}, '');
            } catch (error) { warn(error); }
        }
        function restore() {
            restoring = true;
            try {
                window.SBTableSort.mount(root);
                const saved = window.history.state?.sbSpecialtyDetail;
                if (saved && saved.id === id) {
                    validateHistory(saved, id);
                    reading.scrollTop = saved.top;
                    reading.scrollLeft = saved.left;
                    if (description) description.scrollTop = saved.description;
                }
            } catch (error) { warn(error); }
            restoring = false;
        }
        restore();
        [reading, description].filter(Boolean).forEach(node =>
            node.addEventListener('scroll', save, {passive: true}));
        window.document.addEventListener('click', event => {
            if (!event.target.closest('a[href]') || event.defaultPrevented) return;
            if (pending) event.preventDefault();
            else save();
        }, true);
        root.addEventListener('click', event => {
            if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                    event.shiftKey || event.altKey || pending ||
                    event.target.closest('a,button,input,select')) return;
            const row = event.target.closest('[data-specialty-partner-href]');
            if (row) { save(); window.location.assign(row.dataset.specialtyPartnerHref); }
        });
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (pending) event.preventDefault();
        });
        form.addEventListener('submit', event => {
            if (pending) { event.preventDefault(); return; }
            save();
            pending = true;
            form.querySelectorAll('button').forEach(button => { button.disabled = true; });
            status.textContent = 'Deleting specialty...';
        });
        window.addEventListener('beforeunload', event => {
            if (!pending) return;
            event.preventDefault();
            event.returnValue = '';
        });
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', () => {
            pending = false;
            form.querySelectorAll('button').forEach(button => { button.disabled = false; });
            status.textContent = '';
            restore();
        });
    }
    if (window.document.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})(typeof window === 'undefined' ? {} : window);
