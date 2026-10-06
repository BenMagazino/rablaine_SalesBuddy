/** Native frame, preference validation and reading history for the coverage audit. */
(function(root) {
    'use strict';

    function validatePreferences(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('Invalid coverage preferences');
        }
        const result = Object.assign({lens: 'meetings', meetingView: 'weekly', filter: 'all'}, value);
        if (!['meetings', 'milestones'].includes(result.lens) ||
            !['weekly', 'full'].includes(result.meetingView) ||
            !['all', 'open', 'prepared', 'failed', 'logged'].includes(result.filter)) {
            throw new Error('Invalid coverage preference values');
        }
        return result;
    }

    function preferredUrl(href, preferences) {
        const value = validatePreferences(preferences);
        const url = new URL(href);
        ['lens', 'view', 'week', 'milestone', 'coverage', 'covered', 'inactive'].forEach(
            key => url.searchParams.delete(key)
        );
        if (value.lens === 'milestones') url.searchParams.set('lens', 'milestones');
        else if (value.meetingView === 'full') url.searchParams.set('view', 'all');
        return url;
    }

    function validateReadingState(value) {
        if (!value || typeof value !== 'object' ||
            !Number.isFinite(value.scroll) || value.scroll < 0 ||
            !Array.isArray(value.expanded) ||
            value.expanded.some(key => typeof key !== 'string' ||
                !/^(meeting|milestone):[1-9]\d*$/.test(key))) {
            throw new Error('Invalid coverage reading position');
        }
        return {scroll: value.scroll, expanded: [...new Set(value.expanded)]};
    }

    function reportError(message, error) {
        root.console.error(message, error);
        const notice = root.document.getElementById('activityCoverageNotice');
        if (notice) {
            notice.textContent = message;
            notice.hidden = false;
        }
    }

    function positionPicker(results, input) {
        const rect = input.getBoundingClientRect();
        const reading = root.document.getElementById('activityCoverageReading');
        const bounds = reading.getBoundingClientRect();
        const below = Math.max(0, bounds.bottom - rect.bottom - 8);
        const above = Math.max(0, rect.top - bounds.top - 8);
        const placeBelow = below >= 192 || below >= above;
        results.style.width = rect.width + 'px';
        results.style.maxHeight = Math.min(256, placeBelow ? below : above) + 'px';
        results.style.left = rect.left + 'px';
        results.style.top = (placeBelow ? rect.bottom + 4 :
            rect.top - results.getBoundingClientRect().height - 4) + 'px';
    }

    function init() {
        const document = root.document;
        const surface = document.querySelector('.sb-activity-coverage');
        if (!surface) return;
        const embedded = surface.dataset.embedded === 'true';
        const current = new URL(root.location.href);
        surface.querySelectorAll('a[href]').forEach(link => {
            const url = new URL(link.href);
            if (url.origin !== current.origin || url.pathname !== current.pathname) return;
            if (current.searchParams.has('scope')) {
                url.searchParams.set('scope', current.searchParams.get('scope'));
            }
            if (current.searchParams.has('embed')) {
                url.searchParams.set('embed', current.searchParams.get('embed'));
            }
            link.href = url.toString();
        });

        surface.querySelectorAll('[popovertarget]').forEach(trigger => {
            const popup = document.getElementById(trigger.getAttribute('popovertarget'));
            popup.addEventListener('toggle', event => {
                if (event.newState !== 'open') return;
                const rect = trigger.getBoundingClientRect();
                const bounds = popup.getBoundingClientRect();
                popup.style.left = Math.max(8, Math.min(rect.right - bounds.width,
                    root.innerWidth - bounds.width - 8)) + 'px';
                popup.style.top = Math.max(8, rect.bottom + bounds.height > root.innerHeight - 8 ?
                    rect.top - bounds.height : rect.bottom) + 'px';
                popup.querySelector('button').focus({preventScroll: true});
            });
            popup.addEventListener('click', event => {
                if (event.target.closest('button')) popup.hidePopover();
            });
        });
        surface.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            const popup = surface.querySelector('.coverage-popup:popover-open');
            if (popup) {
                event.preventDefault();
                popup.hidePopover();
                surface.querySelector(`[popovertarget="${popup.id}"]`).focus();
            }
        });

        const reading = document.getElementById('activityCoverageReading');
        reading.addEventListener('scroll', () => {
            surface.querySelector('.coverage-popup:popover-open')?.hidePopover();
            reading.querySelectorAll('.coverage-picker-results.is-open').forEach(results => {
                const input = results.closest('.coverage-picker').querySelector(
                    '.coverage-picker-input'
                );
                const rect = input.getBoundingClientRect();
                const bounds = reading.getBoundingClientRect();
                if (rect.bottom < bounds.top || rect.top > bounds.bottom) input.blur();
                else positionPicker(results, input);
            });
        });
        const footer = document.getElementById('activityCoverageRows');
        const rowSelector = surface.dataset.lens === 'meetings' ? '.meeting-row' :
            current.searchParams.get('coverage') === 'caip' ? '.caip-row' : '.milestone-coverage-row';
        function updateCount() {
            if (!footer) return;
            const rows = [...reading.querySelectorAll(rowSelector)];
            const visible = rows.filter(row => !row.classList.contains('is-hidden') &&
                !row.closest('[hidden]')).length;
            const noun = surface.dataset.lens === 'meetings' ? 'meetings' : 'milestones';
            footer.textContent = `${visible} of ${rows.length} ${noun} shown`;
        }
        updateCount();
        new root.MutationObserver(updateCount).observe(reading, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden']
        });
        if (embedded) return;

        function saveReading() {
            try {
                const value = {
                    scroll: reading.scrollTop,
                    expanded: [...reading.querySelectorAll('[data-coverage-history-key].is-expanded')]
                        .map(row => row.dataset.coverageHistoryKey)
                };
                root.history.replaceState(
                    Object.assign({}, root.history.state, {sbActivityCoverage: value}), ''
                );
            } catch (error) {
                reportError('Coverage reading position could not be saved.', error);
            }
        }
        function restoreReading() {
            const stored = root.history.state?.sbActivityCoverage;
            if (!stored) return;
            try {
                const value = validateReadingState(stored);
                const expanded = new Set(value.expanded);
                reading.querySelectorAll('[data-coverage-history-key]').forEach(row => {
                    const open = expanded.has(row.dataset.coverageHistoryKey);
                    row.classList.toggle('is-expanded', open);
                    row.querySelector('[aria-expanded]').setAttribute('aria-expanded', String(open));
                });
                reading.scrollTop = value.scroll;
                surface.dispatchEvent(new root.Event('sb:coverage-restored'));
            } catch (error) {
                reportError('Coverage reading position could not be restored.', error);
            }
        }
        restoreReading();
        root.addEventListener('pagehide', saveReading);
        root.addEventListener('pageshow', restoreReading);
    }

    const api = {validatePreferences, preferredUrl, validateReadingState, reportError, positionPicker};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.SBActivityCoverage = api;
    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', init, {once: true});
        } else init();
    }
})(typeof window === 'undefined' ? globalThis : window);
