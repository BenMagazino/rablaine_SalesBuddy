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
  alert: '<path d="m12 3 10 17H2zM12 9v4M12 16v1"/>'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const params = new URLSearchParams(location.search);
const study = studies.find((item) => item.id === params.get('style')) || studies[0];
document.body.className = study.id;
document.title = `${study.name} | Sales Buddy study`;

function homeLogo() {
  return `<a class="home-logo" href="preview.html?style=${study.id}" aria-label="Sales Buddy home" title="Home"><img src="brand.svg" alt=""></a>`;
}

function searchField() {
  return `<label class="search">${icon('search')}<span class="sr-only">Search fictional workspace entries</span><input id="search" placeholder="Search customers and activity" autocomplete="off"><kbd>/</kbd></label>`;
}

function navigation(mode) {
  const items = [['home', 'Overview'], ['notes', 'Notes'], ['people', 'Customers'], ['people', 'Sellers'], ['reports', 'Reports'], ['folder', 'Browse']];
  return `<nav class="navigation ${mode}-navigation" aria-label="Workspace">${items.map(([symbol, label], index) => `<button data-nav="${label}" class="${index ? '' : 'selected'}" ${mode === 'rail' ? `aria-label="${label}" title="${label}"` : ''}>${icon(symbol)}${mode === 'rail' ? '' : `<span>${label}</span>`}</button>`).join('')}</nav>`;
}

function chrome() {
  return `<header class="app-bar">${homeLogo()}${study.nav === 'top' ? navigation('top') : '<span class="current-context">Overview</span>'}${searchField()}<div class="bar-actions"><button class="new-note" data-action="note">${icon('plus')}<span>New note</span></button><button class="icon-button" data-action="help" aria-label="Help and shortcuts" title="Help and shortcuts">${icon('help')}</button><button class="icon-button" data-action="settings" aria-label="Settings" title="Settings">${icon('settings')}</button></div></header>`;
}

function panelHeader(title, count, type, context) {
  return `<header class="panel-header"><div class="panel-heading">${icon(type)}<h2>${title}</h2><span class="count">${count}</span></div><span class="panel-context">${context}</span></header>`;
}

function actionItems() {
  return `<section class="attention-panel actions" aria-labelledby="actions-heading">${panelHeader('Action items', '8', 'check', 'Follow-through').replace('<h2>', '<h2 id="actions-heading">')}<div class="panel-body task-list" tabindex="0" role="region" aria-label="Fictional action items"><p class="list-caption">Project tasks</p>${snapshot.tasks.map((item, index) => `${index === 1 ? '<p class="list-caption">Hygiene <span>Milestone link needed</span></p>' : ''}<div class="task-row searchable" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><label class="task-checkbox"><input type="checkbox" aria-label="Complete ${escapeHtml(item.title)} in preview"></label><button class="row-copy" data-detail="tasks" data-index="${index}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></button></div>`).join('')}</div><button class="panel-footer" data-collection="tasks"><span>All action items</span>${icon('arrow')}</button></section>`;
}

function milestones() {
  return `<section class="attention-panel milestones" aria-labelledby="milestones-heading">${panelHeader('Milestones due', '7', 'flag', 'Next 30 days').replace('<h2>', '<h2 id="milestones-heading">')}<div class="panel-body milestone-list" tabindex="0" role="region" aria-label="Fictional milestone deadlines">${snapshot.milestones.map((item, index) => `<button class="milestone-row searchable" data-detail="milestones" data-index="${index}" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><span class="row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></span><span class="row-value"><time>${item.due}</time><b>${item.value}</b></span></button>`).join('')}</div><button class="panel-footer" data-collection="milestones"><span>All milestones</span>${icon('arrow')}</button></section>`;
}

