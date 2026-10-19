(function () {
    'use strict';
    const STORAGE_KEY = 'salesbuddy_hygiene_milestone_view';

    async function jsonRequest(url, options) {
        const response = await fetch(url, options);
        if (!response.headers.get('content-type')?.includes('application/json')) {
            const error = new Error('Expected JSON response, HTTP ' + response.status);
            error.httpStatus = response.status;
            throw error;
        }
        const data = await response.json();
        if (!response.ok) {
            const error = new Error(data?.error || 'Request HTTP ' + response.status);
            error.httpStatus = response.status;
            throw error;
        }
        return data;
    }

    function validateView(value) {
        if (!value || Array.isArray(value) || typeof value !== 'object' ||
            typeof value.onlyOnTeam !== 'boolean' || typeof value.groupBySeller !== 'boolean') {
            throw new Error('Invalid hygiene milestone view');
        }
        return {onlyOnTeam: value.onlyOnTeam, groupBySeller: value.groupBySeller};
    }

    function validateGapRows(rows, type) {
        const ids = rows.map(row => row.dataset[type]);
        if (new Set(ids).size !== ids.length || rows.some(row =>
            !/^[1-9]\d*$/.test(row.dataset[type]) || row.cells.length !== 6)) {
            throw new Error('Invalid gap row identities');
        }
        return rows;
    }

    function retireFixSorts(state) {
        const saved = state?.sbTableSort;
        const keys = Object.keys(saved || {}).filter(key =>
            (key === 'hygiene-engagements' || key === 'hygiene-milestones' ||
                key.startsWith('hygiene-seller-')) && saved[key]?.column === 5);
        if (!keys.length) return state;
        return {...state, sbTableSort: {...saved,
            ...Object.fromEntries(keys.map(key => [key, null]))}};
    }

    function createReasonSaver(initial, write, onState, onConfirmed) {
        let confirmed = initial.trim(), draft = initial, running = null, disposed = false;
        async function drain() {
            while (!disposed && draft.trim() !== confirmed) {
                const snapshot = draft.trim();
                onState('saving', 'Saving...');
                try {
                    const result = await write(snapshot);
                    if (result?.success !== true) throw new Error(result?.error || 'Note save failed');
                    confirmed = snapshot;
                    if (!disposed) onConfirmed(snapshot);
                } catch (error) {
                    if (!disposed) onState('error', 'Not saved: ' + error.message);
                    return;
                }
            }
            if (!disposed) onState('saved', 'Saved');
        }
        return {
            get confirmed() { return confirmed; },
            get dirty() { return draft.trim() !== confirmed; },
            get busy() { return running !== null; },
            setDraft(value) {
                draft = value;
                onState(running ? 'saving' : this.dirty ? 'dirty' : 'saved',
                    running ? 'Saving latest changes...' : this.dirty ? 'Unsaved' : '');
            },
            flush() {
                if (running) return running;
                if (disposed || !this.dirty) return Promise.resolve();
                running = drain().finally(() => { running = null; });
                return running;
            },
            dispose() { disposed = true; },
        };
    }

    if (typeof module !== 'undefined') {
        module.exports = {createReasonSaver, validateView, validateGapRows, retireFixSorts, jsonRequest};
    }
    if (typeof document === 'undefined') return;

    function mount() {
        const root = document.querySelector('[data-hygiene]');
        if (!root) return;
        const embedded = root.dataset.embedded === 'true';
        const find = selector => root.querySelector(selector);
        const engHost = find('[data-hygiene-eng-tables]'), msHost = find('[data-hygiene-ms-tables]');
        const onTeam = find('#onTeamToggle'), bySeller = find('#groupBySellerToggle');
        const tabs = [...root.querySelectorAll('[data-hygiene-tab]')];
        const panels = [...root.querySelectorAll('[data-hygiene-queue]')];
        const notes = new Map(), sorts = new Map(), sortStates = new Map(), errors = new Map();
        const reading = Object.fromEntries(panels.map(panel =>
            [panel.dataset.hygieneQueue, panel.querySelector('.sb-hygiene-reading')]));
        const headerSpecs = host => [...host.querySelectorAll('thead th')].map(th => ({
            label: th.dataset.exportLabel, type: th.dataset.sbSortType,
        }));
        const engHeaders = headerSpecs(engHost), msHeaders = headerSpecs(msHost);
        let engRows = [...root.querySelectorAll('.engagement-gap-row')];
        let msRows = [...root.querySelectorAll('.ms-row')];
        let queue = 'engagement', refreshing = false, retryAction = null, writeBusy = false;
        let repairConfirmed = false, uncertainCreation = false;

        function showErrors() {
            const notice = find('[data-hygiene-notice]');
            notice.hidden = !errors.size;
            find('[data-hygiene-error]').textContent = [...errors.values()].join(' ');
            find('[data-hygiene-retry]').hidden = !retryAction;
        }
        function report(kind, message, error, retry = null) {
            if (error) console.error(message, error);
            errors.set(kind, message);
            if (retry) retryAction = retry;
            showErrors();
        }
        function clear(kind) {
            errors.delete(kind);
            if (!errors.size) retryAction = null;
            showErrors();
        }
        function counts() {
            const visible = msRows.filter(row => !onTeam.checked || row.dataset.onTeam === 'true');
            find('#engagementGapCount').textContent = engRows.length;
            find('#engagementCount').textContent = engRows.length;
            find('#milestoneGapCount').textContent = msRows.length;
            find('#msCount').textContent = visible.length;
            find('#engagementAnnotatedCount').textContent =
                engRows.filter(row => notes.get(row.dataset.engagementId)?.saver.confirmed).length;
            find('[data-hygiene-eng-empty]').hidden = engRows.length > 0;
            find('[data-hygiene-ms-empty]').hidden = visible.length > 0;
            const status = document.querySelector('[data-hygiene-scope]');
            if (status) status.textContent = queue === 'engagement' ?
                engRows.length + ' active engagement gaps' :
                visible.length + ' of ' + msRows.length + ' milestone gaps' +
                    (onTeam.checked ? ' | On Team only' : ' | All team statuses');
        }
        function selectQueue(value, persist = true) {
            queue = value;
            tabs.forEach(tab => {
                const active = tab.dataset.hygieneTab === value;
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
            });
            panels.forEach(panel => {
                panel.hidden = !embedded && panel.dataset.hygieneQueue !== value;
            });
            counts();
            if (persist) saveHistory();
        }
        function saveHistory() {
            if (embedded) return;
            try {
                window.history.replaceState({...window.history.state, sbHygiene: {
                    queue, view: {onlyOnTeam: onTeam.checked, groupBySeller: bySeller.checked},
                    scroll: {engagement: reading.engagement.scrollTop,
                        milestone: reading.milestone.scrollTop},
                }}, '');
                clear('history');
            } catch (error) {
                report('history', 'Reading position could not be saved for Back.', error);
            }
        }
        function buildTable(host, rows, specs, key, seller = null) {
            const table = document.createElement('table');
            table.className = 'sb-hygiene-table';
            table.dataset.sbSortable = '';
            table.dataset.sbSortKey = key;
            table.dataset.exportVisible = String(rows.some(row => row.style.display !== 'none'));
            table.hidden = table.dataset.exportVisible === 'false';
            const head = table.createTHead().insertRow();
            specs.forEach((spec, index) => {
                const th = document.createElement('th');
                if (spec.type) th.dataset.sbSortType = spec.type;
                th.dataset.exportLabel = seller !== null && index === 0 ?
                    spec.label + ' (Seller: ' + seller + ')' : spec.label;
                th.textContent = spec.label;
                head.appendChild(th);
            });
            const body = table.createTBody();
            rows.forEach(row => body.appendChild(row));
            host.appendChild(table);
            const sort = window.SBTableSort.create(table);
            if (sortStates.has(key)) sort.restore(sortStates.get(key));
            sorts.set(key, sort);
        }
        function renderTables() {
            try {
                const state = retireFixSorts(window.history.state);
                if (state !== window.history.state) window.history.replaceState(state, '');
            } catch (error) {
                report('history', 'Previous action-column sorting could not be cleared.', error);
            }
            const offsets = Object.fromEntries(Object.entries(reading).map(([key, el]) =>
                [key, el.scrollTop]));
            sorts.forEach((sort, key) => sortStates.set(key, sort.state));
            sorts.clear();
            engHost.replaceChildren();
            msHost.replaceChildren();
            buildTable(engHost, engRows, engHeaders, 'hygiene-engagements');
            msRows.forEach(row => {
                row.style.display = onTeam.checked && row.dataset.onTeam !== 'true' ? 'none' : '';
            });
            if (bySeller.checked) {
                const groups = new Map();
                msRows.slice().sort((a, b) =>
                    a.dataset.customerName.localeCompare(b.dataset.customerName) ||
                    Number(b.dataset.acr) - Number(a.dataset.acr) ||
                    a.dataset.title.localeCompare(b.dataset.title)).forEach(row => {
                    const name = row.dataset.sellerName;
                    if (!groups.has(name)) groups.set(name, []);
                    groups.get(name).push(row);
                });
                [...groups.keys()].sort((a, b) => a === b ? 0 :
                    a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b))
                    .forEach(name => {
                        const rows = groups.get(name);
                        const visible = rows.filter(row => row.style.display !== 'none').length;
                        const heading = document.createElement('div');
                        heading.className = 'sb-hygiene-seller';
                        heading.hidden = visible === 0;
                        const badge = document.createElement('span');
                        const icon = document.createElement('i');
                        icon.className = 'bi bi-person';
                        icon.setAttribute('aria-hidden', 'true');
                        badge.append(icon, document.createTextNode(' ' + name));
                        const count = document.createElement('span');
                        count.textContent = visible + (visible === 1 ? ' milestone' : ' milestones');
                        heading.append(badge, count);
                        msHost.appendChild(heading);
                        buildTable(msHost, rows, msHeaders, 'hygiene-seller-' + name, name);
                    });
            } else {
                buildTable(msHost, msRows.slice().sort((a, b) =>
                    Number(b.dataset.acr) - Number(a.dataset.acr) ||
                    a.dataset.title.localeCompare(b.dataset.title)), msHeaders, 'hygiene-milestones');
            }
            Object.entries(offsets).forEach(([key, offset]) => { reading[key].scrollTop = offset; });
            counts();
        }
        function saveView() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    onlyOnTeam: onTeam.checked, groupBySeller: bySeller.checked,
                }));
                clear('storage');
            } catch (error) {
                report('storage', 'Milestone scope is applied but could not be saved.', error, saveView);
            }
            saveHistory();
        }
        function restoreView() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw !== null) {
                    const value = validateView(JSON.parse(raw));
                    onTeam.checked = value.onlyOnTeam;
                    bySeller.checked = value.groupBySeller;
                }
                clear('storage');
            } catch (error) {
                report('storage', 'Saved scope could not be restored. Current controls are shown.', error,
                    () => { restoreView(); renderTables(); });
            }
        }
        function restoreHistory() {
            if (embedded) return;
            try {
                const value = window.history.state?.sbHygiene;
                if (value === undefined) return;
                if (!value || !['engagement', 'milestone'].includes(value.queue) ||
                    !value.scroll || ['engagement', 'milestone'].some(key =>
                        !Number.isFinite(value.scroll[key]) || value.scroll[key] < 0)) {
                    throw new Error('Invalid hygiene reading state');
                }
                const view = validateView(value.view);
                onTeam.checked = view.onlyOnTeam;
                bySeller.checked = view.groupBySeller;
                renderTables();
                selectQueue(value.queue, false);
                Object.keys(reading).forEach(key => { reading[key].scrollTop = value.scroll[key]; });
                clear('history');
            } catch (error) {
                report('history', 'Saved repair view could not be restored. Current controls are shown.', error);
            }
        }
        function bindNote(row) {
            const id = row.dataset.engagementId;
            if (notes.has(id)) return;
            const input = row.querySelector('.hygiene-note-input'), cell = input.closest('td');
            const status = row.querySelector('.sb-hygiene-save-state');
            const retry = row.querySelector('[data-note-retry]');
            let timer;
            const saver = createReasonSaver(input.value, value =>
                jsonRequest('/api/hygiene-note', {method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({entity_type: 'engagement', entity_id: Number(id), note: value})}),
            (state, message) => {
                status.dataset.state = state;
                status.textContent = message;
                retry.hidden = state !== 'error';
                if (state === 'error') console.error('Hygiene note was not saved.', message);
            }, value => {
                cell.dataset.exportLabel = value;
                counts();
                const sort = sorts.get('hygiene-engagements');
                if (!saver.dirty && sort?.state?.column === 4) sort.restore(sort.state);
            });
            const flush = () => {
                clearTimeout(timer);
                saver.flush().then(() => { if (!unsavedNotes()) clear('notes'); });
            };
            input.addEventListener('input', () => {
                saver.setDraft(input.value);
                cell.dataset.sbSortValue = input.value.trim();
                clearTimeout(timer);
                timer = setTimeout(flush, 2000);
            });
            input.addEventListener('blur', flush);
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') { event.preventDefault(); input.blur(); flush(); }
            });
            retry.addEventListener('click', flush);
            notes.set(id, {saver, dispose() { clearTimeout(timer); saver.dispose(); }});
        }
        function unsavedNotes() {
            return [...notes.values()].some(note => note.saver.dirty || note.saver.busy);
        }
        function guardNotes() {
            if (!unsavedNotes()) { clear('notes'); return true; }
            report('notes', 'Save or retry unsaved reason notes before repairing gaps.');
            return false;
        }
        async function refreshQueues() {
            if (refreshing) return;
            refreshing = true;
            try {
                const scope = root.dataset.customerScope;
                const response = await fetch('/reports/hygiene?embed=1' + (scope ? '&' + scope : ''));
                if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
                    throw new Error('Gap refresh HTTP ' + response.status);
                }
                const template = document.createElement('template');
                template.innerHTML = await response.text();
                const source = template.content.querySelector('[data-hygiene]');
                if (!source || !source.querySelector('[data-hygiene-eng-tables] table') ||
                    !source.querySelector('[data-hygiene-ms-tables] table')) {
                    throw new Error('Gap response is missing the report queues');
                }
                const freshEngagements = validateGapRows(
                    [...source.querySelectorAll('.engagement-gap-row')], 'engagementId');
                const freshMilestones = validateGapRows(
                    [...source.querySelectorAll('.ms-row')], 'milestoneId');
                function mergeRows(freshRows, previous, type) {
                    const existing = new Map(previous.map(row => [row.dataset[type], row]));
                    return freshRows.map(fresh => {
                        const current = existing.get(fresh.dataset[type]);
                        if (!current) return fresh;
                        Object.assign(current.dataset, fresh.dataset);
                        [...fresh.cells].forEach((cell, index) => {
                            if (type === 'engagementId' && index === 4) return;
                            current.cells[index].replaceChildren(...cell.childNodes);
                            [...current.cells[index].attributes].forEach(attr =>
                                current.cells[index].removeAttribute(attr.name));
                            [...cell.attributes].forEach(attr =>
                                current.cells[index].setAttribute(attr.name, attr.value));
                        });
                        return current;
                    });
                }
                engRows = mergeRows(freshEngagements, engRows, 'engagementId');
                msRows = mergeRows(freshMilestones, msRows, 'milestoneId');
                const remaining = new Set(engRows.map(row => row.dataset.engagementId));
                notes.forEach((note, id) => {
                    if (!remaining.has(id)) { note.dispose(); notes.delete(id); }
                });
                renderTables();
                engRows.forEach(bindNote);
                counts();
                const resolved = context && (context.kind === 'link' ?
                    !engRows.some(row => Number(row.dataset.engagementId) === context.engagementId) :
                    !msRows.some(row => Number(row.dataset.milestoneId) === context.milestoneId));
                if (uncertainCreation && !repairConfirmed && !resolved) {
                    report('refresh', 'Queues refreshed, but creation is still unconfirmed. ' +
                        'Review the customer engagements before attempting another creation.',
                        null, refreshQueues);
                    dialogError('create', 'Creation is still unconfirmed. Review the customer ' +
                        'engagements before retrying; the original milestone may remain a gap.');
                    return;
                }
                uncertainCreation = false;
                clear('refresh');
                Object.values(dialogs).forEach(dialog => {
                    dialog.querySelector('[data-hygiene-confirm-refresh]').hidden = true;
                });
                if (document.activeElement === document.body) {
                    const target = embedded ?
                        reading[context?.kind === 'link' ? 'engagement' : 'milestone'] :
                        tabs.find(tab => tab.dataset.hygieneTab === queue);
                    target?.focus({preventScroll: true});
                }
                if (context && dialogs[context.kind].open &&
                    (resolved || (repairConfirmed && context.kind === 'create'))) {
                    window.SBDialog.close(dialogs[context.kind], 'saved');
                }
            } catch (error) {
                report('refresh', (repairConfirmed ? 'Repair saved, but' : 'Repair could not be confirmed and') +
                    ' gap queues could not refresh. Retry refresh; do not repeat the repair.', error, refreshQueues);
            } finally {
                refreshing = false;
            }
        }

        const dialogs = {
            link: document.getElementById('linkMilestonesModal'),
            existing: document.getElementById('addExistingEngagementModal'),
            create: document.getElementById('createEngagementModal'),
        };
        const dialogErrors = {link: document.getElementById('linkMilestonesError'),
            existing: document.getElementById('addExistingEngagementError'),
            create: document.getElementById('createEngagementError')};
        const buttons = {link: document.getElementById('saveEngagementMilestones'),
            existing: document.getElementById('saveExistingEngagement'),
            create: document.getElementById('createEngagementSubmit')};
        const select = document.getElementById('existingEngagementSelect');
        const form = document.getElementById('createEngagementForm');
        const discard = document.getElementById('hygieneDiscardDialog');
        let context = null, readVersion = 0, existingRequest = null, baseline = '', bypass = false;
        let discardTransition = null;
        const pickers = {
            link: new window.SalesBuddyMilestoneMultiPicker(
                document.getElementById('hygieneLinkPicker'), {native: true}),
            create: new window.SalesBuddyMilestoneMultiPicker(
                document.getElementById('hygieneCreatePicker'), {native: true}),
        };
        function selection(picker) {
            return {milestone_ids: picker.getSelectedIds(), milestones: picker.getSelectedMilestones()};
        }
        function snapshot(kind) {
            if (kind === 'existing') return select.value;
            const ids = pickers[kind].getSelectedMilestones().map(item =>
                String(item.local_milestone_id || item.id)).sort();
            return JSON.stringify({fields: kind === 'create' ?
                Object.fromEntries(new FormData(form).entries()) : {}, ids});
        }
        function dialogError(kind, message, retry = false) {
            dialogErrors[kind].textContent = message;
            dialogErrors[kind].hidden = !message;
            dialogs[kind].querySelector('[data-hygiene-dialog-retry]').hidden = !retry;
        }
        async function loadDialog() {
            const current = context, version = ++readVersion;
            dialogError(current.kind, '');
            if (current.kind === 'existing') {
                existingRequest?.abort();
                existingRequest = new AbortController();
                select.replaceChildren(new Option('Loading engagements...', ''));
                select.disabled = true;
                buttons.existing.disabled = true;
                document.getElementById('noExistingEngagements').hidden = true;
            }
            try {
                if (current.kind === 'existing') {
                    const data = await jsonRequest('/api/customer/' + current.customerId + '/engagements',
                        {signal: existingRequest.signal});
                    if (!Array.isArray(data) || data.some(item =>
                        !Number.isInteger(item.id) || item.id <= 0 ||
                        typeof item.title !== 'string' || typeof item.status !== 'string')) {
                        throw new Error('Invalid engagement list');
                    }
                    if (version !== readVersion || !dialogs.existing.open) return;
                    select.replaceChildren(...data.map(item =>
                        new Option(item.title + ' (' + item.status + ')', String(item.id))));
                    select.disabled = !data.length;
                    buttons.existing.disabled = !data.length;
                    document.getElementById('noExistingEngagements').hidden = data.length > 0;
                    baseline = snapshot('existing');
                } else {
                    const selected = pickers[current.kind].getSelectedMilestones();
                    await pickers[current.kind].load(current.customerId,
                        pickers[current.kind].getSelectedIds(), selected);
                }
            } catch (error) {
                if (version !== readVersion || !dialogs[current.kind].open) return;
                if (current.kind === 'existing') {
                    select.replaceChildren(new Option('Could not load engagements', ''));
                }
                console.error('Unable to load hygiene choices.', error);
                dialogError(current.kind, error.message, true);
            }
        }
        function openDialog(kind, source) {
            if (writeBusy || !guardNotes()) return;
            const data = source.dataset;
            context = {kind, source,
                customerId: Number(data.linkCustomerId || data.addExistingCustomerId ||
                    data.createEngagementCustomerId),
                engagementId: Number(data.linkEngagementId),
                milestoneId: Number(data.addExistingMilestoneId || data.createEngagementMilestoneId)};
            dialogs[kind].querySelector('[data-hygiene-confirm-refresh]').hidden =
                !errors.has('refresh');
            if (kind === 'link') {
                pickers.link.selected = [];
                document.getElementById('linkMilestonesContext').textContent =
                    'Choose milestones for ' + data.linkEngagementTitle + '.';
            } else if (kind === 'existing') {
                select.replaceChildren();
                document.getElementById('addExistingEngagementContext').textContent =
                    'Choose an engagement for ' + data.addExistingMilestoneTitle + '.';
            } else {
                form.reset();
                document.getElementById('createEngagementModalLabel').textContent =
                    'Create Engagement for ' + data.createEngagementMilestoneTitle;
                pickers.create.selected = [{
                    id: data.createEngagementMilestoneMsxId || String(context.milestoneId),
                    local_milestone_id: context.milestoneId, name: data.createEngagementMilestoneTitle,
                    number: data.createEngagementMilestoneNumber, status: data.createEngagementMilestoneStatus,
                    opportunity_name: data.createEngagementMilestoneOpportunity,
                    workload: data.createEngagementMilestoneWorkload,
                }];
            }
            baseline = snapshot(kind);
            window.SBDialog.open(dialogs[kind]);
            loadDialog();
        }
        async function commit(kind) {
            if (writeBusy || !guardNotes()) return;
            const current = {...context}, payload = kind === 'existing' ? null : selection(pickers[kind]);
            if (refreshing || errors.has('refresh')) {
                dialogError(kind, 'Refresh the queues before submitting another repair.');
                return;
            }
            if (kind === 'link' && !payload.milestones.length) {
                dialogError(kind, 'Select at least one milestone.');
                return;
            }
            const engagementId = Number(select.value);
            if (kind === 'existing' && !engagementId) {
                dialogError(kind, 'Select an engagement.');
                return;
            }
            if (kind === 'create' && !form.reportValidity()) return;
            const url = kind === 'existing' ?
                '/api/engagement/' + engagementId + '/milestones/' + current.milestoneId + '/add' :
                kind === 'link' ? '/api/engagement/' + current.engagementId + '/milestones' :
                    '/customer/' + current.customerId + '/engagement/create-inline';
            const body = kind === 'create' ?
                {...Object.fromEntries(new FormData(form).entries()), ...payload} : payload;
            writeBusy = true;
            repairConfirmed = false;
            buttons[kind].disabled = true;
            dialogError(kind, '');
            try {
                const data = await jsonRequest(url, {method: 'POST',
                    ...(body ? {headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(body)} : {})});
                repairConfirmed = data?.success === true;
                if (data?.success === false) {
                    const error = new Error(data.error || 'Repair was rejected');
                    error.confirmedFailure = true;
                    throw error;
                }
                if (!repairConfirmed || !Array.isArray(data.milestone_ids) ||
                    data.milestone_ids.some(id => !Number.isInteger(id) || id <= 0)) {
                    throw new Error('Repair confirmation is invalid; refresh before retrying');
                }
                window.SBDialog.close(dialogs[kind], 'saved');
                await refreshQueues();
            } catch (error) {
                console.error('Hygiene repair failed.', error);
                dialogError(kind, error.message);
                if (!error.confirmedFailure && !(error.httpStatus >= 400 && error.httpStatus < 500)) {
                    uncertainCreation = kind === 'create';
                    dialogs[kind].querySelector('[data-hygiene-confirm-refresh]').hidden = false;
                    report('refresh', 'Repair could not be confirmed. Refresh queues before repeating it.',
                        error, refreshQueues);
                }
            } finally {
                writeBusy = false;
                buttons[kind].disabled = false;
            }
        }
        Object.entries(dialogs).forEach(([kind, dialog]) => {
            dialog.addEventListener('sb:dialog-before-close', event => {
                if (event.detail.reason === 'saved' || bypass) return;
                if (writeBusy) {
                    event.preventDefault();
                    dialogError(kind, 'Saving repair. Please wait before closing.');
                } else if (snapshot(kind) !== baseline) {
                    event.preventDefault();
                    discardTransition = () => {
                        bypass = true;
                        window.SBDialog.close(dialog, 'discard');
                        bypass = false;
                    };
                    window.SBDialog.open(discard);
                }
            });
            dialog.addEventListener('sb:dialog-closed', () => {
                readVersion++;
                existingRequest?.abort();
                pickers[kind]?.cancelLoad();
            });
            dialog.querySelector('[data-hygiene-dialog-retry]').addEventListener('click', loadDialog);
            dialog.querySelector('[data-hygiene-confirm-refresh]').addEventListener('click', refreshQueues);
        });
        document.getElementById('hygieneDiscardConfirm').addEventListener('click', () => {
            window.SBDialog.close(discard, 'discard');
            discardTransition?.();
            discardTransition = null;
        });
        document.getElementById('createEngagementFromEmptyState').addEventListener('click', () => {
            const source = context.source.closest('td').querySelector('[data-create-engagement-milestone-id]');
            window.SBDialog.close(dialogs.existing, 'create');
            openDialog('create', source);
        });
        buttons.link.addEventListener('click', () => commit('link'));
        buttons.existing.addEventListener('click', () => commit('existing'));
        form.addEventListener('submit', event => { event.preventDefault(); commit('create'); });
        root.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (button?.hasAttribute('data-link-engagement-id')) openDialog('link', button);
            else if (button?.hasAttribute('data-add-existing-milestone-id')) openDialog('existing', button);
            else if (button?.hasAttribute('data-create-engagement-milestone-id')) openDialog('create', button);
        });
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => selectQueue(tab.dataset.hygieneTab));
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
                    (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                selectQueue(tabs[next].dataset.hygieneTab);
                tabs[next].focus();
            });
        });
        [onTeam, bySeller].forEach(control => control.addEventListener('change', () => {
            renderTables(); saveView();
        }));
        find('[data-hygiene-retry]').addEventListener('click', () => retryAction?.());
        engRows.forEach(bindNote);
        restoreView();
        renderTables();
        selectQueue(queue, false);
        restoreHistory();
        if (!embedded) {
            window.addEventListener('pagehide', saveHistory);
            window.addEventListener('pageshow', restoreHistory);
            window.addEventListener('popstate', restoreHistory);
        }
        window.addEventListener('beforeunload', event => {
            if (unsavedNotes() || writeBusy ||
                Object.entries(dialogs).some(([kind, dialog]) => dialog.open && snapshot(kind) !== baseline)) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();
