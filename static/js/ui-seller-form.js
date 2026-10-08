/** Native territory choices, using text nodes and the original repeated POST IDs. */
(function (root) {
    'use strict';
    function matches(choices, term, selected) {
        const query = term.toLowerCase().trim();
        return query ? choices.filter(choice => choice.name.toLowerCase().includes(query)
            && !selected.includes(String(choice.id))) : [];
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = {matches};
    if (!root.document) return;
    const document = root.document, form = document.getElementById('sellerForm');
    if (!form) return;
    const choices = JSON.parse(document.getElementById('sellerTerritories').textContent);
    const search = document.getElementById('territory_search');
    const dropdown = document.getElementById('territory_dropdown');
    const selected = document.getElementById('selected_territories');
    let current = [], index = -1;
    const ids = () => [...selected.querySelectorAll('[name="territory_ids"]')]
        .map(input => input.value);
    function close() {
        dropdown.hidden = true;
        search.setAttribute('aria-expanded', 'false');
        search.removeAttribute('aria-activedescendant');
        current = [];
        index = -1;
    }
    function render() {
        dropdown.replaceChildren();
        current.forEach((choice, i) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'seller-territory-option-' + choice.id;
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', String(i === index));
            button.textContent = choice.name;
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => add(choice));
            dropdown.appendChild(button);
        });
        dropdown.hidden = !current.length;
        search.setAttribute('aria-expanded', String(!!current.length));
        if (index >= 0) search.setAttribute('aria-activedescendant',
            'seller-territory-option-' + current[index].id);
    }
    function append(choice) {
        const pill = document.createElement('span'), icon = document.createElement('i');
        pill.className = 'sf-territory';
        pill.dataset.territoryId = choice.id;
        icon.className = 'bi bi-geo-alt';
        icon.setAttribute('aria-hidden', 'true');
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.removeTerritory = choice.id;
        remove.setAttribute('aria-label', 'Remove ' + choice.name);
        remove.textContent = '×';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'territory_ids';
        input.value = choice.id;
        pill.append(icon, document.createTextNode(choice.name), remove, input);
        selected.appendChild(pill);
    }
    function add(choice) {
        if (ids().includes(String(choice.id))) return;
        append(choice);
        search.value = '';
        close();
        search.focus();
        form.dispatchEvent(new root.Event('change', {bubbles: true}));
    }
    search.addEventListener('input', () => {
        current = matches(choices, search.value, ids());
        index = current.length ? 0 : -1;
        render();
    });
    search.addEventListener('keydown', event => {
        if (current.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            index = (index + (event.key === 'ArrowDown' ? 1 : current.length - 1))
                % current.length;
            render();
        } else if (current.length && ['Enter', ' ', 'Tab'].includes(event.key)) {
            event.preventDefault();
            add(current[index]);
        } else if (event.key === 'Escape') close();
    });
    selected.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-territory]');
        if (!button) return;
        button.closest('[data-territory-id]').remove();
        close();
        search.focus();
        form.dispatchEvent(new root.Event('change', {bubbles: true}));
    });
    document.addEventListener('click', event => {
        if (!search.contains(event.target) && !dropdown.contains(event.target)) close();
    });
    root.SBSellerTerritories = {ids, restore(values) {
        selected.replaceChildren();
        values.forEach(id => {
            const choice = choices.find(item => String(item.id) === id);
            if (choice) append(choice);
            else {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'territory_ids';
                input.value = id;
                selected.appendChild(input);
            }
        });
        search.value = '';
        close();
    }};
})(typeof window === 'undefined' ? globalThis : window);
