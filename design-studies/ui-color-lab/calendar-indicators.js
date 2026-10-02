const indicatorPreview = document.querySelector('#calendar-indicator-preview');
let indicatorOrigin = null;

function hideIndicatorPreview() {
  if (indicatorPreview.matches(':popover-open')) indicatorPreview.hidePopover();
  indicatorOrigin?.removeAttribute('aria-describedby');
  indicatorOrigin = null;
}

function showIndicatorPreview(button) {
  hideIndicatorPreview();
  closeNavigation();
  const marker = calendarIndicators[button.dataset.legendIndicator];
  const example = { time: '11:15 AM', customer: 'Fictional Customer 99', ...marker.example };
  indicatorPreview.innerHTML = `<p class="indicator-eyebrow">Illustrative example / not an application record</p><h3>${escapeHtml(marker.label)}</h3>${calendarEventMarkup(example)}<p class="indicator-description">${escapeHtml(marker.description)}</p>`;
  indicatorPreview.showPopover();
  const origin = button.getBoundingClientRect();
  const size = indicatorPreview.getBoundingClientRect();
  indicatorPreview.style.left = `${Math.max(8, Math.min(origin.left, innerWidth - size.width - 8))}px`;
  indicatorPreview.style.top = `${Math.max(8, origin.top - size.height - 10)}px`;
  indicatorOrigin = button;
  button.setAttribute('aria-describedby', 'calendar-indicator-preview');
}

document.querySelectorAll('[data-legend-indicator]').forEach((button) => {
  button.addEventListener('pointerenter', () => showIndicatorPreview(button));
  button.addEventListener('pointerleave', () => {
    if (document.activeElement !== button) hideIndicatorPreview();
  });
  button.addEventListener('focus', () => showIndicatorPreview(button));
  button.addEventListener('blur', hideIndicatorPreview);
  button.addEventListener('click', () => showIndicatorPreview(button));
});

document.querySelectorAll('[data-navigation]').forEach((button) => {
  button.addEventListener('pointerenter', hideIndicatorPreview);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !indicatorPreview.matches(':popover-open')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  hideIndicatorPreview();
}, true);

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-legend-indicator]')) hideIndicatorPreview();
}, true);
document.addEventListener('preview-detail-opening', hideIndicatorPreview);
window.addEventListener('blur', hideIndicatorPreview);
window.addEventListener('resize', hideIndicatorPreview);
