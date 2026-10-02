const flyout = document.querySelector('#nav-flyout');
const tooltip = document.querySelector('#nav-tooltip');
let activeNavigation = null;
let openTimer;
let closeTimer;

function hideTooltip() {
  if (tooltip.matches(':popover-open')) tooltip.hidePopover();
  document.querySelectorAll('[aria-describedby="nav-tooltip"]').forEach((button) => {
    button.removeAttribute('aria-describedby');
  });
}

function closeNavigation(returnFocus = false) {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  const trigger = activeNavigation && document.querySelector(`#nav-${activeNavigation}`);
  if (flyout.matches(':popover-open')) flyout.hidePopover();
  document.querySelectorAll('[data-navigation]').forEach((button) => {
    button.classList.remove('menu-open');
    if (button.hasAttribute('aria-haspopup')) button.setAttribute('aria-expanded', 'false');
  });
  activeNavigation = null;
  hideTooltip();
  if (returnFocus) trigger?.focus();
}

function placeFlyout() {
  if (!activeNavigation || !flyout.matches(':popover-open')) return;
  const trigger = document.querySelector(`#nav-${activeNavigation}`).getBoundingClientRect();
  flyout.style.maxHeight = `${innerHeight - 16}px`;
  const size = flyout.getBoundingClientRect();
  let left = study.placement === 'left' ? trigger.right : trigger.left;
  let top = study.placement === 'left' ? trigger.top : trigger.bottom;
  left = Math.max(8, Math.min(left, innerWidth - size.width - 8));
  if (study.placement === 'left') top = Math.max(8, Math.min(top, innerHeight - size.height - 8));
  flyout.style.left = `${left}px`;
  flyout.style.top = `${top}px`;
  flyout.style.maxHeight = `${innerHeight - top - 8}px`;
}

function renderFlyout(id) {
  const section = primaryNavigation.find((item) => item.id === id);
  flyout.innerHTML = `<div class="flyout-items" role="menu" aria-label="${section.label}">${menuContent[id].map((group) => `<div class="menu-group" role="none">${group.group ? `<p class="menu-group-label" role="presentation">${group.group}</p>` : ''}${group.items.map((item) => `<button class="menu-entry" role="menuitem" tabindex="-1" data-menu-destination="${escapeHtml(item.path)}" data-menu-label="${escapeHtml(item.label)}">${icon(item.symbol)}<span>${escapeHtml(item.label)}</span></button>`).join('')}</div>`).join('')}</div>`;
}

function openNavigation(id, focusIndex = null) {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  hideTooltip();
  const trigger = document.querySelector(`#nav-${id}`);
  activeNavigation = id;
  document.querySelectorAll('[data-navigation]').forEach((button) => {
    const active = button === trigger;
    button.classList.toggle('menu-open', active);
    if (button.hasAttribute('aria-haspopup')) button.setAttribute('aria-expanded', String(active));
  });
  renderFlyout(id);
  if (!flyout.matches(':popover-open')) flyout.showPopover();
  placeFlyout();
  if (focusIndex !== null) {
    const entries = [...flyout.querySelectorAll('.menu-entry')];
    entries.at(focusIndex)?.focus();
  }
}

function scheduleClose() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (!flyout.contains(document.activeElement)) closeNavigation();
  }, 240);
}

function showTooltip(button, label) {
  hideTooltip();
  tooltip.textContent = label;
  tooltip.showPopover();
  const trigger = button.getBoundingClientRect();
  const size = tooltip.getBoundingClientRect();
  tooltip.style.left = `${study.placement === 'left' ? trigger.right : trigger.left}px`;
  tooltip.style.top = `${study.placement === 'left' ? trigger.top + (trigger.height - size.height) / 2 : trigger.bottom}px`;
  button.setAttribute('aria-describedby', 'nav-tooltip');
}

document.querySelectorAll('[data-navigation]').forEach((button) => {
  const section = primaryNavigation.find((item) => item.id === button.dataset.navigation);
  button.addEventListener('pointerenter', () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (activeNavigation === section.id) return;
    if (section.path) {
      closeNavigation();
      if (study.labels === 'icons') showTooltip(button, section.label);
    } else {
      openTimer = setTimeout(() => openNavigation(section.id), 160);
    }
  });
  button.addEventListener('pointerleave', () => {
    hideTooltip();
    scheduleClose();
  });
  button.addEventListener('focus', () => {
    if (section.path && study.labels === 'icons') showTooltip(button, section.label);
  });
  button.addEventListener('blur', hideTooltip);
});

flyout.addEventListener('pointerenter', () => clearTimeout(closeTimer));
flyout.addEventListener('pointerleave', scheduleClose);
flyout.addEventListener('focusin', () => clearTimeout(closeTimer));

function previewDestination(label, path, section) {
  closeNavigation();
  document.querySelectorAll('[data-navigation]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.navigation === section);
  });
  openDetail(label, `<p class="detail-customer">${escapeHtml(path)}</p><p>This is an illustrative destination with fictional record identifiers. This standalone study previews its selection, not the destination page.</p><p>No application page was opened and no data was changed.</p>`, 'NAVIGATION SELECTION / PREVIEW ONLY');
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-navigation]');
  const entry = event.target.closest('.menu-entry');
  if (trigger) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const section = primaryNavigation.find((item) => item.id === trigger.dataset.navigation);
    if (section.path) {
      previewDestination(section.label, section.path, section.id);
    } else if (activeNavigation === section.id) {
      closeNavigation(true);
    } else {
      openNavigation(section.id);
    }
  } else if (entry) {
    event.preventDefault();
    event.stopImmediatePropagation();
    previewDestination(entry.dataset.menuLabel, entry.dataset.menuDestination, activeNavigation);
  } else if (!flyout.contains(event.target)) {
    closeNavigation();
  }
}, true);

document.addEventListener('keydown', (event) => {
  const trigger = event.target.closest('[data-navigation]');
  if (event.key === 'Escape' && (activeNavigation || tooltip.matches(':popover-open'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeNavigation(true);
    return;
  }
  if (trigger && trigger.hasAttribute('aria-haspopup') &&
      ['ArrowDown', 'ArrowUp', ...(study.placement === 'left' ? ['ArrowRight'] : [])].includes(event.key)) {
    event.preventDefault();
    openNavigation(trigger.dataset.navigation, event.key === 'ArrowUp' ? -1 : 0);
    return;
  }
  if (!flyout.matches(':popover-open') || !flyout.contains(event.target)) return;
  const entries = [...flyout.querySelectorAll('.menu-entry')];
  const current = entries.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 :
      (current + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
    entries[next].focus();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    closeNavigation(true);
  } else if (event.key === 'Tab') {
    const origin = document.querySelector(`#nav-${activeNavigation}`);
    closeNavigation();
    origin.focus();
  }
}, true);

document.addEventListener('preview-detail-opening', () => closeNavigation());
window.addEventListener('resize', placeFlyout);
window.addEventListener('blur', () => closeNavigation());
window.addEventListener('scroll', placeFlyout, true);

const initialMenu = params.get('menu');
if (Object.hasOwn(menuContent, initialMenu)) openNavigation(initialMenu);
