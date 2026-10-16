/* Shared, recoverable lifecycle for manual and automatic calendar refreshes. */
(() => {
    'use strict';

    function create({read, start, paint, complete, showError, clearError,
        schedule = setTimeout, cancel = clearTimeout}) {
        const jobs = new Map();
        const handled = new Set();
        const admitting = new Set();
        let timer = null;
        let checking = null;
        let stopped = false;

        function outcome(job, date) {
            const terminal = ['done', 'failed'].includes(job.status);
            const state = job.status === 'pending' ? 'queued' :
                job.operation === 'meeting-aura' ? job.progress?.date_states?.[date] : undefined;
            if (state === 'complete' && job.operation === 'meeting-aura') return {state};
            if (state === 'failed') {
                return {state, error: job.progress.date_errors?.[date] ||
                    job.result?.errors?.[date] || job.error || 'Meeting date refresh failed.'};
            }
            if (!terminal) {
                const waiting = job.status === 'pending' ||
                    ['waiting_for_group', 'waiting_for_write', 'retry_waiting', 'interrupted']
                        .includes(job.state);
                return {state: waiting ? 'queued' : state || 'running', job};
            }
            if (job.status === 'failed') {
                return {state: 'failed', error: job.result?.errors?.[date] ||
                    job.error || 'Meeting refresh did not finish.'};
            }
            if (job.operation === 'meetings') {
                if (job.result?.date !== date || typeof job.result?.synced_at !== 'string' ||
                    !Number.isFinite(new Date(job.result.synced_at).getTime())) {
                    return {state: 'failed',
                        error: 'Meeting refresh did not confirm a valid cache timestamp.'};
                }
            } else if (!Object.hasOwn(job.result?.counts || {}, date) ||
                job.result?.errors?.[date]) {
                return {state: 'failed', error: job.result?.errors?.[date] ||
                    job.error || 'Meeting refresh did not confirm this date.'};
            }
            return {state: 'complete'};
        }

        function states() {
            const result = new Map();
            for (const job of jobs.values()) for (const date of job.calendar_dates) {
                const value = outcome(job, date);
                if (!['complete', 'failed'].includes(value.state)) result.set(date, value);
            }
            for (const date of admitting) {
                if (!result.has(date)) result.set(date, {state: 'queued'});
            }
            return result;
        }

        function render() {
            paint(states());
        }

        function update(snapshots) {
            if (!Array.isArray(snapshots) || snapshots.some(job =>
                !Number.isInteger(job?.id) || job.id <= 0 ||
                !['meetings', 'meeting-aura'].includes(job.operation) ||
                !['pending', 'running', 'done', 'failed'].includes(job.status) ||
                !Array.isArray(job.calendar_dates) || job.calendar_dates.some(
                    date => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)))) {
                throw new Error('Meeting refresh status returned invalid jobs.');
            }
            for (const job of snapshots) jobs.set(job.id, job);
            const completed = new Set();
            for (const job of snapshots) for (const date of job.calendar_dates) {
                const value = outcome(job, date);
                const key = `${job.id}:${job.attempt || 0}:${date}:${value.state}`;
                if (handled.has(key)) continue;
                handled.add(key);
                if (value.state === 'complete') {
                    clearError(date);
                    completed.add(date);
                } else if (value.state === 'failed') {
                    showError(date, value.error);
                } else {
                    clearError(date);
                }
            }
            render();
            if (completed.size) complete([...completed]);
        }

        function check() {
            stopped = false;
            if (checking) return checking;
            if (timer !== null) cancel(timer);
            timer = null;
            const watched = [...jobs.values()].filter(
                job => ['pending', 'running'].includes(job.status)).map(job => job.id);
            checking = Promise.resolve().then(() => read(watched)).then(data => {
                if (Array.isArray(data.jobs) &&
                    watched.some(id => !data.jobs.some(job => job.id === id))) {
                    throw new Error('An observed meeting refresh is missing from status.');
                }
                update(data.jobs);
                clearError(null);
            }).catch(error => {
                showError(null, 'Could not read meeting refresh status. Reconnecting. ' +
                    error.message);
            }).finally(() => {
                checking = null;
                if (!stopped) timer = schedule(check, 3000);
            });
            return checking;
        }

        async function request(date) {
            if (admitting.has(date) || states().has(date)) return;
            admitting.add(date);
            clearError(date);
            render();
            try {
                const job = await start(date);
                if (job.operation !== 'meetings' || job.options?.date !== date) {
                    throw new Error('Meeting refresh admission returned a different date.');
                }
                // Admission uses the same durable snapshot as later discovery.
                update([{...job, calendar_dates: [date]}]);
            } catch (error) {
                showError(date, error.message);
            } finally {
                admitting.delete(date);
                render();
            }
            return check();
        }

        return {check, request, render, getJob: date => states().get(date)?.job, stop() {
            stopped = true;
            if (timer !== null) cancel(timer);
        }};
    }

    window.SBMeetingRefresh = {create};
})();
