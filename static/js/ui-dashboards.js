(function (global) {
    'use strict';

    async function saveDashboard(url, payload, fetcher) {
        const response = await fetcher(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || 'The server did not confirm the dashboard save.');
        }
        return data;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {saveDashboard};
    }
    if (!global.document) return;
    global.SBDashboards = Object.freeze({
        request: (url, payload) => saveDashboard(url, payload, global.fetch.bind(global)),
    });

    function init() {
        const root = document.querySelector('.sb-dashboards');
        if (!root) return;
        const errorBox = document.getElementById('dashboardError');
        const reading = document.getElementById('dashboardReading');
        const base = '/api/reports/dashboards';
        const dashboardUrl = base + '/' + root.dataset.dashboardId;
        let pending = false;

        function showError(error) {
            console.error('Dashboard operation:', error);
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            errorBox.focus();
        }

        if (reading) {
            const saved = global.history.state?.sbDashboardScroll;
            if (Number.isFinite(saved) && saved >= 0) reading.scrollTop = saved;
            global.addEventListener('pagehide', () => {
                try {
                    global.history.replaceState({
                        ...global.history.state, sbDashboardScroll: reading.scrollTop,
                    }, '');
                } catch (error) {
                    showError(new Error('Could not save the dashboard reading position. '
                        + error.message));
                }
            });
        }

        async function save(url, payload, destination) {
            if (pending) return;
            pending = true;
            errorBox.hidden = true;
            root.setAttribute('aria-busy', 'true');
            const controls = Array.from(root.querySelectorAll('button, input, select'));
            const disabled = controls.map(control => control.disabled);
            controls.forEach(control => { control.disabled = true; });
            try {
                const data = await saveDashboard(url, payload, global.fetch.bind(global));
                if (destination === 'created') {
                    if (!Number.isInteger(data.id) || data.id < 1) {
                        throw new Error('The server did not return the new dashboard identity.');
                    }
                    global.location.assign('/reports/dashboards/' + data.id + '/edit');
                } else if (destination) {
                    global.location.assign(destination);
                } else global.location.reload();
            } catch (error) {
                showError(error);
            } finally {
                pending = false;
                root.setAttribute('aria-busy', 'false');
                controls.forEach((control, index) => { control.disabled = disabled[index]; });
            }
        }

        root.querySelectorAll('[data-db-toggle]').forEach(button => {
            button.addEventListener('click', () => {
                const target = document.getElementById(button.dataset.dbToggle);
                target.hidden = !target.hidden;
                root.querySelectorAll('[data-db-toggle="' + target.id + '"]').forEach(toggle => {
                    toggle.setAttribute('aria-expanded', String(!target.hidden));
                });
                if (!target.hidden) target.querySelector('input, button')?.focus();
            });
        });
        root.querySelector('[data-dashboard-create]')?.addEventListener('submit', event => {
            event.preventDefault();
            save(base, {name: event.target.elements.name.value}, 'created');
        });
        root.querySelector('[data-dashboard-rename]')?.addEventListener('submit', event => {
            event.preventDefault();
            save(dashboardUrl, {name: event.target.elements.name.value});
        });
        root.querySelectorAll('[data-db-delete]').forEach(button => {
            button.addEventListener('click', () => {
                if (pending) return;
                if (global.confirm('Delete "' + button.dataset.dashboardName
                    + '" and its widget layout? Reports and customer data will not be deleted.')) {
                    save(base + '/' + button.dataset.dbDelete + '/delete',
                        {}, '/reports/dashboards');
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else init();
})(typeof window === 'undefined' ? globalThis : window);
