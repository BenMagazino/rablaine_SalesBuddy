/* Both report views share the manual import command and progress lifecycle. */
(() => {
    'use strict';
    function create(root, reload) {
        const find = name => root.querySelector(`[data-fabric-${name}]`);
        let importedAt = null;
        function renderStatus() {
            find('progress').textContent = importedAt ?
                `Last successful import: ${importedAt.toLocaleDateString()}` :
                'No successful import yet';
            find('progress').title = find('progress').textContent;
        }
        const sync = window.SBSyncProgress.create(
            root.querySelector('[data-sb-sync-progress="fabric"]'), {
                onComplete: reload,
            });
        find('import').addEventListener('click', () => {
            sync.start().catch(() => {});
        });
        renderStatus();
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
