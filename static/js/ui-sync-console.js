/* A browser observes durable jobs; it never owns or resumes their execution. */
(() => {
    'use strict';
    const root = document.querySelector('[data-sb-sync-console]');
    if (!root) return;
    const error = root.querySelector('[data-sync-error]');
    const worker = root.querySelector('[data-sync-worker]');
    const labels = {pending: 'Queued', queued: 'Queued', waiting_for_worker: 'Waiting for worker',
        running: 'Running', retry_waiting: 'Waiting to retry', interrupted: 'Interrupted',
        done: 'Completed', failed: 'Failed'};
    const legacyLabels = {never_run: 'Not run', complete: 'Completed (previous sync)',
        failed: 'Failed (previous sync)', incomplete: 'Interrupted (previous sync)',
        in_progress: 'Running (previous sync)'};
    let timer, inFlight = false, disposed = false, active = false, refreshRequested = false;
    const local = value => value ? new Date(value).toLocaleString() : 'Never';
    function paint(operation) {
        const row = root.querySelector(`[data-sync-operation="${operation.operation}"]`);
        if (!row) return;
        const job = operation.latest;
        const running = job && ['pending', 'running'].includes(job.status);
        active ||= Boolean(running);
        const progress = row.querySelector('[data-sync-progress]');
        row.querySelector('[data-sync-state]').textContent = job ? labels[job.state] :
            legacyLabels[operation.legacy_state?.state] || 'Not run';
        progress.hidden = !running;
        if (Number.isFinite(job?.progress.percent)) progress.value = job.progress.percent;
        else progress.removeAttribute('value');
        let message = job?.progress.message || '';
        if (job?.state === 'running') message ||= 'Sync is running.';
        else if (job?.state === 'retry_waiting') {
            message = job.retry_at ? `Automatic retry scheduled for ${local(job.retry_at)}.` :
                'Waiting for an automatic retry.';
        } else if (job?.state === 'waiting_for_worker') {
            message = 'Saved in the queue. Sync will start when the worker is available.';
        } else if (['pending', 'queued'].includes(job?.state)) {
            message = 'Waiting for the worker to pick up this sync.';
        } else if (job?.state === 'interrupted') {
            message = 'The worker stopped reporting. Waiting for recovery.';
        } else if (job?.status === 'failed') {
            message = job.error || 'Sync failed. See run details before retrying.';
        }
        row.querySelector('[data-sync-message]').textContent = message;
        const recovery = row.querySelector('[data-sync-recovery]');
        const previousError = job?.error &&
            ['running', 'retry_waiting', 'interrupted'].includes(job.state);
        recovery.hidden = !previousError;
        recovery.textContent = previousError ?
            (job.error === 'worker died (stale heartbeat)' ?
                'Previous attempt was interrupted when the worker stopped.' :
                `Previous attempt failed: ${job.error}`) +
            (job.state === 'running' ? ' Automatically restarted; running again.' : '') : '';
        row.querySelector('[data-sync-success]').textContent =
            `Last success: ${local(operation.last_success_at)}`;
        row.querySelector('[data-sync-run]').textContent = job ?
            `Job ${job.id} · attempt ${job.attempt}/${job.max_attempts} · ` +
            `${job.finished_at ? 'Finished' : 'Accepted'} ${local(job.finished_at || job.created_at)}` : '';
        const start = row.querySelector('[data-sync-start]');
        start.disabled = Boolean(running) || row.dataset.starting === 'true';
        const retry = row.querySelector('[data-sync-retry]');
        retry.hidden = job?.status !== 'failed';
        retry.disabled = row.dataset.starting === 'true';
        row.dataset.retryJobId = job?.status === 'failed' ? String(job.id) : '';
        const details = row.querySelector('[data-sync-details]');
        details.hidden = !job;
        if (job) details.href = `/api/jobs/${job.id}`;
    }
    async function refresh() {
        if (disposed || document.hidden) return;
        if (inFlight) { refreshRequested = true; return; }
        inFlight = true;
        try {
            const response = await fetch('/api/jobs', {cache: 'no-store'});
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Could not read sync status.');
            active = false;
            worker.textContent = data.worker.message;
            data.operations.forEach(paint);
            error.hidden = true;
        } catch (failure) {
            error.textContent = `Status could not be refreshed: ${failure.message}. Check now to retry.`;
            error.hidden = false;
            console.error('Sync status read failed', failure);
        } finally {
            inFlight = false;
            clearTimeout(timer);
            if (!disposed && !document.hidden) {
                timer = setTimeout(refresh, refreshRequested ? 0 : active ? 2000 : 15000);
            }
            refreshRequested = false;
        }
    }
    root.querySelector('[data-sync-refresh]').addEventListener('click', refresh);
    root.querySelectorAll('[data-sync-start], [data-sync-retry]').forEach(button => {
        button.addEventListener('click', async () => {
            const row = button.closest('[data-sync-operation]');
            if (row.dataset.starting === 'true') return;
            const notice = row.querySelector('[data-sync-row-error]');
            row.dataset.starting = 'true'; button.disabled = true;
            try {
                const retry = button.hasAttribute('data-sync-retry');
                const options = retry ? {} : JSON.parse(row.querySelector('[data-sync-options]').value);
                if (!options || typeof options !== 'object' || Array.isArray(options)) {
                    throw new Error('Options must be a JSON object.');
                }
                // Retain a request key after an uncertain response so retry cannot duplicate work.
                row.dataset.requestKey ||= crypto.randomUUID();
                const url = retry ? `/api/jobs/${row.dataset.retryJobId}/retry` :
                    `/api/jobs/start/${row.dataset.syncOperation}`;
                const response = await fetch(url, {
                    method: 'POST', headers: {'Content-Type': 'application/json',
                        'Idempotency-Key': row.dataset.requestKey}, body: JSON.stringify(options),
                });
                const data = await response.json();
                if (!response.ok || !data.accepted) {
                    delete row.dataset.requestKey;
                    throw new Error(data.error || 'Could not start this sync.');
                }
                delete row.dataset.requestKey;
                notice.hidden = true;
            } catch (failure) {
                notice.textContent = failure.message; notice.hidden = false;
                console.error('Sync admission failed', failure);
            } finally {
                row.dataset.starting = 'false'; button.disabled = false;
                await refresh();
            }
        });
    });
    document.addEventListener('visibilitychange', () => {
        clearTimeout(timer);
        if (!document.hidden) refresh();
    });
    window.addEventListener('pagehide', () => { disposed = true; clearTimeout(timer); });
    window.addEventListener('pageshow', () => { disposed = false; refresh(); });
    refresh();
})();
