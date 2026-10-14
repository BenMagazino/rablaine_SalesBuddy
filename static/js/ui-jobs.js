/* Compatibility observer for JSON callers of durable job admission routes. */
(() => {
    'use strict';
    const nativeFetch = window.fetch.bind(window);
    async function fetchJob(url, options = {}) {
        const response = await nativeFetch(url, options);
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
        while (true) {
            if (signal?.aborted) throw new DOMException('Observation aborted', 'AbortError');
            const statusResponse = await nativeFetch(statusURL, {
                cache: 'no-store', signal,
            });
            const status = await statusResponse.json();
            if (!statusResponse.ok || !status.job) {
                throw new Error(status.error || 'Could not observe the accepted sync.');
            }
            const job = status.job;
            if (job.status === 'failed') {
                return new Response(JSON.stringify({success: false, error: job.error,
                    job_id: job.id}), {status: 502, headers: {'Content-Type': 'application/json'}});
            }
            if (job.status === 'done') {
                if (method.toUpperCase() === 'GET') {
                    return nativeFetch(url, options);
                }
                return new Response(JSON.stringify({success: true, ...job.result, job_id: job.id}),
                    {status: 200, headers: {'Content-Type': 'application/json'}});
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    window.SBJobs = {fetch: fetchJob};
    window.fetch = fetchJob;
})();
