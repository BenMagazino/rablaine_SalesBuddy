/* Subscription details with source account renewal status on both P to F surfaces. */
(() => {
    'use strict';
    const missing = 'Not supplied';
    function dateValue(value) {
        if (value == null) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid renewal date.');
        const date = new Date(`${value}T00:00:00Z`);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw new Error('Invalid renewal date.');
        }
        return date;
    }
    function formatDate(value) {
        const date = dateValue(value);
        return date ? new Intl.DateTimeFormat('en-GB', {
            day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC',
        }).format(date).replaceAll(' ', '-') : missing;
    }
    function money(value) {
        return value == null ? missing : '$' + new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(value);
    }
    function filterRows(rows, query) {
        const needle = query.trim().toLocaleLowerCase();
        return rows.filter(row => [row.customer_name, row.source_customer_name, row.tpid]
            .some(value => String(value ?? '').toLocaleLowerCase().includes(needle)));
    }
    function renewalStyle(status) {
        switch (status) {
        case 'PSKU Renewed + New Fabric':
        case 'PSKU Renewed':
        case 'P-to-F Renewed':
            return {tone: 'success', icon: 'bi-check-circle-fill'};
        case 'Pending Renewal':
        case 'Partial P-to-F':
            return {tone: 'warning', icon: 'bi-exclamation-circle-fill'};
        case 'Not Renewed':
            return {tone: 'danger', icon: 'bi-x-circle-fill'};
        default:
            return {tone: 'neutral', icon: 'bi-question-circle'};
        }
    }
    function renewalExplanation(status) {
        switch (status) {
        case 'PSKU Renewed + New Fabric':
            return 'Both P-SKU and F-SKU renewal percentages are at least 75%.';
        case 'PSKU Renewed':
            return 'P-SKU renewal is at least 75%, while F-SKU renewal is below 75%.';
        case 'P-to-F Renewed':
            return 'F-SKU renewal is at least 75%, while P-SKU renewal is below 75%.';
        case 'Partial P-to-F':
            return 'F-SKU renewal is at least 30% but below 75%, and P-SKU renewal is below 75%.';
        case 'Pending Renewal':
            return 'P-SKU renewal is below 75% and F-SKU renewal is below 30%.';
        case 'Not Renewed':
            return 'The source marks this account as Not Renewed. Its published legend does not ' +
                'define the rule, so Sales Buddy does not guess a percentage threshold.';
        default:
            return 'This status comes from the source model. Its published legend does not ' +
                'provide an explanation for this value.';
        }
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {formatDate, dateValue, money, filterRows, renewalStyle,
            renewalExplanation};
    }
    if (typeof document === 'undefined') return;

    let helpId = 0;
    function addRenewalHelp(indicator, status) {
        const tooltip = document.createElement('span');
        tooltip.id = `ptof-renewal-help-${++helpId}`;
        tooltip.className = 'sb-ptof-status-help';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('popover', 'manual');
        tooltip.textContent = `${renewalExplanation(status)} ` +
            'P-SKU means Power BI Premium capacity; F-SKU means Microsoft Fabric capacity. ' +
            'Renewal percentages are source assessments, not capacity utilization.';
        indicator.tabIndex = 0;
        indicator.setAttribute('aria-describedby', tooltip.id);
        indicator.setAttribute('data-sb-dialog-escape-owner', '');
        indicator.setAttribute('aria-expanded', 'false');
        indicator.append(tooltip);
        const hide = () => {
            tooltip.hidePopover();
            indicator.setAttribute('aria-expanded', 'false');
        };
        const show = () => {
            tooltip.showPopover();
            indicator.setAttribute('aria-expanded', 'true');
            const anchor = indicator.getBoundingClientRect();
            const bounds = tooltip.getBoundingClientRect();
            tooltip.style.left = `${Math.max(8,
                Math.min(anchor.left, innerWidth - bounds.width - 8))}px`;
            tooltip.style.top = `${anchor.bottom + bounds.height + 8 <= innerHeight ?
                anchor.bottom + 6 : Math.max(8, anchor.top - bounds.height - 6)}px`;
        };
        indicator.addEventListener('mouseenter', show);
        indicator.addEventListener('mouseleave', hide);
        indicator.addEventListener('focus', show);
        indicator.addEventListener('blur', hide);
        indicator.addEventListener('keydown', event => {
            if (event.key === 'Escape' && tooltip.matches(':popover-open')) {
                event.preventDefault();
                event.stopPropagation();
                hide();
            }
        });
    }

    function renewalIndicator(status) {
        const style = renewalStyle(status);
        const indicator = document.createElement('span');
        indicator.className = `sb-ptof-status is-${style.tone}`;
        const icon = document.createElement('i');
        icon.className = `bi ${style.icon}`;
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = status;
        indicator.append(icon, label);
        addRenewalHelp(indicator, status);
        return indicator;
    }

    function mountStatuses(root) {
        root.querySelectorAll('[data-ptof-renewal-status]').forEach(cell => {
            if (cell.dataset.ptofStatusMounted) return;
            cell.dataset.ptofStatusMounted = 'true';
            const value = cell.dataset.ptofRenewalStatus;
            if (value) cell.replaceChildren(...value.split('; ').map(renewalIndicator));
        });
    }

    function mount(root) {
        if (root.dataset.ptofMounted) return;
        root.dataset.ptofMounted = 'true';
        const find = name => root.querySelector(`[data-ptof-${name}]`);
        const embedded = Boolean(root.dataset.customerId);
        const customerId = root.dataset.customerId ??
            new URL(location.href).searchParams.get('customer_id');
        let report = null, version = 0;
        let sorter;
        const dateColumn = (key, label) => ({
            key, label, format: formatDate, type: 'number',
            sort: row => dateValue(row[key])?.getTime() ?? '',
        });
        const amount = (key, label) => ({key, label, format: money, type: 'number'});
        const identity = embedded ? [] : [
            {key: 'customer_name', label: 'Customer', customer: true},
            {key: 'tpid', label: 'TPID', type: 'number'},
        ];
        const columns = [
            ...identity, dateColumn('expiration_date', 'Expiration'),
            {key: 'subscription_status', label: 'Status'},
            {key: 'product_family', label: 'Product family'},
            amount('sa_expiration_amount', 'SA Expiration $'),
            {key: 'renewal_status', label: 'Renewal Status'},
        ];
        function table(rows) {
            const previous = sorter?.state;
            const current = find('details');
            const next = current.cloneNode(false);
            next.dataset.sbSortable = '';
            next.dataset.sbSortKey = `ptof-details-${embedded ? 'customer' : 'report'}`;
            const head = document.createElement('thead');
            const heading = document.createElement('tr');
            for (const column of columns) {
                const th = document.createElement('th');
                th.textContent = column.label;
                th.dataset.sbSortType = column.type ?? 'text';
                if (column.type === 'number') th.className = 'sb-ptof-number';
                heading.append(th);
            }
            head.append(heading);
            const body = document.createElement('tbody');
            for (const row of rows) {
                const tr = document.createElement('tr');
                for (const column of columns) {
                    const td = document.createElement('td');
                    const value = row[column.key];
                    td.textContent = column.format ? column.format(value) : value ?? missing;
                    td.dataset.sbSortValue = column.sort ? column.sort(row) : value ?? '';
                    if (value == null) td.classList.add('sb-ptof-missing');
                    if (column.type === 'number') td.classList.add('sb-ptof-number');
                    if (column.customer) {
                        const link = document.createElement('a');
                        link.href = `/customer/${row.customer_id}`;
                        link.textContent = row.customer_name;
                        td.replaceChildren(link);
                    }
                    if (column.key === 'renewal_status' && value) {
                        td.classList.add('sb-ptof-status-cell');
                        td.replaceChildren();
                        for (const status of value.split('; ')) {
                            td.append(renewalIndicator(status));
                        }
                    }
                    tr.append(td);
                }
                body.append(tr);
            }
            if (!rows.length) {
                const tr = document.createElement('tr');
                tr.dataset.sbSortFixed = '';
                const td = document.createElement('td');
                td.colSpan = columns.length;
                td.textContent = 'No matching subscription details.';
                tr.append(td);
                body.append(tr);
            }
            next.append(head, body);
            current.replaceWith(next);
            sorter = window.SBTableSort.create(next);
            if (previous !== undefined) sorter.restore(previous);
        }
        function render() {
            const query = find('search')?.value ?? '';
            const details = filterRows(report.details, query);
            const hasRows = report.details.length > 0;
            root.hidden = embedded && !hasRows;
            find('data').hidden = !hasRows;
            find('empty').hidden = hasRows;
            find('empty').textContent = report.snapshot ?
                'No P to F details were returned for this customer scope.' :
                'No P to F snapshot yet. Refresh Fabric 360 to import your customers.';
            if (find('freshness')) find('freshness').textContent = report.snapshot ?
                `Imported ${new Date(report.snapshot.imported_at).toLocaleString()} · ` +
                    report.snapshot.fiscal_years.join(', ') : 'No successful P to F import yet';
            if (find('scope')) {
                find('scope').textContent = `${new Set(details
                    .map(row => row.tpid)).size} customers`;
            }
            if (find('detail-count')) find('detail-count').textContent =
                `${details.length} ${details.length === 1 ? 'row' : 'rows'}`;
            table(details);
        }
        async function load() {
            const ownVersion = ++version;
            find('error').hidden = true;
            try {
                const url = new URL(root.dataset.reportUrl, location.origin);
                if (customerId) url.searchParams.set('customer_id', customerId);
                const response = await fetch(url, {headers: {Accept: 'application/json'}});
                const payload = await response.json();
                if (!response.ok || payload.success !== true) {
                    throw new Error(payload.error || `Request failed (${response.status}).`);
                }
                if (ownVersion !== version) return;
                report = payload;
                render();
                if (embedded) root.closest('[data-sb-customer-detail]')?._customerDetail
                    ?.contentReady('cdFabric');
            } catch (error) {
                if (ownVersion !== version) return;
                console.error('Could not load saved P to F data:', error);
                root.hidden = false;
                find('error').hidden = false;
                find('error').querySelector('span').textContent =
                    `Could not load saved P to F data. ${error.message}`;
                if (find('freshness')) {
                    find('freshness').textContent = 'Saved P to F data could not be loaded.';
                }
            }
        }
        find('retry').addEventListener('click', load);
        find('search')?.addEventListener('input', () => { if (report) render(); });
        if (!embedded) {
            const sync = window.SBSyncProgress.create(
                root.querySelector('[data-sb-sync-progress="fabric"]'), {onComplete: load});
            find('import').addEventListener('click', () => { sync.start().catch(() => {}); });
        }
        const panel = embedded ? root.closest('.cd-panel') : null;
        if (panel) {
            new MutationObserver(() => {
                if (!panel.hidden) load();
            }).observe(panel, {attributes: true, attributeFilter: ['hidden']});
        }
        if (!panel?.hidden) load();
    }
    window.SBPToF = Object.freeze({mountStatuses});
    mountStatuses(document);
    document.querySelectorAll('[data-ptof]').forEach(mount);
})();
