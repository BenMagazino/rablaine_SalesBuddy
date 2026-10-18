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

    if (typeof module !== 'undefined' && module.exports) module.exports = {saveDashboard};
    if (!global.document) return;
    global.SBDashboards = Object.freeze({
        request: (url, payload) => saveDashboard(url, payload, global.fetch.bind(global)),
    });

    function init() {
        const root = document.querySelector('.sb-dashboards');
        if (!root) return;
        const commands = document.getElementById('layoutEditor') || root;
        const errorBox = document.getElementById('dashboardError');
        const reading = document.getElementById('dashboardReading');
        const base = '/api/reports/dashboards';
        let pending = false;

        function showError(error) {
            console.error('Dashboard operation:', error);
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            errorBox.focus();
        }

        function updateDraftRows() {
            root.querySelectorAll('[data-dashboard-row]').forEach(row => {
                const badge = row.querySelector('[data-dashboard-draft]');
                const edit = row.querySelector('[data-dashboard-edit]');
                try {
                    const draft = global.SBDashboardDrafts.read(row.dataset.dashboardRow);
                    badge.hidden = !draft;
                    badge.textContent = 'Draft';
                    badge.title = draft ? 'Changes are saved in this browser, not yet published.' : '';
                    edit.textContent = draft ? 'Edit draft' : 'Edit';
                } catch (error) {
                    badge.hidden = false;
                    badge.textContent = 'Draft unavailable';
                    edit.textContent = 'Edit draft';
                    showError(new Error('Could not read a local dashboard draft. ' + error.message));
                }
            });
        }
        updateDraftRows();
        global.addEventListener?.('storage', updateDraftRows);
        global.addEventListener?.('pageshow', updateDraftRows);

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

        async function save(url, payload, destination, deletedId) {
            if (pending) return;
            pending = true;
            errorBox.hidden = true;
            root.setAttribute('aria-busy', 'true');
            const controls = Array.from(new Set([
                ...root.querySelectorAll('button, input, select'),
                ...commands.querySelectorAll('button, input, select'),
            ]));
            const disabled = controls.map(control => control.disabled);
            controls.forEach(control => { control.disabled = true; });
            try {
                const data = await saveDashboard(url, payload, global.fetch.bind(global));
                if (deletedId !== undefined) {
                    try {
                        global.SBDashboardDrafts.remove(deletedId);
                    } catch (error) {
                        showError(new Error('Dashboard deleted, but its local draft could not be '
                            + 'removed. ' + error.message));
                        return;
                    }
                }
                if (destination === 'created') {
                    if (!Number.isInteger(data.id) || data.id < 1) {
                        throw new Error('The server did not return the new dashboard identity.');
                    }
                    global.location.assign('/reports/dashboards/' + data.id + '/edit');
                } else global.location.assign(destination);
            } catch (error) {
                showError(error);
            } finally {
                pending = false;
                root.setAttribute('aria-busy', 'false');
                controls.forEach((control, index) => { control.disabled = disabled[index]; });
            }
        }

        root.querySelector('[data-dashboard-create]')?.addEventListener('submit', event => {
            event.preventDefault();
            save(base, {
                name: event.target.elements.name.value,
                subtitle: event.target.elements.subtitle.value,
            }, 'created');
        });
        commands.querySelectorAll('[data-db-delete]').forEach(button => {
            button.addEventListener('click', () => {
                if (pending) return;
                if (global.confirm('Delete "' + button.dataset.dashboardName
                    + '" and its widget layout and local draft? '
                    + 'Reports and customer data will not be deleted.')) {
                    save(base + '/' + button.dataset.dbDelete + '/delete',
                        {}, '/reports/dashboards', button.dataset.dbDelete);
                }
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window === 'undefined' ? globalThis : window);
