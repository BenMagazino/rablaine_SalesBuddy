const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10H5V10"/><path d="M9 20v-7h6v7"/>',
  notes: '<path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',
  reports: '<path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M13 14h2M7 17h2"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  flag: '<path d="M5 21V3l14 1v9L5 12"/>',
  arrow: '<path d="M4 12h16m-5-5 5 5-5 5"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1-1 2M12 17h.01"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  alert: '<path d="m12 3 10 17H2zM12 9v4M12 16v1"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  building: '<path d="M4 21V5h16v16M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  chat: '<path d="M3 4h18v13H9l-6 4zM7 8h10M7 12h7"/>',
  tag: '<path d="m3 3 8 0 10 10-8 8L3 11z"/><circle cx="7" cy="7" r="1"/>',
  link: '<path d="m8 14 8-8M9 7l2-2a5 5 0 0 1 7 7l-2 2M15 17l-2 2a5 5 0 0 1-7-7l2-2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>',
  engagement: '<rect x="9" y="2" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/><path d="M12 8v4H5v4M12 12h7v4"/>',
  repeat: '<path d="M4 11a8 8 0 0 1 14-5l2 2M20 3v5h-5M20 13A8 8 0 0 1 6 19l-2-2M4 22v-5h5"/>'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const calendarIndicators = {
  ghost: { label: 'Ghost meeting', symbol: 'calendar',
    description: 'A cached Outlook meeting with no saved note. Matched ghosts share their customer hue; dashed outlines and striped rails distinguish them from saved notes.',
    example: { kind: 'Ghost meeting' } },
  milestone: { label: 'Milestone', symbol: 'flag',
    description: 'A green rail identifies a milestone-linked note. Task or HVA rail colors take precedence when present.',
    example: { kind: 'Note', has_milestone: true } },
  task: { label: 'MSX task', symbol: 'check',
    description: 'A blue rail identifies a linked MSX task. This is not the local Action Items checkbox.',
    example: { kind: 'Note', has_task: true } },
  hva: { label: 'HVA', symbol: 'star',
    description: 'A gold rail identifies a task marked HVA. Gold takes precedence over task blue and milestone green.',
    example: { kind: 'Note', has_task: true, has_hva: true } },
  engagement: { label: 'Engagement', symbol: 'engagement',
    description: 'A linked engagement, shown as a secondary marker. It can accompany a note, milestone, MSX task, or HVA marker.',
    example: { kind: 'Note', has_engagement: true } },
  unmatched: { label: 'Unmatched customer', symbol: 'help',
    description: 'A question mark identifies a ghost meeting without a matched customer. It keeps an unassigned blue striped rail instead of a customer hue. In the app, creating its note starts by choosing a customer.',
    example: { kind: 'Ghost meeting', unmatched: true, customer: 'Unmatched meeting' } },
  recurring: { label: 'Recurring meeting', symbol: 'repeat' }
};

function calendarIndicatorIds(item) {
  if (item.kind === 'Ghost meeting') {
    return ['ghost', ...(item.unmatched ? ['unmatched'] : []),
      ...(item.recurring ? ['recurring'] : [])];
  }
  const primary = item.has_hva ? 'hva' : item.has_task ? 'task' :
    item.has_milestone ? 'milestone' : null;
  return [...(primary ? [primary] : []),
    ...(item.has_engagement ? ['engagement'] : [])];
}

function calendarEventSummary(item) {
  if (item.kind === 'Ghost meeting') {
    return ['Ghost meeting, no note yet', ...(item.unmatched ? ['Customer not matched'] : []),
      ...(item.recurring ? ['Recurring meeting'] : [])].join(' / ');
  }
  return [item.is_general ? 'General note created' : 'Note created',
    ...(item.has_milestone ? ['Milestone linked'] : []),
    ...(item.has_task ? ['MSX task linked'] : []),
    ...(item.has_hva ? ['HVA task'] : []),
    ...(item.has_engagement ? ['Engagement linked'] : [])].join(' / ');
}

