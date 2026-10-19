(function (global) {
    'use strict';

    async function readRequirement(key, fetcher) {
        const response = await fetcher('/api/reports/dashboards/requirements/'
            + encodeURIComponent(key));
        const data = await response.json();
        if (!response.ok || data.success !== true || typeof data.html !== 'string'
            || typeof data.setup?.ready !== 'boolean') {
            throw new Error(data.error || 'The server did not return widget setup.');
        }
        return data;
    }

    async function refreshSavedWidgets(root, key, fetcher, goals) {
        const tiles = Array.from(root.querySelectorAll('[data-widget-id]'))
            .filter(tile => Array.from(tile.querySelectorAll('[data-widget-requirement]'))
                .some(button => button.dataset.widgetRequirement === key));
        const results = await Promise.allSettled(tiles.map(async tile => {
            const query = new URLSearchParams({
                key: tile.dataset.widgetKey, variant: tile.dataset.variant,
                width: tile.dataset.columnSpan, instance_id: tile.dataset.widgetId,
            });
            if (global.SBDashboardFilters) {
                query.set('filter_context', JSON.stringify(global.SBDashboardFilters.context(
                    JSON.parse(tile.dataset.widgetFilters || '{}'))));
            }
            const response = await fetcher('/api/reports/dashboards/widget-preview?' + query);
            const data = await response.json();
            if (!response.ok || data.success !== true || typeof data.html !== 'string') {
                throw new Error(data.error || 'The server did not return widget content.');
            }
            goals.destroy(tile);
            tile.querySelector('.db-widget-body').remove();
            tile.insertAdjacentHTML('afterbegin', data.html);
            goals.init(tile);
        }));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {readRequirement, refreshSavedWidgets};
    }
    if (!global.document) return;

    function init() {
        const dialog = document.getElementById('dashboardRequirementDialog');
        if (!dialog) return;
        const form = document.getElementById('dashboardRequirementForm');
        const choices = document.getElementById('dashboardRequirementChoices');
        const status = document.getElementById('dashboardRequirementStatus');
        const confirm = document.getElementById('confirmDashboardRequirement');
        const fetcher = global.fetch.bind(global);
        let key = null;
        let busy = false;
        let loaded = false;
        let saved = false;
        let complete = false;
        let storageWarning = '';

        function message(text, error = false) {
            status.textContent = text;
            status.classList.toggle('db-error', error);
        }
        function setBusy(value) {
            busy = value;
            form.setAttribute('aria-busy', String(value));
            confirm.disabled = value;
            choices.querySelectorAll('input').forEach(input => { input.disabled = value || saved; });
        }
        async function load() {
            setBusy(true);
            message('Loading compensation buckets...');
            try {
                const data = await readRequirement(key, fetcher);
                choices.innerHTML = data.html;
                loaded = true;
                confirm.hidden = !data.setup.available_buckets.length
                    || data.setup.fiscal_year !== data.setup.configured_fiscal_year;
                confirm.textContent = 'Confirm buckets';
                message('');
            } catch (error) {
                console.error('Widget prerequisite setup:', error);
                confirm.textContent = 'Retry loading';
                message('Could not load setup. ' + error.message, true);
            } finally {
                setBusy(false);
            }
        }
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-widget-requirement]');
            if (!button || busy) return;
            key = button.dataset.widgetRequirement;
            loaded = saved = complete = false;
            storageWarning = '';
            choices.replaceChildren();
            confirm.hidden = false;
            global.SBDialog.open(dialog);
            load();
        });
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (busy) event.preventDefault();
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (busy) return;
            if (complete) {
                global.SBDialog.close(dialog, 'confirmed');
                return;
            }
            if (!loaded) {
                await load();
                return;
            }
            const selected = Array.from(choices.querySelectorAll('input:checked'))
                .map(input => input.value);
            if (!saved && !selected.length) {
                message('Select at least one compensation bucket to continue.', true);
                return;
            }
            setBusy(true);
            message(saved ? 'Refreshing widgets...' : 'Saving compensation buckets...');
            try {
                if (!saved) {
                    const data = await global.SBConnectGoals.confirmBuckets(selected, fetcher);
                    saved = true;
                    try {
                        global.localStorage.setItem(
                            'salesbuddy_revenue_bucket_filter', JSON.stringify(selected));
                        global.localStorage.setItem('salesbuddy_revenue_bucket_taxonomy_version',
                            String(data.taxonomy_version));
                    } catch (error) {
                        console.error('Widget prerequisite browser preferences:', error);
                        storageWarning = ' Browser filter preferences could not be updated.';
                    }
                }
                const current = await readRequirement(key, fetcher);
                if (!current.setup.ready) {
                    saved = false;
                    choices.innerHTML = current.html;
                    throw new Error(current.setup.reasons.join(' '));
                }
                if (global.SBDashboardEditor) {
                    await global.SBDashboardEditor.refreshRequirement(key);
                } else {
                    await refreshSavedWidgets(document.querySelector('[data-dashboard-id]'),
                        key, fetcher, global.SBConnectGoals);
                }
                global.dispatchEvent(new CustomEvent('sb:widget-requirements-changed',
                    {detail: {key}}));
                complete = true;
                message('Buckets saved. All dependent widgets are updated.' + storageWarning);
                confirm.textContent = 'Done';
            } catch (error) {
                console.error('Widget prerequisite confirmation:', error);
                message((saved ? 'Buckets saved, but widgets could not all refresh. '
                    : 'Could not confirm compensation buckets. ') + error.message, true);
                confirm.textContent = saved ? 'Retry refresh' : 'Confirm buckets';
            } finally {
                setBusy(false);
            }
            if (complete && !storageWarning) global.SBDialog.close(dialog, 'confirmed');
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window === 'undefined' ? globalThis : window);
