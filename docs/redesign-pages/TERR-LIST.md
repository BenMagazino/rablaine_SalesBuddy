# TERR-LIST: Territories directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/territories`: heading, commands and five-column results share a centered 1152px root.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-territories-list-{before,dark-after,light-after}.png`.

- Checkpoint: 66, October 7, 2026. Status: VERIFY, awaiting batch review.
- Approved baseline: `7a43faab`, implementation `e5bde8c3`.
- Prior uncommitted checkpoints 63-65 preserved; this checkpoint is uncommitted.
- Parent batch remains 63-76. Approved effort remains about 75%; DONE counts unchanged.
- Scope: `/territories`, its standalone template, owned styling/controller and help.
- Territory forms and detail are deferred to checkpoints 67/68, not redesigned here.

## Audited contract

- Provider: `territories_list()` in `app/routes/territories.py`, unchanged.
- Population: every territory, originally `Territory.name` ascending, no role filter.
- Eager-loaded sellers, direct customers and optional POD remain unchanged.
- Every row retains name/detail destination, optional linked POD and linked sellers.
- Sellers remain alphabetical, including multiple sellers; absent sellers say No sellers.
- Customer count remains `territory.customers|length`, not seller-derived coverage.
- New Territory and empty-state creation retain `/territory/new`.
- Every New Customer link retains its exact `territory_id` query parameter.
- No Edit/Delete, filters, expansion or exports existed in this directory.
- Consumers: Browse navigation, admin link and territory-create/cancel redirects.
- No directory fragment/embed consumer exists; no alternate shell added.
- Existing SalesIQ territory-summary tool remains unchanged.

## Native implementation

- Continuous desktop frame, persistent heading command and compact scope/count rail.
- Flat coverage table with compact rows, independently clickable relationship links.
- Territory name is a keyboard-accessible primary link; row background opens details.
- Name, POD and seller-name columns sort text; Customers uses raw numeric keys.
- Meaningful headers have export labels; Actions is not a sort control.
- Shared `SBTableSort` loads once; unsorted fresh entries keep provider order.
- Owned reading history merges state without replacing unrelated or sorter history.
- Empty directory keeps original copy and both creation links.
- No routes, models, business writes, preferences or data providers changed.

## Verification and private evidence

- `python -m pytest tests\test_ui_territories_directory.py tests\test_views.py -k territor`
  passes: 9 tests, 57 deselected, isolated DB only.
- `node --test tests\js\ui_territories_directory.test.cjs tests\js\ui_table_sort.test.cjs`
  passes: 34 tests. Covers raw sorting, history, row/explicit-link and modifier behavior.
- Live dev: all four original records, POD/seller destinations, customer counts and
  territory-scoped creation links match the captured Before.
- All four meaningful headings toggle ascending/descending; actual detail/Back restores order.
- Actual desktop remains 1566 x 1167. Main/surface span the frame, status ends at y=1167.
- Dark/light screenshots inspected; no horizontal document overflow; original dark theme restored.
- Four live records fit without vertical scrolling; nonzero offset restoration has isolated JS proof.
- Saved private photos: `checkpoint-66-territories-directory-before.png`,
  `checkpoint-66-territories-directory-after.png`,
  `checkpoint-66-territories-directory-light-after.png`.
- Browser request observation across reloads, sort, detail and Back found no POST paths.
- No business write, quick-start/sync or browser interception used; no whole-DB claim.
- Existing shell sharing-hub WebSocket DNS failure observed, unrelated to this migration.
- Editor diagnostics and diff whitespace pass; dev server and protected drafts left alone.
- Exactly one generic readiness DM accepted; message ID `1557441915081982017`, exit 0.
