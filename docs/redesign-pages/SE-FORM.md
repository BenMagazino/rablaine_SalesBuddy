# SE-FORM: Edit Solution Engineer

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Content consistency sweep, October 8, 2026
- Identity and POD assignment choices are two field groups in one manual form,
  not separate reading/work areas. Keep the 1152px root and 1080px field layout.
- Preserve all assignment choices, labels, saved records and explicit save behavior.
- Private evidence: `consistency-se-form-{before,after,light-after}.png`.
- Uncommitted correction only; no checkpoint advancement.

## Readable-width rollout, October 7, 2026
- `/solution-engineer/10/edit`: 1152px root contains existing 1080px identity/POD tracks.
- Dark/light live desktop has no horizontal overflow; no assignment or save writes.
- Private evidence: `width-entity-se-form-{before,dark-after,light-after}.png`.

- Checkpoint: 73, October 7, 2026. Status: VERIFY, awaiting batch review.
- Baseline: `7a43faab`, approved `e5bde8c3`, plus uncommitted checkpoints 63-72.
- Parent batch stays 63-76; approved effort about 75%, strict DONE counts unchanged.
- Scope: existing Edit only, native form/CSS and shared manual lifecycle extension.
- No New SE, fragment/embed, new provider, route, migration or detail redesign.
- Solution Engineer detail remains the next untouched checkpoint 74.

## Audited behavior and relationships

- Exact POST: `/solution-engineer/<int:id>/edit`, ordinary same-page HTML form.
- Name: text, required, existing default, server trim, no new length restriction.
- Email Alias: optional text, existing alias/blank, jsmith hint, @microsoft.com suffix.
- Specialty: optional select, blank then Azure Data, Azure Core and Infra, Azure Apps and AI.
- No new enum restriction: original POST accepts other specialty strings.
- Unknown existing specialties originally default to blank; that behavior is unchanged.
- `pod_ids`: repeated checkbox strings, alphabetical all-POD choices, current selection.
- Empty choices retain the original MSX account-import guidance.
- Success trims identity, blank optionals become None, replaces direct POD memberships.
- Missing POD records remain ignored; duplicate IDs now resolve to one association.
- Direct territory memberships, created_at, other engineers and sync stay unchanged.
- Required-name failure keeps original edit redirect and exact error, retaining raw input once.
- Malformed POD IDs now return 400 with retained visible entries instead of unhandled failure.
- Storage failures roll back/log, return 500 with honest feedback and raw input for retry.
- Success and Cancel retain `/solution-engineer/<int:id>`; no invented destinations.
- Unlike Edit POD, this original form has editable identity, not read-only synced fields.
- No immediate-save workflow exists here. MSX account import independently creates SEs
  by name/specialty and appends PODs; it is not invoked by edit GET, controls or Cancel.
- Existing directory/detail Edit links and canonical breadcrumb consumers are unchanged.
- Note/engagement attendee search, meeting scraping and SalesIQ roster providers stay intact.

## Native implementation and verification

- Continuous frame, identity fields beside POD choices, owned reading and fixed commands.
- Native shared manual lifecycle preserves fields, selections and both entry-local scrolls.
- Cancel/links/Escape use the native draft guard; browser unload protects unsaved edits.
- Pending manual POST blocks duplicates/navigation without disabling payload fields.
- Server-error entries take precedence over stale history; draft/history failures are visible.
- Isolated `runTests`: `tests\test_ui_se_form.py`, `tests\test_ui_se_directory.py`,
  `tests\test_breadcrumb_entities.py`: 125 passed, including seven new editor tests.
- `node --test` SE/milestone/project/customer/seller/territory form tests: 46 passed.
- Isolated tests cover success/clear, required redirects, failure/rollback/retry, malformed IDs,
  unchanged relationships, empty choices, drafts, validation, pending and discard guards.
- Live defaults match Before exactly: all three fields, three POD IDs/order/check states.
- Desktop stays 1566 x 1167; main x=0/full-width, footer ends at 1167, no document overflow.
- Save/Cancel band stays at y=1084.5; reading spans y=168.09 through y=1084.5.
- Dark/light images inspected; temporary theme attributes restored to original dark.
- Live unsubmitted typing only after no-autosave source proof; Cancel/Keep editing checked.
- Actual Back restores all draft fields/POD choice after native unload confirmation.
- Discard then actual Back restores original fields and clears only this entry's draft.
- Observed POSTs during guarded navigation/Back: none; no live business/preference/sync writes.
- Detail GET is read-only here; normal shell telemetry/cache bookkeeping may still occur.
- Dev server required a normal script restart after reload/request timeouts; left responsive.
- Syntax/editor diagnostics, JavaScript syntax and diff whitespace checks pass.
- Private images: `checkpoint-73-se-form-before.png`, `checkpoint-73-se-form-after.png`,
  `checkpoint-73-se-form-light-after.png`; no private data committed or sent externally.
- Exactly one generic readiness DM accepted: ID `1557456834065866904`, exit 0.
