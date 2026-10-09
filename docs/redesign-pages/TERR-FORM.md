# TERR-FORM: New and Edit Territory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Identity beside duplicate-territory reading now uses 1344px standalone.
- Remove `.tf-layout`'s old 1080px cap; actual paired content reaches 1278px.
- Simple directories stay 1152px; all fields, data and explicit saves remain unchanged.
- Private evidence: `consistency-territory-form-{before,after,light-after}.png`.
- Uncommitted correction only; no checkpoint advancement.

## Readable-width rollout, October 7, 2026
- `/territory/new` and edit: 1152px root retains bounded identity/territory tracks.
- Dark/light live desktop has no horizontal overflow; 1080px field maximum is unchanged.
- Private evidence: `width-entity-territory-form-{before,dark-after,light-after}.png`.

- Status: VERIFY, checkpoint 67, October 7, 2026; user review pending.
- Baseline: `7a43faab` plus uncommitted checkpoints 63-66, all preserved.
- Implementation: uncommitted `feature/ui-redesign`; no invented commit revision.
- Approved effort remains about 75%; strict DONE counters are unchanged.
- Scope: existing `/territory/new` and `/territory/<id>/edit`, one shared template.
- Territory detail is checkpoint 68 and is deliberately not redesigned here.

## Original contract and consumers

- Only POST field is required text `name`; no new fields, length limit or hidden payload.
- New starts empty; Edit uses the stored name. Server trims whitespace.
- New reference lists every territory alphabetically; Edit excludes only itself.
- No territories means no duplicate-reference region, not a fabricated empty list.
- Save New redirects to `/territories`; Save Edit redirects to the same territory detail.
- Cancel in both modes returns to `/territories`; breadcrumbs retain canonical ancestry.
- Blank names retain their original validation messages and same-editor redirects.
- Duplicate New retains its warning and opens the existing territory detail.
- Duplicate Edit retains its warning and same-editor redirect; unchanged names are allowed.
- Rename touches name only: POD, sellers, customers, solution engineers and created_at survive.
- New retains original empty relationships, optional POD and UTC creation default.
- Directory creation, empty-state creation and detail Edit links remain the providers.
- Customer form still opens New in a separate tab; no fragment/embed consumer exists.
- Seller's `/territory/create-inline` is separate and unchanged, including its immediate save.

## Native implementation and coupled fixes

- Continuous desktop frame, owned reading region, alphabetical reference and fixed commands.
- Required input uses native validation and accessible inline error feedback.
- Shared manual form lifecycle retains entry-local name/scroll drafts and existing history.
- Native discard dialog guards navigation; Escape routes through the guarded Cancel link.
- Native POST stays manual, retains enabled payload fields and prevents duplicate/pending leave.
- Back restores drafts; server failure input wins over stale browser history.
- Blank/duplicate Edit redirects retain escaped raw input once on the matching editor.
- Database save failures roll back, log context and show honest retained-input 500 responses.
- No autosave, MSX writes, migrations, new routes or additional generic framework.
- README, contextual F1 help and changelog describe the exact manual workflow.

## Executable and live evidence

- `tests/test_ui_territory_form.py`: 12 isolated inventory/save/failure/validation/provider tests.
- Pytest: five form files plus original territory form/integration selectors, 79 pass.
- Node run: the matching five `tests/js/ui_*_form.test.cjs` files, 38 pass.
- Live actual dev New/Edit checked at unchanged desktop 1566 x 1167, dark and light.
- Live required payload/defaults and reference counts match Before: New four, Edit three.
- Both forms: main y78/h1065, owned reading y168.09/h916.41, commands y1084.5/h58.5.
- Footer y1143/h24; no horizontal overflow, commands and status remain on screen.
- Cancel/Keep editing, required validation, reversion and discard tested without submission.
- Actual browser Back/Forward recovered unsubmitted names in both New and Edit.
- Autosave absence proved in source/tests before typing; observed POST paths: none.
- QA text cleared, own New draft discarded, original dark attributes restored, listeners removed.
- No live create/edit/sync/preferences/quick-start calls; ordinary shell bookkeeping may occur.
- Existing staging sharing-hub WebSocket DNS errors remain unrelated; no page JS errors observed.
- Private screenshots, all inspected: `checkpoint-67-territory-{new,edit}-before.png`,
  `checkpoint-67-territory-{new,edit}-after.png`, and
  `checkpoint-67-territory-{new,edit}-light-after.png`.
- Generic readiness DM: accepted, message ID `1557444280161669190` (exit 0), sent once.
