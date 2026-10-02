# Redesign page and surface tracker

Use the [workflow](REDESIGN-WORKFLOW.md) and [page evidence template](REDESIGN-PARITY-TEMPLATE.md).
Inventory date: October 2, 2026. Baseline product SHA:
`ef552587a6514e116840b19f27c9b79ea6db0708`.

## Working checkpoint

- Current page/surface: GLOBAL-SHELL, checkpoint 1 (theme token foundation)
- Next action: inventory global navigation and conditional controls, then replace
  the shared shell/menus using the new tokens; prove note/milestone partial flows next
- Working branch: `feature/ui-redesign`; approved archive is present in `design-studies/`
- Last reconciled product SHA: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Final candidate product SHA: not selected
- Page progress: 0 / 90 DONE
- Shared fragment/helper progress: 0 / 24 DONE
- Global/shell/error progress: 0 / 17 DONE
- Additional pages discovered after baseline: none recorded
- Commit cadence: each coherent, verified checkpoint; no automatic push or merge
- Pre-release reviewer: the user; external tester/users provide post-release QA

Statuses: TODO, AUDITED, BUILDING, VERIFY, DONE, REOPEN, BLOCKED.
Replace the dash in Evidence with a link to the page card when work starts.
Keep counts updated, but the rows and revision-specific approvals are authoritative.

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
| HOME | Dashboard/calendar | `/` | `index.html` | TODO | - |
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
| NOTE-VIEW | Note detail | `/note/<int:id>` | `note_view.html` | TODO | - |
| NOTE-EDIT | Edit note | `/note/<int:id>/edit` | `note_form.html` | TODO | - |
| FILL-DAY | Fill My Day | `/fill-my-day` | `fill_my_day.html` | TODO | - |
| ENG-LIST | Engagements | `/engagements` | `engagements_hub.html` | TODO | - |
| ENG-NEW | Create engagement | `/customer/<int:customer_id>/engagement/new` | `engagement_form.html` | TODO | - |
| ENG-VIEW | Engagement detail | `/engagement/<int:id>` | `engagement_view.html` | TODO | - |
| ENG-EDIT | Edit engagement | `/engagement/<int:id>/edit` | `engagement_form.html` | TODO | - |
| MS-LIST | Milestones | `/milestones` | `milestones_list.html` | TODO | - |
| MS-NEW | Create milestone | `/milestone/new` | `milestone_form.html` | TODO | - |
| MS-VIEW | Milestone detail | `/milestone/<int:id>` | `milestone_view.html` | TODO | - |
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
| RPT-HUB | Reports hub | `/reports` | `reports_hub.html` | TODO | - |
| RPT-INIT | Initiative Tracker | `/reports/initiative-tracker`; `/reports/manager-one-on-one` | `report_manager_one_on_one.html` | TODO | - |
| RPT-ACT | Activity coverage | `/reports/activity-coverage` | `report_activity_coverage.html` | TODO | - |
| RPT-OOO | Seller 1:1 preparation | `/reports/one-on-one` | `report_one_on_one.html` | TODO | - |
| RPT-WORK | Workload | `/reports/workload` | `report_workload.html` | TODO | - |
| RPT-HYG | Hygiene | `/reports/hygiene` | `report_hygiene.html` | TODO | - |
| RPT-NEW | What's New | `/reports/whats-new` | `report_whats_new.html` | TODO | - |
| RPT-WHITE | Whitespace | `/reports/whitespace` | `report_whitespace.html` | TODO | - |
| RPT-MSX | MSX workspace | `/reports/msx-workspace` | `report_msx_workspace.html` | TODO | - |
| RPT-MKT | Marketing insights | `/reports/marketing-insights` | `report_marketing_insights.html` | TODO | - |
| RPT-GOALS | Connect goals | `/reports/connect-goals` | `report_connect_goals.html` | TODO | - |
| RPT-U2C | U2C | `/reports/u2c` | `report_u2c.html` | TODO | - |
| RPT-IMPACT | Connect impact | `/reports/connect-impact` | `report_connect_impact.html` | TODO | - |
| REV-DASH | Revenue dashboard | `/reports/revenue`; `/revenue` redirects | `revenue_dashboard.html` | TODO | - |
| REV-IMPORT | Revenue import | `/revenue/import`; `/import/revenue` redirects | `revenue_import.html` | TODO | - |
| REV-CONFIG | Revenue configuration | `/revenue/config` | `revenue_config.html` | TODO | - |
| REV-SELL | Seller revenue alerts | `/revenue/seller/<seller_name>` | `revenue_seller_alerts.html` | TODO | - |
| REV-SELL-PRODS | Seller products | `/revenue/seller/<seller_name>/products` | `revenue_seller_products.html` | TODO | - |
| REV-SELL-PROD | Seller product detail | `/revenue/seller/<seller_name>/product/<path:product>` | `revenue_seller_product_view.html` | TODO | - |
| REV-CUST | Customer revenue | `/revenue/customer/<int:customer_id>`; `/customer/<int:customer_id>/revenue` | `revenue_customer_view.html` | TODO | - |
| REV-BUCKET | Customer bucket products | `/revenue/customer/<int:customer_id>/bucket/<bucket>`; `/customer/<int:customer_id>/revenue/bucket/<bucket>` | `revenue_bucket_products.html` | TODO | - |
| REV-PRODS | Products | `/revenue/products`; `/products` | `revenue_products_list.html` | TODO | - |
| REV-PROD | Product detail | `/revenue/product/<path:product>`; `/product/<path:product>` | `revenue_product_view.html` | TODO | - |
| REV-RPTS | Revenue reports | `/reports/revenue-reports`; `/revenue/reports` redirects | `revenue_reports_list.html` | TODO | - |
| REV-SYN | Synapse customers | `/reports/synapse-customers`; `/revenue/reports/new-synapse-users` and `/reports/new-synapse-users` redirect with `?mode=new` | `revenue_report_synapse_customers.html` | TODO | - |

