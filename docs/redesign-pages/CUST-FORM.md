# CUST-FORM: New and Edit Customer
## Checkpoint 61 contract
- IDs: CUST-NEW `/customer/new`, CUST-EDIT `/customer/<int:id>/edit`.
- Status: VERIFY, user-approved October 7; approved batch effort about 75%.
  Strict DONE counts await final reconciliation.
- Baseline: approved HEAD `4e57b1a6` plus preserved uncommitted checkpoints 53-60.
- Implementation SHA is in the page tracker; detail is included as checkpoint 62.
- Files: `customer_form.html`, `ui-customer-form.css`, shared `ui-milestone-form.js`,
  customer route failure rendering, scoped tests, README, page help and changelog.

## Complete field and flow inventory
- Native POST to the current URL; no replacement provider, autosave or JSON payload.
- `referrer` remains hidden and escaped; New keeps its original referrer redirect.
- Required customer `name` and integer `tpid`; native minimum 0, step 1 unchanged.
- Optional `nickname` max 200; `tpid_url` remains URL input max 500;
  `website` remains text input max 500 with its original domain placeholder.
- Optional seller and territory retain blank choices, alphabetical options,
  original relationship data attributes, reciprocal filtering and single-choice auto-selection.
- New query-string seller/territory preselection keeps the existing server rules.
- SE keeps the seller chooser; DSS and session seller mode keep their hidden seller ID.
- Edit-only CSAM appears only with available account-team members, alphabetically;
  selected primary, blank clearing and invalid-member retention remain unchanged.
- Name duplicates remain allowed; TPID uniqueness remains the existing DB constraint.
- Server trimming, integer parsing and nullable optional fields remain unchanged.
- No SE, vertical, color, source, owner or role editor existed here; none invented.
- DAE owner/context, vertical relationships and other unexposed metadata are untouched.
- New does not fetch a favicon or schedule backup; Edit retains changed-domain
  best-effort favicon fetch, blank-site favicon clearing and post-commit backup.
- Save New returns to submitted referrer or the new customer; Edit returns to that customer.
- Cancel in BOTH modes still returns to `/customers`, not the edit detail page.
- Inline Create Seller keeps `/seller/create-inline`, name and exact `redirect_to`;
  original duplicate-name behavior is unchanged. Create Territory still opens a new tab.
- No TPID lookup, import, enrichment or sync command is added to these manual forms.

## Native lifecycle and failures
- Connected frame, identity/ownership regions, owned reading scroll, persistent commands/status.
- Existing shared manual form lifecycle handles keyed, role-aware entry-local history,
  native validation, duplicate/pending submits, discard, beforeunload and Back restoration.
- Restored relationship option visibility and server-defined clean baselines prevent drift.
- Seller dialog uses SBDialog, keeps unsubmitted input and guards native navigation/submits.
- Required/integer validation now renders HTTP 400 with original error copy and raw entries.
- Duplicate TPID and commit failures roll back, log errors and retain escaped retry input.
- All writes/failures are isolated tests; live form QA contains no business submissions.

## Verification and evidence
- Final pytest: 154 passed, 1 deselected; the old note-card `border-info` assertion,
  already documented in checkpoint 60, reproduced in the broader probe (129 passed, 1 failed).
- Exact command: `venv\Scripts\python.exe -m pytest tests\test_ui_customer_form.py tests\test_forms.py tests\test_tpid_import.py tests\test_csam_dae.py tests\test_dss_seller_mode.py tests\test_seller_mode.py tests\test_ui_project_form.py tests\test_ui_milestone_form.py -k 'not test_note_view_shows_opportunity_card' --tb=short`
- JS: `node --test tests\js\ui_customer_form.test.cjs tests\js\ui_project_form.test.cjs tests\js\ui_milestone_form.test.cjs`: 24 passed.
- Node syntax, Python AST/inline script syntax, scoped diagnostics and `git diff --check` pass.
- Live real New/Edit customer 107, 1566x1174: field/value/options parity, native number/URL
  validity, preselection, CSAM draft, Keep editing, actual Cancel/discard and guarded Back verified.
- Both dark/light inspected; QA fields/history/listeners cleaned; Graphite dark restored.
- Zero local non-GET requests; routine existing remote Socket.IO handshake POSTs observed.
  No form-specific MSX/cache/enrichment work; no claim that global shell bookkeeping is absent.
- Private artifacts: `C:\Users\alexbla\.copilot\session-state\f00fceac-0d8b-411e-9cc9-5e17d6e6c9c7\files\`.
- Images: `checkpoint-61-customer-form-new-before.png`, `checkpoint-61-customer-form-new-after.png`,
  `checkpoint-61-customer-form-edit-before.png`, `checkpoint-61-customer-form-edit-after.png`.
- Supplements: both `-after-light.png`, `-edit-draft-after.png`, `-preselection-after.png`,
  `-seller-dialog-after.png`, `-discard-after.png`. Final images inspected, no live CRUD.
- Discord accepted generic DM `1557299806555086931`. Gap: morning approval only.
