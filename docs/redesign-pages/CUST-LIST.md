# CUST-LIST - Customer directory

- Checkpoint: 60, October 7, 2026; VERIFY, user-approved, final reconciliation pending.
- Audited baseline: approved HEAD `4e57b1a6` plus uncommitted checkpoints 53-59.
- Approved batch effort: about 75%; implementation SHA is in the page tracker.
  No push/merge/deployment authorized; strict DONE counts await final reconciliation.
- Scope: `/customers`, commands, groups/import; customer forms/detail remain 61/62.

## Preserved contract

- Unchanged route/provider; all current customers in SE mode, exact seller scope
  in DSS and SE seller mode; redundant grouping/seller tags stay absent there.
- Default A-Z, legacy grouped fallback, seller-name/group/customer ordering,
  unassigned group, By Notes descending with name ties, Show/Hide No Notes.
- Customer name, raw TPID/source URL, original cached favicon/building fallback,
  seller name/type/color, territory text, exact note counts and detail/New Note links.
- Grouped single-territory suppression, ordered seller territory links,
  first-plus-more tooltip and count, expanded-seller localStorage keys/IDs.
- No original directory SE, stale, vertical, revenue or date columns existed.
  These underlying relationships/metadata are untouched, not invented as columns.
- No original directory pagination, export command or query filter existed.
  Global customer lookup remains separate; every table heading has an export label.
- Manual entry URL, all import IDs, numeric input and preview fields remain:
  name, TPID, website, territory, seller and vertical/category fallback.
- Explicit lookup `{tpid}` and import `{account}` APIs, duplicate-customer links,
  network/save errors, success details and saved customer navigation.
- Original empty state/creation link; existing draft-note indicators now resolve real row IDs.

## Native implementation

- Continuous frame/footer, persistent commands, owned directory scroll.
- Five real columns sort both ways with raw numeric TPID/note keys;
  grouped tables keep independent keys/order; Actions are not sortable.
- Native seller disclosure and shared `SBDialog` import lifecycle.
- Entry-local Back retains table sorts, group expansion and two scroll offsets.
- Import input has discard/busy guards and never auto-lookups or autosaves.
- Failed preference writes report failure rather than falsely reloading;
  failed imports retain the original preview/input for retry.

## Evidence
- `runTests(files=[tests\test_ui_customers_directory.py, tests\test_tpid_import.py,
  tests\test_seller_mode.py, tests\test_favicons.py])`: 82 passed.
- `runTests`: original `test_views.py` customer list/filter and
  `test_dss_seller_mode.py::TestCustomersListSellerBadge` selectors: 4 passed.
- `node --test tests\js\ui_customers_directory.test.cjs tests\js\ui_table_sort.test.cjs`:
  35 passed, including mounted reading, manual import/failure and shared sorting.
- JS syntax, editor diagnostics and `git diff --check` passed.
- Actual dev: all 210 customer IDs/default order, raw displayed values and links
  match the original fresh list; all five columns passed both sort directions.
- Back through Manual entry restored exact order and scrollTop 654, without typing
  or submitting customer forms. TPID discard refusal retains input; QA input cleared.
- Private files: `checkpoint-60-customers-directory-{before,after}.png`,
  `-before-light.png`, `-after-light.png`, `-import-after.png`, `-zero-matches-after.png`.
- Dark/light/import images inspected; live global-lookup zero matches captured.
- No local non-GET requests during QA; existing partner Socket.IO polling POSTs
  ran automatically. No CRUD/team/sync/AI/autosave was invoked; ordinary page-view
  telemetry may run. No detail-page MSX cache refresh was needed.
- Broader role-file probe: 109 passed, one unrelated legacy note-card
  `border-info` assertion failed; left unchanged outside this checkpoint.
- Grouped/alternate roles: isolated fixtures, no live preference writes; dev keeps By Notes.
- Discord accepted one generic DM: `1557296212623757364`.
- Final batch check fixes a preference-dependent test assumption: all three roles now
  explicitly cover customers with and without notes. Combined scope passes 136 pytest
  and 177 JavaScript checks; no application scoping behavior changed.
