# PART-FORM: New and Edit Partner

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/partners/new` and edit share a centered 1152px root; existing 720px fields stay bounded.
- Live dark/light desktop has no horizontal overflow; commands now align with the editor.
- Private evidence: `width-entity-partner-form-{before,dark-after,light-after}.png`.

- Checkpoint 81, October 7, 2026. VERIFY, pending user review with all 63-90.
- Audited baseline `7a43faab`, approved implementation `e5bde8c3`, plus uncommitted 63-80.
- Approved effort stays 75%; strict DONE counts unchanged. No git or gallery edits.

## Original contract and actual consumers
- `/partners/new` and `/partners/<id>/edit` retain standalone manual POST forms.
- Exact submitted fields: required text `name`, optional text `website`, repeated hidden
  `specialty_ids`, hidden `rating`, plain-text `overview` (Notes, five rows).
- Original specialty query is alphabetical; existing associations retain their original
  order. Search excludes selected IDs, matches case-insensitively and shows descriptions.
- Preserve arrow/Tab cycling, Enter selection/creation, pointer selection, remove and Escape.
- Stars retain 1-5 selection, local hover preview and Clear. Blank means null; existing zero
  stays zero with Clear available. Out-of-range integer POSTs still normalize to null.
- Name/website/overview/rating trim on Save; empty optional values become null.
- Website domain extraction, changed-only favicon refresh, unchanged favicon retention,
  blank-website favicon removal, backup-on-success and existing success flashes remain.
- Both successful saves open Partner Details. New Cancel opens Partners; Edit Cancel
  opens this partner. Required-name validation retains its original same-path redirect.
- There are no contact or color fields. Contacts (title/email/primary/photo), linked notes,
  directory/detail links, canonical breadcrumbs, sharing/backup/SalesIQ consumers stay intact.
- Specialty Create explicitly POSTs `{name}` to `/api/specialties/create`, immediately.
  It retains `{id,name,description,existed}` and case-insensitive deduplication.
  Creating a specialty does not save its association or the partner; Cancel does not undo it.

## Native implementation and tightly coupled fixes
- Continuous desktop frame, 720px identity/editor column, persistent Save/Cancel/status,
  original manual labels, native dialog, keyboard rating buttons and specialty combobox.
- Safe JSON catalog and text-built suggestions/tags retain quoted names and descriptions.
- Reuse shared manual lifecycle, SBDialog and entry-local history, not persistent storage.
- Dirty fields, rating, query and repeated associations guard leaving; Back restores them
  and reading position. Keep editing/discard protect only this form's draft.
- Manual and immediate pending writes block leaving/duplicates without disabling POST fields.
- Specialty failure retains the query and selection, logs and shows the actual error for retry.
- Database write failures rollback, log context and retain escaped manual entries with HTTP 500.
  Immediate creation failures rollback and return HTTP 503 with an explicit error.
- Required/malformed integer redirects retain raw fields path-locally once; malformed JSON/name
  API payloads return HTTP 400 instead of uncaught errors. No invented routes/migrations/autosave.

## Verification and private evidence
- Isolated `runTests`: 140 pass across `test_ui_partner_form.py`, `test_partner_favicon.py`,
  `test_ui_topic_form.py`, `test_ui_partners_directory.py`, `test_breadcrumb_entities.py`.
- `node --test`: 81 pass across Partner and all existing shared manual-form lifecycle suites,
  plus native dialog/help inventory. Help keeps 78 unique entries and exact Partner routes.
- Editor diagnostics, JavaScript syntax and six new/replaced file whitespace checks pass.
- Visible tab `cc41b93a-2802-456d-b0ac-4a263bd162e9`: real New/Edit in dark/light,
  trusted local stars/Clear, specialty remove/reselect, query arrows/Escape and draft guards.
- Real Back/Forward restores an unsubmitted Edit draft; confirmed discard returns original
  values. One Playwright Forward protocol failure recovered using native browser navigation.
- Desktop 1566 x 1167 unchanged; surface x=0, editor=720px, footer bottom=1167, no overflow.
- Saved/inspected `checkpoint-81-partner-new-before.png`, `checkpoint-81-partner-new-after.png`,
  `checkpoint-81-partner-edit-before.png`, `checkpoint-81-partner-edit-after.png`,
  `checkpoint-81-partner-new-light-after.png`, `checkpoint-81-partner-edit-light-after.png`,
  `checkpoint-81-partner-discard-light-after.png`. Private session artifacts, not git.
- Observed POST paths: none. No live saves, creates, sends/imports or preference writes.
  Normal read-cache/auth/telemetry bookkeeping and existing Socket.IO 400s may occur.
- QA drafts cleared, listener removed, original dark theme and Partners directory restored.
- Exactly one generic readiness DM accepted `1557480740734898371`, exit 0.
- Partner Details checkpoint 82 is now implemented and VERIFY:
  [evidence](PART-VIEW.md). Native contacts/photos and meeting review retain the original
  editor/POST consumers. Specialties directory 83 is next; all 63-90 await user review.
