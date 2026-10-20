/* Independent, browser-local display preferences for the two Fabric views. */
(() => {
    'use strict';
    function bindCheckbox(checkbox, key, initialValue = null) {
        function reportError(action, error) {
            console.error(`Could not ${action} Fabric display preference ${key}:`, error);
            let notice = checkbox.parentElement.querySelector('[data-fabric-preference-error]');
            if (!notice) {
                notice = document.createElement('span');
                notice.dataset.fabricPreferenceError = '';
                notice.setAttribute('role', 'alert');
                checkbox.parentElement.append(notice);
            }
            notice.textContent = `Could not ${action} this preference. It may not survive a reload.`;
        }
        try {
            const saved = initialValue ?? localStorage.getItem(key);
            if (saved !== null && saved !== 'true' && saved !== 'false') {
                throw new Error('Saved checkbox preference is not a boolean.');
            }
            if (saved !== null) checkbox.checked = saved === 'true';
        } catch (error) {
            reportError('restore', error);
        }
        checkbox.addEventListener('change', () => {
            try {
                localStorage.setItem(key, String(checkbox.checked));
                checkbox.parentElement.querySelector('[data-fabric-preference-error]')?.remove();
            } catch (error) {
                reportError('save', error);
            }
        });
    }
    function customerSelection(notice) {
        const key = 'salesbuddy_fabric_last_customer';
        function reportError(action, error) {
            console.error(`Could not ${action} Fabric customer selection:`, error);
            notice.hidden = false;
            notice.textContent = `Could not ${action} your last viewed customer.`;
        }
        return {
            restore(customers) {
                try {
                    const saved = localStorage.getItem(key);
                    if (saved === null) return null;
                    if (!/^[1-9]\d*$/.test(saved)) {
                        throw new Error('Saved customer ID is invalid.');
                    }
                    if (customers.some(customer => String(customer.id) === saved)) return saved;
                    localStorage.removeItem(key);
                    notice.hidden = false;
                    notice.textContent = 'Your last viewed customer is no longer available. Select a customer.';
                    return null;
                } catch (error) {
                    reportError('restore', error);
                    return null;
                }
            },
            save(id) {
                try {
                    localStorage.setItem(key, String(id));
                    notice.hidden = true;
                    notice.textContent = '';
                } catch (error) {
                    reportError('save', error);
                }
            },
        };
    }
    function bindMode(group, key, onChange, initialMode = null) {
        const buttons = [...group.querySelectorAll('[data-mode]')];
        let value = buttons.find(button => button.getAttribute('aria-pressed') === 'true')
            .dataset.mode;
        const notice = document.createElement('span');
        notice.setAttribute('role', 'alert');
        notice.hidden = true;
        group.after(notice);
        function reportError(action, error) {
            console.error(`Could not ${action} Fabric view mode:`, error);
            notice.hidden = false;
            notice.textContent = `Could not ${action} your view mode. It may not survive a reload.`;
        }
        function select(next) {
            if (!buttons.some(button => button.dataset.mode === next)) {
                throw new Error('Saved Fabric view mode is invalid.');
            }
            value = next;
            buttons.forEach(button =>
                button.setAttribute('aria-pressed', String(button.dataset.mode === value)));
        }
        try {
            const saved = initialMode ?? localStorage.getItem(key);
            if (saved !== null) select(saved);
        } catch (error) {
            reportError('restore', error);
        }
        buttons.forEach(button => button.addEventListener('click', () => {
            select(button.dataset.mode);
            try {
                localStorage.setItem(key, value);
                notice.hidden = true;
            } catch (error) {
                reportError('save', error);
            }
            onChange();
        }));
        return {get value() { return value; }};
    }
    window.SBFabricPreferences = { bindCheckbox, customerSelection, bindMode };
})();
