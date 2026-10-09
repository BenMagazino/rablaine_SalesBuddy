const customerHues = [25, 155, 260, 90, 300, 55, 350, 215, 285, 175,
  45, 195, 30, 310, 80];

function customerKey(item) {
  return item.is_general || item.unmatched ? null : item.customer;
}

function buildCustomerColorMap(events) {
  const colors = new Map();
  for (const kind of ['Note', 'Ghost meeting']) {
    const ordered = events.filter(item => item.kind === kind).slice()
      .sort((left, right) => left.day - right.day);
    for (const item of ordered) {
      const key = customerKey(item);
      if (key && !colors.has(key)) colors.set(key, colors.size % customerHues.length + 1);
    }
  }
  return colors;
}

const customerColorMap = buildCustomerColorMap(snapshot.events);

function customerColorAttributes(item, index) {
  const key = customerKey(item);
  if (!key) return '';
  const slot = customerColorMap.get(key);
  if (!slot && index === null) return '';
  if (!slot) throw new Error('Missing fictional customer color');
  if (index === null) return ` data-customer-color="${slot}"`;
  return ` data-customer-key="${escapeHtml(key)}" data-customer-color="${slot}"`;
}
