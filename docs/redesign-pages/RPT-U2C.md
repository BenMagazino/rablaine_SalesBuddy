# RPT-U2C: U2C Attainment

## Content consistency review

Latest evidence: `consistency-reports-u2c-{before,after,light-after}.png`.
Earlier captures below are preserved as superseded comparisons. This single
reading composition stays 1152px and surface-backed in both themes. Fiscal
values, trend chart and semantic attainment fills are unchanged.
Complete measurements and source audit: private `consistency-reports-results.json`.

- Checkpoint: 43, `feature/ui-redesign`.
- Audited revision: `55c4bc9c`.
- Status: VERIFY, technically checked and user-approved October 6, 2026.
- Approved implementation committed locally as `deac029f`.
- Approved overall effort is about 48%; final inventory reconciliation is separate.

## Readable-width follow-up, October 7, 2026

- The standalone title, quarter/workload filters, metrics, trend and milestone queues
  share a centered 1152px reading frame; the app/context/status strips remain full-width.
- The chart still uses the complete quarter and all retained series. Queue columns,
  frozen/live totals, filtering, agenda actions and embedded ownership are unchanged.
- Actual dev desktop, unchanged 1559x1167: x=203.5, width=1152; shell width=1559.
  Dark/light chart and queue checks show no internal horizontal or document overflow.
- Inspected private evidence: `width-report-reports-u2c-before.png`,
  `width-report-reports-u2c-after.png` and its `light-after` counterpart.
- Combined focused width/parity regression: 150 pytest and 178 Node tests pass.
  Prior approval/checkpoint status remains unchanged; no refresh/agenda write performed.

## Contract

- Preserve official quarterly snapshots, scope, frozen baseline calculations,
  live ACR at commitment, the 40% goal and both milestone populations.
- Preserve all weekly trend values and current-quarter live endpoint semantics.
  Trend follows workload only, not seller/customer filters.
- Preserve customer, milestone, engagement and seller 1:1 destinations and
  the existing agenda POST payload. No provider/service or MSX-write changes.
- Refresh imports the current quarter, including when viewing an older snapshot.
- Embed leaves frame, footer and browser history ownership to its host.

## Native implementation

- Shared native window frame, fixed scope/filter bands, five line-separated
  summary metrics, full-width trend and remaining/committed queues.
- Independently scrolling reading region and always-visible shared footer
  with selected quarter and displayed population counts.
- Page-owned Bootstrap classes replaced by native theme components.
- Both queues support six keyboard-accessible data sorts with aria-sort.
  Committed status sorting uses the visible commitment/completion label.
- Chart colors follow the shared light/dark palettes without changing data.
- Saved filters/sorts are validated; storage and refresh failures are visible.
- Back restores reading position and an unsubmitted agenda draft.
- Pending agenda saves reject duplicates and prevent cancellation/dismissal.
  Failed saves retain the draft and restore retry controls.
- F1 explains frozen versus live ACR, filtering, chart scope and write behavior.

## Verification

- Scoped Python suite: 129 passed, including the rendered chart/controller VM harness.
- Native helper tests: 7 passed.
- Corrected date-sensitive test assumptions, not production date semantics:
  chart bounds use the current quarter and live-point fixtures no longer seed future weeks.
- Live totals match baseline: $499,092 pipeline, $42,000 committed,
  8.4% U2C, 2.3% attainment and $457,092 remaining.
- All 79 records, row text, links and eight workload trend series match baseline.
  Remaining/committed populations remain 73 and 6.
- All workload filters reconcile displayed totals and chart data; all seller
  scopes reconcile customer options, displayed records and pipeline ACR.
- Twelve asc/desc keyboard sort combinations checked on both queues.
- Live dark/light chart colors match their shared tokens; Graphite dark restored.
- Browser-local intercepted agenda failure verifies one pending request, protected
  composer, visible failure and retry. Automated harness verifies success and
  empty-input handling. No live agenda write performed.
- Customer drill-down and Back restore scroll and unsaved discussion text.
- Refresh failure checked locally without running an MSXi import.
- Footer remains visible at the desktop window bottom with no document scrolling.
- F1 opens the U2C-specific shared native Help dialog.
- Before/after images remain private session artifacts, not repository content.

## Review gate

- User sign-off received and local commit completed. No push, merge or deployment authorized.
- Discord accepted the generic review-ready DM, message `1557161478539317410`.
  No customer data, screenshots, source or private URLs were sent.

## Snapshot and Today follow-up, checkpoint 44

- Keep every published point unchanged, including one dated today. The prior
  returned-series same-day replacement is removed; stored history was never changed.
- Plot a separate Today diamond using current synced commitment status and
  milestone dollars from the most recent imported snapshot, not local milestone ACR.
- Preserve the published series independently from Today, with raw-point tooltip
  provenance so same-date points cannot be confused by array indexes.
- A single publish or Today-only series remains visible. Historical/final quarters
  keep their published points without a Today marker or Today legend item.
- Live validation across all eight workload scopes confirms unchanged published
  values and one correctly dated Today point. Overall Today is $42,000 and 8.4%;
  its actual hover tooltip identifies both the dollars and Today label.
- Regression checks cover retained same-day snapshots on both rendered charts,
  latest-snapshot dollar basis versus changed local ACR, single-point rendering,
  quarter bounds, filtering and historical/final-quarter exclusions.
- Before/after images: `u2c-live-point-before.png`, `u2c-live-point-after.png`.
- User-approved October 6 and committed locally as `b1574e84`.
  No push, merge or deployment authorized.
