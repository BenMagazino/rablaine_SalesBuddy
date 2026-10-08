/** Entry-local independent POD reading positions, using the shared native sorter. */
((window) => {
    'use strict';
    function validateHistory(value, id) {
        if (!value || value.id !== id || !value.scrolls
            || typeof value.scrolls !== 'object' || Array.isArray(value.scrolls)
            || Object.entries(value.scrolls).some(([key, offset]) =>
                !['coverage', 'personnel'].includes(key) || !Number.isFinite(offset) || offset < 0)) {
            throw new Error('Invalid POD reading history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateHistory};
    if (!window.document) return;
    function mount() {
        const root = window.document.querySelector('[data-pod-detail]');
        if (!root) return;
        const id = Number(root.dataset.podId);
        const regions = [...root.querySelectorAll('[data-pd-scroll]')];
        function warn(error) {
            window.console.error(error);
            const notice = window.document.getElementById('podFormNotice');
            notice.textContent = 'Could not restore or remember POD reading context for Back.';
            notice.hidden = false;
        }
        function save() {
            try {
                window.history.replaceState({...window.history.state, sbPodDetail: {
                    id, scrolls: Object.fromEntries(regions.map(node =>
                        [node.dataset.pdScroll, node.scrollTop])),
                }}, '');
            } catch (error) { warn(error); }
        }
        function restore() {
            try {
                window.SBTableSort.mount(root);
                const saved = window.history.state?.sbPodDetail;
                if (!saved || saved.id !== id) return;
                validateHistory(saved, id);
                regions.forEach(node => {
                    node.scrollTop = saved.scrolls[node.dataset.pdScroll] || 0;
                });
            } catch (error) { warn(error); }
        }
        restore();
        root.addEventListener('click', event => {
            if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey
                || event.shiftKey || event.altKey
                || event.target.closest('a,button,input,select')) return;
            const row = event.target.closest('[data-pd-href]');
            if (row) { save(); window.location.assign(row.dataset.pdHref); }
        });
        regions.forEach(node => node.addEventListener('scroll', save, {passive: true}));
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', restore);
    }
    if (window.document.readyState === 'loading') {
        window.document.addEventListener('DOMContentLoaded', mount, {once: true});
    } else mount();
})(typeof window === 'undefined' ? {} : window);
