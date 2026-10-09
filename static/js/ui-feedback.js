/** Dismiss shared notifications without losing keyboard focus. */
(() => {
    'use strict';

    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest('[data-sb-notice-dismiss]');
        if (!button) return;
        const notice = button.closest('.sb-notice');
        if (!notice) throw new Error('Notification dismiss control has no notification.');
        const restoreFocus = notice.contains(document.activeElement);
        const nextFocus = restoreFocus ?
            notice.nextElementSibling?.querySelector('[data-sb-notice-dismiss]') ||
            notice.previousElementSibling?.querySelector('[data-sb-notice-dismiss]') ||
            document.getElementById('main-content') : null;
        if (restoreFocus && !nextFocus) {
            throw new Error('Notification dismissal has no valid focus destination.');
        }
        event.preventDefault();
        notice.remove();
        if (restoreFocus) nextFocus.focus({preventScroll: true});
    });
})();
