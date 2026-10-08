const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const template = fs.readFileSync(path.join(__dirname,
    '../../templates/partials/opportunity_view_content.html'), 'utf8');
const source = template.match(/<script data-sb-opportunity-controller>([\s\S]*?)<\/script>/)[1]
    .replace(/\{\{ opportunity.id \}\}/g, '42')
    .replace(/\{\{ 'true' if opportunity.on_deal_team else 'false' \}\}/g, 'true')
    .replace(/\{% include '_forecast_comments_js.html' %\}/g, '')
    .replace(/\{% (?:if show_header|endif) %\}/g, '')
    .replace(/return \{\r?\n/, 'return {read: fetchMsxDetails, renderDetails, renderError,\n');

function harness() {
    const elements = new Map(), requests = [], alerts = [], children = [], timers = [], events = [];
    class Element {
        constructor(id) { this.id = id; this.style = {}; this.innerHTML = '';
            this.disabled = false; this.dataset = {}; this.attrs = {}; }
        querySelector() { return this.icon ||= {}; }
        closest() { return this.parent ||= new Element(); }
        setAttribute(name, value) { this.attrs[name] = value; }
    }
    const root = {dataset: {sbOpportunityId: '42'},
        dispatchEvent: event => events.push(event.type)};
    const get = id => elements.get(id) || null;
    for (const id of ['detailsSpinner', 'detailsCached', 'detailsMsx', 'detailsError',
        'commentsError', 'opportunityFreshness', 'oppFavoriteBtn', 'leaveDealTeamBtn',
        'joinDealTeamBtn', 'postCommentBtn', 'opportunityLeaveTeamDialog']) {
        elements.set(id, new Element(id));
    }
    elements.get('detailsCached').innerHTML = 'Cached description';
    const document = {
        currentScript: {closest: () => root}, getElementById: get,
        querySelectorAll: () => [], createElement: () => ({
            set textContent(text) { this.innerHTML = String(text).replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;').replaceAll('"', '&quot;'); },
        }),
    };
    let response = {success: false, error: 'Unavailable'}, actions, settings, rendered = 0;
    const fetch = async (url, options) => {
        requests.push({url, options});
        if (response instanceof Error) throw response;
        return {json: async () => response};
    };
    const lifecycle = {attach: (root, initialize, options) => {
        settings = options;
        actions = initialize({document, fetch, setTimeout: callback => timers.push(callback),
            workflow: {openChild: id => children.push(id)}});
    }};
    vm.runInNewContext(source, {
        window: {SBMilestoneWorkflow: lifecycle}, SBMilestoneWorkflow: lifecycle,
        SBDialog: {close: (dialog, reason) => children.push(reason)},
        document, CustomEvent: class {constructor(type) { this.type = type; }},
        renderComments: () => rendered++, renderCommentsError() {},
        alert: message => alerts.push(message), console: {error() {}},
    });
    return {get, actions, requests, alerts, children, timers, events, settings,
        response: value => response = value,
        tick: () => new Promise(resolve => setImmediate(resolve)),
        rendered: () => rendered};
}

test('opportunity uses namespaced shared lifecycle and one automatic read retry', async () => {
    const h = harness();
    assert.equal(h.settings.readingKey, 'opportunity-42');
    assert.equal(h.settings.statusId, 'opportunityPageState');
    await h.tick();
    assert.equal(h.requests[0].url, '/api/opportunity/42/msx-details');
    assert.equal(h.timers.length, 1);
    h.timers.shift()(); await h.tick();
    assert.equal(h.requests.length, 2);
    assert.equal(h.get('detailsSpinner').style.display, 'none');
    assert.match(h.get('detailsError').innerHTML, /Unavailable/);
    assert.equal(h.get('detailsCached').innerHTML, 'Cached description');
    h.response({success: true, opportunity: {number: '7-N', state: 'Open',
        estimated_value: 0, customer_need: '<literal>', description: 'Complete', comments: []}});
    h.actions.read(0); await h.tick();
    assert.equal(h.get('detailsError').style.display, 'none');
    assert.match(h.get('detailsMsx').innerHTML, /\$0/);
    assert.match(h.get('detailsMsx').innerHTML, /&lt;literal&gt;/);
    assert.equal(h.rendered(), 1);
});

test('team writes keep exact payloads, recover both failure modes and update fresh membership', async () => {
    const h = harness(); await h.tick();
    for (const [action, endpoint, button] of [
        ['join', 'join-deal-team', 'joinDealTeamBtn'],
        ['confirmLeave', 'leave-deal-team', 'leaveDealTeamBtn'],
    ]) {
        for (const failure of [{success: false, error: 'Refused'}, new Error('Offline')]) {
            h.response(failure); await h.actions[action]();
            assert.equal(h.get(button).disabled, false);
            const request = h.requests.at(-1);
            assert.equal(request.url, '/api/msx/' + endpoint);
            assert.deepEqual(JSON.parse(request.options.body), {opportunity_id: 42});
        }
        h.response({success: true}); await h.actions[action]();
    }
    h.actions.renderDetails({state: 'Open'});
    assert.match(h.get('detailsMsx').innerHTML, /data-sb-ms-action="join"/);
    h.actions.leave();
    assert.equal(h.children.at(-1), 'opportunityLeaveTeamDialog');
});

test('favorite failures restore the control and success updates its accessible state', async () => {
    const h = harness(); await h.tick();
    for (const failure of [{success: false, error: 'Disk full'}, new Error('Offline')]) {
        h.response(failure); await h.actions.favorite();
        assert.equal(h.get('oppFavoriteBtn').disabled, false);
        assert.equal(h.get('oppFavoriteBtn').attrs['aria-pressed'], undefined);
    }
    h.response({success: true, is_favorited: true}); await h.actions.favorite();
    assert.equal(h.requests.at(-1).url, '/api/opportunity/42/favorite');
    assert.equal(h.get('oppFavoriteBtn').attrs['aria-pressed'], 'true');
    assert.equal(h.get('oppFavoriteBtn').title, 'Remove from favorites');
});

test('failed post-save refresh restores Post without hiding cached data or cache-write errors', async () => {
    const h = harness(); await h.tick();
    h.get('postCommentBtn').disabled = true;
    h.actions.renderError('Refresh failed', false);
    assert.equal(h.get('postCommentBtn').disabled, false);
    assert.match(h.get('postCommentBtn').innerHTML, /Post/);
    h.response({success: true, opportunity: {}, cache_saved: false, cache_error: 'Not cached'});
    h.actions.read(0); await h.tick();
    assert.equal(h.get('detailsError').textContent, 'Not cached');
    assert.equal(h.get('detailsError').attrs.role, 'alert');
});
