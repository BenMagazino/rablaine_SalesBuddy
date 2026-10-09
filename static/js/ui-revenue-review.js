/** Shared review editor with native lifecycle and confirmed revenue writes. */
(() => {
    'use strict';
    if (window.SBRevenueReview) return;
    const dialog = document.getElementById('reviewActionModal');
    if (!dialog) throw new Error('Revenue review dialog is missing.');
    const find = id => {
        const control = document.getElementById(id);
        if (!control) throw new Error('Missing review control: ' + id);
        return control;
    };
    const form = find('reviewActionForm'), notes = find('reviewNotes');
    const result = find('reviewResult'), historyState = find('reviewHistoryState');
    const historyList = find('reviewHistoryList'), retry = find('reviewHistoryRetry');
    const discard = find('reviewDiscardDialog'), confirm = find('reviewDiscardConfirm');
    const radios = [...form.querySelectorAll('[name="reviewStatus"]')];
    const homes = [[dialog, dialog.parentElement], [discard, discard.parentElement]];
    const labels = {new: 'New', to_be_reviewed: 'To be reviewed', reviewed: 'Reviewed',
        actioned: 'Actioned', dismissed: 'Dismissed'};
    const icons = {new: 'circle', to_be_reviewed: 'hourglass-split', reviewed: 'eye',
        actioned: 'check2-circle', dismissed: 'dash-circle'};
    let selection = null, baseline = '', busy = false, request = null, generation = 0;
    let transition = null, bypass = false;

    function report(text, error = false) {
        result.textContent = text;
        result.dataset.state = error ? 'error' : 'status';
        result.setAttribute('role', error ? 'alert' : 'status');
    }

    function values() {
        return {review_status: radios.find(radio => radio.checked)?.value,
            review_notes: notes.value};
    }

    function dirty() {
        return !!selection && JSON.stringify(values()) !== baseline;
    }

    function guard(proceed) {
        if (busy) { report('Saving review. Please wait before leaving.'); return false; }
        if (dirty()) {
            if (!discard.open) { transition = proceed; SBDialog.open(discard); }
            return false;
        }
        return true;
    }

    function invalidate() {
        generation++;
        request?.abort();
        request = null;
    }

    function validateHistory(history) {
        if (!Array.isArray(history) || history.some(item => !item ||
            !Object.hasOwn(labels, item.review_status) ||
            (item.review_notes !== null && typeof item.review_notes !== 'string') ||
            typeof item.created_at !== 'string' || !item.created_at ||
            Number.isNaN(new Date(/(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(item.created_at) ?
                item.created_at : item.created_at + 'Z').getTime()))) {
            throw new Error('Invalid review history response.');
        }
        return history;
    }

    function badge(status, text) {
        const node = document.createElement('span');
        node.className = 'sb-review-badge review-badge';
        node.dataset.status = status;
        node.title = text || '';
        const icon = document.createElement('i');
        icon.className = 'bi bi-' + icons[status];
        icon.setAttribute('aria-hidden', 'true');
        node.appendChild(icon);
        node.appendChild(document.createTextNode(' ' + labels[status]));
        return node;
    }

    function renderHistory(history) {
        historyList.replaceChildren();
        for (const entry of history) {
            const row = document.createElement('div');
            row.className = 'sb-review-history-row';
            row.appendChild(badge(entry.review_status, ''));
            const detail = document.createElement('div'), date = document.createElement('time');
            date.className = 'local-datetime';
            date.setAttribute('data-utc', entry.created_at);
            detail.appendChild(date);
            if (entry.review_notes) {
                const text = document.createElement('p');
                text.textContent = entry.review_notes;
                detail.appendChild(text);
            }
            row.appendChild(detail);
            historyList.appendChild(row);
        }
        SBLocalDateTime.render(historyList);
        historyState.textContent = history.length ? '' : 'No reviews yet.';
        historyState.setAttribute('role', 'status');
        historyState.dataset.state = 'status';
        retry.hidden = true;
    }

    async function loadHistory() {
        invalidate();
        const version = generation, snapshot = selection;
        const controller = new AbortController();
        request = controller;
        historyList.replaceChildren();
        historyList.setAttribute('aria-busy', 'true');
        historyState.textContent = 'Loading review history...';
        historyState.dataset.state = 'status';
        historyState.setAttribute('role', 'status');
        retry.hidden = true;
        try {
            const response = await fetch('/api/revenue/analysis/' + snapshot.id + '/review-history',
                {signal: controller.signal});
            if (!response.ok) throw new Error('Review history HTTP ' + response.status + '.');
            const data = await response.json();
            if (version !== generation || !dialog.open) return;
            renderHistory(validateHistory(data.history));
        } catch (error) {
            if (version !== generation || controller.signal.aborted) return;
            console.error('Unable to load revenue review history:', snapshot.id, error);
            historyState.textContent = 'Could not load review history. Your edits are unchanged.';
            historyState.dataset.state = 'error';
            historyState.setAttribute('role', 'alert');
            retry.hidden = false;
        } finally {
            if (version === generation) {
                request = null;
                historyList.setAttribute('aria-busy', 'false');
            }
        }
    }

    function replace(id, status, text, opener) {
        invalidate();
        selection = {id, opener};
        find('reviewAnalysisId').value = id;
        notes.value = text || '';
        for (const radio of radios) radio.checked = radio.value === status;
        baseline = JSON.stringify(values());
        report('');
        // Keep native children inside the legacy parent's focus-trap boundary.
        const parent = opener?.closest('.modal.show');
        for (const [child, home] of homes) (parent || home).appendChild(child);
        SBDialog.open(dialog);
        notes.focus();
        return loadHistory();
    }

    function open(id, status = 'new', text = '', opener = document.activeElement) {
        id = Number(id);
        if (!Number.isSafeInteger(id) || id < 1 || !Object.hasOwn(labels, status) ||
            (text !== null && typeof text !== 'string')) {
            throw new Error('Invalid revenue review selection.');
        }
        if (dialog.open && selection?.id === id) return;
        if (!guard(() => replace(id, status, text, opener))) return;
        return replace(id, status, text, opener);
    }

    function updateConsumers(snapshot, data) {
        document.querySelectorAll('[data-review-id="' + snapshot.id + '"]')
            .forEach(node => node.replaceChildren(badge(data.review_status, data.review_notes)));
        document.querySelectorAll('.review-action-btn[data-analysis-id="' + snapshot.id + '"]')
            .forEach(button => {
                button.dataset.status = data.review_status;
                button.dataset.notes = data.review_notes || '';
            });
        document.querySelectorAll('tr[data-analysis-id="' + snapshot.id + '"]').forEach(row => {
            row.style.opacity = ['new', 'to_be_reviewed'].includes(data.review_status) ? '' : '0.6';
        });
        document.querySelectorAll('[data-review-previous-id="' + snapshot.id + '"]')
            .forEach(node => node.remove());
        (snapshot.opener?.isConnected ? snapshot.opener : document).dispatchEvent(
            new CustomEvent('sb:revenue-review-saved', {
                bubbles: true, detail: {analysisId: snapshot.id},
            }));
    }

    async function save() {
        if (busy || !selection || !dialog.open) return;
        const payload = values(), snapshot = selection;
        if (!Object.hasOwn(labels, payload.review_status)) {
            report('Choose a review status before saving.', true);
            return;
        }
        busy = true;
        let confirmed = false;
        for (const control of form.querySelectorAll('input, textarea, button')) control.disabled = true;
        report('Saving review...');
        try {
            const response = await fetch('/api/revenue/analysis/' + snapshot.id + '/review', {
                method: 'PATCH', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Review save HTTP ' + response.status + '.');
            const data = await response.json();
            if (data?.success !== true || data.review_status !== payload.review_status ||
                !Object.hasOwn(data, 'review_notes') ||
                (data.review_notes ?? '') !== payload.review_notes.trim()) {
                throw new Error(data?.error || 'The server did not confirm this review.');
            }
            confirmed = true;
            invalidate();
            historyList.setAttribute('aria-busy', 'false');
            baseline = JSON.stringify(values());
            updateConsumers(snapshot, data);
            report('Review saved.');
            busy = false;
            SBDialog.close(dialog, 'saved');
        } catch (error) {
            console.error('Unable to complete revenue review:', snapshot.id, error);
            report(confirmed
                ? 'Review saved, but the page could not update. Reload the page to see the saved review.'
                : 'Could not confirm the review save. Your edits are still here. Try Save again.',
            true);
        } finally {
            busy = false;
            for (const control of form.querySelectorAll('input, textarea, button')) {
                control.disabled = false;
            }
        }
    }

    dialog.addEventListener('sb:dialog-before-close', event => {
        if (event.target !== dialog || bypass) return;
        if (!guard(() => SBDialog.close(dialog, event.detail.reason))) event.preventDefault();
    });
    dialog.addEventListener('sb:dialog-closed', event => {
        if (event.target !== dialog) return;
        invalidate();
        selection = null;
        for (const [child, home] of homes) home.appendChild(child);
    });
    discard.addEventListener('sb:dialog-closed', () => { transition = null; });
    confirm.addEventListener('click', () => {
        const proceed = transition;
        if (!proceed) return;
        SBDialog.close(discard, 'discard');
        bypass = true;
        try { proceed(); } finally { bypass = false; }
    });
    form.addEventListener('submit', event => { event.preventDefault(); save(); });
    retry.addEventListener('click', () => {
        notes.focus();
        loadHistory();
    });
    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest('.review-action-btn');
        if (button) open(button.dataset.analysisId, button.dataset.status, button.dataset.notes, button);
    });
    window.addEventListener('beforeunload', event => {
        if (!busy && !dirty()) return;
        event.preventDefault();
        event.returnValue = '';
    });
    window.addEventListener('pagehide', invalidate);
    window.addEventListener('pageshow', event => {
        if (event.persisted && dialog.open && selection) loadHistory();
    });
    window.SBRevenueReview = Object.freeze({open, save});
    window.openReviewModal = open;
    window.saveReview = save;
})();
