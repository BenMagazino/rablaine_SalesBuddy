# Seller detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Preserve creator-approved full-width standalone reading and the 355px account pane.
- Full account reading now uses `ui-surface`, not `ui-context`, matching the work pane.
- Preserve badges, hover/selection meaning, workstream controls, sorts and history.
- Private evidence: `consistency-seller-detail-{before,after,light-after}.png`.
- Final captures follow the parent's shared palette/revenue CSS normalization.
  Revenue pane and embedded queue/table match `ui-surface` in both themes.
  Preserve the 1320px dialog, 1270px table and saved 2/7 bucket filter:
  13 alerts remain present, three visible. No horizontal overflow.
- Supplemental evidence: `consistency-seller-detail-revenue-{after,light-after}.png`
  and `consistency-seller-detail-revenue-modal-{after,light-after}.png`.
- Uncommitted correction only; no checkpoint advancement or business-data writes.

## Creator width review correction, October 8, 2026
- Restore the detail page's full-width composition; Sellers directory remains 1152px.
- Customer headers and rows now share the Customers heading's 18px left inset.
- Keep the 355px coverage pane and existing sorting, links, tabs and independent scrolls.
- Live seller with 102 customers: heading, first-column header and row leading edges
  all measure x=18px; root fills the 1559px desktop without horizontal overflow.
- Private evidence: `seller-full-width-alignment-{before,after,light-after}.png`,
  captured at the same 1559x1174 desktop. Earlier bounded photos are superseded.
- Scoped detail/directory/width-policy regression: 90 Python and 14 JavaScript pass.
- Uncommitted, awaiting review; no batch approval or checkpoint advancement.

## Readable-width rollout, October 7, 2026
- `/seller/3`: opt into the shared 1344px wider bound, not the default 1152px.
- The 355px context and 870px engagement minimum fit; live queue/table measures 972px.
- Live dark/light and expanded Engagements: zero document or pane horizontal overflow.
- Private evidence: `width-entity-seller-detail-{before,dark-after,light-after}.png`
  and `width-entity-seller-engagements-expanded-after.png`.
- Wider-bound and shared modal scope regression: 46 focused detail tests pass.

- Status: VERIFY, checkpoint 65, October 7, 2026; user review pending.
- Source: `7a43faab` plus uncommitted checkpoints 63/64; no new commit.
- Batch 63-76 remains uncommitted; approved effort stays about 75%.
- Route: `/seller/<id>`; original seller, customer, milestone and revenue providers.
- Complete body: `partials/seller_view_content.html`, included by `seller_view.html`.

## Inventory and scope

- Retain name, optional email/type, unique sorted PODs, territories and None states.
- Retain every owned customer, favicon, display name and latest-note destination.
- Customer ordering starts with the original saved Date/Name preference.
- Retain 1:1 Notes, role-dependent View as Seller, New Customer and Edit Seller.
- Delete remains a POST, conditional on no customers, with native confirmation.
- Compact milestones retain commitment/status exclusions, due urgency, workload and ACR.
- Stale milestones retain their separate quarter/comment-age population and fallbacks.
- Full View retains the entire seller-locked tracker, filters, exports and source links.
- Revenue retains category, recommendation, risk, review state and saved bucket scope.
- Full Revenue retains the shared list, reviews, product history and original destinations.
- Actual seller engagements use `/api/seller/<id>/engagements`, Active/On Hold only.
- Status, grouping, favorites, story/target/update order and all supplied counts remain.
- The shared native renderer omits unavailable Tasks only for this seller consumer.
- Home's legacy engagement panel and the broader directory's defaults are unchanged.

## Native implementation

- Coverage/customers remain beside tabbed Milestones, Revenue and Engagements reading.
- Functional dividers and compact rows replace fixed-height cards; no invented metrics.
- Data headings sort raw money, dates and counts both ways; owned actions do not sort.
- Seller Full Revenue opts out of action-header sorting; other shared consumers are unchanged.
- Shared SBDialog, SBRecordDialog and milestone/revenue workflows own nested lifecycle.
- Pending favorite/deletion guards and shared draft guards prevent accidental transitions.
- Back restores tabs, independent reading, engagement controls and header sorting.
- Failed deletion rolls back, logs and returns an honest failure on the original detail route.
- README, contextual Help and changelog describe the migrated surface.

## Verification

- Isolated pytest: 65 passed (two existing warnings); seller detail/revamp, milestone preview,
  engagement directory, four Seller view classes and shared Revenue consumer regression.
- JavaScript: 70 passed; seller detail, engagement directory, native dialog, record dialog,
  milestone workflow and revenue preview controller tests.
- Live original/new counts: 21 customers, 6 compact milestones, 12 alerts, 3 engagements.
- Full tracker retains 10 records; existing 2/7 bucket selection shows 6 of 12 alerts.
- Exact customer text/order, milestone titles/order, alert values and engagement IDs match.
- Actual preview/standalone milestone identities and task fields match; parent focus returns.
- Revenue drilldown retains 15 product/total rows, seven months and review controls.
- All 18 owned and 25 shared data headings toggle both ways; product total stays pinned.
- Real 102-customer seller: Back restores customer scroll 210 and Engagements selection.
- Both themes: unchanged 1566 x 1167 desktop; zero body/horizontal overflow, footer y=1143.
- Photos inspected: `checkpoint-65-seller-detail-before.png`, `-after.png`,
  `-after-light.png`, `-engagements-after.png`, `-revenue-after.png`,
  `-milestone-preview-after.png`, `-revenue-preview-after.png` (same filename prefix).
- No business-write controls, quick-start GET, manual sync or saved-theme write invoked live.
- Two early POST paths were not retained; later path-capturing probes observed none.
- Ordinary detail-cache reads and telemetry/connection bookkeeping may occur; no whole-DB claim.
- Existing background gateway DNS errors and SQLAlchemy Query.get warnings remain.
- Seller engagement payload still omits initial favorite/update metadata, as before.
- Generic readiness DM accepted: `1557440618601385997`, exit 0; no private data sent.
