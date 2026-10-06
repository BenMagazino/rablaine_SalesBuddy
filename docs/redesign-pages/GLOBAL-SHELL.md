# GLOBAL-SHELL: active contract

- Status: BUILDING; individual approved shared surfaces remain approved.
- Direction: approved Graphite / Muted desktop workbench, Segoe UI, eight token pairs.
- Historical proof: [shell checkpoints](GLOBAL-SHELL-HISTORY.md).
- Current migration: [page tracker](../REDESIGN-PAGE-TRACKER.md).

## Window and navigation

- Logo links Home. Real ancestry belongs below the navbar, not inside page content.
- Breadcrumbs use canonical ownership, never referrer history or invented parents.
- Migrated full pages opt into `body.sb-page-frame` with `ui-page-frame.css`.
- Direct main surface uses `data-sb-page-surface`; fixed bands use
  `data-sb-page-band`; flexible work uses `data-sb-page-body`.
- Work regions own scrolling and focus. Connected dividers replace enclosing cards.
- Composition follows the task; do not force every page into a selector/detail split.
- Status reports actual scope, counts or freshness, not app/legal branding.
- Embeds omit window/navigation/footer ownership. Legacy pages are not implicitly restyled.

## Shared components

- Use `SBTableSort` with raw numeric/calendar keys, stable row identity and pinned totals.
- `create(table)` / `mount(root)` are idempotent; instances expose `state` / `restore`.
- Directions are `ascending` / `descending`; missing values stay last both ways.
- Plain action headings such as Fix are not sortable data.
- Use `SBDialog` for lifecycle, focus return and protected closing.
- Reuse native record/revenue previews and customer/milestone pickers.
- Shared export configuration is JSON-safe; native/plaintext scope remains explicit.
- Changing shared code requires its scoped regressions and affected-host smoke checks.

Update this contract only when shared behavior changes. A new page using it is
evidence in that page's card, not another shell checkpoint narrative.
