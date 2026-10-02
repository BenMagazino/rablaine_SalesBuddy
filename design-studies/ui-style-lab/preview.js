const paths = {
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
  chevron: '<path d="m9 5 7 7-7 7"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3z"/>',
  alert: '<path d="m12 3 10 17H2zM12 9v4M12 16v1"/>'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.notes}</svg>`;
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const params = new URLSearchParams(location.search);
const style = concepts.find((item) => item.id === params.get('style')) || concepts[0];
document.body.className = style.id;
document.title = `${style.name} | Sales Buddy UI study`;

function brand() {
  return '<a class="brand" href="index.html"><img src="brand.svg" alt=""><span>Sales Buddy</span></a>';
}

function search() {
  return `<label class="search">${icon('search')}<span class="sr-only">Search snapshot</span><input id="search" placeholder="Search your workspace" autocomplete="off"><kbd>/</kbd></label>`;
}

function newNote() {
  return `<button class="primary" data-action="note">${icon('plus')}New note</button>`;
}

function nav(vertical = true) {
  const items = [['home', 'Overview'], ['notes', 'Notes'], ['people', 'Customers'], ['people', 'Sellers'], ['reports', 'Reports'], ['folder', 'Browse']];
  return `<nav class="${vertical ? 'side-nav' : 'top-nav'}" aria-label="Workspace">${items.map(([key, label], index) => `<button class="${index ? '' : 'selected'}" data-nav="${label}">${icon(key)}<span>${label}</span></button>`).join('')}</nav>`;
}

function titleBlock(title = 'Your workspace', subtitle = 'A clear view of what needs your attention.') {
  return `<div class="page-heading"><div><p class="eyebrow">${snapshot.date}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${newNote()}</div>`;
}

function sectionHeading(title, meta = '', symbol = '') {
  return `<div class="section-heading"><h2>${symbol ? icon(symbol) : ''}${title}</h2>${meta ? `<span class="meta">${meta}</span>` : ''}</div>`;
}

function taskList(limit = 8) {
  return `<div class="task-list">${snapshot.tasks.slice(0, limit).map((item, index) => `<div class="task-row searchable" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><label class="task-check"><input type="checkbox" aria-label="Mark ${escapeHtml(item.title)} complete in preview"></label><button class="row-content" data-detail="tasks" data-index="${index}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></button><span class="task-kind">${index === 0 ? 'Project' : 'Link needed'}</span></div>`).join('')}</div>`;
}

function actionPanel(limit = 8) {
  return `<section class="panel action-panel">${sectionHeading('Action items', 'Snapshot queue', 'check')}${taskList(limit)}<button class="section-link" data-collection="tasks">View all action items ${icon('arrow')}</button></section>`;
}

function milestoneList(limit = 7) {
  return `<div class="milestone-list">${snapshot.milestones.slice(0, limit).map((item, index) => `<button class="milestone-row searchable" data-detail="milestones" data-index="${index}" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><span class="row-content"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.customer)}</span></span><span class="row-metric"><time>${item.due}</time><b>${item.value}</b></span></button>`).join('')}</div>`;
}

function milestonePanel(limit = 7) {
  return `<section class="panel milestone-panel">${sectionHeading('Milestones due', 'Next 30 days', 'flag')}${milestoneList(limit)}<button class="section-link" data-collection="milestones">View all milestones ${icon('arrow')}</button></section>`;
}

function alerts() {
  return `<section class="panel alerts-panel">${sectionHeading('Revenue alerts', '2 of 6 buckets', 'alert')}<div>${snapshot.alerts.map((item, index) => `<button class="alert-row searchable" data-detail="alerts" data-index="${index}" data-search="${escapeHtml(item.title)}"><span class="row-content"><strong>${item.title}</strong><span>${item.customer}</span></span><span class="row-metric"><span class="state ${item.kind.toLowerCase()}">${item.kind}</span><b>${item.value}</b></span></button>`).join('')}</div><button class="section-link" data-collection="alerts">View all alerts ${icon('arrow')}</button></section>`;
}

function calendar() {
  const cells = Array.from({ length: 35 }, (_, position) => {
    const day = position - 1;
    if (day < 1 || day > 30) return '<div class="calendar-cell outside" aria-hidden="true"></div>';
    const events = snapshot.events.filter((event) => event.day === day);
    return `<div class="calendar-cell ${day === 29 ? 'today' : ''} ${[0, 6].includes(position % 7) ? 'weekend' : ''}"><div class="day-number"><button data-day="${day}" aria-label="Show activity for April ${day}">${day}</button>${day === 29 ? '<span class="today-label">Today</span>' : ''}</div>${events.map((item) => `<button class="event searchable ${item.kind.toLowerCase()}" data-detail="events" data-index="${snapshot.events.indexOf(item)}" data-search="${escapeHtml(item.customer)}" title="${escapeHtml(item.time + ' ' + item.customer)}"><span class="event-time">${item.time}</span><span>${escapeHtml(item.customer)}</span></button>`).join('')}</div>`;
  }).join('');
  return `<section class="panel calendar-panel">${sectionHeading('Activity', '', 'calendar')}<div class="calendar-toolbar"><div class="month-title">April <span>2031</span></div><div class="view-tabs" aria-label="Activity view"><button class="active" data-view="calendar">Calendar</button><button data-view="engagements">Engagements <span>24</span></button><button data-view="projects">Projects <span>3</span></button></div><button class="quiet" data-today>Today</button></div><div class="calendar-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div class="weekday">${day}</div>`).join('')}${cells}</div><div class="calendar-legend"><span><i class="legend-dot meeting"></i>Meeting</span><span><i class="legend-dot engagement"></i>Engagement</span><span class="meta">Read-only April snapshot</span></div></section>`;
}