function calendarIndicatorMarkup(id) {
  const marker = calendarIndicators[id];
  if (['milestone', 'task', 'hva'].includes(id)) {
    return `<span class="rail-swatch rail-${id}" aria-hidden="true" title="${escapeHtml(marker.label)}"></span>`;
  }
  return `<span class="event-indicator indicator-${id}" data-indicator="${id}" title="${escapeHtml(marker.label)}">${icon(marker.symbol)}</span>`;
}

function calendarRailStatus(item) {
  if (item.kind === 'Ghost meeting') return item.unmatched ? 'unmatched' : 'ghost';
  return item.has_hva ? 'hva' : item.has_task ? 'task' :
    item.has_milestone ? 'milestone' : 'plain';
}

function calendarEventMarkup(item, index = null) {
  const markers = calendarIndicatorIds(item).filter((id) =>
    !['milestone', 'task', 'hva'].includes(id));
  const primary = markers.find((id) => id !== 'engagement');
  const secondary = markers.filter((id) => id !== primary);
  const summary = `${item.time} / ${item.customer} / ${calendarEventSummary(item)}`;
  const contents = `${primary ? calendarIndicatorMarkup(primary) : ''}<span class="event-time">${escapeHtml(item.time)}</span><strong>${escapeHtml(item.customer)}</strong>${secondary.length ? `<span class="event-markers">${secondary.map(calendarIndicatorMarkup).join('')}</span>` : ''}`;
  const classes = `event calendar-event calendar-status-${calendarRailStatus(item)} ${item.kind === 'Ghost meeting' ? 'ghost-meeting' : 'saved-note'} ${item.has_engagement ? 'has-engagement' : ''}`;
  if (index === null) {
    return `<div class="${classes} indicator-sample"${customerColorAttributes(item, index)} aria-label="${escapeHtml(summary)}">${contents}</div>`;
  }
  return `<button class="${classes} searchable"${customerColorAttributes(item, index)} data-detail="events" data-index="${index}" data-search="${escapeHtml(item.customer)}" title="${escapeHtml(summary)}" aria-label="${escapeHtml(summary)}">${contents}</button>`;
}

function calendarLegend() {
  return `<div class="calendar-key" aria-label="Calendar indicator legend">${['ghost', 'unmatched', 'milestone', 'task', 'hva', 'engagement'].map((id) => `<button class="legend-indicator" data-legend-indicator="${id}" aria-label="${escapeHtml(calendarIndicators[id].label)}: show indicator example">${calendarIndicatorMarkup(id)}<span>${calendarIndicators[id].label}</span></button>`).join('')}</div>`;
}
const fixtureToday = new Date(2031, 3, 29);
let displayedMonth = new Date(2031, 3, 1);

function isFixtureMonth() {
  return displayedMonth.getFullYear() === fixtureToday.getFullYear() &&
    displayedMonth.getMonth() === fixtureToday.getMonth();
}

function calendarDateLabel(day) {
  return new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), Number(day))
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calendarDayEvents(day) {
  return isFixtureMonth() ? snapshot.events.filter((item) => item.day === day) : [];
}

function monthHeading() {
  return `${displayedMonth.toLocaleDateString('en-US', { month: 'long' })} <span>${displayedMonth.getFullYear()}</span>`;
}

function calendarCaption() {
  return isFixtureMonth() ? 'Markers can combine' : 'Preview only / no fictional activity';
}
const params = new URLSearchParams(location.search);
const study = studies.find((item) => item.id === 'top-icons');
const selectedTheme = themes.find((item) => item.id === params.get('theme')) || themes[0];
document.body.className = `navigation-study color-study blue-controls theme-pairs modal-study ${study.id} placement-${study.placement} labels-${study.labels}`;
document.body.dataset.theme = selectedTheme.palette;
document.body.dataset.blueControl = selectedTheme.control;
document.body.dataset.family = selectedTheme.family;
document.body.dataset.mode = selectedTheme.mode;
document.title = `${selectedTheme.name} | Sales Buddy modal study`;

