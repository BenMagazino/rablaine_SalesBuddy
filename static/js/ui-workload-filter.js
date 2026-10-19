/** Reusable prefix multi-select with report-specific preferences. */
(function(root) {
    'use strict';
    const normalize = value => (value || '').split(':', 1)[0].trim();

    function validate(value) {
        if (!Array.isArray(value) || value.length > 1000 ||
            value.some(item => typeof item !== 'string' || item.length > 1000)) {
            throw new Error('Invalid saved workload selection.');
        }
        return [...new Set(value.map(normalize))].sort();
    }

    function read(storageKey) {
        const saved = root.localStorage.getItem(storageKey);
        return saved === null ? [] : validate(JSON.parse(saved));
    }

    function matches(workload, selected) {
        return selected.length === 0 || selected.includes(normalize(workload));
    }

    function create(host, {storageKey, choices = [], onChange = () => {}} = {}) {
        if (typeof storageKey !== 'string' || !storageKey.trim()) {
            throw new Error('A report-specific workload storage key is required.');
        }
        const document = root.document;
        let selected = [];
        let available = [];
        function node(tag, className, text) {
            const element = document.createElement(tag);
            element.className = className;
            if (text !== undefined) element.textContent = text;
            return element;
        }
        const button = node('button', 'sb-bucket-button');
        button.type = 'button';
        const panel = node('div', 'sb-bucket-popover');
        panel.id = host.id + '-workloads';
        panel.setAttribute('popover', 'auto');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Workload prefixes');
        button.setAttribute('popovertarget', panel.id);
        button.setAttribute('aria-controls', panel.id);
        button.setAttribute('aria-expanded', 'false');
        const search = node('input', 'sb-bucket-search');
        search.type = 'search';
        search.placeholder = 'Find workloads';
        search.setAttribute('aria-label', 'Find workloads');
        const clear = node('button', 'sb-bucket-button', 'Show all workloads');
        clear.type = 'button';
        const list = node('div', 'sb-bucket-list');
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', 'Workloads');
        const empty = node('p', 'sb-bucket-empty', 'No workloads match your search.');
        const status = node('p', 'sb-bucket-status');
        status.setAttribute('role', 'alert');
        host.append(button, panel, status);
        panel.append(
            node('div', 'sb-bucket-heading', 'Workloads'), search, clear, list, empty,
            node('p', 'sb-bucket-hint',
                'No selection shows all workloads. Remembered for this report only.'),
        );

        function report(error, message) {
            root.console.error(message, error);
            status.textContent = message;
        }

        function load() {
            try {
                selected = read(storageKey);
                status.textContent = '';
            } catch (error) {
                report(error, 'Could not restore workload filters. Current selections are unchanged.');
            }
        }

        function filterChoices() {
            const query = search.value.trim().toLocaleLowerCase();
            let count = 0;
            for (const label of list.children) {
                label.hidden = !label.textContent.toLocaleLowerCase().includes(query);
                if (!label.hidden) count++;
            }
            empty.hidden = count !== 0;
        }

        function render() {
            const focused = [...list.children].map(label => label.children[0])
                .find(input => input === document.activeElement);
            button.textContent = 'Workloads: ' + (selected.length
                ? selected.length + ' selected' : 'All');
            button.title = selected.map(value => value || '(No workload)').join(', ') ||
                'All workload prefixes';
            list.replaceChildren();
            for (const value of [...new Set([...available, ...selected])].sort()) {
                const label = node('label', 'sb-bucket-option');
                const input = node('input', '');
                input.type = 'checkbox';
                input.value = value;
                input.checked = selected.includes(value);
                input.addEventListener('change', () => {
                    change(input.checked ? [...selected, value] :
                        selected.filter(item => item !== value));
                });
                label.append(input, node('span', '', (value || '(No workload)') +
                    (available.includes(value) ? '' : ' (not in this view)')));
                list.append(label);
                if (focused && input.value === focused.value) input.focus();
            }
            filterChoices();
        }

        function change(value) {
            selected = validate(value);
            try {
                root.localStorage.setItem(storageKey, JSON.stringify(selected));
                status.textContent = '';
            } catch (error) {
                report(error, 'Could not remember workload filters. They apply on this page only.');
            }
            render();
            onChange([...selected]);
        }

        function position() {
            const bounds = button.getBoundingClientRect();
            panel.style.left = Math.max(8, Math.min(bounds.left,
                root.innerWidth - panel.offsetWidth - 8)) + 'px';
            panel.style.top = Math.max(8, Math.min(bounds.bottom + 6,
                root.innerHeight - panel.offsetHeight - 8)) + 'px';
        }

        function refresh() {
            const before = JSON.stringify(selected);
            load();
            render();
            if (before !== JSON.stringify(selected)) onChange([...selected]);
        }
        clear.addEventListener('click', () => change([]));
        search.addEventListener('input', filterChoices);
        panel.addEventListener('toggle', event => {
            button.setAttribute('aria-expanded', String(event.newState === 'open'));
            if (event.newState === 'open') {
                search.value = '';
                filterChoices();
                position();
                search.focus();
            }
        });
        panel.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            panel.hidePopover();
            button.focus();
        });
        root.addEventListener('storage', event => {
            if (event.key === storageKey || event.key === null) refresh();
        });
        root.addEventListener('pageshow', refresh);
        root.addEventListener('resize', () => {
            if (panel.matches(':popover-open')) position();
        });
        load();
        function setChoices(values) {
            available = validate(values);
            render();
        }
        setChoices(choices);
        return {
            getSelected: () => [...selected],
            setSelected: change,
            setChoices,
        };
    }

    const api = {normalize, validate, read, matches, create};
    root.SBWorkloadFilter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
