/* Both report views share the manual import command and progress lifecycle. */
(() => {
    'use strict';
    function create(root, reload) {
        const find = name => root.querySelector(`[data-fabric-${name}]`);
        let pollTimer = null;
        let polling = false;
        let state = 'checking';
        let importedAt = null;
        let progressText = '';
        function renderStatus() {
            const label = state === 'in_progress' ? progressText || 'Importing...' :
                state === 'never_run' ? 'Not imported yet' :
                state === 'checking' ? 'Checking import status...' : 'Import error';
            const lastSuccess = importedAt ?
                `Last successful import: ${importedAt.toLocaleDateString()}` :
                'No successful import yet';
            find('progress').dataset.running = String(state === 'in_progress');
            const savedSnapshot = state === 'complete' ||
                (state === 'never_run' && importedAt !== null);
            find('progress').textContent = savedSnapshot ? lastSuccess :
                state === 'in_progress' || !importedAt ? label : `${label} / ${lastSuccess}`;
            find('progress').title = find('progress').textContent;
        }
        function showError(message) {
            find('import-error').textContent = message;
            find('import-error').hidden = !message;
        }
        async function request(url, options = {}) {
            const response = await fetch(url, {...options, headers: {Accept: 'application/json'}});
            const payload = await response.json();
            if (!response.ok || payload.success === false) {
                throw new Error(payload.error || `Request failed (${response.status}).`);
            }
            return payload;
        }
        async function pollStatus() {
            if (polling) return;
            polling = true;
            try {
                const payload = await request(root.dataset.statusUrl);
                const status = payload.status;
                state = status.state;
                const running = status.state === 'in_progress';
                find('import').disabled = running;
                let details = status.details;
                progressText = '';
                if (state !== 'complete' && details?.startsWith('{')) {
                    const event = JSON.parse(details);
                    details = event.message || event.error || event.phase;
                    if (running) {
                        const percentage = Number.isFinite(event.progress) ?
                            `${event.progress}% / ` : '';
                        progressText = `Importing: ${percentage}${details || 'Fetching Fabric data...'}`;
                    }
                } else if (running && details) {
                    progressText = `Importing: ${details}`;
                }
                renderStatus();
                if (running) {
                    pollTimer = setTimeout(pollStatus, 2000);
                } else if (pollTimer) {
                    clearTimeout(pollTimer);
                    pollTimer = null;
                    await reload();
                }
                if (status.state === 'failed' || status.state === 'incomplete') {
                    showError(status.state === 'incomplete' ?
                        'Import interrupted. You can retry; the saved snapshot is retained.' :
                        details || 'Import failed. You can retry; the saved snapshot is retained.');
                }
            } catch (error) {
                state = 'failed';
                renderStatus();
                console.error('Could not check Fabric import status:', error);
                showError(`Could not check import status: ${error.message}`);
                find('import').disabled = false;
            } finally {
                polling = false;
            }
        }
        find('import').addEventListener('click', async () => {
            find('import').disabled = true;
            showError('');
            state = 'in_progress';
            progressText = 'Starting Fabric import...';
            renderStatus();
            try {
                await request(root.dataset.importUrl, {method: 'POST'});
                pollTimer = setTimeout(pollStatus, 1000);
            } catch (error) {
                state = 'failed';
                renderStatus();
                console.error('Could not start Fabric import:', error);
                find('import').disabled = false;
                showError(`Import could not start: ${error.message}`);
            }
        });
        find('import').disabled = true;
        pollStatus();
        return {
            setImportedAt(value) {
                const date = value ? new Date(value) : null;
                if (date && !Number.isFinite(date.getTime())) {
                    throw new Error('The saved Fabric import timestamp is invalid.');
                }
                importedAt = date;
                renderStatus();
            },
        };
    }
    window.SBFabricImport = {create};
})();
