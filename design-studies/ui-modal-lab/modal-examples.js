let previewAction = null;

function modalLink(label, symbol = null) {
  return `<button class="modal-link" data-modal-action="destination">${symbol ? icon(symbol) : ''}${escapeHtml(label)}</button>`;
}

function modalField(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function modalFeedback(message) {
  const feedback = document.querySelector('#modal-feedback');
  feedback.textContent = message;
  feedback.hidden = false;
}

function modalActionItem(item, editing = false) {
  previewAction = { ...item };
  const due = item.due ?? '2031-05-02';
  const priority = item.priority ?? 'Normal';
  const contact = item.contact ?? '';
  const dueLabel = due ? new Date(`${due}T12:00:00`).toLocaleDateString('en-US',
    { month: 'short', day: '2-digit', year: 'numeric' }) : 'Not set';
  const fields = `<dl class="modal-fields">${modalField('Customer', modalLink(item.customer))}${modalField('Due date', escapeHtml(dueLabel))}${modalField('Priority', escapeHtml(priority))}${contact ? modalField('Contact', escapeHtml(contact)) : ''}</dl>`;
  const description = item.description ?? 'Review the sample renewal checklist with the account team. Confirm the next customer conversation and capture any dependencies before the planning session.';
  const body = editing ? `<form id="action-edit-form" class="modal-form">
    <label>Title<input name="title" maxlength="300" required value="${escapeHtml(item.title)}"></label>
    <div class="modal-form-row"><label>Due date<input type="date" name="due" value="${escapeHtml(due)}"></label>
    <label>Priority<select name="priority"><option ${priority === 'Normal' ? 'selected' : ''}>Normal</option><option ${priority === 'High' ? 'selected' : ''}>High</option></select></label>
    <label>Contact<input name="contact" placeholder="Contact name" value="${escapeHtml(contact)}"></label></div>
    <label>Description<textarea name="description" rows="5">${escapeHtml(description)}</textarea></label>
    </form>` : `${fields}<section class="modal-section"><h3>Description</h3><p>${escapeHtml(description || 'No description added.')}</p></section>`;
  const footer = editing ?
    '<button class="modal-secondary" data-modal-action="cancel-edit">Cancel</button><button class="modal-primary" type="submit" form="action-edit-form">Save preview</button>' :
    `<label class="modal-completion"><input type="checkbox" data-modal-completed ${item.completed ? 'checked' : ''}>Completed</label><button class="modal-secondary close-detail">Close</button><button class="modal-primary" data-modal-action="edit">Edit</button>`;
  openDetail(item.title, body, editing ? 'ACTION ITEM / EDIT' : 'ACTION ITEM',
    { footer, size: 'compact' });
}

function modalMilestone(item) {
  const meta = `<h3>Navigation</h3><dl>
    ${modalField('Customer', modalLink(item.customer))}
    ${modalField('Opportunity', modalLink('Sample analytics expansion'))}
    ${modalField('Engagement', modalLink('Analytics discovery workshop'))}
    </dl><section class="modal-section"><h3>Details</h3><dl>
    ${modalField('Status', '<span class="modal-status">On track</span>')}
    ${modalField('Commitment', 'Uncommitted')}
    ${modalField('Workload', escapeHtml(item.workload))}
    ${modalField('Monthly usage', escapeHtml(item.value))}
    ${modalField('Due date', `${escapeHtml(item.due)}, 2031`)}
    ${modalField('Milestone team', 'On team')}
    </dl></section>`;
  const body = `<section class="modal-section"><h3>Associated notes</h3>
    <p>${modalLink('Analytics discovery conversation')}</p>
    <p class="detail-customer">April 29, 2031 / Fictional Seller 01</p></section>
    <section class="modal-section"><h3>Tasks</h3>
    <ul class="modal-list"><li>Confirm the sample pilot success criteria</li><li>Review the workshop architecture</li></ul></section>
    <section class="modal-section"><h3>Forecast comments</h3>
    <article class="modal-comment"><div class="comment-meta">Fictional Seller 01 / April 29, 2031</div>
    <p>The discovery workshop is complete. Next step: confirm the pilot scope and owners before the May planning session.</p></article>
    <article class="modal-comment"><div class="comment-meta">Fictional Seller 02 / April 24, 2031</div>
    <p>Technical prerequisites are documented. The pilot can start after the sample dataset is available.</p></article></section>`;
  openDetail(item.title, `<div class="modal-detail-layout"><aside class="modal-meta">${meta}</aside><div class="modal-body">${body}</div></div>`,
    'MILESTONE', { size: 'wide', bodyClass: '', headerActions:
      '<span class="modal-status">On track</span><button class="modal-secondary" data-modal-action="destination">MSX</button><button class="modal-secondary" data-modal-action="destination">Full page</button>' });
}

function modalNote(item) {
  const meta = `<h3>Details</h3><dl>
    ${modalField('Date', `April ${item.day}, 2031 / ${escapeHtml(item.time)}`)}
    ${modalField('Customer', modalLink(item.customer))}
    ${modalField('Seller', `<span class="modal-tag bg-primary">${icon('person')}Fictional Seller 01</span>`)}
    ${modalField('Territory', `<span class="modal-tag bg-info text-dark">${icon('location')}Fictional Territory 01</span>`)}
    ${modalField('Topics', `<span class="modal-tag bg-warning text-dark">${icon('tag')}Analytics</span><span class="modal-tag bg-warning text-dark">${icon('tag')}Architecture</span>`)}
    ${modalField('Attendees', 'Fictional Attendee 01<br>Fictional Attendee 02')}
    ${modalField('Engagement', modalLink('Analytics discovery workshop'))}
    </dl>`;
  const body = `<section class="modal-section"><h3>Notes</h3>
    <p>Reviewed the sample analytics architecture and discussed a small pilot to validate the reporting workflow.</p>
    <p>The team wants to reduce manual preparation, make ownership explicit, and agree on success criteria before moving into implementation.</p>
    <h3>Key decisions</h3><ul class="modal-list">
    <li>Start with a representative sample dataset, not the complete estate.</li>
    <li>Use the existing identity and access model for the pilot.</li>
    <li>Review architecture and operational ownership together.</li></ul></section>
    <section class="modal-section"><h3>Next steps</h3><ul class="modal-list">
    <li>Share the sample workshop checklist with the account team.</li>
    <li>Schedule a follow-up to confirm pilot scope and timing.</li></ul></section>
    <section class="modal-section"><h3>Linked work</h3>
    <p>${modalLink('Analytics workspace pilot')}</p><p>${modalLink('Confirm the sample pilot success criteria')}</p></section>`;
  openDetail(item.customer, `<div class="modal-detail-layout"><aside class="modal-meta">${meta}</aside><div class="modal-body">${body}</div></div>`,
    'CUSTOMER NOTE', { size: 'wide', bodyClass: '', headerActions:
      '<button class="modal-secondary" data-modal-action="destination">Full page</button>' });
}

function modalEntryDetails(group, item) {
  if (group === 'tasks') return modalActionItem(item);
  if (group === 'milestones') return modalMilestone(item);
  if (group === 'events' && item.kind === 'Note') return modalNote(item);
  if (group === 'events') {
    openDetail(item.customer, `${calendarEventMarkup(item)}<p>${escapeHtml(calendarEventSummary(item))}</p><p>April ${item.day}, 2031 / ${escapeHtml(item.time)}</p>`, 'OUTLOOK MEETING');
    return;
  }
  openDetail(item.title, `<dl class="modal-fields">${modalField('Customer', escapeHtml(item.title))}${modalField('Trend', escapeHtml(item.kind))}${modalField('Displayed value', escapeHtml(item.value))}</dl><p>${escapeHtml(item.customer)}</p>`, 'REVENUE ALERT');
}

function modalNewNote(button) {
  const day = button.closest('.calendar-cell')?.querySelector('[data-day]')?.dataset.day;
  openDetail('New note', `<form id="note-form" class="modal-form">${day ? `<p>${calendarDateLabel(day)}</p>` : ''}
    <label>Title<input name="title" placeholder="Conversation title" required></label>
    <label>Notes<textarea name="notes" rows="7" placeholder="Capture the conversation..." required></textarea></label>
    </form>`, 'LOCAL EDITOR PREVIEW', { footer:
      '<button class="modal-secondary close-detail">Cancel</button><button class="modal-primary" type="submit" form="note-form">Save preview</button>' });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-modal-action]');
  if (!button) return;
  if (button.dataset.modalAction === 'edit') {
    modalActionItem(previewAction, true);
  } else if (button.dataset.modalAction === 'cancel-edit') {
    modalActionItem(previewAction);
  } else {
    modalFeedback('Illustrative destination only. This offline preview stays here.');
  }
});

document.addEventListener('change', (event) => {
  if (!event.target.matches('[data-modal-completed]')) return;
  previewAction.completed = event.target.checked;
  modalFeedback('Completion changed in this preview only. Nothing is saved to Sales Buddy.');
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'action-edit-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  modalActionItem({ ...previewAction, title: String(data.get('title')),
    description: String(data.get('description')), due: String(data.get('due')),
    priority: String(data.get('priority')), contact: String(data.get('contact')) });
  modalFeedback('Preview changes applied in this dialog only. Nothing is saved to Sales Buddy.');
});

detail.addEventListener('click', (event) => {
  if (event.target !== detail) return;
  const bounds = detail.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom) detail.close();
});

const modalExample = params.get('modal');
if (modalExample === 'action') modalActionItem(snapshot.tasks[0]);
if (modalExample === 'milestone') modalMilestone(snapshot.milestones[0]);
if (modalExample === 'note') modalNote(snapshot.events.find(item => item.kind === 'Note'));
