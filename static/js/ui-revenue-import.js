/* Revenue maintenance owns sync feedback, not the imported data or filter engine. */
(() => {
    'use strict';

    function node(tag, text) {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    }

    async function json(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error('Request failed (HTTP ' + response.status + ').');
        return response.json();
    }

    async function consume(response, progress) {
        if (!response.ok) {
            let message = 'Sync request failed (HTTP ' + response.status + ').';
            if (response.headers.get('Content-Type')?.includes('application/json')) {
                const data = await response.json();
                if (typeof data?.error === 'string') message = data.error + ' (HTTP ' + response.status + ').';
            }
            throw new Error(message);
        }
        if (!response.headers.get('Content-Type')?.includes('text/event-stream') ||
            !response.body?.getReader) throw new Error('The sync response was not an event stream.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8', {fatal: true});
        let buffer = '', event = '', data = [], complete = null;
        function dispatch() {
            if (!data.length) { event = ''; return; }
            const payload = JSON.parse(data.join('\n'));
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                throw new Error('Invalid sync event payload.');
            }
            const type = event || 'progress';
            if (type === 'error' || payload.error) {
                const failure = new Error(typeof payload.error === 'string' ?
                    payload.error : 'The server reported a sync failure.');
                failure.name = 'RevenueSyncFailure';
                throw failure;
            }
            if (type === 'complete') complete = payload;
            else if (type === 'start' || type === 'progress') progress(payload);
            else throw new Error('Unexpected sync event: ' + type);
            event = ''; data = [];
        }
        function line(text) {
            if (text.endsWith('\r')) text = text.slice(0, -1);
            if (!text) { dispatch(); return; }
            if (text.startsWith(':')) return;
            const split = text.indexOf(':');
            const field = split < 0 ? text : text.slice(0, split);
            let value = split < 0 ? '' : text.slice(split + 1);
            if (value.startsWith(' ')) value = value.slice(1);
            if (field === 'event') event = value;
            else if (field === 'data') data.push(value);
        }
        try {
            while (complete === null) {
                const chunk = await reader.read();
                buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, {stream: true});
                let end;
                while (complete === null && (end = buffer.indexOf('\n')) >= 0) {
                    line(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
                }
                if (chunk.done && complete === null) {
                    if (buffer) line(buffer);
                    dispatch();
                    if (complete === null) throw new Error('Connection ended without a sync result.');
                }
            }
            return complete;
        } finally {
            try { await reader.cancel(); }
            catch (error) { console.error('Could not close revenue sync stream:', error); }
            reader.releaseLock();
        }
    }

    function validateResult(data) {
        for (const key of ['bucket_rows', 'product_rows', 'months', 'customers_with_data',
            'customers', 'linked_pct', 'duration_s']) {
            if (!Number.isFinite(data[key]) || data[key] < 0 ||
                (!['linked_pct', 'duration_s'].includes(key) && !Number.isInteger(data[key]))) {
                throw new Error('Invalid sync result field: ' + key);
            }
        }
        if (data.linked_pct > 100 || data.customers_with_data > data.customers) {
            throw new Error('Invalid sync result coverage.');
        }
        for (const key of ['review_kept', 'review_retired']) {
            if (data[key] !== undefined && (!Number.isInteger(data[key]) || data[key] < 0)) {
                throw new Error('Invalid sync review result.');
            }
        }
    }

    function create(root) {
        const find = selector => root.querySelector(selector);
        const button = find('#syncBtn'), wrap = find('#syncProgress'), bar = find('#syncBar');
        const text = find('#syncText'), results = find('#syncResults'), last = find('#syncLastRun');
        const refresh = find('[data-sb-import-refresh]'), check = find('[data-sb-import-check]');
        const notice = find('#bucketNotice'), noticeBody = find('[data-sb-import-notice-body]');
        const noticeError = find('[data-sb-import-notice-error]'), dismiss = find('[data-sb-import-dismiss]');
        const rail = root.dataset.embedded === 'true' ? null :
            document.querySelector('[data-sb-import-status]');
        const picker = find('#bucketPickerCard'), list = find('#bucketPickerList');
        const bucketStatus = find('[data-sb-import-bucket-status]');
        const bucketRetry = find('[data-sb-import-bucket-retry]');
        let running = false, readingBuckets = false, saving = false;
        let desired = null, failedSelection = null, bucketReadFailed = false;
        let statusVersion = 0, noticeVersion = 0;

        function say(message) { if (rail) rail.textContent = message; }
        function errorAt(element, message, error) {
            console.error(message, error);
            element.textContent = message + ' ' + error.message;
            element.hidden = false;
            element.setAttribute('role', 'alert');
            element.dataset.tone = 'danger';
        }
        function renderNotice(data) {
            if (data == null) { notice.hidden = true; return; }
            if (typeof data !== 'object' ||
                !['reset', 'review', 'unchanged', 'first_import'].includes(data.status)) {
                throw new Error('Invalid bucket change notice.');
            }
            if (['unchanged', 'first_import'].includes(data.status)) {
                notice.hidden = true; return;
            }
            for (const key of ['missing_selected', 'added', 'removed']) {
                if (data[key] !== undefined && (!Array.isArray(data[key]) ||
                    data[key].some(value => typeof value !== 'string'))) {
                    throw new Error('Invalid bucket change list.');
                }
            }
            noticeBody.replaceChildren();
            noticeBody.appendChild(node('p', data.status === 'reset' ?
                'Your previous selection was cleared. Pick your compensated buckets again. ' +
                'Unavailable: ' + (data.missing_selected || []).join(', ') :
                'The bucket list changed. Your selections still exist; review them below.'));
            for (const [key, label] of [['added', 'New'], ['removed', 'Retired']]) {
                if (data[key]?.length) noticeBody.appendChild(node('p', label + ': ' + data[key].join(', ')));
            }
            noticeError.hidden = true;
            notice.hidden = false;
        }
        async function status() {
            const version = ++statusVersion, noticeRead = noticeVersion;
            check.disabled = true;
            try {
                const data = await json(root.dataset.statusUrl);
                if (version !== statusVersion) return;
                const state = data.status?.state;
                if (!['never_run', 'in_progress', 'failed', 'incomplete', 'complete'].includes(state)) {
                    throw new Error('Invalid revenue sync status.');
                }
                if (noticeRead === noticeVersion) renderNotice(data.bucket_notice);
                let message = {never_run: 'No completed sync yet', in_progress: 'A revenue sync is in progress',
                    failed: 'The last sync attempt failed', incomplete: 'Previous sync incomplete'}[state];
                if (state === 'complete') {
                    const date = new Date(data.status.completed_at);
                    if (!data.status.completed_at || Number.isNaN(date.getTime())) {
                        throw new Error('Invalid completed sync timestamp.');
                    }
                    message = 'Last synced ' + date.toLocaleString();
                }
                last.textContent = message;
                last.setAttribute('role', 'status');
                delete last.dataset.tone;
                if (!running) say(message);
            } catch (error) {
                if (version !== statusVersion) {
                    console.error('Superseded revenue status read failed:', error); return;
                }
                errorAt(last, 'Sync status unavailable.', error);
                if (!running) say('Sync status unavailable');
            } finally { if (version === statusVersion) check.disabled = false; }
        }
        async function saveBuckets(values) {
            desired = values.slice();
            if (saving) return;
            saving = true;
            while (desired !== null) {
                const current = desired; desired = null;
                bucketStatus.textContent = 'Saving compensated buckets';
                bucketStatus.setAttribute('role', 'status');
                delete bucketStatus.dataset.tone;
                bucketRetry.hidden = true;
                try {
                    const data = await json('/api/revenue/compensated-buckets', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(current),
                    });
                    if (data?.success !== true) throw new Error('Server did not confirm bucket selection.');
                    failedSelection = null;
                    bucketStatus.textContent = 'Compensated buckets saved. ' +
                        (current.length ? current.length + ' selected.' : 'Showing every bucket.');
                    delete bucketStatus.dataset.tone;
                } catch (error) {
                    failedSelection = current;
                    errorAt(bucketStatus, 'Selection applies locally; its server save was not confirmed.', error);
                    bucketRetry.hidden = false;
                }
            }
            saving = false;
        }
        async function loadBuckets() {
            if (!picker || readingBuckets) return;
            readingBuckets = true; list.inert = true; list.setAttribute('aria-busy', 'true');
            bucketStatus.textContent = 'Loading buckets'; bucketRetry.hidden = true;
            bucketStatus.setAttribute('role', 'status'); delete bucketStatus.dataset.tone;
            try {
                const buckets = await json('/api/revenue/buckets');
                await RevenueBucketFilter.init({containerId: 'bucketPickerList',
                    buckets, inline: true, onSelectionChange: saveBuckets,
                    onFilterChange: selectedCount});
                bucketReadFailed = false; list.inert = false;
                bucketStatus.textContent = buckets.length + ' available buckets';
                bucketStatus.setAttribute('role', 'status'); delete bucketStatus.dataset.tone;
            } catch (error) {
                bucketReadFailed = true;
                errorAt(bucketStatus, 'Bucket list unavailable. Retry before editing.', error);
                bucketRetry.hidden = false;
            } finally { readingBuckets = false; list.setAttribute('aria-busy', 'false'); }
        }
        function selectedCount() {
            find('[data-sb-import-bucket-count]').textContent =
                RevenueBucketFilter.getSelected().length + ' selected';
        }
        function progress(data) {
            if (data.progress !== undefined) {
                if (!Number.isFinite(data.progress) || data.progress < 0 || data.progress > 100) {
                    throw new Error('Invalid sync progress.');
                }
                bar.value = data.progress;
            }
            if (data.message !== undefined) {
                if (typeof data.message !== 'string') throw new Error('Invalid sync progress message.');
                text.textContent = data.message; say(data.message);
            }
        }
        function completed(data) {
            validateResult(data);
            renderNotice(data.taxonomy);
            noticeVersion++; statusVersion++; check.disabled = false;
            last.textContent = 'Last sync completed just now';
            last.setAttribute('role', 'status'); delete last.dataset.tone;
            results.replaceChildren(node('p', 'Revenue synced'));
            const lines = node('ul');
            const number = value => value.toLocaleString();
            for (const message of [
                number(data.bucket_rows) + ' bucket rows, ' + number(data.product_rows) +
                    ' product rows across ' + data.months + ' months',
                data.customers_with_data + ' of ' + data.customers + ' accounts returned revenue',
                data.linked_pct + '% of rows linked to a customer record',
                'Completed in ' + data.duration_s + 's',
            ]) lines.appendChild(node('li', message));
            if (data.review_kept !== undefined && data.review_retired !== undefined &&
                (data.review_kept || data.review_retired)) {
                lines.appendChild(node('li', data.review_kept + ' review notes kept; ' +
                    data.review_retired + ' retired with their buckets'));
            }
            results.appendChild(lines); results.hidden = false;
            results.dataset.tone = 'positive'; results.setAttribute('role', 'status');
            refresh.hidden = false; say('Sync complete; refresh tables to see newly stored data');
        }
        async function sync() {
            if (running) return;
            running = true; button.disabled = true; wrap.hidden = false; results.hidden = true;
            refresh.hidden = true; bar.removeAttribute('value');
            text.textContent = 'Starting revenue sync'; say(text.textContent);
            try {
                const response = await fetch(root.dataset.syncUrl, {method: 'POST',
                    headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'},
                    body: JSON.stringify({})});
                const data = await consume(response, progress);
                completed(data);
                if (picker) { picker.hidden = false; await loadBuckets(); }
            } catch (error) {
                errorAt(results, error.name === 'RevenueSyncFailure' ? 'Sync failed.' :
                    'Sync result unavailable. Check status before starting again.', error);
                say('Sync did not report completion');
            } finally { running = false; button.disabled = false; wrap.hidden = true; }
        }
        button.addEventListener('click', sync);
        check.addEventListener('click', status);
        dismiss.addEventListener('click', async () => {
            dismiss.disabled = true;
            try {
                const data = await json(root.dataset.noticeUrl, {method: 'DELETE'});
                if (data?.success !== true) throw new Error('Server did not confirm dismissal.');
                noticeVersion++; notice.hidden = true;
            } catch (error) { errorAt(noticeError, 'Bucket notice could not be dismissed.', error); }
            finally { dismiss.disabled = false; }
        });
        if (picker) {
            bucketRetry.addEventListener('click', () => bucketReadFailed ?
                loadBuckets() : failedSelection !== null ? saveBuckets(failedSelection) : loadBuckets());
            window.showBucketPicker = () => { picker.hidden = false; return loadBuckets(); };
            if (!picker.hidden) loadBuckets();
        }
        const brainrot = find('#revImportBrainrotCheck');
        const brainrotError = find('[data-sb-import-brainrot-error]');
        try { brainrot.checked = localStorage.getItem('brainrot') === '1'; }
        catch (error) { errorAt(brainrotError, 'Brainrot preference unavailable.', error); }
        brainrot.addEventListener('change', () => {
            try {
                if (typeof window.setBrainrot !== 'function') throw new Error('Brainrot controls unavailable.');
                window.setBrainrot(brainrot.checked);
                if (brainrot.checked) window.showBrainrotPanel();
                else window.hideBrainrotPanel();
                brainrotError.hidden = true;
            } catch (error) { errorAt(brainrotError, 'Brainrot preference could not be applied.', error); }
        });
        status();
        return Object.freeze({sync, status, loadBuckets, saveBuckets, completed});
    }
    window.SBRevenueImport = Object.freeze({consume, validateResult, create});
    const root = document.querySelector('[data-sb-import]');
    if (root) create(root);
})();
