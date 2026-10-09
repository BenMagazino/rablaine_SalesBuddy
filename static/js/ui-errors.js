(() => {
    'use strict';
    const root = document.documentElement;
    // Error documents also work when the normal application shell cannot render.
    if (!root.dataset.sbMode) {
        root.dataset.sbMode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const back = document.getElementById('error-back');
    if (history.length > 1 && back) {
        back.hidden = false;
        back.addEventListener('click', () => history.back());
    }
    const retry = document.getElementById('error-retry');
    if (retry) retry.addEventListener('click', () => {
        if (retry.disabled) return;
        retry.disabled = true;
        retry.textContent = 'Trying again...';
        location.reload();
    });
})();
