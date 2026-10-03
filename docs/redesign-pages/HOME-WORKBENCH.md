# Home workbench composition and attention panels

- Status: DONE for this slice; user signed off October 3 after bar/type refinement
- Checkpoint: 13
- Parent checkoffs: HOME and GLOBAL-SHELL remain BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Approved UI baseline: `c652057`, milestone body and forecast comments
- Implementation tested: working tree based on `c652057`
- Next action: commit this approved slice, then implement checkpoint 14 calendar styling.
  No push, merge or deployment.

The approved freshness bar prompted a separate deferred feature:
[detached data jobs](../PLAN_DETACHED_DATA_JOBS.md). Its in-place launchers are
planning only, not part of the current read-only bar.

## Scope and preserved inventory

Home uses a calendar-first desktop composition with the approved 366px attention
dock alongside it. Activity comes before the dock in DOM order, not just visual
order. One continuous surface joins the calendar to a flush dock; a vertical
divider separates them and horizontal dividers separate the three independently
scrollable sections. There are no surrounding card borders, radii or gutters.
Headings and footer destinations remain. There is no new data model, sync job or dependency.

Keep all engagement tasks, daily and saved Copilot suggestions, ordinary project
tasks, high-priority/overdue states, stale milestones, seller destinations,
estimated usage, hygiene tasks, upcoming milestone dates/statuses, revenue
categories/amounts, bucket filtering and original preview parameters. Keep every
conditional activity tab, lazy-load endpoint, saved-tab/month key, task calendar,
quick-create launcher, unsaved-draft workflow and daily meeting-refresh behavior.

## Implementation and intentional changes

- User rejected the initial padded-card composition on October 3. The corrected
  frame follows the approved `navigation.css` archive: zero outer padding and
  grid gaps, a flush divider-only dock, square geometry, compact section headings,
  and month/Today/Previous/Next controls beside activity tabs in one toolbar.
  The follow-up restores the complete navbar-to-bottom frame: a 32px breadcrumb
  strip, the calendar's 40px icon legend and a continuous 24px freshness strip. The old
  browser footer is omitted only on Home. An empty flash stack no longer reserves
  space; actual notices and persistent status strips remain visible.
- User review removes decorative workspace captions. A removal experiment showed
  that the lower band gives the intentionally unequal legend and alert footer
  heights a common visual baseline; the band is restored with real data freshness.
  The legend stays 40px and the alert destination footer keeps its existing height.
- Freshness uses the existing generic sync-status read endpoint, extended to accept
  the already-tracked ACR and U2C types. Stacking timestamps immediately under the
  calendar legend proved too dense, even with separators. The user chooses to keep
  the legend and show refresh details on demand: a single right-aligned bottom-bar
  control opens a native, nonmodal popover with four equal-weight status links.
  Escape/outside click dismiss it; warning/error colors remain meaningful.
  Each source shows its actual latest attempt state, including failed/interrupted/
  not-yet-refreshed. ACR honors legacy file imports only when API sync has never run,
  never masking a failed newer API refresh. U2C's tooltip distinguishes the last
  baseline refresh check from MSXi's weekly publication date.
  Timestamps reuse the shared UTC-to-local renderer, with the full recorded timestamp
  available on hover; no success dot is invented.
  Each source links to its existing Admin or report details. Opening the panel or
  using Check now performs GETs only; no actual sync is triggered.
  Visible pages check once a minute and on return; pending checks are coalesced,
  timed out after 10 seconds and aborted on page exit. Errors remain visible and
  retryable without hiding the other sources; refresh preserves keyboard focus.
- A right-only disclosure made the band visually lopsided. The user agrees to
  trial rendered-view counts on the left, today's local date in the center and
  Refresh status on the right; the counts' usefulness is not approved yet.
  Equal grid side tracks keep the date mathematically centered. Counts follow
  the displayed month, ghost removal/day replacement and engagement filters,
  not database-wide or stale tab totals. Task counts cover the displayed month
  and explicitly exclude the overdue summary. Loading/read errors remain
  loading/unavailable, not fabricated zero counts. DOM observation adds no
  data requests; the date updates after midnight and on visibility return.
- Reconciled already-migrated Home typography to the archive's 14px reference:
  18.2px month heading, 10.92px tabs/panel headings, 11.62px row titles,
  10.5px secondary copy, 10.64px normal-weight weekdays, 9.8px legend and
  9.38px status band. Normal chrome line heights and heading tracking match
  the archive. These are Home-scoped tokens, not a global root-font change.
  Existing shell font family/palette already match; calendar entry styling
  remains explicitly unmigrated below.
- User likes the balanced composition but finds the literal archive type too
  small. Readability follow-up keeps the font family, normal/semibold roles and
  layout, increasing panel/tab/weekday/secondary text to 12px, row titles to
  13px and legend/status/footer text to 11px at the current 16px root size.
  Home's scale uses rem tokens so it follows root text sizing; the month heading
  stays 18.2px. The 24px status band, 40px legend and 35px alert footer stay fixed.
