/** Search existing application navigation without duplicating its page registry. */
(() => {
    'use strict';

    function matchingPages(pages, query) {
        const term = query.trim().toLocaleLowerCase();
        return pages.filter(page => [page.title, ...page.aliases].some(
            title => title.toLocaleLowerCase().includes(term),
        )).sort((a, b) => a.title.localeCompare(b.title));
    }

    function create(dialog) {
        const search = dialog?.querySelector('#quickLauncherSearch');
        const results = dialog?.querySelector('#quickLauncherResults');
        const count = dialog?.querySelector('#quickLauncherCount');
        let pages = [];

        function catalog() {
            const entries = new Map();
            const sources = [
                [document.querySelectorAll('#reportsMenu a[href]'), 'Reports'],
                [document.querySelectorAll('#dashboardsMenu a[href]'), 'Dashboards'],
                [document.querySelectorAll('#browseMenu a[href]'), 'Browse'],
                [document.querySelectorAll('#navCustomers a[href]'), 'Browse'],
                [document.querySelectorAll('#settingsMenu a[href]'), 'Settings'],
                [dialog.querySelector('template').content.querySelectorAll('a[href]'), 'Navigation'],
            ];
            for (const [links, group] of sources) {
                for (const link of links) {
                    const href = link.getAttribute('href');
                    if (!href.startsWith('/') || href.startsWith('//')) continue;
                    const badge = link.querySelector('.sb-update-label');
                    const title = (link.getAttribute('aria-label') ||
                        link.textContent.replace(badge?.textContent || '', ''))
                        .trim().replace(/\s+/g, ' ');
                    if (entries.has(href)) {
                        entries.get(href).aliases.push(title);
                    } else {
                        entries.set(href, {
                            href, title, group, aliases: [],
                            icon: link.querySelector('.bi')?.className || 'bi bi-arrow-up-right',
                        });
                    }
                }
            }
            return [...entries.values()];
        }

        function render() {
            const matches = matchingPages(pages, search.value);
            results.replaceChildren();
            count.textContent = matches.length + (matches.length === 1 ? ' page' : ' pages');
            for (const [index, page] of matches.entries()) {
                const link = document.createElement('a');
                link.href = page.href;
                link.className = 'sb-picker-result' +
                    (index === 0 && search.value.trim() ? ' enter-target' : '');
                const icon = document.createElement('i');
                icon.className = page.icon;
                icon.setAttribute('aria-hidden', 'true');
                const name = document.createElement('span');
                name.className = 'sb-picker-name';
                name.textContent = page.title;
                const group = document.createElement('span');
                group.className = 'sb-picker-meta';
                group.textContent = page.group;
                link.append(icon, name, group);
                results.append(link);
            }
            if (!matches.length) {
                const empty = document.createElement('p');
                empty.className = 'sb-picker-state';
                empty.textContent = 'No pages match your search.';
                results.append(empty);
            }
            results.scrollTop = 0;
        }

        function open() {
            if (!dialog) {
                if (window.parent !== window) {
                    window.parent.SBQuickLauncher.open();
                    return;
                }
                throw new Error('Quick launcher dialog is unavailable.');
            }
            if (!dialog.open) SBDialog.open(dialog);
            search.focus();
            search.select();
        }

        if (dialog) {
            dialog.addEventListener('sb:dialog-opened', () => {
                pages = catalog();
                search.value = '';
                render();
                search.focus();
            });
            search.addEventListener('input', render);
            search.addEventListener('keydown', event => {
                if (event.isComposing) return;
                const links = results.querySelectorAll('a[href]');
                if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
                    event.preventDefault();
                    if (event.key === 'Enter') links[0]?.click();
                    else links[event.key === 'ArrowDown' ? 0 : links.length - 1]?.focus();
                }
            });
            results.addEventListener('keydown', event => {
                const links = [...results.querySelectorAll('a[href]')];
                const index = links.indexOf(document.activeElement);
                if (index < 0) return;
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
                    if (next < 0) search.focus();
                    else links[next]?.focus();
                } else if (event.key === ' ') {
                    event.preventDefault();
                    links[index].click();
                }
            });
        }
        return Object.freeze({open});
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = {matchingPages, create};
    if (typeof document === 'undefined') return;
    window.SBQuickLauncher = create(document.getElementById('quickLauncherModal'));
    document.addEventListener('keydown', event => {
        if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey ||
            event.isComposing || event.defaultPrevented ||
            (event.code !== 'Space' && event.key !== ' ')) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) window.SBQuickLauncher.open();
    }, true);
})();
