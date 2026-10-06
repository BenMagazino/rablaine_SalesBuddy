# Redesign page and surface tracker

Use the [workflow](REDESIGN-WORKFLOW.md) and [page evidence template](REDESIGN-PARITY-TEMPLATE.md).
Inventory date: October 2, 2026. Baseline product SHA:
`ef552587a6514e116840b19f27c9b79ea6db0708`.

## Working checkpoint

- Current page/surface: checkpoint 37, What's New,
  VERIFY, technically verified and awaiting visual approval.
  Checkpoint 36 Hygiene is user-approved and committed as `9195a2c8`.
  Checkpoint 35 Workload Report is user-approved and committed as `70ec157`.
  Checkpoint 34 main Reports directory is user-approved and committed as `da43a54`.
  Checkpoint 33 Revenue sync/import is user-approved and committed as `a6b6253`.
  Checkpoint 32 Revenue configuration is user-approved and committed as `350e152`.
  Checkpoint 31 Revenue reports/Synapse is user-approved and committed as `15e8333`.
  Checkpoint 30 seller Products/monthly comparison is user-approved and committed as `e98c879`.
  Checkpoint 29 Products directory/shared sorting is user-approved and committed as `aed2350`.
  Checkpoint 28 product Revenue is user-approved and committed as `e286617`.
  Checkpoint 27 customer bucket history is user-approved and committed as `aaf6cfd`.
  Checkpoint 26 customer Revenue is user-approved and committed as `9a4ddef`.
  Checkpoint 25 seller queue/detail is user-approved and committed as `747058a`.
  Checkpoint 24 shell composition is approved and committed as `4320872`;
  its scrolling was technically verified but not manually reviewed by the user;
  full GLOBAL-SHELL remains BUILDING
- Committed checkpoints: `e84b675` (theme foundation), `1fbdd64` (header/navigation),
  `160e2d9` (native help/dialog foundation), `8dd3363` (customer pickers),
  `f1916e8` (image viewer), `1e7b16c` (shared notifications),
  `f6e9163` (persistent status strips), `dd44c58` (floating sync status and search focus),
  `9545d18` (note-preview lifecycle and quick actions),
  `ce61a1d` (milestone-preview lifecycle and nested editors),
  `3f8ddd5` (shared note body and divider-only metadata),
  `c652057` (shared milestone body and forecast comments),
  `a5ed892` (Home workbench and read-only refresh status),
  `3e4c5be` (Home calendar, native calendar picker and refresh feedback),
  `1f1472a` (native calendar read states, Retry and stale-response protection),
  `6d15a91` (native Action Items settings and confirmed preference saves),
  `c1242b3` (shared Action Item preview and editor, user-approved October 3),
  `b53752c` (shared native Revenue Buckets filter, user-approved October 3),
  `cb9f0e4` (shared native Review Alert editor, user-approved October 3),
  `401846d` (native Home Revenue preview and shared details, user-approved October 4),
  `a4ec9a8` (shared native Revenue preview frames, user-approved October 4),
  `25a14d4` (shared native Revenue lists and Seller Full View, user-approved October 4),
  `60dbdb3` (native Revenue commands and app-wide breadcrumbs, user-approved October 4),
  `4320872` (continuous shell contract and Revenue pilot, user-approved October 4),
  `747058a` (seller Revenue queue/detail, user-approved October 4),
  `9a4ddef` (customer Revenue context/history, user-approved October 4),
  `aaf6cfd` (native customer bucket history, user-approved October 4),
  `e286617` (product Revenue comparison/trend, user-approved October 5),
  `aed2350` (Products browser/shared column sorting, user-approved October 5),
  `e98c879` (seller Products browser/monthly comparison, user-approved October 5),
  `15e8333` (native Revenue reports/Synapse, user-approved October 5),
  `350e152` (native Revenue configuration, user-approved October 5),
  `a6b6253` (native Revenue sync/import, user-approved October 5),
  `da43a54` (native grouped Reports directory, user-approved October 5),
  `70ec157` (native Workload Report, user-approved October 6),
  `9195a2c8` (native Hygiene repair workbench, user-approved October 6)
