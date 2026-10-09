# SEARCH: Search Notes workbench

## Current approval / October 8, 2026

User-approved with checkpoints63-90, the width/background review and shared
darker gutters. Implementation remains uncommitted and VERIFY pending final
release reconciliation. Current evidence is in the refreshed private checkpoint
gallery; all original Bootstrap Before images are preserved.
The implementation-time approval notes below are historical.


## October 8 reading-width revision
- Filters, grouped results and history share a centered 1152px root.
- History groups wrap at 280px basis rather than clip. Actual unfiltered history
  and filtered results have zero horizontal overflow in dark/light at 1559x1167.
- Evidence: `width-workflow-search-{before,after,light-after}.png`;
  `width-workflow-search-history-{after,light-after}.png` adds history proof.
- Revision is uncommitted and awaiting review; batch approval remains pending.

- Final combined integration: 901 scoped pytest and 379 JavaScript tests pass,
  with no deselections. The former global ancestry gap is resolved by following
  local renderer helpers, keeping the original 90-page coverage threshold.

- Checkpoint 87, October 7, 2026. VERIFY, awaiting user batch review.
- Contract baseline `7a43faab`, approved implementation `e5bde8c3`, preserved 63-86.
- No commit/revision claim. All 63-90 await review; approved effort remains 75%.
- Scope: Search only. Note Template New/Edit forms 88 are next, untouched here.

## Original provider, controls and consumers
- `main.search`, `GET /search`, remains unchanged; no new service, route or model.
- Exact names: `q`, `customer_id`, `seller_id`, `territory_id`, repeated `topic_ids`.
- Text strips whitespace and matches case-insensitive stored-content substrings, retaining `%`/`_` SQL wildcards, not relevance.
- Customer/seller/territory filters combine by AND using customer ownership;
  selected topics match ANY, with ORM result deduplication and original typed IDs.
- Session seller identity and linked DSS preference force seller scope. DSS identity
  wins over session/URL overrides; seller controls/headings stay hidden in that mode.
- Clear Filters returns to `/search`; forced seller scope still searches on reset.
- Unscoped General notes can match text/topics; ownership scopes exclude them.
- No dates, aliases, role/General selector, relevance ranking, paging, exports, writes or autosave existed; unknown GET names stay ignored.
- Seller groups retain newest-note insertion order; customers sort by newest call, with descending local note dates inside each customer.
- Preserve seller/customer links, favicon, TPID/external link, full date and optional
  non-midnight time, stripped 200-character excerpt, territory/topic/partner tags,
  per-customer note counts, full-note destination and original no-match message.
- Viewed/Updated providers, order/icons/colors, names, customer labels, URLs and UTC-to-local timestamps remain, only without criteria.
- Browse navigation and the shared-base embed query remain actual consumers. No
  template includes Search. Approved note bodies/previews/forms/Home are untouched.

## Native implementation
- Continuous desktop frame, compact persistent GET controls and count/scope rail.
- Original native single/multiple selects; results are a flat grouped reading stream.
- No forced cards, rich-text sorting, new picker framework or Bootstrap-owned markup.
- Divider-separated history preserves type colors; entry-local state merges other state and restores controls and both reading axes.
- Unsubmitted controls do not change results until Search; no preference storage/write.
- Invalid/unavailable controls validate before restoration; history errors log/show an alert, and provider failures never become empty success.
- Search help corrects fictional cross-entity search, type filters and relevance ranking.

## Verification and private evidence
- Configured/activated venv. Final shared/role/native regression selection: 166 pytest
  pass, one deselected stale global ancestry inventory, five SQLAlchemy warnings.
- Final expanded Search command, including malformed IDs and multi-note ordering:
  `python.exe -m pytest tests\test_ui_search.py tests\test_views.py::test_search_page_loads tests\test_views.py::test_search_with_query tests\test_ux_improvements.py::test_search_results_hierarchy_simplified`: 38 pass.
- Shared selection files: Search, seller/DSS modes, UI navigation, approved note body/
  preview, breadcrumbs and the three original Search consumers. New Search: 35 cases.
- Selection excludes `-k 'not test_all_base_page_endpoints_have_declared_ancestry'`.
- `node --check static\js\ui-search.js`; `node --test tests\js\ui_search.test.cjs tests\js\ui_dialog.test.cjs tests\js\ui_record_dialog.test.cjs tests\js\ui_note_actions.test.cjs`: 50 pass.
- Help retains 80 unique routes; scoped editor and added-line whitespace checks clean.
- Initial broader run: 162 pass, one failure in unchanged global breadcrumb threshold
  (requires 90 direct render handlers, currently finds 72). Not caused/fixed by Search.
- Live trusted QA: baseline one note unchanged; content search 45; two topics narrow
  to four only on submit; combined filters/no-match, Clear Filters, F1/Close and real
  note/customer/seller/history links work. Actual Back restores 900px and query draft.
- Both themes, desktop 1566 x 1167 unchanged; surface x=0, reading height 836px,
  stream 1120px, status bottom 1167px, no horizontal overflow. After images inspected.
- Private photos: `checkpoint-87-search-before.png`, `-after.png`, `-light-after.png`,
  `-history-before.png`, `-history-after.png`, `-history-final-after.png`,
  `-results-after.png`, `-empty-after.png` (all share `checkpoint-87-search` prefix).
- Exact observed POST paths: none in completed monitored QA. No business/preferences
  writes; telemetry/read-cache and existing shell socket/CORS/400 errors may occur.
- Original dark theme restored, typed QA draft cleared, dialogs/listeners cleaned.
  Visible QA tab `deaa7837-858e-4e7c-91df-f35b05d02e1b`; protected drafts untouched.
- Exactly one generic readiness DM accepted `1557498174375985274`, exit 0.
