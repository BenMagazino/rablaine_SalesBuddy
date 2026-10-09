# SE-VIEW: Solution Engineer detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Widen assigned-POD/territory reading from 1152px to 1344px standalone.
- Actual `.sed-layout` grows from 1150px to 1342px. Command bands retain `ui-context`;
  both reading panes inherit `ui-surface`.
- The reviewed live engineer has no POD coverage; retain both original empty states.
- Private evidence: `consistency-se-detail-{before,after,light-after}.png`.
- Embeds retain their host width; this correction does not advance checkpoints.

## Readable-width rollout, October 7, 2026
- `/solution-engineer/10`: 1152px root fits minimum 240px POD context and flexible coverage.
- Dark/light live desktop has no horizontal overflow; shared modal fragments do not match.
- Private evidence: `width-entity-se-detail-{before,dark-after,light-after}.png`.

- Status: VERIFY, checkpoint 74, October 7, 2026; user review pending.
- Branch: `feature/ui-redesign`; uncommitted, no push/merge/deployment.
- Audited baseline: `7a43faab` plus earlier uncommitted checkpoints 63-73.
- Parent authorization remains batch 63-76; approved effort stays about 75%.
- Internal Contacts checkpoints 75/76 remain untouched; no strict DONE increase.

## Original contract and actual consumers

- GET `/solution-engineer/<id>` reads identity and alphabetical assigned PODs.
- Email remains the alias-derived mailto destination; optional specialty stays visible.
- Territories are unique across assigned PODs, alphabetical by name initially.
- Customer counts use each territory's complete customer relationship, including zero.
- Direct SE territory assignments are not added to this original POD-derived scope.
- No seller/customer population, created timestamp or MSX sync field is changed.
- Preserve directory, Edit/Cancel, POD roster, note attendee and milestone owner links.
- Full and loaded note/milestone consumers still reach the same native detail endpoint.
- No existing SE fragment endpoint or embed host existed; no route is invented.
- Complete content/dialog/controller lives in the included detail partial.
- Full/partial DOM equality and single shared sorter/dialog loading are tested.

## Native composition and behavior

- Compact identity band above contextual POD and territory coverage cells.
- Connected frame/footer, functional dividers, no cards or stacked default metadata.
- Three meaningful sortable headers: POD Name, territory Name and raw Customers.
- Explicit original links remain independently clickable; plain row space navigates too.
- Entry-local independent reading offsets coexist with shared native table history.
- Delete uses the shared native dialog, preserving all confirmation wording.
- Cancel receives initial focus; Escape returns focus to the Delete opener.
- Exact write paths remain `/solution-engineer/<id>/delete` and `/edit`.
- Duplicate deletion and pending dialog dismissal are blocked; Back reenables controls.
- Failed deletion rolls back/logs and renders an honest retry message with canonical trail.
- Success retains original directory redirect and does not delete PODs or territories.

## Verification and private evidence

- Scoped pytest: SE detail/directory/form, POD detail and breadcrumb entities: 145 passed.
- Node SE detail/directory and native table-sort tests: 37 passed.
- Tests cover populated/empty scope, escaping, full counts, partial parity, actual consumers,
  isolated successful deletion, failed commit/rollback/retry and unchanged relationships.
- Live Before/After preserves three PODs, four territories, email/specialty and all counts.
- Dark all three headings sort both ways; light numeric order also verified both ways.
- Actual Back restores sorted detail after POD navigation; territory row, Edit/Cancel work.
- Directory-to-detail Back restores actual nonzero reading offset 400 and row order.
- Desktop unchanged at 1566 x 1167; document same size, footer exactly y=1167.
- Both coverage cells own auto scrolling; present live rows fit without overflow.
- Nonzero detail offsets tested in isolation, not claimed from short live rosters.
- Dark/light screenshots saved and inspected; original dark attribute restored.
- Photos: `checkpoint-74-se-view-before.png`, `checkpoint-74-se-view-after.png`,
  `checkpoint-74-se-view-light-after.png`, private session artifacts only.
- Live business/preference/sync writes: none; observed shell transport POST `/socket.io/`.
- Necessary shell telemetry/cache bookkeeping may occur; no unchanged-database claim.
- Syntax/editor diagnostics and whitespace checks pass; isolated legacy Query.get warnings.
- Exactly one generic readiness DM accepted: ID `1557458990181388420`, exit 0.