function milestoneTable() {
  return `<section class="panel ledger-panel">${sectionHeading('Milestones due', 'Next 30 days', 'flag')}<table class="ledger"><thead><tr><th scope="col">Milestone / account</th><th scope="col">Workload</th><th scope="col">Due</th><th scope="col">Est. ACR / month</th></tr></thead><tbody>${snapshot.milestones.map((item, index) => `<tr class="searchable" data-search="${escapeHtml(item.title + ' ' + item.customer)}"><td><button data-detail="milestones" data-index="${index}"><strong>${escapeHtml(item.title)}</strong><span>${item.customer}</span></button></td><td>${escapeHtml(item.workload)}</td><td><time>${item.due}</time></td><td>${item.value}</td></tr>`).join('')}</tbody></table></section>`;
}

function activityLedger() {
  return `<section class="panel activity-ledger">${sectionHeading('Activity ledger', '10 most recent snapshot entries', 'calendar')}<div class="ledger-labels"><span>Date / time</span><span>Customer / activity</span><span>Type</span></div>${snapshot.events.slice(-10).map((item) => `<button class="activity-line searchable" data-detail="events" data-index="${snapshot.events.indexOf(item)}" data-search="${escapeHtml(item.customer)}"><span><b>SEP ${item.day}</b><small>${item.time}</small></span><strong>${escapeHtml(item.customer)}</strong><span class="state">${item.kind}</span></button>`).join('')}<button class="section-link" data-collection="events">View all fictional activity ${icon('arrow')}</button></section>`;
}

function topbar() {
  return `<header class="topbar">${brand()}${search()}<div class="top-actions"><button class="icon-button" data-action="settings" aria-label="Preview settings">${icon('settings')}</button><span class="avatar" aria-label="Personal workspace">AB</span></div></header>`;
}

function footer() {
  return '<footer class="app-footer"><span><i class="status-dot"></i>Local workspace</span><span>Read-only design study / April 29, 2031</span><span>Sales Buddy</span></footer>';
}

function workbench() {
  return `${topbar()}<div class="workbench-shell"><aside class="activity-rail" aria-label="Activity rail">${['home', 'notes', 'people', 'reports', 'calendar'].map((key, index) => `<button class="${index === 0 ? 'selected' : ''}" data-nav="${['Overview', 'Notes', 'Customers', 'Reports', 'Activity'][index]}" aria-label="${['Overview', 'Notes', 'Customers', 'Reports', 'Activity'][index]}">${icon(key)}</button>`).join('')}<button class="rail-bottom" data-action="settings" aria-label="Preview settings">${icon('settings')}</button></aside><main><div class="document-tabs"><span>${icon('home')} Overview <i aria-hidden="true">&times;</i></span><span class="inactive">${icon('notes')} Recent notes</span></div><div class="workbench-content">${titleBlock('Overview', 'Your accounts. Your next move.')}<div class="workbench-panels">${actionPanel(5)}${milestonePanel(5)}${alerts()}</div>${calendar()}</div></main></div>${footer()}`;
}

function fluent() {
  return `${topbar()}<div class="fluent-shell"><aside class="sidebar"><p class="nav-caption">WORKSPACE</p>${nav()}<div class="sidebar-note">${icon('check')}<strong>Your personal workspace</strong><p>Notes, context, and follow-through. All in one place.</p></div><button class="sidebar-settings" data-action="settings">${icon('settings')} Settings</button></aside><main>${titleBlock('Your workspace', 'Pick up where you left off.')}<div class="fluent-columns"><div>${actionPanel(4)}${calendar()}</div><aside class="attention-dock"><p class="eyebrow">ON THE HORIZON</p>${milestonePanel(7)}${alerts()}</aside></div></main></div>${footer()}`;
}

