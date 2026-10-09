# SPEC-VIEW: Specialty detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Creator width review correction, October 8, 2026
- Remove the redundant 1000px partner-table cap; fill the existing bounded pane.
- Outer 1152px root, description reading, partner values and manual commands stay unchanged.
- Private revision: `specialty-detail-pane-fill-{before,after,light-after}.png`.
- Actual dark/light 1559x1174 desktop: table fills all 1135px usable width instead
  of 1000px. All nine associated partners remain; no horizontal overflow.
- Combined detail/directory/width-policy regression: 90 Python and 11 JavaScript pass.
- Prior capped-table photos are superseded; changes remain uncommitted.

## Readable-width rollout, October 7, 2026
- `/specialties/11`: 1152px root aligns commands with the existing 1000px partner table.
- Dark/light live desktop has no horizontal overflow.
- Private evidence: `width-entity-specialty-detail-{before,dark-after,light-after}.png`.

- Checkpoint 85, October 7, 2026: VERIFY, unreviewed and uncommitted.
- Approved implementation remains `e5bde8c3`; approved effort remains 75%.
- Preserve 63-84; all 63-90 await review. No git, gallery or Notes 86 changes.
- Audited original standalone template, partners provider/models, delete action,
  favicon macro, directory/forms/partner detail consumers and canonical ancestry.

## Original contract and parity
| Surface | Preserved observable contract |
| --- | --- |
| Provider | `GET /specialties/<id>`; all associated partners, no role/date restriction |
| Identity | Full escaped name and optional full description; existing title/context |
| Listing | Original case-insensitive Jinja name order; exact total partner count |
| Partners | Original detail URLs and favicons; contacts omitted at zero, notes always shown |
| Counts | Original singular/plural contact text and raw contact/note relationship counts |
| Edit | `/specialties/<id>/edit`; unchanged manual fields and success redirect |
| Delete | Native confirmation; original warning and `POST /specialties/<id>/delete` |
| Success | Original success flash and `/specialties` redirect; partners are not deleted |
| Empty | Original no-partners guidance; missing detail returns 404, delete GET is 405 |
| Consumers | Directory, Partner directory/detail, forms and breadcrumbs retain destinations |
| Context | Partner ratings, names, other specialties, contacts and linked notes remain intact |

## Native implementation
- Continuous bounded frame; partner table fills its reading pane, not a card/grid.
- Persistent Edit/Delete, partner scope/count and status; independent reading region.
- Optional description keeps newlines and has its own bounded reading position.
- Name, Contacts and Notes sort both ways with raw text/integer keys and export labels.
- Shared sorter/dialog load once; no Bootstrap-owned detail markup. Entry-local
  identity and both reading axes merge with sorting/unrelated history.
- Native row navigation respects links, modifiers and canceled events.
- Cancel/autofocus, Escape and close guards use existing native dialog lifecycle.
- Pending delete blocks duplicate submit, close, shell links and unload; pageshow resets.
- SQLAlchemy deletion failures roll back, log route/ID, flash a real error and return here.
- No new fields, tools, routes, autosave, exports, model changes or population changes.
- Context help adds one unique detail pattern; current help inventory is 80.

## Verification and private evidence
- 154 isolated pytest: Specialty detail (8), directory (8), forms (11) and breadcrumbs.
- 52 isolated pytest: Partner detail/form/directory; 206 total, 112 legacy warnings.
- 61 Node tests: Specialty detail/history, Specialties directory, native sorter/dialog/help.
- Delete and commit failures preserve all associations; success preserves partner/contact/
  note records, other specialties and zero/five/unrated rating context. No live deletion.
- Diagnostics/syntax/whitespace pass; explicit pytest supersedes stale editor discovery.
- Visible trusted QA on new actual-dev tab `081c7d62...`: all three sorts both ways,
  Partner/Edit GET links, partner specialty backlink, directory ancestry and actual Back.
- Native dark/light Cancel focus/closure, Escape, F1/help dismissal verified without writes.
- Visible 1566 x 1167: frame x=0, y=78, bottom=1143; status bottom=1167; no document overflow.
- Early preferred-tab/new-tab probes timed out while hidden. New tab became visible after
  activation; trusted QA then passed. No DOM-click substitute or viewport resize used.
- Actual Before is 1024 x 768; host attachment later supplied 1566 x 1167 for After.
  Photos are genuine, but not a same-size comparison. Live rows fit; nonzero reading
  offsets, description overflow, empty states and escaping have isolated coverage.
- Four inspected photos: `checkpoint-85-specialty-detail-before.png`,
  `checkpoint-85-specialty-detail-after.png`, `checkpoint-85-specialty-detail-light-after.png`,
  `checkpoint-85-specialty-delete-guard-after.png`; earlier photos untouched.
- Exact observed POST paths: none in monitored trusted QA. Before monitoring incomplete.
- Dark/default ordering restored, own history/listeners cleared; preferred directory
  and protected drafts untouched. Shell read-cache/telemetry and Socket.IO 400s may occur.
- One generic readiness DM accepted: `1557491923344953367`, exit 0; no private data sent.
- Next: Notes directory 86, not redesigned here. DONE counters remain unchanged.
