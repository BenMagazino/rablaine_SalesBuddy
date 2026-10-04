/* Shared native JSON preview, immediate writes and guarded plain-text editing. */
(() => {
    'use strict';
    if (window.SBActionItemDialog) return;
    const controllers = new WeakMap();

    function create(dialog) {
        const find = id => {
            const element = dialog.querySelector('#' + id);
            if (!element) throw new Error('Missing action item control: ' + id);
            return element;
        };
        const title = find('aiDetailTitle'), result = find('aiDetailResult');
        const loading = find('aiDetailLoading'), readError = find('aiDetailReadError');
        const view = find('aiDetailViewMode'), form = find('aiDetailEditMode');
        const viewFooter = find('aiDetailViewFooter'), editFooter = find('aiDetailEditFooter');
        const completed = find('aiDetailCompleted'), edit = find('aiDetailEditBtn');
        const close = dialog.querySelector('[data-sb-dialog-close]');
        const discard = document.getElementById('aiDiscardDialog');
        const confirm = discard.querySelector('#aiDiscardConfirm');
        const fields = ['aiEditTitle', 'aiEditDue', 'aiEditPriority', 'aiEditContact', 'aiEditDesc']
            .map(find);
        let selection = null, task = null, request = null, generation = 0;
        let busy = false, changed = false, baseline = '', transition = null, bypass = false;

        function report(text, state = 'status') {
            result.textContent = text;
            result.dataset.state = state;
            result.setAttribute('role', state === 'error' ? 'alert' : 'status');
        }

        function invalidate() {
            generation++;
            request?.abort();
            request = null;
        }

        function dirty() {
            return !form.hidden && JSON.stringify(fields.map(field => field.value)) !== baseline;
        }

        function guard(proceed) {
            if (busy) {
                report('Saving action item. Please wait before leaving.', 'status');
                return false;
            }
            if (dirty()) {
                if (!discard.open) {
                    transition = proceed;
                    SBDialog.open(discard);
                }
                return false;
            }
            return true;
        }

        function validate(data, id) {
            if (data?.success !== true || data.task?.id !== id ||
                typeof data.task.title !== 'string' ||
                !['open', 'completed'].includes(data.task.status)) {
                throw new Error('The server did not confirm the requested action item.');
            }
            return data.task;
        }

        function tag(label, tone, href) {
            const element = document.createElement(href ? 'a' : 'span');
            element.className = 'sb-action-item-tag';
            element.textContent = label;
            if (tone) element.dataset.tone = tone;
            if (href) element.href = href;
            return element;
        }

        function render(next) {
            task = next;
            title.textContent = task.title;
            const due = find('aiDetailDueBadge');
            due.hidden = !task.due_date;
            due.textContent = task.due_date ?
                task.due_date + (task.is_overdue ? ' (overdue)' : '') : '';
            due.dataset.tone = task.is_overdue ? 'danger' : '';
            const meta = find('aiDetailMeta');
            meta.replaceChildren();
            if (task.priority === 'high') meta.appendChild(tag('High Priority', 'danger'));
            if (task.contact) meta.appendChild(tag(task.contact));
            if (task.source === 'copilot') meta.appendChild(tag('Copilot', 'accent'));
            if (task.source_url) {
                const url = new URL(task.source_url, location.href);
                if (['https:', 'http:'].includes(url.protocol)) {
                    const source = tag('Source', 'accent', url.href);
                    source.target = '_blank';
                    source.rel = 'noopener noreferrer';
                    meta.appendChild(source);
                } else {
                    console.error('Unsupported action item source URL:', task.id);
                    meta.appendChild(tag('Source link unavailable', 'danger'));
                }
            }
            if (task.note_id) meta.appendChild(tag('Linked Note', 'accent', '/note/' + task.note_id));
            meta.hidden = !meta.childElementCount;
            const description = find('aiDetailDesc');
            if (task.description?.trim()) description.innerHTML = task.description;
            else description.textContent = 'No description.';
            completed.checked = task.status === 'completed';
            const copilot = task.source === 'copilot';
            for (const id of ['aiDetailSaveGroup', 'aiDetailDismissBtn', 'aiDetailNotUsefulBtn']) {
                find(id).hidden = !copilot;
            }
            find('aiDetailSaveDue').value = '';
            edit.hidden = copilot;
            const link = find('aiDetailEngLink');
            link.hidden = !(selection.opts.showEngagementLink && task.engagement_id);
            link.href = task.engagement_id ? '/engagement/' + task.engagement_id : '#';
            view.hidden = viewFooter.hidden = false;
            form.hidden = editFooter.hidden = true;
            loading.hidden = readError.hidden = true;
        }

        async function load() {
            invalidate();
            const version = generation, snapshot = selection;
            const controller = new AbortController();
            request = controller;
            loading.hidden = false;
            view.hidden = viewFooter.hidden = form.hidden = editFooter.hidden = readError.hidden = true;
            find('aiDetailDueBadge').hidden = true;
            find('aiDetailBody').setAttribute('aria-busy', 'true');
            report('');
            try {
                const response = await fetch('/action-item/' + snapshot.id,
                    {method: 'GET', signal: controller.signal});
                if (!response.ok) throw new Error('Action item HTTP ' + response.status + '.');
                const data = await response.json();
                if (version !== generation || !dialog.open) return;
                render(validate(data, snapshot.id));
            } catch (error) {
                if (version !== generation || controller.signal.aborted) return;
                console.error('Unable to load action item:', snapshot.id, error);
                loading.hidden = true;
                readError.hidden = false;
            } finally {
                if (version === generation) {
                    request = null;
                    find('aiDetailBody').setAttribute('aria-busy', 'false');
                }
            }
        }

        function replace(id, opts) {
            close.focus({preventScroll: true});
            selection = {id, opts: opts || {}};
            task = null;
            title.textContent = 'Action item';
            SBDialog.open(dialog);
            return load();
        }

        async function write(suffix, payload, removed = false) {
            if (busy || !task) return;
            const id = selection.id;
            busy = true;
            const controls = [...dialog.querySelectorAll('input, select, textarea, button')]
                .filter(control => !control.disabled);
            controls.forEach(control => { control.disabled = true; });
            report('Saving action item...');
            try {
                const options = {method: suffix === '' ? 'PUT' : 'POST'};
                if (payload !== undefined) {
                    options.headers = {'Content-Type': 'application/json'};
                    options.body = JSON.stringify(payload);
                }
                const response = await fetch('/action-item/' + id + suffix, options);
                const data = await response.json();
                if (!response.ok || data?.success !== true) {
                    throw new Error(data?.error || 'Request failed (HTTP ' + response.status + ').');
                }
                if (!removed) render(validate(data, id));
                changed = true;
                report('Saved.');
                if (removed) {
                    busy = false;
                    SBDialog.close(dialog, 'saved');
                }
            } catch (error) {
                console.error('Unable to save action item:', id, suffix, error);
                completed.checked = task.status === 'completed';
                report('Could not save. ' + error.message, 'error');
            } finally {
                busy = false;
                controls.forEach(control => { control.disabled = false; });
                if (dialog.open && dialog.contains(document.activeElement) &&
                    document.activeElement.closest('[hidden]')) {
                    close.focus({preventScroll: true});
                }
            }
        }

        edit.addEventListener('click', () => {
            if (selection.opts.onEdit) {
                const snapshot = selection;
                SBDialog.close(dialog, 'edit');
                snapshot.opts.onEdit(snapshot.id);
                return;
            }
            fields[0].value = task.title || '';
            fields[0].removeAttribute('aria-invalid');
            fields[1].value = task.due_date || '';
            fields[2].value = task.priority || 'normal';
            fields[3].value = task.contact || '';
            const text = document.createElement('div');
            text.innerHTML = task.description || '';
            fields[4].value = text.textContent || '';
            baseline = JSON.stringify(fields.map(field => field.value));
            view.hidden = viewFooter.hidden = true;
            form.hidden = editFooter.hidden = false;
            title.textContent = 'Edit Action Item';
            report('');
            fields[0].focus();
        });
        find('aiDetailCancelEdit').addEventListener('click', () => {
            const cancel = () => { render(task); report(''); edit.focus(); };
            if (guard(cancel)) cancel();
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const value = fields[0].value.trim();
            if (!value) {
                fields[0].setAttribute('aria-invalid', 'true');
                report('Title is required.', 'error');
                fields[0].focus();
                return;
            }
            fields[0].removeAttribute('aria-invalid');
            write('', {title: value, due_date: fields[1].value || null,
                priority: fields[2].value, contact: fields[3].value.trim() || null,
                description: fields[4].value.trim() || null});
        });
        completed.addEventListener('change', () => write('/toggle'));
        find('aiDetailSaveBtn').addEventListener('click', () => {
            const due = find('aiDetailSaveDue');
            if (!due.reportValidity()) return;
            write('/save', due.value ? {due_date: due.value} : {});
        });
        find('aiDetailDismissBtn').addEventListener('click', () => write('/dismiss', undefined, true));
        find('aiDetailNotUsefulBtn').addEventListener('click', () =>
            write('/not-useful', undefined, true));
        find('aiDetailRetry').addEventListener('click', () => {
            close.focus({preventScroll: true});
            load();
        });
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (event.target !== dialog || bypass) return;
            if (!guard(() => SBDialog.close(dialog, event.detail.reason))) event.preventDefault();
        });
        dialog.addEventListener('sb:dialog-closed', event => {
            if (event.target !== dialog) return;
            invalidate();
            task = selection = null;
            view.hidden = viewFooter.hidden = form.hidden = editFooter.hidden = true;
            if (changed) {
                changed = false;
                location.reload();
            }
        });
        discard.addEventListener('sb:dialog-closed', () => { transition = null; });
        confirm.addEventListener('click', () => {
            if (!transition) return;
            const proceed = transition;
            SBDialog.close(discard, 'discard');
            bypass = true;
            try { proceed(); } finally { bypass = false; }
        });
        dialog.addEventListener('click', event => {
            const link = event.target.closest('a[href]');
            if (!link || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.altKey || event.shiftKey || link.target === '_blank' ||
                link.getAttribute('href').startsWith('#')) return;
            if (!guard(() => location.assign(link.href))) event.preventDefault();
        });
        window.addEventListener('pagehide', invalidate);
        window.addEventListener('pageshow', event => {
            if (event.persisted && dialog.open && selection && !loading.hidden) load();
        });
        return {open(id, opts = {}) {
            if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid action item ID.');
            if (dialog.open && selection?.id === id) return;
            if (guard(() => replace(id, opts))) return replace(id, opts);
        }};
    }

    window.SBActionItemDialog = Object.freeze({open(id, opts) {
        const dialog = document.getElementById('actionItemDetailModal');
        if (!dialog) throw new Error('Action item dialog is missing.');
        if (!controllers.has(dialog)) controllers.set(dialog, create(dialog));
        return controllers.get(dialog).open(id, opts);
    }});
    window.viewActionItem = window.SBActionItemDialog.open;
})();
