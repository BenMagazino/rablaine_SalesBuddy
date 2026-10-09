# SPEC-FORM: New and Edit Specialty

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/specialties/new` and edit: 1152px root aligns commands around existing 620px fields.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-specialty-form-{before,dark-after,light-after}.png`.

## Checkpoint and scope
- Checkpoint 84, October 7, 2026: VERIFY, unreviewed and uncommitted.
- Approved implementation remains `e5bde8c3`; approved effort remains 75%.
- Preserve checkpoints 63-83; all 63-90 remain pending review. No git/gallery changes.
- Audited original template, partners routes/model, directory/detail/breadcrumb links,
  Partner manual selector/API, note partner flyout and sharing/search consumers.

## Original contract and parity
| Surface | Preserved observable contract |
| --- | --- |
| New | `/specialties/new`, same-path manual POST; empty name and description |
| Edit | `/specialties/<id>/edit`, same-path POST; original saved values |
| Name | `name`, text, required; no autofocus or invented maximum length |
| Description | `description`, optional plain-text textarea, three rows; null displays empty |
| Commands | Create Specialty / Save Changes; Cancel always returns to `/specialties` |
| Normalization | Both strings stripped; empty description persists as null |
| Required | Original error flash and absolute request-URL redirect to the same form |
| Duplicates | Case-insensitive matching; same-form error redirect; Edit excludes itself |
| Success | Original success flash; both forms redirect to saved Specialty detail |
| Relationships | Existing partners and created timestamp remain untouched |
| Separate writes | Partner/note quick creation immediately saves `{name}` to existing API |
| Consumers | Directory New/Edit, detail Edit, breadcrumb, search and sharing unchanged |

## Implementation
- Continuous native frame, constrained fields, persistent manual commands/status.
- Reuse approved topic-field CSS, SBDialog and shared `ui-milestone-form.js` lifecycle.
- Independent `sbSpecialtyForm` entry history restores raw fields and reading position.
- Dirty links/Cancel/Escape and beforeunload guard drafts; Keep/discard are distinct.
- Pending submit blocks duplicate/navigation, keeps POST fields enabled, resets on pageshow.
- SQLAlchemy errors roll back, log exact route, show real failure and retain escaped input.
- Required/duplicate failures retain raw input once on the originating path.
- No new fields/routes/autosave/model changes or quick-creation behavior changes.
- Contextual help adds one unique form pattern: inventory 79, with shared count tests.

## Verification and private evidence
- 177 isolated pytest pass: `test_ui_specialty_form.py` (11), Partner forms, Specialties
  directory, Topic forms and breadcrumb entities; 41 existing SQLAlchemy legacy warnings.
- 83 Node tests pass: Specialty, Topic, Partner, Milestone, Project, Customer, Seller,
  Territory, SE, IC form files and native dialog/help. Editor/syntax checks clean.
- Actual New/Edit at 1566 x 1167, dark/light; no viewport resizing or server replacement.
- Both form bounds x=0, y=78, width=1566, bottom=1143; fields=620px; status bottom=1167.
- Document exactly matches viewport; both After pairs and light/guard photos inspected.
- Trusted typing, Cancel, Keep editing, discard and native required validity verified.
- Actual Back to directory and Forward restore both forms' unsubmitted entries.
- New F1 help/Escape verified. Late Edit help/Tab follow-up navigated away, then pointer
  and keyboard probes timed out; no extra Edit help/Tab coverage claimed.
- QA drafts/listeners cleared; dark theme and original Specialties directory restored.
- Seven photos: `checkpoint-84-specialty-{new,edit}-{before,after}.png`,
  `checkpoint-84-specialty-{new,edit}-light-after.png`, `checkpoint-84-specialty-draft-guard-after.png`.
- No POST paths observed in monitored After QA. Before/initial reload monitoring incomplete.
  Shell read-cache/telemetry and pre-existing Socket.IO 400/CORS errors can occur.
- No business writes, autosave, preferences, exports or remote sharing exercised live.
- Existing note-flyout silent quick-create failure handling is deferred, unchanged here.
- One generic readiness DM accepted: `1557489762657378355`; no private data sent.
- Specialty detail 85 is now VERIFY in [SPEC-VIEW](SPEC-VIEW.md); Notes directory 86 is next.
