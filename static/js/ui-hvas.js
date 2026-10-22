/* HVA inventory navigation delegates durable work and sorting controls to shared helpers. */
(() => {
    'use strict';
    const root = document.querySelector('.sb-hvas');
    if (!root) return;
    root.querySelectorAll('[data-hva-action]').forEach(action => {
        const button = action.querySelector('[data-hva-complete]');
        const confirmation = action.querySelector('[data-hva-confirmation]');
        const confirm = action.querySelector('[data-hva-confirm]');
        const cancel = action.querySelector('[data-hva-cancel]');
        const message = action.querySelector('[data-hva-result]');
        let pending = false;
        let completed = false;
        button.addEventListener('click', () => {
            if (pending || completed) return;
            button.hidden = true;
            confirmation.hidden = false;
            message.hidden = true;
            confirm.focus();
        });
        cancel.addEventListener('click', () => {
            if (pending || completed) return;
            confirmation.hidden = true;
            button.hidden = false;
            button.focus();
        });
        confirm.addEventListener('click', async () => {
            if (pending || completed) return;
            pending = true;
            action.setAttribute('aria-busy', 'true');
            confirm.disabled = cancel.disabled = true;
            message.hidden = false;
            message.setAttribute('role', 'status');
            message.textContent = 'Completing in MSX...';
            try {
                const response = await fetch(action.dataset.completeUrl, {
                    method: 'POST', headers: {'Accept': 'application/json'},
                });
                const result = await response.json().catch(error => {
                    throw new Error(
                        'Could not read the completion response. Check MSX before retrying.',
                        {cause: error},
                    );
                });
                if (!result || typeof result !== 'object') {
                    throw new Error('Could not read the completion response. Check MSX.');
                }
                if (!response.ok || result.success !== true) {
                    completed = result.remote_changed === true;
                    throw new Error(result.error || 'MSX could not complete this HVA.');
                }
                completed = true;
                confirmation.hidden = true;
                message.textContent = 'Completed in MSX. Updating report...';
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                console.error('HVA completion failed:', error);
                confirmation.hidden = true;
                button.hidden = completed;
                message.setAttribute('role', 'alert');
                message.textContent = error.message || 'Could not complete this HVA. Check MSX.';
                if (!completed) {
                    button.textContent = 'Retry complete';
                    button.focus();
                }
            } finally {
                pending = false;
                action.setAttribute('aria-busy', 'false');
                confirm.disabled = cancel.disabled = false;
            }
        });
    });
    const table = root.querySelector('#hvaTable');
    table?.addEventListener('sb:table-sort', event => {
        const header = table.querySelectorAll('thead th')[event.detail.column];
        const url = new URL(window.location.href);
        url.searchParams.set('sort', header.dataset.hvaSort);
        url.searchParams.set('direction', event.detail.direction === 'ascending' ? 'asc' : 'desc');
        url.searchParams.set('page', '1');
        window.location.assign(url);
    });
    root.querySelector('#hvaPageSize').addEventListener('change', event => {
        const url = new URL(window.location.href);
        url.searchParams.set('per_page', event.target.value);
        url.searchParams.set('page', '1');
        window.location.assign(url);
    });
    const progress = window.SBSyncProgress.create(
        root.querySelector('[data-sb-sync-progress]'),
        {onComplete: () => window.location.reload()},
    );
    root.querySelector('#hvaRefresh').addEventListener('click', () => {
        progress.start().catch(error => console.error('HVA task refresh failed:', error));
    });
})();
