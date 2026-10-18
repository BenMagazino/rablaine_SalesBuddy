(function (global) {
    'use strict';

    function getDividerSegments(widgets) {
        const rectangles = widgets.map(item => ({
            left: item.layout_column, right: item.layout_column + item.column_span,
            top: item.layout_row, bottom: item.layout_row + item.row_span,
        }));
        const segments = [];
        function add(axis, position, start, end) {
            if (start < end) segments.push({axis, position, start, end});
        }
        rectangles.forEach((a, index) => {
            rectangles.slice(index + 1).forEach(b => {
                if (a.bottom === b.top || b.bottom === a.top) {
                    add('horizontal', Math.max(a.top, b.top),
                        Math.max(a.left, b.left), Math.min(a.right, b.right));
                }
                if (a.right === b.left || b.right === a.left) {
                    add('vertical', Math.max(a.left, b.left),
                        Math.max(a.top, b.top), Math.min(a.bottom, b.bottom));
                }
            });
        });
        segments.sort((a, b) => a.axis.localeCompare(b.axis)
            || a.position - b.position || a.start - b.start);
        const merged = [];
        segments.forEach(segment => {
            const last = merged.at(-1);
            if (last && last.axis === segment.axis && last.position === segment.position
                && segment.start <= last.end) {
                last.end = Math.max(last.end, segment.end);
            } else merged.push({...segment});
        });
        return merged;
    }

    function positionDividers(segments, grid) {
        return segments.map(segment => {
            const horizontal = segment.axis === 'horizontal';
            const step = horizontal ? grid.columnStep : grid.rowStep;
            const gap = horizontal ? grid.columnGap : grid.rowGap;
            const padding = horizontal ? grid.paddingLeft : grid.paddingTop;
            const joins = endpoint => segments.some(other => other.axis !== segment.axis
                && other.position === endpoint
                && other.start <= segment.position && other.end >= segment.position);
            const start = padding + segment.start * step - (joins(segment.start) ? gap / 2 : 0);
            const end = padding + segment.end * step - (joins(segment.end) ? gap / 2 : gap);
            const position = horizontal
                ? grid.paddingTop + segment.position * grid.rowStep - grid.rowGap / 2
                : grid.paddingLeft + segment.position * grid.columnStep - grid.columnGap / 2;
            return horizontal ? {x1: start, y1: position, x2: end, y2: position}
                : {x1: position, y1: start, x2: position, y2: end};
        });
    }

    function render(canvas, widgets) {
        let layer = canvas.querySelector('.db-divider-layer');
        if (canvas.closest('[data-display-style]').dataset.displayStyle !== 'dividers') {
            layer?.remove();
            return;
        }
        const entries = widgets || Array.from(
            canvas.querySelectorAll('.db-widget:not([hidden])'), tile => ({
                layout_column: Number(tile.dataset.column), layout_row: Number(tile.dataset.row),
                column_span: Number(tile.dataset.columnSpan), row_span: Number(tile.dataset.rowSpan),
            }));
        const segments = getDividerSegments(entries);
        if (!segments.length) {
            layer?.remove();
            return;
        }
        const doc = canvas.ownerDocument;
        const style = doc.defaultView.getComputedStyle(canvas);
        const columnGap = parseFloat(style.columnGap);
        const rowGap = parseFloat(style.rowGap);
        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingTop = parseFloat(style.paddingTop);
        const lines = positionDividers(segments, {
            columnGap, rowGap, paddingLeft, paddingTop,
            columnStep: (canvas.clientWidth - paddingLeft - parseFloat(style.paddingRight)
                + columnGap) / 12,
            rowStep: parseFloat(style.gridAutoRows) + rowGap,
        });
        const namespace = 'http://www.w3.org/2000/svg';
        if (!layer) {
            layer = doc.createElementNS(namespace, 'svg');
            layer.setAttribute('class', 'db-divider-layer');
            layer.setAttribute('aria-hidden', 'true');
            layer.setAttribute('focusable', 'false');
            canvas.append(layer);
        }
        layer.setAttribute('viewBox', `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
        layer.replaceChildren(...lines.map(coordinates => {
            const line = doc.createElementNS(namespace, 'line');
            Object.entries(coordinates).forEach(([key, value]) => line.setAttribute(key, value));
            return line;
        }));
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {getDividerSegments, positionDividers, render};
    }
    if (!global.document) return;
    global.SBDashboardDividers = Object.freeze({render});
    function init() {
        document.querySelectorAll('.db-canvas').forEach(canvas => render(canvas));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window === 'undefined' ? globalThis : window);
