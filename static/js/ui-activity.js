/** Lightweight feedback for document navigation and foreground requests. */
(() => {
    'use strict';
    const indicator = document.getElementById('sbActivity');
    if (!indicator) return;

    let navigating = false;
    let gesture = false;
    let gestureTimer = null;
    let requests = 0;
    let generation = 0;
    function render() {
        indicator.hidden = document.documentElement.dataset.sbActivityPreview !== 'true' &&
            (document.documentElement.dataset.sbActivityEnabled === 'false' ||
            !(navigating || requests > 0 ||
                document.documentElement.dataset.sbShellLoading === 'true'));
    }
    function reset() {
        generation++;
        navigating = gesture = false;
        requests = 0;
        delete document.documentElement.dataset.sbShellLoading;
        delete document.documentElement.dataset.sbActivityPreview;
        clearTimeout(gestureTimer);
        render();
    }
    for (const type of ['click', 'submit', 'input', 'change', 'keydown']) {
        document.addEventListener(type, () => {
            gesture = true;
            clearTimeout(gestureTimer);
            gestureTimer = setTimeout(() => { gesture = false; }, 0);
        }, true);
    }

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, options) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (!gesture || url.origin !== location.origin) {
            return nativeFetch(input, options);
        }
        const current = generation;
        requests++;
        render();
        try {
            return await nativeFetch(input, options);
        } finally {
            if (generation === current) {
                requests--;
                render();
            }
        }
    };
    // Navigation events include links, forms, reload, history, and location.assign().
    // Unlike click interception they run only for navigation that was actually accepted.
    if (window.navigation) {
        window.navigation.addEventListener('navigate', event => {
            if (event.destination.sameDocument || event.downloadRequest !== null ||
                    new URL(event.destination.url).origin !== location.origin) return;
            navigating = true;
            render();
            event.signal.addEventListener('abort', () => {
                navigating = false;
                render();
            }, {once: true});
        });
        window.navigation.addEventListener('navigateerror', () => {
            navigating = false;
            render();
        });
        window.navigation.addEventListener('navigatesuccess', () => {
            navigating = false;
            render();
        });
    }
    window.addEventListener('pagehide', reset);
    window.addEventListener('sb:shell-loading', render);
    window.addEventListener('sb:activity-preference-changed', render);
    window.addEventListener('sb:activity-preview-changed', render);
    window.addEventListener('pageshow', event => {
        if (event.persisted) reset();
    });
    render();
})();
