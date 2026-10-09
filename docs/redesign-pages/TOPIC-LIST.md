# TOPIC-LIST: Topics directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Creator width review correction, October 8, 2026

- Remove the 760px brief and 1100px description table caps; fill the bounded pane.
- Outer 1152px working region, descriptions, counts, sorts and saved defaults stay intact.
- Live dark/light at 1559x1174: all 129 topics remain; table fills 1135px usable width
  instead of 760px, without horizontal overflow.
- Private comparison: `review-topics-pane-fill-{before,after,light-after}.png`.
- Earlier capped-table photos are superseded; correction remains uncommitted.
- Combined nine-surface regression: 263 Python and 111 JavaScript tests pass.

## Readable-width rollout, October 7, 2026
- `/topics`: 1152px opt-in aligns heading, sorting and already bounded result tracks.
- Dark/light live desktop: no horizontal overflow; full-width shell is unchanged.
- Private evidence: `width-entity-topics-list-{before,dark-after,light-after}.png`.

- Checkpoint: 77, October 7, 2026. Status: VERIFY, awaiting user batch review.
- Audited baseline: `7a43faab`, approved implementation `e5bde8c3`, plus uncommitted 63-76.
- No commit/revision claim; approved effort about 75%, strict DONE counters unchanged.
- Parent batch is 77-90; preserve prior 63-76 VERIFY and the same private review gallery.
- Scope: directory only. New/Edit forms 78 and topic detail 79 are next.

## Original product contract and consumers
- `/topics` returns every Topic with eagerly loaded complete `Topic.notes` associations.
- No personal, seller-mode, customer or role filtering, pagination or exports existed.
- Preserve topic IDs, names, optional descriptions and all-note counts, including zero.
- Descriptions retain original 150-character truncation; full raw values remain available.
- Initial alphabetic order is Python `name.lower()`, not a new client collator default.
- Saved most-notes order is descending note count with lower-case name tie-break.
- Default preference is `topic_sort_by_calls=False`; its original field name is unchanged.
- New and empty-state creation links remain `/topic/new`; all names/rows open `/topic/<id>`.
- Only standalone directory renderer exists. Browse menu, admin counts, breadcrumbs,
  form Cancel/create redirects and delete redirects consume this same route.
- Independent note tagging, AI suggestions, search and SalesIQ topic providers stay unchanged.
- Original explicit write remains `POST /api/preferences/topic-sort`, JSON
  `{"topic_sort_by_calls": true|false}`; success saves preference and reloads the directory.
- Original preference GET initializes missing preferences; shared request lifecycle does too.
- Directory no longer needs that separate GET just to label its already-rendered default.

## Native implementation
- Continuous desktop frame, persistent commands/status and independently scrolling rows.
- Flat table fills the bounded reading pane, with or without descriptions.
- All-empty Description axis is omitted; populated descriptions remain visible/sortable.
- Name, Description and raw integer Notes sort both ways through the shared sorter.
- Unavailable descriptions stay last; separate shape keys prevent wrong-column restoration.
- Header sorting is temporary entry state, never a preference or business write.
- Back retains native sorter state and nonzero directory reading offsets.
- Explicit Default command retains the saved alphabetical/most-notes workflow.
- Pending saves disable duplicate requests and guard navigation/unload.
- Failed saves roll back, log context, return HTTP 503 and keep the current order for retry.
- Successful default changes reset only this directory's temporary sorts and reading offset.
- Empty guidance, canonical Home > Topics ancestry and all original destinations remain.

## Verification and private evidence
- `python -m pytest tests\test_ui_topics_directory.py
  tests\test_views.py::test_topics_list_alphabetical tests\test_views.py::test_topics_list_by_calls
  tests\test_fy_cutover.py`: 57 passed, including nine directory/default/scope cases.
- `node --test tests\js\ui_topics_directory.test.cjs tests\js\ui_table_sort.test.cjs`:
  38 passed, covering history, raw sorts, exact POST payload and pending/failure guards.
- Live 129 original names/counts/descriptions/order/links match exactly in actual dev.
- Both desktop themes: surfaced Name/Notes axes sort both ways; real Back restores 700px.
- Populated/truncated/escaped descriptions and unavailable-last sorts are isolated coverage.
- Actual row/name detail navigation and New Topic GET work without any submit or typing.
- Desktop 1566 x 1167: x=0 surface, 36.5px rows, footer bottom=1167, no horizontal overflow.
- Photos captured and inspected: `checkpoint-77-topics-directory-before.png`,
  `checkpoint-77-topics-directory-after.png`, `checkpoint-77-topics-directory-light-after.png`.
- QA browser reports hidden visibility: trusted click/Space probes could not activate it.
  Native DOM click events verified controls/navigation at checkpoint 77.
  Checkpoint 79 closes the gap in the visible QA tab: trusted Notes header Enter in both
  directions and topic-link Enter work; actual Back retains descending directory order.
  No repeated directory audit or additional notification was needed.
- Observed POST paths: none. Default write verified only through isolated pytest/JS.
- Original dark attributes restored; temporary QA storage/history/listener removed.
- Normal read-cache/telemetry may occur; no unchanged-database claim. Existing shell 400s remain.
- Exactly one readiness DM accepted: `1557470043158216796`, exit 0.
- Parent handles gallery; no nested agents or git operations.
