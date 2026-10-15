const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {TextDecoder} = require('node:util');

const template = fs.readFileSync(path.join(__dirname, '../../templates/admin_panel.html'), 'utf8');

function fixture(name, next, stream, {status = 200, readError = false} = {}) {
    const elements = {}, requests = [], listeners = new Set(), timers = [], refreshes = [];
    const shared = [];
    const chunks = Array.from(stream);
    const context = {
        document: {getElementById(id) {
            if (!elements[id]) {
                const classes = new Set(['sb-admin-d-none']);
                elements[id] = {
                    disabled: false, innerHTML: '', textContent: '', style: {}, dataset: {},
                    scrollIntoView() {},
                    querySelector() { return elements[id + 'Error'] ||= {textContent: ''}; },
                    classList: {
                        add: value => classes.add(value),
                        remove: value => classes.delete(value),
                        contains: value => classes.has(value),
                    },
                };
            }
            return elements[id];
        }, querySelector: selector => selector},
        window: {
            addEventListener: name => listeners.add(name),
            removeEventListener: name => listeners.delete(name),
            SBSyncProgress: {create(root, handlers) {
                const entry = {root, handlers, starts: 0};
                shared.push(entry);
                return {start: async () => {
                    entry.starts++;
                    if (readError) throw new Error('Shared panel already reports this error');
                }};
            }},
        },
        fetch: async url => {
            requests.push(url);
            return {
                ok: status < 400, status,
                json: async () => ({success: true}),
                body: {getReader: () => ({
                    async cancel() {},
                    releaseLock() {},
                    async read() {
                        if (readError) throw new Error('Network interrupted');
                        return chunks.length ? {done: false, value: Buffer.from(chunks.shift())} :
                            {done: true};
                    },
                })},
            };
        },
        loadMilestoneSyncStatus: () => refreshes.push('milestones'),
        loadSyncStatus: kind => refreshes.push(kind),
        setTimeout: (callback, delay) => timers.push({callback, delay}),
        TextDecoder,
    };
    const locate = name => template.match(new RegExp(`(?:async )?function ${name}\\(`))?.index ?? -1;
    const start = locate(name);
    const end = locate(next);
    assert.ok(start >= 0 && end > start, 'Extract the actual native sync implementation');
    vm.createContext(context);
    const helper = locate('readAdminSync');
    vm.runInContext(template.slice(helper, template.indexOf('\n}', helper) + 2), context);
    vm.runInContext(template.slice(start, end), context);
    return {elements, requests, listeners, timers, refreshes, shared, run: context[name]};
}

for (const kind of ['Milestone', 'Marketing']) {
    const name = `runAdmin${kind}Sync`;
    const next = kind === 'Milestone' ? 'runAdminMarketingSync' : 'backupAllNotes';
    const operation = kind === 'Milestone' ? 'milestones' : 'marketing';
    test(`${kind} uses the common progress controller and updates status only on completion`, async () => {
        const h = fixture(name, next, '');
        await h.run();
        assert.equal(h.shared.length, 1);
        assert.equal(h.shared[0].root, `[data-sb-sync-progress="${operation}"]`);
        assert.equal(h.shared[0].starts, 1);
        assert.equal(h.refreshes.length, 0);
        h.shared[0].handlers.onComplete({status: 'done'});
        assert.deepEqual(h.refreshes, [operation]);
        assert.equal(h.requests.length, 0);
    });

    test(`${kind} rejected admission cannot run its completion callback`, async () => {
        const h = fixture(name, next, '', {readError: true});
        await h.run();
        assert.equal(h.timers.length, 0);
        assert.equal(h.refreshes.length, 0);
    });
}

const fyProgress = 'data: {"message":"Syncing accounts","progress":67}\n\n';

test('FY native SSE retains backend progress and does not mark incomplete sync as complete', async () => {
    const h = fixture('runFYSync', 'finalizeFY', fyProgress);
    await h.run('2');
    assert.equal(h.elements.fySyncProgressPercent2.textContent, '67%');
    assert.equal(h.elements.fySyncProgressBar2.style.width, '67%');
    assert.equal(h.elements.fySyncProgress2.style.display, 'none');
    assert.match(h.elements.fySyncError2Error.textContent, /ended before completion/);
    assert.deepEqual(h.requests, ['/api/msx/accounts/sync']);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.timers.length, 0);
});

test('FY native SSE restores failure UI and unload guard on backend or network errors', async () => {
    for (const [stream, options, error] of [
        ['data: {"error":"Account sync failed"}\n\n', {}, /Account sync failed/],
        [fyProgress, {readError: true}, /Network interrupted/],
        [fyProgress, {status: 500}, /HTTP 500/],
    ]) {
        const h = fixture('runFYSync', 'finalizeFY', stream, options);
        await h.run('');
        assert.equal(h.elements.fySyncProgress.style.display, 'none');
        assert.match(h.elements.fySyncErrorError.textContent, error);
        assert.equal(h.listeners.size, 0);
        assert.deepEqual(h.requests, ['/api/msx/accounts/sync']);
    }
});

test('FY native SSE preserves successful summary and existing post-sync lifecycle', async () => {
    const h = fixture('runFYSync', 'finalizeFY', fyProgress +
        'data: {"complete":true,"summary":{"customers_created":3}}\n\n');
    await h.run('');
    assert.equal(h.elements.fySyncProgressPercent.textContent, '67%');
    assert.equal(h.elements.fySyncProgress.style.display, 'none');
    assert.match(h.elements.fySyncResults.innerHTML, /Sync Complete/);
    assert.deepEqual(h.requests, [
        '/api/msx/accounts/sync', '/api/admin/fy/sync-complete', '/api/admin/fetch-favicons',
    ]);
    assert.equal(h.listeners.size, 0);
});

test('Admin stream transport contracts are not rewritten as visual class names', () => {
    assert.doesNotMatch(template, /\bdata\.sb-admin-/);
    assert.doesNotMatch(template, /type === 'sb-admin-progress'/);
    const finalize = template.slice(template.indexOf('async function finalizeFY()'));
    assert.ok(finalize.indexOf('if (!syncSummary)') <
        finalize.indexOf("await fetch('/api/admin/fy/sync-complete'"));
});
