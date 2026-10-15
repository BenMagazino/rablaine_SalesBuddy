const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const template = fs.readFileSync('templates/note_form.html', 'utf8');

function topics() {
    const handlers = {}, added = [], pending = [];
    let buttons = [], renders = 0, mouseOver = false, context;
    const input = {value: 'data', offsetWidth: 300,
        addEventListener: (name, callback) => { handlers[name] = callback; }};
    const dropdown = {style: {},
        set innerHTML(html) {
            renders++;
            buttons = [...html.matchAll(/<button[^>]*class="([^"]+)"[\s\S]*?data-topic-index="(\d+)"/g)]
                .map(match => {
                    const classes = new Set(match[1].split(' '));
                    return {classList: {add: value => classes.add(value),
                        remove: value => classes.delete(value),
                        contains: value => classes.has(value)},
                        scrolls: 0, scrollIntoView() { this.scrolls++; }};
                });
            if (mouseOver) context.handleTopicHover(0);
        },
        querySelectorAll: () => buttons,
        querySelector: () => buttons.find(button => button.classList.contains('active')),
    };
    context = {allTopics: Array.from({length: 12}, (_, id) => ({id, name: 'Data ' + id})),
        isTopicSelected: () => false, addTopic: (...args) => added.push(args),
        addPendingTopic: value => pending.push(value),
        document: {getElementById: id => id === 'topic_search' ? input :
            (id === 'topic_dropdown' ? dropdown : {})}};
    vm.runInNewContext(template.slice(template.indexOf('const topicSearch ='),
        template.indexOf('function handleTopicClick(')), context);
    handlers.input.call(input);
    return {added, pending, input, dropdown,
        active: () => buttons.findIndex(button => button.classList.contains('active')),
        button: index => buttons[index], renders: () => renders,
        hover(index) { mouseOver = true; context.handleTopicHover(index); },
        key(key, shiftKey = false) {
            const event = {key, shiftKey, preventDefault() { this.prevented = true; }};
            handlers.keydown.call(input, event);
            return event;
        }};
}

test('topic arrows update the existing rows without mouse hover resetting the selection', () => {
    const h = topics();
    h.hover(0);
    const first = h.button(0), renders = h.renders();
    h.key('ArrowDown');
    assert.equal(h.active(), 1);
    assert.equal(h.button(0), first);
    assert.equal(h.renders(), renders);
    assert.equal(h.button(1).scrolls, 1);
    h.key('ArrowUp');
    assert.equal(h.active(), 0);
});

test('topics support wrapped arrows, Tab selection, Enter and long-list scrolling', () => {
    const h = topics();
    h.key('ArrowUp');
    assert.equal(h.active(), 12);
    assert.equal(h.button(12).scrolls, 1);
    h.key('ArrowDown');
    assert.equal(h.active(), 0);
    h.key('Tab');
    assert.equal(h.active(), 1);
    h.key('Tab', true);
    assert.equal(h.active(), 0);
    for (let i = 0; i < 9; i++) h.key('ArrowDown');
    h.key('Enter');
    assert.deepEqual(h.added, [[9, 'Data 9']]);
    h.key('Escape');
    assert.equal(h.dropdown.style.display, 'none');
});

test('topic create remains reachable without a mouse, and empty Tab is not trapped', () => {
    const h = topics();
    h.key('ArrowUp');
    h.key('Enter');
    assert.deepEqual(h.pending, ['data']);
    h.input.value = '';
    assert.equal(h.key('Tab').prevented, undefined);
});

test('topic hover follows mouse movement, not rows scrolling under a stationary pointer', () => {
    const script = template.slice(template.indexOf('const topicSearch ='),
        template.indexOf('function handleTopicClick('));
    assert.doesNotMatch(script, /onmouseenter=/);
    assert.equal((script.match(/onmousemove="handleTopicHover/g) || []).length, 2);
});

test('attendee keyboard selection cycles results and creation actions and selects with Enter', () => {
    let keydown, renders = 0, selected, clicked = 0;
    const input = {value: 'michael', addEventListener: (_name, callback) => { keydown = callback; }};
    const dropdown = {style: {display: 'block'},
        _filtered: [{type: 'se', id: 1, name: 'Michael A'}, {type: 'se', id: 2, name: 'Michael B'}],
        _addButtons: [{action: 'add-internal'}],
        querySelector: () => ({click() { clicked++; }})};
    const context = {searchInput: input, dropdown, selectedIndex: 0, currentResults: [],
        renderDropdown: () => { renders++; },
        addAttendee: (...args) => { selected = args; }};
    const start = template.indexOf('    function selectCurrent()');
    const movement = template.slice(start, template.indexOf("    searchInput.addEventListener('input'", start));
    const handler = template.slice(template.indexOf("    searchInput.addEventListener('keydown'", start),
        template.indexOf('    // Click on dropdown item', start));
    vm.runInNewContext(movement + handler, context);
    const press = (key, shiftKey = false) => {
        const event = {key, shiftKey, preventDefault() { this.prevented = true; },
            stopPropagation() { this.stopped = true; }};
        keydown.call(input, event);
        return event;
    };
    press('ArrowDown');
    assert.equal(context.selectedIndex, 1);
    assert.equal(press('Enter').stopped, true);
    assert.deepEqual(Array.from(selected), ['se', 2, 'Michael B']);
    press('ArrowDown');
    press('Enter');
    assert.equal(clicked, 1);
    press('Tab');
    assert.equal(context.selectedIndex, 0);
    press('Tab', true);
    assert.equal(context.selectedIndex, 2);
    assert.ok(renders > 0);
    press('Escape');
    assert.equal(dropdown.style.display, 'none');
    assert.equal(input.value, '');
});

test('partner arrows and Tab move focus, Enter selects, and Escape returns to search', () => {
    const handlers = {}, document = {};
    let clicked;
    const input = {value: 'a', addEventListener: (name, callback) => {
        handlers['input:' + name] = callback;
    }, focus() { document.activeElement = input; }};
    const items = Array.from({length: 3}, (_, index) => ({
        focus() { document.activeElement = items[index]; },
        click() { clicked = index; },
    }));
    const dropdown = {style: {display: 'block'}, querySelectorAll: () => items,
        addEventListener: (name, callback) => { handlers['dropdown:' + name] = callback; }};
    document.getElementById = id => id === 'partner_search' ? input :
        (id === 'partner_dropdown' ? dropdown : {});
    const start = template.indexOf('const partnerSearch =');
    vm.runInNewContext(template.slice(start, template.indexOf('function renderPartnerDropdown()', start)),
        {document});
    const press = (target, key, shiftKey = false) => handlers[target + ':keydown']({
        key, shiftKey, preventDefault() {},
    });
    input.focus();
    press('input', 'ArrowDown');
    assert.equal(document.activeElement, items[0]);
    press('dropdown', 'ArrowDown');
    press('dropdown', 'Tab');
    assert.equal(document.activeElement, items[2]);
    press('dropdown', 'Tab', true);
    assert.equal(document.activeElement, items[1]);
    press('dropdown', 'Enter');
    assert.equal(clicked, 1);
    press('dropdown', 'Escape');
    assert.equal(document.activeElement, input);
    assert.equal(dropdown.style.display, 'none');
});
