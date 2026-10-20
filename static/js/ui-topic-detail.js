/** Remembered topic views, entry-local reading context and guarded native deletion. */
((window) => {
    'use strict';
    const storageKey = 'salesbuddy_topic_detail_view';
    function validateView(value) {
        if (!['account', 'flat'].includes(value)) throw new Error('Invalid Topic view.');
        return value;
    }
    function plainClick(event) {
        return !event.defaultPrevented && !(event.button > 0) && !event.ctrlKey
            && !event.metaKey && !event.shiftKey && !event.altKey;
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
    if (typeof module !== 'undefined') module.exports = {validateHistory, validateView, plainClick};
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
        const previews = new Map();
        function warn(message, error) {
            window.console.error(error);
            const notice = root.querySelector('.topic-notice');
            notice.textContent = message;
            notice.hidden = false;
        }
        function mountTables(container) {
            if (!container) return;
            container.querySelectorAll('[data-topic-sort-pending]').forEach(table => {
                table.setAttribute('data-sb-sortable', '');
                table.removeAttribute('data-topic-sort-pending');
            });
            window.SBTableSort.mount(container);
        }
        function setExpanded(group, expanded) {
            group.dataset.expanded = String(expanded);
            const button = group.querySelector('[data-topic-toggle]');
            button.setAttribute('aria-expanded', String(expanded));
            const name = group.querySelector('.topic-account-name').textContent.trim();
            button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} notes for ${name}`);
            group.querySelector('[data-topic-account-body]').hidden = !expanded;
            if (expanded) mountTables(group);
        }
        function applyView(view, expanded = []) {
            picker.value = validateView(view);
            root.classList.toggle('sb-directory-frame-wide', view === 'account');
            if (accounts) accounts.hidden = view !== 'account';
            if (flat) flat.hidden = view !== 'flat';
            groups.forEach(group => setExpanded(group,
                view === 'account' && expanded.includes(group.dataset.topicAccount)));
            if (view === 'flat') mountTables(flat);
        }
        function save() {
            if (restoring) return;
            try {
                window.history.replaceState({...window.history.state, sbTopicDetail: {
                    id, top: reading.scrollTop, left: reading.scrollLeft,
                    description: description?.scrollTop || 0,
                    view: picker.value,
                    expanded: groups.filter(group => group.dataset.expanded === 'true')
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
            let saved;
            try {
                saved = window.history.state?.sbTopicDetail;
                if (saved && saved.id === id) {
                    validateHistory(saved, id);
                } else saved = null;
            } catch (error) {
                saved = null;
                warn('Could not restore Topic context for Back.', error);
            }
            try {
                applyView(saved?.view ?? view, saved?.expanded ?? []);
                if (saved) {
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
        groups.forEach(group => group.querySelector('[data-topic-toggle]')
            .addEventListener('click', () => {
                try {
                    setExpanded(group, group.dataset.expanded !== 'true');
                    save();
                } catch (error) { warn("Could not sort this account's notes.", error); }
            }));
        [reading, description].filter(Boolean).forEach(node =>
            node.addEventListener('scroll', save, {passive: true}));
        root.addEventListener('click', event => {
            const link = event.target.closest('a[href]');
            if (link) {
                if (pending) event.preventDefault();
                else {
                    save();
                    if (link.dataset?.topicPreview && plainClick(event)) {
                        event.preventDefault();
                        openPreview(link);
                    }
                }
                return;
            }
            if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey
                || event.shiftKey || event.altKey || pending
                || event.target.closest('button,input,select,summary')) return;
            const row = event.target.closest('[data-topic-note-href]');
            if (row) { save(); window.location.assign(row.dataset.topicNoteHref); }
        });
        function openPreview(link) {
            const kind = link.dataset.topicPreview;
            try {
                if (!previews.has(kind)) {
                    const note = kind === 'note';
                    const label = note ? 'note' : 'account';
                    previews.set(kind, window.SBRecordDialog.create(
                        note ? 'topicNotePreview' : 'topicAccountPreview', {
                            statusText: `Open the full page to edit this ${label}.`,
                            errorText: `Unable to load this ${label}. Retry or open the full page.`,
                            loadUrl: recordId => note ? `/api/note/${recordId}/detail?topic_id=${id}` :
                                `/api/customer/${recordId}/info?view=preview`,
                            fullUrl: recordId => `/${note ? 'note' : 'customer'}/${recordId}`,
                            fragmentSelector: note ? '[data-sb-note-detail]' :
                                '[data-topic-customer-detail]',
                            identityAttribute: note ? 'data-sb-note-id' :
                                'data-topic-customer-detail',
                            mount: content => note ? window.SBNoteActions.mount(content) :
                                {dispose() {}, isDirty: () => false, isBusy: () => false},
                        }));
                }
                previews.get(kind).open({
                    id: Number(link.dataset.recordId), title: link.dataset.recordTitle,
                });
            } catch (error) { warn(`Could not open the ${kind} preview. Use the full-page link.`,
                error); }
        }
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
