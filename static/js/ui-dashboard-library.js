(function (global) {
    'use strict';

    function fitPreviewRows(height, variant, grid) {
        if (!Number.isFinite(height) || height <= 0) {
            throw new Error('The widget preview could not be measured.');
        }
        return Math.min(variant.default_height, Math.max(variant.min_height,
            Math.ceil((height + grid.gap) / (grid.rowHeight + grid.gap))));
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {fitPreviewRows};
    }
    if (!global.document) return;

    function init() {
        const dialog = document.getElementById('widgetLibrary');
        if (!dialog) return;
        const config = JSON.parse(document.getElementById('dashboardConfig').textContent);
        const search = document.getElementById('librarySearch');
        const report = document.getElementById('libraryReport');
        const widthFilter = document.getElementById('libraryWidthFilter');
        const variantFilter = document.getElementById('libraryVariantFilter');
        const results = document.getElementById('libraryResults');
        const variantSelect = document.getElementById('previewVariant');
        const widthSelect = document.getElementById('previewWidth');
        const preview = document.getElementById('widgetPreview');
        const addButton = document.getElementById('addLibraryWidget');
        const errorBox = document.getElementById('libraryError');
        const loading = document.getElementById('previewLoading');
        const labels = {3: 'Quarter', 4: 'Third', 6: 'Half', 12: 'Full'};
        let selected = null;
        let controller = null;
        let generation = 0;
        let pending = false;
        let previewRows = null;

        function eligibleVariants(definition) {
            return definition.variants.filter(variant =>
                (!variantFilter.value || variant.key === variantFilter.value)
                && (!widthFilter.value || variant.widths.includes(Number(widthFilter.value))));
        }
        function options(select, entries, preferred) {
            select.replaceChildren(...entries.map(([value, title]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = title;
                return option;
            }));
            select.value = entries.some(([value]) => String(value) === String(preferred))
                ? preferred : entries[0][0];
        }
        function clearPreview() {
            controller?.abort();
            generation++;
            global.SBConnectGoals.destroy(preview);
            preview.replaceChildren();
            previewRows = null;
            document.getElementById('previewDimensions').textContent = '';
            addButton.disabled = true;
        }
        function configureWidths(preferred) {
            const variant = selected.variants.find(item => item.key === variantSelect.value);
            const widths = variant.widths.filter(width =>
                !widthFilter.value || width === Number(widthFilter.value));
            options(widthSelect, widths.map(width => [width, labels[width]]), preferred);
        }
        async function loadPreview() {
            clearPreview();
            if (!selected) return;
            const requestGeneration = generation;
            controller = new AbortController();
            loading.hidden = false;
            errorBox.hidden = true;
            const variant = selected.variants.find(item => item.key === variantSelect.value);
            const span = Number(widthSelect.value);
            const settings = global.SBDashboardEditor.getSettings();
            preview.dataset.displayStyle = settings.displayStyle;
            const pixels = (config.widths[settings.contentWidth] - config.grid.padding * 2
                + config.grid.gap) / 12 * span - config.grid.gap;
            try {
                const query = new URLSearchParams({
                    key: selected.key, variant: variant.key, width: String(span),
                });
                if (global.SBDashboardFilters) {
                    query.set('filter_context', JSON.stringify(
                        global.SBDashboardFilters.context()));
                }
                const response = await global.fetch(
                    '/api/reports/dashboards/widget-preview?' + query, {signal: controller.signal});
                const data = await response.json();
                if (!response.ok || data.success !== true || typeof data.html !== 'string') {
                    throw new Error(data.error || 'The server did not return a widget preview.');
                }
                if (requestGeneration !== generation) return;
                const article = document.createElement('article');
                article.className = 'db-widget db-preview-widget';
                article.dataset.columnSpan = span;
                article.style.width = pixels + 'px';
                article.insertAdjacentHTML('beforeend', data.html);
                preview.append(article);
                global.SBConnectGoals.init(preview);
                global.SBPToF?.mountStatuses(preview);
                global.SBTableSort?.mount(preview);
                previewRows = fitPreviewRows(article.getBoundingClientRect().height,
                    variant, config.grid);
                const height = previewRows * (config.grid.rowHeight + config.grid.gap)
                    - config.grid.gap;
                article.style.height = height + 'px';
                preview.scrollTop = 0;
                document.getElementById('previewDimensions').textContent =
                    `${selected.scope} · ${labels[span]} width · ${Math.round(pixels)} × ${height}px · Content-fitted starting size`;
                addButton.disabled = false;
            } catch (error) {
                if (error.name === 'AbortError' || requestGeneration !== generation) return;
                console.error('Widget library preview:', error);
                errorBox.textContent = 'Could not load the widget preview. ' + error.message;
                errorBox.hidden = false;
            } finally {
                if (requestGeneration === generation) loading.hidden = true;
            }
        }
        function choose(definition) {
            selected = definition;
            results.querySelectorAll('button').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.key === definition.key));
            });
            document.getElementById('previewTitle').textContent = definition.title;
            const eligible = eligibleVariants(definition);
            options(variantSelect, eligible.map(item => [item.key, item.title]),
                variantFilter.value || variantSelect.value || 'metric');
            configureWidths(widthFilter.value || widthSelect.value || 6);
            loadPreview();
        }
        function filter() {
            const query = search.value.trim().toLowerCase();
            const definitions = config.catalog.filter(item =>
                (!report.value || report.value === item.report)
                && `${item.title} ${item.description} ${item.report}`.toLowerCase().includes(query)
                && eligibleVariants(item).length);
            results.replaceChildren(...definitions.map(definition => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'db-library-result';
                button.dataset.key = definition.key;
                const title = document.createElement('strong');
                title.textContent = definition.title;
                const source = document.createElement('span');
                source.textContent = `Report: ${definition.report}`;
                const description = document.createElement('span');
                description.textContent = definition.description;
                button.append(title, source, description);
                button.addEventListener('click', () => choose(definition));
                return button;
            }));
            if (!definitions.length) {
                clearPreview();
                selected = null;
                loading.hidden = true;
                errorBox.hidden = true;
                const empty = document.createElement('p');
                empty.className = 'db-empty db-muted';
                empty.textContent = 'No widgets match. Try another width, variation, or report.';
                results.append(empty);
                document.getElementById('previewTitle').textContent = 'No matching widgets';
                document.getElementById('previewDimensions').textContent = '';
                variantSelect.replaceChildren();
                widthSelect.replaceChildren();
            } else choose(definitions.find(item => item.key === selected?.key) || definitions[0]);
        }
        search.addEventListener('input', filter);
        [report, widthFilter, variantFilter].forEach(control => control.addEventListener('change', filter));
        variantSelect.addEventListener('change', () => {
            configureWidths(widthSelect.value);
            loadPreview();
        });
        widthSelect.addEventListener('change', loadPreview);
        global.addEventListener('sb:widget-requirements-changed', () => {
            if (dialog.open && selected) loadPreview();
        });
        global.addEventListener('sb:widget-sync-ready', event => {
            if (dialog.open && selected && preview.contains(event.detail.body)) loadPreview();
        });
        dialog.addEventListener('sb:dialog-opened', filter);
        dialog.addEventListener('sb:dialog-before-close', event => {
            if (pending) event.preventDefault();
        });
        dialog.addEventListener('sb:dialog-closed', () => {
            clearPreview();
            loading.hidden = true;
        });
        addButton.addEventListener('click', async () => {
            if (pending || !selected || previewRows === null) return;
            pending = true;
            const variant = selected.variants.find(item => item.key === variantSelect.value);
            const controls = Array.from(dialog.querySelectorAll('button, input, select'));
            const disabled = controls.map(control => control.disabled);
            controls.forEach(control => { control.disabled = true; });
            errorBox.hidden = true;
            try {
                await global.SBDashboardEditor.addWidget({
                        key: selected.key, variant_key: variant.key,
                        column_span: Number(widthSelect.value), row_span: previewRows,
                });
                pending = false;
                global.SBDialog.close(dialog, 'added');
            } catch (error) {
                console.error('Widget library add:', error);
                errorBox.textContent = 'Could not add the widget. ' + error.message;
                errorBox.hidden = false;
            } finally {
                pending = false;
                controls.forEach((control, index) => { control.disabled = disabled[index]; });
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window !== 'undefined' ? window : globalThis);
