# GLOBAL-SHELL: shared frame and theme foundation

- Status: BUILDING; checkpoints 1-30 committed, checkpoint 31 Revenue report surfaces user-approved
- Owner: user and coding assistant
- Pre-release reviewer: the user; external tester/users review after release
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Checkpoint 1 implementation revision: `e84b675e9fadbc3ab3b7a31eaac1e3e64b6680d3`
- Checkpoint 2 implementation revision: `1fbdd64`
- Checkpoint 3 dialog foundation: `160e2d9`, [Help/dialog evidence](GLOBAL-HELP.md), user-approved
- Checkpoint 4 customer pickers: `8dd3363`, [Picker evidence](GLOBAL-PICKERS.md), user-approved
- Checkpoint 5 image viewer: `f1916e8`, [Image evidence](GLOBAL-ZOOM.md), user-approved
- Checkpoint 6 shared flash notifications: `1e7b16c`, [Feedback evidence](GLOBAL-FEEDBACK.md), user-approved
- Checkpoint 7 persistent status strips: `f6e9163`, [Status evidence](GLOBAL-STATUS.md), user-approved
- Checkpoint 8 floating meeting-sync status: `dd44c58`, [Sync evidence](GLOBAL-SYNC.md), user-approved
- Checkpoint 9 note-preview lifecycle/editor: `9545d18`, [Note-preview evidence](HOME-NOTE-PREVIEW.md),
  technically verified, user-approved
- Checkpoint 10 milestone-preview lifecycle/editors: `ce61a1d`, [Milestone evidence](MILESTONE-PREVIEW.md),
  technically verified, user-approved
- Checkpoint 11 shared note body/full-page commands: `3f8ddd5`, [Note-body evidence](NOTE-BODY.md),
  technically verified, user-approved
- Checkpoint 12 shared milestone body/forecast comments: `c652057`, [Milestone-body evidence](MILESTONE-BODY.md),
  technically verified, user-approved
