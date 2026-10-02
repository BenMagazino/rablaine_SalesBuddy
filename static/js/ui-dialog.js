/** Native dialog lifecycle for app-owned surfaces. */
(() => {
    'use strict';

    const frames = [];
    const registered = new WeakSet();

    function resolve(target) {
        const dialog = typeof target === 'string' ? document.getElementById(target) : target;
        if (!(dialog instanceof HTMLDialogElement) || !dialog.classList.contains('sb-dialog')) {
            throw new Error(`App dialog is missing or invalid: ${target}`);
        }
        return dialog;
    }

    function top() {
        return frames.at(-1)?.dialog;
    }

    function close(target, reason = 'dismiss') {
        const dialog = resolve(target);
        if (dialog.open) {
            dialog.close(reason);
            // Native close events are queued; finish before a dialog can reopen.
            finishClose(dialog);
        }
    }

    function finishClose(dialog) {
        const index = frames.findIndex(frame => frame.dialog === dialog);
        if (index < 0) return;
        const wasTop = index === frames.length - 1;
        const [frame] = frames.splice(index, 1);
        for (const child of frames) {
            if (dialog.contains(child.opener)) child.opener = frame.opener;
        }
        if (wasTop) {
            const current = top();
            const opener = frame.opener;
            if (opener?.isConnected && !opener.disabled &&
                !opener.closest('[inert]') && (!current || current.contains(opener))) {
                opener.focus();
            } else if (current) {
                (current.querySelector('[autofocus], button, a[href], input') || current).focus();
            }
        }
        dialog.dispatchEvent(new CustomEvent('sb:dialog-closed', {
            bubbles: true, detail: {reason: dialog.returnValue},
        }));
    }

    function register(dialog) {
        if (registered.has(dialog)) return;
        registered.add(dialog);
        let pressedOutside = false;
        function outside(event) {
            const rect = dialog.getBoundingClientRect();
            return event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom;
        }
        dialog.addEventListener('pointerdown', event => {
            pressedOutside = event.target === dialog && outside(event);
        });
        dialog.addEventListener('click', event => {
            if (pressedOutside && event.target === dialog && outside(event) &&
                dialog.dataset.sbBackdropClose === 'true') close(dialog, 'backdrop');
            pressedOutside = false;
        });
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            if (dialog.dataset.sbEscapeClose !== 'false') close(dialog, 'escape');
        });
        dialog.addEventListener('keydown', event => {
            if (event.key === 'F1' || event.key === '?') return;
            if ((event.ctrlKey || event.metaKey) &&
                ['enter', 'k'].includes(event.key.toLowerCase())) event.preventDefault();
            event.stopPropagation();
        });
        dialog.addEventListener('close', () => {
            if (!dialog.open) finishClose(dialog);
        });
    }

    function open(target) {
        const dialog = resolve(target);
        if (dialog.open) return;
        register(dialog);
        dialog.dispatchEvent(new CustomEvent('sb:dialog-opening', {bubbles: true}));
        const opener = document.activeElement;
        dialog.returnValue = '';
        dialog.showModal();
        frames.push({dialog, opener});
        dialog.dispatchEvent(new CustomEvent('sb:dialog-opened', {bubbles: true}));
    }

    function toggle(target) {
        const dialog = resolve(target);
        if (dialog.open) close(dialog, 'toggle');
        else open(dialog);
    }

    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const dismiss = event.target.closest('[data-sb-dialog-close]');
        if (dismiss) close(dismiss.closest('.sb-dialog'), 'button');
        else {
            const trigger = event.target.closest('[data-sb-dialog]');
            if (trigger) {
                event.preventDefault();
                open(trigger.dataset.sbDialog);
            }
        }
    });
    document.addEventListener('keydown', event => {
        const dialog = top();
        if (event.key !== 'Escape' || !dialog) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (dialog.dataset.sbEscapeClose !== 'false') close(dialog, 'escape');
    }, true);

    window.SBDialog = Object.freeze({open, close, toggle});
})();
