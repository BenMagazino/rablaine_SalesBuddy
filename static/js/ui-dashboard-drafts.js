(function (global) {
    'use strict';

    const PREFIX = 'sb.dashboard.draft.';

    function validate(draft) {
        if (!draft || draft.version !== 1 || !Number.isInteger(draft.revision)
            || draft.revision < 0 || !['name', 'subtitle', 'base_name', 'base_subtitle']
                .every(field => typeof draft[field] === 'string')
            || !['standard', 'wide'].includes(draft.content_width)
            || !['cards', 'dividers'].includes(draft.display_style)
            || !Array.isArray(draft.widgets)) {
            throw new Error('This dashboard draft is invalid or uses an unsupported format.');
        }
        const ids = new Set();
        for (const item of draft.widgets) {
            if (!item || !Number.isInteger(item.id) || !item.id || ids.has(item.id)
                || typeof item.key !== 'string' || typeof item.variant_key !== 'string'
                || !['layout_column', 'layout_row', 'column_span', 'row_span']
                    .every(field => Number.isInteger(item[field]))) {
                throw new Error('This dashboard draft contains an invalid widget.');
            }
            ids.add(item.id);
        }
        return draft;
    }

    function createStore(storage) {
        const key = id => PREFIX + id;
        function checkCurrent(id, expected) {
            const current = storage.getItem(key(id));
            if (JSON.stringify(current === null ? null : JSON.parse(current))
                !== JSON.stringify(expected ?? null)) {
                const error = new Error('This draft changed in another window. Reload to resume it.');
                error.name = 'DashboardDraftConflict';
                throw error;
            }
        }
        return Object.freeze({
            read(id) {
                const value = storage.getItem(key(id));
                return value === null ? null : validate(JSON.parse(value));
            },
            write(id, draft, expected) {
                checkCurrent(id, expected);
                const record = {...validate(draft), saved_at: new Date().toISOString()};
                storage.setItem(key(id), JSON.stringify(record));
                return record;
            },
            remove(id, expected) {
                if (expected !== undefined) checkCurrent(id, expected);
                storage.removeItem(key(id));
            },
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {createStore, validate, PREFIX};
    }
    if (global.document) {
        global.SBDashboardDrafts = Object.freeze({
            read: id => createStore(global.localStorage).read(id),
            write: (id, draft, expected) => createStore(global.localStorage).write(id, draft, expected),
            remove: (id, expected) => createStore(global.localStorage).remove(id, expected),
            key: id => PREFIX + id,
        });
    }
})(typeof window === 'undefined' ? globalThis : window);