- Next action: visually review What's New before committing it.
  Created/Updated have independently scrolling native lists, sortable data,
  persistent filters and accessible seller/customer grouping. Original provider
  and all-history audit semantics remain unchanged. Selected audit types affect
  Updated only and its displayed/sort dates. Confirmed membership reconciles
  every occurrence and scope/export state; ambiguous responses cannot repeat.
  Exports retain both lists and expanded group context. Back restores both
  reading positions, scope, grouping and sorts. Embeds use ordinary stacked lists.
  Two native repair queues with sortable data columns share fixed commands and meaningful counts,
  without forcing a split-pane layout. Original query semantics, record/action
  metadata and seller scope are unchanged. Reasons serialize saves, protect the
  latest draft and count/export confirmed text only. Native repair dialogs retain
  all three existing workflows, selected milestone metadata and form constraints.
  Confirmed repairs reconcile both queues from the authoritative report.
  Ambiguous creation cannot automatically resubmit after an inconclusive refresh.
  Both-queue exports retain seller context, including native plaintext fallback.
  Back restores queue/scope/grouping/sorts and exact reading; embeds stack queues.
  Workloads form a sortable context list beside the selected customer grid.
  Original latest-note date scope, customer-wide engagements, topic-linked
  active milestones and ID-deduplicated ACR remain unchanged. All matching
  topics export even when only one panel is selected. Saved All/manual presets,
  explicit storage/range failures, Retry and Back context are verified.
  Embedded workloads remain ordinary expandable native tables.
  Fifteen real destinations retain all four groups, menu order, names, icons and
  descriptions in a compact native directory. Fixed search/status bands surround
  a readable grouped list, not fifteen cards or an unnecessary navigation pane.
  Local name/purpose/group filtering has explicit no-match and Clear states.
  Back restores the query before shared reading-position restoration; embedded
  directories keep their filter local and do not consume parent history.
  Fixed sync/status bands connect independently scrolling import history,
  stored-month coverage and an inline compensated-bucket editor. Every history/
  month column sorts both directions with exact UTC/calendar/numeric keys.
  The original MSXI request and plain-array preference writes remain; reads
  never save a selection. Truncated streams cannot look complete, bucket writes
  are serialized/latest-wins, and notices hide only after confirmed dismissal.
  DSS has no bucket region; empty imports omit it until sync completes.
  Embeds retain ordinary stacked task regions, without the window frame.
  Configuration has a constrained editor inside the full-width shell, contextual
  section explanations and fixed Save/Cancel commands. All nine original fields,
  values, native number constraints, POST behavior and next-analysis timing remain.
  Decimal-ratio labels replace misleading percentage suffixes without rescaling.
  Embeds stack section context above ordinary fields and do not own the window.
  The Revenue reports directory has one real report, not a filler card grid. Synapse retains both
  modes, seller grouping, original values and exports in a continuous reading
  area with sticky seller/column headings. Every column sorts both directions;
  first usage uses actual calendar dates. Back restores sorting and reading
  position; embeds retain ordinary grouped tables and their mode context.
  Seller Products
  reuses the approved directory's independent product/customer panes, guarded
  scoped reads, sorting, search and Back restoration. The full detail is a native
  wide grid for comparing customers across the seven recent imported months,
  with unchanged all-history totals, complete consolidated members and separate
  View All Customers navigation. Matched customer/bucket links are restored;
  repeated customer names no longer borrow another bucket's monthly values.
  Existing seller-membership and nonpositive-detail query semantics are preserved.
  Embeds retain ordinary lists/grids, without a miniature multi-pane application.
  Both Products aliases use a native
  product-left/customer-consumption-right browser with independent scrolling,
  sticky columns and a filtered-count rail. All 573 products retain their values,
  ordering and Full Product destinations. Shared customer rollups and markup
  serve both panes and the approved product detail. Customer links identify the
  exact customer/bucket entry rather than its unstable revenue-sorted position.
  Back restores product, search and both scroll positions. Usage labels retain
  positive-pair counts and consolidated member summing. Search/Clear, guarded
  loading/Retry, customer drill-down, embeds and contextual Help are verified.
  Every table column in the recent Revenue workbenches now sorts in both directions,
  including monthly history, Analyzer, seller comparisons, inspectors and previews.
  Shared sorting preserves row identity, selection, filters, financial colors and
  graph chronology; totals stay pinned and Back restores independent sort states.
  Missing values remain distinct from imported zeroes and rounded display dollars.
  Seller product list/detail are explicitly migrated and user-approved by checkpoint 30.
  The approved product detail's searchable comparison
  table selects customer history alongside it; no duplicate customer queue.
  The selected history now includes a chronological monthly revenue graph above
  the exact-value table, with hover amounts and explicit missing-month gaps.
  The three-column comparison omits Latest Month at the user's request; standalone
  graph/history use the complete pane width while embedded reading stays bounded.
  Product-wide totals remain unchanged by search, with honest customer/bucket
  entry labels. Consolidated members, unmatched links, native Help, history
  navigation and browser-restored search are verified. Both standalone aliases
  enhance into work panes; embeds retain stacked reading. Seller product pages
  are technically verified and user-approved in checkpoint 30.
  Customer analysis now shares
  native summary/review content with previews and the seller inspector. Product
  grids share the same rendering and preserve all-history totals. The continuous
  shell has fixed commands, independently scrolling bucket context/history panes,
  a narrower product grid and filtered scope counts. Bucket navigation does not
  change saved scope; all-bucket totals remain a separate Overview.
  Customer bucket Full History is explicitly migrated by checkpoint 27; other
  product drilldowns are not migrated implicitly; checkpoints 28 and 30 handle
  the global and seller product families explicitly.
  Seller Queue/Table and compact modal
  lists keep their approved distinct compositions.
  October 4 review correction: all 90 full-page endpoints now use Home's shared
  context-bar styling below navigation, including pages previously without trails.
  Breadcrumbs begin with linked Home, follow canonical real parents, and end with
  an unlinked current page. Home is a plain location label. Customer Revenue uses
  actual Seller/Customer ownership; Analyzer belongs to Reports. This app-wide
  breadcrumb extension is verified and user-approved, not a claim that
  the legacy page bodies are migrated. Checkpoint 24 replaces the floating-frame
  experiment with an edge-connected surface, fixed command/summary bands,
  scrolling alert region and useful filtered-count status rail. The approved
  table/review workflow remains available. Checkpoint 25 implements the separately
  approved queue/detail workflow for standalone seller Revenue only.
  Its opt-in scope does not restyle legacy pages, embeds or Home's grid.
  These Revenue pages are VERIFY, not DONE.
  New note/edit forms remain TODO.
  No live customer records were changed;
  existing user drafts are preserved. No push, merge or deployment is authorized.
