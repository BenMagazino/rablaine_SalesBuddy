(function(global) {
    'use strict';

    function createElement(tag, className, text) {
        var element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = text;
        return element;
    }

    function milestoneKey(milestone) {
        return String(milestone.local_milestone_id || milestone.id || '');
    }

    function searchableText(milestone) {
        return [
            milestone.name,
            milestone.number,
            milestone.opportunity_name,
            milestone.workload,
            milestone.status,
        ].filter(Boolean).join(' ').toLowerCase();
    }

    function statusBadgeClass(status) {
        switch (status) {
            case 'On Track': return 'bg-success';
            case 'At Risk': return 'bg-warning text-dark';
            case 'Blocked': return 'bg-danger';
            case 'Completed': return 'bg-secondary';
            case 'Cancelled': return 'bg-light text-dark';
            case 'Lost to Competitor': return 'bg-dark';
            case 'Hygiene/Duplicate': return 'bg-light text-dark';
            default: return 'bg-secondary';
        }
    }

    function MilestoneMultiPicker(root, options) {
        this.root = root;
        this.options = options || {};
        this.input = root.querySelector('[data-milestone-picker-search]');
        this.results = root.querySelector('[data-milestone-picker-results]');
        this.selectedContainer = root.querySelector('[data-milestone-picker-selected]');
        this.help = root.querySelector('[data-milestone-picker-help]');
        this.milestones = [];
        this.selected = [];
        this.activeIndex = -1;
        this.matches = [];
        this.resultsInteracting = false;
        this.loadVersion = 0;
        this.loadRequest = null;
        if (this.options.native) {
            this.input.setAttribute('role', 'combobox');
            this.input.setAttribute('aria-autocomplete', 'list');
            this.input.setAttribute('data-sb-dialog-escape-owner', '');
            this.results.id = root.id + 'Results';
            this.results.setAttribute('role', 'listbox');
            this.input.setAttribute('aria-controls', this.results.id);
            this.input.setAttribute('aria-expanded', 'false');
        }
        this.bind();
    }

    MilestoneMultiPicker.prototype.bind = function() {
        var picker = this;
        this.input.addEventListener('focus', function() { picker.renderResults(); });
        this.input.addEventListener('click', function() { picker.renderResults(); });
        this.input.addEventListener('input', function() { picker.renderResults(); });
        this.input.addEventListener('keydown', function(event) {
            if (picker.options.native && event.key === 'Escape' &&
                picker.results.style.display !== 'none') {
                event.preventDefault();
                event.stopPropagation();
                picker.closeResults();
                return;
            }
            if (!picker.matches.length) {
                if (picker.options.native && event.key === 'Enter') event.preventDefault();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                picker.activeIndex = (picker.activeIndex + 1) % picker.matches.length;
                picker.updateActiveResult();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                picker.activeIndex = picker.activeIndex <= 0
                    ? picker.matches.length - 1 : picker.activeIndex - 1;
                picker.updateActiveResult();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                picker.select(picker.matches[picker.activeIndex >= 0 ? picker.activeIndex : 0]);
            } else if (event.key === 'Escape') {
                picker.closeResults();
            }
        });
        this.input.addEventListener('blur', function() {
            window.setTimeout(function() {
                if (!picker.resultsInteracting) picker.closeResults();
            }, 100);
        });
        this.results.addEventListener('pointerdown', function() {
            picker.resultsInteracting = true;
        });
        window.addEventListener('pointerup', function() {
            window.setTimeout(function() {
                picker.resultsInteracting = false;
            }, 150);
        });
    };

    MilestoneMultiPicker.prototype.load = function(
        customerId,
        preselectedIds,
        initialSelections
    ) {
        var picker = this;
        var version = ++this.loadVersion;
        if (this.options.native) {
            this.loadRequest?.abort();
            this.loadRequest = new AbortController();
        }
        this.customerId = customerId;
        this.milestones = [];
        this.selected = (initialSelections || []).slice();
        this.input.value = '';
        this.input.disabled = true;
        this.input.placeholder = 'Loading additional milestones...';
        this.help.textContent = 'Loading optional additional milestones...';
        this.renderSelected();
        this.closeResults();

        return fetch('/api/msx/milestones-for-customer/' + customerId,
            this.options.native ? {signal: this.loadRequest.signal} : undefined)
            .then(function(response) {
                if (picker.options.native && !response.ok) {
                    throw new Error('Milestones HTTP ' + response.status);
                }
                if (picker.options.native &&
                    !response.headers.get('content-type')?.includes('application/json')) {
                    throw new Error('Expected JSON milestone response');
                }
                return response.json();
            })
            .then(function(data) {
                if (picker.options.native && version !== picker.loadVersion) {
                    throw new DOMException('Superseded milestone load', 'AbortError');
                }
                if (!data?.success || !Array.isArray(data.milestones)) {
                    throw new Error(data?.error || 'Could not load milestones');
                }
                if (picker.options.native && (data.success !== true || data.milestones.some(
                    function(item) {
                        return !item || typeof item !== 'object' ||
                            (!item.local_milestone_id &&
                                !(typeof item.id === 'string' && item.id.trim()) &&
                                !(Number.isInteger(item.id) && item.id > 0)) ||
                            (item.local_milestone_id != null &&
                                (!Number.isInteger(item.local_milestone_id) ||
                                 item.local_milestone_id <= 0));
                    }
                ))) throw new Error('Invalid milestone list');
                picker.milestones = data.milestones;
                var wanted = new Set((preselectedIds || []).map(String));
                var loadedSelections = picker.milestones.filter(function(milestone) {
                    return wanted.has(milestoneKey(milestone));
                });
                loadedSelections.forEach(function(milestone) {
                    var key = milestoneKey(milestone);
                    var index = picker.selected.findIndex(function(selected) {
                        return milestoneKey(selected) === key;
                    });
                    if (index >= 0) {
                        picker.selected[index] = milestone;
                    } else {
                        picker.selected.push(milestone);
                    }
                });
                picker.input.disabled = false;
                picker.input.placeholder = picker.milestones.length <= 10
                    ? 'Click to browse milestones...'
                    : 'Search ' + picker.milestones.length + ' milestones...';
                picker.help.textContent = picker.milestones.length
                    ? 'Select one or more milestones for this customer.'
                    : 'No local milestones found for this customer.';
                picker.renderSelected();
                return picker.milestones;
            })
            .catch(function(error) {
                if (picker.options.native && version !== picker.loadVersion) throw error;
                picker.input.placeholder = 'Could not load milestones';
                picker.help.textContent = error.message;
                throw error;
            });
    };

    MilestoneMultiPicker.prototype.cancelLoad = function() {
        if (this.options.native) {
            this.loadVersion++;
            this.loadRequest?.abort();
        }
        this.closeResults();
    };

    MilestoneMultiPicker.prototype.availableMatches = function() {
        var term = this.input.value.trim().toLowerCase();
        var selectedKeys = new Set(this.selected.map(milestoneKey));
        return this.milestones.filter(function(milestone) {
            return !selectedKeys.has(milestoneKey(milestone))
                && (!term || term === '*' || searchableText(milestone).includes(term));
        });
    };

    MilestoneMultiPicker.prototype.renderResults = function() {
        var picker = this;
        this.matches = this.availableMatches();
        this.activeIndex = this.matches.length ? 0 : -1;
        this.results.replaceChildren();
        if (!this.matches.length) {
            this.results.appendChild(createElement('div', this.options.native ?
                'sb-ms-empty' : 'list-group-item text-muted',
                'No matching milestones'));
        } else {
            this.matches.forEach(function(milestone, index) {
                var button = createElement('button',
                    picker.options.native ? 'sb-ms-option' :
                        'list-group-item list-group-item-action text-start', null);
                button.type = 'button';
                if (picker.options.native) {
                    button.id = picker.results.id + '-' + index;
                    button.setAttribute('role', 'option');
                }
                var title = createElement('div', picker.options.native ?
                    'sb-ms-title' : 'fw-semibold', milestone.name || 'Milestone');
                var statusText = milestone.status || 'Unknown';
                var status = createElement('span',
                    picker.options.native ? 'sb-ms-status' :
                        'badge ' + statusBadgeClass(statusText) + ' ms-2', statusText);
                if (picker.options.native) status.dataset.status = statusText;
                title.appendChild(status);
                button.appendChild(title);
                var detail = [milestone.number, milestone.opportunity_name, milestone.workload]
                    .filter(Boolean).join(' · ');
                if (detail) button.appendChild(createElement('small', picker.options.native ?
                    'sb-ms-detail' : 'text-muted d-block', detail));
                button.addEventListener('mousedown', function(event) {
                    event.preventDefault();
                    picker.select(milestone);
                });
                button.addEventListener('mouseenter', function() {
                    picker.activeIndex = index;
                    picker.updateActiveResult();
                });
                picker.results.appendChild(button);
            });
        }
        this.results.style.display = 'block';
        if (this.options.native) this.input.setAttribute('aria-expanded', 'true');
        this.updateActiveResult();
    };

    MilestoneMultiPicker.prototype.updateActiveResult = function() {
        var activeIndex = this.activeIndex;
        var picker = this;
        if (this.options.native) this.input.removeAttribute('aria-activedescendant');
        this.results.querySelectorAll('button').forEach(function(button, index) {
            button.classList.toggle('active', index === activeIndex);
            if (picker.options.native) {
                button.setAttribute('aria-selected', String(index === activeIndex));
                if (index === activeIndex) {
                    picker.input.setAttribute('aria-activedescendant', button.id);
                    button.scrollIntoView({block: 'nearest'});
                }
            }
        });
    };

    MilestoneMultiPicker.prototype.closeResults = function() {
        this.results.style.display = 'none';
        if (this.options.native) {
            this.input.setAttribute('aria-expanded', 'false');
            this.input.removeAttribute('aria-activedescendant');
        }
    };

    MilestoneMultiPicker.prototype.select = function(milestone) {
        var key = milestoneKey(milestone);
        if (!key || this.selected.some(function(item) { return milestoneKey(item) === key; })) return;
        this.selected.push(milestone);
        this.input.value = '';
        this.renderSelected();
        this.closeResults();
        this.input.blur();
    };

    MilestoneMultiPicker.prototype.remove = function(key) {
        this.selected = this.selected.filter(function(item) {
            return milestoneKey(item) !== String(key);
        });
        this.renderSelected();
    };

    MilestoneMultiPicker.prototype.renderSelected = function() {
        var picker = this;
        this.selectedContainer.replaceChildren();
        this.selected.forEach(function(milestone) {
            var item = createElement('div', picker.options.native ?
                'sb-ms-selected' : 'card border-success mb-2');
            var body = createElement('div',
                picker.options.native ? 'sb-ms-selected-body' :
                    'card-body d-flex justify-content-between align-items-center py-2 px-3');
            var copy = createElement('div', picker.options.native ? 'sb-ms-copy' : 'me-2');
            var title = createElement('div', picker.options.native ? 'sb-ms-title' : 'fw-semibold');
            var selectedIcon = createElement('i', picker.options.native ?
                'bi bi-check-circle-fill sb-ms-check' : 'bi bi-check-circle-fill text-success me-1');
            title.appendChild(selectedIcon);
            title.appendChild(document.createTextNode(milestone.name || 'Milestone'));
            copy.appendChild(title);
            var detail = [milestone.number, milestone.status, milestone.opportunity_name]
                .filter(Boolean).join(' · ');
            if (detail) copy.appendChild(createElement('small', picker.options.native ?
                'sb-ms-detail' : 'text-muted', detail));
            var remove = createElement('button', picker.options.native ?
                'sb-ms-remove' : 'btn btn-sm btn-outline-danger', null);
            remove.type = 'button';
            remove.setAttribute('aria-label', 'Remove ' + (milestone.name || 'milestone'));
            remove.innerHTML = '<i class="bi bi-x-lg"></i>';
            remove.addEventListener('click', function() {
                picker.remove(milestoneKey(milestone));
            });
            body.appendChild(copy);
            body.appendChild(remove);
            item.appendChild(body);
            picker.selectedContainer.appendChild(item);
        });
        this.options.onSelectionChange?.();
    };

    MilestoneMultiPicker.prototype.getSelectedIds = function() {
        return this.selected.filter(function(milestone) {
            return milestone.local_milestone_id != null;
        }).map(function(milestone) {
            return Number(milestone.local_milestone_id);
        }).filter(function(milestoneId) {
            return Number.isInteger(milestoneId) && milestoneId > 0;
        });
    };

    MilestoneMultiPicker.prototype.getSelectedMilestones = function() {
        return this.selected.slice();
    };

    global.SalesBuddyMilestoneMultiPicker = MilestoneMultiPicker;
})(window);
