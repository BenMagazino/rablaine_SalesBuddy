# NOTE-LIST: Standalone Notes directory

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## October 8 reading-width revision
- Persistent commands and complete note stream share the centered 1152px root.
- Live dark/light at 1559x1167: no reading overflow; full-width status stays pinned.
- Evidence: `width-workflow-notes-{before,after,light-after}.png`.
- Revision is uncommitted and awaiting review; batch approval remains pending.

- Checkpoint 86, October 7, 2026. VERIFY, awaiting user batch review.
- Contract baseline `7a43faab`, approved implementation `e5bde8c3`, preserved 63-85.
- No commit/revision claim. All 63-90 await review; approved effort remains 75%.
- Scope: standalone directory only; Search 87 is next, not implemented here.

## Original provider, flows and actual consumers
- `GET /notes` retains the original route/query, eager loads and newest call-date order.
- Customer ownership scopes session seller mode and linked DSS identity; note seller
  does not determine scope. General notes remain excluded in either seller mode.
- All/Customer/General keep exact filter values and original scope/reset behavior.
- Page defaults to 1, negative pages clamp to 1; per_page defaults to 50, clamps 10-200.
- Original 25/50/100/200 choices and `notesList.perPage` local memory remain.
- Pagination retains filter, page size, edge/current windows and full matching total.
- Identity, favicon, TPID/external link, naive local date and optional non-midnight time,
  stripped 200-character excerpt and every original association remain available.
- Seller links stay hidden in seller mode; territory, topics, partners, engagements
  and truncated opportunity names with full titles and optional state remain linked.
- Empty results keep the shared native quick-note customer/General picker launcher.
- No directory export, import, edit/delete, sharing, autosave or write endpoint existed.
- Browse/Admin and note-form Cancel/delete redirects reach the standalone renderer;
  no template includes it. Full note links still open `/note/<id>`.
- Shared note body/fragment, Home preview and lifecycle, customer/seller/topic/partner
  note consumers, forms/detail and separate Connect Export are unchanged.

## Native implementation and tightly coupled fixes
- Continuous desktop frame; fixed command band, pagination and range/scope status rail.
- Flat chronological articles in a 1120px readable-width, independent scroll region.
- Direct date/excerpt links and row navigation preserve relationship/modified clicks.
- No data table existed; no artificial sorter or authored-rich-text sorting is added.
- Existing SBDialog picker/help and shared assets load once, with no Bootstrap-owned
  directory markup, new framework, API, preferences, model or tool.
- Entry-local horizontal/vertical reading merges history and restores on actual Back.
- History/storage failures log and surface an owned alert; storage failure still
  allows explicit page-size navigation. No business writes from the controller.
- Count/range is now visible even on one/empty page; exhausted pages report 0-0.
- Direct clamped/custom URL sizes display their actual selected value, not a false 25.
- Existing Notes help replaces fictional seller/topic/date filters with real controls.
- One stale detail test now asserts approved native opportunity context, not Bootstrap
  card styling; the approved detail implementation itself was not edited.

## Verification and private evidence
- Activated configured venv; `python.exe -m pytest tests\test_ui_notes_directory.py
  tests\test_general_notes.py tests\test_ui_note_preview.py tests\test_ui_note_body.py
  tests\test_ui_navigation.py tests\test_seller_mode.py tests\test_dss_seller_mode.py
  tests\test_favicons.py`: 201 pass, 14 existing SQLAlchemy deprecation warnings.
- VS Code discovery was stale (188 then zero cases); explicit pytest is authoritative.
- `node --test tests\js\ui_notes_directory.test.cjs tests\js\ui_dialog.test.cjs
  tests\js\ui_record_dialog.test.cjs tests\js\ui_note_actions.test.cjs`: 51 pass,
  including writes, pending/draft/error lifecycle contracts; final directory 13 pass.
- Help inventory stays 80 unique routes. Scoped editor, JS syntax and whitespace checks.
- Trusted live QA: All 91, Customer 82, General 9; page two 26-50; size resets page.
- Actual note/general detail, customer/seller/partner links, row navigation, F1 and
  picker Cancel work read-only. Back restores nonzero reading offset 844px exactly.
- Dark/light Before/After desktop 1566 x 1167, unchanged; no resize/attachment mismatch.
- Surface x=0, reading height 965px, stream 1120px; status bottom 1167, no x overflow.
- Saved/inspected private `checkpoint-86-notes-directory-before.png`, `-after.png`,
  `checkpoint-86-notes-directory-light-after.png` and `-general-after.png`.
- Exact observed POST paths: none in completed monitored QA. No live submit or typing.
- Dark theme/local page size 50 restored; QA listeners removed, protected drafts untouched.
- Read-cache/telemetry and shell socket bookkeeping may occur; no unchanged-DB claim.
- Unchanged detail's delete failure hardening remains outside this directory checkpoint.
- Exactly one generic readiness DM accepted `1557494989301354568`, exit 0.
