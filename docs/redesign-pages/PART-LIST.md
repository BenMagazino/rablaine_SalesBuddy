# PART-LIST: Partners directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/partners`: opt-in root now centers heading, commands and table at 1152px.
- Live desktop 1559px: no horizontal overflow in either theme; shell stays full-width.
- Private evidence: `width-entity-partners-list-{before,dark-after,light-after}.png`.
- Scope verification: 261 entity UI tests, including explicit wider-detail bounds.

- Checkpoint 80, October 7, 2026. VERIFY, pending the user's batch review.
- Audited baseline `7a43faab`, approved implementation `e5bde8c3`, plus existing 63-79.
- No commit/current-revision claim; effort remains 75%, DONE unchanged.
  [Forms 81](PART-FORM.md) are implemented and VERIFY; detail 82 is next.

## Original contract, sources and consumers
- `/partners` retains `Partner.query.order_by(Partner.name).all()`, including no-note partners.
- No original directory filter, role/seller restriction, pagination, sync or file-import/export
  control existed. No new business population or fields are introduced.
- Retain names/IDs, cached favicons/fallback, nullable 0-5 rating, every specialty link,
  complete partner-contact count and all-date/all-customer linked-note count, including zero.
- Original five axes are preserved; empty rating cells omit redundant placeholder labels.
- Overview/website/timestamps and contact title/email/primary/photos were not directory columns;
  detail/forms, attendees, note selectors, recommendations, customer backup/restore and
  SalesIQ search/contact providers retain their existing fields and scope.
- Browse menu, canonical breadcrumbs, forms' Cancel/create redirects and delete redirects
  continue consuming the same standalone route. No embedded directory clone existed.
- Original directory command calls `Share.openShareModal('directory')`; note and partner
  consumers keep the same global API, original IDs and their independent serialization GETs.
- Sharing export is `/api/share/directory`: name, overview, rating, website, favicon,
  specialties and contacts containing name/email/is_primary. No contact title/photo or
  linked customer notes are silently added. Backup exports are separate and untouched.
- Recipient selection emits `share_request`; only acceptance fetches exports and emits
  `share_data`. Incoming directory data POSTs `/api/share/preview`, a read-only provider.
- Preview retains New/Updated/No Changes, website/rating/specialty/contact changes,
  primary markers, full-overview tooltips, favicon inclusion and original checked defaults.
  Select All, Deselect All and Select New Only are preserved.
- Only Import Selected POSTs `/api/share/receive`; successful partner imports retain
  the original delayed directory/detail reload. Accepted note import retains its separate
  original `/api/share/receive-note` behavior and is not exercised live.

## Native implementation and coupled fixes
- Continuous desktop surface, persistent commands/status, readable 1180px flat table,
  full specialty wrapping and independent scroll. Native Name/Rating/Specialties/Contacts/
  Notes sorts use raw keys, unavailable-last and export labels; Back restores both axes.
- Shared teammate/import dialogs now use SBDialog once for all original consumers.
  Local teammate search, online/allowlist badges and offer Accept/Decline remain intact.
- Cancel, Escape, close and backdrop clear waiting share intent; late/wrong-recipient
  acceptance cannot export. HTTP/JSON errors cannot emit invalid exported payloads.
- Pending imports block duplicates, dismissal/navigation and selector changes. Failures
  retain review/selection for retry; server import errors rollback and log before HTTP 503.
- Payload-index selection fixes canonical-name matching and duplicate-name ambiguity.
  Zero rating remains visible in both new and updated previews. Active review is not overwritten.

## Verification and private evidence
- Scoped pytest: 252 passed across directory, sharing, favicon, note consumer, navigation
  and breadcrumb tests. JavaScript: 72 passed across directory/share/dialog/sorter suites.
- Visible trusted QA: 30 real partners; five headings both directions in dark, Notes both
  directions in light. Actual partner Back restores descending Rating and 148px reading.
- Specialty links, Manage Specialties and New Partner GET preserve destinations, no submit.
- Real online teammate search hides all peers for an unmatched query without a write;
  cleared query, Escape closes the native dialog and restores Share Directory focus.
- Desktop 1566 x 1167; surface x=0, table 1180px, footer bottom=1167, no horizontal overflow.
- Captured/inspected: `checkpoint-80-partners-before.png`, `checkpoint-80-partners-after.png`,
  `checkpoint-80-partners-light-after.png`, `checkpoint-80-partners-share-after.png`,
  `checkpoint-80-partners-verified-after.png` (final dark directory).
- Observed POST paths: none. Existing shell Socket.IO 400s/disconnects occurred; one early
  offline attempt showed honest no-teammates feedback before the real peer appeared.
- No sync, business import/send, preferences or external private-data actions exercised.
  Ordinary connection/auth, telemetry and read-cache bookkeeping may occur; no unchanged-DB claim.
- Original dark restored; query cleared, dialogs closed, listeners removed, sort cleared/top=0.
- Exactly one readiness DM accepted `1557478025933889670`, exit 0.
  No nested agents, git or gallery edits. Parent owns the same 28-checkpoint gallery.