- Deferred follow-up: [detached data jobs](PLAN_DETACHED_DATA_JOBS.md) captures
  navigation-independent imports/syncs and an in-place freshness-bar launcher.
  This is a separate future feature, not implemented in checkpoint 13.
- Separate defect: WorkIQ day lookups return `calendar_lookup_failed` for multiple
  dates. Visible failure feedback is fixed, but lookup investigation is deferred;
  a failed attempt does not make today's cache fresh.
- Working branch: `feature/ui-redesign`; approved archive is present in `design-studies/`
- Last reconciled product SHA: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Final candidate product SHA: not selected
- Page progress: 0 / 90 DONE
- Shared fragment/helper progress: 9 / 29 DONE
- Global/shell/error progress: 5 / 17 DONE
- Additional pages discovered after baseline: none recorded
- Additional shared helpers recorded: existing Revenue Buckets filter, omitted
  from the initial helper inventory; checkpoint 18 is user-approved and DONE.
  Checkpoint 21 adds the shared Revenue preview frame extracted from Home,
  with the controller reused by all four preview hosts; user-approved and DONE.
  Checkpoint 28 adds the shared monthly history renderer for bucket and product
  pages; technically verified, user-approved October 5 and DONE.
  Checkpoint 29 adds shared product customer comparison/summary fragments and
  a history-free rollup service; user-approved October 5 and DONE.
  It also adds the shared native table sorter across the recently migrated
  Revenue workbenches and their fragments; user-approved October 5 and DONE.
- Commit cadence: each coherent, verified checkpoint; no automatic push or merge
- Pre-release reviewer: the user; external tester/users provide post-release QA

Statuses: TODO, AUDITED, BUILDING, VERIFY, DONE, REOPEN, BLOCKED.
Replace the dash in Evidence with a link to the page card when work starts.
Keep counts updated, but the rows and revision-specific approvals are authoritative.

## How to read overall progress

As of checkpoint 36 sign-off, the rough effort-based estimate is **about 40%**
of the full redesign (a judgment call, not a measured metric).
Shared theme/navigation/dialog/feedback foundations and substantial Home/note/
milestone slices are approved. Most entity pages, forms, reports, preferences,
admin and final reconciliation still remain.

Report an updated effort-based estimate whenever a checkpoint is completed and
committed. Keep estimates approximate; small checkpoints may not move the rounded
percentage. Checkpoint 15: about 15%. Checkpoint 16: about 16%.
Checkpoint 17: about 17%, user-approved October 3, 2026, committed as `c1242b3`.
Checkpoint 18: about 17%, user-approved October 3, 2026, committed as `b53752c`.
This small shared-filter
slice does not change the rounded approved-work estimate.
Checkpoint 19: about 18%, user-approved October 3, 2026, committed as `cb9f0e4`.
Checkpoint 20: about 19%, user-approved October 4, 2026, committed as `401846d`.
Checkpoint 21: about 20%, user-approved October 4, 2026, committed as `a4ec9a8`.
Checkpoint 22: about 22%, user-approved October 4, 2026, committed as `25a14d4`. Shared alert lists and
the preview controller's native-parent integration are approved at this revision.
Checkpoint 23: about 24%, user-approved October 4, 2026, committed as `60dbdb3`. Native Analyzer/seller page
commands and app-wide canonical breadcrumbs are approved; the shared continuous
shell contract and Revenue pilot are the next checkpoint.
Checkpoint 24: about 25%, shell composition user-approved October 4, 2026,
committed as `4320872`. Scrolling is technically verified, not manually reviewed
by the user; the wider interim table is not the final Revenue layout approval.
Checkpoint 25: about 26%, seller queue/detail user-approved October 4, 2026, committed as `747058a`,
including restored semantic priorities and the contextual modal/full-page layout
principle. Modal lists keep shared native styling without copying full-page layout.
Checkpoint 28: about 29%, product comparison/history user-approved October 5, committed as `e286617`,
including the monthly graph, mirrored dollar labels, three-column comparison
and full-pane reading width. Checkpoint 29: about 31%, Products browser and shared
column sorting user-approved October 5, committed as `aed2350`, including loaded
previews, queue order and independent Back restoration. Checkpoint 30: about 33%,
seller Products and monthly comparison user-approved October 5, including scoped
reads, corrected matched links and separate bucket histories. Checkpoint 31:
about 35%, native Revenue reports/Synapse user-approved October 5 and committed
as `15e8333`, retaining populations, financial values, mode preferences,
sorting, complete exports and exact reading restoration.

