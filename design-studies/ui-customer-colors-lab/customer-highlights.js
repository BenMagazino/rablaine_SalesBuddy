let hoveredCustomer = null;
let focusedCustomer = null;

function updateCustomerHighlights() {
  document.querySelectorAll('.calendar-event[data-customer-key]').forEach(entry => {
    const key = entry.dataset.customerKey;
    entry.classList.toggle('customer-highlight',
      key === hoveredCustomer || key === focusedCustomer);
  });
}

function customerEntryKey(target) {
  return target instanceof Element ?
    target.closest('.calendar-event[data-customer-key]')?.dataset.customerKey || null : null;
}

for (const [enter, leave, source] of [
  ['pointerover', 'pointerout', 'pointer'],
  ['focusin', 'focusout', 'keyboard']
]) {
  document.addEventListener(enter, event => {
    const key = customerEntryKey(event.target);
    if (!key) return;
    if (source === 'pointer') hoveredCustomer = key;
    else focusedCustomer = key;
    updateCustomerHighlights();
  });
  document.addEventListener(leave, event => {
    const key = customerEntryKey(event.target);
    if (!key || key === customerEntryKey(event.relatedTarget)) return;
    if (source === 'pointer') hoveredCustomer = null;
    else focusedCustomer = null;
    updateCustomerHighlights();
  });
}
