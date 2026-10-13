const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootPath = path.join(__dirname, '..', '..');
const script = fs.readFileSync(path.join(rootPath, 'static/js/ui-theme.js'), 'utf8');
const css = fs.readFileSync(path.join(rootPath, 'static/css/ui-tokens.css'), 'utf8');

function startTheme(mode, osDark = false) {
    const attributes = new Map(mode === null ? [] : [['data-bs-theme', mode]]);
    const errors = [];
    let callback;
    let observation;
    const root = {
        getAttribute: name => attributes.get(name) ?? null,
        setAttribute: (name, value) => attributes.set(name, value),
    };
    vm.runInNewContext(script, {
        document: {documentElement: root},
        window: {matchMedia: () => ({matches: osDark})},
        console: {error: (...args) => errors.push(args)},
        MutationObserver: class {
            constructor(handler) { callback = handler; }
            observe(target, options) { observation = {target, options}; }
        },
    });
    return {attributes, errors, root, observation, sync: () => callback()};
}

test('saved light/dark mode wins over the OS without changing legacy preference', () => {
    for (const mode of ['light', 'dark']) {
        const result = startTheme(mode, mode === 'light');
        assert.equal(result.attributes.get('data-sb-mode'), mode);
        assert.equal(result.attributes.get('data-bs-theme'), mode);
        assert.equal(result.errors.length, 0);
    }
});

test('unset first-launch mode uses the OS without persisting a new preference', () => {
    for (const osDark of [false, true]) {
        const result = startTheme(null, osDark);
        assert.equal(result.attributes.get('data-sb-mode'), osDark ? 'dark' : 'light');
        assert.equal(result.attributes.has('data-bs-theme'), false);
    }
});

test('existing menu, onboarding and preferences changes update the new mode', () => {
    const result = startTheme('dark');
    result.attributes.set('data-bs-theme', 'light');
    result.sync();
    assert.equal(result.attributes.get('data-sb-mode'), 'light');
    result.attributes.set('data-bs-theme', 'dark');
    result.sync();
    assert.equal(result.attributes.get('data-sb-mode'), 'dark');
    assert.equal(result.observation.target, result.root);
    assert.equal(result.observation.options.attributes, true);
    assert.deepEqual(Array.from(result.observation.options.attributeFilter), ['data-bs-theme']);
});

test('invalid mode logs an error and does not overwrite the last valid mode', () => {
    const result = startTheme('dark');
    result.attributes.set('data-bs-theme', 'invalid');
    result.sync();
    assert.equal(result.attributes.get('data-sb-mode'), 'dark');
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0][0], /invalid legacy mode/);
    assert.equal(result.errors[0][1], 'invalid');
});

test('tokens are isolated from legacy CSS and do not restyle existing components', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
    assert.ok(rules.length > 0);
    for (const [, selector, declarations] of rules) {
        assert.match(selector.replace(/\/\*[\s\S]*?\*\//g, '').trim(), /^:root/);
        for (const declaration of declarations.split(';').filter(value => value.trim())) {
            assert.match(declaration.trim(), /^--sb-ui-[a-z0-9-]+:/);
        }
    }
    assert.doesNotMatch(css, /--bs-|data-bs-|!important/);
});

test('base loads the bridge synchronously before the tokens and defaults to Graphite', () => {
    const template = fs.readFileSync(path.join(rootPath, 'templates/base.html'), 'utf8');
    const bridge = template.match(/<script[^>]+js\/ui-theme\.js[^>]*>/)[0];
    assert.doesNotMatch(bridge, /\b(?:async|defer)\b/);
    assert.ok(template.indexOf('js/ui-theme.js') < template.indexOf('css/ui-tokens.css'));
    assert.match(template, /data-sb-family="{{ theme_family\|default\('graphite'\) }}"/);
    assert.ok(template.indexOf('js/ui-theme.js') > template.indexOf('osPrefersDark'));
});

function matchesTokenSelector(selector, attributes) {
    let rejected = false;
    let remaining = selector.replace(/:not\(([^)]+)\)/g, (_match, inner) => {
        if (matchesTokenSelector(inner, attributes)) rejected = true;
        return '';
    });
    remaining = remaining.replace(/\[([\w-]+)(?:="([^"]+)")?\]/g, (_match, name, value) => {
        if (!(name in attributes) || (value !== undefined && attributes[name] !== value)) {
            rejected = true;
        }
        return '';
    });
    return !rejected && /^(?::root|body|\.[\w-]+)*$/.test(remaining.trim());
}

