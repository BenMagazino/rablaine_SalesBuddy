const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-consumption.js'), 'utf8');
const renderer = source.slice(source.indexOf('    function renderChart('),
    source.indexOf('    function renderCapacity('));

function fixture(values, interactive = false) {
    const children = [];
    const container = {
        replaceChildren() {}, append(child) { children.push(child); },
        hasAttribute: () => interactive,
    };
    function element(tag) {
        return {
            tag, attributes: {}, children: [], style: {}, events: {},
            setAttribute(key, value) { this.attributes[key] = String(value); },
            append(...items) { this.children.push(...items); },
            addEventListener(name, handler) { this.events[name] = handler; },
            matches() { return this.open; },
            showPopover() { this.open = true; },
            hidePopover() { this.open = false; },
            getBoundingClientRect: () => ({width: 220, height: 36}),
            getScreenCTM: () => ({inverse: () => ({})}),
            createSVGPoint() {
                return {matrixTransform() { return {x: this.x, y: this.y}; }};
            },
        };
    }
    const context = {
        document: {
            createElementNS: (_, tag) => element(tag),
        },
        textElement: (tag, text) => Object.assign(element(tag), {textContent: text}),
        percent: value => `${value}%`,
        innerWidth: 1000, innerHeight: 800,
        container,
        points: values.map((value, i) => ({
            utilization_pct: value, time: `2026-10-10T0${i}:00:00Z`,
        })),
    };
    vm.runInNewContext(`${renderer}\nrenderChart(points, container);`, context);
    return {svg: children[0], readout: children[1], context};
}

for (const peak of [90, 200]) {
    test(`80% scale-up and 100% references use the actual utilization scale with peak ${peak}`, () => {
        const {svg} = fixture([10, null, peak]);
        const max = Math.max(100, peak);
        for (const [threshold, className] of [[80, 'series-scale-up'], [100, 'series-limit']]) {
            const line = svg.children.find(child => child.attributes.class === className);
            assert.equal(Number(line.attributes.y1), 164 - threshold / max * 144);
            assert.equal(line.attributes.y1, line.attributes.y2);
            assert.equal(line.attributes.x1, '55');
            assert.equal(line.attributes.x2, '735');
            assert.ok(svg.children.some(child => child.tag === 'text' &&
                child.textContent === `${threshold}%`));
        }

        assert.match(svg.children[0].textContent, /80% scale-up threshold/);
        assert.equal(svg.children.filter(child => child.tag === 'polyline').length, 2);
    });
}

test('pointer inspection reports nearest saved UTC hour, actual percentage, and missing data', () => {
    const {svg, readout} = fixture([10, null, 200], true);
    const marker = svg.children.find(child => child.attributes.class === 'series-point');
    const cursor = svg.children.find(child => child.attributes.class === 'series-cursor');
    svg.events.pointermove({clientX: 730, clientY: 60});
    assert.match(readout.textContent, /UTC \/ 200%$/);
    assert.equal(marker.attributes.cx, '735');
    assert.equal(marker.attributes.cy, '20');
    svg.events.pointermove({clientX: 400, clientY: 60});
    assert.match(readout.textContent, /UTC \/ No utilization measurement$/);
    assert.equal(marker.style.display, 'none');
    assert.equal(cursor.attributes.x1, '395');
    svg.events.pointermove({clientX: 55, clientY: 60});
    assert.match(readout.textContent, /UTC \/ 10%$/);
    svg.events.pointerleave();
    assert.equal(cursor.style.display, 'none');
    assert.equal(readout.open, false);
});

test('keyboard inspection supports navigation and dismissal without changing capacity', () => {
    const {svg, readout} = fixture([10, null, 200], true);
    svg.events.focus();
    assert.match(readout.textContent, /10%$/);
    let prevented = 0;
    const key = value => svg.events.keydown({
        key: value, preventDefault() { prevented++; },
    });
    key('ArrowRight');
    assert.match(readout.textContent, /No utilization measurement$/);
    key('End');
    assert.match(readout.textContent, /200%$/);
    key('ArrowRight');
    assert.match(readout.textContent, /200%$/);
    key('Home');
    assert.match(readout.textContent, /10%$/);
    key('ArrowLeft');
    assert.match(readout.textContent, /10%$/);
    key('Escape');
    assert.equal(readout.open, false);
    assert.equal(prevented, 6);
    assert.equal(svg.attributes.tabindex, '0');
});
