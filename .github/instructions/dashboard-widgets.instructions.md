---
name: "Dashboard widget authoring"
description: "Use when building or changing dashboard widgets, widget providers, widget filters, shared query loaders, setup requirements, source readiness, sync progress, library previews, or full-report drill-throughs."
applyTo: "app/services/dashboards.py,app/services/dashboard_*.py,app/services/request_cache.py,templates/partials/widgets/**,templates/partials/dashboard_widget*.html,static/js/ui-dashboard*.js,static/css/ui-dashboards.css,tests/test_dashboard*.py,tests/test_request_cache.py"
---

# Dashboard widget authoring

Read [the shared authoring guide](../../docs/DASHBOARD_WIDGET_AUTHORING.md) before
implementing or extending a widget. It is the canonical human/agent reference;
update it when changing the framework's contracts.

- Reuse report/service calculations. Every widget needs a useful full-view
  destination, preferably an existing actionable report preset.
- Declare real filter support in `WidgetDefinition.supported_filters` and implement
  it for rows, totals, counts and history. `None` is unrestricted; `()` is no matches.
  Seller scope never authorizes seller display without explicit grouping.
- Expose reusable reads through named loaders using `@request_cached`. The dashboard
  establishes `shared_read_scope()`; cached outputs are read-only and inputs must
  distinguish scope/period/source semantics. `WIDGET_SOURCES` is sync readiness,
  not a query-sharing manifest or parallel execution plan.
- Reuse the common configuration/sync gates and progress controllers. Never fetch
  remote data during provider/report GETs, fake progress, or auto-retry failures.
  The current requirements UI is compensation-buckets-specific; other setup needs
  a complete backend/form/controller extension, not just another requirement key.
- Every new report/widget import must use central durable sync admission and worker
  execution in `sync_jobs.py`, appear in Sync Status, and use common progress,
  resource locks, failure/retry and job observation. Manual-only imports are not
  exempt. Schedulers and all launchers must join active jobs, not run importers
  inline or start independent background threads. Reuse `fabric` and `sql-motions`
  for their existing source families; test cross-launcher deduplication.
- Sellers (`user_role == 'dss'`) inherit every specialty's features and automated
  syncs, regardless of saved `se_specialty`. Use `has_specialty_access(specialty)`
  (or `is_data_se()` for Data) consistently for tabs, reports, widgets, scheduler
  admission, queued-worker rechecks and schedule copy. Never gate by SE role or
  raw specialty alone. Test matching/nonmatching SEs and sellers with a different
  saved specialty.
- Keep stable widget/variant keys, actual-width previews, unique instance IDs,
  internal table scrolling, and at least 16px rightmost-cell scrollbar padding.
  Preserve saved layouts, filters and unpublished drafts.
- Test standalone/report/widget parity, scoped and empty results, grouping,
  setup/sync/retry ordering, shared-read isolation and supported variants.
  Profile query changes before/after using repeat runs and unchanged-result checks.
- Follow the guide's integration checklist for navigation, SalesIQ, help, source
  jobs and optional starter templates. Validate in the live desktop dev app.
