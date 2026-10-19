/** Customer reading history and manual-edit lifecycle, without business autosave. */
((window) => {
    'use strict';
    const instances = new WeakMap();

    function validateHistory(value, id) {
        if (!value || value.id !== id || typeof value.tab !== 'string'
            || typeof value.search !== 'string' || typeof value.contextOpen !== 'boolean'
            || typeof value.contactsOpen !== 'boolean' || !Array.isArray(value.fields)
            || !Array.isArray(value.removed) || !Array.isArray(value.newContacts)
            || value.fields.some(field => !Array.isArray(field)
                || field.length !== 2 || field.some(part => typeof part !== 'string'))
            || value.removed.some(key => !Number.isSafeInteger(key) || key < 1)
            || value.newContacts.some(contact => !Array.isArray(contact)
                || contact.length !== 3 || contact.some(part => typeof part !== 'string'))
            || (value.scrolls && Object.entries(value.scrolls).some(([key, scroll]) =>
                !['cdWorkstreams', 'cdNotes', 'cdPipeline', 'cdRevenue', 'cdFabric'].includes(key)
                || !Number.isFinite(scroll) || scroll < 0))
            || ['context', 'work'].some(key => !Number.isFinite(value[key]) || value[key] < 0)) {
            throw new Error('Invalid customer reading history.');
        }
        return value;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = {validateHistory};
    if (!window.document) return;

    function mount(root) {
        if (instances.has(root)) return instances.get(root);
        const actions = root._customerActions;
        const context = root.querySelector('.cd-context');
        const reading = root.querySelector('.cd-reading');
        context.prepend(root.querySelector('#cdEssentials'));
        for (const panel of root.querySelectorAll('#cdPipeline, #cdRevenue')) {
            reading.append(panel);
        }
        const tabs = [...root.querySelectorAll('[role="tab"]')];
        const panels = [...reading.querySelectorAll('.cd-panel')];
        const lazyPanels = new Set(panels.filter(panel => panel.hasAttribute('data-cd-lazy'))
            .map(panel => panel.id));
        const notice = document.createElement('p');
        notice.className = 'cd-notice';
        notice.setAttribute('role', 'alert');
        notice.hidden = true;
        root.querySelector('.cd-header').after(notice);
        const report = message => {
            notice.textContent = message;
            notice.hidden = !message;
        };
        let pending = 0, submitted = false, transition = null;
        let tab = tabs[0].getAttribute('aria-controls');
        const scrolls = Object.fromEntries(panels.map(panel => [panel.id, 0]));
        const search = root.querySelector('#cdPipelineSearch');
        const fields = () => [root.querySelector('#contextTextarea'),
            ...root.querySelectorAll('#contactsEditList input')];
        const fieldKey = field => field.id || field.closest('[id]').id + ':' + field.dataset.field;
        const initial = new Map(fields().map(field => [fieldKey(field), field.value]));
        const childBaselines = new Map();
        const childValues = dialog => JSON.stringify([...dialog.querySelectorAll(
            'input, textarea, select')].map(field => [field.value, field.checked]));
        const childDirty = dialog => dialog.open && childBaselines.has(dialog)
            && childValues(dialog) !== childBaselines.get(dialog);
        const newContacts = () => [...root.querySelectorAll('#contactsNewRows > div')]
            .filter(row => row.querySelector('[data-field="name"]'))
            .map(row => [...row.querySelectorAll('input')].map(field => field.value));
        const dirty = () => !submitted && (fields().some(field =>
            field.value !== initial.get(fieldKey(field)))
            || actions.deletedContacts().length > 0
            || newContacts().some(contact => contact.some(value => value.trim()))
            || [...childBaselines.keys()].some(childDirty));
        const discard = document.getElementById('recordDiscardDialog');
        const confirm = document.getElementById('recordDiscardConfirm');
        const api = {report, isBusy: () => pending > 0, isDirty: dirty,
            start() { pending++; },
            finish() { pending = Math.max(0, pending - 1); },
            navigate(proceed) {
                if (pending) {
                    report('Saving customer changes. Please wait.');
                    return false;
                }
                if (dirty()) {
                    if (!discard.open) {
                        transition = () => {
                            actions.cancelContextEdit();
                            actions.cancelContactEdit();
                            save();
                            proceed();
                        };
                        document.getElementById('recordDiscardDescription').textContent =
                            'Your account context or contact entries have not been saved. ' +
                            'Keep editing, or discard them to continue.';
                        SBDialog.open(discard);
                    }
                    return false;
                }
                proceed();
                return true;
            },
            reload() {
                api.navigate(() => { submitted = true; window.location.reload(); });
            },
            contactCreated(row) {
                row.querySelectorAll('input').forEach(field => {
                    initial.set(fieldKey(field), field.value);
                    field.defaultValue = field.value;
                });
                save();
            },
            contactsSaved() {
                actions.clearDeletedContacts();
                fields().filter(field => field.id !== 'contextTextarea').forEach(field => {
                    initial.set(fieldKey(field), field.value);
                    field.defaultValue = field.value;
                });
                root.querySelector('#contactsNewRows').replaceChildren();
                actions.cancelContactEdit();
                report('');
                save();
            },
            contentReady(id) {
                if (!lazyPanels.delete(id)) return;
                if (tab === id) {
                    reading.scrollTop = scrolls[id] || 0;
                    save();
                }
            },
        };
        instances.set(root, api);
        root._customerDetail = api;

        function select(id, remember = true) {
            const button = tabs.find(button => button.getAttribute('aria-controls') === id);
            if (!button) return;
            if (!lazyPanels.has(tab)) scrolls[tab] = reading.scrollTop;
            tab = id;
            tabs.forEach(button => {
                const selected = button.getAttribute('aria-controls') === id;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
            panels.forEach(panel => { panel.hidden = panel.id !== id; });
            reading.scrollTop = scrolls[id] || 0;
            if (remember) save();
        }
        function filter() {
            const query = (search?.value || '').trim().toLocaleLowerCase();
            root.querySelectorAll('#cdPipeline .cd-opportunity').forEach(entry => {
                entry.hidden = !entry.textContent.toLocaleLowerCase().includes(query);
            });
        }
        function snapshot() {
            const work = lazyPanels.has(tab) ? scrolls[tab] || 0 : reading.scrollTop;
            return {id: Number(root.dataset.sbCustomerDetail), tab,
                context: context.scrollTop, work,
                scrolls: {...scrolls, [tab]: work},
                search: search?.value || '', contextOpen:
                    root.querySelector('#contextForm').style.display !== 'none',
                contactsOpen: root.querySelector('#contactsEditMode').style.display !== 'none',
                fields: fields().map(field => [fieldKey(field), field.value]),
                removed: actions.deletedContacts(), newContacts: newContacts()};
        }
        function save() {
            if (submitted) return;
            window.history.replaceState({...window.history.state,
                sbCustomerDetail: snapshot()}, '');
        }
        function restore() {
            const saved = window.history.state?.sbCustomerDetail;
            if (!saved || saved.id !== Number(root.dataset.sbCustomerDetail)) return;
            try {
                validateHistory(saved, saved.id);
                if (saved.scrolls) Object.assign(scrolls, saved.scrolls);
                if (saved.contextOpen) actions.toggleContextEdit();
                if (saved.contactsOpen) actions.toggleContactEdit();
                const values = new Map(saved.fields);
                fields().forEach(field => {
                    if (values.has(fieldKey(field))) field.value = values.get(fieldKey(field));
                });
                saved.newContacts.forEach(values => {
                    actions.addContactEditRow();
                    const row = root.querySelector('#contactsNewRows > div:last-child');
                    row.querySelectorAll('input').forEach((field, index) => {
                        field.value = values[index];
                    });
                });
                saved.removed.forEach(id => {
                    if (root.querySelector('#contact-edit-' + id)) actions.deleteContactEdit(id);
                });
                if (search) search.value = saved.search;
                filter();
                select(saved.tab, false);
                context.scrollTop = saved.context;
                reading.scrollTop = saved.work;
            } catch (error) {
                console.warn('Ignoring invalid customer reading history.', error);
            }
        }
        tabs.forEach((button, index) => {
            button.addEventListener('click', () => select(button.getAttribute('aria-controls')));
            button.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = tabs.length - 1;
                else return;
                event.preventDefault();
                tabs[next].focus();
                select(tabs[next].getAttribute('aria-controls'));
            });
        });
        search?.addEventListener('input', () => { filter(); save(); });
        root.addEventListener('input', save);
        context.addEventListener('scroll', save, {passive: true});
        reading.addEventListener('scroll', () => {
            if (!lazyPanels.has(tab)) save();
        }, {passive: true});
        for (const kind of ['click', 'change']) {
            root.addEventListener(kind, event => {
                const element = event.target.closest('[on' + kind + ']');
                if (!element || !root.contains(element)) return;
                const expression = element.getAttribute('on' + kind);
                element.removeAttribute('on' + kind);
                element.dataset['cd' + (kind === 'click' ? 'Click' : 'Change')] = expression;
                run(element, expression, event);
            }, true);
            root.addEventListener(kind, event => {
                const key = 'cd' + (kind === 'click' ? 'Click' : 'Change');
                const element = event.target.closest('[data-' + (kind === 'click'
                    ? 'cd-click' : 'cd-change') + ']');
                if (element && !event._customerHandled) run(element, element.dataset[key], event);
            });
        }
        function run(element, expression, event) {
            event._customerHandled = true;
            if (expression.startsWith('this.closest(')) {
                if (!pending) element.closest('.cd-contact-editor')?.remove();
                save();
                return;
            }
            const match = expression.match(/^(\w+)\(([^)]*)\)/);
            if (!match || !actions[match[1]]) return;
            if (pending) { report('Saving customer changes. Please wait.'); return; }
            const args = match[2].split(',').filter(arg => arg.trim()).map(arg =>
                arg.trim() === 'this' ? element : arg.trim() === 'this.value'
                    ? element.value : Number(arg.trim()));
            try {
                const result = actions[match[1]](...args);
                if (result?.catch) result.catch(error => report(error.message));
                save();
            } catch (error) { report(error.message); }
        }
        root.addEventListener('click', event => {
            const link = event.target.closest('a[href]');
            if (!link || link.target || event.defaultPrevented || event.ctrlKey || event.metaKey
                || event.shiftKey || event.altKey || event.button > 0) return;
            const url = new URL(link.href, window.location.href);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
            event.preventDefault();
            api.navigate(() => { submitted = true; window.location.assign(link.href); });
        });
        root.querySelector('#contextForm').addEventListener('submit', async event => {
            event.preventDefault();
            if (pending || submitted) return;
            const form = event.currentTarget;
            const button = form.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                const response = await request(root, form.action, {method: 'POST',
                    headers: {'X-Requested-With': 'XMLHttpRequest'}, body: new FormData(form)});
                const data = await response.json();
                if (!data.success) throw new Error(data.error || 'Account context was not saved.');
                const field = root.querySelector('#contextTextarea');
                field.value = data.account_context || '';
                field.defaultValue = field.value;
                initial.set(fieldKey(field), field.value);
                root.querySelector('#contextDisplay p').textContent = field.value;
                actions.cancelContextEdit();
                report('');
                save();
            } catch (error) { report(error.message); }
            finally { button.disabled = false; }
        });
        confirm.addEventListener('click', () => {
            if (!transition) return;
            const proceed = transition;
            transition = null;
            SBDialog.close(discard, 'discard');
            proceed();
        });
        discard.addEventListener('sb:dialog-closed', () => { transition = null; });
        for (const dialog of root.querySelectorAll('dialog')) {
            dialog.addEventListener('sb:dialog-opened', () => {
                childBaselines.set(dialog, childValues(dialog));
            });
            dialog.addEventListener('sb:dialog-before-close', event => {
                if (event.target !== dialog || event.detail.reason === 'saved') return;
                if (pending) { event.preventDefault(); report('Saving customer changes. Please wait.'); }
                else if (childDirty(dialog)) {
                    event.preventDefault();
                    if (!discard.open) {
                        transition = () => {
                            const original = JSON.parse(childBaselines.get(dialog));
                            dialog.querySelectorAll('input, textarea, select')
                                .forEach((field, index) => {
                                    field.value = original[index][0];
                                    field.checked = original[index][1];
                                });
                            childBaselines.delete(dialog);
                            SBDialog.close(dialog, 'discard');
                        };
                        document.getElementById('recordDiscardDescription').textContent =
                            'Discard the unsaved changes in this customer dialog?';
                        SBDialog.open(discard);
                    }
                }
            });
        }
        window.addEventListener('beforeunload', event => {
            save();
            if (submitted || (!dirty() && !pending)) return;
            event.preventDefault();
            event.returnValue = '';
        });
        window.addEventListener('pageshow', event => { if (event.persisted) submitted = false; });
        select(tab, false);
        restore();
        return api;
    }
    async function request(root, url, options = {}) {
        const api = instances.get(root);
        const write = (options.method || 'GET').toUpperCase() !== 'GET';
        if (write && api.isBusy()) throw new Error('Another customer change is still saving.');
        if (write) api.start();
        try {
            const response = await window.fetch(url, options);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `Customer request failed (${response.status}).`);
            }
            if (write) await response.clone().text();
            return response;
        } catch (error) {
            api.report(error.message);
            throw error;
        } finally { if (write) api.finish(); }
    }
    window.SBCustomerDetail = Object.freeze({mount, request,
        contactsSaved: root => instances.get(root).contactsSaved(),
        reload: root => instances.get(root).reload()});
})(typeof window === 'undefined' ? globalThis : window);