function getTokens(source, attributes) {
    const tokens = {};
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selectors, declarations] of withoutComments.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
        if (!selectors.split(',').some(selector => matchesTokenSelector(selector, attributes))) {
            continue;
        }
        for (const [, name, value] of declarations.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
            tokens[name] = value.trim();
        }
    }
    return tokens;
}

function resolveToken(tokens, name) {
    assert.ok(name in tokens, `Missing token ${name}`);
    return tokens[name].replace(/var\((--[\w-]+)\)/g, (_match, reference) =>
        resolveToken(tokens, reference)).replace(/\s/g, '');
}

test('shared note/milestone tag blends use Cartesian OKLab to keep topic borders yellow', () => {
    const noteCSS = fs.readFileSync(path.join(rootPath, 'static/css/ui-note.css'), 'utf8');
    assert.match(noteCSS,
        /border: 1px solid color-mix\(in oklab, var\(--sb-record-tag-ink\) 40%, var\(--sb-ui-line\)\)/);
    assert.match(noteCSS,
        /background: color-mix\(in oklab, var\(--sb-record-tag-ink\) 10%, var\(--sb-ui-context\)\)/);
    function lab(value) {
        const channels = value.match(/^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/);
        assert.ok(channels, `Invalid OKLCH token: ${value}`);
        const [l, c, h] = channels.slice(1).map(Number);
        return [l / 100, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180)];
    }
    for (const family of ['graphite', 'midnight', 'harbor', 'carbon']) {
        for (const mode of ['dark', 'light']) {
            const tokens = getTokens(css, {'data-sb-family': family, 'data-sb-mode': mode});
            const ink = lab(tokens['--sb-ui-warning']);
            const line = lab(tokens['--sb-ui-line']);
            const hue = Math.atan2(.4 * ink[2] + .6 * line[2],
                .4 * ink[1] + .6 * line[1]) * 180 / Math.PI;
            const inkHue = Math.atan2(ink[2], ink[1]) * 180 / Math.PI;
            assert.ok(Math.abs(hue - inkHue) < 25, `${family}-${mode}: topic border hue ${hue}`);
        }
    }
});

test('all eight production palettes preserve all 37 approved foundation colors exactly', () => {
    const archive = path.join(rootPath, 'design-studies/ui-theme-pairs-lab');
    const source = ['themes.css', 'outlook.css', 'status-rails.css',
        'blue-controls.css', 'theme-pairs.css']
        .map(file => fs.readFileSync(path.join(archive, file), 'utf8')).join('\n');
    const names = ['canvas', 'surface', 'header', 'context', 'raised', 'line', 'grid-line',
        'weekend', 'popup', 'ink', 'muted', 'accent', 'control-line', 'divider', 'selection',
        'today-outline', 'meeting', 'ghost', 'ghost-fill', 'ghost-rail', 'note-fill',
        'note-rail', 'event-hover', 'plain-rail', 'task-rail', 'milestone-rail', 'hva-rail',
        'warning', 'danger', 'warning-bg', 'danger-bg', 'control-fill', 'control-hover',
        'control-ink', 'control-edge', 'today-bg', 'status-bg'];
    for (const family of ['graphite', 'midnight', 'harbor', 'carbon']) {
        for (const mode of ['dark', 'light']) {
            const expected = getTokens(source, {'data-theme': 'graphite-blue',
                'data-blue-control': 'muted', 'data-family': family, 'data-mode': mode});
            const actual = getTokens(css, {'data-sb-family': family, 'data-sb-mode': mode});
            for (const name of names) {
                assert.equal(resolveToken(actual, '--sb-ui-' + name),
                    resolveToken(expected, '--' + name), `${family}-${mode}: ${name}`);
            }
        }
    }
});
