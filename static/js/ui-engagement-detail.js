/** Scoped engagement dossier controllers, shared by full pages and loaded fragments. */
((window) => {
    'use strict';
    if (window.SBEngagementDetail) return;
    const mounted = new WeakSet();

    function validateHistory(value, id) {
        if (!value || value.id !== id || typeof value.completedOpen !== 'boolean' ||
                ['story', 'work'].some(key => !Number.isFinite(value[key]) || value[key] < 0)) {
            throw new Error('Invalid engagement reading history.');
        }
        return value;
    }

    function documentFor(root) {
        root._engagement ||= {};
        root._engagement.reload ||= () => {
            root._engagement.submitted = true;
            window.location.reload();
        };
        const native = window.document;
        return {
            getElementById: id => root.querySelector('#' + id),
            querySelector: selector => root.querySelector(selector),
            querySelectorAll: selector => root.querySelectorAll(selector),
            createElement: tag => native.createElement(tag),
        };
    }

    function mount(root) {
        if (mounted.has(root)) return;
        mounted.add(root);
        const controller = root._engagement;
        const notice = window.document.createElement('p');
        notice.className = 'sb-engagement-notice';
        notice.setAttribute('role', 'alert');
        notice.hidden = true;
        root.prepend(notice);
        controller.report = message => {
            notice.textContent = message;
            notice.hidden = !message;
        };
        const ghost = root.querySelector('#ghostTaskTitle');
        const editing = root.querySelector('#taskEditModal');
        const state = () => {
            const selected = [...root.querySelectorAll('input[name="note_ids"]:checked')]
                .map(input => input.value);
            const milestones = [...root.querySelectorAll('.ms-checkbox:checked')]
                .map(input => input.value);
            return JSON.stringify([selected, milestones, ghost?.value || '',
                root.querySelector('#ghostTaskDue')?.value || '']);
        };
        const baseline = state();
        const taskDirty = () => editing.open && controller.taskState() !== controller.taskBaseline;
        const review = root.querySelector('#storyReviewModal');
        const reviewState = () => JSON.stringify([...root.querySelectorAll(
            '#storyReviewFields input, #storyReviewFields textarea')].map(field =>
            [field.value, field.checked]));
        controller.reviewState = reviewState;
        const dirty = () => Boolean(root.querySelector('.story-inline-editor')) ||
            state() !== baseline || taskDirty() ||
            (review?.open && reviewState() !== controller.reviewBaseline);
        controller.isDirty = dirty;
        controller.isBusy = () => Boolean(controller.pending);
        const guard = event => {
            if (controller.isBusy()) {
                event.preventDefault();
                controller.report('Saving engagement changes. Please wait.');
            } else if (dirty() && !window.confirm('Discard the unsaved engagement changes?')) {
                event.preventDefault();
            }
        };
        editing.addEventListener('sb:dialog-before-close', event => {
            if (event.target !== editing) return;
            if (controller.isBusy()) event.preventDefault();
            else if (taskDirty() && !window.confirm('Discard the unsaved action item changes?')) {
                event.preventDefault();
            }
        });
        review?.addEventListener('sb:dialog-before-close', event => {
            if (event.target !== review) return;
            if (controller.isBusy()) event.preventDefault();
            else if (reviewState() !== controller.reviewBaseline &&
                    !window.confirm('Discard the changes to this story review?')) {
                event.preventDefault();
            }
        });
        const parent = root.closest('dialog');
        const parentGuard = event => {
            if (event.target === parent && root.isConnected) guard(event);
        };
        parent?.addEventListener('sb:dialog-before-close', parentGuard);
        const unloadGuard = event => {
            if (!root.isConnected || controller.submitted || (!dirty() && !controller.isBusy())) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', unloadGuard);
        controller.dispose = () => {
            parent?.removeEventListener('sb:dialog-before-close', parentGuard);
            window.removeEventListener('beforeunload', unloadGuard);
        };
        root.addEventListener('click', event => {
            const link = event.target.closest('a[href]');
            if (link && !link.target && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                guard(event);
            }
        });
        root.querySelector('form[action]')?.addEventListener('submit', event => {
            if (controller.isBusy() || controller.submitted) event.preventDefault();
            else controller.submitted = true;
        });
        for (const element of root.querySelectorAll('[onclick], [onchange]')) {
            for (const kind of ['click', 'change']) {
                const attribute = element.getAttribute('on' + kind);
                if (!attribute) continue;
                element.removeAttribute('on' + kind);
                const stop = attribute.includes('event.stopPropagation()');
                const action = attribute.match(/(?:^|;\s*)(\w+)\(([^)]*)\)/g)
                    ?.map(call => call.match(/(\w+)\(([^)]*)\)/))
                    .find(match => match[1] !== 'stopPropagation');
                element.addEventListener(kind, event => {
                    if (stop) event.stopPropagation();
                    if (!action) return;
                    const name = action[1];
                    const args = action[2].split(',').filter(value => value.trim())
                        .map(value => value.trim() === 'this' ? element : Number(value.trim()));
                    if (name === 'saveMilestoneLinks') args.push(event);
                    controller[name](...args);
                });
                if (kind === 'click' && element.getAttribute('role') === 'button') {
                    element.addEventListener('keydown', event => {
                        if (event.target === element && ['Enter', ' '].includes(event.key)) {
                            event.preventDefault();
                            element.click();
                        }
                    });
                }
            }
        }
        for (const button of root.querySelectorAll('[data-eng-disclosure]')) {
            button.addEventListener('click', () => {
                const panel = root.querySelector('#' + button.dataset.engDisclosure);
                panel.hidden = !panel.hidden;
                button.setAttribute('aria-expanded', String(!panel.hidden));
            });
        }
        const id = Number(root.dataset.sbEngagementDetail);
        const regions = [...root.querySelectorAll('[data-eng-reading]')];
        const completed = root.querySelector('#completedTasks');
        if (root.classList.contains('sb-engagement-page')) {
            function restore() {
                try {
                    const saved = window.history.state?.sbEngagementDetail;
                    if (!saved || saved.id !== id) return;
                    validateHistory(saved, id);
                    regions.forEach(region => {
                        region.scrollTop = saved[region.dataset.engReading];
                    });
                    if (completed) completed.hidden = !saved.completedOpen;
                    root.querySelector('[data-eng-disclosure]')?.setAttribute(
                        'aria-expanded', String(saved.completedOpen));
                } catch (error) {
                    console.error('Could not restore engagement reading history.', error);
                    controller.report('Could not restore the previous reading position.');
                }
            }
            function save() {
                try {
                    window.history.replaceState({...window.history.state, sbEngagementDetail: {
                        id, completedOpen: Boolean(completed && !completed.hidden),
                        ...Object.fromEntries(regions.map(region =>
                            [region.dataset.engReading, region.scrollTop])),
                    }}, '');
                } catch (error) {
                    console.error('Could not save engagement reading history.', error);
                }
            }
            regions.forEach(region => region.addEventListener('scroll', save, {passive: true}));
            root.querySelector('[data-eng-disclosure]')?.addEventListener('click', save);
            window.addEventListener('pagehide', save);
            window.addEventListener('pageshow', restore);
            restore();
        }
        window.SBLocalDateTime?.render(root);
        window.SBTableSort?.mount(root);
    }

    async function request(root, url, options = {}) {
        const write = options.method && options.method !== 'GET';
        const controller = root._engagement;
        if (write && controller.pending) throw new Error('A save is already in progress.');
        if (write) controller.pending = true;
        try {
            const response = await window.fetch(url, options);
            const data = await response.json();
            if (!response.ok || data?.success !== true) {
                throw new Error(data?.error || 'Engagement request HTTP ' + response.status + '.');
            }
            return {ok: response.ok, status: response.status, json: async () => data};
        } catch (error) {
            console.error('Engagement request failed.', error);
            controller.report?.(error.message + (write ? ' Your input is retained. Retry the save.' : ''));
            throw error;
        } finally {
            if (write) controller.pending = false;
        }
    }

    const api = Object.freeze({document: documentFor, mount, fetch: request, validateHistory});
    window.SBEngagementDetail = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
