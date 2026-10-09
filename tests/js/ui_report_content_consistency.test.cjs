const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('actual paired Workload and Product regions use the guarded 1344px frame', () => {
    for (const name of ['report_workload', 'revenue_products_list', 'revenue_product_view']) {
        const source = read(`templates/${name}.html`);
        const root = source.match(/<(?:section|div) class="[^"]*sb-directory-frame[^>]+>/)[0];
        assert.match(root, /if not (?:embedded|request\.args\.get\('embed'\))/);
        assert.match(root, /sb-directory-frame sb-directory-frame-wide/);
    }
    assert.match(read('templates/revenue_seller_products.html'),
        /extends "revenue_products_list\.html"/);
    const sellerDetail = read('templates/revenue_seller_product_view.html');
    assert.match(sellerDetail, /sb-directory-frame/);
    assert.doesNotMatch(sellerDetail, /sb-directory-frame-wide/);
});

test('paired reading tracks grow with their root instead of retaining an obsolete inner cap', () => {
    assert.match(read('static/css/ui-workload.css'),
        /grid-template-columns: 340px minmax\(0, 1fr\)/);
    assert.match(read('static/css/ui-revenue-products.css'),
        /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.2fr\)/);
    const product = read('static/css/ui-revenue-product.css');
    assert.match(product, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    assert.match(product,
        /\.sb-revenue-product\[data-sb-product-enhanced="true"\] :is\(\.sb-product-history, \.sb-product-members\) \{ max-width: none; \}/);
});

test('Product reading, loaded inspector and sticky headers use shared surface ancestry', () => {
    for (const name of ['product', 'products', 'seller-product']) {
        const source = read(`static/css/ui-revenue-${name}.css`);
        assert.doesNotMatch(source, /--sb-ui-canvas/);
        assert.match(source, /background: var\(--sb-ui-surface\)/);
        assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|(?:rgb|oklch)\(/i);
    }
    assert.match(read('static/css/ui-revenue-products.css'),
        /\.sb-products-inspector \{[^}]*background: var\(--sb-ui-surface\)/);
    assert.match(read('static/css/ui-revenue-product.css'),
        /\.sb-product-history \.sb-revenue-products-header \{[^}]*background: var\(--sb-ui-surface\)/);
});