function homeLogo() {
  return `<a class="home-logo" href="preview.html?theme=${selectedTheme.id}" aria-label="Sales Buddy home" title="Home"><img src="brand.svg" alt=""></a>`;
}

function searchField() {
  return `<label class="search">${icon('search')}<span class="sr-only">Search fictional workspace entries</span><input id="search" placeholder="Search customers and activity" autocomplete="off"><kbd>/</kbd></label>`;
}

function navigation() {
  const items = primaryNavigation.filter((item) =>
    !study.navigationIds || study.navigationIds.includes(item.id));
  return `<nav class="navigation lab-navigation" aria-label="Workspace">${items.map((item) => `<button id="nav-${item.id}" class="nav-trigger" data-navigation="${item.id}" aria-label="${item.label}" ${item.path ? '' : 'aria-haspopup="menu" aria-controls="nav-flyout" aria-expanded="false"'}>${study.labels === 'text' ? '' : icon(item.symbol)}${study.labels === 'icons' ? '' : `<span>${item.label}</span>`}${item.path || study.labels === 'icons' ? '' : icon('chevron')}</button>`).join('')}</nav>`;
}

function chrome() {
  const leftControls = `${homeLogo()}${study.placement === 'top' ? navigation() : ''}`;
  const headerStart = study.id === 'top-icons' ?
    `<div class="bar-navigation">${leftControls}</div>` : leftControls;
  return `<header class="app-bar">${headerStart}${searchField()}<div class="bar-actions"><button class="new-note" data-action="note">${icon('plus')}<span>New note</span></button><button class="icon-button" data-action="help" aria-label="Help and shortcuts" title="Help and shortcuts">${icon('help')}</button>${study.placement === 'top' ? `<button class="icon-button" data-action="settings" aria-label="Settings" title="Settings">${icon('settings')}</button>` : ''}</div></header>`;
}

function panelHeader(title, count, type, context = '') {
  return `<header class="panel-header"><div class="panel-heading">${icon(type)}<h2>${title}</h2>${context ? `<span class="panel-context">${context}</span>` : ''}<span class="count">${count}</span></div></header>`;
}

function actionItems() {
  return `<section class="attention-panel actions" aria-labelledby="actions-heading">${panelHeader('Action items', '8', 'check').replace('<h2>', '<h2 id="actions-heading">')}<div class="panel-body task-list" tabindex="0" role="region" aria-label="Fictional action items"><p class="list-caption">Project tasks</p>${snapshot.tasks.map((item, index) => `${index === 1 ? '<p class="list-caption">Hygiene <span>Milestone link needed</span></p>' : ''}<div class="task-row searchable" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><label class="task-checkbox"><input type="checkbox" aria-label="Complete ${escapeHtml(item.title)} in preview"></label><button class="row-copy" data-detail="tasks" data-index="${index}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></button></div>`).join('')}</div><button class="panel-footer" data-collection="tasks"><span>All action items</span>${icon('arrow')}</button></section>`;
}

function milestones() {
  return `<section class="attention-panel milestones" aria-labelledby="milestones-heading">${panelHeader('Milestones due', '7', 'flag', 'Next 30 days').replace('<h2>', '<h2 id="milestones-heading">')}<div class="panel-body milestone-list" tabindex="0" role="region" aria-label="Fictional milestone deadlines">${snapshot.milestones.map((item, index) => `<button class="milestone-row searchable" data-detail="milestones" data-index="${index}" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><span class="row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></span><span class="row-value"><time>${item.due}</time><b>${item.value}</b></span></button>`).join('')}</div><button class="panel-footer" data-collection="milestones"><span>All milestones</span>${icon('arrow')}</button></section>`;
}

