/** Entry-local SE coverage context and guarded native deletion. */
((window) => {
    'use strict';
    function validateHistory(value, id) {
        if (!value || value.id !== id || !value.scrolls
            || typeof value.scrolls !== 'object' || Array.isArray(value.scrolls)
            || Object.entries(value.scrolls).some(([key, offset]) =>
                !['pods', 'territories'].includes(key) || !Number.isFinite(offset) || offset < 0)) {
            throw new Error('Invalid Solution Engineer reading history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateHistory};
    if (!window.document) return;
    function mount() {
        const root = window.document.querySelector('[data-se-detail]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const id = Number(root.dataset.seDetail);
        const regions = [...root.querySelectorAll('[data-sed-scroll]')];
        const dialog = root.querySelector('#seDeleteDialog');
        const form = dialog.querySelector('form');
        let pending = false;
        function warn(error) {
            window.console.error(error);
            const notice = root.querySelector('.sed-notice');
            notice.textContent = 'Could not restore or remember Solution Engineer context for Back.';
            notice.hidden = false;
        }
        function save() {
            try {
                window.history.replaceState({...window.history.state, sbSeDetail: {
                    id, scrolls: Object.fromEntries(regions.map(node =>
                        [node.dataset.sedScroll, node.scrollTop])),
                }}, '');
            } catch (error) { warn(error); }
        }
        function restore() {
            try {
                window.SBTableSort.mount(root);
                const saved = window.history.state?.sbSeDetail;
                if (!saved || saved.id !== id) return;
                validateHistory(saved, id);
                regions.forEach(node => {
                    node.scrollTop = saved.scrolls[node.dataset.sedScroll] || 0;
                });
            } catch (error) { warn(error); }
        }
        restore();
        regions.forEach(node => node.addEventListener('scroll', save, {passive: true}));
        root.addEventListener('click', event => {
            if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey
                || event.shiftKey || event.altKey
                || event.target.closest('a,button,input,select')) return;
            const row = event.target.closest('[data-sed-href]');
            if (row) { save(); window.location.assign(row.dataset.sedHref); }
        });
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (pending) event.preventDefault();
        });
        form.addEventListener('submit', event => {
            if (pending) { event.preventDefault(); return; }
            save();
            pending = true;
            form.querySelectorAll('button').forEach(button => { button.disabled = true; });
            form.querySelector('[data-sed-delete-status]').textContent = 'Deleting solution engineer...';
        });
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', () => {
            pending = false;
            form.querySelectorAll('button').forEach(button => { button.disabled = false; });
            form.querySelector('[data-sed-delete-status]').textContent = '';
            restore();
        });
    }
    if (window.document.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})(typeof window === 'undefined' ? {} : window);
