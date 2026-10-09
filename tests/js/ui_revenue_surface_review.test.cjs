const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('reviewed revenue root widths keep customer bounded and restore bucket/analyzer full width', () => {
    for (const name of ['bucket_products', 'dashboard']) {
        const source = read(`templates/revenue_${name}.html`);
        const root = source.match(/<div class="sb-revenue-workspace[^>]+>/)[0];
        assert.doesNotMatch(root, /sb-directory-frame/);
        assert.match(root, /data-sb-page-surface/);
    }
    const customer = read('templates/revenue_customer_view.html');
    assert.match(customer, /if not request\.args\.get\('embed'\).*sb-directory-frame sb-directory-frame-wide/);
    const seller = read('templates/revenue_seller_alerts.html');
    assert.match(seller, /if not request\.args\.get\('embed'\).*sb-directory-frame sb-directory-frame-wide/);
});

test('reading panes inherit the shell surface, including expanded bucket history', () => {
    for (const [file, selector] of [
        ['bucket', '.sb-revenue-bucket-workarea'],
        ['customer', '.sb-revenue-customer-scroll'],
    ]) {
        const css = read(`static/css/ui-revenue-${file}.css`);
        assert.ok(css.includes(`${selector} { background: var(--sb-ui-surface); }`));
        assert.doesNotMatch(css, /--sb-ui-canvas/);
        assert.doesNotMatch(css, /(?:history-product|history-disclosure|customer-history-area)[^{]*\{[^}]*background:/);
        assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|(?:rgb|oklch)\(/i);
    }
});

test('Analyzer and Seller Alerts share normalized workarea and sticky-header ancestry', () => {
    const css = read('static/css/ui-revenue-detail.css');
    for (const selector of [
        '.sb-page-frame .sb-revenue-workarea > .sb-revenue-alerts',
        '.sb-page-frame .sb-revenue-workarea .sb-revenue-alerts-table thead th',
    ]) {
        const rule = css.split(selector, 2)[1].split('}', 1)[0];
        assert.match(rule, /background: var\(--sb-ui-surface\)/);
        assert.doesNotMatch(rule, /--sb-ui-canvas/);
    }
    assert.doesNotMatch(read('templates/revenue_dashboard.html'),
        /css\/ui-revenue-analyzer\.css/);
    const workbench = read('static/css/ui-revenue-workbench.css');
    assert.doesNotMatch(workbench, /--sb-ui-canvas/);
    assert.match(workbench, /\.sb-revenue-inspector-body \{[^}]*overflow: auto/);
    assert.match(workbench, /background: var\(--sb-ui-selection\)/);
});
