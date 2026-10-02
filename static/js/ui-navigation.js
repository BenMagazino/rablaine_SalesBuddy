/** App-owned navigation menus, independent of Bootstrap's dropdown plugin. */
(() => {
    'use strict';

    const bar = document.querySelector('.sb-app-bar');
    if (!bar) return;
    const triggers = [...bar.querySelectorAll('[data-sb-menu]')];
    let active = null;
    let openTimer;
    let closeTimer;

    function menuFor(trigger) {
        return document.getElementById(trigger.dataset.sbMenu);
    }

    function entries(menu) {
        return [...menu.querySelectorAll('a[href]')];
    }

    function close(returnFocus = false) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        if (!active) return;
        const previous = active;
        active = null;
        menuFor(previous).hidePopover();
        previous.setAttribute('aria-expanded', 'false');
        if (returnFocus) previous.focus();
    }

    function place() {
        if (!active) return;
        const menu = menuFor(active);
        const rect = active.getBoundingClientRect();
        const top = bar.getBoundingClientRect().bottom;
        menu.style.maxHeight = `${Math.max(0, window.innerHeight - top - 8)}px`;
        const width = menu.getBoundingClientRect().width;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function open(trigger, index = null) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        if (active !== trigger) {
            close();
            active = trigger;
            trigger.setAttribute('aria-expanded', 'true');
            menuFor(trigger).showPopover();
        }
        place();
        if (index !== null) entries(menuFor(trigger)).at(index)?.focus();
    }

    function scheduleClose() {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            if (active && !menuFor(active).contains(document.activeElement)) close();
        }, 240);
    }

    triggers.forEach(trigger => {
        const menu = menuFor(trigger);
        if (!menu) throw new Error(`Navigation menu is missing: ${trigger.dataset.sbMenu}`);
        menu.querySelectorAll('li:not(.sb-menu-heading)').forEach(li =>
            li.setAttribute('role', 'none'));
        entries(menu).forEach(link => {
            link.setAttribute('role', 'menuitem');
            link.setAttribute('tabindex', '-1');
        });
        trigger.addEventListener('click', () => {
            if (active === trigger) close(true);
            else open(trigger);
        });
        trigger.addEventListener('pointerenter', () => {
            clearTimeout(closeTimer);
            clearTimeout(openTimer);
            openTimer = setTimeout(() => open(trigger), 160);
        });
        trigger.addEventListener('pointerleave', scheduleClose);
        menu.addEventListener('pointerenter', () => clearTimeout(closeTimer));
        menu.addEventListener('pointerleave', scheduleClose);
        menu.addEventListener('click', event => {
            if (event.target.closest('a[href]')) close();
        });
    });

    document.addEventListener('pointerdown', event => {
        if (active && !active.contains(event.target) &&
            !menuFor(active).contains(event.target)) close();
    });
    document.addEventListener('focusin', event => {
        if (active && !active.contains(event.target) &&
            !menuFor(active).contains(event.target)) close();
    });
    document.addEventListener('keydown', event => {
        const trigger = event.target.closest('[data-sb-menu]');
        const inMenu = active && menuFor(active).contains(event.target);
        if (event.key === 'Escape' && active) {
            event.preventDefault();
            event.stopImmediatePropagation();
            close(true);
        } else if (trigger && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            open(trigger, event.key === 'ArrowUp' ? -1 : 0);
        } else if (inMenu && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const links = entries(menuFor(active));
            const index = links.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 :
                (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
            links[next]?.focus();
        } else if (inMenu && event.key === 'Tab') {
            close(true);
        }
    }, true);
    document.addEventListener('show.bs.modal', () => close());
    document.addEventListener('show.bs.offcanvas', () => close());
    document.addEventListener('sb:dialog-opening', () =>
        close(Boolean(active && menuFor(active).contains(document.activeElement))));
    window.addEventListener('resize', place);
})();