- User chooses plain-text counts to avoid extra visual density. Both bars keep
  their shared 17px inset; the legend's perceived glyph offset is left alone.
- Saved drafts move behind a visible counted breadcrumb control into the shared
  native dialog. Resume destinations, delete/clear confirmations, storage updates,
  sorting and relative times are preserved. Customer names render as literal DOM
  text; links and delete buttons are siblings, not nested interactive controls.
- App-owned Home frame, calendar toolbars, weekday chrome and attention surfaces
  consume the existing theme tokens. The logo's existing `.sb-home` class is not
  reused as a page namespace; the page owns `.sb-home-page`.
- Calendar week heights share the dock's desktop height budget. Four-, five- and
  six-week months retain all dates. Workspace height uses the actual available
  viewport without a 1050px cap; real notices reduce that budget. Toolbar, weekday
  strip, collapsed cell borders and legend are measured rather than guessed.
  Engagement/Project contents scroll within the activity pane. Very short desktop
  windows retain a 400px workspace minimum and normal document scrolling.
- Native activity tabs replace Bootstrap Tab instances. ARIA selection, hidden
  panels, one tab stop, arrow wrapping, Home/End and keyboard focus are explicit.
  The existing `shown.bs.tab` event contract remains solely to reuse the unchanged
  Home lazy-load/persistence listeners. Calendar activation now works even when
  there are no milestones.
- Preview rows accept Enter/Space without consuming child-link or modified-key
  behavior. Focus outlines are inset where a scrolling panel would clip them.
- Soft filled, transparent-border metadata tags remain distinct from outlined
  actions. Blue uses the existing accent; green, amber, red and gray preserve
  meaningful states. Seller links use the canonical person icon and blue class.
  Neutral ink defaults have lower specificity than semantic overrides.
- Bucket filter fractions are ordinary inline text, for example `Buckets 1/6`,
  without a separate badge or icon. The shared filter keeps its original selection,
  persistence and popover behavior across all consumers.

## Automated evidence

- Final signed-off revision: 51 Home/freshness/summary/bucket Node checks and
  29 isolated Home/freshness API Python checks pass. Plain-text summary,
  larger type and the balanced bar are accepted; calendar entries remain next.
- Readability follow-up: all 19 scoped Home Node checks pass. Live computed
  sizes match the revised scale; all eight themes retain zero center error,
  footer overflow and bottom gap, with unchanged 24px/40px/35px bar heights.
- Balanced-bar/type trial: 14 isolated Home Python checks and 48 scoped
  Home/freshness/summary Node checks pass. Added rendered-view counts, singular/
  plural/empty/loading/error cases, conditional tabs, filter/day updates,
  local-date rollover/visibility, back-cache cleanup/reconnection, explicit
  markup failures, centered grid and archive type-scale assertions. Day-refresh
  spinners do not replace existing counts with a full-calendar loading label.

- 27 passed: `test_ui_home.py` and the Home/calendar selection in `test_views.py`.
  Includes all eight conditional tab combinations, actual route rendering,
  every task source, original destinations, statuses/amounts and empty states.
- 45 Node checks passed: Home, theme, record dialog, note actions and milestone
  workflow suites. Includes native tab state/events/keyboard behavior, duplicate
  event prevention, explicit invalid markup failures, desktop height bounds,
  semantic CSS specificity and the existing preview/draft/write lifecycle.
  Draft coverage includes safe literal rendering, sorting/counts, confirmed delete,
  last-draft empty state, cancel/clear preservation and malformed-data logging.
  Structure checks cover the breadcrumb/legend/dialog and prove non-Home
  pages retain their existing footer.
- After the user's composition correction: 26 scoped Python tests and all 11
  Home Node checks pass. Added assertions for the single shared toolbar,
  zero-padding frame, zero-gap dock, square geometry and divider-only sections.
- After the four-source freshness update: 29 scoped Home/API Python tests and 48
  Home/freshness/bucket/shared-sync Node checks pass. Coverage includes successful,
  missing, failed, interrupted and invalid snapshots, read errors/recovery,
  timezone handling, hidden-page polling, duplicate reads, timeout and disposal.
  API tests prove stored timestamps are read without creating or changing sync
  records, including legacy ACR imports and unknown-type rejection.
- During the separator/equal-emphasis experiment: 14 Home Python tests and 33
  Home/freshness Node checks pass. Markup has no importance classes; CSS keeps
  all sources normal-weight with decorative token-colored dividers and retains
  semantic warning/error overrides.
- After on-demand details: 14 Home Python tests and 35 Home/freshness Node checks
  pass. Tests cover native popover wiring, opening/read-only checking, expanded
  state, dismissal without aborting reads, and unchanged focus/lifecycle behavior.
  Escape handling also prevents the legacy global cancel shortcut from consuming
  dismissal while focus is inside the panel or on its launcher.
- The initial editor run of the broader views file reported 60 passes and one
  unrelated seller-engagement assertion: story completeness is 71, expected 83.
  No story/query code was changed. The relevant 26-test selection is green;
  this checkpoint does not claim that the broader views file is green.
