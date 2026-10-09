/** One native milestone preview shared by all existing launcher surfaces. */
(() => {
    'use strict';
    let preview = null;
    function open(id, title = '', status = '', msxUrl = '') {
        if (!preview) {
            preview = SBRecordDialog.create('milestonePreviewDialog', {
                loadUrl: id => `/api/milestone/${id}/detail`,
                fullUrl: id => `/milestone/${id}`,
                fragmentSelector: '[data-sb-milestone-detail]',
                identityAttribute: 'data-sb-milestone-id',
                mount: root => SBMilestoneWorkflow.activate(root),
                statusText: 'Changes save when you submit them.',
                busyText: 'Saving milestone changes. Please wait before leaving.',
                errorText: 'The milestone could not be loaded. Retry or use Full Page.',
                discardText: 'Your milestone draft has not been saved. ' +
                    'Keep editing, or discard the draft to continue.',
                stateEvent: 'sb:record-state',
                onSelection(snapshot) {
                    const badge = document.getElementById('milestonePreviewStatus');
                    badge.textContent = snapshot.status;
                    badge.hidden = !snapshot.status;
                    badge.dataset.status = snapshot.status;
                    const link = document.getElementById('milestonePreviewMsxLink');
                    link.hidden = !snapshot.msxUrl;
                    if (snapshot.msxUrl) link.href = snapshot.msxUrl;
                    else link.removeAttribute('href');
                },
            });
        }
        return preview.open({id: Number(id), title: title || 'Milestone', status, msxUrl});
    }
    window.SBMilestonePreview = Object.freeze({open});
})();
