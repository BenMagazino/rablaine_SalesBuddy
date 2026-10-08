const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../templates/_forecast_comments_js.html'),
    'utf8').replace(/\{#[\s\S]*?#\}/g, '');
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const decode = value => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');

function harness(native, cached = []) {
    const elements = new Map(), requests = [], alerts = [], refreshes = [];
    const document = {
        activeElement: null,
        getElementById: id => elements.get(id) || null,
        querySelector: selector => selector === '#commentFormCached textarea' ? cachedTextarea : null,
        querySelectorAll: selector => selector.endsWith('.comment-time') ? [] :
            selector.endsWith('.comment-text') ? cached.map(item => item.text) : [],
    };
    class Element {
        constructor(id) {
            this.id = id; this.style = {}; this.dataset = {}; this.listeners = new Map();
            this.children = []; this.controls = []; this.actions = []; this.value = '';
            this.defaultValue = '';
            this.disabled = false; this._html = '';
        }
        set innerHTML(html) {
            this._html = html;
            this.controls = []; this.actions = [];
            for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
                const element = new Element(match[2]);
                elements.set(element.id, element);
                if (match[1] === 'textarea') {
                    const tail = html.slice(match.index + match[0].length);
                    element.value = decode(tail.slice(0, tail.indexOf('</textarea>')));
                } else if (match[1] === 'button') {
                    this.controls.push(element);
                }
            }
            for (const match of html.matchAll(/<button\b[^>]*data-action="([^"]+)"[^>]*data-idx="(\d+)"[^>]*>/g)) {
                const button = new Element();
                button.dataset = {action: match[1], idx: match[2]};
                this.actions.push(button);
            }
        }
        get innerHTML() { return this._html; }
        querySelectorAll(selector) {
            return selector === 'button' ? this.controls :
                this.actions.filter(button => selector.includes('"' + button.dataset.action + '"'));
        }
        querySelector(selector) {
            if (selector === 'table') return this._html.includes('<table') ? {} : null;
            const match = new RegExp('<' + selector + '[^>]*>([\\s\\S]*)</' + selector + '>').exec(this._html);
            return match ? {innerHTML: match[1], textContent: decode(match[1])} : null;
        }
        appendChild(child) {
            this.children = this.children.filter(item => item !== child);
            this.children.push(child);
        }
        addEventListener(type, handler) { this.listeners.set(type, handler); }
        focus() { document.activeElement = this; }
    }
    for (const id of ['commentsSpinner', 'commentsCached', 'commentFormCached', 'commentsMsx',
        'commentCount', 'commentsError', 'cachedCommentsList']) elements.set(id, new Element(id));
    const cachedTextarea = new Element('cachedTextarea');
    const cachedList = elements.get('cachedCommentsList');
    cachedList.children = cached.map(item => ({dataset: {modified: item.modifiedOn}}));
    const context = vm.createContext({
        document, escapeHtml, COMMENT_ENTITY_ID: 42,
        COMMENT_API_PREFIX: native === true ? '/api/milestone' : '/api/opportunity',
        COMMENT_ENTITY_LABEL: native === true ? 'milestone' : 'opportunity',
        ...(native ? {COMMENT_WORKBENCH: true} : {}),
        fetch: async (url, options) => {
            requests.push({url, options});
            if (response instanceof Error) throw response;
            return {json: async () => response};
        },
        fetchMsxDetails: value => refreshes.push(value),
        alert: message => alerts.push(message), confirm: () => confirmed,
    });
    let response = {success: true}, confirmed = true;
    vm.runInContext(source, context);
    const api = vm.runInContext('({renderComments, renderCommentsError, postComment, ' +
        'startEditComment, saveEditComment, deleteComment, formatCommentTimestamp})', context);
    return {api, elements, cachedTextarea, cachedList, document, requests, alerts, refreshes,
        respond(value) { response = value; }, confirm(value) { confirmed = value; },
        body(value) {
            const element = new Element('comment-body-0');
            elements.set(element.id, element); element.innerHTML = value;
            return element;
        },
        tick: () => new Promise(resolve => setImmediate(resolve))};
}

