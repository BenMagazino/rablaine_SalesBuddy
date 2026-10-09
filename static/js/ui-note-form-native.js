/** Native presentation controls around the existing rich note workflow. */
(() => {
    'use strict';
    const instances = new WeakMap();
    function dialog(element) {
        if (!(element instanceof HTMLDialogElement)) throw new Error('Invalid note dialog.');
        if (!instances.has(element)) {
            element.addEventListener('sb:dialog-opening', () => element.classList.add('show'));
            element.addEventListener('sb:dialog-closed', () => element.classList.remove('show'));
            instances.set(element, {
                // Existing editor code attaches its focus listener immediately after opening.
                show: () => queueMicrotask(() => SBDialog.open(element)),
                hide: () => SBDialog.close(element),
                toggle: () => element.open ? SBDialog.close(element) :
                    queueMicrotask(() => SBDialog.open(element)),
            });
        }
        return instances.get(element);
    }
    function expand(element) {
        element.classList.add('show');
        document.querySelector(`[data-sb-note-collapse="${element.id}"]`)
            ?.setAttribute('aria-expanded', 'true');
    }
    function report(message, state = 'neutral') {
        const notice = document.getElementById('noteSaveFeedback');
        if (!notice) return;
        notice.hidden = false;
        notice.textContent = message;
        notice.dataset.sbState = state;
        notice.setAttribute('role', state === 'error' ? 'alert' : 'status');
    }
    function closeMenus(except) {
        document.querySelectorAll('[data-sb-note-menu]').forEach(button => {
            if (button === except) return;
            button.setAttribute('aria-expanded', 'false');
            button.parentElement.querySelector('.sb-nf-dropdown-menu')?.classList.remove('show');
        });
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-sb-note-menu]');
        if (button) {
            const menu = button.parentElement.querySelector('.sb-nf-dropdown-menu');
            if (!menu) return;
            closeMenus(button);
            const open = button.getAttribute('aria-expanded') !== 'true';
            button.setAttribute('aria-expanded', String(open));
            menu.classList.toggle('show', open);
            return;
        }
        const expanded = document.querySelector('[data-sb-note-menu][aria-expanded="true"]');
        if (expanded && (!expanded.parentElement.contains(event.target) ||
            expanded.dataset.sbNoteMenuClose !== 'outside')) closeMenus();
        const trigger = event.target.closest('[data-sb-note-collapse]');
        if (trigger) {
            event.preventDefault();
            const panel = document.getElementById(trigger.dataset.sbNoteCollapse);
            const open = panel.classList.toggle('show');
            trigger.setAttribute('aria-expanded', String(open));
        }
    });
    document.addEventListener('keydown', event => {
        const button = event.target.closest('[data-sb-note-menu]');
        const expanded = document.querySelector('[data-sb-note-menu][aria-expanded="true"]');
        if (event.key === 'Escape' && expanded) {
            event.preventDefault();
            event.stopPropagation();
            closeMenus();
            expanded.focus();
        } else if (button && event.key === 'ArrowDown') {
            event.preventDefault();
            if (button.getAttribute('aria-expanded') !== 'true') button.click();
            button.parentElement.querySelector('.sb-nf-dropdown-menu button, .sb-nf-dropdown-menu input')
                ?.focus();
        }
    });
    window.SBNoteForm = Object.freeze({dialog, expand, report});
})();