function editorial() {
  return `<header class="editorial-header">${brand()}${nav(false)}${search()}</header><main class="editorial-main"><div class="editorial-title"><p class="eyebrow">PERSONAL WORKSPACE / ${snapshot.date}</p><div><h1>A little clarity.<br>A better next move.</h1><div class="editorial-intro"><p>Your customer conversations,<br>with the follow-through in view.</p>${newNote()}</div></div></div><div class="editorial-grid"><aside>${actionPanel(5)}${alerts()}</aside><div>${calendar()}<p class="editorial-caption"><span>01 / THE MONTH IN VIEW</span>Less hunting for context. More time in the conversation.</p></div></div>${milestoneTable()}</main>${footer()}`;
}

function operations() {
  return `${topbar()}<div class="operations-nav">${nav(false)}<span class="meta">PERSONAL / LOCAL</span></div><main class="operations-main">${titleBlock('Account operations', 'Deadlines, follow-through, and account signals.')}<div class="operations-strip"><span>${icon('flag')} Next deadline <strong>Oct 01</strong></span><span>${icon('calendar')} Current period <strong>Apr 2031</strong></span><span>${icon('alert')} Revenue signals <strong>2 visible alerts</strong></span><span class="meta">Live-page snapshot, not a live connection</span></div><div class="operations-grid"><div>${milestoneTable()}${activityLedger()}</div><aside>${actionPanel(8)}${alerts()}</aside></div></main>${footer()}`;
}

function studio() {
  return `<header class="studio-masthead"><div>${brand()}${nav(false)}${search()}${newNote()}</div><div class="studio-title"><div><p class="eyebrow">${snapshot.date}</p><h1>Your month, in focus.</h1></div><p>Capture the conversation.<br>Keep the next step close.</p></div></header><main class="studio-main"><div class="studio-calendar">${calendar()}</div><aside class="studio-dock">${actionPanel(5)}${milestonePanel(4)}${alerts()}</aside></main>${footer()}`;
}

function lcars() {
  return `<div class="lcars-shell"><aside class="lcars-rail"><div class="lcars-elbow"><img src="brand.svg" alt="Sales Buddy"></div><button data-nav="Overview">01 / OVERVIEW</button><button data-nav="Notes">02 / LOG ENTRIES</button><button data-nav="Customers">03 / ACCOUNTS</button><button data-nav="Reports">04 / REPORTS</button><button data-nav="Browse">05 / DIRECTORY</button><div class="lcars-rail-fill"><span>SB-0429<br>PERSONAL<br>TERMINAL</span></div><a href="index.html">RETURN TO STUDIES</a></aside><div class="lcars-workspace"><header class="lcars-header"><div class="lcars-bars"><span>SALES BUDDY</span><span>LOCAL SYSTEM</span><span>READ ONLY</span></div><div class="lcars-heading"><h1>SALES COMMAND</h1><span>STARDATE / 2031.119</span></div><div class="lcars-command">${search()}${newNote()}</div></header><main><div class="lcars-panels">${actionPanel(4)}${milestonePanel(4)}${alerts()}</div>${calendar()}</main><footer class="lcars-footer"><span>PERSONAL PRODUCTIVITY SYSTEM</span><span>END TRANSMISSION / 0429</span></footer></div></div>`;
}

const renderers = { workbench, fluent, editorial, operations, studio, lcars };
document.querySelector('#app').innerHTML = `${params.has('embed') ? '' : `<div class="study-bar"><a href="index.html">All six studies</a><span>${style.kicker} <b>${style.name}</b></span><nav aria-label="Switch design">${concepts.map((item, index) => `<a href="preview.html?style=${item.id}" class="${style.id === item.id ? 'current' : ''}" aria-label="${item.name}" ${style.id === item.id ? 'aria-current="page"' : ''}>${index + 1}</a>`).join('')}</nav></div>`}${renderers[style.id]()}`;

const inspector = document.querySelector('#inspector');
let previousFocus;
function showDetail(content) {
  previousFocus = document.activeElement;
  document.querySelector('#detail-content').innerHTML = content;
  inspector.hidden = false;
  document.querySelector('.close-detail').focus();
}

function closeDetail() {
  inspector.hidden = true;
  previousFocus?.focus();
}

