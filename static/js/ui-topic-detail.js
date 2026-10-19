/** Remembered topic views, entry-local reading context and guarded native deletion. */
((window) => {
    'use strict';
    const storageKey = 'salesbuddy_topic_detail_view';
    function validateView(value) {
        if (!['account', 'flat'].includes(value)) throw new Error('Invalid Topic view.');
        return value;
    }
    function validateHistory(value, id) {
        if (!value || value.id !== id || !Number.isFinite(value.top) || value.top < 0
            || !Number.isFinite(value.left) || value.left < 0
            || !Number.isFinite(value.description) || value.description < 0) {
            throw new Error('Invalid Topic reading history.');
        }
        if (value.view !== undefined) validateView(value.view);
        if (value.expanded !== undefined && (!Array.isArray(value.expanded)
            || value.expanded.some(key => typeof key !== 'string'
                || !/^(?:[1-9]\d*|unassigned)$/.test(key)))) {
            throw new Error('Invalid Topic account history.');
        }
        return value;
    }
    if (typeof module !== 'undefined') module.exports = {validateHistory, validateView};
    if (!window.document) return;
    function mount() {
        const root = window.document.querySelector('[data-topic-detail]');
        if (!root || root.dataset.mounted) return;
        root.dataset.mounted = 'true';
        const id = Number(root.dataset.topicDetail);
        const reading = root.querySelector('.topic-reading');
        const description = root.querySelector('.topic-description');
        const picker = root.querySelector('[data-topic-view]');
        const accounts = root.querySelector('[data-topic-accounts]');
        const flat = root.querySelector('[data-topic-flat]');
        const groups = [...root.querySelectorAll('[data-topic-account]')];
        const dialog = root.querySelector('#deleteTopicDialog');
        const form = dialog.querySelector('form');
        const status = form.querySelector('[data-topic-delete-status]');
        let pending = false;
        let restoring = false;
        function warn(message, error) {
            window.console.error(error);
            const notice = root.querySelector('.topic-notice');
            notice.textContent = message;
            notice.hidden = false;
        }
        function applyView(view, expanded = []) {
            picker.value = validateView(view);
            if (accounts) accounts.hidden = view !== 'account';
            if (flat) flat.hidden = view !== 'flat';
            groups.forEach(group => { group.open = expanded.includes(group.dataset.topicAccount); });
        }
        function save() {
            if (restoring) return;
            try {
                window.history.replaceState({...window.history.state, sbTopicDetail: {
                    id, top: reading.scrollTop, left: reading.scrollLeft,
                    description: description?.scrollTop || 0,
                    view: picker.value,
                    expanded: groups.filter(group => group.open)
                        .map(group => group.dataset.topicAccount),
                }}, '');
            } catch (error) {
                warn('Could not remember Topic context for Back.', error);
            }
        }
        function restore() {
            restoring = true;
            let view = 'account';
            try {
                const stored = window.localStorage.getItem(storageKey);
                if (stored !== null) view = validateView(stored);
            } catch (error) {
                warn('Could not restore your Topic view preference. You can still change views.',
                    error);
            }
            applyView(view);
            try {
                window.SBTableSort.mount(root);
                const saved = window.history.state?.sbTopicDetail;
                if (saved && saved.id === id) {
                    validateHistory(saved, id);
                    applyView(saved.view ?? view, saved.expanded ?? []);
                    reading.scrollTop = saved.top;
                    reading.scrollLeft = saved.left;
                    if (description) description.scrollTop = saved.description;
                }
            } catch (error) { warn('Could not restore Topic context for Back.', error); }
            restoring = false;
        }
        restore();
        picker.addEventListener('change', () => {
            applyView(picker.value);
            reading.scrollTop = 0;
            reading.scrollLeft = 0;
            try { window.localStorage.setItem(storageKey, picker.value); }
            catch (error) {
                warn('Could not remember your Topic view for future visits.', error);
            }
            save();
        });
        groups.forEach(group => group.addEventListener('toggle', save));
        [reading, description].filter(Boolean).forEach(node =>
            node.addEventListener('scroll', save, {passive: true}));
        root.addEventListener('click', event => {
            if (event.target.closest('a[href]')) {
                if (pending) event.preventDefault();
                else save();
                return;
            }
            if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey
                || event.shiftKey || event.altKey || pending
                || event.target.closest('button,input,select,summary')) return;
            const row = event.target.closest('[data-topic-note-href]');
            if (row) { save(); window.location.assign(row.dataset.topicNoteHref); }
        });
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (pending) event.preventDefault();
        });
        form.addEventListener('submit', event => {
            if (pending) { event.preventDefault(); return; }
            save();
            pending = true;
            form.querySelectorAll('button').forEach(button => { button.disabled = true; });
            status.textContent = 'Deleting topic...';
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
