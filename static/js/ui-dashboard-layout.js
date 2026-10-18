(function (global) {
    'use strict';

    const WIDTH_LABELS = {3: 'Quarter', 4: 'Third', 6: 'Half', 12: 'Full'};
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const nearest = (value, choices) => choices.reduce((best, item) =>
        Math.abs(item - value) < Math.abs(best - value) ? item : best);

    function overlaps(a, b) {
        return a.layout_column < b.layout_column + b.column_span
            && b.layout_column < a.layout_column + a.column_span
            && a.layout_row < b.layout_row + b.row_span
            && b.layout_row < a.layout_row + a.row_span;
    }

    function canPlace(item, entries, maxRows = 1000) {
        return ['layout_column', 'layout_row', 'column_span', 'row_span']
            .every(key => Number.isInteger(item[key]))
            && item.layout_column >= 0 && item.layout_row >= 0
            && item.column_span > 0 && item.row_span > 0
            && item.layout_column + item.column_span <= 12
            && item.layout_row + item.row_span <= maxRows
            && !entries.some(other => other.id !== item.id && overlaps(item, other));
    }

    function pointerGeometry(origin, mode, dx, dy, stepX, stepY, widths, minHeight,
        maxRows = 1000) {
        if (mode === 'move') return {...origin,
            layout_column: clamp(origin.layout_column + Math.round(dx / stepX),
                0, 12 - origin.column_span),
            layout_row: clamp(origin.layout_row + Math.round(dy / stepY),
                0, maxRows - origin.row_span),
        };
        const allowed = widths.filter(width => width + origin.layout_column <= 12);
        return {...origin,
            column_span: nearest(origin.column_span + dx / stepX, allowed),
            row_span: clamp(origin.row_span + Math.round(dy / stepY),
                minHeight, Math.min(20, maxRows - origin.layout_row)),
        };
    }

    function keyboardGeometry(origin, mode, key, widths, minHeight, maxRows = 1000) {
        const item = {...origin};
        if (mode === 'move') {
            if (key === 'ArrowLeft') item.layout_column--;
            if (key === 'ArrowRight') item.layout_column++;
            if (key === 'ArrowUp') item.layout_row--;
            if (key === 'ArrowDown') item.layout_row++;
        } else {
            const allowed = widths.filter(width => width + origin.layout_column <= 12);
            const index = allowed.indexOf(origin.column_span);
            if (key === 'ArrowLeft') item.column_span = allowed[Math.max(0, index - 1)];
            if (key === 'ArrowRight') item.column_span = allowed[Math.min(allowed.length - 1, index + 1)];
            if (key === 'ArrowUp') item.row_span = Math.max(minHeight, item.row_span - 1);
            if (key === 'ArrowDown') item.row_span = Math.min(
                20, maxRows - item.layout_row, item.row_span + 1);
        }
        return item;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {overlaps, canPlace, pointerGeometry, keyboardGeometry};
    }
    if (!global.document) return;

    function init() {
        const root = document.querySelector('[data-dashboard-id]');
        if (!root) return;
        const config = JSON.parse(document.getElementById('dashboardConfig').textContent);
        const canvas = document.getElementById('dashboardCanvas');
        const reading = document.getElementById('dashboardReading');
        const editor = document.getElementById('layoutEditor');
        const inspector = document.getElementById('widgetInspector');
        const status = document.getElementById('layoutState');
        const errorBox = document.getElementById('dashboardError');
        const widthSelect = document.getElementById('canvasWidth');
        const saveButton = document.getElementById('saveDashboardLayout');
        const editButton = document.getElementById('editDashboardLayout');
        const outsideControls = [
            document.getElementById('openWidgetLibrary'),
            ...root.querySelectorAll('[data-db-toggle], [data-dashboard-rename] button, [data-dashboard-rename] input'),
        ];
        const tiles = new Map(Array.from(canvas.querySelectorAll('[data-widget-id]'),
            tile => [Number(tile.dataset.widgetId), tile]));
        const saved = Array.from(tiles, ([id, tile]) => ({
            id, key: tile.dataset.widgetKey, variant_key: tile.dataset.variant,
            layout_column: Number(tile.dataset.column), layout_row: Number(tile.dataset.row),
            column_span: Number(tile.dataset.columnSpan), row_span: Number(tile.dataset.rowSpan),
        }));
        let entries = saved.map(item => ({...item}));
        let contentWidth = config.contentWidth;
        let editing = false;
        let dirty = false;
        let pending = false;
        let selectedId = null;
        let gesture = null;
        let frame = null;

        function definition(item) {
            return config.catalog.find(entry => entry.key === item.key);
        }
        function variants(item) {
            return definition(item)?.variants || [{
                key: item.variant_key, title: 'Unavailable', widths: [3, 4, 6, 12],
                min_height: 3, default_height: 8,
            }];
        }
        function variant(item) {
            return variants(item).find(entry => entry.key === item.variant_key)
                || variants(item)[0];
        }
        function showError(message, error) {
            if (error) console.error('Dashboard layout:', error);
            errorBox.textContent = message;
            errorBox.hidden = false;
        }
        function markDirty() {
            dirty = JSON.stringify(entries) !== JSON.stringify(saved)
                || contentWidth !== config.contentWidth;
            saveButton.disabled = !dirty || pending;
            status.textContent = dirty
                ? 'Unsaved layout. Presentation changes apply on save.'
                : editing ? 'Editing layout' : 'Layout saved';
        }
        function sizeCanvas(extra) {
            const items = extra ? entries.map(item => item.id === extra.id ? extra : item) : entries;
            const bottom = Math.max(4, ...items.map(item => item.layout_row + item.row_span));
            canvas.style.setProperty('--db-rows', Math.min(config.grid.maxRows,
                bottom + (editing ? 6 : 0)));
            canvas.style.setProperty('--db-canvas-width', config.widths[contentWidth] + 'px');
        }
        function paint(item, invalid = false) {
            const tile = tiles.get(item.id);
            tile.style.gridColumn = `${item.layout_column + 1} / span ${item.column_span}`;
            tile.style.gridRow = `${item.layout_row + 1} / span ${item.row_span}`;
            tile.dataset.columnSpan = item.column_span;
            tile.dataset.rowSpan = item.row_span;
            tile.classList.toggle('is-invalid', invalid);
            tile.querySelector('.db-widget-tools > span').textContent =
                'FY27 Data · ' + variant(item).title;
        }
        function options(select, choices, current) {
            select.replaceChildren(...choices.map(([value, label]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                return option;
            }));
            select.value = current;
        }
        function updateInspector() {
            const item = entries.find(entry => entry.id === selectedId);
            inspector.querySelectorAll('input, select, button').forEach(
                control => { control.disabled = !item || pending; });
            document.getElementById('selectedWidgetTitle').textContent = item
                ? tiles.get(item.id).getAttribute('aria-label') : 'Select a widget';
            if (!item) return;
            options(inspector.elements.variant_key,
                variants(item).map(entry => [entry.key, entry.title]), item.variant_key);
            options(inspector.elements.column_span,
                variant(item).widths.map(width => [width, WIDTH_LABELS[width]]), item.column_span);
            inspector.elements.layout_column.value = item.layout_column + 1;
            inspector.elements.layout_row.value = item.layout_row + 1;
            inspector.elements.row_span.value = item.row_span;
            inspector.elements.row_span.min = variant(item).min_height;
        }
        function select(id) {
            selectedId = id;
            tiles.forEach((tile, tileId) => tile.classList.toggle('is-selected', tileId === id));
            updateInspector();
        }
        function setEditing(value) {
            editing = value;
            root.classList.toggle('is-editing', value);
            editor.hidden = !value;
            editButton.hidden = value;
            outsideControls.forEach(control => { control.disabled = value; });
            document.getElementById('dashboardSettings').hidden = true;
            root.querySelectorAll('.db-widget-body').forEach(body => { body.inert = value; });
            widthSelect.value = contentWidth;
            sizeCanvas();
            markDirty();
        }
        function apply(item) {
            if (!canPlace(item, entries, config.grid.maxRows)) {
                showError('That position is occupied or outside the grid. Other widgets were not moved.');
                updateInspector();
                return false;
            }
            const currentVariant = variant(item);
            if (!currentVariant.widths.includes(item.column_span)
                || item.row_span < currentVariant.min_height || item.row_span > 20) {
                showError('Choose a supported width and height for this variation.');
                updateInspector();
                return false;
            }
            entries = entries.map(entry => entry.id === item.id ? item : entry);
            errorBox.hidden = true;
            paint(item);
            sizeCanvas();
            updateInspector();
            markDirty();
            status.textContent += ` Row ${item.layout_row + 1}, column ${item.layout_column + 1}, ${WIDTH_LABELS[item.column_span]} width, ${item.row_span} rows high.`;
            return true;
        }

        editButton.addEventListener('click', () => setEditing(true));
        document.getElementById('cancelDashboardLayout').addEventListener('click', () => {
            if (gesture) finishGesture(false);
            entries = saved.map(item => ({...item}));
            contentWidth = config.contentWidth;
            entries.forEach(item => paint(item));
            errorBox.hidden = true;
            select(null);
            setEditing(false);
        });
        widthSelect.addEventListener('change', () => {
            contentWidth = widthSelect.value;
            sizeCanvas();
            markDirty();
        });
        inspector.addEventListener('submit', event => event.preventDefault());
        inspector.addEventListener('change', event => {
            if (pending) return;
            const field = event.target.name;
            const origin = entries.find(item => item.id === selectedId);
            if (!origin) return;
            const item = {...origin};
            if (field === 'variant_key') {
                item.variant_key = event.target.value;
                const changed = variant(item);
                if (!changed.widths.includes(item.column_span)) {
                    item.column_span = nearest(item.column_span, changed.widths);
                }
                item.row_span = Math.max(item.row_span, changed.min_height);
                item.layout_column = Math.min(item.layout_column, 12 - item.column_span);
            } else {
                item[field] = Number(event.target.value)
                    - (['layout_column', 'layout_row'].includes(field) ? 1 : 0);
            }
            apply(item);
        });
        tiles.forEach((tile, id) => {
            tile.querySelector('[data-edit-widget]').addEventListener('click', () => {
                setEditing(true);
                select(id);
                tile.querySelector('[data-drag-handle]').focus();
            });
            tile.addEventListener('click', () => { if (editing) select(id); });
        });

        function pointerCandidate() {
            const rect = canvas.getBoundingClientRect();
            const dx = gesture.x - gesture.startX + gesture.rect.left - rect.left;
            const dy = gesture.y - gesture.startY + gesture.rect.top - rect.top;
            const stepX = (config.widths[contentWidth] - config.grid.padding * 2
                + config.grid.gap) / 12;
            const type = variant(gesture.origin);
            return pointerGeometry(gesture.origin, gesture.mode, dx, dy, stepX,
                config.grid.rowHeight + config.grid.gap, type.widths, type.min_height,
                config.grid.maxRows);
        }
        function updateGesture() {
            if (!gesture) return;
            gesture.candidate = pointerCandidate();
            paint(gesture.candidate, !canPlace(gesture.candidate, entries, config.grid.maxRows));
            sizeCanvas(gesture.candidate);
        }
        function autoScroll() {
            if (!gesture) return;
            const rect = reading.getBoundingClientRect();
            if (gesture.x < rect.left + 40) reading.scrollLeft -= 12;
            if (gesture.x > rect.right - 40) reading.scrollLeft += 12;
            if (gesture.y < rect.top + 40) reading.scrollTop -= 12;
            if (gesture.y > rect.bottom - 40) reading.scrollTop += 12;
            updateGesture();
            frame = global.requestAnimationFrame(autoScroll);
        }
        function finishGesture(commit) {
            if (!gesture) return;
            const current = gesture;
            gesture = null;
            global.cancelAnimationFrame(frame);
            if (!commit || !apply(current.candidate)) paint(current.origin);
            sizeCanvas();
            if (current.handle.hasPointerCapture(current.pointerId)) {
                current.handle.releasePointerCapture(current.pointerId);
            }
        }
        canvas.addEventListener('pointerdown', event => {
            const handle = event.target.closest('[data-drag-handle], [data-resize-handle]');
            if (!editing || pending || !handle || event.button !== 0) return;
            event.preventDefault();
            const id = Number(handle.closest('[data-widget-id]').dataset.widgetId);
            select(id);
            handle.focus();
            const origin = {...entries.find(item => item.id === id)};
            gesture = {
                origin, candidate: origin, handle, pointerId: event.pointerId,
                mode: handle.hasAttribute('data-drag-handle') ? 'move' : 'resize',
                startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
                rect: canvas.getBoundingClientRect(),
            };
            handle.setPointerCapture(event.pointerId);
            frame = global.requestAnimationFrame(autoScroll);
        });
        canvas.addEventListener('pointermove', event => {
            if (!gesture || event.pointerId !== gesture.pointerId) return;
            gesture.x = event.clientX;
            gesture.y = event.clientY;
            updateGesture();
        });
        canvas.addEventListener('pointerup', () => finishGesture(true));
        canvas.addEventListener('pointercancel', () => finishGesture(false));
        canvas.addEventListener('lostpointercapture', () => finishGesture(false));
        canvas.addEventListener('keydown', event => {
            if (event.key === 'Escape' && gesture) {
                event.preventDefault();
                event.stopPropagation();
                finishGesture(false);
                return;
            }
            const handle = event.target.closest('[data-drag-handle], [data-resize-handle]');
            if (!editing || pending || !handle || !event.key.startsWith('Arrow')) return;
            event.preventDefault();
            event.stopPropagation();
            const id = Number(handle.closest('[data-widget-id]').dataset.widgetId);
            select(id);
            const origin = entries.find(item => item.id === id);
            const type = variant(origin);
            apply(keyboardGeometry(origin,
                handle.hasAttribute('data-drag-handle') ? 'move' : 'resize',
                event.key, type.widths, type.min_height, config.grid.maxRows));
        });
        global.addEventListener('beforeunload', event => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
        saveButton.addEventListener('click', async () => {
            if (pending || !dirty || gesture) return;
            pending = true;
            let committed = false;
            editor.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
            try {
                await global.SBDashboards.request(
                    `/api/reports/dashboards/${root.dataset.dashboardId}/layout`,
                    {revision: config.revision, content_width: contentWidth, widgets: entries},
                );
                committed = true;
                dirty = false;
                global.location.reload();
            } catch (error) {
                showError('Could not save your layout. Your draft is still here. ' + error.message, error);
            } finally {
                pending = false;
                editor.querySelectorAll('button, input, select').forEach(control => { control.disabled = false; });
                updateInspector();
                if (!committed) markDirty();
            }
        });
        document.getElementById('removeSelectedWidget').addEventListener('click', async () => {
            if (pending || selectedId === null) return;
            if (!global.confirm(dirty
                ? 'Discard unsaved layout changes and remove this widget? Other saved widgets will not move.'
                : 'Remove this widget? Other widgets will stay in place.')) return;
            pending = true;
            editor.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
            try {
                await global.SBDashboards.request(
                    `/api/reports/dashboards/${root.dataset.dashboardId}/widgets/${selectedId}/remove`, {});
                dirty = false;
                global.location.reload();
            } catch (error) {
                showError('Could not remove the widget. ' + error.message, error);
            } finally {
                pending = false;
                editor.querySelectorAll('button, input, select').forEach(control => { control.disabled = false; });
                updateInspector();
            }
        });
        sizeCanvas();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window === 'undefined' ? globalThis : window);