function describeItem(group, item) {
  return `<p class="eyebrow">${group === 'events' ? 'ACTIVITY' : group.toUpperCase()} / SNAPSHOT</p><h2>${escapeHtml(item.title || item.customer)}</h2><p class="detail-customer">${escapeHtml(item.customer)}</p><dl>${Object.entries(item).filter(([key]) => !['title', 'customer'].includes(key)).map(([key, value]) => `<div><dt>${escapeHtml(key === 'value' ? 'Displayed value' : key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl><p class="prototype-disclaimer">This is a fictional home-page entry, not an application record. No changes are sent to Sales Buddy.</p>`;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.classList.contains('close-detail')) return closeDetail();
  if (button.dataset.detail) {
    const group = button.dataset.detail;
    showDetail(describeItem(group, snapshot[group][Number(button.dataset.index)]));
  } else if (button.dataset.collection) {
    const group = button.dataset.collection;
    showDetail(`<p class="eyebrow">FICTIONAL HOME-PAGE ENTRIES</p><h2>${{ tasks: 'Action items', milestones: 'Milestones', alerts: 'Revenue alerts', events: 'April activity' }[group]}</h2>${snapshot[group].map((item) => `<article class="detail-record"><strong>${escapeHtml(item.title || item.customer)}</strong><p>${escapeHtml(group === 'events' ? `Apr ${item.day} / ${item.time} / ${item.kind}` : item.customer)}</p>${item.value ? `<span>${item.value} ${item.due || ''}</span>` : ''}</article>`).join('')}<p class="prototype-disclaimer">Only entries visible in the fictional home page are included.</p>`);
  } else if (button.dataset.day) {
    const events = snapshot.events.filter((item) => item.day === Number(button.dataset.day));
    showDetail(`<p class="eyebrow">APRIL ${button.dataset.day}, 2031</p><h2>Day overview</h2>${events.length ? events.map((item) => `<article class="detail-record"><strong>${escapeHtml(item.customer)}</strong><p>${item.time} / ${item.kind}</p></article>`).join('') : '<p>No activity shown in this day of the snapshot.</p>'}<p class="prototype-disclaimer">Read-only design preview.</p>`);
  } else if (button.dataset.today !== undefined) {
    document.querySelector('.today')?.scrollIntoView({ block: 'nearest' });
    document.querySelector('[data-day="29"]')?.focus();
  } else if (button.dataset.view === 'calendar') {
    document.querySelector('.calendar-grid').scrollIntoView({ block: 'nearest' });
  } else if (button.dataset.view) {
    showDetail(`<p class="eyebrow">ACTIVITY VIEW / DESIGN PREVIEW</p><h2>${button.dataset.view === 'engagements' ? '24 engagements' : '3 projects'}</h2><p>This is a fictional count. Detailed lists are outside the scope of this offline study.</p><p class="prototype-disclaimer">The final app would switch views here.</p>`);
  } else if (button.dataset.action === 'note') {
    showDetail('<p class="eyebrow">LOCAL DESIGN PREVIEW</p><h2>New note</h2><form id="note-form"><label class="form-label">Title<input name="title" required placeholder="Conversation title"></label><label class="form-label">Notes<textarea name="notes" rows="8" placeholder="Capture the conversation..." required></textarea></label><button class="primary" type="submit">Preview save</button></form><p class="prototype-disclaimer">Try the editor. Preview save shows confirmation only. Nothing is stored or sent to your app.</p>');
  } else if (button.dataset.action || button.dataset.nav) {
    showDetail(`<p class="eyebrow">DESIGN PREVIEW</p><h2>${escapeHtml(button.dataset.nav || 'Settings')}</h2><p>This study covers the home page. In the app, this control would open ${escapeHtml((button.dataset.nav || 'settings').toLowerCase())}.</p><p class="prototype-disclaimer">Navigation stays inside the mockup so you cannot accidentally leave the offline archive.</p>`);
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'note-form') return;
  event.preventDefault();
  const title = new FormData(event.target).get('title');
  showDetail(`<p class="eyebrow">PREVIEW ONLY</p><h2>Editor flow complete</h2><p>${escapeHtml(title)}</p><p class="prototype-disclaimer">No note was saved. This confirms the mockup interaction, not a database write.</p>`);
});

document.addEventListener('change', (event) => {
  if (event.target.matches('.task-check input')) {
    event.target.closest('.task-row').classList.toggle('completed', event.target.checked);
    const notice = document.querySelector('#notice');
    notice.textContent = 'Preview only: task state changes on this page, not in Sales Buddy.';
    notice.hidden = false;
  }
});

document.querySelector('#search').addEventListener('input', (event) => {
  const term = event.target.value.trim().toLowerCase();
  document.querySelectorAll('.searchable').forEach((element) => {
    element.hidden = !element.dataset.search.toLowerCase().includes(term);
  });
  const visible = [...document.querySelectorAll('.searchable')].filter((element) => !element.hidden).length;
  const notice = document.querySelector('#notice');
  notice.hidden = !term;
  notice.textContent = visible ? `${visible} matching snapshot entries. Clear search to restore the view.` : 'No matching snapshot entries. Clear search to restore the view.';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDetail();
    document.querySelector('#notice').hidden = true;
  }
  if (event.key === '/' && !event.target.matches('input, textarea')) {
    event.preventDefault();
    document.querySelector('#search').focus();
  }
});