## Shared HTML fragments and helpers

These must be verified in every host context, not only in isolation.
An `/api/` URL can return HTML. Page-local dialogs remain in their page's card.

| ID | Surface / template | Route or host | Status | Evidence |
| --- | --- | --- | --- | --- |
| FR-ACTIONS | `partials/_action_items_hub.html` | `/api/action-items-hub` | TODO | - |
| FR-CUST-OPPS | `partials/_customer_opportunities.html` | `/api/customer/<int:customer_id>/opportunities-html` | TODO | - |
| FR-ENG | `partials/_engagement_view_content.html` | `/api/engagement/<int:id>/detail` | TODO | - |
| FR-MS | `partials/milestone_view_content.html` | `/api/milestone/<int:id>/detail` | TODO | - |
| FR-NOTE | `partials/note_view_content.html` | `/api/note/<int:id>/detail` | TODO | - |
| FR-OOO | `partials/one_on_one_workspace_content.html` | `/api/seller/<int:seller_id>/one-on-one/detail` | TODO | - |
| FR-OPP | `partials/opportunity_view_content.html` | `/api/opportunity/<int:id>/detail` | TODO | - |
| FR-PROJ | `partials/project_view_content.html` | `/api/project/<int:id>/detail` | TODO | - |
| FR-REV | `partials/revenue_alert_detail.html` | `/api/revenue/analysis/<int:analysis_id>/detail` | TODO | - |
| INC-ACTION | `partials/_action_item_detail_modal.html` | Home, action hub, engagement/project details | TODO | - |
| INC-DASH | `partials/_dashboard_settings.html` | Home and preferences | TODO | - |
| INC-FY | `partials/_fy_management_card.html` | Admin | TODO | - |
| INC-PROJ-FORM | `partials/_project_form_fields.html` | Project/note forms | TODO | - |
| INC-EXPORT | `partials/_report_export.html` | Reports, revenue dashboard, milestone tracker | TODO | - |
| INC-ACT-CAIP | `partials/activity_coverage_caip.html` | Activity coverage | TODO | - |
| INC-ACT-MS | `partials/activity_coverage_milestones.html` | Activity coverage | TODO | - |
| INC-CUST-ICON | `partials/customer_favicon.html` | Customer favicon macro, multiple hosts | TODO | - |
| INC-ENG-PANEL | `partials/engagements_panel.html` | Home, engagements hub, seller | TODO | - |
| INC-MS-TRACK | `partials/milestone_tracker_content.html` | Milestone tracker and seller | TODO | - |
| INC-PART-ICON | `partials/partner_favicon.html` | Partner/specialty surfaces | TODO | - |
| INC-REV-ALERTS | `partials/revenue_alerts_content.html` | Revenue/seller surfaces | TODO | - |
| INC-REVIEW | `partials/review_action.html` | Home and revenue/seller surfaces | TODO | - |
| INC-FORECAST | `_forecast_comments.html` | Milestone/opportunity details | TODO | - |
| INC-FORECAST-JS | `_forecast_comments_js.html` | Milestone/opportunity details | TODO | - |

## Global, native-shell and error surfaces

| ID | Surface | Location | Status | Evidence |
| --- | --- | --- | --- | --- |
| GLOBAL-SHELL | Navigation, page frame, theme, flash/status messages, global controls | `templates/base.html` | BUILDING | [Card](redesign-pages/GLOBAL-SHELL.md) |
| GLOBAL-SETUP | Welcome/sign-in/onboarding | `base.html`, welcome modal | TODO | - |
| GLOBAL-NOTE | Quick-note customer picker | `base.html`, quick-note modal | TODO | - |
| GLOBAL-ENG | Quick-engagement customer picker | `base.html`, quick-engagement modal | TODO | - |
| GLOBAL-HELP | Contextual page help | `base.html`, help modal | TODO | - |
| GLOBAL-KEYS | Keyboard shortcuts | `base.html`, shortcuts modal | TODO | - |
| GLOBAL-CHAT | Copilot chat | `base.html`, chat flyout | TODO | - |
| GLOBAL-SHARE | Sharing | `base.html`, share modal | TODO | - |
| GLOBAL-IMPORT | Shared-data import review | `base.html`, import-review modal | TODO | - |
| GLOBAL-ZOOM | Image zoom | `base.html`, image-zoom modal | TODO | - |
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
