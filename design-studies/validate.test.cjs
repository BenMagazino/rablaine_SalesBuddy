/* Dependency-free offline source and privacy checks. PNG provenance needs visual review. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = __dirname;
const read = file => fs.readFileSync(file, 'utf8');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) :
    [path.join(directory, entry.name)]);
const files = walk(root);
const iterations = fs.readdirSync(root).filter(name =>
  fs.statSync(path.join(root, name)).isDirectory() && name.startsWith('ui-'));
const manifest = JSON.parse(read(path.join(root, 'capture-manifest.json')));
const outputs = new Set(manifest.captures.map(item => item.output));
const relative = file => path.relative(root, file).split(path.sep).join('/');
const load = (directory, expression) => {
  const context = vm.createContext({});
  for (const name of ['snapshot.js', 'studies.js', 'themes.js']) {
    if (fs.existsSync(path.join(directory, name))) {
      vm.runInContext(read(path.join(directory, name)), context);
    }
  }
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
};

function resolveLocal(file, url) {
  assert.ok(!/^(?:[a-z]+:|\/\/|\/)/i.test(url), `Nonlocal URL in ${relative(file)}`);
  const resolved = path.resolve(path.dirname(file), decodeURIComponent(url.split(/[?#]/)[0]));
  assert.ok(resolved.startsWith(root + path.sep), `URL leaves archive in ${relative(file)}`);
  assert.ok(fs.existsSync(resolved) || outputs.has(relative(resolved)),
    `Missing local resource: ${relative(resolved)}`);
  return resolved;
}

test('twelve chronological iterations and backlinks on every study HTML page', () => {
  assert.equal(iterations.length, 12);
  const home = read(path.join(root, 'index.html'));
  const chronology = [
    'ui-style-lab', 'ui-style-lab-round-2', 'ui-navigation-lab',
    'ui-color-lab', 'ui-accent-lab', 'ui-outlook-lab', 'ui-status-rails-lab',
    'ui-note-surfaces-lab', 'ui-customer-colors-lab', 'ui-blue-controls-lab',
    'ui-theme-pairs-lab', 'ui-modal-lab'
  ];
  let position = -1;
  for (const folder of chronology) {
    const next = home.indexOf(`href="${folder}/index.html"`);
    assert.ok(next > position, `Missing or unordered iteration: ${folder}`);
    position = next;
  }
  for (const file of files.filter(file => file.endsWith('.html') &&
    path.dirname(file) !== root)) {
    const html = read(file);
    assert.match(html, /<nav class="archive-nav"[^>]*>.*href="\.\.\/index\.html"/);
    assert.match(html, /href="\.\.\/archive\.css"/);
    assert.match(html, /Fictional data only/);
    assert.ok(html.indexOf('class="archive-nav"') < html.indexOf('id="app"') ||
      !html.includes('id="app"'), `Backlink is inside app container: ${relative(file)}`);
  }
  assert.match(read(path.join(root, 'archive.css')), /\.archive-nav\s*\{[^}]*position:\s*fixed/s);
});

test('all static resources stay in the archive and all JavaScript parses', () => {
  for (const file of files) {
    const extension = path.extname(file);
    if (['.html', '.svg', '.css'].includes(extension)) {
      const text = read(file).replace(/\sxmlns(?::\w+)?="[^"]*"/g, '');
      const references = extension === '.css' ?
        [...text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)] :
        [...text.matchAll(/\b(?:src|href|xlink:href)="([^"]+)"/g)];
      for (const [, url] of references) {
        if (!url.startsWith('#')) resolveLocal(file, url);
      }
    }
    if (['.js', '.cjs'].includes(extension)) new vm.Script(read(file), { filename: relative(file) });
    assert.ok(['.html', '.js', '.css', '.svg', '.md', '.json', '.cjs', '.png'].includes(extension),
      `Unreviewed file type: ${relative(file)}`);
    if (extension === '.png') assert.ok(outputs.has(relative(file)), 'Undeclared PNG');
  }
});

test('fictional fixture contract and coherent calendar dates across iterations', () => {
  const labels = /^Fictional Customer \d{2}$/;
  let baseline;
  for (const folder of iterations) {
    const data = load(path.join(root, folder), 'snapshot');
    assert.equal(data.date, 'Tuesday, April 29, 2031');
    assert.equal(new Date(2031, 3, 1).getDay(), 2);
    assert.deepEqual([data.tasks.length, data.milestones.length, data.alerts.length,
      data.events.length], [8, 7, 2,
      ['ui-outlook-lab', 'ui-status-rails-lab', 'ui-note-surfaces-lab',
        'ui-customer-colors-lab', 'ui-blue-controls-lab',
        'ui-theme-pairs-lab', 'ui-modal-lab'].includes(folder) ? 23 : 18]);
    assert.equal(data.engagementCount, 24);
    assert.equal(data.projectCount, 3);
    for (const item of [...data.tasks, ...data.milestones, ...data.events]) {
      assert.match(item.customer, labels);
    }
    for (const item of data.alerts) {
      assert.match(item.title, labels);
      assert.equal(item.customer, 'Sample database review (illustrative)');
    }
    for (const event of data.events) {
      assert.ok(event.day >= 1 && event.day <= 30);
      assert.match(event.time, /^(9|10|11):(15|45) AM$/);
    }
    for (const item of data.milestones) {
      assert.match(item.due, /^May (02|14)$/);
      assert.match(item.value, /^\$[\d,]+\/mo$/);
    }
    const shared = { tasks: data.tasks, milestones: data.milestones, alerts: data.alerts,
      events: data.events.slice(0, 18).map(({ day, customer, time }) => ({ day, customer, time })) };
    if (baseline) assert.deepEqual(shared, baseline);
    baseline = shared;
    const studiesFile = path.join(root, folder, 'studies.js');
    if (fs.existsSync(studiesFile) && read(studiesFile).includes('const menuContent')) {
      const sellers = load(path.join(root, folder), 'menuContent.sellers[1].items');
      assert.equal(sellers.length, 7);
      sellers.forEach((seller, index) => {
        assert.equal(seller.label, `Fictional Seller ${String(index + 1).padStart(2, '0')}`);
        assert.equal(seller.path, `/seller/${101 + index}`);
      });
    }
  }
});

test('latest calendar entries retain relationship markers and precedence', () => {
  for (const folder of ['ui-navigation-lab', 'ui-color-lab', 'ui-accent-lab', 'ui-outlook-lab']) {
    const directory = path.join(root, folder);
    const events = load(directory, 'snapshot.events.slice(0, 18)');
    assert.equal(events.filter(event => event.has_engagement).length, 6);
    assert.equal(events.filter(event => event.has_milestone).length, 1);
    assert.equal(events.filter(event => event.has_task).length, 2);
    assert.equal(events.filter(event => event.has_hva).length, 1);
    assert.equal(events.filter(event => event.unmatched).length, 2);
    const prefix = read(path.join(directory, 'preview.js')).split('const fixtureToday')[0];
    const markers = expression =>
      JSON.parse(vm.runInNewContext(`${prefix}\nJSON.stringify(${expression})`));
    assert.deepEqual(markers("calendarIndicatorIds({kind:'Note',has_hva:true,has_task:true,has_milestone:true,has_engagement:true})"),
      ['hva', 'engagement']);
    assert.deepEqual(markers("calendarIndicatorIds({kind:'Ghost meeting',unmatched:true})"),
      ['ghost', 'unmatched']);
    assert.deepEqual(markers("calendarIndicatorIds({kind:'Note'})"), []);
  }
});

test('tonal iteration retains both foundations and one event hue', () => {
  const directory = path.join(root, 'ui-outlook-lab');
  assert.deepEqual(load(directory, 'themes.map(theme => theme.id)'), ['midnight', 'graphite-blue']);
  for (const file of ['navigation.js', 'navigation.css',
    'calendar-indicators.js', 'styles.css', 'themes.css']) {
    assert.equal(read(path.join(directory, file)), read(path.join(root, 'ui-color-lab', file)));
  }
  const css = read(path.join(directory, 'outlook.css'));
  const levels = [...css.matchAll(/--(?:accent|ghost-fill|ghost-rail|note-fill|note-rail): oklch\(([\d]+)% ([.\d]+) ([\d]+)\)/g)];
  assert.equal(levels.length, 5);
  assert.ok(levels.every(level => level[3] === '250'));
  assert.match(css, /\.saved-note,\s*\.color-study \.saved-note\.has-engagement\s*\{\s*background: var\(--note-fill\)/);
  assert.match(css, /\.ghost-meeting::before/);
  assert.match(css, /repeating-linear-gradient\(\s*135deg,\s*var\(--ghost-rail\) 0 2px,\s*var\(--ghost-fill\) 2px 4px/);
  assert.match(css, /border-left: 3px solid var\(--note-rail\)/);
  assert.doesNotMatch(css, /box-shadow:\s*inset/);
  assert.match(css, /outline: 1px solid var\(--today-outline\)/);
  assert.match(css, /--today-outline: oklch\(60% \.065 250\)/);
  assert.match(css, /outline-offset: -1px/);
  assert.match(css, /--today-bg: color-mix\(in oklch, var\(--surface\) 90%, var\(--accent\)\)/);
  const preview = read(path.join(directory, 'preview.js'));
  assert.doesNotMatch(preview, /<span>Today<\/span>/);
  assert.match(preview, /aria-current="date"/);
  const today = load(directory, 'snapshot.events.filter(event => event.day === 29)');
  assert.equal(today.length, 5);
  assert.equal(today.filter(event => event.kind === 'Ghost meeting' && event.unmatched).length, 1);
  assert.equal(today.filter(event => event.kind === 'Note' && !event.has_engagement).length, 1);
  assert.equal(today.filter(event => event.has_milestone).length, 1);
  assert.equal(today.filter(event => event.has_task && !event.has_hva).length, 1);
  assert.equal(today.filter(event => event.has_hva).length, 1);
});

test('status rails replace work icons without dropping associations', () => {
  const directory = path.join(root, 'ui-status-rails-lab');
  assert.deepEqual(load(directory, 'snapshot.events.filter(event => event.day !== 29)'),
    load(path.join(root, 'ui-outlook-lab'), 'snapshot.events.filter(event => event.day !== 29)'));
  assert.equal(read(path.join(directory, 'outlook.css')),
    read(path.join(root, 'ui-outlook-lab', 'outlook.css')));
  const prefix = read(path.join(directory, 'preview.js')).split('const fixtureToday')[0];
  const context = vm.createContext({});
  vm.runInContext(prefix, context);
  const evaluate = expression => vm.runInContext(expression, context);
  const today = load(directory, 'snapshot.events.filter(event => event.day === 29)');
  assert.deepEqual(today.map(item =>
    evaluate(`calendarRailStatus(${JSON.stringify(item)})`)),
  ['unmatched', 'plain', 'task', 'milestone', 'hva']);
  const cases = [
    [{ kind: 'Note' }, 'plain'],
    [{ kind: 'Note', has_engagement: true }, 'plain'],
    [{ kind: 'Note', has_milestone: true }, 'milestone'],
    [{ kind: 'Note', has_milestone: true, has_task: true }, 'task'],
    [{ kind: 'Note', has_milestone: true, has_task: true, has_hva: true,
      has_engagement: true }, 'hva'],
    [{ kind: 'Ghost meeting' }, 'ghost'],
    [{ kind: 'Ghost meeting', unmatched: true }, 'unmatched']
  ];
  for (const [flags, status] of cases) {
    const item = { time: '11:15 AM', customer: 'Fictional Customer 99', ...flags };
    assert.equal(evaluate(`calendarRailStatus(${JSON.stringify(item)})`), status);
    const html = evaluate(`calendarEventMarkup(${JSON.stringify(item)}, 0)`);
    assert.ok(html.includes(`calendar-status-${status}`));
    assert.doesNotMatch(html, /data-indicator="(?:milestone|task|hva)"/);
    assert.equal(html.includes('data-indicator="unmatched"'), Boolean(flags.unmatched));
    assert.equal(html.includes('data-indicator="engagement"'), Boolean(flags.has_engagement));
    if (flags.has_hva) {
      for (const association of ['Milestone linked', 'MSX task linked', 'HVA task',
        'Engagement linked']) assert.ok(html.includes(association));
    }
    if (flags.unmatched) assert.ok(html.includes('Customer not matched'));
  }
  for (const id of ['milestone', 'task', 'hva']) {
    const legend = evaluate(`calendarIndicatorMarkup('${id}')`);
    assert.ok(legend.includes(`rail-${id}`));
    assert.doesNotMatch(legend, /<svg/);
  }
  assert.match(evaluate("calendarIndicatorMarkup('unmatched')"), /data-indicator="unmatched"/);
  const css = read(path.join(directory, 'status-rails.css'));
  assert.match(css, /\.calendar-status-plain\s*\{\s*--event-rail: var\(--plain-rail\)/);
  assert.doesNotMatch(css, /border-left:\s*0/);
  const railColors = [...css.matchAll(
    /--(plain|milestone|task|hva)-rail: oklch\((\d+)% ([.\d]+) (\d+)\)/g
  )].map(([, name, lightness, chroma, hue]) => {
    const angle = Number(hue) * Math.PI / 180;
    return { name, lab: [Number(lightness) / 100,
      Number(chroma) * Math.cos(angle), Number(chroma) * Math.sin(angle)] };
  });
  assert.equal(railColors.length, 4);
  const milestone = railColors.find(color => color.name === 'milestone');
  const plain = railColors.find(color => color.name === 'plain');
  assert.ok(milestone.lab[0] <= plain.lab[0] + .011,
    'Milestone rail should not look much brighter than plain gray');
  for (let i = 0; i < railColors.length; i++) {
    for (const other of railColors.slice(i + 1)) {
      const distance = Math.hypot(...railColors[i].lab.map(
        (component, index) => component - other.lab[index]
      ));
      assert.ok(distance >= .11, `${railColors[i].name} and ${other.name} rails too similar`);
    }
  }
  assert.match(css, /\.calendar-status-ghost,\s*\.calendar-status-unmatched\s*\{\s*--event-rail: var\(--ghost-rail\)/);
  assert.doesNotMatch(css, /--unmatched-rail/);
});

test('quiet note surfaces preserve fixtures, rails, text, and both base palettes', () => {
  const directory = path.join(root, 'ui-note-surfaces-lab');
  const previous = path.join(root, 'ui-status-rails-lab');
  for (const file of ['snapshot.js', 'status-rails.css', 'themes.css', 'outlook.css',
    'calendar-indicators.js', 'navigation.js', 'styles.css', 'navigation.css']) {
    assert.equal(read(path.join(directory, file)), read(path.join(previous, file)));
  }
  const themes = load(directory, 'themes');
  assert.deepEqual(themes.map(({ palette, surface }) => [palette, surface]),
    [['midnight', 'quiet-blue'], ['midnight', 'neutral'],
      ['graphite-blue', 'quiet-blue'], ['graphite-blue', 'neutral']]);
  const css = read(path.join(directory, 'note-surfaces.css'));
  assert.match(css, /\[data-note-surface="quiet-blue"\]\s*\{\s*--note-fill: oklch\(40% \.065 250\)/);
  assert.match(css, /\[data-note-surface="neutral"\]\s*\{\s*--note-fill: oklch\(32% \.012 250\)/);
  assert.match(css, /\[data-theme="graphite-blue"\]\[data-note-surface="neutral"\]\s*\{\s*--note-fill: oklch\(40% \.012 250\)/);
  assert.match(css, /\.saved-note\.has-engagement:hover/);
  assert.doesNotMatch(css, /--meeting:|--ghost|--today|--(?:task|milestone|plain|hva)-rail/);
  assert.doesNotMatch(css, /font(?:-size|-weight|-family)?:|line-height:|padding:|letter-spacing:/);
  assert.match(read(path.join(directory, 'preview.js')),
    /dataset\.theme = selectedTheme\.palette/);
  assert.match(read(path.join(directory, 'preview.js')),
    /dataset\.noteSurface = selectedTheme\.surface/);
});

test('customer colors follow monthly assignment and share note/ghost identities', () => {
  const directory = path.join(root, 'ui-customer-colors-lab');
  const previous = path.join(root, 'ui-status-rails-lab');
  assert.deepEqual(load(directory, 'snapshot.events.slice(0, 18)'),
    load(previous, 'snapshot.events.slice(0, 18)'));
  assert.equal(read(path.join(directory, 'status-rails.css')),
    read(path.join(previous, 'status-rails.css')));
  const context = vm.createContext({});
  vm.runInContext(read(path.join(directory, 'snapshot.js')), context);
  vm.runInContext(read(path.join(directory, 'customer-colors.js')), context);
  vm.runInContext(read(path.join(directory, 'preview.js')).split('const fixtureToday')[0],
    context);
  const evaluate = expression => vm.runInContext(expression, context);
  const hues = evaluate('JSON.stringify(customerHues)');
  assert.equal(JSON.parse(hues).length, 15);
  const events = load(directory, 'snapshot.events');
  const map = new Map(JSON.parse(evaluate('JSON.stringify([...customerColorMap])')));
  for (const [index, item] of events.entries()) {
    const html = evaluate(`calendarEventMarkup(${JSON.stringify(item)}, ${index})`);
    if (item.unmatched) {
      assert.ok(!map.has(item.customer));
      assert.doesNotMatch(html, /data-customer-key|data-customer-color/);
      assert.match(html, /data-indicator="unmatched"/);
    } else {
      assert.ok(html.includes(`data-customer-color="${map.get(item.customer)}"`));
      assert.ok(html.includes(`data-customer-key="${item.customer}"`));
    }
  }
  const fixture = [
    { day: 1, kind: 'Ghost meeting', customer: 'Fictional Customer 99' },
    ...Array.from({ length: 16 }, (_, index) => ({
      day: index + 1, kind: 'Note', customer: `Fictional Customer ${index}`
    })),
    { day: 1, kind: 'Ghost meeting', customer: 'Fictional Customer 0' },
    { day: 1, kind: 'Ghost meeting', customer: 'Unmatched', unmatched: true },
    { day: 1, kind: 'Note', customer: 'General', is_general: true }
  ];
  const assigned = new Map(JSON.parse(evaluate(
    `JSON.stringify([...buildCustomerColorMap(${JSON.stringify(fixture)})])`)));
  assert.equal(assigned.get('Fictional Customer 0'), 1);
  assert.equal(assigned.get('Fictional Customer 15'), 1);
  assert.equal(assigned.get('Fictional Customer 99'), 2);
  assert.ok(!assigned.has('Unmatched'));
  assert.ok(!assigned.has('General'));
  assert.match(evaluate(`calendarEventMarkup(${JSON.stringify(events[4])})`),
    /indicator-sample/);
  assert.doesNotMatch(evaluate(`calendarEventMarkup(${JSON.stringify(events[4])})`),
    /data-customer-key/);
  assert.match(evaluate(`calendarEventMarkup(${JSON.stringify(events[4])})`),
    /data-customer-color="1"/);
  const css = read(path.join(directory, 'customer-colors.css'));
  const cssHues = [...css.matchAll(/--customer-hue: (\d+)/g)].map(match => Number(match[1]));
  assert.deepEqual(cssHues, JSON.parse(hues));
  assert.doesNotMatch(css, /--today-bg/);
  assert.match(read(path.join(directory, 'outlook.css')),
    /--today-bg: color-mix\(in oklch, var\(--surface\) 90%, var\(--accent\)\)/);
  assert.match(css, /\.saved-note\[data-customer-color\]\.customer-highlight/);
  assert.match(css, /\.ghost-meeting\[data-customer-color\]\.customer-highlight/);
});

test('customer highlighting clears correctly and supports pointer plus keyboard focus', () => {
  class Entry {
    constructor(key) {
      this.dataset = { customerKey: key };
      this.highlighted = false;
      this.classList = {
        toggle: (name, enabled) => {
          assert.equal(name, 'customer-highlight');
          this.highlighted = enabled;
        }
      };
    }
    closest() { return this.dataset.customerKey ? this : null; }
  }
  const entries = [new Entry('A'), new Entry('A'), new Entry('B')];
  const unmatched = new Entry(null);
  const handlers = {};
  const context = vm.createContext({
    Element: Entry,
    document: {
      querySelectorAll: () => entries,
      addEventListener: (type, handler) => { handlers[type] = handler; }
    }
  });
  vm.runInContext(read(path.join(root, 'ui-customer-colors-lab',
    'customer-highlights.js')), context);
  const send = (type, target, relatedTarget = null) =>
    handlers[type]({ target, relatedTarget });
  const states = () => entries.map(entry => entry.highlighted);
  send('pointerover', entries[0]);
  assert.deepEqual(states(), [true, true, false]);
  send('pointerout', entries[0], entries[1]);
  assert.deepEqual(states(), [true, true, false]);
  send('focusin', entries[2]);
  assert.deepEqual(states(), [true, true, true]);
  send('pointerout', entries[0]);
  assert.deepEqual(states(), [false, false, true]);
  send('focusout', entries[2]);
  assert.deepEqual(states(), [false, false, false]);
  send('pointerover', unmatched);
  assert.deepEqual(states(), [false, false, false]);
  entries.push(new Entry('A'));
  send('pointerover', entries[0]);
  assert.deepEqual(states(), [true, true, false, true]);
});

test('blue-control alternatives preserve the approved customer-colored workspace', () => {
  const directory = path.join(root, 'ui-blue-controls-lab');
  const previous = path.join(root, 'ui-customer-colors-lab');
  for (const file of ['snapshot.js', 'status-rails.css', 'themes.css', 'outlook.css',
    'customer-colors.js', 'customer-colors.css', 'customer-highlights.js',
    'calendar-indicators.js', 'navigation.js', 'styles.css', 'navigation.css']) {
    assert.equal(read(path.join(directory, file)), read(path.join(previous, file)));
  }
  const themes = load(directory, 'themes');
  assert.deepEqual(themes.map(({ palette, control }) => [palette, control]),
    [['midnight', 'muted'], ['midnight', 'outline'], ['midnight', 'ink'],
      ['graphite-blue', 'muted'], ['graphite-blue', 'outline'], ['graphite-blue', 'ink']]);
  const css = read(path.join(directory, 'blue-controls.css'));
  assert.doesNotMatch(css,
    /--(?:accent|today-bg|customer[\w-]*|ghost[\w-]*|note-fill)\s*:|font-|padding:|height:/);
  for (const control of ['muted', 'outline', 'ink']) {
    assert.ok(css.includes(`[data-blue-control="${control}"]`));
  }
  assert.match(css, /\.new-note:hover/);
  assert.match(css, /\.today \.day-label > button:first-child:hover/);
  assert.match(css, /\.new-note:focus-visible/);
  assert.match(css, /box-shadow: inset 0 -2px 0 var\(--control-ink\)/);
  const preview = read(path.join(directory, 'preview.js'));
  assert.match(preview, /dataset\.theme = selectedTheme\.palette/);
  assert.match(preview, /dataset\.blueControl = selectedTheme\.control/);
});

test('four theme pairs preserve the default and translate light-mode semantics', () => {
  const directory = path.join(root, 'ui-theme-pairs-lab');
  const previous = path.join(root, 'ui-blue-controls-lab');
  for (const file of ['snapshot.js', 'styles.css', 'navigation.css', 'navigation.js',
    'themes.css', 'outlook.css', 'status-rails.css', 'blue-controls.css',
    'customer-colors.js', 'customer-colors.css', 'customer-highlights.js',
    'calendar-indicators.js']) {
    assert.equal(read(path.join(directory, file)), read(path.join(previous, file)));
  }
  const themes = load(directory, 'themes');
  assert.deepEqual(themes.map(theme => theme.id),
    ['graphite-dark', 'graphite-light', 'midnight-dark', 'midnight-light',
      'harbor-dark', 'harbor-light', 'carbon-dark', 'carbon-light']);
  assert.ok(themes.every(theme => theme.control === 'muted' &&
    theme.palette === 'graphite-blue'));
  const css = read(path.join(directory, 'theme-pairs.css'));
  assert.doesNotMatch(css, /\[data-family="graphite"\]\[data-mode="dark"\]/);
  assert.match(css, /\[data-mode="light"\] \[data-customer-color\]/);
  for (const token of ['customer-fill', 'customer-hover', 'customer-ghost-fill',
    'customer-ghost-hover', 'customer-outline', 'milestone-rail', 'task-rail',
    'hva-rail', 'plain-rail', 'danger', 'warning']) {
    assert.ok(css.includes(`--${token}:`), `Missing mode translation: ${token}`);
  }
  const preview = read(path.join(directory, 'preview.js'));
  assert.match(preview, /dataset\.mode = selectedTheme\.mode/);
  assert.match(preview, /dataset\.family = selectedTheme\.family/);
  assert.match(preview, /item\.mode === selectedTheme\.mode/);
  assert.match(preview, /aria-label="Switch to \$\{mode\} mode"/);
});

test('centered modal studies preserve the approved themes and workspace', () => {
  const directory = path.join(root, 'ui-modal-lab');
  const previous = path.join(root, 'ui-theme-pairs-lab');
  for (const file of ['snapshot.js', 'styles.css', 'navigation.css', 'navigation.js',
    'studies.js', 'themes.js', 'themes.css', 'theme-pairs.css', 'outlook.css',
    'status-rails.css', 'blue-controls.css', 'customer-colors.js',
    'customer-colors.css', 'customer-highlights.js', 'calendar-indicators.js']) {
    assert.equal(read(path.join(directory, file)), read(path.join(previous, file)), file);
  }
  const html = read(path.join(directory, 'preview.html'));
  assert.match(html, /<dialog id="detail" aria-labelledby="detail-title">/);
  assert.match(html, /src="modal-examples.js"/);
  const css = read(path.join(directory, 'modals.css'));
  assert.match(css, /inset: 0;\s*margin: auto/);
  assert.match(css, /max-height: calc\(100vh - 96px\)/);
  assert.match(css, /\.modal-scroll[^}]*overflow-y: auto/s);
  const preview = read(path.join(directory, 'preview.js'));
  assert.match(preview, /if \(!detail.open\) detail.showModal\(\)/);
  assert.match(preview, /class="modal-header"/);
  assert.match(preview, /class="modal-footer"/);
});

test('action modal edits preserve all fields without mutating shared fixtures', () => {
  const handlers = {};
  let rendered;
  const feedback = {};
  const context = vm.createContext({
    params: { get: () => null }, detail: { addEventListener() {} },
    icon: () => '', escapeHtml: value => String(value).replaceAll('<', '&lt;'),
    openDetail: (title, body, category, options) => {
      rendered = { title, body, category, options };
    },
    document: {
      querySelector: () => feedback,
      addEventListener: (type, callback) => { handlers[type] = callback; }
    },
    FormData: class { constructor(target) { this.data = target.data; }
      get(key) { return this.data[key]; } }
  });
  vm.runInContext(read(path.join(root, 'ui-modal-lab', 'modal-examples.js')), context);
  const original = { title: 'Sample action', customer: 'Fictional Customer 01' };
  context.modalActionItem(original);
  handlers.change({ target: { matches: () => true, checked: true } });
  handlers.click({ target: { closest: () => ({ dataset: { modalAction: 'edit' } }) } });
  assert.match(rendered.body, /name="due" value="2031-05-02"/);
  handlers.submit({ target: { id: 'action-edit-form', data: {
    title: '<New title>', description: '', due: '2031-05-14',
    priority: 'High', contact: 'Fictional Attendee 03'
  } }, preventDefault() {} });
  assert.equal(rendered.title, '<New title>');
  assert.match(rendered.body, /May 14, 2031/);
  assert.match(rendered.body, /High/);
  assert.match(rendered.body, /Fictional Attendee 03/);
  assert.match(rendered.body, /No description added/);
  assert.match(rendered.options.footer, /data-modal-completed checked/);
  context.modalActionItem(vm.runInContext('previewAction', context), true);
  assert.match(rendered.body, /&lt;New title>/);
  assert.match(rendered.body, /name="due" value="2031-05-14"/);
  assert.match(rendered.body, /High'?\s*selected|selected[^>]*>High/);
  assert.match(rendered.body, /name="contact"[^>]*value="Fictional Attendee 03"/);
  assert.deepEqual(original, { title: 'Sample action', customer: 'Fictional Customer 01' });
  const alerts = load(path.join(root, 'ui-modal-lab'), 'snapshot.alerts');
  for (const alert of alerts) {
    context.modalEntryDetails('alerts', alert);
    assert.ok(rendered.body.includes(alert.kind));
    assert.ok(!rendered.body.includes('undefined'));
  }
});

test('all grouped navigation menus consistently label directory and overview links', () => {
  let checked = 0;
  for (const folder of iterations) {
    const directory = path.join(root, folder);
    const source = path.join(directory, 'studies.js');
    if (!fs.existsSync(source) || !read(source).includes('const menuContent')) continue;
    const menu = load(directory, 'menuContent');
    assert.equal(menu.sellers[0].group, 'DIRECTORY', folder);
    assert.deepEqual(menu.sellers[0].items,
      [{ label: 'All Sellers', path: '/sellers', symbol: 'people' }]);
    assert.equal(menu.reports[0].group, 'OVERVIEW', folder);
    assert.deepEqual(menu.reports[0].items,
      [{ label: 'All Reports', path: '/reports', symbol: 'reports' }]);
    checked++;
  }
  assert.equal(checked, 10);
  assert.doesNotMatch(read(path.join(root, 'ui-theme-pairs-lab', 'preview.js')),
    /menuContent\.(?:sellers|reports)\[0\]\.group\s*=/);
});

test('archive controls stay expanded and HVA wording is consistent', () => {
  const css = read(path.join(root, 'archive.css'));
  assert.doesNotMatch(css, /\.archive-nav(?::hover|:focus-within)/);
  assert.doesNotMatch(css, /\.archive-nav\s*>\s*a[^}]*display:\s*none/);
  for (const file of files.filter(file => ['.html', '.js', '.md'].includes(path.extname(file)))) {
    assert.doesNotMatch(read(file), /HoK\s*\/\s*HVA/);
  }
});

test('capture manifest covers generated gallery images in every state', () => {
  const referenced = new Set();
  for (const folder of iterations) {
    const directory = path.join(root, folder);
    const context = vm.createContext({});
    for (const name of ['snapshot.js', 'studies.js', 'themes.js']) {
      if (fs.existsSync(path.join(directory, name))) {
        vm.runInContext(read(path.join(directory, name)), context);
      }
    }
    const container = { innerHTML: '' };
    const controls = [...read(path.join(directory, 'index.html'))
      .matchAll(/data-state="([^"]+)"/g)].map(([, state]) => ({
      dataset: { state }, setAttribute() {}, addEventListener(type, callback) { this.click = callback; }
    }));
    const images = [];
    const links = [];
    context.document = {
      querySelector: () => container,
      querySelectorAll: selector => selector === '[data-state]' ? controls :
        selector === '.study-image img' ? images :
          selector === '.open-menu-link' ? links : []
    };
    vm.runInContext(read(path.join(directory, 'gallery.js')), context);
    for (const match of container.innerHTML.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)) {
      const tag = match[0];
      const id = /data-(?:style|theme-id)="([^"]+)"/.exec(tag)?.[1];
      images.push({ src: match[1], dataset: { style: id, themeId: id },
        closest: () => ({ href: '', querySelector: () => ({ href: '' }) }) });
      referenced.add(`${folder}/${match[1]}`);
    }
    for (const match of container.innerHTML.matchAll(/<a\b[^>]*class="open-menu-link"[^>]*>/g)) {
      const id = /data-theme-id="([^"]+)"/.exec(match[0])?.[1];
      links.push({ dataset: { themeId: id } });
    }
    for (const control of controls.filter(control => control.click)) {
      control.click();
      for (const image of images) referenced.add(`${folder}/${image.src}`);
    }
  }
  assert.deepEqual([...outputs].sort(), [...referenced].sort());
  assert.equal(manifest.captures.length, outputs.size, 'Duplicate output paths');
  for (const capture of manifest.captures) {
    assert.match(capture.output, /^ui-[\w-]+\/[\w-]+\.png$/);
    const file = resolveLocal(path.join(root, 'index.html'), capture.url);
    assert.equal(path.basename(file), 'preview.html');
    const params = new URLSearchParams(capture.url.split('?')[1]);
    const directory = path.dirname(file);
    const themes = fs.existsSync(path.join(directory, 'themes.js'));
    const catalog = load(directory, themes ? 'themes' :
      path.basename(directory) === 'ui-style-lab' ? 'concepts' : 'studies');
    assert.ok(catalog.some(item => item.id === params.get(themes ? 'theme' : 'style')));
    assert.ok(!params.has('menu') || ['reports', 'browse'].includes(params.get('menu')));
    assert.ok(!params.has('modal') ||
      (path.basename(directory) === 'ui-modal-lab' &&
        ['action', 'milestone', 'note'].includes(params.get('modal'))));
    if (process.env.ARCHIVE_REQUIRE_SCREENSHOTS === '1') {
      const image = fs.readFileSync(path.join(root, capture.output));
      assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Not a PNG');
    }
  }
});

test('no private paths, emails, external resources, network calls, or provenance claims', () => {
  for (const file of files.filter(file => ['.html', '.js', '.css', '.svg'].includes(path.extname(file)))) {
    const text = read(file).replace(/\sxmlns(?::\w+)?="http:\/\/www\.w3\.org\/[^"]*"/g, '');
    const hazards = [
      /\bhttps?:\/\//i, /(?:file:\/\/|[a-z]:\\|session-state|\.copilot)/i,
      /[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}/i,
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/,
      /@import\b/i, /(?:<metadata|<foreignObject|<image\b)/i,
      /(?:original\.png|real action items|live home page|real note\/ghost|dev site's|real destinations)/i
    ];
    for (const hazard of hazards) {
      assert.ok(!hazard.test(text), `Privacy/offline hazard (${hazard}) in ${relative(file)}`);
    }
  }
});

test('optional private-source comparison leaves no original sensitive text', {
  skip: !process.env.ARCHIVE_SOURCE_ROOT
}, () => {
  const archive = files.filter(file => path.extname(file) !== '.png')
    .map(read).join('\n').toLowerCase();
  for (const folder of iterations) {
    const sourceFolder = ['ui-outlook-lab', 'ui-status-rails-lab',
      'ui-note-surfaces-lab', 'ui-customer-colors-lab',
      'ui-blue-controls-lab', 'ui-theme-pairs-lab', 'ui-modal-lab'].includes(folder) ?
      'ui-color-lab' : folder;
    const directory = path.join(process.env.ARCHIVE_SOURCE_ROOT, sourceFolder);
    const original = load(directory, 'snapshot');
    const sanitized = load(path.join(root, folder), 'snapshot');
    const sensitive = [...original.tasks, ...original.milestones, ...original.events]
      .map(item => item.customer).concat(original.alerts.map(item => item.title));
    sensitive.push(...original.tasks.map(item => item.title),
      ...original.milestones.filter(item => item.title.length > 15).map(item => item.title),
      ...original.alerts.map(item => item.value));
    const studies = path.join(directory, 'studies.js');
    if (fs.existsSync(studies) && read(studies).includes('const menuContent')) {
      sensitive.push(...load(directory, 'menuContent.sellers[1].items').map(item => item.label));
    }
    sensitive.forEach((value, index) => {
      assert.ok(!archive.includes(value.toLowerCase()),
        `Original sensitive string #${index + 1} remains in ${folder}`);
    });
    assert.notEqual(original.date, sanitized.date);
    assert.notEqual(original.engagementCount, sanitized.engagementCount);
    assert.notEqual(original.projectCount, sanitized.projectCount);
    for (const group of ['tasks', 'milestones', 'alerts']) {
      original[group].forEach((item, index) => {
        assert.notEqual(item.title, sanitized[group][index].title);
        if (item.value) assert.notEqual(item.value, sanitized[group][index].value);
        if (item.due) assert.notEqual(item.due, sanitized[group][index].due);
      });
    }
    const flags = ['kind', 'has_engagement', 'has_task', 'has_hva', 'has_milestone', 'unmatched'];
    original.events.forEach((event, index) => {
      assert.notEqual(event.time, sanitized.events[index].time);
      for (const flag of flags) assert.equal(sanitized.events[index][flag], event[flag]);
    });
  }
});
