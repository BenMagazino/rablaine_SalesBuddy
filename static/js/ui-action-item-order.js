/** Shared due-date views and durable manual ordering for action-item lists. */
((window) => {
    'use strict';
    if (window.SBActionItemOrder) return;
    const modes = ['due', 'due-desc', 'manual'];

    function compareItems(a, b, mode) {
        const status = Number(a.status === 'completed') - Number(b.status === 'completed');
        if (status) return status;
        if (mode !== 'manual') {
            if (!a.due && b.due) return 1;
            if (a.due && !b.due) return -1;
            const due = (a.due || '').localeCompare(b.due || '');
            if (due) return mode === 'due-desc' ? -due : due;
        }
        return a.rank - b.rank || a.id - b.id;
    }

    function mount(root, {key, url, isBusy = () => false, sortable = null}) {
        if (root._actionOrder) return root._actionOrder;
        const picker = root.querySelector('[data-action-order]');
        const notice = root.querySelector('[data-action-order-notice]');
        const groups = [...root.querySelectorAll('[data-action-order-list]')];
        const rows = groups.flatMap(group => [...group.children]
            .filter(row => row.hasAttribute('data-action-order-id')));
        const items = new Map(rows.map((row, rank) => [row, {
            id: Number(row.dataset.actionOrderId), due: row.dataset.actionOrderDue,
            status: row.dataset.actionOrderStatus, rank,
        }]));
        let pending = false, disposed = false;
        const controls = [];
        function report(message, error) {
            notice.textContent = message;
            notice.hidden = !message;
            if (error) console.error(message, error);
        }
        function remember() {
            try { window.localStorage.setItem(key, picker.value); }
            catch (error) { report('Could not remember the action-item sort preference.', error); }
        }
        function update() {
            picker.disabled = pending;
            groups.forEach(group => { group.inert = pending; });
            const manual = picker.value === 'manual';
            sortable?.option('disabled', !manual || pending);
            root.querySelectorAll('.drag-handle').forEach(handle => { handle.hidden = !manual; });
            for (const {row, box, up, down} of controls) {
                box.hidden = !manual;
                const siblings = [...row.parentElement.children]
                    .filter(el => items.get(el)?.status === 'open');
                const index = siblings.indexOf(row);
                up.disabled = pending || index === 0;
                down.disabled = pending || index === siblings.length - 1;
            }
        }
        function apply() {
            for (const group of groups) {
                const children = [...group.children].filter(row => items.has(row));
                children.sort((a, b) => compareItems(items.get(a), items.get(b), picker.value));
                group.append(...children);
            }
            update();
        }
        async function save() {
            if (pending || isBusy() || disposed) {
                apply();
                report('Finish saving the current action item before reordering.');
                return;
            }
            const openRows = groups.flatMap(group => [...group.children])
                .filter(row => items.get(row)?.status === 'open');
            pending = true;
            report('');
            update();
            try {
                const response = await window.fetch(url, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({task_ids: openRows.map(row => items.get(row).id)}),
                });
                const result = await response.json();
                if (!response.ok || result.success !== true) {
                    throw new Error(result.error || 'The server did not confirm the order.');
                }
                openRows.forEach((row, rank) => { items.get(row).rank = rank; });
            } catch (error) {
                apply();
                report('Order was not saved. ' + error.message, error);
            } finally {
                pending = false;
                if (!disposed) update();
            }
        }
        for (const row of rows.filter(row => items.get(row).status === 'open')) {
            const box = window.document.createElement('span');
            box.className = 'sb-action-move';
            const buttons = [-1, 1].map(direction => {
                const button = window.document.createElement('button');
                button.type = 'button';
                button.innerHTML = `<i class="bi bi-arrow-${direction < 0 ? 'up' : 'down'}" aria-hidden="true"></i>`;
                button.setAttribute('aria-label', `Move action item ${direction < 0 ? 'up' : 'down'}`);
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    if (pending || isBusy() || picker.value !== 'manual') return;
                    const siblings = [...row.parentElement.children]
                        .filter(el => items.get(el)?.status === 'open');
                    const next = siblings[siblings.indexOf(row) + direction];
                    if (!next) return;
                    if (direction < 0) row.parentElement.insertBefore(row, next);
                    else row.parentElement.insertBefore(next, row);
                    void save().then(() => {
                        if (disposed) return;
                        const target = button.disabled ? buttons.find(item => !item.disabled) : button;
                        target?.focus({preventScroll: true});
                    });
                });
                box.append(button);
                return button;
            });
            box.addEventListener('keydown', event => event.stopPropagation());
            row.append(box);
            controls.push({row, box, up: buttons[0], down: buttons[1]});
        }
        try {
            const saved = window.localStorage.getItem(key);
            if (saved !== null && !modes.includes(saved)) {
                throw new Error('Invalid saved action-item order preference.');
            }
            picker.value = saved || 'due';
        } catch (error) {
            picker.value = 'due';
            report('Could not restore the action-item sort preference.', error);
        }
        picker.addEventListener('change', () => { apply(); remember(); });
        apply();
        const api = {save, isBusy: () => pending, dispose() {
            disposed = true;
            sortable?.destroy();
        }};
        root._actionOrder = api;
        return api;
    }

    const api = Object.freeze({compareItems, mount});
    if (typeof module !== 'undefined') module.exports = api;
    window.SBActionItemOrder = api;
})(typeof window === 'undefined' ? globalThis : window);
