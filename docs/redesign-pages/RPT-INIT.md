# Initiative Tracker, checkpoint 48

- ID: RPT-INIT. Routes: `/reports/initiative-tracker`, `/reports/manager-one-on-one`.
- Template: `report_manager_one_on_one.html`; baseline `6ee2af6d`.
- Status: VERIFY, user-approved October 6; local commit authorized.
- Approved effort estimate: about 54%; strict DONE counters are unchanged.
- Scope: existing tracker plus required workspace/project/editor host integration.

## Preserved product contracts

- All initiatives, context, projects and curated engagement/milestone links.
- Original initiative/seller order, unassigned last; sorting preserves seller membership/headings.
- Exact titles, links, statuses, commitment, dates, ACR, unavailable snapshots and counts.
- Existing create/edit/delete initiatives, search/type/source selection, add selected
  and remove-link APIs, including the 75-selection limit and server validation.
- U2C quarter/snapshot provenance, stored workload scope, already-added and
  unsynced feedback; selection never creates placeholder milestones.
- Existing details/source links, seller workspace, rich notes, agenda editing,
  discussion-note creation, history and restore/remove.
- Points keep their serialized autosave, retry, mark-discussed payload and dated
  history. Missing historic timestamps keep the original explanatory label.
- Read service and both SalesIQ tools unchanged; the tracker has never offered export.

## Native workbench and coupled fixes

- Shared desktop frame, title/index and status rail; one scrolling initiative dossier.
- Native controls/forms, semantic seller tags, line separators and native dialogs.
- Five data columns in each work/candidate table sort both ways using the shared
  global sorter and raw ISO/ACR keys. Points/select/remove remain action columns.
- Back restores reading position, open editors, picker scope/query/selection,
  candidate scrolling and table sorting; unsubmitted query text stays a draft.
- Await candidate results before scroll restoration; concurrent reads cannot overwrite it at 0px.
- Retain failed edits/retries; pending forms warn on leave and block unrelated writes.
- Native workspace hosts retain save-before-close/replacement/navigation and
  timer disposal. Standing notes fill their host below the fixed toolbar.
- Project task dialogs retain the native parent. Legacy engagement editors are
  hosted at body level with parent restoration; their entity redesign is deferred.

## Verification

- 170 scoped pytest tests pass (20.15s):
  `python.exe -m pytest tests\test_manager_one_on_one.py tests\test_manager_one_on_one_js.py tests\test_ui_one_on_one_workspace.py tests\test_one_on_one_workspace.py tests\test_salesiq_tools.py -q`.
- 52 Node tests pass with `node --test tests\js\manager_one_on_one.test.cjs tests\js\ui_one_on_one_workspace.test.cjs`.
- Isolated writes cover APIs, retries, archives, orphan sources, limits, pending edits and hosts.
- Live fresh-read API and all 14 original rows/text/links/order match across
  three initiatives (11/3/0). Thirty bidirectional table-sort checks pass.
- Live U2C/workload search, zero matches, Projects, loaded initiative fields,
  Points/history, engagement/milestone details and existing workspace checked.
- Back restores actual 120px reading position plus SQL/U2C scope and ACR sort.
  Nested workspace dialog preserves parent; toolbar/editor widths match at 553px,
  editor bottom gap is zero and authored rich tables are never sortable.
- Dark/light at unchanged 1566x1174; fixed 24px footer, no document overflow.
- Monitored mutations/page errors: zero; protected drafts, production and dev server untouched.
- Editor diagnostics, JS syntax and `git diff --check` pass.
- Private images: `initiative-tracker-before.png`, `initiative-tracker-after.png`,
  plus `initiative-tracker-light-after.png`, `initiative-tracker-picker-after.png`,
  `initiative-tracker-points-after.png`, `initiative-tracker-workspace-after.png`.
- Final screenshots inspected. Frozen Bootstrap transitions required read-only
  transition events; foreground capture fixes stale compositor images.
- QA baselines/listeners/filter drafts cleared. Discord accepted one DM: `1557219885094936638`.
