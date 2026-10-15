const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(
    path.join(__dirname, '../../static/js/ui-fabric-import.js'), 'utf8');

function fixture() {
    const nodes = Object.fromEntries(['import', 'progress'].map(key => [key, {
        textContent: '', events: {},
        addEventListener(event, handler) { this.events[event] = handler; },
    }]));
    const panel = {}, mounts = [];
    let starts = 0, reloads = 0, startError = null;
    const context = {window: {SBSyncProgress: {
        create(root, handlers) {
            mounts.push({root, handlers});
            return {start: async () => {
                starts++;
                if (startError) throw startError;
            }};
        },
    }}};
    vm.runInNewContext(source, context);
    const controller = context.window.SBFabricImport.create({
        querySelector: selector => selector === '[data-sb-sync-progress="fabric"]' ?
            panel : nodes[selector.slice(13, -1)],
    }, async () => { reloads++; });
    return {nodes, panel, mounts, controller, starts: () => starts, reloads: () => reloads,
        failStart: error => { startError = error; }};
}

test('both Fabric views mount their shared observer without admitting an import or reloading', () => {
    const h = fixture();
    assert.equal(h.mounts.length, 1);
    assert.equal(h.mounts[0].root, h.panel);
    assert.equal(h.starts(), 0);
    assert.equal(h.reloads(), 0);
    assert.equal(h.nodes.progress.textContent, 'No successful import yet');
});

test('the import command delegates admission to the common controller', async () => {
    const h = fixture();
    await h.nodes.import.events.click();
    assert.equal(h.starts(), 1);
    assert.equal(h.reloads(), 0);
});

test('an observed terminal completion refreshes the current report or customer tab', async () => {
    const h = fixture();
    await h.mounts[0].handlers.onComplete({status: 'done'});
    assert.equal(h.reloads(), 1);
});

test('the snapshot caption remains the last successful import date, not attempt telemetry', () => {
    const h = fixture();
    h.controller.setImportedAt('2026-10-09T22:15:53Z');
    assert.equal(h.nodes.progress.textContent, 'Last successful import: ' +
        new Date('2026-10-09T22:15:53Z').toLocaleDateString());
    assert.equal(h.nodes.progress.title, h.nodes.progress.textContent);
    assert.throws(() => h.controller.setImportedAt('invalid'), /timestamp is invalid/);
    h.controller.setImportedAt(null);
    assert.equal(h.nodes.progress.textContent, 'No successful import yet');
});

test('shared-controller admission errors never reload a successful-looking snapshot', async () => {
    const h = fixture();
    h.failStart(new Error('Already reported by the shared progress panel'));
    h.nodes.import.events.click();
    await new Promise(setImmediate);
    assert.equal(h.starts(), 1);
    assert.equal(h.reloads(), 0);
});
