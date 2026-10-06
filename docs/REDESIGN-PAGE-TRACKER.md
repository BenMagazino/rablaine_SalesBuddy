# Redesign page and surface tracker

Use the [workflow](REDESIGN-WORKFLOW.md) and [page evidence template](REDESIGN-PARITY-TEMPLATE.md).
Inventory date: October 2, 2026. Baseline product SHA:
`ef552587a6514e116840b19f27c9b79ea6db0708`.

## Working checkpoint

- Branch: `feature/ui-redesign`; no push, merge or deployment authorized.
- Last approved implementation: Whitespace, checkpoint 38, user-approved October 6.
- Current task: selecting checkpoint 39 from remaining reports.
- Active card: [RPT-WHITE](redesign-pages/RPT-WHITESPACE.md).
- Approved effort estimate: about 42%; strict DONE counters below are separate.
- Use current page code/tests and shared contracts, not historical logs.
- Protected note drafts and production port 5151 remain untouched.
- Known/deferred issues: [archived checkpoint context](REDESIGN-CHECKPOINT-HISTORY.md).
- Next action: commit approved Whitespace, then migrate next report and notify on Discord.

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

As of checkpoint 38 sign-off, the rough effort-based estimate is **about 42%**
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
| RPT-HUB | Reports hub | `/reports` | `reports_hub.html` | VERIFY | [Checkpoint 34](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-34-main-reports-directory); native grouped directory, identical registry/menu order, local filter and Back context; user-approved October 5 |
| RPT-INIT | Initiative Tracker | `/reports/initiative-tracker`; `/reports/manager-one-on-one` | `report_manager_one_on_one.html` | TODO | - |
| RPT-ACT | Activity coverage | `/reports/activity-coverage` | `report_activity_coverage.html` | TODO | - |
| RPT-OOO | Seller 1:1 preparation | `/reports/one-on-one` | `report_one_on_one.html` | TODO | - |
| RPT-WORK | Workload | `/reports/workload` | `report_workload.html` | VERIFY | [Checkpoint 35](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-35-workload-report); native topic/customer browser, preserved scope/totals/exports, sorting, Back and compact embeds; user-approved October 6 |
| RPT-HYG | Hygiene | `/reports/hygiene` | `report_hygiene.html` | VERIFY | [Checkpoint 36](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-36-engagement--milestone-hygiene); native sortable data columns, plain Fix headings, confirmed annotations, protected dialogs, authoritative refresh, both-queue exports and Back; user-approved October 6, committed `9195a2c8` |
| RPT-NEW | What's New | `/reports/whats-new` | `report_whats_new.html` | VERIFY | [Page card](redesign-pages/RPT-WHATS-NEW.md); user-approved October 6, committed `175a0b0b` |
| RPT-WHITE | Whitespace | `/reports/whitespace` | `report_whitespace.html` | VERIFY | [Page card](redesign-pages/RPT-WHITESPACE.md); user-approved October 6 |
| RPT-MSX | MSX workspace | `/reports/msx-workspace` | `report_msx_workspace.html` | TODO | - |
| RPT-MKT | Marketing insights | `/reports/marketing-insights` | `report_marketing_insights.html` | TODO | - |
| RPT-GOALS | Connect goals | `/reports/connect-goals` | `report_connect_goals.html` | TODO | - |
| RPT-U2C | U2C | `/reports/u2c` | `report_u2c.html` | TODO | - |
| RPT-IMPACT | Connect impact | `/reports/connect-impact` | `report_connect_impact.html` | TODO | - |
| REV-DASH | Revenue dashboard | `/reports/revenue`; `/revenue` redirects | `revenue_dashboard.html` | VERIFY | [Continuous shell pilot](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-24-continuous-workbench-shell-and-revenue-pilot) |
| REV-IMPORT | Revenue import | `/revenue/import`; `/import/revenue` redirects | `revenue_import.html` | VERIFY | [Checkpoint 33](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-33-revenue-syncimport); native maintenance panes, sortable unchanged history/months, explicit sync/save recovery and shared inline buckets; user-approved October 5, committed as `a6b6253` |
| REV-CONFIG | Revenue configuration | `/revenue/config` | `revenue_config.html` | VERIFY | [Checkpoint 32](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-32-revenue-analysis-configuration); native contextual editor, exact fields/values and save parity; user-approved October 5, committed as `350e152` |
| REV-SELL | Seller revenue alerts | `/revenue/seller/<seller_name>` | `revenue_seller_alerts.html` | VERIFY | [Queue/detail workbench pilot](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-25-seller-revenue-queue-and-inspector) |
| REV-SELL-PRODS | Seller products | `/revenue/seller/<seller_name>/products` | `revenue_seller_products.html` | VERIFY | [Checkpoint 30 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-30-seller-products-and-monthly-comparison) |
| REV-SELL-PROD | Seller product detail | `/revenue/seller/<seller_name>/product/<path:product>` | `revenue_seller_product_view.html` | VERIFY | [Checkpoint 30 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-30-seller-products-and-monthly-comparison) |
| REV-CUST | Customer revenue | `/revenue/customer/<int:customer_id>`; `/customer/<int:customer_id>/revenue` | `revenue_customer_view.html` | VERIFY | [Checkpoint 26 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-26-customer-revenue-analysis-and-history) |
| REV-BUCKET | Customer bucket products | `/revenue/customer/<int:customer_id>/bucket/<bucket>`; `/customer/<int:customer_id>/revenue/bucket/<bucket>` | `revenue_bucket_products.html` | VERIFY | [Checkpoint 27 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-27-customer-bucket-product-history) |
| REV-PRODS | Products | `/revenue/products`; `/products` | `revenue_products_list.html` | VERIFY | [Checkpoint 29 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-29-products-directory) |
| REV-PROD | Product detail | `/revenue/product/<path:product>`; `/product/<path:product>` | `revenue_product_view.html` | VERIFY | [Checkpoint 28 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-28-product-revenue-comparison-and-history) |
| REV-RPTS | Revenue reports | `/reports/revenue-reports`; `/revenue/reports` redirects | `revenue_reports_list.html` | VERIFY | [Checkpoint 31](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-31-revenue-report-surfaces); native real-report list and Analyzer command; user-approved October 5 |
| REV-SYN | Synapse customers | `/reports/synapse-customers`; `/revenue/reports/new-synapse-users` and `/reports/new-synapse-users` redirect with `?mode=new` | `revenue_report_synapse_customers.html` | VERIFY | [Checkpoint 31](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-31-revenue-report-surfaces); native grouped reading, modes, sorting, exports and Back; user-approved October 5 |

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
| FR-REV-HISTORY | `partials/_revenue_monthly_history.html` | Customer bucket Full History and product customer history | DONE | [Checkpoint 28 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-28-product-revenue-comparison-and-history) |
| FR-PRODUCT-COMPARE | `partials/_revenue_product_customers.html`, `partials/_revenue_product_summary.html`, `get_product_comparison` | Products inspector and Product Revenue; existing product aliases with `comparison=1` | DONE | [Checkpoint 29 evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-29-products-directory) |
| JS-TABLE-SORT | `static/js/ui-table-sort.js`, `static/css/ui-table-sort.css` | Products, Product/Customer/Bucket Revenue, Analyzer, seller alerts and shared inspectors/previews | DONE | [Sorting evidence](redesign-pages/HOME-WORKBENCH-HISTORY.md#shared-sortable-columns-october-5-follow-up) |
| INC-ACTION | `partials/_action_item_detail_modal.html` | Home, action hub, engagement/project details | DONE | [Evidence](redesign-pages/HOME-WORKBENCH.md) |
| JS-REV-BUCKET | `static/js/revenue-bucket-filter.js` | Home, revenue dashboard/customer/seller views, seller summary and preview | DONE | [Checkpoint 18 evidence](redesign-pages/HOME-WORKBENCH.md) |
| INC-DASH | `partials/_dashboard_settings.html` | Home and preferences | TODO | - |
| INC-FY | `partials/_fy_management_card.html` | Admin | TODO | - |
| INC-PROJ-FORM | `partials/_project_form_fields.html` | Project/note forms | TODO | - |
| INC-EXPORT | `partials/_report_export.html` | Reports, revenue dashboard, milestone tracker | BUILDING | [Native Analyzer opt-in; other hosts remain legacy](redesign-pages/HOME-WORKBENCH-HISTORY.md#checkpoint-23-revenue-analyzer-and-seller-alert-pages) |
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