for (const native of [false, true, 'opportunity']) {
    const label = native === true ? 'native milestone' : native ? 'native opportunity' : 'legacy opportunity';
    test(`${label}: fresh comments keep sorting, escaping, tables, ref links and handlers`, () => {
        const h = harness(native);
        const comments = [
            {comment: '<script>plain</script> · note-12 ·', displayName: '<Owner>',
                modifiedOn: '2026-10-01T12:00:00Z', userId: 'one'},
            {comment: '<table><tr><td>Plan · eng-9 ·</td></tr></table>',
                modifiedOn: '2026-10-02T12:00:00Z', userId: 'two'},
        ];
        h.api.renderComments({comments});
        const html = h.elements.get('commentsMsx').innerHTML;
        assert.ok(html.indexOf('Plan') < html.indexOf('&lt;script&gt;'));
        assert.ok(html.includes('&lt;Owner&gt;'));
        assert.ok(html.includes('<table><tr><td>Plan'));
        assert.ok(html.includes('href="/note/12"'));
        assert.ok(html.includes('href="/engagement/9"'));
        assert.ok(html.includes(native ? 'sb-comment-item' : 'list-group-item'));
        assert.equal(html.includes('aria-label="Edit forecast comment"'), Boolean(native));
        assert.equal(html.includes('aria-label="Delete forecast comment"'), Boolean(native));
        assert.equal(/\b(card|list-group-item|btn-primary|form-control)\b/.test(html), !native);
        assert.equal(h.elements.get('commentCount').textContent, '2 comments');
        assert.ok(h.elements.get('commentFormMsx').listeners.has('submit'));
        assert.equal(h.elements.get('commentsMsx').actions.filter(b => b.listeners.has('click')).length, 4);
        assert.equal(comments[0].userId, 'one');
        assert.equal(h.elements.get('commentsCached').style.display, 'none');
    });

    test(`${label}: cached and fresh drafts retain focus while zero comments remains usable`, () => {
        const h = harness(native);
        h.cachedTextarea.value = 'cached draft'; h.cachedTextarea.focus();
        h.api.renderComments({comments: []});
        assert.equal(h.document.activeElement.value, 'cached draft');
        assert.equal(h.cachedTextarea.value, '');
        h.document.activeElement.value = 'fresh draft';
        h.api.renderComments({comments: []});
        assert.equal(h.document.activeElement.value, 'fresh draft');
        assert.equal(h.document.activeElement.selectionEnd, 11);
        assert.ok(h.elements.get('commentsMsx').innerHTML.includes('No forecast comments yet'));
        assert.equal(h.elements.get('commentCount').textContent, '0 comments');
    });

    test(`${label}: posting retains payload, refresh and clear-after-success semantics`, async () => {
        const h = harness(native);
        h.api.renderComments({comments: []});
        h.elements.get('commentText').value = '  post this  ';
        let prevented = false;
        h.api.postComment({preventDefault() { prevented = true; }});
        await h.tick();
        assert.equal(prevented, true);
        assert.equal(h.requests[0].url, native === true ? '/api/milestone/42/comment' : '/api/opportunity/42/comment');
        assert.equal(h.requests[0].options.method, 'POST');
        assert.deepEqual(JSON.parse(h.requests[0].options.body), {comment: 'post this'});
        assert.deepEqual(h.refreshes, [0]);
        h.api.renderComments({comments: []});
        assert.equal(h.elements.get('commentText').value, '');
    });

    test(`${label}: plain and table editing keep cancel, shortcuts and PUT identifiers`, async () => {
        const h = harness(native);
        let body = h.body('<p>Original &lt;plain&gt;</p>');
        h.api.startEditComment(0, 'modified', 'owner');
        assert.equal(h.elements.get('editText-0').value, 'Original <plain>');
        assert.ok(body.innerHTML.includes(native ? 'sb-record-field' : 'form-control'));
        h.elements.get('cancelEdit-0').listeners.get('click')();
        assert.equal(body.innerHTML, '<p>Original &lt;plain&gt;</p>');
        body = h.body('<div><table><tr><td>Plan</td></tr></table></div>');
        h.api.startEditComment(0, 'modified', 'owner');
        assert.equal(h.elements.get('editText-0').value, '<table><tr><td>Plan</td></tr></table>');
        h.elements.get('editText-0').value = 'Updated';
        let prevented = false;
        h.elements.get('editText-0').listeners.get('keydown')({
            ctrlKey: true, key: 'Enter', preventDefault() { prevented = true; },
        });
        await h.tick();
        assert.equal(prevented, true);
        assert.equal(h.requests[0].options.method, 'PUT');
        assert.deepEqual(JSON.parse(h.requests[0].options.body),
            {modifiedOn: 'modified', userId: 'owner', comment: 'Updated'});
        assert.deepEqual(h.refreshes, [0]);
    });

    test(`${label}: delete cancellation, DELETE payload and explicit failures remain`, async () => {
        const h = harness(native);
        h.api.renderComments({comments: []});
        const button = h.elements.get('postCommentBtn');
        h.confirm(false); h.api.deleteComment('modified', 'owner', button);
        assert.equal(h.requests.length, 0);
        h.confirm(true); h.respond({success: false, error: 'Write refused'});
        h.api.deleteComment('modified', 'owner', button);
        await h.tick();
        assert.equal(h.requests[0].options.method, 'DELETE');
        assert.deepEqual(JSON.parse(h.requests[0].options.body),
            {modifiedOn: 'modified', userId: 'owner'});
        assert.match(h.alerts[0], /Write refused/);
        assert.equal(button.disabled, false);
    });

    test(`${label}: a rejected edit keeps text and restores the Save caption`, async () => {
        const h = harness(native);
        h.body('<p>Original</p>');
        h.api.startEditComment(0, 'modified', 'owner');
        const button = h.elements.get('saveEdit-0');
        button.innerHTML = '<i class="bi bi-check"></i> Save';
        h.elements.get('editText-0').value = 'Retain this draft';
        h.respond({success: false, error: 'Write refused'});
        h.api.saveEditComment(0, 'modified', 'owner');
        await h.tick();
        assert.match(h.alerts[0], /Write refused/);
        assert.equal(button.disabled, false);
        assert.equal(button.innerHTML, '<i class="bi bi-check"></i> Save');
        assert.equal(h.elements.get('editText-0').value, 'Retain this draft');
    });

    test(`${label}: post refusal and network failure retain drafts and allow explicit retry`, async () => {
        const h = harness(native);
        h.api.renderComments({comments: []});
        const field = h.elements.get('commentText'), button = h.elements.get('postCommentBtn');
        field.value = 'Keep my comment';
        for (const failure of [{success: false, error: 'Rejected'}, new Error('Offline')]) {
            h.respond(failure);
            h.api.postComment({preventDefault() {}});
            await h.tick();
            assert.equal(field.value, 'Keep my comment');
            assert.equal(button.disabled, false);
        }
        assert.equal(h.refreshes.length, 0);
        h.respond({success: true});
        h.api.postComment({preventDefault() {}});
        await h.tick();
        assert.deepEqual(h.refreshes, [0]);
    });

    test(`${label}: edit and delete network failures restore controls for retry`, async () => {
        const h = harness(native);
        h.body('<p>Original</p>');
        h.api.startEditComment(0, 'modified', 'owner');
        h.elements.get('editText-0').value = 'Retained edit';
        h.respond(new Error('Offline'));
        h.api.saveEditComment(0, 'modified', 'owner');
        await h.tick();
        assert.equal(h.elements.get('editText-0').value, 'Retained edit');
        assert.equal(h.elements.get('saveEdit-0').disabled, false);
        const button = h.elements.get('saveEdit-0');
        h.api.deleteComment('modified', 'owner', button);
        await h.tick();
        assert.equal(button.disabled, false);
        h.respond({success: true});
        h.api.saveEditComment(0, 'modified', 'owner');
        await h.tick();
        h.api.deleteComment('modified', 'owner', button);
        await h.tick();
        assert.deepEqual(h.refreshes, [0, 0]);
    });

    test(`${label}: cache stays readable through errors and uncached failures stay explicit`, () => {
        const h = harness(native);
        h.elements.get('commentsCached').style.display = '';
        h.elements.get('commentsCached').innerHTML = '<p>Cached comment</p>';
        h.api.renderCommentsError('Failed <read>', false);
        assert.equal(h.elements.get('commentsError').innerHTML, '');
        h.elements.get('commentsCached').style.display = 'none';
        h.api.renderCommentsError('Failed <read>', false);
        assert.match(h.elements.get('commentsError').innerHTML, /Failed &lt;read&gt;/);
        assert.ok(h.elements.get('commentsError').innerHTML.includes(native ? 'sb-ms-error' : 'alert alert-warning'));
        h.api.renderCommentsError('VPN', true);
        assert.match(h.elements.get('commentsError').innerHTML, /VPN Required/);
        assert.equal(h.elements.get('commentsSpinner').style.display, 'none');
    });
}

