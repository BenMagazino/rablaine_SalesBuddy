# NT-FORM: New and Edit Note Template

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## October 8 reading-width revision
- Shared New/Edit template uses a centered 1152px root; editor/toolbar retain 992px.
- Live New form dark/light at 1559x1167: editor and pinned commands fit without overflow.
- Evidence: `width-workflow-template-form-{before,after,light-after}.png`.
- Revision is uncommitted and awaiting review; batch approval remains pending.

- Final integration: 901 scoped pytest and 379 JavaScript tests pass.
- Failed create/update POSTs now retain Home > Settings > New/Edit Template
  ancestry; isolated failure tests verify actual links and the current label.
- Shared static renderer discovery includes helper-rendered forms and failure
  paths, without lowering the existing 90-page coverage requirement.

## Checkpoint and scope
- Checkpoint 88, October 7, 2026: VERIFY, unreviewed and uncommitted.
- Approved baseline remains `e5bde8c3`, approved effort 75%; all 63-90 await review.
- Preserve 63-87. Stop before Opportunity detail 89; parent owns gallery and the
  known static breadcrumb 90-versus-72 inventory reconciliation.
- Audited original form, Quill scripts, routes/model/backups, Settings management
  and customer/general defaults, Note New/Edit insertion and draft-first defaults.

## Original contract and parity
| Surface | Preserved contract |
| --- | --- |
| New | GET `/templates/new`, POST `/templates`, empty name/content |
| Edit | GET `/templates/<id>/edit`, POST `/templates/<id>`, saved name/HTML |
| Name | `name`, text, required, maxlength 200, original placeholder, no autofocus |
| Content | `content`, hidden textarea, no HTML required attribute; empty-text editor guard |
| Formats | Heading 1/2/3/Normal, bold/italic/underline/strike, numbered/bullet lists, indent, link, clean |
| Commands | Create Template / Update Template; Cancel and Back to Settings go to `/preferences` |
| POST | Original strip normalization, required flashes, same-form error redirects |
| Success | Original backup invocation and success flash, redirect to Settings |
| Associations | Customer/general default FKs and original created timestamps untouched |
| Consumers | Name-sorted API/list, Settings selection/Edit/delete/defaults, Note selector and defaults |
| Insertion | Explicit mouse/Enter/Space applies, arrows do not; empty replace, nonempty Replace/Add to top |

## Implementation
- Continuous native frame and tokens; retained Quill engine, no Bootstrap-owned form markup.
- Single 992px working width for name, toolbar and editor; viewport-sized content
  scrolls internally without manual resize, commands and status remain pinned.
- Shared manual lifecycle adds path/entry-specific template drafts and editor
  selection/scroll restoration, dirty Cancel/links/unload and pending/duplicate guards.
- Inert escaped raw HTML keeps unchanged POST bytes; Quill clipboard/setContents
  handles display/restoration and real edits update the exact content field.
- Shared display sanitizer removes executable nodes/attributes/URLs, keeps trusted
  formatting and safe links; applies to editor/history and actual Note insertion/defaults.
- Stored HTML/API remain unchanged; required redirects retain raw input once.
- SQLAlchemy failures roll back, log context and retain raw entries. Rich draft
  history is debounced, flushed before navigation/POST to avoid Chromium throttling.
- No autosave, invented fields/routes, preference writes or model migrations.
- Contextual help inventory is 81 unique routes; all coupled assertions updated.

## Verification and private evidence
- 303 isolated pytest pass: template native/original (39), Topic/Specialty/breadcrumb
  entities (150), all other shared manual form consumers (114). 92 legacy warnings.
- 99 Node cases pass: template editor/lifecycle/actual Note insertion/sanitizer,
  all shared manual form consumers and native dialog/help. Diagnostics clean.
- Desktop 1566 x 1167 unchanged; frame x=0/y=78/bottom=1143, status bottom=1167.
- Trusted New italic/list and Edit bold selection produce retained rich HTML;
  Keep/discard, native unload and actual Back/Forward preserve both raw drafts.
- New F1/Escape, themes and sanitizer pass; trusted 60-line typing scrolls 322px,
  keeps toolbar pinned and restores exact HTML/scroll on actual Back/Forward.
- Seven private photos, all After images inspected:
  `checkpoint-88-nt-form-{new,edit}-{before,after}.png`,
  `checkpoint-88-nt-form-{new,edit}-light-after.png`,
  `checkpoint-88-nt-form-draft-guard-after.png`.
- No POST paths observed during monitored trusted QA. Initial Before/reload
  monitoring incomplete; shell read-cache/telemetry and existing Socket.IO 400s can occur.
- No live creates/saves/deletes/default saves or protected Note draft navigation.
- Ordinary Note consumer tested isolated, not opened live because it autosaves drafts.
- A bulk multiline insertText automation probe hit Quill/host errors. Restoring
  via Quill's API and normal trusted typing pass without errors; bulk insertText
  is not claimed as covered. Earlier history throttling is fixed and regression-tested.
- QA drafts discarded; dark theme and original Search URL restored. Visible QA ID:
  `deaa7837-858e-4e7c-91df-f35b05d02e1b`.
- One generic readiness DM accepted: `1557501812741906463`; no private content sent.
