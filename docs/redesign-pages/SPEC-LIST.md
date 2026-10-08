# SPEC-LIST: Specialties directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Creator width review correction, October 8, 2026
- Remove the redundant 760px brief and 1100px description table caps.
- Both table shapes fill the existing 1152px bounded content pane; shell stays unchanged.
- Keep optional descriptions, partner counts, Edit, sorting and navigation intact.
- Private revision: `specialties-pane-fill-{before,after,light-after}.png`.
- Actual dark/light desktop 1559x1174: table fills all 1135px of usable reading width
  instead of 760px. All 14 specialties remain; no horizontal overflow.
- Scoped directory/width-policy regression: 81 Python and five JavaScript pass.
- Earlier constrained-table photos are superseded; changes remain uncommitted.

## Readable-width rollout, October 7, 2026
- `/specialties`: heading/actions now share the 1152px root with already bounded results.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-specialties-list-{before,dark-after,light-after}.png`.

- Checkpoint: 83, October 7, 2026. Status: VERIFY, awaiting user batch review.
- Contract baseline: `7a43faab`, approved implementation `e5bde8c3`, plus preserved 63-82.
- No git/revision claim; all 63-90 pending review, approved effort 75%, DONE unchanged.
- Scope: existing directory only. Forms 84 and [detail 85](SPEC-VIEW.md) are now VERIFY.

## Original provider and consumers
- `GET /specialties` uses `Specialty.query.order_by(Specialty.name).all()`, unchanged.
- Every specialty remains visible, with all associated partners counted, including zero.
- No seller, role, note, customer, date, text filter, pagination or export existed.
- Names, IDs, optional descriptions, raw partner counts and relationship scope stay intact.
- Exact description display remains the first 100 characters plus `...` when longer.
- Full descriptions are retained in raw sort values and hover titles, safely escaped.
- Default order stays database name order; both creation links remain `/specialties/new`.
- Each name and row opens `/specialties/<id>`; Edit remains `/specialties/<id>/edit`.
- The directory never had delete, import, sharing, autosave or business-write controls.
- Its only renderer is the standalone template, with no shared/nested partial consumers.
- Partner directory Manage Specialties, existing form Cancel and delete redirects use it.
- Canonical ancestry remains Home > Partners > Specialties through the existing provider.
- Independent partner forms/details, note specialty search/create, AI and SalesIQ providers
  remain unchanged. No new entity, tool, route, filter, form or migration is introduced.
- Existing form/manual POST and detail/delete workflows are audited but not redesigned.

## Native migration
- Continuous desktop frame, persistent New command/status and independently scrolling list.
- Flat table fills the bounded reading pane, with or without descriptions.
- All-empty Description axis is omitted; populated descriptions stay visible and sortable.
- Name, Description and raw integer Partners sort both ways via the existing SBTableSort.
- Actions are not sortable; unavailable descriptions stay last in both directions.
- Separate full/brief sort keys avoid restoring a wrong-column state after shape changes.
- Temporary header sorts never write preferences or change the provider's initial order.
- Per-entry reading offsets merge with sorter/unrelated history, restoring on actual Back.
- Native row navigation preserves existing link controls and modified-click behavior.
- Explicit accessible Edit text replaces unlabeled pencil buttons without changing URLs.
- Page controller is deferred after the shared sorter; no duplicate sorter/dialog assets.
- History failures log context and display an owned alert, not a silent fallback.
- Existing empty guidance and zero counts remain; no Bootstrap-owned directory markup.

## Verification and private evidence
- VS Code `runTests`: `tests/test_ui_specialties_directory.py` and
  `tests/test_breadcrumb_entities.py`, 125 passed, including eight directory cases.
- `node --test tests\js\ui_specialties_directory.test.cjs
  tests\js\ui_table_sort.test.cjs tests\js\ui_dialog.test.cjs`: 53 passed.
- Help inventory remains 78 unique routes; existing Specialties entry updated and tested.
- Editor diagnostics and targeted JavaScript syntax/ASCII/trailing-whitespace checks pass.
- Live 14 original names, counts, descriptions, default order and both link URLs match.
- Visible QA tab `cc41b93a...`: trusted Name/Partners sorts both directions in dark/light,
  actual detail/Edit/New GET navigation and actual Back retain directory sorting.
- F1 opens native contextual help; trusted Close dismisses it without a business write.
- Desktop 1566 x 1167: surface x=0, table=760px, rows=36.5px, footer bottom=1167.
- No horizontal overflow. Nonzero offsets, populated descriptions, zero counts, escaping
  and unavailable-last sorts have isolated coverage; all live rows fit the viewport.
- Captured and inspected private `checkpoint-83-specialties-directory-before.png`,
  `checkpoint-83-specialties-directory-after.png` and
  `checkpoint-83-specialties-directory-light-after.png`; no prior photos overwritten.
- Exact observed POST paths: none. No submit, typing, external send or preference write.
- Dark/default state restored, QA listener/globals removed; read-cache/telemetry may occur.
- No unchanged-database or full-suite claim.
- Exactly one generic readiness DM accepted: `1557487572215930942`, exit 0.
