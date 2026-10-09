/** Shared revenue preview and Seller Full View return lifecycle. */
(() => {
    'use strict';
    const dialog = document.querySelector('[data-sb-revenue-preview]');
    if (!dialog) throw new Error('Revenue preview is missing.');
    const parentId = dialog.dataset.sbRevenueParent;
    const parent = parentId ? document.getElementById(parentId) : null;
    if (parentId && !parent) throw new Error('Revenue preview parent is missing.');
    const parentStatus = parent?.querySelector('[data-sb-revenue-status]');
    if (parent && !parentStatus) throw new Error('Revenue Full View status is missing.');
    const defaultStatus = 'Review changes save when you submit them.';
    let preview = null, changed = false, parentChanged = false;
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
                statusText: defaultStatus,
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
        return preview.open(selection);
    }
    document.addEventListener('sb:revenue-review-saved', event => {
        if (!(event.target instanceof Element) || !event.target.closest('.review-action-btn')) return;
        if (dialog.open && dialog.contains(event.target)) {
            changed = true;
            if (parent?.open) parentChanged = true;
        }
        if (parent?.contains(event.target)) parentChanged = true;
    });
    document.addEventListener('sb:dialog-closed', event => {
        if (event.target.id === 'reviewActionModal' && dialog.open) {
            dialog.dispatchEvent(new CustomEvent('sb:revenue-preview-state'));
        }
        if (parent?.open && (event.target === dialog || event.target.id === 'reviewActionModal')) {
            parentStatus.textContent = defaultStatus;
        }
    });
    dialog.addEventListener('sb:dialog-closed', event => {
        if (event.target !== dialog) return;
        if (changed && !parent?.open) location.reload();
    });
    parent?.addEventListener('sb:dialog-before-close', event => {
        if (event.target !== parent) return;
        if (dialog.open || document.getElementById('reviewActionModal')?.open) {
            event.preventDefault();
            parentStatus.textContent = 'Close the alert preview or Review Alert before leaving Full View.';
        }
    });
    parent?.addEventListener('sb:dialog-closed', event => {
        if (event.target === parent && parentChanged) location.reload();
    });
    function openFromRow(event, alertId, customerName, bucket) {
        if (event.target.closest('a, button')) return;
        return open(alertId, customerName, bucket);
    }
    window.openHomeAlertDetail = openFromRow;
    window.openAlertDetail = openFromRow;
    window.SBRevenueAlertPreview = Object.freeze({open});
})();
