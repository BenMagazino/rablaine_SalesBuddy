/* A browser observes durable jobs; it never owns or resumes their execution. */
(() => {
    'use strict';
    const root = document.querySelector('[data-sb-sync-console]');
    if (!root) return;
    const error = root.querySelector('[data-sync-error]');
    const worker = root.querySelector('[data-sync-worker]');
    const labels = {pending: 'Queued', queued: 'Queued', waiting_for_worker: 'Waiting for worker',
        running: 'Running', retry_waiting: 'Waiting to retry', interrupted: 'Interrupted',
        waiting_for_group: 'Waiting for another sync', waiting_for_write: 'Waiting to save',
        saving: 'Saving', done: 'Completed', failed: 'Failed'};
    const legacyLabels = {never_run: 'Not run', complete: 'Completed (previous sync)',
        failed: 'Failed (previous sync)', incomplete: 'Interrupted (previous sync)',
        in_progress: 'Running (previous sync)'};
    let timer, inFlight = false, disposed = false, active = false, refreshRequested = false;
    const local = value => value ? new Date(value).toLocaleString() : 'Never';
    const elapsed = (start, end) => {
        const seconds = Math.max(0, Math.floor(
            (new Date(end || Date.now()) - new Date(start)) / 1000));
        if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
        return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
    };
    function paint(operation) {
        const row = root.querySelector(`[data-sync-operation="${operation.operation}"]`);
        if (!row) return;
        const job = operation.latest;
        const running = job && ['pending', 'running'].includes(job.status);
        row.dataset.state = job?.state || operation.legacy_state?.state || 'never_run';
        if (operation.schedule) {
            const schedule = row.querySelector('[data-sync-schedule]');
            schedule.textContent = operation.schedule.label;
            row.querySelector('[data-sync-schedule-inspect]').hidden =
                operation.schedule.triggers.length === 0;
            row.querySelector('[data-sync-schedule-triggers]').textContent =
                operation.schedule.triggers.join('\n');
        }
        active ||= Boolean(running);
        const progress = row.querySelector('[data-sync-progress]');
        row.querySelector('[data-sync-state]').textContent = job ? labels[job.state] :
            legacyLabels[operation.legacy_state?.state] || 'Not run';
        progress.hidden = !running;
        if (Number.isFinite(job?.progress.percent)) progress.value = job.progress.percent;
        else progress.removeAttribute('value');
        let message = job?.progress.message || '';
        if (job?.state === 'running') message ||= 'Sync is running.';
        else if (job?.state === 'saving') {
            message = 'Saving data. Other syncs can keep fetching.';
        } else if (job?.state === 'waiting_for_group') {
            message = `Waiting for ${job.blocker.name}, job ${job.blocker.id}.`;
        } else if (job?.state === 'waiting_for_write') {
            message = job.blocker ? `Waiting for ${job.blocker.name} to finish saving.` :
                'Waiting for the background database write slot.';
        }
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
            message = job.error || 'Sync failed. See run details before starting a new sync.';
        }
        row.querySelector('[data-sync-message]').textContent = message;
        row.querySelector('[data-sync-live-progress]').hidden = !running;
        row.querySelector('[data-sync-progress-label]').textContent =
            Number.isFinite(job?.progress.percent) ? `${Math.round(job.progress.percent)}%` :
                labels[job?.state] || 'Working';
        const progressMessage = row.querySelector('[data-sync-progress-message]');
        progressMessage.textContent = message;
        progressMessage.title = message;
        const recovery = row.querySelector('[data-sync-recovery]');
        const previousError = job?.error &&
            ['running', 'saving', 'waiting_for_write', 'retry_waiting', 'interrupted',
                'waiting_for_group'].includes(job.state);
        recovery.hidden = !previousError;
        recovery.textContent = previousError ?
            (job.error === 'worker died (stale heartbeat)' ?
                'Previous attempt was interrupted when the worker stopped.' :
                `Previous attempt failed: ${job.error}`) +
            (['running', 'saving', 'waiting_for_write'].includes(job.state) ?
                ' Automatically restarted; running again.' : '') : '';
        row.querySelector('[data-sync-success]').textContent = local(operation.last_success_at);
        row.querySelector('[data-sync-run]').textContent = job ?
            `Job ${job.id} · attempt ${job.attempt}/${job.max_attempts} · ` +
            `${job.finished_at ? 'Finished' : 'Accepted'} ${local(job.finished_at || job.created_at)}` :
            'No durable run recorded. Status may come from an earlier sync.';
        const triggers = {manual: 'Started manually', scheduled: 'Scheduled automatically',
            followup: 'Automatic follow-up', headless: 'Headless trigger',
            'legacy-queue': 'Migrated from the earlier queue'};
        row.querySelector('[data-sync-trigger]').textContent = job ?
            triggers[job.initiator] || (job.initiator?.startsWith('job:') ?
                `Prerequisite for job ${job.initiator.slice(4)}` :
                `Trigger: ${job.initiator || 'not recorded'}`) : '';
        row.querySelector('[data-sync-timing]').textContent = job?.started_at ?
            `Started ${local(job.started_at)} · ${job.finished_at ? 'Duration' : 'Elapsed'}: ` +
                elapsed(job.started_at, job.finished_at) : job ? 'Not started yet.' : '';
        const heartbeat = row.querySelector('[data-sync-heartbeat]');
        heartbeat.hidden = !running;
        heartbeat.textContent = running ?
            `Last heartbeat: ${local(job.heartbeat_at)}. Last progress: ${local(job.progress_at)}.` : '';
        const queued = row.querySelector('[data-sync-queued]');
        queued.hidden = !operation.queued?.length;
        queued.textContent = (operation.queued || []).map(run =>
            `Also queued: job ${run.id}` + (run.blocker ?
                `, waiting for ${run.blocker.name}, job ${run.blocker.id}.` : '.')).join(' ');
        const start = row.querySelector('[data-sync-start]');
        start.disabled = Boolean(running) || row.dataset.starting === 'true';
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
            error.textContent = `Status could not be refreshed: ${failure.message}. Retrying automatically.`;
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
    const showOptions = root.querySelector('[data-sync-show-options]');
    showOptions.addEventListener('change', () => {
        root.querySelectorAll('.sb-sync-options').forEach(options => {
            options.hidden = !showOptions.checked;
        });
    });
    root.querySelectorAll('[data-sync-inspect]').forEach(inspect => {
        function positionDetails() {
            delete inspect.dataset.dismissed;
            const card = inspect.querySelector('.sb-sync-run-card');
            const anchor = inspect.getBoundingClientRect();
            const bounds = card.getBoundingClientRect();
            card.style.left = `${Math.max(16, Math.min(anchor.right - bounds.width,
                window.innerWidth - bounds.width - 16))}px`;
            card.style.top = `${Math.max(16, Math.min(anchor.bottom,
                window.innerHeight - bounds.height - 16))}px`;
        }
        inspect.addEventListener('pointerenter', positionDetails);
        inspect.addEventListener('focusin', positionDetails);
        inspect.addEventListener('keydown', event => {
            if (event.key === 'Escape') inspect.dataset.dismissed = 'true';
        });
    });
    root.querySelectorAll('[data-sync-start]').forEach(button => {
        button.addEventListener('click', async () => {
            const row = button.closest('[data-sync-operation]');
            if (row.dataset.starting === 'true') return;
            const notice = row.querySelector('[data-sync-row-error]');
            row.dataset.starting = 'true'; button.disabled = true;
            try {
                const editor = row.querySelector('[data-sync-options]');
                const options = editor ? JSON.parse(editor.value) : {};
                if (!options || typeof options !== 'object' || Array.isArray(options)) {
                    throw new Error('Options must be a JSON object.');
                }
                // Retain a request key after an uncertain response so retry cannot duplicate work.
                row.dataset.requestKey ||= crypto.randomUUID();
                const response = await fetch(`/api/jobs/start/${row.dataset.syncOperation}`, {
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
