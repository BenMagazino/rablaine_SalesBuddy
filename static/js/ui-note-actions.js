/** Scoped quick-action editors shared by note pages and injected previews. */
(() => {
    'use strict';

    const instances = new WeakMap();
    const active = new Set();

    function mountEditor(root) {
        if (instances.has(root)) return instances.get(root);
        const find = selector => {
            const element = root.querySelector(selector);
            if (!element) throw new Error(`Missing note action control: ${selector}`);
            return element;
        };
        const form = find('form');
        const title = find('#noteTaskTitle');
        const engagement = find('#noteTaskEngagement');
        const due = find('#noteTaskDue');
        const result = find('#noteTaskResult');
        const button = find('button[type="submit"]');
        const noteId = Number(root.dataset.sbNoteId);
        if (!Number.isSafeInteger(noteId) || noteId < 1) throw new Error('Invalid note action ID.');
        const listeners = new AbortController();
        const values = () => JSON.stringify([title.value, engagement.value, due.value]);
        let baseline = values(), busy = false, disposed = false;
        const changed = () => root.dispatchEvent(new CustomEvent('sb:note-action-state', {
            bubbles: true,
        }));

        function report(message, state) {
            result.hidden = false;
            result.textContent = message;
            result.dataset.sbState = state;
        }

        async function submit(event) {
            event.preventDefault();
            if (busy) return;
            const name = title.value.trim();
            if (!name) {
                report('Enter an action item title.', 'error');
                title.focus();
                return;
            }
            const engagementId = Number(engagement.value);
            if (!Number.isSafeInteger(engagementId) || engagementId < 1) {
                report('Choose an engagement for this action item.', 'error');
                console.error('Note action has an invalid engagement selection.');
                return;
            }
            busy = true;
            changed();
            for (const element of [title, engagement, due, button]) element.disabled = true;
            report('Saving action item...', 'neutral');
            try {
                const response = await fetch(`/engagement/${engagementId}/action-items`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({title: name, due_date: due.value || null, note_id: noteId}),
                });
                const data = await response.json();
                if (!response.ok || data?.success !== true) {
                    throw new Error(data?.error || 'Unable to save action item.');
                }
                if (disposed) return;
                title.value = '';
                baseline = values();
                report('Action item created!', 'success');
            } catch (error) {
                console.error('Unable to create note action item.', error);
                if (!disposed) report(error.message || 'Unable to save action item.', 'error');
            } finally {
                busy = false;
                if (!disposed) {
                    for (const element of [title, engagement, due, button]) element.disabled = false;
                    changed();
                }
            }
        }
        form.addEventListener('submit', submit, {signal: listeners.signal});
        const editor = {
            isDirty: () => values() !== baseline,
            isBusy: () => busy,
            dispose() {
                disposed = true;
                listeners.abort();
                active.delete(editor);
                instances.delete(root);
            },
            isConnected: () => root.isConnected,
        };
        instances.set(root, editor);
        active.add(editor);
        return editor;
    }

    function mount(container) {
        const editors = [...container.querySelectorAll('[data-sb-note-actions]')].map(mountEditor);
        return {
            isDirty: () => editors.some(editor => editor.isDirty()),
            isBusy: () => editors.some(editor => editor.isBusy()),
            dispose: () => editors.forEach(editor => editor.dispose()),
        };
    }

    window.addEventListener('beforeunload', event => {
        if (![...active].some(editor =>
            editor.isConnected() && (editor.isDirty() || editor.isBusy()))) return;
        event.preventDefault();
        event.returnValue = '';
    });
    window.SBNoteActions = Object.freeze({mount});
    mount(document);
})();
