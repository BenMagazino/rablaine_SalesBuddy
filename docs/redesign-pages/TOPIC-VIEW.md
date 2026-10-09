# TOPIC-VIEW: Topic detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/topic/34`: 1152px root contains the six-column table's existing 1000px minimum.
- Dark/light live desktop has no horizontal overflow; all relations/sort axes remain.
- Private evidence: `width-entity-topic-detail-{before,dark-after,light-after}.png`.

- Checkpoint 79, October 7, 2026: VERIFY, uncommitted and awaiting batch review.
- Approved implementation remains `e5bde8c3`; approved effort remains about 75%.
- Prior 63-78 work is preserved. All 63-90 remain pending review; no DONE increase.
- Parent owns the gallery. Partners directory 80 is next, not redesigned here.

## Original provider and actual consumers
- Audited `topic_view.html`, `topics.py`, Topic/Note relationships and all topic links.
- `/topic/<id>` reads the Topic or 404 and sorts its complete notes newest first.
- Scope is all associated notes, without date, seller, role or impersonation narrowing.
- Original identity, full optional description and total note count are retained.
- Every note retains its customer name/favicon/link, customerless fallback, local date,
  optional non-midnight time, seller, territory, all topic and all partner links.
- Preserve original stripped 200-character content previews and note-reader destinations.
- Directory, New-duplicate/Edit-success redirects, breadcrumbs, customer/note details,
  analytics, notes directory and one-on-one topic links all use this same detail route.
- No shared/embedded topic-detail renderer existed; no simplified substitute is added.
- Existing note body, previews, editor, tagging API and SalesIQ providers are untouched.
- Edit keeps `/topic/<id>/edit`; deletion keeps `POST /topic/<id>/delete`.
- Deletion removes only the Topic and note associations, never the associated notes.
- Success messages and redirect to Topics remain; no creation or preference write invented.

## Native implementation
- Continuous desktop frame with identity commands, optional description, scope and status.
- One constrained-width reading table serves the actual job: inspect tagged call context.
- No empty description label or decorative/sidebar/card layout imposed on name-only topics.
- Full descriptions have their own bounded reading axis; notes scroll independently.
- Explicit View note links and non-control row activation retain the original reader.
- Separate relationship links keep their original destinations and semantic identity colors.
- Name, Note date, Seller, Territory, Topics and Partners sort bidirectionally.
- Raw local timestamp and full text keys feed the shared sorter; missing values remain last.
- Default order stays provider newest-first; no persistence or business population change.
- Entry-local Back restores row identity/order, vertical/horizontal and description reading.
- Shared native dialog opens deletion with Cancel focused; Escape/Cancel/close restore focus.
- Pending deletion blocks repeats, dismissal and navigation; pageshow resets pending state.
- Tightly coupled failed-delete handling rolls back, logs context and redirects with real error.

## Verification and private evidence
- `python -m pytest tests\test_ui_topic_detail.py tests\test_ui_topics_directory.py
  tests\test_ui_topic_form.py tests\test_breadcrumb_entities.py -q`: 155 passed.
- Isolated coverage includes original scopes, dates, links, escaping, empty/null data,
  consumer links, delete success/failure, surviving notes and preserved associations.
- `node --test tests\js\ui_topic_detail.test.cjs tests\js\ui_topics_directory.test.cjs
  tests\js\ui_topic_form.test.cjs tests\js\ui_table_sort.test.cjs
  tests\js\ui_dialog.test.cjs`: 62 passed, including help inventory and native guards.
- Live actual-dev 33-note topic: every data axis activated both ways by trusted keyboard.
- Actual row/note/customer/seller/territory/topic/partner/Edit links and Back verified.
- Nonzero 300px reading, exact row order and sorter state restored on actual note Back.
- Checkpoint 77 gap closed here: trusted Notes header Enter both ways, topic-link Enter,
  and actual directory Back retain descending order. No repeat audit or separate DM.
- Both themes at unchanged 1566 x 1167: body/footer end at 1167, no document overflow.
- Photos saved and After inspected: `checkpoint-79-topic-view-before.png`,
  `checkpoint-79-topic-view-after.png`, `checkpoint-79-topic-view-light-after.png`,
  `checkpoint-79-topic-view-dialog.png`. Native F1 help and focus restoration verified.
- Live business writes were not submitted. Observed POST paths: none.
- Normal read-cache/telemetry and existing Socket.IO/CORS errors may occur.
- An early Back probe scrolled its target into view; visible-row retest proves 300px restore.
- Original dark theme restored; QA-only history/listener cleaned. Editor diagnostics clean.
- Exactly one generic readiness DM accepted: `1557473874545873038`, exit 0.
