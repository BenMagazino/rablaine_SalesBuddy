/** Scoped legacy milestone behavior with owned reads, writes and nested native dialogs. */
(() => {
    'use strict';
    const instances = new WeakMap(), active = new Set();

    function attach(root, initialize) {
        if (instances.has(root)) return instances.get(root);
        const listeners = new AbortController(), reads = new Set(), timers = new Set();
        const baselines = new Map();
        const discard = document.getElementById('recordDiscardDialog');
        const confirm = document.getElementById('recordDiscardConfirm');
        let disposed = false, writes = 0, transition = null, bypass = false;
        let approvedNavigation = false;
        const changed = () => {
            if (!writes) {
                for (const child of children()) {
                    child.querySelector('[data-sb-child-status]').textContent = '';
                }
            }
            root.dispatchEvent(new CustomEvent('sb:record-state', {bubbles: true}));
        };
        const fields = child => [...child.querySelectorAll('input, select, textarea')];
        const values = child => JSON.stringify(fields(child).map(field => field.value));
        const childDirty = child => baselines.has(child) && values(child) !== baselines.get(child);
        const commentsDirty = () => [...root.querySelectorAll(
            '#commentFormCached textarea, #commentFormMsx textarea, [id^="editText-"]'
        )].some(field => field.value !== field.defaultValue);
        const children = () => [...root.querySelectorAll('dialog[data-sb-milestone-child]')];
        const api = {
            isBusy: () => writes > 0,
            isDirty: () => !approvedNavigation && (commentsDirty() || children().some(childDirty)),
            isConnected: () => root.isConnected,
            openChild(id) {
                const child = root.querySelector('#' + id);
                if (!child) throw new Error(`Milestone editor is missing: ${id}`);
                if (!baselines.has(child)) baselines.set(child, values(child));
                SBDialog.open(child);
            },
            reload() {
                if (disposed) {
                    console.warn('Task saved after its milestone view closed. Reopen it to refresh.');
                    return;
                }
                const reload = () => {
                    approvedNavigation = true;
                    writes = 0;
                    window.location.reload();
                };
                const task = root.querySelector('#newTaskModal');
                if (task?.open) SBDialog.close(task, 'saved');
                if (commentsDirty()) {
                    transition = reload;
                    document.getElementById('recordDiscardDescription').textContent =
                        'The task was created. Discard your unsaved comment draft to refresh, ' +
                        'or keep editing the comment.';
                    SBDialog.open(discard);
                } else reload();
            },
            dispose() {
                if (disposed) return;
                disposed = true;
                listeners.abort();
                for (const request of reads) request.abort();
                for (const timer of timers) window.clearTimeout(timer);
                for (const child of children()) if (child.open) SBDialog.close(child, 'parent-close');
                active.delete(api);
                instances.delete(root);
            },
        };
        function schedule(callback, delay) {
            if (disposed) return;
            const timer = window.setTimeout(() => {
                timers.delete(timer);
                if (!disposed) callback();
            }, delay);
            timers.add(timer);
            return timer;
        }
        async function fetchScoped(url, options = {}) {
            if (disposed) throw new DOMException('Milestone view disposed.', 'AbortError');
            const write = (options.method || 'GET').toUpperCase() !== 'GET';
            if (write && writes) throw new Error('Another milestone change is still saving.');
            const controller = write ? null : new AbortController();
            const lockedFields = write ? [...root.querySelectorAll('input, select, textarea')]
                .map(field => [field, field.disabled]) : [];
            if (controller) reads.add(controller);
            if (write) {
                writes++;
                for (const [field] of lockedFields) field.disabled = true;
                changed();
            }
            let released = false;
            const release = () => {
                if (released) return;
                released = true;
                if (controller) reads.delete(controller);
                if (write) {
                    for (const [field, disabled] of lockedFields) field.disabled = disabled;
                    writes = Math.max(0, writes - 1);
                    changed();
                }
            };
            try {
                const response = await window.fetch(url, {
                    ...options, ...(controller ? {signal: controller.signal} : {}),
                });
                if (write && !response.headers.get('content-type')?.includes('application/json')) {
                    release();
                }
                return {
                    ok: response.ok, status: response.status, headers: response.headers,
                    async json() {
                        try {
                            const data = await response.json();
                            if (write && typeof data?.success !== 'boolean') {
                                throw new Error(`Invalid milestone response (HTTP ${response.status}). ` +
                                    'Check MSX before retrying.');
                            }
                            if (!response.ok && data?.success) {
                                throw new Error(`Invalid milestone response (HTTP ${response.status}).`);
                            }
                            return data;
                        } catch (error) {
                            console.error('Unable to read milestone response.', error);
                            throw error;
                        } finally {
                            // Keep guards active through the caller's save-result microtasks.
                            if (write) window.setTimeout(release, 0);
                            else release();
                        }
                    },
                };
            } catch (error) {
                release();
                if (error.name !== 'AbortError') console.error('Milestone request failed.', error);
                throw error;
            }
        }
        const scopedDocument = {
            getElementById: id => root.querySelector('#' + id),
            querySelector: selector => root.querySelector(selector),
            querySelectorAll: selector => root.querySelectorAll(selector),
            createElement: tag => document.createElement(tag),
            get activeElement() { return document.activeElement; },
        };
        let actions;
        root.addEventListener('click', event => {
            const button = event.target.closest('[data-sb-ms-action]');
            if (!button || !root.contains(button)) return;
            event.preventDefault();
            const action = actions?.[button.dataset.sbMsAction];
            if (!action) throw new Error(`Unknown milestone action: ${button.dataset.sbMsAction}`);
            action();
        }, {signal: listeners.signal});
        root.addEventListener('submit', event => {
            if (event.target.closest('#commentFormCached')) approvedNavigation = true;
        }, {signal: listeners.signal});
        root.addEventListener('sb:dialog-before-close', event => {
            const child = event.target;
            if (disposed || bypass || !child.matches('dialog[data-sb-milestone-child]') ||
                event.detail.reason === 'saved') return;
            if (writes) {
                event.preventDefault();
                child.querySelector('[data-sb-child-status]').textContent =
                    'Saving. Please wait before closing this editor.';
            } else if (childDirty(child)) {
                event.preventDefault();
                if (!discard.open) {
                    transition = () => SBDialog.close(child, 'discard');
                    document.getElementById('recordDiscardDescription').textContent =
                        'Your draft has not been saved. Keep editing, or discard it to continue.';
                    SBDialog.open(discard);
                }
            }
        }, {signal: listeners.signal});
        root.addEventListener('sb:dialog-closed', event => {
            const child = event.target;
            if (!child.matches('dialog[data-sb-milestone-child]')) return;
            if (event.detail.reason !== 'parent-close') {
                child.querySelector('form').reset();
                const due = child.querySelector('#modal_task_due_date');
                if (due) due.value = due.defaultValue;
                baselines.delete(child);
                child.querySelector('[data-sb-child-status]').textContent = '';
                const error = child.querySelector('[role="alert"]');
                if (error && !child.querySelector('#create_task_btn')?.disabled) error.hidden = true;
            }
        }, {signal: listeners.signal});
        discard.addEventListener('sb:dialog-closed', () => { transition = null; },
            {signal: listeners.signal});
        confirm.addEventListener('click', () => {
            if (!transition) return;
            const proceed = transition;
            SBDialog.close(discard, 'discard');
            bypass = true;
            try { proceed(); } finally { bypass = false; }
        }, {signal: listeners.signal});
        instances.set(root, api);
        active.add(api);
        try {
            actions = initialize({document: scopedDocument, fetch: fetchScoped,
                setTimeout: schedule, workflow: api});
        } catch (error) {
            api.dispose();
            throw error;
        }
        return api;
    }

    function activate(container) {
        const root = container.querySelector('[data-sb-milestone-detail]');
        if (!root) throw new Error('Milestone detail root is missing.');
        if (!instances.has(root)) {
            const source = root.querySelector('script[data-sb-milestone-controller]');
            if (!source || source.src) throw new Error('Milestone initializer is missing or invalid.');
            const script = document.createElement('script');
            script.textContent = source.textContent;
            source.replaceWith(script);
        }
        const instance = instances.get(root);
        if (!instance) throw new Error('Milestone initializer did not mount.');
        return instance;
    }
    window.addEventListener('beforeunload', event => {
        if (![...active].some(api => api.isConnected() && (api.isDirty() || api.isBusy()))) return;
        event.preventDefault();
        event.returnValue = '';
    });
    window.SBMilestoneWorkflow = Object.freeze({attach, activate});
})();
