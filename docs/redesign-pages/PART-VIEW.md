# PART-VIEW: Partner detail

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## Readable-width rollout, October 7, 2026
- `/partners/29`: opt into the shared 1344px wider bound, not the default 1152px.
- Independent contacts/notes panes retain 760px/400px minima; observed tables are 789px/522px.
- Live dark/light desktop: centered x=107.5px, zero document or pane horizontal overflow.
- Private evidence: `width-entity-partner-detail-{before,dark-after,light-after}.png`.
- Wider-bound and shared modal scope regression: 46 focused detail tests pass.

- Status: VERIFY. Checkpoint 82, October 7, 2026; awaiting user review.
- Prior approved implementation: `e5bde8c3`. Checkpoints 63-82 stay uncommitted.
- Route: `/partners/<id>`; original provider and all actual link consumers audited.
- Approved effort stays 75%; strict DONE counters and the parent gallery are unchanged.

## Complete original contract

- Preserve identity/favicon, nullable or zero five-star rating, every specialty link,
  escaped multiline partner notes and original empty/add-notes states.
- All contacts remain available in original source order until explicitly sorted:
  name, title, email/mailto, primary indicator, cropped/full photo and original actions.
- Add/Edit retain `contact_name`, `contact_title`, `contact_email`, `is_primary=on`.
  POST `/partners/<id>/contacts/new` and `/partners/<id>/contacts/<cid>/edit`.
  Existing edit semantics retain primary status when its checkbox is unchecked.
- Set primary is still immediate: POST `/partners/<id>/contacts/<cid>/primary`.
  Native confirmations submit contact `/delete` or `/partners/<id>/delete`;
  deleting a partner unlinks, never deletes, its notes.
- Clipboard photos still use POST `/api/partner/contact/<cid>/photo` with
  `photo_b64` or null, original crop provider and full-image inspection.
- Linked notes retain favicon/name, links, 150-character excerpts, local call dates/times and newest-first default.
- Consumers remain Partners/forms, notes/customer fragments, Topic/Specialty detail,
  engagement recommendations, breadcrumbs/read tools and inline Partner GET/PUT.
- Meeting flow preserves existing-domain direct scrape and contact-email suggestion,
  normalized domain PUT `/api/partners/<id>` with complete existing associations
  and contact IDs, then POST `/api/partners/<id>/scrape`.
- Review preserves original notes above the separator, editable selected overview,
  new/already-added specialties and new/unchanged/fill-only-updated contacts.
  Import Selected POSTs the original `{contacts, specialties, overview}` to
  `/api/partners/<id>/scrape/apply`; genuine empty results retain Try Again.
- Share delegates partner/id to the existing native sharing controller and reviews.

## Native implementation and tightly coupled fixes

- Continuous frame, compact bands, independent overview/contact/note scrolling and status rail.
- Six native data sorts reuse raw keys, unavailable-last and independent Back state; actions do not sort.
- Native dialogs retain nested focus, drafts, dirty cancellation and failed entries.
  Pending photo/domain/search/import writes block switching or leaving.
- Failed database writes roll back/log; exact form entries return to their retry dialog.
  Invalid photos and unreadable AI results are explicit failures, not empty successes.
  Imported existing contact IDs must belong to the target partner.

## Verification and private evidence

- Scoped pytest: 234 pass across detail/forms/directory/sharing/favicon/breadcrumbs.
  Activated repo venv; command: `& C:\dev\SalesBuddy\venv\Scripts\python.exe -m pytest tests\test_ui_partner_detail.py tests\test_ui_partner_form.py tests\test_ui_partners_directory.py tests\test_partner_sharing.py tests\test_partner_favicon.py tests\test_breadcrumb_entities.py -q`.
- Scoped Node: 95 pass across detail/forms/directory/sharing/sorter/dialog-help suites.
  Command: `node --test tests\js\ui_partner_detail.test.cjs tests\js\ui_partner_form.test.cjs tests\js\ui_partners_directory.test.cjs tests\js\ui_share.test.cjs tests\js\ui_table_sort.test.cjs tests\js\ui_dialog.test.cjs`.
- Isolated coverage: every manual write, rollback/retry, photos, mocked WorkIQ, parse/timeout/network/apply failures, selected payloads and sharing lifecycle.
- Trusted QA: both themes, real notes/editor/Back, bidirectional contact/date sorts, Add/Edit/discard/keep-editing/delete Cancel and photo Close.
- Desktop remains 1566 x 1167; document height 1167, footer bottom 1167;
  populated contacts fit 924px without horizontal overflow; compact editor width 560px.
- Photos: `checkpoint-82-partner-detail-{before,after,light-after,populated-after,contact-edit-after,contact-light-after}.png`; all After images saved and inspected privately.
- Business POSTs: none observed. Failed shell POST `/socket.io/`: exact query in private `checkpoint-82-observed-requests.txt`.
  Listener missed that failure; initial traffic was not fully captured. No live business/AI/share actions.
  Read-cache/auth/telemetry may occur; existing Socket.IO 400/CORS failures persist.
  Sparse live notes do not prove nonzero scroll restoration; isolated history tests do.
- Syntax/editor diagnostics pass; new-file whitespace is clean (legacy route whitespace remains).
- QA drafts/listener cleared; original dark theme and Partners directory restored.
- Exactly one generic readiness DM accepted `1557485509943500842`, exit 0.
- Stop here. Specialties directory checkpoint 83 is next, not redesigned here.
