const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-capacity-label.js'), 'utf8');

function fixture({left = 500, averageRight = 790, width = 1751} = {}) {
    const elements = [];
    const triggers = [];
    const documentEvents = {};
    class Element {
        constructor() {
            this.style = {};
            this.attributes = {};
            this.events = {};
            this.classes = new Set();
            this.classList = {
                contains: name => this.classes.has(name),
                toggle: (name, enabled) => enabled ?
                    this.classes.add(name) : this.classes.delete(name),
            };
            elements.push(this);
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; }
        addEventListener(name, handler) { this.events[name] = handler; }
        append(...children) { this.children = [...(this.children ?? []), ...children]; }
        replaceChildren(...children) { this.children = children; }
        showPopover() { this.open = true; }
        hidePopover() { this.open = false; }
        matches(selector) { return selector === ':popover-open' && this.open; }
        closest() { return {querySelectorAll: () => triggers}; }
        getBoundingClientRect() {
            if (this.rect) return this.rect;
            const x = parseFloat(this.style.left) || 0;
            const w = parseFloat(this.style.width) || 390;
            return {left: x, right: x + w, width: w, height: 254};
        }
    }
    const context = {
        document: {
            body: {append() {}},
            createElement: () => new Element(),
            createTextNode: text => ({textContent: text}),
            addEventListener: (name, handler) => { documentEvents[name] = handler; },
        },
        window: {addEventListener() {}},
        innerWidth: width, innerHeight: 1000, clearTimeout() {}, setTimeout() {},
    };
    vm.runInNewContext(source, context);
    const popup = elements[0];
    for (let row = 0; row < 3; row++) {
        for (const chart of [null, () => {}]) {
            const button = context.window.SBFabricCapacityLabel.create(
                {sku: 'F64', utilization_pct: row}, row + 1, 3, 'Customer', chart);
            button.rect = {
                left: chart ? averageRight - 50 : left,
                right: chart ? averageRight : left + 28,
                top: 700 + row * 30,
            };
            triggers.push(button);
        }
    }
    return {popup, triggers, context, documentEvents};
}

function assertClearTargets(h) {
    const p = h.popup.getBoundingClientRect();
    assert.ok(p.left >= 8);
    assert.ok(p.right <= h.context.innerWidth - 8);
    for (const b of h.triggers) {
        const r = b.rect;
        assert.ok(p.right <= r.left || p.left >= r.right, 'Hover column is covered');
    }
}

test('successive identity and graph previews anchor to their own trigger on opposite sides', () => {
    const h = fixture();
    for (let i = 0; i < h.triggers.length; i++) {
        const b = h.triggers[i];
        b.events.pointerenter();
        assert.equal(h.popup.open, true);
        assert.match(h.popup.children[0].textContent, new RegExp(`Capacity ${1 + Math.floor(i / 2)} of 3`));
        const p = h.popup.getBoundingClientRect();
        assert.equal(i % 2 ? p.left - b.rect.right : b.rect.left - p.right, 12);
        assertClearTargets(h);
    }
    h.documentEvents.keydown({key: 'Escape'});
    assert.equal(h.popup.open, false);
    assert.equal(h.triggers.at(-1).attributes['aria-describedby'], undefined);
});

test('identity previews switch right near the left edge without covering either column', () => {
    const h = fixture({left: 100, averageRight: 300});
    h.triggers[0].events.focus();
    assert.equal(h.popup.getBoundingClientRect().left, 312);
    assertClearTargets(h);
});

test('graph previews switch left near the right edge without covering either column', () => {
    const h = fixture({left: 700, averageRight: 940, width: 1000});
    h.triggers[1].events.pointerenter();
    assert.equal(h.popup.getBoundingClientRect().right, 688);
    assertClearTargets(h);
});

test('seller line appears directly below the heading, with an explicit unassigned state', () => {
    const h = fixture();
    h.triggers[0].events.pointerenter();
    assert.equal(h.popup.children[1].textContent, 'No seller assigned');
    const seller = h.context.window.SBFabricCapacityLabel.create(
        {sku: 'F64'}, 1, 3, 'Customer', null, {id: 7, name: 'Assigned seller'});
    seller.rect = h.triggers[0].rect;
    seller.events.pointerenter();
    assert.equal(h.popup.children[1].className, 'sb-fabric-popup-seller');
    assert.equal(h.popup.children[1].children[0].children[1].textContent, ' Assigned seller');
});
