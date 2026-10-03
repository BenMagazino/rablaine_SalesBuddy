/* Native Home tabs preserve the existing lazy-load event contract. */
(function () {
    'use strict';

    const list = document.getElementById('noteViewTabs');
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    const panels = tabs.map(tab => {
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (!panel) throw new Error('Home activity tab has no panel: ' + tab.id);
        return panel;
    });

    function select(id) {
        const index = tabs.findIndex(tab => tab.id === id);
        if (index < 0) throw new Error('Unknown Home activity tab: ' + id);
        const previous = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
        if (previous === tabs[index]) return;
        tabs.forEach((tab, position) => {
            const selected = position === index;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            tab.classList.toggle('active', selected);
            panels[position].hidden = !selected;
            panels[position].classList.toggle('active', selected);
        });
        const event = new CustomEvent('shown.bs.tab', {bubbles: true});
        event.relatedTarget = previous;
        tabs[index].dispatchEvent(event);
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(tab.id));
        tab.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = tabs.length - 1;
            else return;
            event.preventDefault();
            tabs[next].focus();
            select(tabs[next].id);
        });
    });

    const home = document.querySelector('[data-sb-home]');
    home.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (!event.target.matches('.sb-home-preview')) return;
        event.preventDefault();
        event.target.click();
    });

    function fitWorkspace() {
        const workspace = document.querySelector('.sb-home-workspace');
        const status = document.querySelector('.sb-home-status');
        const available = window.innerHeight - workspace.getBoundingClientRect().top -
            status.getBoundingClientRect().height;
        const height = Math.max(400, available) + 'px';
        if (home.style.getPropertyValue('--sb-home-height') !== height) {
            home.style.setProperty('--sb-home-height', height);
        }
        // Include the actual collapsed cell borders as well as the weekday strip.
        const calendarChrome = document.querySelector('#calendarTable').getBoundingClientRect().height -
            document.querySelector('#calendarBody').getBoundingClientRect().height;
        const chrome = ['.sb-home-activity-header',
            '.sb-home-legend'].reduce((sum, selector) => {
            return sum + document.querySelector(selector).getBoundingClientRect().height;
        }, calendarChrome) + 'px';
        if (home.style.getPropertyValue('--sb-home-calendar-chrome') !== chrome) {
            home.style.setProperty('--sb-home-calendar-chrome', chrome);
        }
    }

    const layoutObserver = new ResizeObserver(fitWorkspace);
    layoutObserver.observe(document.body);
    ['.sb-home-activity-header', '#calendarTable', '.sb-home-legend',
        '.sb-home-status'].forEach(selector => {
        layoutObserver.observe(document.querySelector(selector));
    });
    window.addEventListener('resize', fitWorkspace);
    window.addEventListener('DOMContentLoaded', fitWorkspace);
    fitWorkspace();

    window.SBHomeTabs = Object.freeze({select});
})();
