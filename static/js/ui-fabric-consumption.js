/* Saved Fabric data is read-only; only the import command contacts MSXi. */
(() => {
    'use strict';
    const root = document.querySelector('[data-fabric-report]');
    if (!root) return;
    const find = name => root.querySelector(`[data-fabric-${name}]`) ??
        document.querySelector(`footer [data-fabric-${name}]`);
    const number = value => value == null ? '-' : Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 2
    });
    const percent = value => value == null ? '-' :
        value > 0 && value < 0.01 ? '<0.01%' : `${number(value)}%`;
    const capacityKey = capacity => `${capacity.tenant_id ?? ''}|${capacity.capacity_id}`;
    let report = null;
    const embedded = Boolean(root.dataset.fabricCustomerId);
    let customerId = root.dataset.fabricCustomerId ??
        new URL(location.href).searchParams.get('customer_id');
    let restoreCustomer = !embedded && customerId === null;
    const customerPreferenceNotice = textElement('p', '', 'sb-fabric-error');
    customerPreferenceNotice.hidden = true;
    customerPreferenceNotice.setAttribute('role', 'alert');
    if (!embedded) find('customers').before(customerPreferenceNotice);
    const customerPreference = embedded ? null :
        window.SBFabricPreferences.customerSelection(customerPreferenceNotice);
    let selectedCapacity = new URL(location.href).searchParams.get('capacity') ?? '';
    let requestVersion = 0;
    let seriesPage = 0;
    let operationsPage = 0;
    const seriesPageSize = 200;

    function textElement(tag, text, className = '') {
        const element = document.createElement(tag);
        element.textContent = text;
        if (className) element.className = className;
        return element;
    }

    function showError(message) {
        if (message) root.hidden = false;
        find('error').textContent = message;
        find('error').hidden = !message;
    }

    async function request(url, options = {}) {
        const response = await fetch(url, { ...options, headers: {
            Accept: 'application/json', ...options.headers
        } });
        const payload = await response.json();
        if (!response.ok || payload.success === false) {
            throw new Error(payload.error || `Request failed (${response.status}).`);
        }
        return payload;
    }

    function fillTable(table, rows, columns) {
        const previousState = window.SBTableSort?.create(table)?.state;
        const replacement = table.cloneNode(false);
        const head = table.querySelector('thead').cloneNode(true);
        head.querySelectorAll('th').forEach(header => {
            header.textContent = header.textContent.trim();
            header.removeAttribute('aria-sort');
        });
        const body = document.createElement('tbody');
        replacement.append(head, body);
        for (const row of rows) {
            const tr = document.createElement('tr');
            for (const column of columns) {
                const value = column.value(row);
                const td = textElement('td', column.format ? column.format(value) : value ?? '-');
                td.dataset.sbSortValue = column.sortValue ? column.sortValue(row) : value ?? '';
                if (column.format) td.classList.add('sb-fabric-number');
                if (value == null || value === 0) td.classList.add('sb-fabric-quiet');
                if (column.render) td.replaceChildren(column.render(row));
                tr.append(td);
            }
            body.append(tr);
        }
        if (!rows.length) {
            const td = textElement('td', 'No measurements returned for this view.');
            td.colSpan = columns.length;
            const tr = document.createElement('tr');
            tr.dataset.sbSortFixed = '';
            tr.append(td);
            body.append(tr);
        }
        table.replaceWith(replacement);
        const sorter = window.SBTableSort?.create(replacement);
        if (previousState) sorter?.restore(previousState);
    }

    function renderDirectory() {
        if (!report || embedded) return;
        const query = find('search').value.trim().toLocaleLowerCase();
        const dataOnly = find('data-only').checked;
        const customers = report.customers.filter(customer =>
            (!dataOnly || customer.status === 'available') &&
            `${customer.name} ${customer.account_name ?? ''} ${customer.nickname ?? ''} ${customer.tpid ?? ''}`
                .toLocaleLowerCase().includes(query));
        find('account-count').textContent = `${customers.length} / ${report.customers.length}`;
        const list = find('customers');
        list.replaceChildren();
        for (const customer of customers) {
            const button = textElement('button', customer.name, 'sb-fabric-customer');
            button.type = 'button';
            button.setAttribute('aria-current', String(String(customer.id) === String(customerId)));
            const context = customer.status === 'available' ?
                `${customer.capacity_count} capacities; ${number(customer.total_cu_hours)} CU hours` :
                customer.status === 'missing_tpid' ? 'No valid TPID' :
                    !report.snapshot ? 'Not imported yet' : 'No measurements returned';
            button.append(textElement('small', `${customer.tpid ?? 'No TPID'} | ${context}`));
            button.addEventListener('click', () => {
                customerId = String(customer.id);
                selectedCapacity = '';
                seriesPage = 0;
                operationsPage = 0;
                const url = new URL(location.href);
                url.searchParams.set('customer_id', customerId);
                url.searchParams.delete('capacity');
                history.replaceState(history.state, '', url);
                loadReport();
            });
            list.append(button);
        }
        if (!customers.length) list.append(textElement('p', 'No customers match these filters.'));
    }

    function renderChart(points, container = find('capacity-chart')) {
        container.replaceChildren();
        const measured = points.filter(point => point.utilization_pct != null);
        if (!measured.length) {
            container.append(textElement('p', 'No utilization history measurements returned.'));
            return;
        }
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 760 200');
        svg.setAttribute('role', 'img');
        const title = document.createElementNS(ns, 'title');
        title.textContent = 'Capacity utilization history. Dotted line marks the 80% scale-up threshold. Dashed line marks 100% of SKU.';
        svg.append(title);
        const max = measured.reduce((peak, point) => Math.max(peak, point.utilization_pct), 100);
        const firstTime = Date.parse(points[0].time);
        const lastTime = Date.parse(points.at(-1).time);
        const x = (point, index) => 55 + (
            Number.isFinite(firstTime) && Number.isFinite(lastTime) && lastTime > firstTime ?
                (Date.parse(point.time) - firstTime) / (lastTime - firstTime) :
                index / Math.max(1, points.length - 1)
        ) * 680;
        const y = value => 164 - value / max * 144;
        for (const [threshold, className] of [[80, 'series-scale-up'], [100, 'series-limit']]) {
            const reference = document.createElementNS(ns, 'line');
            for (const [key, value] of Object.entries({
                x1: 55, x2: 735, y1: y(threshold), y2: y(threshold),
            })) {
                reference.setAttribute(key, value);
            }
            reference.setAttribute('class', className);
            svg.append(reference);
            const label = document.createElementNS(ns, 'text');
            label.setAttribute('x', 48);
            label.setAttribute('y', y(threshold) - 4);
            label.setAttribute('text-anchor', 'end');
            label.textContent = `${threshold}%`;
            svg.append(label);
        }
        let segment = [];
        function appendSegment() {
            if (!segment.length) return;
            const line = document.createElementNS(ns, 'polyline');
            line.setAttribute('points', segment.join(' '));
            line.setAttribute('class', 'series-line');
            svg.append(line);
            segment = [];
        }
        points.forEach((point, index) => {
            if (point.utilization_pct == null) appendSegment();
            else segment.push(`${x(point, index)},${y(point.utilization_pct)}`);
        });
        appendSegment();
        for (const [x, value, anchor] of [
            [55, measured[0].time, 'start'], [735, measured.at(-1).time, 'end']]) {
            const label = document.createElementNS(ns, 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', 189);
            label.setAttribute('text-anchor', anchor);
            label.textContent = value;
            svg.append(label);
        }
        container.append(svg);
        if (container.hasAttribute('data-fabric-capacity-chart')) {
            addChartInspection(svg, points, points.map(x), y, container);
        }
    }

    function addChartInspection(svg, points, positions, y, container) {
        const ns = 'http://www.w3.org/2000/svg';
        const marker = document.createElementNS(ns, 'circle');
        marker.setAttribute('r', 4);
        marker.setAttribute('class', 'series-point');
        const cursor = document.createElementNS(ns, 'line');
        cursor.setAttribute('y1', 20);
        cursor.setAttribute('y2', 164);
        cursor.setAttribute('class', 'series-cursor');
        svg.append(cursor, marker);
        const readout = textElement('div', '', 'sb-fabric-chart-tooltip');
        readout.id = 'fabricChartReadout';
        readout.setAttribute('popover', 'manual');
        readout.setAttribute('role', 'tooltip');
        container.append(readout);
        svg.setAttribute('tabindex', 0);
        svg.setAttribute('aria-describedby', readout.id);
        svg.setAttribute('aria-label', 'Hourly utilization. Hover or use arrow keys to inspect points.');
        let selected = 0;
        const dateFormat = new Intl.DateTimeFormat(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        });
        function inspect(index) {
            selected = index;
            const point = points[index];
            const date = new Date(point.time);
            const timestamp = Number.isFinite(date.getTime()) ?
                `${dateFormat.format(date)} UTC` : point.time;
            readout.textContent = `${timestamp} / ${point.utilization_pct == null ?
                'No utilization measurement' : percent(point.utilization_pct)}`;
            if (!readout.matches(':popover-open')) readout.showPopover();
            const anchor = svg.createSVGPoint();
            anchor.x = positions[index];
            anchor.y = point.utilization_pct == null ? 164 : y(point.utilization_pct);
            const screen = anchor.matrixTransform(svg.getScreenCTM());
            const bounds = readout.getBoundingClientRect();
            readout.style.left = `${Math.max(8,
                Math.min(screen.x + 12, innerWidth - bounds.width - 8))}px`;
            readout.style.top = `${Math.max(8,
                Math.min(screen.y - bounds.height - 12, innerHeight - bounds.height - 8))}px`;
            cursor.style.display = '';
            cursor.setAttribute('x1', positions[index]);
            cursor.setAttribute('x2', positions[index]);
            marker.style.display = point.utilization_pct == null ? 'none' : '';
            marker.setAttribute('cx', positions[index]);
            marker.setAttribute('cy', point.utilization_pct == null ? 0 : y(point.utilization_pct));
        }
        function clear() {
            cursor.style.display = 'none';
            marker.style.display = 'none';
            if (readout.matches(':popover-open')) readout.hidePopover();
        }
        clear();
        svg.addEventListener('pointermove', event => {
            const matrix = svg.getScreenCTM();
            if (!matrix) return;
            const pointer = svg.createSVGPoint();
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            const local = pointer.matrixTransform(matrix.inverse());
            if (local.x < 55 || local.x > 735 || local.y < 20 || local.y > 164) {
                if (document.activeElement !== svg) clear();
                return;
            }
            let low = 0;
            let high = positions.length - 1;
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                if (positions[mid] < local.x) low = mid + 1;
                else high = mid;
            }
            inspect(low > 0 && local.x - positions[low - 1] <= positions[low] - local.x ?
                low - 1 : low);
        });
        svg.addEventListener('pointerleave', () => {
            if (document.activeElement !== svg) clear();
        });
        svg.addEventListener('focus', () => inspect(selected));
        svg.addEventListener('blur', clear);
        svg.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Escape') clear();
            else inspect(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 :
                Math.max(0, Math.min(points.length - 1,
                    selected + (event.key === 'ArrowRight' ? 1 : -1))));
        });
    }

    function renderCapacity() {
        const capacity = report.customer?.capacities.find(item =>
            capacityKey(item) === find('capacity-select').value);
        const points = capacity?.points ?? [];
        find('capacity-detail-state').textContent = capacity ?
            `${points.length} hourly measurements` :
            'No capacity measurements returned.';
        const summary = find('capacity-summary');
        summary.replaceChildren();
        if (capacity) renderSummary(summary, [
            ['History utilization', percent(capacity.utilization_pct)],
            ['Latest hour', percent(capacity.latest_utilization_pct)],
            ['CU hours', number(capacity.cu_hours)],
        ]);
        renderChart(points);
        const metrics = find('capacity-metrics');
        metrics.replaceChildren();
        if (capacity) {
            const values = [
                ['Tenant', capacity.tenant_id],
                ['Capacity', capacity.capacity_id],
                ['SKU', capacity.sku],
                ['Peak interval', capacity.peak_period],
                ['Latest utilization', percent(capacity.latest_utilization_pct)],
                ['Retained-history utilization', percent(capacity.utilization_pct)],
                ['Interactive share of CU', percent(capacity.interactive_usage_pct)],
                ['Background share of CU', percent(capacity.background_usage_pct)],
                ['Autoscale enabled', capacity.autoscale],
                ['Available CU seconds', number(capacity.available_cu_seconds)],
                ['Autoscale CU seconds', number(capacity.autoscale_cu_seconds)],
                ['Interactive rejections', number(capacity.interactive_rejections)],
                ['Background rejections', number(capacity.background_rejections)],
                ['Latest-hour throttling seconds', number(capacity.latest_throttling_seconds)],
                ['Smoothed CU hours', number(capacity.smoothed_cu_hours)],
                ['Unsmoothed CU hours', number(capacity.unsmoothed_cu_hours)]
            ];
            for (const [label, value] of values) {
                metrics.append(textElement('dt', label), textElement('dd', value ?? '-'));
            }
        }
        seriesPage = Math.max(0, Math.min(seriesPage, Math.ceil(points.length / seriesPageSize) - 1));
        const offset = seriesPage * seriesPageSize;
        const pagePoints = points.slice(offset, offset + seriesPageSize);
        find('series-prev').disabled = seriesPage === 0;
        find('series-next').disabled = offset + seriesPageSize >= points.length;
        find('series-page').textContent = points.length ?
            `${offset + 1}-${offset + pagePoints.length} of ${points.length} time points` : 'No time points';
        fillTable(find('series'), pagePoints, [
            { value: row => row.time, sortValue: row => row.time ? Date.parse(row.time) : '' },
            { value: row => row.sku },
            { value: row => row.utilization_pct, format: percent },
            ...['interactive_cu_seconds', 'background_cu_seconds', 'successful',
                'failed', 'cancelled', 'rejected', 'invalid_operations', 'in_progress_operations',
                'available_cu_seconds', 'autoscale_cu_seconds', 'throttling_seconds'].map(key => ({
                value: row => row[key], format: number
            }))
        ]);
    }

    function renderOperations() {
        const rows = (report.customer?.workloads ?? []).flatMap(workload =>
            (workload.details ?? []).map(row => ({ ...row, workload: workload.workload })));
        operationsPage = Math.max(0, Math.min(operationsPage, Math.ceil(rows.length / 200) - 1));
        const offset = operationsPage * 200;
        const shown = rows.slice(offset, offset + 200);
        find('operations-prev').disabled = operationsPage === 0;
        find('operations-next').disabled = offset + 200 >= rows.length;
        find('operations-page').textContent = rows.length ?
            `${offset + 1}-${offset + shown.length} of ${rows.length} operations` : 'No operation rows';
        fillTable(find('operations'), shown, [
            ...['tenant_id', 'capacity_id', 'sku', 'workload', 'artifact_kind', 'operation']
                .map(key => ({ value: row => row[key] })),
            { value: row => row.cu_hours, format: number },
            { value: row => row.usage_pct, format: percent }
        ]);
    }

    function renderCustomer() {
        window.SBFabricCapacityLabel.close();
        const customer = report.customer;
        window.SBFabricRevenue.render(find('revenue'), customer);
        if (embedded) {
            const revenueState = customer?.revenue?.state;
            const noRevenue = !revenueState || ['not_imported', 'no_data'].includes(revenueState);
            if (noRevenue) find('revenue').hidden = true;
            root.hidden = customer?.status !== 'available' && noRevenue;
        }
        find('detail-body').hidden = !customer || customer.status !== 'available';
        find('customer-title').textContent = customer ?
            `${customer.name} (${customer.tpid ?? 'TPID unavailable'})` : 'Choose a customer';
        if (customer) find('customer-title').href = `/customer/${customer.id}`;
        else find('customer-title').removeAttribute('href');
        find('detail-state').hidden = embedded || customer?.status === 'available';
        find('detail-state').textContent = !customer ? 'Choose a customer to inspect its saved snapshot.' :
            customer.status === 'missing_tpid' ? 'This customer needs a valid TPID before it can be imported.' :
            !report.snapshot ?
                'No saved Fabric snapshot yet. Use Import from MSXi to load your customers.' :
            'No Fabric measurements returned for this TPID. This does not prove zero usage; source coverage and access may differ.';
        if (!customer || customer.status !== 'available') return;
        if (!embedded) {
            find('workload-context').textContent = report.snapshot?.workload_window ?? 'Source workload window';
            renderSummary(find('overview'), [
                ['Total CU hours', number(customer.total_cu_hours)],
                ['Direct Lake / subset', `${number(customer.direct_lake_cu_hours)} CU hours (${percent(customer.direct_lake_pct)})`],
                ['Core MAU', number(customer.fabric_core_mau)],
                ['Month over month', percent(customer.mom_change_pct)],
            ]);
            fillTable(find('workloads'), customer.workloads, [
                { value: row => row.workload },
                { value: row => row.cu_hours, format: number },
                { value: row => row.share_pct, format: percent }
            ]);
        }
        find('workload-chart').replaceChildren();
        for (const workload of customer.workloads) {
            const row = document.createElement('div');
            row.className = 'sb-fabric-mix-row';
            const bar = document.createElement('progress');
            bar.max = 100;
            bar.value = workload.share_pct ?? 0;
            bar.hidden = workload.share_pct == null;
            bar.setAttribute('aria-label', `${workload.workload} share of usage`);
            row.append(textElement('span', workload.workload), bar,
                textElement('span', percent(workload.share_pct)));
            find('workload-chart').append(row);
        }
        fillTable(find('capacities'), customer.capacities, [
            { value: row => row.capacity_index,
                render: row => {
                    const cell = document.createElement('span');
                    cell.append(window.SBFabricCapacityLabel.create(
                        row, row.capacity_index, row.capacity_total, customer.name, null, customer.seller),
                    document.createTextNode(` ${row.sku ?? 'SKU unavailable'}`));
                    return cell;
                }},
            { value: row => row.utilization_pct, format: percent,
                render: row => window.SBFabricCapacityLabel.create(
                    row, row.capacity_index, row.capacity_total, customer.name,
                    container => renderChart(row.points, container), customer.seller) },
            { value: row => row.peak_utilization_pct, format: percent },
            { value: row => row.throttling_seconds, format: number },
            { value: row => row.users, format: number },
            { value: row => row.interactive_rejections == null || row.background_rejections == null ?
                null : row.interactive_rejections + row.background_rejections, format: number },
            { value: row => row.cu_hours, format: number }
        ]);
        const select = find('capacity-select');
        select.replaceChildren();
        for (const capacity of customer.capacities) {
            const option = textElement('option', `Capacity ${capacity.capacity_index}/${capacity.capacity_total} / ${capacity.sku ?? 'Unknown SKU'}`);
            option.value = capacityKey(capacity);
            select.append(option);
        }
        if (customer.capacities.some(capacity => capacityKey(capacity) === selectedCapacity)) {
            select.value = selectedCapacity;
        }
        renderCapacity();
        if (!embedded) renderOperations();
    }

    function renderSummary(container, values) {
        container.replaceChildren();
        for (const [label, value] of values) {
            const group = document.createElement('div');
            group.append(textElement('dt', label), textElement('dd', value));
            container.append(group);
        }
    }

    async function loadReport() {
        const version = ++requestVersion;
        find('detail').setAttribute('aria-busy', 'true');
        try {
            const url = new URL(root.dataset.reportUrl, location.origin);
            if (customerId) url.searchParams.set('customer_id', customerId);
            const payload = await request(url);
            if (version !== requestVersion) return;
            if (restoreCustomer) {
                restoreCustomer = false;
                const saved = customerPreference.restore(payload.customers);
                if (saved) {
                    customerId = saved;
                    const pageUrl = new URL(location.href);
                    pageUrl.searchParams.set('customer_id', saved);
                    history.replaceState(null, '', pageUrl);
                    await loadReport();
                    return;
                }
            }
            report = payload;
            importController?.setImportedAt(report.snapshot?.imported_at);
            if (report.customer) customerPreference?.save(report.customer.id);
            if (find('freshness')) find('freshness').textContent = report.snapshot ?
                `Imported ${new Date(report.snapshot.imported_at).toLocaleString()}` : 'No Fabric snapshot yet';
            renderDirectory();
            renderCustomer();
            if (embedded) root.closest('[data-sb-customer-detail]')?._customerDetail
                ?.contentReady('cdFabric');
            const missingCapacity = selectedCapacity && !report.customer?.capacities.some(
                capacity => capacityKey(capacity) === selectedCapacity);
            showError(missingCapacity ?
                'The linked capacity is no longer available in this customer snapshot.' : '');
        } catch (error) {
            if (version === requestVersion) showError(`Could not load saved data: ${error.message}`);
        } finally {
            if (version === requestVersion) find('detail').removeAttribute('aria-busy');
        }
    }

    if (!embedded) {
        find('search').addEventListener('input', renderDirectory);
        window.SBFabricPreferences.bindCheckbox(
            find('data-only'), 'salesbuddy_fabric_only_imported_customers');
        find('data-only').addEventListener('change', renderDirectory);
    }
    find('capacity-select').addEventListener('change', () => {
        selectedCapacity = find('capacity-select').value;
        const url = new URL(location.href);
        url.searchParams.set('capacity', selectedCapacity);
        history.replaceState(history.state, '', url);
        showError('');
        seriesPage = 0;
        renderCapacity();
    });
    find('series-prev').addEventListener('click', () => {
        seriesPage--;
        renderCapacity();
    });
    find('series-next').addEventListener('click', () => {
        seriesPage++;
        renderCapacity();
    });
    if (!embedded) {
        find('operations-prev').addEventListener('click', () => {
            operationsPage--;
            renderOperations();
        });
        find('operations-next').addEventListener('click', () => {
            operationsPage++;
            renderOperations();
        });
    }
    let importController = null;
    function start() {
        if (!embedded) importController ??= window.SBFabricImport.create(root, loadReport);
        loadReport();
    }
    const panel = embedded ? root.closest('.cd-panel') : null;
    if (panel) {
        new MutationObserver(() => {
            if (!panel.hidden) start();
        }).observe(panel, {attributes: true, attributeFilter: ['hidden']});
    }
    if (!panel?.hidden) start();
})();
