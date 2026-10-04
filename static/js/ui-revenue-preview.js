/** Home revenue preview using the shared native record loader. */
(() => {
    'use strict';
    const dialog = document.getElementById('homeAlertDetailModal');
    if (!dialog) throw new Error('Home revenue preview is missing.');
    let preview = null, changed = false;
    function open(id, customerName, bucket) {
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
        return preview.open({id: Number(id), title: customerName + ' - ' + bucket});
    }
    document.addEventListener('sb:revenue-review-saved', event => {
        if (dialog.open && event.target instanceof Element &&
            event.target.closest('#homeAlertDetailModal .review-action-btn')) changed = true;
    });
    document.addEventListener('sb:dialog-closed', event => {
        if (event.target.id === 'reviewActionModal' && dialog.open) {
            dialog.dispatchEvent(new CustomEvent('sb:revenue-preview-state'));
        }
    });
    dialog.addEventListener('sb:dialog-closed', event => {
        if (event.target === dialog && changed) location.reload();
    });
    window.SBRevenueAlertPreview = Object.freeze({open});
})();
