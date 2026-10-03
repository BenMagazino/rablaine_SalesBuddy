/** Shared image preview for static and injected note content. */
(() => {
    'use strict';

    const ids = ['imageZoomModal', 'imageZoomImg', 'imageZoomStage', 'imageZoomStatus',
        'imageZoomPreview', 'imageZoomError', 'imageZoomRetry'];
    const elements = ids.map(id => document.getElementById(id));
    if (elements.some(element => !element)) {
        throw new Error('Image viewer markup is incomplete.');
    }
    const [dialog, image, stage, status, preview, error, retry] = elements;
    let source = null;

    function showError() {
        stage.setAttribute('aria-busy', 'false');
        status.hidden = true;
        preview.hidden = true;
        error.hidden = false;
        console.error('Failed to load image preview.', {dialogId: dialog.id});
    }

    function showImage() {
        if (!dialog.open || !image.complete || image.naturalWidth === 0) return;
        stage.setAttribute('aria-busy', 'false');
        status.hidden = true;
        error.hidden = true;
        preview.hidden = false;
    }

    function loadImage() {
        if (!source) throw new Error('Image viewer has no selected image.');
        stage.setAttribute('aria-busy', 'true');
        status.hidden = false;
        preview.hidden = true;
        error.hidden = true;
        image.alt = source.alt || 'Enlarged note image';
        if (!source.getAttribute('src') && !source.currentSrc) {
            showError();
            return;
        }
        image.src = source.currentSrc || source.src;
        showImage();
    }

    function openImage(target) {
        source = target;
        source.focus({preventScroll: true});
        SBDialog.open(dialog);
        loadImage();
    }

    function isContentImage(target) {
        return target instanceof HTMLImageElement && target.closest('.call-content');
    }

    function enhance(root) {
        const images = [...root.querySelectorAll('.call-content img')];
        if (isContentImage(root)) images.unshift(root);
        for (const item of images) {
            if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
            if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
            if (!item.hasAttribute('aria-label')) {
                item.setAttribute('aria-label', item.alt ? `View image: ${item.alt}` : 'View image');
            }
            item.setAttribute('aria-haspopup', 'dialog');
            item.setAttribute('aria-controls', dialog.id);
        }
    }

    enhance(document);
    new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node instanceof Element) enhance(node);
            }
        }
    }).observe(document.body, {childList: true, subtree: true});

    document.addEventListener('click', event => {
        if (!isContentImage(event.target)) return;
        if (event.target.closest('a[href]') &&
            (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        openImage(event.target);
    });
    document.addEventListener('keydown', event => {
        if (!isContentImage(event.target) || !['Enter', ' '].includes(event.key) ||
            event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        openImage(event.target);
    });
    image.addEventListener('load', showImage);
    image.addEventListener('error', () => {
        if (dialog.open && image.complete && image.naturalWidth === 0) showError();
    });
    retry.addEventListener('click', () => {
        dialog.querySelector('.sb-dialog-close').focus();
        loadImage();
    });
    dialog.addEventListener('sb:dialog-closed', event => {
        if (event.target !== dialog) return;
        source = null;
        image.removeAttribute('src');
        image.alt = '';
        stage.setAttribute('aria-busy', 'false');
        status.hidden = true;
        preview.hidden = true;
        error.hidden = true;
    });
})();