The DONE counters are stricter: they count fully reconciled pages/helpers, not
approved sub-page checkpoints or partial completion. Consequently, `0 / 90`
pages DONE does not mean zero work is complete. Do not divide completed
checkpoints by page count; checkpoints differ substantially in size.

## Suggested work order

1. Global frame, tokens, navigation and replacement interaction primitives.
2. Home plus note/action/milestone workflows and shared modal partials.
3. Entity lists, details and create/edit forms.
4. Engagements, projects, 1:1 workspaces and their cross-page workflows.
5. Reports, revenue, preferences, admin, setup and remaining global surfaces.
6. Native window/status screens and final reconciliation.

Shared-component work can run ahead, but page sign-off is still independent.
The inventory below is grouped by domain, not a mandatory implementation order.

## Page checklist

URLs use Flask parameter syntax. Templates are relative to `templates/`.
Aliases share a page row, but every alias must be verified. Create/edit variants
have separate rows even when they use one template.

| ID | Page | URL(s) | Template | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| HOME | Dashboard/calendar | `/` | `index.html` | BUILDING | [Workbench frame](redesign-pages/HOME-WORKBENCH.md), [note-preview slice](redesign-pages/HOME-NOTE-PREVIEW.md) |
| ACTIONS | Action items | `/action-items` | `action_items_hub.html` | TODO | - |
| SEARCH | Search | `/search` | `search.html` | TODO | - |
| PREFS | Preferences | `/preferences` | `settings.html` | TODO | - |
| NT-NEW | Create note template | `/templates/new` | `note_template_form.html` | TODO | - |
| NT-EDIT | Edit note template | `/templates/<int:id>/edit` | `note_template_form.html` | TODO | - |
| ANALYTICS | Analytics | `/analytics` | `analytics.html` | TODO | - |
| ADMIN | Admin panel | `/admin` | `admin_panel.html` | TODO | - |
| ADMIN-AI | AI logs | `/admin/ai-logs` | `admin_ai_logs.html` | TODO | - |
| ADMIN-ICONS | Favicon gallery | `/admin/favicons` | `admin_favicons.html` | TODO | - |
| METRICS | Metrics | `/metrics` | `metrics.html` | TODO | - |
| CONNECT | Connect export workspace | `/connect-export` | `connect_export.html` | TODO | - |
| CUST-LIST | Customers | `/customers` | `customers_list.html` | TODO | - |
| CUST-NEW | Create customer | `/customer/new` | `customer_form.html` | TODO | - |
| CUST-VIEW | Customer detail | `/customer/<int:id>` | `customer_view.html` | TODO | - |
| CUST-EDIT | Edit customer | `/customer/<int:id>/edit` | `customer_form.html` | TODO | - |
| SELL-LIST | Sellers | `/sellers` | `sellers_list.html` | TODO | - |
| SELL-NEW | Create seller | `/seller/new` | `seller_form.html` | TODO | - |
| SELL-VIEW | Seller detail | `/seller/<int:id>` | `seller_view.html` | TODO | - |
| SELL-EDIT | Edit seller | `/seller/<int:id>/edit` | `seller_form.html` | TODO | - |
| TERR-LIST | Territories | `/territories` | `territories_list.html` | TODO | - |
| TERR-NEW | Create territory | `/territory/new` | `territory_form.html` | TODO | - |
| TERR-VIEW | Territory detail | `/territory/<int:id>` | `territory_view.html` | TODO | - |
| TERR-EDIT | Edit territory | `/territory/<int:id>/edit` | `territory_form.html` | TODO | - |
| POD-LIST | PODs | `/pods` | `pods_list.html` | TODO | - |
| POD-VIEW | POD detail | `/pod/<int:id>` | `pod_view.html` | TODO | - |
| POD-EDIT | Edit POD | `/pod/<int:id>/edit` | `pod_form.html` | TODO | - |
| SE-LIST | Solution engineers | `/solution-engineers` | `solution_engineers_list.html` | TODO | - |
| SE-VIEW | Solution engineer detail | `/solution-engineer/<int:id>` | `solution_engineer_view.html` | TODO | - |
| SE-EDIT | Edit solution engineer | `/solution-engineer/<int:id>/edit` | `solution_engineer_form.html` | TODO | - |
| IC-LIST | Internal contacts | `/internal-contacts` | `internal_contacts_list.html` | TODO | - |
| IC-NEW | Create internal contact | `/internal-contacts/new` | `internal_contact_form.html` | TODO | - |
| IC-EDIT | Edit internal contact | `/internal-contacts/<int:id>/edit` | `internal_contact_form.html` | TODO | - |
| TOPIC-LIST | Topics | `/topics` | `topics_list.html` | TODO | - |
| TOPIC-NEW | Create topic | `/topic/new` | `topic_form.html` | TODO | - |
| TOPIC-VIEW | Topic detail | `/topic/<int:id>` | `topic_view.html` | TODO | - |
| TOPIC-EDIT | Edit topic | `/topic/<int:id>/edit` | `topic_form.html` | TODO | - |
| NOTE-LIST | Notes | `/notes` | `notes_list.html` | TODO | - |
| NOTE-NEW | Create note | `/note/new` | `note_form.html` | TODO | - |
| NOTE-VIEW | Note detail | `/note/<int:id>` | `note_view.html` | BUILDING | [Shared body slice](redesign-pages/NOTE-BODY.md) |
| NOTE-EDIT | Edit note | `/note/<int:id>/edit` | `note_form.html` | TODO | - |
| FILL-DAY | Fill My Day | `/fill-my-day` | `fill_my_day.html` | TODO | - |
| ENG-LIST | Engagements | `/engagements` | `engagements_hub.html` | TODO | - |
| ENG-NEW | Create engagement | `/customer/<int:customer_id>/engagement/new` | `engagement_form.html` | TODO | - |
| ENG-VIEW | Engagement detail | `/engagement/<int:id>` | `engagement_view.html` | TODO | - |
| ENG-EDIT | Edit engagement | `/engagement/<int:id>/edit` | `engagement_form.html` | TODO | - |
| MS-LIST | Milestones | `/milestones` | `milestones_list.html` | TODO | - |
| MS-NEW | Create milestone | `/milestone/new` | `milestone_form.html` | TODO | - |
| MS-VIEW | Milestone detail | `/milestone/<int:id>` | `milestone_view.html` | BUILDING | [Shared body/commands](redesign-pages/MILESTONE-BODY.md) |
| MS-EDIT | Edit milestone | `/milestone/<int:id>/edit` | `milestone_form.html` | TODO | - |
| MS-TRACK | Milestone tracker | `/reports/milestone-tracker`; `/milestone-tracker` redirects | `milestone_tracker.html` | TODO | - |
| OPP-VIEW | Opportunity detail | `/opportunity/<int:id>` | `opportunity_view.html` | TODO | - |
| PROJ-NEW | Create project | `/project/new` | `project_form.html` | TODO | - |
| PROJ-VIEW | Project detail | `/project/<int:id>` | `project_view.html` | TODO | - |
| PROJ-EDIT | Edit project | `/project/<int:id>/edit` | `project_form.html` | TODO | - |
| PART-LIST | Partners | `/partners` | `partners_list.html` | TODO | - |
| PART-NEW | Create partner | `/partners/new` | `partner_form.html` | TODO | - |
| PART-VIEW | Partner detail | `/partners/<int:id>` | `partner_view.html` | TODO | - |
| PART-EDIT | Edit partner | `/partners/<int:id>/edit` | `partner_form.html` | TODO | - |
| SPEC-LIST | Specialties | `/specialties` | `specialties_list.html` | TODO | - |
| SPEC-NEW | Create specialty | `/specialties/new` | `specialty_form.html` | TODO | - |
| SPEC-VIEW | Specialty detail | `/specialties/<int:id>` | `specialty_view.html` | TODO | - |
| SPEC-EDIT | Edit specialty | `/specialties/<int:id>/edit` | `specialty_form.html` | TODO | - |
| OOO-LIST | 1:1 hub | `/one-on-one/` | `one_on_one_hub.html` | TODO | - |
| OOO-VIEW | 1:1 workspace | `/one-on-one/<int:workspace_id>` | `one_on_one_workspace.html` | TODO | - |
| RPT-HUB | Reports hub | `/reports` | `reports_hub.html` | VERIFY | [Checkpoint 34](redesign-pages/HOME-WORKBENCH.md#checkpoint-34-main-reports-directory); native grouped directory, identical registry/menu order, local filter and Back context; user-approved October 5 |
| RPT-INIT | Initiative Tracker | `/reports/initiative-tracker`; `/reports/manager-one-on-one` | `report_manager_one_on_one.html` | TODO | - |
| RPT-ACT | Activity coverage | `/reports/activity-coverage` | `report_activity_coverage.html` | TODO | - |
| RPT-OOO | Seller 1:1 preparation | `/reports/one-on-one` | `report_one_on_one.html` | TODO | - |
| RPT-WORK | Workload | `/reports/workload` | `report_workload.html` | VERIFY | [Checkpoint 35](redesign-pages/HOME-WORKBENCH.md#checkpoint-35-workload-report); native topic/customer browser, preserved scope/totals/exports, sorting, Back and compact embeds; user-approved October 6 |
| RPT-HYG | Hygiene | `/reports/hygiene` | `report_hygiene.html` | VERIFY | [Checkpoint 36](redesign-pages/HOME-WORKBENCH.md#checkpoint-36-engagement--milestone-hygiene); native sortable data columns, plain Fix headings, confirmed annotations, protected dialogs, authoritative refresh, both-queue exports and Back; user-approved October 6, committed `9195a2c8` |
| RPT-NEW | What's New | `/reports/whats-new` | `report_whats_new.html` | VERIFY | [Checkpoint 37](redesign-pages/HOME-WORKBENCH.md#checkpoint-37-whats-new); native Created/Updated lists, sortable raw data, saved scope/grouping, audit-aware dates, confirmed membership, expanded-row exports and exact Back; awaiting visual approval |
| RPT-WHITE | Whitespace | `/reports/whitespace` | `report_whitespace.html` | TODO | - |
| RPT-MSX | MSX workspace | `/reports/msx-workspace` | `report_msx_workspace.html` | TODO | - |
| RPT-MKT | Marketing insights | `/reports/marketing-insights` | `report_marketing_insights.html` | TODO | - |
| RPT-GOALS | Connect goals | `/reports/connect-goals` | `report_connect_goals.html` | TODO | - |
| RPT-U2C | U2C | `/reports/u2c` | `report_u2c.html` | TODO | - |
| RPT-IMPACT | Connect impact | `/reports/connect-impact` | `report_connect_impact.html` | TODO | - |
| REV-DASH | Revenue dashboard | `/reports/revenue`; `/revenue` redirects | `revenue_dashboard.html` | VERIFY | [Continuous shell pilot](redesign-pages/HOME-WORKBENCH.md#checkpoint-24-continuous-workbench-shell-and-revenue-pilot) |
| REV-IMPORT | Revenue import | `/revenue/import`; `/import/revenue` redirects | `revenue_import.html` | VERIFY | [Checkpoint 33](redesign-pages/HOME-WORKBENCH.md#checkpoint-33-revenue-syncimport); native maintenance panes, sortable unchanged history/months, explicit sync/save recovery and shared inline buckets; user-approved October 5, committed as `a6b6253` |
| REV-CONFIG | Revenue configuration | `/revenue/config` | `revenue_config.html` | VERIFY | [Checkpoint 32](redesign-pages/HOME-WORKBENCH.md#checkpoint-32-revenue-analysis-configuration); native contextual editor, exact fields/values and save parity; user-approved October 5, committed as `350e152` |
| REV-SELL | Seller revenue alerts | `/revenue/seller/<seller_name>` | `revenue_seller_alerts.html` | VERIFY | [Queue/detail workbench pilot](redesign-pages/HOME-WORKBENCH.md#checkpoint-25-seller-revenue-queue-and-inspector) |
| REV-SELL-PRODS | Seller products | `/revenue/seller/<seller_name>/products` | `revenue_seller_products.html` | VERIFY | [Checkpoint 30 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-30-seller-products-and-monthly-comparison) |
| REV-SELL-PROD | Seller product detail | `/revenue/seller/<seller_name>/product/<path:product>` | `revenue_seller_product_view.html` | VERIFY | [Checkpoint 30 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-30-seller-products-and-monthly-comparison) |
| REV-CUST | Customer revenue | `/revenue/customer/<int:customer_id>`; `/customer/<int:customer_id>/revenue` | `revenue_customer_view.html` | VERIFY | [Checkpoint 26 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-26-customer-revenue-analysis-and-history) |
| REV-BUCKET | Customer bucket products | `/revenue/customer/<int:customer_id>/bucket/<bucket>`; `/customer/<int:customer_id>/revenue/bucket/<bucket>` | `revenue_bucket_products.html` | VERIFY | [Checkpoint 27 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-27-customer-bucket-product-history) |
| REV-PRODS | Products | `/revenue/products`; `/products` | `revenue_products_list.html` | VERIFY | [Checkpoint 29 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-29-products-directory) |
| REV-PROD | Product detail | `/revenue/product/<path:product>`; `/product/<path:product>` | `revenue_product_view.html` | VERIFY | [Checkpoint 28 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-28-product-revenue-comparison-and-history) |
| REV-RPTS | Revenue reports | `/reports/revenue-reports`; `/revenue/reports` redirects | `revenue_reports_list.html` | VERIFY | [Checkpoint 31](redesign-pages/HOME-WORKBENCH.md#checkpoint-31-revenue-report-surfaces); native real-report list and Analyzer command; user-approved October 5 |
| REV-SYN | Synapse customers | `/reports/synapse-customers`; `/revenue/reports/new-synapse-users` and `/reports/new-synapse-users` redirect with `?mode=new` | `revenue_report_synapse_customers.html` | VERIFY | [Checkpoint 31](redesign-pages/HOME-WORKBENCH.md#checkpoint-31-revenue-report-surfaces); native grouped reading, modes, sorting, exports and Back; user-approved October 5 |

## Shared HTML fragments and helpers

These must be verified in every host context, not only in isolation.
An `/api/` URL can return HTML. Page-local dialogs remain in their page's card.

| ID | Surface / template | Route or host | Status | Evidence |
| --- | --- | --- | --- | --- |
| FR-ACTIONS | `partials/_action_items_hub.html` | `/api/action-items-hub` | TODO | - |
| FR-CUST-OPPS | `partials/_customer_opportunities.html` | `/api/customer/<int:customer_id>/opportunities-html` | TODO | - |
| FR-ENG | `partials/_engagement_view_content.html` | `/api/engagement/<int:id>/detail` | TODO | - |
| FR-MS | `partials/milestone_view_content.html` | `/api/milestone/<int:id>/detail` | BUILDING | [Lifecycle/editors](redesign-pages/MILESTONE-PREVIEW.md), [shared body](redesign-pages/MILESTONE-BODY.md) |
| FR-NOTE | `partials/note_view_content.html` | `/api/note/<int:id>/detail` | BUILDING | [Lifecycle/editor](redesign-pages/HOME-NOTE-PREVIEW.md), [shared body](redesign-pages/NOTE-BODY.md) |
| FR-OOO | `partials/one_on_one_workspace_content.html` | `/api/seller/<int:seller_id>/one-on-one/detail` | TODO | - |
| FR-OPP | `partials/opportunity_view_content.html` | `/api/opportunity/<int:id>/detail` | TODO | - |
| FR-PROJ | `partials/project_view_content.html` | `/api/project/<int:id>/detail` | TODO | - |
| FR-REV | `partials/revenue_alert_detail.html` | `/api/revenue/analysis/<int:analysis_id>/detail`, all four preview hosts | DONE | [Checkpoint 20 evidence](redesign-pages/HOME-WORKBENCH.md) |
| FR-REV-HISTORY | `partials/_revenue_monthly_history.html` | Customer bucket Full History and product customer history | DONE | [Checkpoint 28 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-28-product-revenue-comparison-and-history) |
| FR-PRODUCT-COMPARE | `partials/_revenue_product_customers.html`, `partials/_revenue_product_summary.html`, `get_product_comparison` | Products inspector and Product Revenue; existing product aliases with `comparison=1` | DONE | [Checkpoint 29 evidence](redesign-pages/HOME-WORKBENCH.md#checkpoint-29-products-directory) |
| JS-TABLE-SORT | `static/js/ui-table-sort.js`, `static/css/ui-table-sort.css` | Products, Product/Customer/Bucket Revenue, Analyzer, seller alerts and shared inspectors/previews | DONE | [Sorting evidence](redesign-pages/HOME-WORKBENCH.md#shared-sortable-columns-october-5-follow-up) |
| INC-ACTION | `partials/_action_item_detail_modal.html` | Home, action hub, engagement/project details | DONE | [Evidence](redesign-pages/HOME-WORKBENCH.md) |
| JS-REV-BUCKET | `static/js/revenue-bucket-filter.js` | Home, revenue dashboard/customer/seller views, seller summary and preview | DONE | [Checkpoint 18 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-DASH | `partials/_dashboard_settings.html` | Home and preferences | TODO | - |
| INC-FY | `partials/_fy_management_card.html` | Admin | TODO | - |
| INC-PROJ-FORM | `partials/_project_form_fields.html` | Project/note forms | TODO | - |
| INC-EXPORT | `partials/_report_export.html` | Reports, revenue dashboard, milestone tracker | BUILDING | [Native Analyzer opt-in; other hosts remain legacy](redesign-pages/HOME-WORKBENCH.md#checkpoint-23-revenue-analyzer-and-seller-alert-pages) |
| INC-ACT-CAIP | `partials/activity_coverage_caip.html` | Activity coverage | TODO | - |
| INC-ACT-MS | `partials/activity_coverage_milestones.html` | Activity coverage | TODO | - |
| INC-CUST-ICON | `partials/customer_favicon.html` | Customer favicon macro, multiple hosts | TODO | - |
| INC-ENG-PANEL | `partials/engagements_panel.html` | Home, engagements hub, seller | TODO | - |
| INC-MS-TRACK | `partials/milestone_tracker_content.html` | Milestone tracker and seller | TODO | - |
| INC-PART-ICON | `partials/partner_favicon.html` | Partner/specialty surfaces | TODO | - |
| INC-REV-ALERTS | `partials/revenue_alerts_content.html`, `static/js/ui-revenue-alerts.js` | Revenue Analyzer, seller alerts and Seller Full View | DONE | [Checkpoint 22 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-REV-PREVIEW | `partials/revenue_alert_preview.html`, `static/js/ui-revenue-preview.js` | Home, Revenue Analyzer, seller alerts and native Seller Full View drilldown | DONE | [Checkpoints 21-22 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-REVIEW | `partials/review_action.html`, `static/js/ui-revenue-review.js` | Home and revenue/seller surfaces | DONE | [Checkpoint 19 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-FORECAST | `_forecast_comments.html` | Milestone/opportunity details | BUILDING | [Native opt-in and legacy parity](redesign-pages/MILESTONE-BODY.md) |
| INC-FORECAST-JS | `_forecast_comments_js.html` | Milestone/opportunity details | BUILDING | [Native opt-in and draft/write parity](redesign-pages/MILESTONE-BODY.md) |

## Global, native-shell and error surfaces

| ID | Surface | Location | Status | Evidence |
| --- | --- | --- | --- | --- |
| GLOBAL-SHELL | Navigation, page frame, theme, flash/status messages, global controls | `templates/base.html` | BUILDING | [Card](redesign-pages/GLOBAL-SHELL.md) |
| GLOBAL-SETUP | Welcome/sign-in/onboarding | `base.html`, welcome modal | TODO | - |
| GLOBAL-NOTE | Quick-note customer picker | `base.html`, native quick-note dialog | DONE | [Card](redesign-pages/GLOBAL-PICKERS.md) |
| GLOBAL-ENG | Quick-engagement customer picker | `base.html`, native quick-engagement dialog | DONE | [Card](redesign-pages/GLOBAL-PICKERS.md) |
| GLOBAL-HELP | Contextual page help | `base.html`, native help dialog | DONE | [Card](redesign-pages/GLOBAL-HELP.md) |
| GLOBAL-KEYS | Keyboard shortcuts | `base.html`, native shortcuts dialog | DONE | [Card](redesign-pages/GLOBAL-HELP.md) |
| GLOBAL-CHAT | Copilot chat | `base.html`, chat flyout | TODO | - |
| GLOBAL-SHARE | Sharing | `base.html`, share modal | TODO | - |
| GLOBAL-IMPORT | Shared-data import review | `base.html`, import-review modal | TODO | - |
| GLOBAL-ZOOM | Image zoom | `base.html`, native image dialog | DONE | [Card](redesign-pages/GLOBAL-ZOOM.md) |
| GLOBAL-TOUR | Guided product tour | `base.html`, tour script | TODO | - |
| SHELL-START | Starting Sales Buddy | `electron/main.js` | TODO | - |
| SHELL-SLOW | Startup taking longer than usual | `electron/main.js` | TODO | - |
| SHELL-UPDATE | Updating Sales Buddy | `electron/main.js` | TODO | - |
| SHELL-BUILD | Building desktop app | `electron/main.js` | TODO | - |
| SHELL-RECONNECT | Backend unavailable / reconnecting | `electron/main.js` | TODO | - |
| ERROR-DEFAULT | Missing records/routes and other HTTP failures | Flask/Werkzeug defaults; no custom error template currently | TODO | - |

Native geometry/maximized-state restoration is also a release requirement from
the archive window plan. Test actual relaunch, update/rebuild exits, tray and
monitor work areas; HTML screen approval does not prove native persistence.

## Inventory reconciliation

All 103 tracked templates are classified: 78 full-page + 9 routed fragments +
15 include-only helpers + one base. No orphan templates were found.
Checkpoint 21 adds one include-only Revenue preview template after that baseline.
Ninety page handlers use 95 direct page URL rules; six additional legacy URL
rules redirect to pages already listed.

There is no standalone opportunity list/create/edit, project list, POD create,
solution-engineer create, internal-contact detail or note-template list page.
Their embedded/API workflows belong in host-page cards, not invented page rows.
JSON APIs, mutation-only routes, downloads, streams and health/static endpoints
are not page checkoffs, but their user-visible consumers and results must be
covered. Add new page rows when those surfaces acquire a page.

## Product-change ledger

For every reconciliation range, list all affected IDs, the decision, and
evidence. Reopen approvals when needed. Include route/service/model/test changes.

| Product SHA/range | Change | Affected IDs | Disposition / evidence | Reconciled by/date |
| --- | --- | --- | --- | --- |
| `ef552587a6514e116840b19f27c9b79ea6db0708` | Initial inventory baseline | All | Inventory only; no page approved | October 2, 2026 |

## Final release reconciliation

- [ ] Candidate product and implementation SHAs recorded
- [ ] Current route/template/global-surface inventory reconciled
- [ ] All product changes since baseline reviewed, including unlogged changes
- [ ] All required rows DONE at candidate revisions; no unapproved feature loss
- [ ] Shared hosts and cross-page flows reverified
- [ ] Theme variants, global controls and native window behavior verified
- [ ] Runtime Bootstrap removal and icon decision verified
- [ ] Related tests/instructions/changelog updated
- [ ] Final tester approval and scoped test evidence recorded
- [ ] Any changes after candidate selection reconciled before release