function revenueAlerts() {
  return `<section class="attention-panel alerts" aria-labelledby="alerts-heading">${panelHeader('Revenue alerts', '2', 'alert', '2 of 6 buckets').replace('<h2>', '<h2 id="alerts-heading">')}<div class="panel-body alert-list">${snapshot.alerts.map((item, index) => `<button class="alert-row searchable" data-detail="alerts" data-index="${index}" data-search="${escapeHtml(item.title)}"><span class="row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></span><span class="row-value"><span class="state ${item.kind.toLowerCase()}">${item.kind}</span><b>${item.value}</b></span></button>`).join('')}</div><button class="panel-footer" data-collection="alerts"><span>All revenue alerts</span>${icon('arrow')}</button></section>`;
}

function monthGrid() {
  const firstWeekday = displayedMonth.getDay();
  const daysInMonth = new Date(displayedMonth.getFullYear(),
    displayedMonth.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((firstWeekday + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, position) => {
    const day = position - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return '<div class="calendar-cell outside" aria-hidden="true"></div>';
    const events = calendarDayEvents(day);
    const isToday = isFixtureMonth() && day === fixtureToday.getDate();
    return `<div class="calendar-cell ${isToday ? 'today' : ''} ${[0, 6].includes(position % 7) ? 'weekend' : ''}"><div class="day-label"><button data-day="${day}" aria-label="${calendarDateLabel(day)}"${isToday ? ' aria-current="date"' : ''}>${day}</button><button class="day-add" data-action="note" aria-label="Preview a new note for ${calendarDateLabel(day)}">${icon('plus')}</button></div><div class="day-events">${events.map((item) => calendarEventMarkup(item, snapshot.events.indexOf(item))).join('')}</div></div>`;
  }).join('');
  return `<div class="month-grid" style="grid-template-rows: 36px repeat(${weeks}, minmax(0, 1fr))">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div class="weekday">${day}</div>`).join('')}${cells}</div>`;
}

function activity() {
  return `<section class="calendar-pane" aria-labelledby="month-heading"><header class="calendar-header"><div class="month-heading"><h1 id="month-heading" aria-live="polite">${monthHeading()}</h1><div class="month-controls" role="group" aria-label="Calendar month navigation"><button class="today-button" data-today title="Today in the fictional snapshot: April 29, 2031">Today</button><button class="month-step previous-month" data-month-step="-1" aria-label="Previous month" title="Previous month">${icon('chevron')}</button><button class="month-step" data-month-step="1" aria-label="Next month" title="Next month">${icon('chevron')}</button></div></div><div class="view-switch" aria-label="Activity views"><button class="active" data-view="calendar" aria-current="page">${icon('calendar')}Calendar</button><button data-view="engagements">Engagements <span>24</span></button><button data-view="projects">Projects <span>3</span></button></div></header>${monthGrid()}<footer class="calendar-footer">${calendarLegend()}<span class="legend-caption">${calendarCaption()}</span></footer></section>`;
}

function updateCalendar() {
  document.querySelector('#month-heading').innerHTML = monthHeading();
  document.querySelector('.month-grid').outerHTML = monthGrid();
  document.querySelector('.legend-caption').textContent = calendarCaption();
  applySearch();
}

function attentionDock() {
  const renderers = { tasks: actionItems, milestones, alerts: revenueAlerts };
  return `<aside class="attention-dock" aria-label="Action items, milestones, and revenue alerts">${['tasks', 'milestones', 'alerts'].map((group) => renderers[group]()).join('')}</aside>`;
}

function workspace() {
  const sidebar = study.placement === 'left' ? `<aside class="lab-sidebar">${navigation()}<button class="nav-trigger sidebar-settings" data-action="settings" aria-label="Settings">${study.labels === 'text' ? '' : icon('settings')}${study.labels === 'icons' ? '' : '<span>Settings</span>'}</button></aside>` : '';
  return `${chrome()}<div class="workspace-shell">${sidebar}<main class="workspace"><div class="document-tab">${icon('home')}<span>Overview / Activity</span><small>Personal workspace</small></div><div class="workspace-grid">${activity()}${attentionDock()}</div></main></div><footer class="status-bar"><span><i class="local-dot"></i>Local workspace</span><span>Read-only color study / no live connection</span><span>Tue, Apr 29</span></footer>`;
}

function studyBar() {
  const mode = selectedTheme.mode === 'dark' ? 'light' : 'dark';
  return `<div class="study-bar"><a href="index.html">${icon('arrow')}Modal studies</a><span><b>${selectedTheme.number}</b>${selectedTheme.name}</span><nav aria-label="Choose theme family">${themes.filter((item) => item.mode === selectedTheme.mode).map((item) => `<a href="preview.html?theme=${item.id}" ${item.id === selectedTheme.id ? 'aria-current="page"' : ''}>${item.family === 'graphite' ? 'Graphite (default)' : item.name.split(' / ')[0]}</a>`).join('')}<a class="theme-mode" href="preview.html?theme=${selectedTheme.family}-${mode}" aria-label="Switch to ${mode} mode">Switch to ${mode}</a></nav><button data-clean title="Hide study controls to see the app alone">Hide preview bar</button></div>`;
}

document.querySelector('#app').innerHTML = `${studyBar()}${workspace()}`;
const detail = document.querySelector('#detail');

function openDetail(title, content, category = 'READ-ONLY SNAPSHOT', options = {}) {
  document.dispatchEvent(new Event('preview-detail-opening'));
  detail.dataset.size = options.size || 'compact';
  document.querySelector('#detail-content').innerHTML = `<div class="modal-shell"><header class="modal-header"><div class="modal-heading"><p class="eyebrow">${escapeHtml(category)}</p><h2 id="detail-title" tabindex="-1">${escapeHtml(title)}</h2></div><div class="modal-header-actions">${options.headerActions || ''}<button class="close-detail modal-close" aria-label="Close detail">&times;</button></div></header><div class="modal-scroll ${options.bodyClass === '' ? '' : 'modal-body'}">${content}</div><p id="modal-feedback" class="modal-feedback" role="status" hidden></p><footer class="modal-footer"><small>Fictional data / offline preview<br>Nothing is saved to Sales Buddy.</small><div class="modal-footer-actions">${options.footer || '<button class="modal-secondary close-detail">Close</button>'}</div></footer></div>`;
  if (!detail.open) detail.showModal();
  document.querySelector('#detail-title').focus();
}

function entryDetails(group, item) {
  modalEntryDetails(group, item);
}

function collection(group) {
  const titles = { tasks: 'Action items', milestones: 'Milestones due', alerts: 'Revenue alerts' };
  openDetail(titles[group], snapshot[group].map((item) => `<article class="detail-entry"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.customer)}</p>${item.value ? `<span>${item.value} ${item.due || ''}</span>` : ''}</article>`).join(''), 'ALL FICTIONAL HOME-PAGE ENTRIES');
}

function previewNote(button) {
  modalNewNote(button);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.classList.contains('close-detail')) return detail.close();
  if (button.dataset.detail) {
    entryDetails(button.dataset.detail, snapshot[button.dataset.detail][Number(button.dataset.index)]);
  } else if (button.dataset.collection) {
    collection(button.dataset.collection);
  } else if (button.dataset.day) {
    const day = Number(button.dataset.day);
    const events = calendarDayEvents(day);
    openDetail(calendarDateLabel(day), events.length ? events.map((item) => `<article class="detail-entry"><h3>${escapeHtml(item.customer)}</h3><p>${escapeHtml(item.time)} / ${escapeHtml(calendarEventSummary(item))}</p></article>`).join('') : isFixtureMonth() ? '<p>No activity appears on this day of the fictional calendar.</p>' : '<p>This offline preview only contains April 2031 activity. No activity was fictional for this month.</p>');
  } else if (button.dataset.monthStep !== undefined) {
    displayedMonth = new Date(displayedMonth.getFullYear(),
      displayedMonth.getMonth() + Number(button.dataset.monthStep), 1);
    updateCalendar();
  } else if (button.dataset.today !== undefined) {
    displayedMonth = new Date(fixtureToday.getFullYear(), fixtureToday.getMonth(), 1);
    updateCalendar();
    document.querySelector(`[data-day="${fixtureToday.getDate()}"]`).focus();
  } else if (button.dataset.clean !== undefined) {
    document.body.classList.add('clean-preview');
    document.querySelector('.home-logo').focus();
  } else if (button.dataset.view === 'calendar') {
    document.querySelector('#month-heading').scrollIntoView({ block: 'nearest' });
  } else if (button.dataset.view) {
    openDetail(button.dataset.view === 'engagements' ? '24 engagements' : '3 projects', '<p>This is a fictional count. Detailed lists are outside the scope of this offline study.</p><p>The production app would switch views here.</p>', 'VIEW PLACEHOLDER');
  } else if (button.dataset.action === 'note') {
    previewNote(button);
  } else if (button.dataset.action === 'help') {
    openDetail('Preview shortcuts', '<dl><div><dt>/</dt><dd>Focus search</dd></div><div><dt>Down / Up</dt><dd>Open a focused navigation menu and move through its entries</dd></div><div><dt>Home / End</dt><dd>Move to the first or last menu entry</dd></div><div><dt>Escape</dt><dd>Close menus or details; otherwise restore the study toolbar</dd></div></dl><p>Hover opens a menu; click toggles it. Moving away closes it unless you are navigating its entries with the keyboard. Search, checkboxes, and details work on the fictional data. Menu selections show illustrative destinations without opening application pages.</p>', 'DESIGN PREVIEW');
  } else if (button.dataset.action || button.dataset.nav) {
    openDetail(button.dataset.nav || 'Settings', `<p>This study covers the home page. In Sales Buddy, this control opens ${escapeHtml((button.dataset.nav || 'settings').toLowerCase())}.</p><p>Navigation stays in the preview to protect application data.</p>`, 'NAVIGATION PLACEHOLDER');
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'note-form') return;
  event.preventDefault();
  const title = new FormData(event.target).get('title');
  detail.close();
  openDetail('Editor flow complete', `<p>${escapeHtml(title)}</p><p>No note was saved. This is confirmation of the preview interaction only.</p>`, 'PREVIEW ONLY');
});

function showNotice(text, visible = true) {
  const notice = document.querySelector('#notice');
  notice.textContent = text;
  notice.hidden = !visible;
}

function applySearch() {
  const term = document.querySelector('#search').value.trim().toLowerCase();
  document.querySelectorAll('.searchable').forEach((element) => {
    element.hidden = !element.dataset.search.toLowerCase().includes(term);
  });
  const count = document.querySelectorAll('.searchable:not([hidden])').length;
  showNotice(count ? `${count} matching entries. Clear search to restore the snapshot.` : 'No matching entries. Clear search to restore the snapshot.', Boolean(term));
}

document.querySelector('#search').addEventListener('input', applySearch);

document.addEventListener('change', (event) => {
  if (!event.target.matches('.task-checkbox input')) return;
  event.target.closest('.task-row').classList.toggle('completed', event.target.checked);
  showNotice('Task changed in this preview only. No action item is saved.');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (detail.open) detail.close();
    if (!document.querySelector('#nav-flyout').matches(':popover-open')) {
      document.body.classList.remove('clean-preview');
    }
    showNotice('', false);
  }
  if (event.key === '/' && !detail.open && !event.target.matches('input, textarea')) {
    event.preventDefault();
    document.querySelector('#search').focus();
  }
});
