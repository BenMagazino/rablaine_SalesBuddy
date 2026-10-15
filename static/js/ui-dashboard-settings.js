/* Shared dashboard preferences preserve their existing immediate-save endpoints. */
(() => {
    'use strict';

    const root = document.querySelector('[data-sb-dashboard-settings]');
    if (!root) return;
    const refresh = root.querySelector('#refreshCopilotBtn');
    const result = root.querySelector('#dashboardRefreshResult');

    function message(element, text, state) {
        element.textContent = text;
        element.dataset.state = state;
        element.setAttribute('role', state === 'error' ? 'alert' : 'status');
    }

    async function request(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data?.error || 'Request failed (HTTP ' + response.status + ').');
        }
        const data = await response.json();
        if (data?.success !== true) {
            throw new Error(data?.error || 'The server did not confirm this change.');
        }
        return data;
    }

    for (const field of root.querySelectorAll('[data-preference]')) {
        let saved = field.checked;
        const status = document.createElement('span');
        status.className = 'sb-dashboard-setting-result';
        status.id = field.id + 'Status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        field.setAttribute('aria-describedby',
            field.getAttribute('aria-describedby') + ' ' + status.id);
        field.closest('.sb-dashboard-setting').appendChild(status);
        field.addEventListener('change', async () => {
            if (field.disabled) return;
            const value = field.checked;
            field.disabled = true;
            message(status, 'Saving...', 'busy');
            try {
                const data = await request('/api/preferences/dashboard-toggle', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({[field.dataset.preference]: value}),
                });
                if (data[field.dataset.preference] !== value) {
                    throw new Error('The server did not confirm the selected preference.');
                }
                saved = value;
                message(status, 'Saved.', 'success');
            } catch (error) {
                console.error('Dashboard preference save failed:', field.dataset.preference, error);
                field.checked = saved;
                message(status, 'Could not save. Try changing this option again. ' +
                    error.message, 'error');
            } finally {
                field.disabled = false;
            }
        });
    }

    refresh.addEventListener('click', async () => {
        if (refresh.disabled) return;
        refresh.disabled = true;
        refresh.setAttribute('aria-busy', 'true');
        message(result, 'Refreshing Copilot action items...', 'busy');
        try {
            const data = await request('/api/copilot-actions/sync', {
                method: 'POST',
                onJobProgress: job => message(result, window.SBJobs.message(job), 'busy'),
            });
            if (!Number.isInteger(data.items_created) || data.items_created < 0) {
                throw new Error('The server returned an invalid action item count.');
            }
            message(result, data.items_created + ' action item' +
                (data.items_created === 1 ? '' : 's') + ' created.', 'success');
        } catch (error) {
            console.error('Copilot action item refresh failed:', error);
            message(result, 'Could not refresh action items. ' + error.message, 'error');
        } finally {
            refresh.disabled = false;
            refresh.setAttribute('aria-busy', 'false');
        }
    });
})();
