# TOPIC-FORM: New and Edit Topic

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/topic/new` and edit: 1152px root aligns commands around existing 620px fields.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-topic-form-{before,dark-after,light-after}.png`.

## Checkpoint and scope
- Checkpoint 78, October 7, 2026: VERIFY, awaiting user review and uncommitted.
- Approved implementation remains `e5bde8c3`; approved effort remains about 75%.
- Original shared `topic_form.html`, `topics.py`, Topic model, directory/detail
  consumers, breadcrumbs and existing form/deferred-topic tests audited before edits.
- Parent owns gallery updates; checkpoints 63-77 are preserved. Detail 79 is next.

## Original contract and parity
| Surface | Preserved observable contract |
| --- | --- |
| New | `/topic/new`, same-path manual POST; empty name and description |
| Edit | `/topic/<id>/edit`, same-path POST; saved identity and description |
| Name | `name`, text, required, autofocus; no invented maximum length |
| Description | `description`, optional textarea, four rows, original help text |
| Commands | Save Topic; Cancel always links to `/topics`; no form deletion invented |
| Normalization | Both strings stripped; empty description persisted as null |
| Required | Original danger flash and redirect to the same New/Edit form |
| Duplicates | Exact case-sensitive names; New opens existing detail; Edit redirects to itself |
| Success | New redirects to Topics; Edit redirects to saved topic detail |
| Associations | Existing note links and created timestamp are not rewritten |
| Consumers | Directory New links, detail Edit link and canonical breadcrumbs unchanged |
| Separate writes | JSON API and deferred note-tag creation remain separate, unchanged |

## Implementation and tightly coupled fixes
- Native 100dvh workbench, constrained identity fields, persistent Save/Cancel/status.
- Shared `ui-milestone-form.js` and existing SBDialog own draft, focus and POST lifecycle.
- Entry-local history restores both raw fields and reading position without autosave.
- Dirty Cancel/Escape/links offer Keep editing or Discard; beforeunload protects Back.
- Pending submit keeps payload enabled, blocks duplicates/navigation and resets on pageshow.
- Failed manual SQLAlchemy writes roll back, log context, show real failure and retain input.
- Required/Edit-duplicate redirects retain escaped raw input once on its own form path.
- Fix null descriptions rendering as the literal `None`, which could otherwise be saved as text.
- Contextual New/Edit help is exact; unique help inventory is now 78.

## Verification and private evidence
- Scoped pytest: 164 pass (topic forms/directory, existing forms, breadcrumb entities).
- Shared-form pytest regression: 95 pass, 30 existing SQLAlchemy legacy warnings.
- JavaScript: 73 pass across nine shared form/dialog/help files; editor diagnostics clean.
- Real dev desktop 1566 x 1167, both New/Edit and both themes; no viewport resizing.
- Form spans x=0..1566, y=78..1143; 620px fields; commands end at 1143; status ends at 1167.
- Document width/height exactly match viewport; dark/light native token surfaces inspected.
- Actual trusted typing/Cancel/Keep/discard and beforeunload plus real Back restore both drafts.
- Required native validity reports an accessible message without submitting the form.
- QA drafts/history and request listeners cleared; original dark theme restored.
- Preferred tab stayed hidden despite bringToFront; trusted click timed out honestly.
  New actual-dev tab `cc41b93a-2802-456d-b0ac-4a263bd162e9` was visible and completed trusted QA.
- Seven private photos: `checkpoint-78-topic-{new,edit}-{before,after}.png`,
  `checkpoint-78-topic-{new,edit}-light-after.png`, `checkpoint-78-topic-draft-guard-after.png`.
  Both After comparison pairs and light images saved and visually inspected.
- No POST paths observed during monitored QA. Early Before navigation was not monitored.
  Shell read-cache/telemetry and existing Socket.IO 400 console errors may occur.
- No business writes, autosave, preference writes, exports or external data sends exercised.
- One generic readiness DM accepted: message ID `1557471719424401489`; no private data sent.
