/** Scoped project dossier, manual task writes and native nested-parent lifecycle. */
((window) => {
    'use strict';
    if (window.SBProjectDetail) return;
    const mounted = new WeakMap();

    function validateHistory(value, id) {
        if (!value || value.id !== id || !Number.isFinite(value.top) || value.top < 0) {
            throw new Error('Invalid project reading history.');
        }
        return value;
    }

    async function addTask(id, payload) {
        const response = await window.fetch('/api/project/' + id + '/action-item', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || result.success !== true ||
                !Number.isSafeInteger(result.id) || result.id < 1) {
            throw new Error(result.error || 'The server did not confirm the new action item.');
        }
        return result;
    }

    function mount(root) {
        if (mounted.has(root)) return mounted.get(root);
        const id = Number(root.dataset.sbProjectDetail);
        const form = root.querySelector('#addTaskForm');
        const title = root.querySelector('#newTaskTitle'), due = root.querySelector('#newTaskDue');
        const notice = root.querySelector('[data-project-notice]');
        const reading = root.querySelector('[data-project-reading]');
        const parentModal = root.closest('dialog');
        let pending = false, submitted = false, disposed = false;
        const state = () => JSON.stringify([title.value, due.value]);
        const baseline = state();
        const report = text => { notice.textContent = text; notice.hidden = !text; };
        const reload = () => { submitted = true; window.location.reload(); };
        const task = window.SBActionItemDialog.mount(
            root.querySelector('#actionItemDetailModal'), {
                discard: root.querySelector('#aiDiscardDialog'), onChanged: reload,
            });
        const dirty = () => state() !== baseline || task.isDirty();
        const busy = () => pending || task.isBusy();
        function guard(event) {
            if (busy()) {
                event.preventDefault();
                report('Saving action item. Please wait before leaving this project.');
            } else if (dirty() && !window.confirm('Discard the unsaved action item changes?')) {
                event.preventDefault();
            }
        }
        function parentGuard(event) {
            if (event.target === parentModal && !disposed) guard(event);
        }
        function navigationGuard(event) {
            const link = event.target.closest('a[href]');
            if (!link || event.defaultPrevented || event.button > 0 ||
                    event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
                    link.target === '_blank' || link.hasAttribute('download') ||
                    link.getAttribute('href').startsWith('#')) return;
            if (!root.contains(link) && link.id !== 'managerWorkFullLink') return;
            guard(event);
            if (!event.defaultPrevented && link.hasAttribute('data-project-back') &&
                    window.document.referrer.startsWith(window.location.origin + '/') &&
                    window.history.length > 1) {
                event.preventDefault();
                window.history.back();
            }
        }
        const navigationRoot = parentModal || root;
        navigationRoot.addEventListener('click', navigationGuard);
        parentModal?.addEventListener('sb:dialog-before-close', parentGuard);
        const unload = event => {
            if (disposed || submitted || !root.isConnected || (!dirty() && !busy())) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', unload);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (pending || task.isBusy() || !title.value.trim() || !form.reportValidity()) return;
            const payload = {title: title.value.trim()};
            if (due.value) payload.due_date = due.value;
            pending = true;
            report('');
            const save = form.querySelector('[type="submit"]');
            save.disabled = true;
            title.disabled = due.disabled = true;
            form.setAttribute('aria-busy', 'true');
            try {
                await addTask(id, payload);
                reload();
            } catch (error) {
                console.error('Could not add project action item:', id, error);
                report('Could not add the action item. Your input is retained. Retry Add.');
            } finally {
                pending = false;
                save.disabled = false;
                title.disabled = due.disabled = false;
                form.setAttribute('aria-busy', 'false');
            }
        });
        root.querySelector('[data-project-delete]').addEventListener('submit', event => {
            guard(event);
            if (event.defaultPrevented || submitted ||
                    !window.confirm('Delete this project?')) event.preventDefault();
            else submitted = true;
        });
        root.querySelectorAll('[data-project-task]').forEach(button => {
            button.addEventListener('click', () => task.open(Number(button.dataset.projectTask)));
        });
        function saveReading() {
            if (disposed || !root.classList.contains('sb-project-page')) return;
            window.history.replaceState({...window.history.state,
                sbProjectDetail: {id, top: reading.scrollTop}}, '');
        }
        function restore() {
            const value = window.history.state?.sbProjectDetail;
            if (!value || value.id !== id) return;
            try { reading.scrollTop = validateHistory(value, id).top; }
            catch (error) { console.error('Could not restore project reading:', error); }
        }
        if (root.classList.contains('sb-project-page')) {
            restore();
            reading.addEventListener('scroll', saveReading, {passive: true});
            window.addEventListener('pageshow', restore);
        }
        const api = {isDirty: dirty, isBusy: busy, dispose() {
            if (disposed) return;
            disposed = true;
            task.dispose();
            navigationRoot.removeEventListener('click', navigationGuard);
            parentModal?.removeEventListener('sb:dialog-before-close', parentGuard);
            window.removeEventListener('beforeunload', unload);
            window.removeEventListener('pageshow', restore);
            reading.removeEventListener('scroll', saveReading);
        }};
        root._projectDetail = api;
        mounted.set(root, api);
        return api;
    }

    const api = Object.freeze({mount, addTask, validateHistory});
    if (typeof module !== 'undefined') module.exports = api;
    window.SBProjectDetail = api;
})(typeof window === 'undefined' ? globalThis : window);
