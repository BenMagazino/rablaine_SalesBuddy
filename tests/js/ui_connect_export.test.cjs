const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const template = fs.readFileSync(path.join(__dirname, '../../templates/connect_export.html'), 'utf8');
const source = template.match(/<script>([\s\S]*?)<\/script>/)[1];

function fixture() {
    const requests = [], errors = [], elements = new Map();
    function field(id) {
        if (!elements.has(id)) elements.set(id, {
            disabled: false, innerHTML: '', textContent: '', style: {},
            scrollIntoView() {}, remove() { this.removed = true; },
        });
        return elements.get(id);
    }
    const context = vm.createContext({
        document: {getElementById: field},
        history: {state: {}, replaceState(value) { this.state = value; }},
        alert: text => errors.push(text),
        confirm: () => true,
        setTimeout() {},
        requestAnimationFrame() {},
        fetch: url => new Promise(resolve => requests.push({url, resolve})),
    });
    vm.runInContext(source, context);
    const payload = id => ({
        success: true, export_id: id, json_export: {}, markdown_export: 'Markdown',
        text_export: 'Text', summary: {
            total_notes: id, unique_customers: 1, unique_topics: 0,
            total_milestone_revenue: 0, topics: [],
        },
    });
    const reply = (index, data, ok = true) =>
        requests[index].resolve({ok, json: async () => data});
    return {context, requests, errors, field, payload, reply};
}

test('latest selected export wins even when prior read finishes later', async () => {
    const h = fixture();
    const older = h.context.viewExport(1);
    const newer = h.context.viewExport(2);
    h.reply(1, h.payload(2));
    await newer;
    h.reply(0, h.payload(1));
    await older;
    assert.equal(h.field('summaryNotes').textContent, 2);
    assert.equal(h.context.history.state.sbConnectExport, 2);
});

test('stale failed view never interrupts a newer selection', async () => {
    const h = fixture();
    const older = h.context.viewExport(1);
    const newer = h.context.viewExport(2);
    h.reply(1, h.payload(2));
    await newer;
    h.reply(0, {success: false, error: 'Older record missing'}, false);
    await older;
    assert.deepEqual(h.errors, []);
});

test('pending AI gates duplicates and cannot replace a newly selected export', async () => {
    const h = fixture();
    h.context.renderExportResults(h.payload(1));
    const pending = h.context.generateAiSummary();
    await h.context.generateAiSummary();
    assert.equal(h.requests.length, 1);
    assert.equal(h.field('aiGenerateBtn').disabled, true);
    h.context.renderExportResults(h.payload(2));
    assert.equal(h.field('aiGenerateBtn').disabled, false);
    h.reply(0, {success: true, ai_summary: 'Older AI response'});
    await pending;
    assert.equal(h.context.history.state.sbConnectExport, 2);
    assert.equal(h.field('aiSummaryCard').style.display, 'none');
    assert.equal(h.field('aiGenerateBtn').disabled, false);
});

test('failed AI generation exposes the error and releases the retry command', async () => {
    const h = fixture();
    h.context.renderExportResults(h.payload(1));
    const pending = h.context.generateAiSummary();
    h.reply(0, {success: false, error: 'AI unavailable'}, false);
    await pending;
    assert.equal(h.field('aiErrorState').style.display, 'block');
    assert.equal(h.field('aiErrorMessage').textContent, 'AI unavailable');
    assert.equal(h.field('aiGenerateBtn').disabled, false);
});

test('failed export generation retains form fields and releases its pending gate', async () => {
    const h = fixture();
    h.field('exportName').value = 'Unsaved export name';
    h.field('startDate').value = '2026-07-01';
    h.field('endDate').value = '2026-09-30';
    const pending = h.context.generateExport({preventDefault() {}});
    await h.context.generateExport({preventDefault() {}});
    assert.equal(h.requests.length, 1);
    h.reply(0, {success: false, error: 'Export unavailable'}, false);
    await pending;
    assert.equal(h.field('exportName').value, 'Unsaved export name');
    assert.equal(h.field('startDate').value, '2026-07-01');
    assert.equal(h.field('endDate').value, '2026-09-30');
    assert.equal(h.field('generateBtn').disabled, false);
    assert.deepEqual(h.errors, ['Export unavailable']);
});

test('deleting the selected record clears stale Back state but retains available downloads', async () => {
    const h = fixture();
    h.context.renderExportResults(h.payload(1));
    h.context.history.state.unrelated = 'retained';
    const pending = h.context.deleteExport(1);
    h.reply(0, {success: true});
    await pending;
    assert.equal(h.field('exportRow1').removed, true);
    assert.equal(Object.hasOwn(h.context.history.state, 'sbConnectExport'), false);
    assert.equal(h.context.history.state.unrelated, 'retained');
    assert.equal(vm.runInContext('currentMarkdownExport', h.context), 'Markdown');
});
