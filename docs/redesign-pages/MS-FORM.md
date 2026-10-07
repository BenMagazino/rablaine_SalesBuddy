# Manual milestone forms, checkpoint 52

- IDs: MS-NEW `/milestone/new`, MS-EDIT `/milestone/<int:id>/edit`.
- Shared template: `milestone_form.html`; only full-page consumers exist.
- Audited baseline: `c7fb7b19`, approved Milestones directory checkpoint 51.
- Status: VERIFY, user-approved October 7; local commit authorized.
- Approved effort: about 61%; strict DONE counters are unchanged.

## Original contract and boundaries

- Exactly two submitted fields: required `url` (native URL input) and optional
  `title` (text). Original names, placeholders, helper text and prepopulation remain.
- New starts empty; Edit uses stored URL/title, including null title as empty.
  No new maxlength, pattern, provider, selector or business validation is added.
- Native POST remains at the current route; whitespace trimming, nullable title,
  duplicate URL checks and unchanged-current-URL exception remain.
- Success retains its original flash and redirect to `/milestone/<id>`.
  New Cancel stays `/milestones`; Edit Cancel stays its existing detail URL.
- Create remains local with no invented customer/MSX association. Edit changes
  only URL/title and the model's existing update timestamp, not other relationships.
- Directory/manual links and shared detail Edit links retain their destinations.
  Details, MSX refresh, sync, tasks, model/schema and embedded bodies are not redesigned.

## Native presentation and tightly coupled fixes

- Shared native frame, ancestry, tokens/Segoe UI and compact status footer.
  One focused field region, line dividers, no Bootstrap form/card/grid classes.
- Fixed Create/Update and Cancel commands remain available while fields scroll.
- Native required/URL validity gains visible error feedback and accessible field help.
- Invalid, duplicate and database-error responses preserve exact escaped input.
  Database failures roll back, log context and return honest 500/error flashes.
- Duplicate submits and pending navigation are blocked; readonly pending fields
  still submit their original names/values. Back restores usable controls.
- Same-tab leaving uses the existing native dialog helper; Back/reload retains
  browser beforeunload protection. Entry-local history restores fields/reading.
- Confirmed discard resets this form and removes only its history namespace.
  No autosave, localStorage or unrelated draft access. History errors are visible.

## Verification and review evidence

- 180 scoped pytest checks pass: `test_ui_milestone_form.py`, `test_milestones.py`,
  `test_breadcrumb_entities.py`, `test_ui_milestones_directory.py`.
- 43 Node checks pass: `ui_milestone_form`, `ui_dialog`, `ui_record_dialog`,
  `ui_revenue_reports` harnesses. Help-map count reconciled with current entries.
- Isolated tests cover exact fields/payloads, relationships, escaping, required/
  duplicate/database failures, rollback, nullable title, original validation and 404.
- Live New defaults and real Edit prepopulation match the original baseline.
  All 1,594 milestone rows have the identical before/after whole-record SHA256.
- Readonly QA covers URL validity, Keep editing, confirmed discard, native Back
  warning and history draft restoration. Zero milestone POSTs are issued live.
- Both forms inspected in Graphite dark/light at the unchanged 1566x1174 desktop;
  footer ends at 1174px, no horizontal overflow. Original dark and fields restored.
- Private session `files`: `milestone-form-new-before.png`, `milestone-form-new-after.png`,
  `milestone-form-edit-before.png`, `milestone-form-edit-after.png`;
  both `milestone-form-*-light-after.png` supplements are inspected.
- Diagnostics, JavaScript syntax and diff whitespace checks pass. Protected pages,
  production and dev server lifecycle are untouched; QA listeners/drafts are cleared.
- Live Edit Cancel/detail navigation is intentionally not followed because detail
  scripts can refresh persisted MSX caches; destination parity is isolated-tested.
- Discord accepted the single generic readiness DM: `1557261541231829055` (exit 0).
