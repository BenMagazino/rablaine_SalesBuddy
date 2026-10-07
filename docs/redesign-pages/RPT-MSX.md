# MSX Workspace, checkpoint 49

- ID: RPT-MSX. Route: `/reports/msx-workspace`, including all three tab URLs.
- Template: `report_msx_workspace.html`; audited baseline `42c552c7`.
- Status: VERIFY, user-approved October 6; committed locally as `3e6244eb`.
- No push, merge or deployment authorized.
- Approved effort estimate: about 56%; all strict DONE counters are unchanged.

## Preserved product contracts

- Existing local-cache opportunity, milestone and open-task populations and fields.
- Exact untouched default orders, cached ACR fallback marker, ownership and source URLs.
- Seller/customer precedence, keyword fields and existing SQL wildcard semantics.
- Open opportunity default; three active milestone statuses; no statuses means unrestricted.
- Per-tab team/state controls, opportunity/workload selection and persisted sort/tab choices.
- Milestone task context, Back to Milestones, original task category/HVA labels and payloads.
- Existing Milestone Sync destination; the browser itself never initiates a sync.
- Opportunity details/forecast comments and shared milestone details/HoK/nested editors.
- Original team actions, task creation/close APIs and failure retries.
- This workspace has never offered table exports; no new analytical/read tool is introduced.
- Providers, cache rules, SalesIQ tools and shared sorter/dialog assets remain unchanged.

## Native workbench and coupled fixes

- Native title/scope/tab bands, fixed status rail and three independent reading regions.
- App-owned controls, semantic statuses, line-separated tables and native task/detail dialogs.
- Twenty data columns sort both directions with raw ISO dates, ACR and membership keys.
- Explicit export labels protect headers; disclosure/task/action columns do not sort.
- Exact legacy default order is retained before an explicit native header sort.
- Back restores applied scope, unsubmitted search text, tab, task context, sorts and scroll.
- Task failures retain fields; pending creation prevents dismissal and drafts protect scope.
- Latest reads win, including stale failures; loading/error rows disable incompatible sorting.
- Legacy opportunity content is intentionally retained until its entity redesign.
  Its native host scopes IDs/requests, disposes retries and binds existing team handlers.
  Forecast edits and pending writes protect dismissal/replacement; authored tables are untouched.

## Verification and review evidence

- 52 scoped pytest tests pass: `python.exe -m pytest tests\test_ui_msx_workspace.py
  tests\test_msx_workspace.py tests\test_ui_milestone_preview.py -q`.
- Five isolated task-route tests pass: `python.exe -m pytest tests\test_msx.py -k create_task -q`.
- 43 Node tests pass: `node --test tests\js\ui_msx_workspace.test.cjs
  tests\js\ui_table_sort.test.cjs`. Writes, failures, payloads and lifecycle use isolated harnesses.
- Correct an outdated Connect Impact launcher assertion to follow its existing external controller.
- Live default rows/order and every visible field match: 1,379 opportunities, 962 milestones,
  five tasks. Fresh-read full JSON parity passes for all three unchanged providers.
- Forty bidirectional sorts preserve row identity; team scope returns the exact 57 rows.
- No milestone statuses returns all 1,360 cached rows; genuine zero-result search is explicit.
- Targeted milestone task view shows one existing task; native Create/Cancel makes no write.
- Actual Back restores 340px milestone and 120px opportunity reading positions, search draft
  and independent milestone task context. Eight token themes keep the fixed footer/no overflow.
- Before/After at unchanged desktop 1566x1174; final dark/light/milestone images inspected.
- Private images in the current session `files`: `msx-workspace-before.png`,
  `msx-workspace-after.png`, `msx-workspace-milestones-after.png`, `msx-workspace-light-after.png`.
- Live writes/sync/refresh were not exercised. Detail auto-refresh GETs persist caches, so
  those controllers and nested writes are verified only through isolated tests/harnesses.
- Diagnostics, script syntax and diff checks pass. QA state/listeners cleared; dark restored.
- Protected drafts, production port/database and running dev server remain untouched.
- Discord accepted exactly one generic readiness DM: `1557226631633051661`.
