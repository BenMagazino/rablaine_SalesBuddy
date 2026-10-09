/* Persist the report scope before paint without changing explicit URLs. */
(() => {
    'use strict';
    const mode = document.currentScript.dataset.mode;
    const key = 'synapseCustomersMode';
    const url = new URL(location.href);
    let preferenceUnavailable = false;
    let redirecting = false;

    function reportPreferenceError(error) {
        console.warn('Synapse report mode preference unavailable:', error);
        preferenceUnavailable = true;
    }

    if (!url.searchParams.get('mode')) {
        try {
            const saved = localStorage.getItem(key);
            if (saved !== null && saved !== 'new' && saved !== 'current') {
                reportPreferenceError(new Error('Invalid saved Synapse report mode.'));
            } else if (saved && saved !== mode) {
                url.searchParams.set('mode', saved);
                location.replace(url.href);
                redirecting = true;
            }
        } catch (error) {
            reportPreferenceError(error);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (redirecting) return;
        try {
            localStorage.setItem(key, mode);
        } catch (error) {
            reportPreferenceError(error);
        }
        if (preferenceUnavailable) {
            const notice = document.getElementById('synapseModeNotice');
            notice.textContent = 'Saved report mode unavailable. You can still switch between New and Current.';
            notice.hidden = false;
        }
    });
})();
