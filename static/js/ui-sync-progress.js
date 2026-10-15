/* One read-only progress lifecycle for original sync pages and their start controls. */
(() => {
    'use strict';
    const instances = new WeakMap();
    function create(root, options = {}) {
        if (instances.has(root)) {
            const existing = instances.get(root);
            Object.assign(existing.handlers, options);
            return existing.api;
        }
        const handlers = {...options};
        const operation = root.dataset.sbSyncProgress;
        const controls = root.dataset.syncControls ?
            [...document.querySelectorAll(root.dataset.syncControls)] : [];
        const last = root.querySelector('[data-sync-last]');
        const running = root.querySelector('[data-sync-running]');
        const bar = running.querySelector('progress');
        const text = root.querySelector('[data-sync-message]');
        const result = root.querySelector('[data-sync-result]');
        let job = null, known = false, timer = null, stopped = false;
        let reading = null, starting = null, observedId = null;
        const active = value => value && ['pending', 'running'].includes(value.status);
        function disable(value) {
            controls.forEach(button => {
                button.disabled = value || button.dataset.syncUnavailable === 'true';
                button.setAttribute('aria-busy', String(value));
            });
        }
        function showError(error, prefix) {
            console.error(prefix, error);
            root.hidden = false;
            result.hidden = false;
            result.dataset.tone = 'danger';
            result.setAttribute('role', 'alert');
            result.textContent = prefix + ' ' + error.message;
        }
        function schedule() {
            clearTimeout(timer);
            if (!stopped) timer = setTimeout(() => { check().catch(() => {}); },
                active(job) ? 2000 : 5000);
        }
        function paint(snapshot) {
            const unchanged = known && snapshot && job?.id === snapshot.id &&
                job.status === snapshot.status && !active(snapshot);
            job = snapshot;
            known = true;
            if (unchanged) {
                disable(Boolean(starting));
                return;
            }
            const busy = Boolean(active(job));
            root.hidden = root.dataset.syncActiveOnly === 'true' &&
                !busy && job?.status !== 'failed';
            disable(busy || Boolean(starting));
            running.hidden = !busy;
            result.hidden = true;
            result.setAttribute('role', 'status');
            if (!job) {
                last.textContent = 'No completed sync yet';
            } else if (busy) {
                observedId = job.id;
                last.textContent = job.status === 'pending' ? 'Sync queued' : 'Sync in progress';
                const percent = job.progress?.percent;
                if (Number.isFinite(percent)) bar.value = percent;
                else bar.removeAttribute('value');
                text.textContent = (Number.isFinite(percent) ? percent + '% · ' : '') +
                    window.SBJobs.message(job);
            } else if (job.status === 'failed') {
                last.textContent = 'The last sync attempt failed';
                result.textContent = job.error || 'Sync failed. Check Sync Status for details.';
                result.dataset.tone = 'danger';
                result.setAttribute('role', 'alert');
                result.hidden = false;
                if (window.isVpnBlocked?.(job.error || '')) window.showVpnBanner();
            } else {
                const completed = new Date(job.finished_at);
                if (!job.finished_at || !Number.isFinite(completed.getTime())) {
                    throw new Error('The sync returned an invalid completion timestamp.');
                }
                last.textContent = 'Last synced ' + completed.toLocaleString();
                const warnings = job.result?.warnings || [];
                result.textContent = warnings.length ? warnings.join(' ') : 'Sync completed.';
                result.dataset.tone = warnings.length ? 'warning' : 'positive';
                result.hidden = observedId !== job.id && warnings.length === 0;
            }
            handlers.onChange?.(job);
            if (root.dataset.syncActiveOnly === 'true') {
                last.textContent = root.dataset.syncLabel + ' · ' + last.textContent;
            }
            if (!busy && job && observedId === job.id) {
                observedId = null;
                if (job.status === 'done' && handlers.onComplete) {
                    const completedJob = job;
                    Promise.resolve().then(() => handlers.onComplete(completedJob)).catch(error => {
                        showError(error, 'Sync completed, but this page could not update.');
                    });
                }
            }
        }
        function check() {
            if (stopped) return Promise.resolve(job);
            if (reading) return reading;
            reading = window.SBJobs.latest(operation).then(snapshot => {
                if (!stopped) paint(snapshot);
                return snapshot;
            }).catch(error => {
                known = false;
                disable(true);
                if (!stopped) showError(error, 'Sync status unavailable. Reconnecting.');
                throw error;
            }).finally(() => {
                reading = null;
                schedule();
            });
            return reading;
        }
        function start(options = {}) {
            if (starting) return starting;
            if (active(job)) return Promise.resolve(job);
            disable(true);
            result.hidden = true;
            starting = (async () => {
                const existing = await check();
                if (active(existing)) return existing;
                running.hidden = false;
                bar.removeAttribute('value');
                text.textContent = 'Requesting sync...';
                const receipt = await window.SBJobs.start(operation, options);
                if (!stopped) {
                    observedId = receipt.id;
                    paint(receipt);
                }
                return receipt;
            })().catch(error => {
                known = false;
                if (!stopped) showError(error, 'Could not confirm the sync request. Checking status.');
                throw error;
            }).finally(() => {
                starting = null;
                disable(!known || Boolean(active(job)));
                schedule();
            });
            return starting;
        }
        function stop() {
            stopped = true;
            clearTimeout(timer);
        }
        const api = Object.freeze({start, check, stop, get job() { return job; }});
        instances.set(root, {api, handlers});
        disable(true);
        window.addEventListener('pagehide', stop);
        window.addEventListener('pageshow', event => {
            if (event.persisted) {
                stopped = false;
                check().catch(() => {});
            }
        });
        check().catch(() => {});
        return api;
    }
    window.SBSyncProgress = {create};
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-sb-sync-progress]').forEach(root => create(root));
    });
})();
