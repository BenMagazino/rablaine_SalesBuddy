/** Partner-local rating and specialty selection; creation is an explicit immediate write. */
(function (root) {
    'use strict';
    if (!root.document) return;
    const document = root.document;
    const form = document.getElementById('partnerForm');
    if (!form) return;
    const catalog = JSON.parse(document.getElementById('partnerSpecialtyData').textContent);
    const search = document.getElementById('specialty_search');
    const dropdown = document.getElementById('specialty_dropdown');
    const selected = document.getElementById('selected_specialties');
    const rating = document.getElementById('rating');
    const clear = document.getElementById('clear-rating');
    const notice = document.getElementById('partnerFormNotice');
    const stars = [...form.querySelectorAll('.partf-star')];
    let matches = [], index = -1, pending = false;
    function changed() { form.dispatchEvent(new root.Event('change', {bubbles: true})); }
    function close() {
        dropdown.hidden = true;
        search.setAttribute('aria-expanded', 'false');
        search.removeAttribute('aria-activedescendant');
    }
    function ids() { return [...selected.querySelectorAll('[name="specialty_ids"]')].map(f => f.value); }
    function add(id, name) {
        if (ids().includes(String(id))) return;
        const tag = document.createElement('span');
        tag.className = 'partf-tag';
        tag.dataset.specialtyId = String(id);
        const text = document.createElement('span');
        text.textContent = name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.dataset.removeSpecialty = String(id);
        remove.setAttribute('aria-label', `Remove ${name}`);
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'specialty_ids';
        hidden.value = String(id);
        tag.append(text, remove, hidden);
        selected.append(tag);
    }
    function refreshRating() {
        stars.forEach(star => {
            const active = rating.value !== '' && Number(star.dataset.value) <= Number(rating.value);
            star.setAttribute('aria-pressed', String(active));
            star.querySelector('i').className = active ? 'bi bi-star-fill' : 'bi bi-star';
        });
        clear.hidden = rating.value === '';
    }
    root.SBPartnerSpecialties = {
        ids,
        restore(values) {
            const entries = values.map(id => {
                const entry = catalog.find(item => String(item.id) === id);
                if (!entry) throw new Error('A saved specialty is no longer available.');
                return entry;
            });
            selected.replaceChildren();
            entries.forEach(entry => add(entry.id, entry.name));
            close();
            refreshRating();
        },
    };
    function highlight() {
        [...dropdown.children].forEach((button, n) => {
            button.setAttribute('aria-selected', String(n === index));
        });
        search.setAttribute('aria-activedescendant', `partner-specialty-${index}`);
    }
    function render() {
        const term = search.value.trim();
        if (!term) { matches = []; index = -1; close(); return; }
        matches = catalog.filter(item => item.name.toLowerCase().includes(term.toLowerCase())
            && !ids().includes(String(item.id)));
        index = 0;
        dropdown.replaceChildren();
        [...matches, {name: `Create "${term}"`, description: 'Saves this specialty immediately.'}]
            .forEach((item, n) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.id = `partner-specialty-${n}`;
                button.setAttribute('role', 'option');
                button.textContent = item.name;
                if (item.description) {
                    const small = document.createElement('small');
                    small.textContent = item.description;
                    button.append(small);
                }
                button.addEventListener('mouseenter', () => { index = n; highlight(); });
                button.addEventListener('click', () => { index = n; choose(); });
                dropdown.append(button);
            });
        dropdown.hidden = false;
        search.setAttribute('aria-expanded', 'true');
        highlight();
    }
    async function create(name) {
        if (pending) return;
        pending = true;
        form.dispatchEvent(new root.CustomEvent('sb:partner-pending', {detail: true}));
        notice.hidden = true;
        try {
            const response = await root.fetch('/api/specialties/create', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name}),
            });
            const data = await response.json();
            if (!response.ok || !Number.isInteger(data.id) || data.id <= 0
                || typeof data.name !== 'string') {
                throw new Error(data.error || 'Could not create the specialty. Please try again.');
            }
            if (!catalog.some(item => item.id === data.id)) catalog.push(data);
            add(data.id, data.name);
            search.value = '';
            close();
        } catch (error) {
            root.console.error('Specialty creation failed.', error);
            notice.textContent = error.message || 'Could not create the specialty. Please try again.';
            notice.hidden = false;
        } finally {
            pending = false;
            form.dispatchEvent(new root.CustomEvent('sb:partner-pending', {detail: false}));
            changed();
            search.focus();
        }
    }
    function choose() {
        if (pending) return;
        if (index >= 0 && index < matches.length) {
            add(matches[index].id, matches[index].name);
            search.value = '';
            close();
            changed();
            search.focus();
        } else if (search.value.trim()) create(search.value.trim());
    }
    search.addEventListener('input', render);
    search.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !dropdown.hidden) {
            event.preventDefault(); event.stopPropagation(); close(); return;
        }
        if (!search.value.trim()) return;
        if (['ArrowDown', 'ArrowUp', 'Tab'].includes(event.key)) {
            event.preventDefault();
            if (dropdown.hidden) render();
            const direction = event.key === 'ArrowUp' || event.shiftKey ? -1 : 1;
            index = (index + direction + matches.length + 1) % (matches.length + 1);
            highlight();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            choose();
        }
    });
    selected.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-specialty]');
        if (!button || pending) return;
        button.closest('[data-specialty-id]').remove();
        changed();
        search.focus();
    });
    stars.forEach(star => star.addEventListener('click', () => {
        rating.value = star.dataset.value;
        refreshRating();
        changed();
    }));
    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            stars.forEach(item => {
                item.querySelector('i').className = Number(item.dataset.value)
                    <= Number(star.dataset.value) ? 'bi bi-star-fill' : 'bi bi-star';
            });
        });
        star.addEventListener('mouseleave', refreshRating);
    });
    clear.addEventListener('click', () => { rating.value = ''; refreshRating(); changed(); });
    document.addEventListener('click', event => {
        if (!search.contains(event.target) && !dropdown.contains(event.target)) close();
    });
    refreshRating();
})(typeof window === 'undefined' ? globalThis : window);