test('cached comments retain descending order and native reference links before fresh reads', () => {
    const text = {innerHTML: '· note-7 ·'};
    const h = harness(true, [{modifiedOn: '2026-10-01', text}, {modifiedOn: '2026-10-03', text}]);
    assert.deepEqual(h.cachedList.children.map(item => item.dataset.modified), ['2026-10-03', '2026-10-01']);
    assert.ok(text.innerHTML.includes('class="sb-ms-ref"'));
});

test('fresh milestone status is literal DOM data, not an interpolated HTML attribute', () => {
    const partial = fs.readFileSync(path.join(__dirname,
        '../../templates/partials/milestone_view_content.html'), 'utf8');
    const render = partial.slice(partial.indexOf('function renderDetails(ms)'),
        partial.indexOf('function renderError(errorMsg'));
    const row = {style: {}}, value = {replaceChildren: child => { value.child = child; }};
    const elements = {statusRow: row, statusValue: value,
        detailsError: {style: {}}, commentsError: {style: {}}};
    const events = [];
    const context = vm.createContext({
        root: {dispatchEvent: event => events.push(event)},
        CustomEvent: class { constructor(type) { this.type = type; } },
        document: {
        getElementById: id => elements[id] || null,
        createElement: () => ({dataset: {}}),
    }});
    vm.runInContext(render, context);
    const status = 'Unexpected "status" <literal>';
    context.renderDetails({msx_status: status});
    assert.equal(value.child.textContent, status);
    assert.equal(value.child.dataset.status, status);
    assert.equal(value.child.className, 'sb-record-tag');
    assert.equal(row.style.display, '');
    assert.equal(events[0].type, 'sb:record-state');
});
