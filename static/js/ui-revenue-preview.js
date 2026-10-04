/** Shared revenue preview and Seller Full View return lifecycle. */
(() => {
    'use strict';
    const dialog = document.querySelector('[data-sb-revenue-preview]');
    if (!dialog) throw new Error('Revenue preview is missing.');
    const parentId = dialog.dataset.sbRevenueParent;
    const parent = parentId ? document.getElementById(parentId) : null;
    if (parentId && !parent) throw new Error('Revenue preview parent is missing.');
    let preview = null, changed = false, parentChanged = false;
    let returningToParent = false, pendingSelection = null;
    function open(id, customerName, bucket) {
        const selection = {id: Number(id), title: customerName + ' - ' + bucket};
        if (!Number.isSafeInteger(selection.id) || selection.id < 1) {
            throw new Error('Invalid revenue alert selection.');
        }
        if (!preview) {
            preview = SBRecordDialog.create(dialog, {
                loadUrl: id => `/api/revenue/analysis/${id}/detail`,
                fullUrl: () => '/reports/revenue',
                fragmentSelector: '[data-sb-revenue-detail]',
                identityAttribute: 'data-sb-revenue-id',
                stateEvent: 'sb:revenue-preview-state',
                statusText: 'Review changes save when you submit them.',
                busyText: 'Close Review Alert before leaving this preview.',
                errorText: 'The revenue alert could not be loaded. Retry or open Revenue Analyzer.',
                onSelection() { if (!dialog.open) changed = false; },
                mount() {
                    return {
                        isBusy: () => !!document.getElementById('reviewActionModal')?.open,
                        isDirty: () => false,
                        dispose() {},
                    };
                },
            });
        }
        if (pendingSelection) {
            pendingSelection = selection;
            return;
        }
        if (parent?.classList.contains('show')) {
            returningToParent = true;
            pendingSelection = selection;
            parent.addEventListener('hidden.bs.modal', () => {
                const next = pendingSelection;
                pendingSelection = null;
                preview.open(next);
            }, {once: true});
            bootstrap.Modal.getOrCreateInstance(parent).hide();
            return;
        }
        return preview.open(selection);
    }
    document.addEventListener('sb:revenue-review-saved', event => {
        if (!(event.target instanceof Element) || !event.target.closest('.review-action-btn')) return;
        if (dialog.open && dialog.contains(event.target)) {
            changed = true;
            if (returningToParent) parentChanged = true;
        }
        if (parent?.contains(event.target)) parentChanged = true;
    });
    document.addEventListener('sb:dialog-closed', event => {
        if (event.target.id === 'reviewActionModal' && dialog.open) {
            dialog.dispatchEvent(new CustomEvent('sb:revenue-preview-state'));
        }
    });
    dialog.addEventListener('sb:dialog-closed', event => {
        if (event.target !== dialog) return;
        if (returningToParent) {
            returningToParent = false;
            bootstrap.Modal.getOrCreateInstance(parent).show();
        } else if (changed) location.reload();
    });
    parent?.addEventListener('hidden.bs.modal', event => {
        if (event.target === parent && parentChanged && !returningToParent) location.reload();
    });
    function openFromRow(event, alertId, customerName, bucket) {
        if (event.target.closest('a, button')) return;
        return open(alertId, customerName, bucket);
    }
    window.openHomeAlertDetail = openFromRow;
    window.openAlertDetail = openFromRow;
    window.SBRevenueAlertPreview = Object.freeze({open});
})();