- Editor diagnostics and whitespace checks are clean.

## Live development evidence

Validated the actual Home on `127.0.0.1:5000`, preserving its desktop viewport.
No demo server, cloned database, sample records or production-port access.

- Calendar, Engagements and Projects switch correctly; actual engagements load
  and two real projects load. Home/End restores focus and selection correctly.
  A reload restores Projects and its lazy-loaded content.
- Action item 9, milestone 342 and a visible real revenue alert open from native
  keyboard rows. All three previews close cleanly; milestone focus returns to
  the actual focusable launcher.
- Next/Previous/Today remain functional. Actual May 2026 and February 2026
  calendar reads verify six- and four-week geometry respectively.
- Date-number refresh sends the original `{"date":"2026-10-01"}` payload.
  Its POST was intercepted before reaching the server; the handler was removed.
- Dashboard configuration still opens and closes through its existing launcher.
  No preferences were toggled.
- 65 actual tags checked in each of eight distinct family/mode pairs. Expected
  semantic tokens were derived independently from their classes, not from the
  implementation's own ink variable. Every mapping and transparent border passes;
  minimum text contrast is 4.73:1, with no horizontal overflow.
- Native heading, tab, toolbar button and sidebar tag styles remain identical
  when the Bootstrap stylesheet is temporarily disabled, then restored.
- No page errors in the tab/preview/month/refresh checks. Closing the milestone
  preview aborts its pending read as intended.
- Corrected composition verified live against the archived theme-pair mockup:
  main padding and both grid gaps are 0px, section radii are 0px, and section
  boundaries are only shared horizontal dividers. Calendar and dock meet without
  a gutter. Projects hides month controls; keyboard return to Calendar restores
  them. Previous/Next still work in the shared toolbar. Existing draft preserved.
- Full-height correction: breadcrumb begins at the navbar's 46px bottom, and the
  freshness strip ends at the 1167px viewport bottom. All eight theme pairs
  have no visible top/bottom gaps, page overflow, calendar overflow or legend overflow.
  Four-, five- and six-week real calendar reads also have zero overflow.
- Actual freshness reads show completed Milestones, ACR, Accounts and U2C refresh
  timestamps. The bar is 24px, legend 40px and alert footer 35px, unchanged.
  A forced ACR-read 503 shows unavailable while retaining the other three timestamps;
  retry restores the real ACR state. Manual refresh issues only the four expected
  GETs and preserves focus. Every theme pair has zero bar overflow. Accounts' Admin
  anchor exists, and ACR/U2C detail pages respond successfully.
- The separator experiment showed three 1px-wide, 12px-high inset separators and identical
  normal weight/color for all four completed refresh labels. The bar remains
  24px with zero overflow or bottom gap.
- The density correction initially left only Refresh status in the bottom bar, with the
  four timestamps hidden until requested. Enter opens, Tab reaches the first detail
  link, Escape closes and restores focus, and outside click dismisses. Opening and
  Check now each perform four GETs only; Check now preserves focus. The legend
  remains 40px and the bottom band 24px, with no bottom gap.
- Balanced-bar trial: real September shows 7 saved notes and 11 cached meetings,
  matching its API response. October returns to 0 notes / 8 meetings.
  Engagements shows 33 rendered entries; filtering Active shows 30; Projects
  shows 2. Filters and the October Calendar view are restored. All eight theme
  pairs measure zero date-center error, zero overflow/bottom gap, a 24px band,
  40px legend and 35px alert footer. The details popover fits every theme at the
  unchanged desktop viewport. A held/failed Calendar read shows loading then
  unavailable, and restoring the real read recovers the October counts.
  Native Enter/Escape still opens/dismisses details and restores launcher focus;
  opening and Check now each issue exactly four status GETs, not sync writes.
- The real Hanger draft opens from Drafts 1 with its original resume destination.
  Escape restores focus to Drafts; the dialog's Close control works as well.
  No draft was resumed, edited, deleted or cleared in the live data.
- Engagements and Projects hide the month controls and fill the available activity
  pane; returning to Calendar restores its controls and legend.

Removed temporary probes and interceptors; restored theme attributes and original
localStorage keys. Home is left on Calendar with all dialogs closed. The existing
Hanger draft and separate unsaved New Note tab are untouched. No real writes.

## Remaining Home parity

This is not full HOME sign-off or full Bootstrap removal. The next calendar slice
must replace legacy table/day fills, add approved opaque saved-note customer fills,
muted ghost fills with striped rails/dashed outlines, work-status rails and icon
precedence, Today tint/square date treatment, customer hover/focus highlighting
and the rail-swatch legend. Those approved treatments are absent, not complete.
Loading/error states and date-refresh affordances retain their current
implementation for that pass.
Embedded engagement/project bodies, dashboard settings,
action-item/revenue detail bodies and the shared bucket popover remain separate
migration surfaces. Their current functionality is preserved, not rewritten here.
