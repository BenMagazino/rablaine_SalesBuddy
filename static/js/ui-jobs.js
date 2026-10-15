/* Compatibility observer for JSON callers of durable job admission routes. */
(() => {
    'use strict';
    const nativeFetch = window.fetch.bind(window);
    function message(job) {
        if (job.state === 'waiting_for_group') {
            return `Waiting for ${job.blocker.name}, job ${job.blocker.id}.`;
        }
        if (job.state === 'waiting_for_write') {
            return job.blocker ? `Waiting for ${job.blocker.name} to finish saving.` :
                'Waiting for the background database write slot.';
        }
        if (job.state === 'saving') return 'Saving synced data.';
        if (job.state === 'retry_waiting') return 'Waiting for an automatic retry.';
        if (job.state === 'interrupted') return 'Waiting for worker recovery.';
        if (job.status === 'pending') return 'Sync accepted. Waiting for the worker.';
        return job.progress?.message || (job.status === 'done' ? 'Sync completed.' :
            job.error || 'Sync is running.');
    }
    async function observe(jobId, {onProgress, signal} = {}) {
        if (!Number.isInteger(jobId) || jobId <= 0) {
            throw new Error('The sync server returned an invalid job identity.');
        }
        while (true) {
            if (signal?.aborted) throw new DOMException('Observation aborted', 'AbortError');
            const response = await nativeFetch(`/api/jobs/${jobId}`, {cache: 'no-store', signal});
            const data = await response.json();
            if (!response.ok || data.job?.id !== jobId ||
                !['pending', 'running', 'done', 'failed'].includes(data.job.status)) {
                throw new Error(data.error || 'Could not observe the accepted sync.');
            }
            const job = data.job;
            if (onProgress) onProgress(job);
            if (['done', 'failed'].includes(job.status)) return job;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    async function fetchJob(url, options = {}) {
        const {onJobProgress, ...requestOptions} = options;
        const response = await nativeFetch(url, requestOptions);
        const isRequest = url instanceof Request;
        const requestURL = new URL(isRequest ? url.url : String(url), window.location.href);
        if (requestURL.origin !== window.location.origin ||
            requestURL.pathname.startsWith('/api/jobs')) return response;
        if (response.status !== 202 || !response.headers.get('Content-Type')?.includes('json')) {
            return response;
        }
        const accepted = await response.clone().json();
        if (!accepted.accepted || !accepted.job_id || !accepted.status_url) return response;
        const statusURL = new URL(accepted.status_url, window.location.href);
        if (!Number.isInteger(accepted.job_id) || accepted.job_id <= 0 ||
            statusURL.origin !== window.location.origin ||
            statusURL.pathname !== `/api/jobs/${accepted.job_id}`) {
            throw new Error('The sync server returned an invalid job status URL.');
        }
        const signal = options.signal || (isRequest ? url.signal : undefined);
        const method = options.method || (isRequest ? url.method : 'GET');
        const job = await observe(accepted.job_id, {onProgress: onJobProgress, signal});
        if (job.status === 'failed') {
            return new Response(JSON.stringify({success: false, error: job.error,
                job_id: job.id}), {status: 502, headers: {'Content-Type': 'application/json'}});
        }
        if (method.toUpperCase() === 'GET') return nativeFetch(url, requestOptions);
        return new Response(JSON.stringify({success: true, ...job.result, job_id: job.id}),
            {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    async function latest(operation) {
        const response = await nativeFetch(`/api/jobs/operations/${encodeURIComponent(operation)}`,
            {cache: 'no-store'});
        const data = await response.json();
        if (!response.ok || data.success !== true || !('job' in data) ||
            (data.job !== null && (data.job.operation !== operation ||
                !Number.isInteger(data.job.id) || data.job.id <= 0 ||
                !['pending', 'running', 'done', 'failed'].includes(data.job.status)))) {
            throw new Error(data.error || 'Could not read sync status.');
        }
        return data.job;
    }
    async function start(operation, options = {}) {
        const response = await nativeFetch(`/api/jobs/start/${encodeURIComponent(operation)}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(options),
        });
        const data = await response.json();
        if (!response.ok || data.accepted !== true || !Number.isInteger(data.job_id) ||
            data.job_id <= 0 || data.job?.id !== data.job_id ||
            data.job?.operation !== operation ||
            !['pending', 'running', 'done', 'failed'].includes(data.job?.status)) {
            throw new Error(data.error || 'Could not confirm sync admission.');
        }
        return data.job;
    }
    window.SBJobs = {fetch: fetchJob, observe, message, latest, start};
    window.fetch = fetchJob;
})();
