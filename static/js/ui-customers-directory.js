/** Customer directory over the unchanged server scope, ordering and import APIs. */
(() => {
    'use strict';
    function validateReading(value) {
        if (!value || !Number.isFinite(value.top) || value.top < 0 ||
                !Number.isFinite(value.left) || value.left < 0 ||
                !Array.isArray(value.expanded) ||
                !value.expanded.every(key => typeof key === 'string')) {
            throw new Error('Invalid customer directory reading context.');
        }
        return value;
    }
    async function post(url, payload) {
        const response = await fetch(url, {method: 'POST',
            headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
        const result = await response.json();
        if (!response.ok || result.success === false ||
                (url.startsWith('/api/customer/') && result.success !== true)) {
            const error = new Error(result.error || 'The server did not confirm the change.');
            error.existingId = result.existing_id;
            throw error;
        }
        return result;
    }
    if (typeof module !== 'undefined') module.exports = {validateReading, post};
    if (typeof document === 'undefined') return;
    const root = document.querySelector('[data-customer-directory]');
    if (!root) return;
    const reading = root.querySelector('.sb-cust-reading');
    const groups = [...root.querySelectorAll('[data-seller-key]')];
    const notice = root.querySelector('[data-customer-notice]');
    let pending = false, restoring = true;
    const storageKey = 'salesbuddy_expanded_sellers';
    const report = message => { notice.textContent = message; notice.hidden = !message; };
    function saveReading() {
        if (restoring || pending) return;
        history.replaceState({...history.state, sbCustomerDirectory: {
            top: reading.scrollTop, left: reading.scrollLeft,
            expanded: groups.filter(group => group.open).map(group => group.dataset.sellerKey),
        }}, '');
    }
    function restore() {
        restoring = true;
        try {
            const saved = history.state?.sbCustomerDirectory;
            const expanded = saved ? validateReading(saved).expanded :
                JSON.parse(localStorage.getItem(storageKey) || '[]');
            groups.forEach(group => { group.open = expanded.includes(group.dataset.sellerKey); });
            if (saved) {
                reading.scrollTop = saved.top; reading.scrollLeft = saved.left;
            }
        } catch (error) { report(error.message); }
        restoring = false;
    }
    restore();
    groups.forEach(group => {
        group.addEventListener('toggle', () => {
            if (restoring) return;
            localStorage.setItem(storageKey, JSON.stringify(
                groups.filter(item => item.open).map(item => item.dataset.sellerKey)));
            saveReading();
        });
        group.querySelector('summary').addEventListener('click', event => {
            if (event.target.closest('a')) event.stopPropagation();
        });
    });
    for (const [id, open] of [['expandAllBtn', true], ['collapseAllBtn', false]]) {
        document.getElementById(id)?.addEventListener('click', () => {
            groups.forEach(group => { group.open = open; });
        });
    }
    document.getElementById('customerDirectoryCount').textContent =
        root.querySelectorAll('[data-customer-id]').length + ' customers';
    reading.addEventListener('scroll', saveReading, {passive: true});
    window.addEventListener('pagehide', saveReading);
    window.addEventListener('pageshow', restore);
    root.addEventListener('click', event => {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey ||
                event.shiftKey || event.altKey || event.target.closest('a,button,summary')) return;
        const row = event.target.closest('[data-customer-href]');
        if (row) {
            if (pending) { report('Wait for the current request before leaving.'); return; }
            saveReading(); window.location.assign(row.dataset.customerHref);
        }
    });
    async function preference(url, payload) {
        if (pending) return;
        pending = true;
        const buttons = [...root.querySelectorAll('[data-sort],#toggleShowWithoutCalls')];
        buttons.forEach(button => { button.disabled = true; });
        try {
            await post(url, payload);
            const sorts = {...history.state?.sbTableSort};
            Object.keys(sorts).filter(key => key.startsWith('customers-'))
                .forEach(key => { delete sorts[key]; });
            history.replaceState({...history.state, sbTableSort: sorts,
                sbCustomerDirectory: null}, '');
            window.location.reload();
        } catch (error) {
            report('Customer view preference was not saved. ' + error.message);
            buttons.forEach(button => { button.disabled = false; });
            pending = false;
        }
    }
    root.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () =>
        preference('/api/preferences/customer-sort-by', {customer_sort_by: button.dataset.sort})));
    document.getElementById('toggleShowWithoutCalls').addEventListener('click', () =>
        preference('/api/preferences/show-customers-without-calls',
            {show_customers_without_calls: root.dataset.showWithoutCalls !== 'true'}));
    function drafts() {
        root.querySelectorAll('.draft-indicator').forEach(item => item.remove());
        root.querySelectorAll('[data-customer-id]').forEach(row => {
            if (!localStorage.getItem('salesbuddy_draft_' + row.dataset.customerId)) return;
            const badge = document.createElement('span');
            badge.className = 'sb-cust-tag draft-indicator';
            badge.textContent = 'Draft';
            badge.title = 'This customer has an unsaved draft note';
            row.querySelector('.sb-cust-name').after(badge);
        });
    }
    drafts();
    window.addEventListener('storage', event => {
        if (!event.key || event.key.startsWith('salesbuddy_draft_')) drafts();
    });

    const dialog = document.getElementById('tpidImportModal');
    const input = document.getElementById('tpidInput');
    const lookup = document.getElementById('tpidLookupBtn');
    const importButton = document.getElementById('tpidImportBtn');
    const view = document.getElementById('tpidViewBtn');
    const error = document.getElementById('tpidError');
    const importError = document.getElementById('tpidImportError');
    const steps = [1, 2, 3].map(id => document.getElementById('tpidStep' + id));
    let account = null, imported = false;
    function stage(index) {
        steps.forEach((step, i) => { step.hidden = i !== index; });
        importButton.hidden = index !== 1;
        view.hidden = index !== 2;
    }
    function reset() {
        stage(0); error.hidden = importError.hidden = true;
        input.value = ''; account = null; imported = false;
        input.disabled = lookup.disabled = importButton.disabled = false;
        lookup.textContent = 'Look Up'; importButton.textContent = 'Import Customer';
    }
    dialog.addEventListener('sb:dialog-opened', reset);
    function guard(event) {
        if (pending) {
            event.preventDefault(); report('Wait for the current request before leaving.');
        } else if (dialog.open && !imported && input.value &&
                !window.confirm('Discard the unsaved TPID import?')) event.preventDefault();
    }
    dialog.addEventListener('sb:dialog-before-close', guard);
    document.addEventListener('click', event => {
        if (!event.target.closest('a[href]') || event.defaultPrevented) return;
        guard(event);
        if (!event.defaultPrevented) saveReading();
    }, true);
    window.addEventListener('beforeunload', event => {
        if (!pending && (!dialog.open || imported || !input.value)) return;
        event.preventDefault(); event.returnValue = '';
    });
    function showError(target, failure) {
        target.textContent = failure.message;
        if (failure.existingId) {
            const link = document.createElement('a');
            link.href = '/customer/' + failure.existingId;
            link.textContent = ' View customer'; target.append(link);
        }
        target.hidden = false;
    }
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); lookup.click(); }
    });
    lookup.addEventListener('click', async () => {
        const tpid = input.value.trim();
        if (!tpid || pending) return;
        pending = true; lookup.disabled = input.disabled = true;
        lookup.textContent = 'Looking up...'; error.hidden = true;
        try {
            const data = await post('/api/customer/tpid-lookup', {tpid});
            account = data.account;
            for (const [id, value] of Object.entries({
                previewName: account.name, previewTpid: account.tpid,
                previewWebsite: account.website, previewTerritory: account.territory_name,
                previewSeller: account.seller_name,
                previewVertical: account.vertical || account.vertical_category,
            })) document.getElementById(id).textContent = value || '-';
            stage(1);
        } catch (failure) { showError(error, failure); }
        finally {
            pending = false; lookup.disabled = input.disabled = false;
            lookup.textContent = 'Look Up';
        }
    });
    importButton.addEventListener('click', async () => {
        if (!account || pending) return;
        pending = true; importButton.disabled = true;
        importButton.textContent = 'Importing...'; importError.hidden = true;
        try {
            const data = await post('/api/customer/tpid-import', {account});
            imported = true; stage(2);
            document.getElementById('importSuccessMsg').textContent =
                data.customer_name + ' imported!';
            const details = [];
            if (data.territory_name) details.push('Territory: ' + data.territory_name);
            if (data.seller_name) details.push('Seller: ' + data.seller_name);
            const importDetails = document.getElementById('importSuccessDetails');
            importDetails.textContent = details.join(' | ');
            if (data.sync?.accepted && data.sync.job_id) {
                const importedAccount = account;
                const showSync = message => {
                    if (!imported || account !== importedAccount) return;
                    importDetails.textContent = [...details, message].join(' | ');
                };
                showSync('MSX data sync queued.');
                window.SBJobs.observe(data.sync.job_id, {
                    onProgress: job => showSync(window.SBJobs.message(job)),
                }).then(job => {
                    if (job.status === 'failed') {
                        console.error('Imported customer data sync failed:', job.error);
                        showSync('Customer imported, but its MSX data sync failed: ' + job.error);
                    } else {
                        showSync('MSX data sync completed.');
                    }
                }).catch(error => {
                    console.error('Could not observe imported customer data sync:', error);
                    showSync('Customer imported. Data sync status unavailable: ' + error.message);
                });
            }
            view.href = '/customer/' + data.customer_id;
        } catch (failure) { showError(importError, failure); }
        finally {
            pending = false; importButton.disabled = false;
            importButton.textContent = 'Import Customer';
        }
    });
})();