- Checkpoint 13 Home frame/attention panels/native tabs: `a5ed892`, [Home evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3 after balanced-bar/readability refinement
- Checkpoint 14 calendar fills/rails/native day controls: [Calendar evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3 including native calendar picker,
  tag-color correction and floating failure feedback; committed as `3e4c5be`
- Checkpoint 15 calendar loading/error feedback: [Calendar evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3, committed as `1f1472a`
- Checkpoint 16 Home Action Items settings: [Home evidence](HOME-WORKBENCH.md),
  native host and shared Preferences controls technically verified, user-approved October 3,
  committed as `6d15a91`
- Checkpoint 17 shared Action Item preview/editor: [Home evidence](HOME-WORKBENCH.md),
  technically verified, user-approved October 3, committed as `c1242b3`
- Checkpoint 18 shared Revenue Buckets filter: [Home evidence](HOME-WORKBENCH.md),
  technically verified across all live consumers, user-approved October 3,
  committed as `b53752c`
- Checkpoint 19 shared Review Alert editor: [Home evidence](HOME-WORKBENCH.md),
  technically verified across all five live consumers; user-approved October 3,
  committed as `cb9f0e4`.
  The shared child editor is migrated before the Revenue preview shells/bodies.
- Checkpoint 20 native Home Revenue preview and shared alert details:
  [Home evidence](HOME-WORKBENCH.md), technically verified, user-approved October 4.
  Committed as `401846d`; approved overall completion is about 19% by effort.
- Checkpoint 21 shared native Revenue preview frames and Seller return lifecycle:
  [Home evidence](HOME-WORKBENCH.md), technically verified, user-approved October 4.
  Committed as `a4ec9a8`; approved overall completion is about 20% by effort.
  Revenue Analyzer, seller alerts and Seller Full View drilldown now share Home's
  native frame/controller. Seller Full View itself and customer revenue remain legacy.
- Checkpoint 22 shared native Revenue alert lists and Seller Full View:
  [Home evidence](HOME-WORKBENCH.md), technically verified, user-approved October 4.
  Committed as `25a14d4`; approved overall completion is about 22% by effort.
- Checkpoint 23 Revenue Analyzer and seller alert page chrome:
  [Revenue page evidence](HOME-WORKBENCH.md#checkpoint-23-revenue-analyzer-and-seller-alert-pages),
  technically verified, user-approved October 4, committed as `60dbdb3`.
  Native menus now support explicit
  command anchoring outside the app bar without changing header-menu placement.
  Analyzer opts into native export commands/feedback; other report hosts retain
  their legacy defaults. Customer revenue and the remaining global shell are not migrated.
  October 4 review moves Revenue breadcrumbs to a shared full-width context bar
  directly below navigation, reusing Home's strip styles. Legacy page background,
  footer and missing workspace boundary remain explicitly unfinished.
- October 4 app-wide breadcrumb standard, user-approved:
  all 90 base-inheriting page endpoints have declared canonical ancestry.
  Home is linked first on non-home pages; real parent names link to real pages,
  quiet `>` separators are hidden from assistive technology, and the current
  page is unlinked with `aria-current="page"`. Home keeps its location label and
  draft control. Embedded pages and injected fragments omit the outer trail.
  Customer Revenue follows actual Seller > Customer ownership; Seller Revenue
  follows its Seller Hub; Revenue Analyzer belongs to Reports.
  Unassigned customers omit the absent seller, and unmatched imported seller names
  use the reporting hierarchy rather than a broken Seller Hub link.
  Parentage never depends on referrer history or report filter mode. Page titles
  are escaped once, record names stay literal, and long labels truncate with
  their complete accessible text and title retained.
- Checkpoint 24 continuous workbench contract and Revenue pilot, technically
  verified and visually approved October 4, 2026, except scrolling was not manually
  reviewed by the user because their visible dataset did not overflow:
  an opt-in `body_class` hook and shared `ui-page-frame.css`
  connect Analyzer and seller Revenue to the shell edges. Fixed command/summary
  bands divide the work surface from independently scrolling alert tables.
  A 24px status rail reports actual shown/loaded alert counts and existing scope
  or import freshness. App/legal text moves to the existing Help reference.
  Empty feedback stacks do not create a phantom gap; real notices remain available.
  Embedded views, Home and legacy page bodies keep their previous layouts.
  This is not completion of the global frame or Bootstrap removal.
- Last product reconciliation SHA: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Entry points: every page inheriting `templates/base.html`, including embed mode
- Dependencies: existing `dark_mode` preference, first-launch OS detection,
  onboarding theme choice, menu toggle and preferences page
- Checkpoint 25 seller queue/detail is technically verified and user-approved
  October 4, committed as `747058a`, including priority-color restoration and contextual composition:
  full pages support sustained work, while modals retain focused compact lists
  with shared domain content, actions, semantic colors and native styling.
- Checkpoint 26 customer Revenue adopts the shared shell with a 340px bucket-context
  pane, monthly grids capped at 1120px and filtered scope counts. The two panes
  scroll independently. Navigation chooses content within the saved filter;
  Overview retains all-bucket totals. It is technically verified and user-approved
  October 4, committed as `9a4ddef`. Initial native bucket anchors revealed
  root scrolling despite the fixed body; opted-in frame roots now use overflow
  clipping. Current navigation switches panes rather than jumping a long page.
- Checkpoint 27 applies task-shaped composition to customer bucket Full History:
  analysis/scope stays beside bounded recent and complete product history.
  This single-bucket destination has no redundant scope navigation; embedded
  content remains stacked. It is technically verified and user-approved October 4,
  committed as `aaf6cfd`.
- Checkpoint 28 product Revenue uses the comparison itself to navigate customer
  history. Independently scrolling comparison/history panes have bounded widths,
  fixed summary/search context and a sticky selected-customer heading.
  Product-wide totals remain distinct from search scope. Embeds and no-script
  fallback retain stacked reading. The approved refinement adds a chronological
  graph with mirrored dollar labels, three-column comparison and full-pane history.
  It is technically verified and user-approved October 5, committed as `e286617`.
- Checkpoint 29 follows the user's two-stage browsing direction: products on the
  left, selected product's customer consumption on the right, then the approved
  graph/history workbench for the chosen customer. The right pane has a concrete
  comparison task rather than duplicated product navigation or empty context.
  Both panes scroll independently under pinned headings; shared rollup/markup
  retain existing totals, grouping and destinations. Back restores both reading
  positions and search. Embedded content remains a bounded ordinary list with
  local scope count, not a miniature workbench.
  It is technically verified and user-approved October 5, 2026, committed as `aed2350`.
- Checkpoint 29 sorting follow-up adds one opt-in header/ordering implementation
  to every table column in the recent Revenue workbenches and shared fragments.
  Native header buttons expose direction through `aria-sort`, use raw numeric
  and ISO calendar values, keep totals pinned and retain stable row identity,
  selection, filters and reading offsets. Per-table history state restores on
  Back without changing URLs or graph chronology. Loaded record fragments mount
  the same helper before their domain controls; compact embeds remain ordinary
  sortable lists. All eight themes retain desktop geometry without clipped
  header labels or document overflow. This becomes the future workbench standard.
- Checkpoint 30 reuses the shared Products browser for seller scope, with guarded
  scoped customer reads and unchanged directory aggregation semantics. Full
  detail remains a wide recent-month comparison grid because cross-customer
  comparison is its task, not single-customer history inspection. Fixed bands,
  native search/sorting, independently scrolling data and local scope counts
  connect it to the same shell without inventing a duplicate sidebar.
  Matched customer/bucket links and separate bucket histories are corrected;
  global history behavior stays unchanged. Dedicated Help, actual embeds, live
  parity, read recovery and eight desktop themes are technically verified.
  This family is user-approved October 5, 2026 and committed as `e98c879`.
- Checkpoint 31 uses a real-report directory and continuous seller-grouped
  Synapse reading, not an artificial selector pane. Fixed mode/summary/export
  bands and sticky seller/column headings retain full comparison context.
  Independent calendar/numeric sorting, mode preferences, complete exports,
  compact embeds and exact Back reading restoration are technically verified.
  This family is user-approved October 5, 2026.
- Next action: migrate Revenue analysis configuration and adopt
  the contract as each page is migrated. The wider interim table is not approval
  of the final Revenue layout. The remaining global surfaces stay BUILDING;
  this checkpoint does not approve other page bodies or global overlays.
  no push, merge or deployment is authorized.

## Shared shell contract (checkpoint 24)

Home is the composition reference, not a template that every page must copy.
The initial floating Revenue frame is superseded, not a second supported layout.

1. **Window ownership:** navigation and canonical breadcrumbs belong to the
   persistent shell. Main fills the space between context and status. Do not
   center or outline a page-sized card inside wide outer gutters.
2. **Connected regions:** titles/commands, summaries and dataset tools are bands
   of the same surface. One-pixel dividers mark meaningful region boundaries.
   Do not add enclosing cards or repeat navigation inside the page.
3. **Page-specific composition:** lists, editor/detail splits and forms can
   choose different arrangements. Constrain readable editing/detail widths
   within the work surface, not the app surface itself. Do not add empty panels
   or charts just to consume space.
4. **Scrolling:** work regions own overflow and keyboard focus. Keep commands
   and useful context in place; tables may keep column headers sticky. Avoid
   competing document/main/table vertical scrollbars.
5. **Useful status:** the 24px rail reports view scope, selection, freshness or
   task feedback when relevant. It is not a branding/copyright footer. App/legal
   information remains reachable through Help/About. Counts must distinguish
   visible rows from underlying totals, without silently changing metric or
   export scope.
6. **Incremental adoption:** only migrated standalone pages opt in. Preserve
   embeds and legacy page bodies until their own reconciliation. Home already
   satisfies the composition and retains its existing grid.

### Reusable roles and Revenue pilot

- `body.sb-page-frame` loads `ui-page-frame.css`; the direct
  `#main-content > [data-sb-page-surface]` fills the available work area.
- `[data-sb-page-band]` marks non-shrinking context/command bands.
- `[data-sb-page-body]` supplies remaining height with `min-height: 0`. A page
  owns its internal layout and focusable scroller; the generic shell prescribes
  neither columns nor one universal page design.
- `_page_status.html` renders optional table binding and scope/freshness copy.
  `ui-table-status.js` counts only the bound table's body rows, respecting row
  `display`, `hidden` and class changes and row additions/removals. Reordering
  does not repeat unchanged live announcements. These are shown/loaded view
  counts, not a global database count or a unique-customer metric. Empty views
  render truthful zero without binding a nonexistent table; invalid bindings
  report unavailable and fail explicitly.
- Revenue-specific band spacing, summary presentation and table scrolling stay
  in `ui-revenue-detail.css`, scoped to the opt-in frame. Existing shared list,
  preview, review, filter and export behavior is retained.

Checkpoint 24 deliberately preserves the approved table workflow. On October 4,
the user separately selected the checkpoint 25 standalone seller queue/detail
pilot, retaining Table comparison and correcting that page's alert-count label.
See [checkpoint 25](HOME-WORKBENCH.md#checkpoint-25-seller-revenue-queue-and-inspector).
This does not authorize the same interaction on Analyzer or embedded consumers.

## Checkpoint 1 scope

Implemented `static/css/ui-tokens.css` with the approved four dark/light pairs.
All tokens are namespaced `--sb-ui-*`; no existing component is recolored.
Graphite is the default family. This is infrastructure, not a completed shell
redesign or a new user-facing theme picker.

`static/js/ui-theme.js` synchronously mirrors the current legacy mode into
`data-sb-mode` before token CSS loads. Its temporary attribute observer covers
all existing theme-changing surfaces without duplicating preference writes.
It does not modify the database, change the existing choice, or persist a
family selection. Remove this bridge when all consumers own `data-sb-mode`
directly. Family selection/persistence remains a later PREFS requirement.

## Checkpoint 2 scope

Replace only the shared header, menu controller and inline customer-search
presentation with app-owned code. The page bodies, status banners and global
dialogs retain their existing implementation. The header uses the approved
46px workbench frame, logo-only Home, compact icon navigation, centered search
and quiet blue New note control.

Inventory includes all 38 original header route expressions, dynamic seller
links, DSS/SE and seller-mode conditions, debug role/chat controls, update badges,
theme/settings actions, search behavior and existing dialog launchers. All
original destinations remain. Bootstrap dropdown/collapse behavior is removed
from this header; Bootstrap modal launchers and Icons remain intentionally.

Sellers and Reports now open their menus on click instead of navigating directly.
All Sellers under Directory and All Reports under Overview retain the direct
destinations. This is an intentional placement/interaction change requiring the
user's checkpoint approval. Desktop navigation no longer uses a mobile toggler.

The related admin update renderer uses native `hidden` properties for the new
header badges. Search renders customer labels as text, reports failed requests
visibly and permits retry. Customer detail pages highlight Customers or Browse
according to role. Escape from search/menu does not trigger page-level Cancel.

## Original-to-redesign parity matrix (partial inventory)

This covers theme infrastructure and the header only, not a complete global audit.

| ID | Original contract | New behavior / destination | Evidence | Result |
| --- | --- | --- | --- | --- |
| SHELL-T01 | Saved light/dark preference wins over OS preference | Existing persistence unchanged; tokens use mirrored `data-sb-mode` | Scoped Node tests; live dev page mode agreement | PASS |
| SHELL-T02 | Unset first-launch preference detects OS before painting | Existing script still runs first; bridge uses existing mode or OS when unset | Both OS choices tested without added persistence | PASS |
| SHELL-T03 | Menu/onboarding/preferences mode changes take effect | Observe legacy attribute changes, update only new mode attribute | Both directions tested; browser attribute transition verified | PASS |
| SHELL-T04 | Approved palette and control/status colors stay consistent | App-owned tokens reproduce the reviewed values for all eight variants | 296 comparisons in Node and browser, zero mismatches | PASS |
| SHELL-T05 | Existing page appearance and controls remain intact while migrating | Tokens declare custom properties only; no legacy selector/property overrides | Isolation test; live dev body retains existing background | PASS |
| SHELL-T06 | Corrupt theme mode is not silently presented as success | Log invalid value; retain last valid token mode | Scoped error-path test | PASS |
| SHELL-T07 | Persist optional theme family independently from mode | Not implemented; no picker exposed yet | Requires PREFS / shared theme persistence work | NOT TESTED |
| SHELL-N01 | Logo navigates Home; all header destinations remain available | Logo-only Home and original links, including all 16 reports and Browse destinations | Original route-expression comparison; rendered navigation/report tests | PASS |
| SHELL-N02 | Role/seller conditions choose the correct controls and seller links | Existing conditional rendering and role-switch POST retained | Isolated rendering checks for SE, DSS, seller mode, dynamic sellers and debug state | PASS |
| SHELL-N03 | Sellers/Reports direct navigation and dropdown access | Click/hover opens menu; direct destinations are All Sellers/All Reports | Live menus and preserved hrefs; user must approve interaction change | VERIFY |
| SHELL-N04 | Menus open, switch and dismiss predictably | Native popovers; hover crossing, outside dismissal, arrows, Home/End, Escape and Tab | Scoped Node checks and live pointer/keyboard checks | PASS |
| SHELL-N05 | Customer search lists, filters and navigates real customers | First ten on empty focus; name/nickname/TPID filtering, selection and native links retained | Live initial/empty states and keyboard navigation to real customer; text-rendering test | PASS |
| SHELL-N06 | Search failure is visible, retryable and does not crash | HTTP/shape guards, logged error and explicit retry hint | Node HTTP/malformed-response tests; live 503 and real-data retry | PASS |
| SHELL-N07 | Active destination remains identifiable | Reports precedence retained; customer details choose role-appropriate destination | Role-aware regression test and live customer/report navigation | PASS |
| SHELL-N08 | Updates remain visible and can be dismissed | Existing update state; native hidden attributes and admin updater aligned | Both rendered badge states; related admin mutations inspected | PASS |
| SHELL-N09 | New note, help and debug chat launchers remain available | Existing IDs and launch hooks retained; legacy dialogs still own their content | Live New note/help open-close; conditional/debug launcher rendering tests | PASS |
| SHELL-N10 | Header respects theme and avoids clipping at desktop viewport | App-owned token styling and bounded native menu placement | All eight variants measured live; 46px header, no horizontal overlap, menu text contrast at least 11.83:1 | PASS |
| SHELL-N11 | Embedded partial views omit the global header | Existing embed condition retained; controller safely skips absent header | Rendered embed test and Node no-header test | PASS |

## Verification

- `node --test tests/js/ui_theme.test.cjs`: scoped theme foundation tests.
- All 37 foundation colors match each approved theme (296 comparisons).
- Browser comparison used the owned archive page with production token CSS,
  restored its original attributes and removed the temporary stylesheet.
- Live dev homepage serves both assets and resolves Graphite dark tokens.
- Browser mode transitions were temporary attribute changes, restored afterward;
  no preferences POST, meeting refresh or data mutation was triggered.
- Editor diagnostics: no CSS or JS errors in the new files.
- The existing calendar quick-create and daily-refresh controls have not changed.

### Checkpoint 2 verification

- 17 scoped pytest checks pass: navigation rendering, Reports hub and two
  homepage rendering checks. The full suite was not run.
- 19 Node checks pass across navigation/search behavior and theme foundation.
- Live dev checks cover hover crossing/replacement/dismissal, menu keyboard
  behavior, search selection/navigation, empty result, Escape, failed request
  and recovery, active destinations and New note/help dialog opening/closing.
- Temporary failure interception was removed. Theme attributes were restored;
  no note was saved, preference posted or daily meeting refresh invoked.
- Geometry and theme checks use the existing desktop viewport, not resized
  mobile previews. No real-data screenshot is added to the design archive.
- Debug chat launcher is preserved; its full interaction audit remains
  GLOBAL-CHAT. Full admin update workflows remain ADMIN.
- Editor checks and `git diff --check` are clean.
- The user approved the live header/menu checkpoint for commit on October 2,
  2026, including the Sellers/Reports menu interaction change. Record its commit
  SHA in the next checkpoint, avoiding a self-referential documentation commit.

## Remaining work and sign-off

Checkpoint 6 replaces shared Flask flash styling/dismissal and adds a keyboard
landing target on the main landmark. Its evidence and approval are separate
from persistent status banners, inline page alerts and the full page frame.

The first app-owned dialog slice is implemented with the read-only help surfaces
in checkpoint 3. Its verification is separate from editable record workflows.

Checkpoint 7 replaces persistent VPN/sign-in, FY and viewing-as strip styling
and visibility utilities. Existing actions, conditions and business flows remain.
Its focused evidence records Node behavior, isolated dormant branches and live
access-strip checks. The user approved the live strip preview on October 2, 2026.

Checkpoint 8 replaces shared floating meeting-sync presentation and its
controller. Its API, polling, drag storage and hide-without-cancel behavior remain,
with explicit failed-read feedback and Retry. Its evidence remains separate from
the note form's own meeting-status card and the homepage's refresh ownership.
The user approved the live card preview and corrected header focus on October 2, 2026.

The checkpoint 8 review also identified duplicate customer-search focus outlines.
The scoped input override preserves the outer field's accent border and leaves
all other header/menu keyboard focus indicators unchanged.

Remaining scope includes editable shared overlays, onboarding and
their injected-partial lifecycle, theme-family persistence, full Bootstrap removal
and page approval. Bootstrap Icons remains a separate dependency decision.

No page is DONE. Header verification does not approve its hosted page bodies,
dialog workflows or the full global shell. Checkpoint 1 is committed. Checkpoint
2 is technically verified and user-approved for its checkpoint commit under the
agreed cadence. No push, merge or deployment is implied.