function revenueAlerts() {
  return `<section class="attention-panel alerts" aria-labelledby="alerts-heading">${panelHeader('Revenue alerts', '2', 'alert', '2 of 6 buckets').replace('<h2>', '<h2 id="alerts-heading">')}<div class="panel-body alert-list">${snapshot.alerts.map((item, index) => `<button class="alert-row searchable" data-detail="alerts" data-index="${index}" data-search="${escapeHtml(item.title)}"><span class="row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></span><span class="row-value"><span class="state ${item.kind.toLowerCase()}">${item.kind}</span><b>${item.value}</b></span></button>`).join('')}</div><button class="panel-footer" data-collection="alerts"><span>All revenue alerts</span>${icon('arrow')}</button></section>`;
}

function monthGrid() {
  const cells = Array.from({ length: 35 }, (_, position) => {
    const day = position - 1;
    if (day < 1 || day > 30) return '<div class="calendar-cell outside" aria-hidden="true"></div>';
    const events = snapshot.events.filter((item) => item.day === day);
    return `<div class="calendar-cell ${day === 29 ? 'today' : ''} ${[0, 6].includes(position % 7) ? 'weekend' : ''}"><div class="day-label"><button data-day="${day}" aria-label="April ${day}, 2031">${day}</button>${day === 29 ? '<span>Today</span>' : ''}<button class="day-add" data-action="note" aria-label="Preview a new note for April ${day}">${icon('plus')}</button></div><div class="day-events">${events.map((item) => `<button class="event ${item.kind.toLowerCase()} searchable" data-detail="events" data-index="${snapshot.events.indexOf(item)}" data-search="${escapeHtml(item.customer)}" title="${escapeHtml(item.time + ' / ' + item.customer)}"><span class="event-time">${icon(item.kind === 'Meeting' ? 'notes' : 'people')}${item.time}</span><strong>${escapeHtml(item.customer)}</strong></button>`).join('')}</div></div>`;
  }).join('');
  return `<div class="month-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div class="weekday">${day}</div>`).join('')}${cells}</div>`;
}

function activity() {
  return `<section class="calendar-pane" aria-labelledby="month-heading"><header class="calendar-header"><div class="month-heading"><h1 id="month-heading">April <span>2031</span></h1><button class="today-button" data-today>Today</button></div><div class="view-switch" aria-label="Activity views"><button class="active" data-view="calendar" aria-current="page">${icon('calendar')}Calendar</button><button data-view="engagements">Engagements <span>24</span></button><button data-view="projects">Projects <span>3</span></button></div></header>${monthGrid()}<footer class="calendar-footer"><div class="calendar-key"><span><i class="key meeting-key"></i>Meeting / note</span><span><i class="key engagement-key"></i>Engagement</span></div><span>April 29 snapshot</span></footer></section>`;
}

function attentionDock() {
  const renderers = { tasks: actionItems, milestones, alerts: revenueAlerts };
  return `<aside class="attention-dock" aria-label="Action items, milestones, and revenue alerts">${study.id === 'panes' ? '<div class="dock-caption"><span>ATTENTION</span><span>3 PANES</span></div>' : ''}${study.order.map((group) => renderers[group]()).join('')}</aside>`;
}

function workspace() {
  const sidebar = study.nav === 'side' ? `<aside class="nav-sidebar"><p class="nav-label">WORKSPACE</p>${navigation('side')}<div class="sidebar-bottom"><span class="local-dot"></span>Local workspace</div></aside>` : study.nav === 'rail' ? `<aside class="activity-rail">${navigation('rail')}<button class="rail-settings" data-action="settings" aria-label="Settings">${icon('settings')}</button></aside>` : '';
  return `${chrome()}<div class="workspace-shell">${sidebar}<main class="workspace">${study.id === 'panes' ? `<div class="document-tab">${icon('home')} Overview <span aria-hidden="true">&times;</span><small>Personal workspace</small></div>` : ''}<div class="workspace-grid">${study.id === 'reverse' ? attentionDock() + activity() : activity() + attentionDock()}</div></main></div><footer class="status-bar"><span><i class="local-dot"></i>Local workspace</span><span>Read-only study / no live connection</span><span>Tue, Apr 29</span></footer>`;
}

function studyBar() {
  return `<div class="study-bar"><a href="index.html">${icon('arrow')}Round two</a><span><b>${study.number}</b>${study.name}</span><nav aria-label="Choose design">${studies.map((item) => `<a href="preview.html?style=${item.id}" ${item.id === study.id ? 'aria-current="page"' : ''} aria-label="${item.name}">${item.number}</a>`).join('')}</nav><button data-clean title="Hide study controls to see the app alone">Hide preview bar</button></div>`;
}

document.querySelector('#app').innerHTML = `${studyBar()}${workspace()}`;
const detail = document.querySelector('#detail');

function openDetail(title, content, category = 'READ-ONLY SNAPSHOT') {
  document.querySelector('#detail-content').innerHTML = `<p class="eyebrow">${category}</p><h2 id="detail-title">${escapeHtml(title)}</h2>${content}<p class="disclaimer">Design preview only. Nothing is sent to or saved in Sales Buddy.</p>`;
  detail.showModal();
}

function entryDetails(group, item) {
  const title = item.title || item.customer;
  const fields = Object.entries(item).filter(([key]) => !['title', 'customer'].includes(key));
  openDetail(title, `<p class="detail-customer">${escapeHtml(item.customer)}</p><dl>${fields.map(([key, value]) => `<div><dt>${escapeHtml(key === 'value' ? 'Displayed value' : key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`, `${group.toUpperCase()} / SNAPSHOT`);
}

