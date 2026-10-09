/** Preserve independent workspace reading regions on record drill-down and Back. */
((root) => {
    'use strict';
    function validateView(value) {
        if (!value || !Number.isInteger(value.id) || value.id < 1 ||
                typeof value.historyOpen !== 'boolean' ||
                ['agenda', 'surface', 'editor'].some(key =>
                    !Number.isFinite(value[key]) || value[key] < 0)) {
            throw new Error('Invalid saved 1:1 workspace reading position.');
        }
        return value;
    }
    function createReadingController({window, id, embedded, agenda, surface, editor, history, notice}) {
        if (embedded) return {dispose() {}};
        function report(error) {
            window.console.error('1:1 workspace reading context:', error);
            notice.textContent = 'Could not restore or save your reading position for Back.';
            notice.hidden = false;
        }
        function save() {
            try {
                window.history.replaceState({...window.history.state, sbOneOnOneWorkspace: {
                    id, agenda: agenda.scrollTop, surface: surface.scrollTop,
                    editor: editor.scrollTop, historyOpen: Boolean(history?.open),
                }}, '');
            } catch (error) { report(error); }
        }
        function restore() {
            try {
                const saved = window.history.state?.sbOneOnOneWorkspace;
                if (!saved || saved.id !== id) return;
                const view = validateView(saved);
                if (history) history.open = view.historyOpen;
                agenda.scrollTop = view.agenda;
                surface.scrollTop = view.surface;
                editor.scrollTop = view.editor;
            } catch (error) { report(error); }
        }
        restore();
        const regions = [agenda, surface, editor];
        for (const region of regions) region.addEventListener('scroll', save, {passive: true});
        history?.addEventListener('toggle', save);
        window.addEventListener('pagehide', save);
        window.addEventListener('pageshow', restore);
        return {dispose() {
            for (const region of regions) region.removeEventListener('scroll', save);
            history?.removeEventListener('toggle', save);
            window.removeEventListener('pagehide', save);
            window.removeEventListener('pageshow', restore);
        }};
    }
    const api = Object.freeze({validateView, createReadingController});
    root.SBOneOnOneReading = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
