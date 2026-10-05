/** Shared record loading and guarded dialog/persistent-panel transitions. */
(() => {
    'use strict';

    const controllers = new WeakMap();
    const DEFAULT_STATUS = 'Action items save immediately when submitted.';

    function create(target, options) {
        const dialog = typeof target === 'string' ? document.getElementById(target) : target;
        if (!dialog) throw new Error('Record dialog is missing.');
        if (controllers.has(dialog)) return controllers.get(dialog);
        if (options.presentation && !['dialog', 'panel'].includes(options.presentation)) {
            throw new Error('Invalid record presentation: ' + options.presentation);
        }
        const panel = options.presentation === 'panel';
        const active = () => panel ? !dialog.hidden : dialog.open;
        const find = name => {
            const element = dialog.querySelector(`[data-sb-record-${name}]`);
            if (!element) throw new Error(`Missing record dialog control: ${name}`);
            return element;
        };
        const title = find('title'), fullLink = find('full-link'), content = find('content');
        const loading = find('loading'), errorPanel = find('error'), retry = find('retry');
        const status = find('status');
        const defaultStatus = options.statusText ?? DEFAULT_STATUS;
        const busyText = options.busyText ||
            'Saving action item. Please wait before leaving this note.';
        const discard = document.getElementById('recordDiscardDialog');
        const confirm = document.getElementById('recordDiscardConfirm');
        if (!discard || !confirm) throw new Error('Record discard controls are missing.');
        let selection = null, request = null, generation = 0, mounted = null;
        let transition = null, bypass = false;

        function dispose() {
            generation++;
            request?.abort();
            request = null;
            mounted?.dispose();
            mounted = null;
            content.replaceChildren();
        }

        function guard(proceed) {
            if (options.isBusy?.() || mounted?.isBusy()) {
                status.textContent = busyText;
                return false;
            }
            if (mounted?.isDirty()) {
                if (!discard.open) {
                    transition = proceed;
                    document.getElementById('recordDiscardDescription').textContent =
                        options.discardText || 'Your action item has not been saved. ' +
                        'Keep editing, or discard the draft to continue.';
                    SBDialog.open(discard);
                }
                return false;
            }
            return true;
        }

        async function load() {
            dispose();
            const version = generation;
            const snapshot = selection;
            const controller = new AbortController();
            request = controller;
            loading.hidden = false;
            errorPanel.hidden = true;
            content.hidden = true;
            content.setAttribute('aria-busy', 'true');
            status.textContent = defaultStatus;
            try {
                const response = await fetch(options.loadUrl(snapshot.id), {signal: controller.signal});
                if (!response.ok) throw new Error(`Record detail HTTP ${response.status}.`);
                if (!response.headers.get('content-type')?.includes('text/html')) {
                    throw new Error('Record detail response is not HTML.');
                }
                const html = await response.text();
                if (version !== generation || !active()) return;
                const template = document.createElement('template');
                template.innerHTML = html;
                const root = template.content.querySelector(options.fragmentSelector);
                const identity = options.identityValue ?
                    options.identityValue(snapshot.id) : String(snapshot.id);
                if (typeof identity !== 'string' || !identity ||
                    !root || root.getAttribute(options.identityAttribute) !== identity) {
                    throw new Error('Record detail identity does not match the requested record.');
                }
                content.replaceChildren(template.content);
                SBLocalDateTime.render(content);
                if (content.querySelector('[data-sb-sortable]')) {
                    if (!window.SBTableSort) throw new Error('Table sorting is unavailable.');
                    window.SBTableSort.mount(content);
                }
                mounted = options.mount(content);
                loading.hidden = true;
                content.hidden = false;
            } catch (error) {
                if (version !== generation || controller.signal.aborted) return;
                console.error('Unable to load record detail.', error);
                mounted?.dispose();
                mounted = null;
                content.replaceChildren();
                loading.hidden = true;
                errorPanel.hidden = false;
                status.textContent = options.errorText ||
                    'The note could not be loaded. Retry or use Full Page.';
            } finally {
                if (version === generation) {
                    request = null;
                    content.setAttribute('aria-busy', 'false');
                }
            }
        }

        function replace(snapshot) {
            if (!panel && dialog.open) focusAnchor();
            selection = snapshot;
            title.textContent = snapshot.title;
            fullLink.href = options.fullUrl(snapshot.id);
            options.onSelection?.(snapshot);
            if (panel) dialog.hidden = false;
            else SBDialog.open(dialog);
            return load();
        }

        function focusAnchor() {
            (panel ? title : dialog.querySelector('[data-sb-dialog-close]'))
                .focus({preventScroll: true});
        }

        dialog.addEventListener('sb:dialog-before-close', event => {
            if (event.target !== dialog || bypass) return;
            if (!guard(() => SBDialog.close(dialog, event.detail.reason))) event.preventDefault();
        });
        dialog.addEventListener('sb:dialog-closed', event => {
            if (event.target !== dialog) return;
            dispose();
            selection = null;
        });
        dialog.addEventListener(options.stateEvent || 'sb:note-action-state', () => {
            status.textContent = options.isBusy?.() || mounted?.isBusy() ? busyText : defaultStatus;
        });
        discard.addEventListener('sb:dialog-closed', () => { transition = null; });
        confirm.addEventListener('click', () => {
            if (!transition) return;
            const proceed = transition;
            mounted?.dispose();
            mounted = null;
            SBDialog.close(discard, 'discard');
            bypass = true;
            try { proceed(); } finally { bypass = false; }
        });
        retry.addEventListener('click', () => {
            focusAnchor();
            load();
        });
        dialog.addEventListener('click', event => {
            if (event.defaultPrevented || event.button > 0 ||
                !(event.target instanceof Element)) return;
            const link = event.target.closest('a[href]');
            if (!link || (link.target && link.target !== '_self') ||
                link.hasAttribute('download') || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || link.getAttribute('href').startsWith('#')) return;
            const url = new URL(link.href, location.href);
            if (!['http:', 'https:'].includes(url.protocol)) return;
            if (!guard(() => location.assign(url.href))) event.preventDefault();
        });
        const api = {
            open(snapshot) {
                if (!Number.isSafeInteger(snapshot?.id) || snapshot.id < 1 ||
                    typeof snapshot.title !== 'string') throw new Error('Invalid record selection.');
                if (active() && selection?.id === snapshot.id) return;
                if (!guard(() => replace(snapshot))) return false;
                return replace(snapshot);
            },
            clear() {
                const clear = () => {
                    dispose();
                    selection = null;
                    if (panel) dialog.hidden = true;
                    loading.hidden = true;
                    errorPanel.hidden = true;
                    content.hidden = true;
                    content.setAttribute('aria-busy', 'false');
                    status.textContent = defaultStatus;
                };
                if (!guard(clear)) return false;
                clear();
                return true;
            },
            refresh() {
                if (!selection || !active()) return false;
                if (!guard(() => api.refresh())) return false;
                if (panel && content.contains(document.activeElement)) focusAnchor();
                return load();
            },
        };
        controllers.set(dialog, api);
        return api;
    }

    window.SBRecordDialog = Object.freeze({create});
})();
