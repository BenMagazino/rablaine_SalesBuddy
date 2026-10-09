/** Serialize autosaves without losing edits made during an in-flight request. */
((root) => {
    'use strict';
    function createSaveQueue({read, write, state, delay = 700}) {
        let saved = read();
        let pending = null;
        let timer;
        let failed = false;
        let changed = false;
        let disposed = false;
        function dirty() { return changed || failed || pending !== null; }
        function save() {
            clearTimeout(timer);
            if (pending) return pending;
            if (disposed || (!failed && !changed)) return Promise.resolve();
            pending = Promise.resolve().then(async () => {
                state('saving');
                try {
                    while (failed || changed) {
                        const value = read();
                        await write(value);
                        saved = value;
                        failed = false;
                        changed = read() !== saved;
                    }
                    state('saved');
                } catch (error) {
                    failed = true;
                    state('failed');
                    throw error;
                } finally {
                    pending = null;
                }
            });
            return pending;
        }
        function change() {
            if (disposed) return;
            changed = read() !== saved;
            clearTimeout(timer);
            if (!changed && !pending && !failed) {
                state('saved');
                return;
            }
            state('unsaved');
            timer = setTimeout(() => { save().catch(() => {}); }, delay);
        }
        function dispose() { clearTimeout(timer); disposed = true; }
        return Object.freeze({change, save, dirty, dispose});
    }
    const api = Object.freeze({createSaveQueue});
    root.SBOneOnOneSave = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
