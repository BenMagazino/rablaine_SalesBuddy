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

    function resolveMove(item, entries, maxRows = 1000) {
        const origin = entries.find(entry => entry.id === item.id);
        if (!origin || item.column_span !== origin.column_span
            || item.row_span !== origin.row_span || !canPlace(item, [], maxRows)) return null;
        const collisions = entries.filter(entry => entry.id !== item.id && overlaps(item, entry));
        const replace = changes => entries.map(entry => ({...entry,
            ...changes.find(change => change.id === entry.id)}));
        if (!collisions.length) return {kind: 'move', entries: replace([item])};
        if (collisions.length === 1) {
            const target = collisions[0];
            const swapped = replace([
                {...item, layout_column: target.layout_column, layout_row: target.layout_row},
                {...target, layout_column: origin.layout_column, layout_row: origin.layout_row},
            ]);
            if (swapped.every(entry => canPlace(entry, swapped, maxRows))) {
                return {kind: 'swap', entries: swapped};
            }
        }
        const pushed = replace([item]);
        const queue = [pushed.find(entry => entry.id === item.id)];
        for (let index = 0; index < queue.length; index++) {
            const blocker = queue[index];
            for (const other of pushed) {
                if (other.id === item.id || other.id === blocker.id || !overlaps(blocker, other)) {
                    continue;
                }
                other.layout_row = blocker.layout_row + blocker.row_span;
                if (other.layout_row + other.row_span > maxRows) return null;
                queue.push(other);
            }
        }
        return pushed.every(entry => canPlace(entry, pushed, maxRows))
            ? {kind: 'push', entries: pushed} : null;
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
        module.exports = {overlaps, canPlace, resolveMove, pointerGeometry, keyboardGeometry};
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
        const inspectorFields = document.getElementById('widgetInspectorFields');
        const inspectorEmpty = document.getElementById('widgetInspectorEmpty');
        const status = document.getElementById('layoutState');
        const errorBox = document.getElementById('dashboardError');
        const widthSelect = document.getElementById('canvasWidth');
        const styleSelect = document.getElementById('dashboardDisplayStyle');
        const saveButton = document.getElementById('saveDashboardLayout');
        const previewButton = document.getElementById('previewDashboardDraft');
        const exitPreviewButton = document.getElementById('exitDashboardDraftPreview');
        const undoButton = document.getElementById('undoDashboardEdit');
        const redoButton = document.getElementById('redoDashboardEdit');
        const actionSelector = '[data-sb-dialog="widgetLibrary"], [data-db-delete]';
        const outsideControls = [
            ...root.querySelectorAll(actionSelector), ...editor.querySelectorAll(actionSelector),
        ];
        const detailControls = root.querySelectorAll('[data-dashboard-field]');
        const [nameInput, subtitleInput] = detailControls;
        const detailsState = document.getElementById('dashboardDetailsState');
        const drafts = global.SBDashboardDrafts;
        const filtering = global.SBDashboardFilters;
        const tiles = new Map(Array.from(canvas.querySelectorAll('[data-widget-id]'),
            tile => [Number(tile.dataset.widgetId), tile]));
        const saved = Array.from(tiles, ([id, tile]) => ({
            id, key: tile.dataset.widgetKey, variant_key: tile.dataset.variant,
            layout_column: Number(tile.dataset.column), layout_row: Number(tile.dataset.row),
            column_span: Number(tile.dataset.columnSpan), row_span: Number(tile.dataset.rowSpan),
            ...(filtering ? {filters: filtering.selections(
                JSON.parse(tile.dataset.widgetFilters || '{}'))} : {}),
        }));
        let entries = saved.map(item => ({...item}));
        let contentWidth = config.contentWidth;
        let displayStyle = config.displayStyle;
        let filterConfig = filtering?.configuration(config.filterConfig);
        let dirty = false;
        let pending = false;
        let selectedId = null;
        let gesture = null;
        let frame = null;
        let lastDraft = null;
        let draftRevision = config.revision;
        let baseName = config.name;
        let baseSubtitle = config.subtitle;
        let storageHealthy = true;
        let blocked = false;
        let published = false;
        let initializing = true;
        let previewing = false;
        let historyState = null;
        let historyGroup = null;
        const undoStack = [];
        const redoStack = [];
        const contentRequests = new Map();

        function editableState() {
            return {
                name: nameInput.value, subtitle: subtitleInput.value,
                content_width: contentWidth, display_style: displayStyle,
                ...(filtering ? {filter_config: filterConfig} : {}),
                widgets: entries.map(item => ({
                    id: item.id, key: item.key, variant_key: item.variant_key,
                    layout_column: item.layout_column, layout_row: item.layout_row,
                    column_span: item.column_span, row_span: item.row_span,
                    ...(filtering ? {filters: filtering.selections(item.filters)} : {}),
                })),
            };
        }
        const originalState = {
            name: config.name, subtitle: config.subtitle,
            content_width: config.contentWidth, display_style: config.displayStyle,
            ...(filtering ? {filter_config: filterConfig} : {}),
            widgets: saved,
        };

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
        function updateHistoryButtons() {
            const unavailable = previewing || pending || blocked || published;
            undoButton.disabled = unavailable || !undoStack.length;
            redoButton.disabled = unavailable || !redoStack.length;
        }
        function markDirty(group = null) {
            filtering?.configure(entries.map(item => ({
                supported: definition(item)?.supported_filters || [],
            })), previewing || pending || published || blocked);
            const state = editableState();
            if (historyState && !initializing && !blocked && !published
                && JSON.stringify(state) !== JSON.stringify(historyState)) {
                if (!group || group !== historyGroup) {
                    undoStack.push({state: historyState, selectedId});
                } else if (undoStack.length
                    && JSON.stringify(undoStack.at(-1).state) === JSON.stringify(state)) {
                    undoStack.pop();
                    group = null;
                }
                redoStack.length = 0;
                historyGroup = group;
            }
            historyState = state;
            const title = nameInput.value.trim() || 'Untitled dashboard';
            document.title = (previewing ? 'Preview ' : 'Edit ') + title + ' - Sales Buddy';
            document.getElementById('dashboardTitle').setAttribute('aria-label', title);
            const crumb = document.querySelector(
                '.sb-context-bar [aria-current="page"] > span:last-child');
            if (crumb?.setAttribute) {
                crumb.textContent = 'Edit ' + title;
                crumb.setAttribute('title', 'Edit ' + title);
            }
            dirty = !published && JSON.stringify(editableState()) !== JSON.stringify(originalState);
            if (!initializing && !blocked && !published) {
                try {
                    if (dirty) {
                        lastDraft = drafts.write(root.dataset.dashboardId, {
                            version: 1, revision: draftRevision,
                            base_name: baseName, base_subtitle: baseSubtitle,
                            ...editableState(),
                        }, lastDraft);
                    } else if (lastDraft) {
                        drafts.remove(root.dataset.dashboardId, lastDraft);
                        lastDraft = null;
                    }
                    storageHealthy = true;
                } catch (error) {
                    storageHealthy = false;
                    if (error.name === 'DashboardDraftConflict') blocked = true;
                    showError('Could not store your draft in this browser. Keep this page open '
                        + 'or choose Save to publish it. ' + error.message, error);
                }
            }
            saveButton.disabled = !dirty || pending || blocked || published;
            previewButton.disabled = pending || published;
            outsideControls.forEach(control => {
                control.disabled = pending || published || blocked;
                control.title = '';
            });
            detailControls.forEach(control => {
                control.disabled = previewing || pending || published || blocked;
            });
            widthSelect.disabled = styleSelect.disabled = pending || published || blocked;
            document.getElementById('cancelDashboardLayout').disabled =
                pending || published || (!dirty && !blocked);
            detailsState.textContent = published ? 'Saved' : blocked ? 'Draft needs attention'
                : dirty ? (storageHealthy ? 'Draft saved locally' : 'Draft not backed up') : '';
            status.textContent = (previewing ? 'Draft preview. Nothing has been published. ' : '')
                + (published ? 'Dashboard saved'
                : pending ? 'Saving dashboard...'
                : blocked ? 'Local draft kept. Discard it to return to the saved dashboard.'
                : dirty ? (storageHealthy ? 'Draft saved in this browser. Choose Save to publish.'
                    : 'Draft is only in memory. Keep this page open or choose Save.')
                : 'Editing dashboard');
            updateHistoryButtons();
        }
        function restoreHistory(source, destination) {
            if (previewing || pending || blocked || published || gesture || !source.length) return;
            destination.push({state: editableState(), selectedId});
            const previous = source.pop();
            const state = previous.state;
            nameInput.value = state.name;
            subtitleInput.value = state.subtitle;
            contentWidth = state.content_width;
            displayStyle = state.display_style;
            filterConfig = filtering?.configuration(state.filter_config);
            filtering?.restore(filterConfig);
            entries = state.widgets.map(item => ({...item}));
            widthSelect.value = contentWidth;
            styleSelect.value = displayStyle;
            errorBox.hidden = true;
            renderEntries();
            select(entries.some(item => item.id === previous.selectedId)
                ? previous.selectedId : null);
            historyState = editableState();
            historyGroup = null;
            markDirty();
            status.textContent += source === undoStack ? ' Edit undone.' : ' Edit redone.';
            (selectedId === null ? reading : tiles.get(selectedId)).focus({preventScroll: true});
        }
        undoButton.addEventListener('click', () => restoreHistory(undoStack, redoStack));
        redoButton.addEventListener('click', () => restoreHistory(redoStack, undoStack));
        function setTileMode(tile) {
            tile.tabIndex = previewing ? -1 : 0;
            const body = tile.querySelector('.db-widget-body');
            body.inert = !previewing && !body.hasAttribute('data-widget-requirements');
        }
        function setPreview(value) {
            if (pending || published) return;
            if (gesture) finishGesture(false);
            select(null);
            previewing = value;
            filtering?.setPreview?.(value);
            filtering?.configure(entries.map(item => ({
                supported: definition(item)?.supported_filters || [],
            })), previewing || pending || published || blocked);
            updateHistoryButtons();
            detailControls.forEach(control => {
                control.disabled = previewing || pending || published || blocked;
            });
            root.classList.toggle('is-editing', !previewing);
            document.getElementById('dashboardEditorCommands').hidden = previewing;
            document.getElementById('dashboardDraftPreviewBar').hidden = !previewing;
            inspector.hidden = previewing;
            nameInput.hidden = previewing;
            document.getElementById('dashboardSubtitleEditor').hidden = previewing;
            const title = nameInput.value.trim() || 'Untitled dashboard';
            const previewName = document.getElementById('dashboardPreviewName');
            previewName.textContent = title;
            previewName.hidden = !previewing;
            const previewSubtitle = document.getElementById('dashboardPreviewSubtitle');
            previewSubtitle.textContent = subtitleInput.value.trim();
            previewSubtitle.hidden = !previewing || !previewSubtitle.textContent;
            document.getElementById('dashboardEmptyEditor').hidden = previewing;
            document.getElementById('dashboardEmptyPreview').hidden = !previewing;
            tiles.forEach(setTileMode);
            sizeCanvas();
            document.title = (previewing ? 'Preview ' : 'Edit ') + title + ' - Sales Buddy';
            status.textContent = previewing ? 'Draft preview. Nothing has been published.'
                : detailsState.textContent || 'Editing dashboard';
            (previewing ? exitPreviewButton : previewButton).focus();
        }
        previewButton.addEventListener('click', () => setPreview(true));
        exitPreviewButton.addEventListener('click', () => setPreview(false));
        function sizeCanvas(extra, layout = entries) {
            const items = extra ? layout.map(item => item.id === extra.id ? extra : item) : layout;
            const bottom = Math.max(items.length ? 0 : 4,
                ...items.map(item => item.layout_row + item.row_span));
            canvas.style.setProperty('--db-rows', Math.min(config.grid.maxRows,
                previewing ? bottom : Math.max(4, bottom) + 6));
            root.style.setProperty('--db-canvas-width', config.widths[contentWidth] + 'px');
            root.classList.toggle('sb-directory-frame-wide', contentWidth === 'wide');
            root.dataset.displayStyle = displayStyle;
            global.SBDashboardDividers.render(canvas, items);
            const preview = document.getElementById('widgetPreview');
            if (preview) preview.dataset.displayStyle = displayStyle;
            const summary = document.getElementById('dashboardSummary');
            if (summary) {
                const count = entries.length;
                summary.textContent = `${count} ${count === 1 ? 'widget' : 'widgets'}`
                    + ` \u00b7 Fixed canvas \u00b7 ${config.widths[contentWidth]}px`
                    + ' \u00b7 Current synced data';
            }
        }
        function paint(item, invalid = false) {
            const tile = tiles.get(item.id);
            tile.style.gridColumn = `${item.layout_column + 1} / span ${item.column_span}`;
            tile.style.gridRow = `${item.layout_row + 1} / span ${item.row_span}`;
            tile.dataset.columnSpan = item.column_span;
            tile.dataset.rowSpan = item.row_span;
            tile.classList.toggle('is-invalid', invalid);
        }
        function bindTile(tile, id) {
            tile.addEventListener('click', () => select(id));
            tile.addEventListener('focusin', () => select(id));
        }
        function ensureTile(item) {
            if (tiles.has(item.id)) return tiles.get(item.id);
            const tile = document.createElement('article');
            const title = definition(item)?.title || 'Unavailable widget';
            tile.className = 'db-widget';
            tile.id = 'widget-' + item.id;
            tile.tabIndex = 0;
            tile.dataset.widgetId = item.id;
            tile.dataset.widgetKey = item.key;
            tile.setAttribute('data-drag-handle', '');
            tile.setAttribute('aria-label', title);
            tile.setAttribute('aria-describedby', 'dashboardLayoutHelp');
            const body = document.createElement('div');
            body.className = 'db-widget-body';
            body.inert = true;
            body.textContent = 'Loading current report data...';
            const resize = document.createElement('button');
            resize.className = 'db-handle db-resize-handle';
            resize.type = 'button';
            resize.setAttribute('data-resize-handle', '');
            resize.setAttribute('aria-label', 'Resize ' + title);
            resize.innerHTML = '<i class="bi bi-arrows-angle-expand" aria-hidden="true"></i>';
            tile.append(body, resize);
            tiles.set(item.id, tile);
            bindTile(tile, item.id);
            canvas.append(tile);
            return tile;
        }
        async function loadContent(item, reportError = true) {
            const tile = ensureTile(item);
            const context = filtering?.context(item.filters);
            const signature = item.variant_key + ':' + item.column_span
                + (context ? ':' + JSON.stringify(context) : '');
            if (tile.dataset.loadedPresentation === signature) {
                contentRequests.delete(item.id);
                return;
            }
            const request = {};
            contentRequests.set(item.id, request);
            try {
                const query = new URLSearchParams({
                    key: item.key, variant: item.variant_key,
                    width: String(item.column_span), instance_id: String(item.id),
                });
                if (context) query.set('filter_context', JSON.stringify(context));
                const response = await global.fetch('/api/reports/dashboards/widget-preview?' + query);
                const data = await response.json();
                if (!response.ok || data.success !== true || typeof data.html !== 'string') {
                    throw new Error(data.error || 'The server did not return widget content.');
                }
                if (contentRequests.get(item.id) !== request) return;
                global.SBConnectGoals.destroy(tile);
                tile.querySelector('.db-widget-body').remove();
                tile.insertAdjacentHTML('afterbegin', data.html);
                setTileMode(tile);
                tile.dataset.loadedPresentation = signature;
                tile.dataset.variant = item.variant_key;
                global.SBConnectGoals.init(tile);
                global.SBPToF?.mountStatuses(tile);
                global.SBTableSort?.mount(tile);
            } catch (error) {
                if (contentRequests.get(item.id) !== request) return;
                if (reportError) {
                    showError('Could not load current widget content. Your draft is kept; '
                        + 'reload to retry. ' + error.message, error);
                }
                throw error;
            }
        }
        function renderEntries() {
            const ids = new Set(entries.map(item => item.id));
            tiles.forEach((tile, id) => {
                tile.hidden = !ids.has(id);
                if (tile.hidden) contentRequests.delete(id);
            });
            entries.forEach(item => {
                const tile = ensureTile(item);
                tile.hidden = false;
                paint(item);
                loadContent(item).catch(() => {
                    // loadContent already surfaces the error and keeps the local draft.
                });
            });
            const empty = canvas.querySelector('.db-empty');
            if (empty) empty.hidden = Boolean(entries.length);
            sizeCanvas();
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
            filtering?.select(item, definition(item || {})?.supported_filters || [],
                previewing || pending || published || blocked);
            inspectorFields.querySelectorAll('input, select, button').forEach(
                control => { control.disabled = !item || pending || published || blocked; });
            inspectorFields.hidden = !item;
            inspectorEmpty.hidden = Boolean(item);
            const title = document.getElementById('selectedWidgetTitle');
            title.textContent = item
                ? tiles.get(item.id).getAttribute('aria-label') : 'No widget selected';
            title.title = item ? title.textContent : '';
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
            if (previewing && id !== null) return;
            selectedId = id;
            tiles.forEach((tile, tileId) => tile.classList.toggle('is-selected', tileId === id));
            updateInspector();
        }
        function deselectFromKeyboard() {
            select(null);
            reading.classList.toggle('is-quiet-focus', true);
            reading.focus({preventScroll: true});
            status.textContent = 'Widget deselected.';
        }
        reading.addEventListener('blur', () => {
            reading.classList.toggle('is-quiet-focus', false);
        });
        function apply(item, moving = false) {
            const plan = moving ? resolveMove(item, entries, config.grid.maxRows)
                : canPlace(item, entries, config.grid.maxRows)
                    ? {kind: 'resize', entries: entries.map(entry => entry.id === item.id ? item : entry)}
                    : null;
            if (!plan) {
                showError(moving
                    ? 'There is not enough room for that move. No widgets were changed.'
                    : 'That size or position is occupied or outside the grid. No widgets were changed.');
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
            entries = plan.entries;
            item = entries.find(entry => entry.id === item.id);
            errorBox.hidden = true;
            entries.forEach(entry => paint(entry));
            sizeCanvas();
            updateInspector();
            markDirty();
            loadContent(item).catch(() => {
                // Layout edits remain usable if live report data is temporarily unavailable.
            });
            status.textContent += ` Row ${item.layout_row + 1}, column ${item.layout_column + 1}, ${WIDTH_LABELS[item.column_span]} width, ${item.row_span} rows high.`;
            if (plan.kind === 'swap') status.textContent += ' Widgets swapped.';
            if (plan.kind === 'push') status.textContent += ' Neighbors shifted down.';
            return true;
        }

        document.getElementById('cancelDashboardLayout').addEventListener('click', () => {
            if ((dirty || blocked) && !global.confirm(
                'Discard this local draft and return to the saved dashboard?')) return;
            if (gesture) finishGesture(false);
            try {
                drafts.remove(root.dataset.dashboardId);
            } catch (error) {
                showError('Could not discard the local draft. ' + error.message, error);
                return;
            }
            lastDraft = null;
            blocked = false;
            storageHealthy = true;
            draftRevision = config.revision;
            baseName = config.name;
            baseSubtitle = config.subtitle;
            entries = saved.map(item => ({...item}));
            contentWidth = config.contentWidth;
            displayStyle = config.displayStyle;
            filterConfig = filtering?.configuration(config.filterConfig);
            filtering?.restore(filterConfig);
            nameInput.value = config.name;
            subtitleInput.value = config.subtitle;
            renderEntries();
            errorBox.hidden = true;
            select(null);
            widthSelect.value = contentWidth;
            styleSelect.value = displayStyle;
            sizeCanvas();
            undoStack.length = redoStack.length = 0;
            historyState = editableState();
            historyGroup = null;
            markDirty();
        });
        widthSelect.addEventListener('change', () => {
            contentWidth = widthSelect.value;
            sizeCanvas();
            markDirty();
        });
        styleSelect.addEventListener('change', () => {
            displayStyle = styleSelect.value;
            sizeCanvas();
            markDirty();
        });
        inspector.addEventListener('submit', event => event.preventDefault());
        function updateWidgetField(event) {
            if (previewing || pending || published || blocked) return;
            const field = event.target.name;
            if (!['variant_key', 'layout_column', 'layout_row', 'column_span', 'row_span']
                .includes(field)) return;
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
            apply(item, ['layout_column', 'layout_row'].includes(field));
        }
        inspector.addEventListener('change', updateWidgetField);
        inspector.addEventListener('input', event => {
            if (event.target.tagName === 'INPUT' && event.target.value !== ''
                && event.target.checkValidity()) updateWidgetField(event);
        });
        tiles.forEach((tile, id) => {
            bindTile(tile, id);
            const item = saved.find(entry => entry.id === id);
            const context = filtering?.context(item.filters);
            tile.dataset.loadedPresentation = tile.dataset.variant + ':' + tile.dataset.columnSpan
                + (context ? ':' + JSON.stringify(context) : '');
        });
        canvas.addEventListener('click', event => {
            if (!event.target.closest('[data-widget-id]')) select(null);
        });
        const workspace = root.parentElement;
        workspace.addEventListener('click', event => {
            if (event.target === workspace) select(null);
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
                gesture.mode === 'move' ? gesture.moveMaxRows : config.grid.maxRows);
        }
        function updateGesture() {
            if (!gesture) return;
            gesture.candidate = pointerCandidate();
            gesture.plan = gesture.mode === 'move'
                ? resolveMove(gesture.candidate, entries, config.grid.maxRows) : null;
            const preview = gesture.plan?.entries || entries;
            preview.forEach(item => {
                paint(item);
                const origin = entries.find(entry => entry.id === item.id);
                tiles.get(item.id).classList.toggle('is-displaced', item.id !== gesture.origin.id
                    && (item.layout_column !== origin.layout_column
                        || item.layout_row !== origin.layout_row));
            });
            if (!gesture.plan) {
                paint(gesture.candidate, !canPlace(
                    gesture.candidate, entries, config.grid.maxRows));
            }
            sizeCanvas(gesture.plan ? null : gesture.candidate, preview);
            if (gesture.mode === 'move') {
                status.textContent = gesture.plan?.kind === 'swap' ? 'Release to swap widgets.'
                    : gesture.plan?.kind === 'push' ? 'Release to place here and shift neighbors down.'
                        : gesture.plan ? 'Release to move here.'
                            : 'Not enough room here. Release to keep the original layout.';
            }
        }
        function autoScroll() {
            if (!gesture) return;
            const rect = reading.getBoundingClientRect();
            if (gesture.x < rect.left + 40) reading.scrollLeft -= 12;
            if (gesture.x > rect.right - 40) reading.scrollLeft += 12;
            if (gesture.y < rect.top + 40) reading.scrollTop -= 12;
            if (gesture.y > rect.bottom - 40) {
                if (gesture.mode === 'move') {
                    const canvasTop = canvas.getBoundingClientRect().top - rect.top
                        + reading.scrollTop;
                    const bottom = canvasTop + gesture.moveMaxRows
                        * (config.grid.rowHeight + config.grid.gap)
                        + config.grid.padding * 2 - config.grid.gap;
                    reading.scrollTop = Math.min(reading.scrollTop + 12,
                        Math.max(0, bottom - reading.clientHeight));
                } else reading.scrollTop += 12;
            }
            updateGesture();
            frame = global.requestAnimationFrame(autoScroll);
        }
        function finishGesture(commit) {
            if (!gesture) return;
            const current = gesture;
            gesture = null;
            global.cancelAnimationFrame(frame);
            current.tile.classList.toggle('is-dragging', false);
            if (current.started) {
                if (commit) apply(current.candidate, current.mode === 'move');
                else status.textContent = current.statusBefore;
            }
            entries.forEach(item => {
                paint(item);
                tiles.get(item.id).classList.toggle('is-displaced', false);
            });
            sizeCanvas();
            if (current.handle.hasPointerCapture(current.pointerId)) {
                current.handle.releasePointerCapture(current.pointerId);
            }
        }
        canvas.addEventListener('pointerdown', event => {
            if (event.target.closest('[data-widget-requirement]')) return;
            const handle = event.target.closest('[data-drag-handle], [data-resize-handle]');
            if (previewing || pending || published || blocked || !handle || event.button !== 0) return;
            event.preventDefault();
            const id = Number(handle.closest('[data-widget-id]').dataset.widgetId);
            select(id);
            handle.focus();
            const origin = {...entries.find(item => item.id === id)};
            // Keep scrolling from extending the destination that scrolling itself creates.
            gesture = {
                origin, candidate: origin, handle, tile: tiles.get(id),
                pointerId: event.pointerId, started: false,
                mode: handle.hasAttribute('data-drag-handle') ? 'move' : 'resize',
                moveMaxRows: Math.min(config.grid.maxRows, origin.row_span
                    + Math.max(...entries.map(item => item.layout_row + item.row_span))),
                statusBefore: status.textContent,
                startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
                rect: canvas.getBoundingClientRect(),
            };
            handle.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointermove', event => {
            if (!gesture || event.pointerId !== gesture.pointerId) return;
            gesture.x = event.clientX;
            gesture.y = event.clientY;
            if (!gesture.started) {
                if (Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) < 4) return;
                gesture.started = true;
                gesture.tile.classList.toggle('is-dragging', gesture.mode === 'move');
                frame = global.requestAnimationFrame(autoScroll);
            }
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
                deselectFromKeyboard();
                return;
            }
            if (event.target.closest('[data-widget-requirement]')) return;
            const handle = event.target.closest('[data-drag-handle], [data-resize-handle]');
            if (previewing || pending || published || blocked
                || !handle || !event.key.startsWith('Arrow')) return;
            event.preventDefault();
            event.stopPropagation();
            const id = Number(handle.closest('[data-widget-id]').dataset.widgetId);
            select(id);
            const origin = entries.find(item => item.id === id);
            const type = variant(origin);
            const moving = handle.hasAttribute('data-drag-handle');
            apply(keyboardGeometry(origin, moving ? 'move' : 'resize',
                event.key, type.widths, type.min_height, config.grid.maxRows), moving);
        });
        global.addEventListener('beforeunload', event => {
            if (!dirty || storageHealthy) return;
            event.preventDefault();
            event.returnValue = '';
        });
        saveButton.addEventListener('click', async () => {
            if (previewing || pending || published || blocked || !dirty || gesture) return;
            if (!nameInput.value.trim() || nameInput.value.trim().length > 200
                || subtitleInput.value.trim().length > 500) {
                showError('Enter a dashboard name of 1 to 200 characters and a subtitle '
                    + 'of at most 500 characters. Your draft is kept locally.');
                return;
            }
            pending = true;
            markDirty();
            editor.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
            try {
                await global.SBDashboards.request(
                    `/api/reports/dashboards/${root.dataset.dashboardId}/save`,
                    {
                        revision: draftRevision, base_name: baseName, base_subtitle: baseSubtitle,
                        ...editableState(),
                    },
                );
                published = true;
                dirty = false;
                try {
                    drafts.remove(root.dataset.dashboardId, lastDraft);
                } catch (error) {
                    showError('Dashboard saved, but its local draft could not be cleared. '
                        + 'Open View dashboard to see the saved version. ' + error.message, error);
                    return;
                }
                global.location.reload();
            } catch (error) {
                showError('Could not save your dashboard. Your draft is still here. '
                    + error.message, error);
            } finally {
                pending = false;
                editor.querySelectorAll('button, input, select').forEach(control => { control.disabled = false; });
                updateInspector();
                markDirty();
            }
        });
        function removeSelectedWidget() {
            if (previewing || pending || published || blocked || selectedId === null) return;
            entries = entries.filter(item => item.id !== selectedId);
            renderEntries();
            markDirty();
            select(null);
            reading.focus({preventScroll: true});
        }
        document.getElementById('removeSelectedWidget')
            .addEventListener('click', removeSelectedWidget);
        document.addEventListener('keydown', event => {
            if (event.defaultPrevented || event.isComposing || event.altKey
                || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
            const target = event.target;
            if (target.closest?.('#dashboardFiltersPanel, #openDashboardFilters, #openWidgetFilters')) {
                return;
            }
            const tag = target.tagName?.toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag) || target.isContentEditable) return;
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
                event.preventDefault();
                const redo = key === 'y' || event.shiftKey;
                restoreHistory(redo ? redoStack : undoStack, redo ? undoStack : redoStack);
            } else if (previewing || pending || blocked || published) {
                return;
            } else if (!event.ctrlKey && !event.metaKey && !event.shiftKey
                && (event.key === 'Delete' || event.key === 'Backspace') && selectedId !== null) {
                event.preventDefault();
                if (gesture) finishGesture(false);
                removeSelectedWidget();
            } else if (event.key === 'Escape' && selectedId !== null) {
                event.preventDefault();
                if (gesture) finishGesture(false);
                deselectFromKeyboard();
            }
        });
        detailControls.forEach(input => {
            let focusValue = input.value;
            input.addEventListener('focus', () => {
                focusValue = input.value;
                historyGroup = null;
            });
            input.addEventListener('input', () => {
                markDirty(input);
            });
            input.addEventListener('blur', () => {
                input.value = input.value.trim();
                markDirty(input);
                historyGroup = null;
            });
            input.addEventListener('keydown', event => {
                if (event.isComposing) return;
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    input.value = focusValue;
                    input.blur();
                }
            });
        });
        global.SBDashboardEditor = Object.freeze({
            getSettings: () => ({contentWidth, displayStyle}),
            setFilterConfig(value) {
                if (previewing || pending || published || blocked) return;
                filterConfig = filtering.configuration(value);
                filtering.restore(filterConfig);
                markDirty();
            },
            setWidgetFilters(id, value) {
                if (previewing || pending || published || blocked) return;
                entries = entries.map(item => item.id === id
                    ? {...item, filters: filtering.selections(value)} : item);
                markDirty();
                updateInspector();
            },
            async refreshFilters() {
                const results = await Promise.allSettled(entries.map(item => loadContent(item, false)));
                if (results.some(result => result.status === 'rejected')) {
                    throw new Error('One or more widgets could not load the selected scope.');
                }
            },
            async refreshRequirement(key) {
                tiles.forEach((tile, id) => {
                    const spec = config.catalog.find(item => item.key === tile.dataset.widgetKey);
                    if (spec?.requirements?.includes(key)) {
                        delete tile.dataset.loadedPresentation;
                        contentRequests.delete(id);
                    }
                });
                const results = await Promise.allSettled(entries
                    .filter(item => definition(item)?.requirements?.includes(key))
                    .map(item => loadContent(item, false)));
                if (results.some(result => result.status === 'rejected')) {
                    throw new Error('Some widgets could not refresh. Retry to load the saved scope.');
                }
            },
            async addWidget(spec) {
                if (previewing || pending || published || blocked) {
                    throw new Error('The draft is not editable.');
                }
                const item = {
                    id: Math.min(0, ...tiles.keys()) - 1, key: spec.key,
                    variant_key: spec.variant_key, column_span: spec.column_span,
                    row_span: spec.row_span, layout_column: 0,
                    ...(filtering ? {filters: filtering.selections(spec.filters)} : {}),
                    layout_row: Math.max(0, ...entries.map(entry => entry.layout_row + entry.row_span)),
                };
                const type = variant(item);
                if (!definition(item) || type.key !== item.variant_key
                    || !type.widths.includes(item.column_span)
                    || item.row_span < type.min_height
                    || !canPlace(item, entries, config.grid.maxRows)) {
                    throw new Error('This widget does not fit below the current draft.');
                }
                const tile = ensureTile(item);
                tile.hidden = true;
                await loadContent(item);
                entries.push(item);
                renderEntries();
                select(item.id);
                markDirty();
            },
        });
        try {
            lastDraft = drafts.read(root.dataset.dashboardId);
            if (lastDraft) {
                for (const item of lastDraft.widgets) {
                    const type = variant(item);
                    if (!canPlace(item, lastDraft.widgets, config.grid.maxRows)
                        || type.key !== item.variant_key
                        || !type.widths.includes(item.column_span)
                        || item.row_span < type.min_height || item.row_span > 20
                        || (!definition(item) && !tiles.has(item.id))) {
                        throw new Error('The local draft has an unavailable or invalid widget layout.');
                    }
                }
                entries = lastDraft.widgets.map(item => ({...item}));
                contentWidth = lastDraft.content_width;
                displayStyle = lastDraft.display_style;
                filterConfig = filtering?.configuration(lastDraft.filter_config ?? config.filterConfig);
                filtering?.restore(filterConfig);
                nameInput.value = lastDraft.name;
                subtitleInput.value = lastDraft.subtitle;
                draftRevision = lastDraft.revision;
                baseName = lastDraft.base_name;
                baseSubtitle = lastDraft.base_subtitle;
                if (draftRevision !== config.revision || baseName !== config.name
                    || baseSubtitle !== config.subtitle) {
                    blocked = true;
                    showError('The saved dashboard changed since this draft began. '
                        + 'Your draft is preserved for review. Discard it to start from the saved version.');
                }
                renderEntries();
            }
        } catch (error) {
            blocked = true;
            showError('Could not restore the local draft. It has not been deleted. '
                + 'Discard draft to return to the saved dashboard. ' + error.message, error);
        }
        global.addEventListener('storage', event => {
            if (event.key !== drafts.key(root.dataset.dashboardId) && event.key !== null) return;
            blocked = true;
            storageHealthy = false;
            showError('This draft changed in another window. Your current edits are still here; '
                + 'reload to resume the stored draft.');
            markDirty();
            updateInspector();
        });
        tiles.forEach(setTileMode);
        widthSelect.value = contentWidth;
        styleSelect.value = displayStyle;
        select(null);
        sizeCanvas();
        initializing = false;
        markDirty();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window === 'undefined' ? globalThis : window);
