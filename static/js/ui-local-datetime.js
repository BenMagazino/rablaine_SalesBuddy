/** Render the existing UTC display markers on pages and injected fragments. */
(() => {
    'use strict';

    function render(root = document) {
        const shortTZ = new Date().toLocaleTimeString('en-US', {timeZoneName: 'short'})
            .split(' ').pop();
        root.querySelectorAll('.local-datetime').forEach(element => {
            let utc = element.getAttribute('data-utc');
            if (!utc) return;
            // Naive SQLite timestamps are UTC; note call_date does not use this marker.
            if (!/(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(utc)) utc += 'Z';
            const date = new Date(utc);
            if (Number.isNaN(date.getTime())) {
                console.warn('Unable to render an invalid UTC display timestamp.');
                element.textContent = 'Unavailable';
                return;
            }
            const format = element.getAttribute('data-fmt') || 'datetime';
            if (format === 'date') {
                element.textContent = date.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                });
            } else if (format === 'short') {
                element.textContent = date.toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                });
            } else if (format === 'time') {
                element.textContent = date.toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true,
                });
            } else {
                element.textContent = date.toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                });
            }
        });
        root.querySelectorAll('.timezone-label').forEach(element => {
            element.textContent = '(' + shortTZ + ')';
        });
    }
    window.SBLocalDateTime = Object.freeze({render});
    render();
})();
