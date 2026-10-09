/** Shared desktop shortcuts; native editors own their guarded submit/cancel behavior. */
(() => {
    'use strict';

    window.addEventListener('load', () => {
        document.addEventListener('keydown', event => {
            if (event.defaultPrevented) return;
            if (event.key === 'F1') {
                event.preventDefault();
                if (typeof PageHelp !== 'undefined') PageHelp.show();
                return;
            }
            const target = event.target;
            const tag = target.tagName?.toLowerCase();
            const typing = tag === 'input' || tag === 'textarea' || target.isContentEditable;
            if (document.querySelector('.sb-dialog[open]:not([data-sb-nonmodal="true"])')) {
                if (!typing && event.key === '?') {
                    event.preventDefault();
                    SBDialog.toggle('keyboardShortcutsModal');
                }
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                SBDialog.open('quickNoteModal');
            } else if (!typing && event.key === '/') {
                const search = document.getElementById('navCustomerSearch');
                if (search) {
                    event.preventDefault();
                    search.focus();
                    search.select();
                }
            } else if (!typing && event.key === '?') {
                event.preventDefault();
                SBDialog.toggle('keyboardShortcutsModal');
            } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                const form = target.closest?.('form');
                if (!form) return;
                event.preventDefault();
                const submit = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submit) {
                    if (!submit.disabled) submit.click();
                } else {
                    form.requestSubmit();
                }
            } else if (event.key === 'Escape' && !document.getElementById('noteForm')) {
                const cancel = document.querySelector('[data-sb-form-cancel], [data-sb-cancel]');
                if (cancel && !cancel.disabled) {
                    event.preventDefault();
                    cancel.click();
                }
            }
        });
    });
})();