function collection(group) {
  const titles = { tasks: 'Action items', milestones: 'Milestones due', alerts: 'Revenue alerts' };
  openDetail(titles[group], snapshot[group].map((item) => `<article class="detail-entry"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.customer)}</p>${item.value ? `<span>${item.value} ${item.due || ''}</span>` : ''}</article>`).join(''), 'ALL FICTIONAL HOME-PAGE ENTRIES');
}

function previewNote(button) {
  const day = button.closest('.calendar-cell')?.querySelector('[data-day]')?.dataset.day;
  openDetail('New note', `${day ? `<p class="detail-customer">April ${day}, 2031</p>` : ''}<form id="note-form"><label>Title<input name="title" placeholder="Conversation title" required></label><label>Notes<textarea name="notes" rows="8" placeholder="Capture the conversation..." required></textarea></label><button class="new-note" type="submit">Preview save</button></form><p class="detail-customer">This editor demonstrates the flow. It does not create a note.</p>`, 'LOCAL EDITOR PREVIEW');
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
    const events = snapshot.events.filter((item) => item.day === day);
    openDetail(`April ${day}, 2031`, events.length ? events.map((item) => `<article class="detail-entry"><h3>${escapeHtml(item.customer)}</h3><p>${item.time} / ${item.kind}</p></article>`).join('') : '<p>No activity appears on this day of the fictional calendar.</p>');
  } else if (button.dataset.today !== undefined) {
    document.querySelector('[data-day="29"]').focus();
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
    openDetail('Preview shortcuts', '<dl><div><dt>/</dt><dd>Focus search</dd></div><div><dt>Escape</dt><dd>Close details or restore the study toolbar</dd></div></dl><p>Search, checkboxes, and details work on the fictional data. Navigation to other app pages is a placeholder.</p>', 'DESIGN PREVIEW');
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

document.querySelector('#search').addEventListener('input', (event) => {
  const term = event.target.value.trim().toLowerCase();
  document.querySelectorAll('.searchable').forEach((element) => {
    element.hidden = !element.dataset.search.toLowerCase().includes(term);
  });
  const count = document.querySelectorAll('.searchable:not([hidden])').length;
  showNotice(count ? `${count} matching entries. Clear search to restore the snapshot.` : 'No matching entries. Clear search to restore the snapshot.', Boolean(term));
});

document.addEventListener('change', (event) => {
  if (!event.target.matches('.task-checkbox input')) return;
  event.target.closest('.task-row').classList.toggle('completed', event.target.checked);
  showNotice('Task changed in this preview only. No action item is saved.');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (detail.open) detail.close();
    document.body.classList.remove('clean-preview');
    showNotice('', false);
  }
  if (event.key === '/' && !detail.open && !event.target.matches('input, textarea')) {
    event.preventDefault();
    document.querySelector('#search').focus();
  }
});
