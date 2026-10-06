# Archived workbench checkpoint evidence

Historical checkpoints 13-37, retained without rewriting their evidence.
Do not append new checkpoints here. Start with the current page tracker and
its page-specific card. Historical status headings describe their own checkpoint,
not today's active work.

- Status: VERIFY for checkpoint 20 native Revenue preview and shared details; HOME remains BUILDING
- Checkpoint: 20, following approved/committed checkpoint 19
- Parent checkoffs: HOME and GLOBAL-SHELL remain BUILDING
- Pre-release reviewer: the user
- Product revision audited: `ef552587a6514e116840b19f27c9b79ea6db0708`
- Approved UI baseline: `cb9f0e4`, checkpoint 19 shared Review Alert editor
- Implementation tested: checkpoint 19 committed as `cb9f0e4`; checkpoint 20 working tree
- Checkpoint 14 user sign-off: October 3, 2026, including tag-color correction, native calendar
  picker and floating refresh-failure feedback
- Checkpoint 14 implementation revision: `3e4c5be`
- Checkpoint 15 user sign-off: October 3, 2026
- Checkpoint 15 implementation revision: `1f1472a`
- Checkpoint 16 user sign-off: October 3, 2026
- Checkpoint 16 implementation revision: `6d15a91`
- Checkpoint 17 user sign-off: October 3, 2026
- Checkpoint 17 implementation revision: `c1242b3`
- Checkpoint 18 user sign-off: October 3, 2026
- Checkpoint 18 implementation revision: `b53752c`
- Checkpoint 19 user sign-off: October 3, 2026
- Checkpoint 19 implementation revision: `cb9f0e4`
- Next action: user-check checkpoint 20's larger Home Revenue Alert window.
  Other Revenue preview shells and the customer revenue page remain legacy.
  The New note/edit form layout is not migrated.
  No push, merge or deployment is authorized.

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
  Refresh status on the right, then signs off the refined composition.
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
  was deferred to checkpoint 14 below.
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

## Checkpoint 14: calendar presentation

- Use the archive's opaque saved-note fills, muted ghost fills, square date
  controls and Today cell tint. Customer palette slots retain their month-local
  assignment and are shared by full rendering and surgical day replacement.
- Saved work rails prioritize HVA, then MSX task, then milestone, then plain.
  Tooltips and accessible names retain all linked statuses; engagement and
  general-note markers remain independent. The legend uses the same three rails.
- Ghosts keep their calendar marker, dashed boundary and striped customer rail.
  Their native open, recurring-series hide and single-meeting hide controls are
  siblings, not buttons inside anchors. Matched openers retain their original
  new-note URLs and native modified-click behavior. Unmatched openers retain the
  existing customer picker. Labels are constructed as literal DOM text.
- Customer highlighting spans notes and ghosts on hover or focus. Focus remains
  visible inside the day scroller and hide controls are also revealed by focus.
- One shared per-day scroll area replaces the independent 70px note/ghost limits.
  Full-month and day-only rendering retain all records and existing summary
  selectors. No data-loading endpoint, note-preview contract or sync payload changes.
- Date refresh is a named native button with busy/disabled state. Aura-owned
  dates cannot launch a duplicate refresh; their dots are a separate native
  details button in the day actions. State updates reuse existing dots rather
  than restarting animations. Reduced-motion preferences disable these existing
  animations and day-replacement fades.
- The accepted type scale, dock width, footer heights, counts/date/freshness
  composition and read-only refresh details are unchanged.
- Follow-up review retains the unsynced Today warning fill. Refresh status now
  also shows Today's Meetings, using the same existing today-status GET as the
  calendar. Fresh cache shows its recorded local timestamp; missing or stale
  coverage shows "Not Pulled" in warning ink. Accounts is last, after U2C.
  This is today's meeting
  coverage, not a timestamp claiming the entire calendar was refreshed.
  Successful menu reads also update the existing Today health renderer.
  Opening/Check now performs five read-only GETs; no sync is started. The new
  row is read-only text, not a misleading link or a new sync launcher.
  Initial reads wait for DOMContentLoaded, including the interactive/deferred
  script phase, so the later shared timestamp formatter is ready first.
- Refresh-failure review: the reported pull actually returned HTTP 500 because
  WorkIQ supplied `calendar_lookup_failed`; no today cache was written.
  The legacy day handler only logged that failure before clearing its spinner.
  Day pulls now show per-date native error notices in a dedicated floating stack
  above the bottom-right status bar, not the in-flow global flash stack.
  Notices preserve literal error details and shared dismissal/focus behavior. A confirmed
  success clears only that date's notice. A missing/invalid cache timestamp
  cannot be treated as success, including an apparently empty response.
- Successful day pulls notify the freshness controller immediately, including
  after month navigation. Background sync completion uses the same signal.
  If an older status read is pending, the controller queues a new read after it,
  rather than coalescing completion into the old snapshot. Page exit cancels
  these queued checks. Cache state still determines the actual warning/fresh
  display; a finished failed attempt is not reported as a successful pull.
- Calendar quick-create and unmatched ghosts now open the same native customer
  picker used by global New note, retaining the selected-date heading, General
  Note choice, search, caching, Retry, keyboard behavior and focus restoration.
  Unmatched selections also preserve `from_meeting`, so the existing create form
  can prefill and back-link that meeting. Ordinary day opens clear meeting
  context, and the global picker does not inherit it. The shared helper no
  longer has an unused Bootstrap-host branch.

### Calendar evidence

- Before the copy/order follow-up: all 77 scoped Home/calendar/freshness/summary/bucket
  Node checks and all 29 isolated Home/freshness Python checks pass.
- Copy/order/startup follow-up: 30 scoped freshness Node checks and 14 isolated
  Home Python checks pass. Live order is Milestones, ACR, Today's Meetings,
  U2C, Accounts; the warning reads "Today's Meetings: Not Pulled".
- Failure/completion follow-up: 77 scoped calendar, freshness, shared-sync and
  notification Node checks and 17 isolated Home/today-status Python checks pass.
  On live Home, intercepting the date POST before the server and replaying the
  user's recorded 500 produces the native error notice, clears the spinner and
  retains the truthful warning/Not Pulled state. No WorkIQ pull or cache write
  is made. Both native dismissal and success-path notice clearing reuse shared
  focus behavior; the latter restores the main landmark when focus was inside
  the notice. The unchanged desktop viewport retains zero bottom gap with and
  without the error notice. Interception and the temporary notice are removed.
  Successful pulls and pending-read races are verified with isolated tests,
  not fabricated successful live cache data. The external lookup failure itself
  is not repaired by this UI change.
- Notification-placement follow-up keeps errors out of Home's layout. At the
  unchanged 1806 x 1167 desktop viewport, adding the user's recorded failure
  leaves the breadcrumb at y=46, calendar at y=175.5 with height 926.953125,
  and status-bar bottom at y=1167. The notification ends at y=1135, 8px above
  the bar, and the global flash stack stays empty. Multiple date errors stack
  in a height-bounded scrollable surface rather than growing the page.
  Two recorded errors retain exactly the same calendar geometry, and clearing
  the focused notice transfers focus to the remaining notice's close control.
  Graphite light/dark both keep the notification within the desktop viewport
  without moving the breadcrumb or bottom bar; the original dark theme and
  user's October 6 failure notice are restored. All 31 scoped calendar/feedback
  Node checks and 14 isolated Home Python checks pass.
- Native picker/tag follow-up: 44 scoped Node cases and 77 isolated Python cases
  pass across calendar/picker/theme behavior and Home/navigation/note/prefill
  contracts. Live unmatched selection uses native results, focused search and
  a pinned 48px dialog top. Customer/General Note links retain date and meeting
  ID; an ordinary-day reopen clears the meeting ID and global New note links
  retain no calendar context. The note page and preview share the corrected
  yellow topic-border blend; all eight theme pairs retain the intended hue.
- 16 scoped calendar Node tests cover every rail-flag combination, customer
  assignment, literal labels, general notes, preserved URLs, independent hide
  actions, native controls, spinner/aura gating, stable dots, Today state,
  surgical replacement and four-/five-/six-week and leap-month rendering.
- Live September retains 7 notes / 11 meetings. Keyboard activation opens an
  actual saved-note preview and Close restores focus. Its same-customer note
  and ghost highlight together; moving focus away clears the highlight.
- Real August, February and October retain six, four and five rows respectively;
  February has all 28 dates and October all 31. Day content stays within its cell.
- All eight family/mode pairs retain zero footer-center error, bottom gap and
  document/calendar overflow at the unchanged 1806 x 1167 desktop viewport.
  Actual September note/ghost text contrast is at least 8.48:1.
- Meeting freshness follow-up: the live warning row matches the unsynced Today
  fill. Check now performs exactly five GETs. A forced meeting-status 503 shows
  unavailable without hiding the other four timestamps or changing Today;
  retry restores the real status and preserves focus. The expanded five-row
  popover fits all eight themes and the bottom bar remains 24px.
- Native keyboard activation opens both quick-create and the unmatched picker.
  Both close without navigation or edits. Series and single-meeting hide
  confirmations are cancelled; all 8 October ghosts remain. No refresh, hide,
  note creation or other live data write is performed.
- Calendar colors, typography, borders, padding and control heights survive a
  temporary Bootstrap stylesheet disable. Remaining legacy global/modal layout
  dependencies are outside this slice; full Bootstrap removal is not claimed.
- The original October Calendar view, Graphite/dark theme and existing Hanger
  draft are preserved. The separate unsaved New Note tab is untouched.

## Remaining Home parity

This is not full HOME sign-off or full Bootstrap removal. Checkpoint 14 calendar
presentation and its follow-up fixes are user-approved. Checkpoint 15 calendar
read states and checkpoint 16 dashboard settings are user-approved. The Action
Item preview is approved and committed in checkpoint 17 below; the shared bucket
popover is user-approved in checkpoint 18. The separate action-item calendar,
embedded engagement/project bodies and revenue detail/review bodies remain separate
migration surfaces. Their current functionality is preserved, not rewritten here.

## Checkpoint 15: calendar read states

- Replace only the saved-note/meeting calendar's Bootstrap loading/error rows
  with a native, full-height, seven-column state cell. Keep the approved toolbar,
  weekday headers, legend, dock, counts/date/status bar and real calendar data.
- Loading announces its state and marks the body busy. Failures show an alert
  and a native Retry button; retry uses the same read-only month GET. Focus moves
  to the calendar tab before the retry control is removed. No sync is launched.
- Intentional usability correction: the title identifies the requested month
  immediately, including while loading or unavailable, rather than keeping the
  previous month's title until the response arrives.
- Reject HTTP/JSON/network failures and invalid month/record envelopes instead
  of rendering an error payload as an empty successful calendar. Confirmed
  empty months still render normally and show zero counts.
- Abort superseded reads and ignore their late success/error responses. Page
  exit disposes pending reads; a cached-history return resumes a read only if
  the page was left loading. Successful painting retains Today health, aura
  indicators and in-flight day-refresh spinner restoration.
- The summary understands native read-state markers without new requests.
  Other activity tabs retain their existing loading/error detection.
- This is not the WorkIQ day-lookup repair or the detached-data-job plan.
  Both open New Note tabs are kept untouched; live checks use a separate Home tab.

### Checkpoint 15 evidence and review

- 102 scoped Node checks and 14 isolated Home Python checks pass. Coverage includes
  HTTP/network/JSON/envelope failures, empty/leap months, Retry focus and URL,
  stale success/error replies before and after the newer read completes, page-exit
  cancellation, cached-history resume, native summary states and existing frame/
  freshness/date-refresh behavior. Changed files have no editor diagnostics.
- Live real September reads retain 7 notes / 11 meetings and zero bottom gap.
  Holding an October GET shows native loading, busy state and the requested
  title. Replaying a 503 shows unavailable rather than zero counts. Keyboard
  Retry rereads real data, restores focus to the calendar tab and returns
  October's actual 0 notes / 8 meetings. Returning to September restores its
  actual records. A state cell spans the 1440px table, allowing its 1px border.
- Loading and error are checked in all eight theme pairs at the unchanged
  1806 x 1167 desktop viewport. Every case retains zero footer gap; actual state
  text contrast is at least 7.31:1. Theme attributes are restored to Graphite/dark.
- Inactive shared Home tabs do not advance actionability frames; live interaction
  validation therefore uses a newly opened real dev Home tab, not a demo server
  or cloned database. The active and protected New Note tabs are not navigated,
  reloaded or edited. No WorkIQ pull or record mutation is initiated.
- The new Home tab is left on September with an intentionally replayed 503 so
  the user can inspect the error and try Retry. Its interceptor is removed, so
  Retry performs the normal real GET. There are no leftover probe globals or
  listeners. Existing sharing-hub CORS/400 console errors were observed outside
  this read flow; no sharing code is changed or console-clean claim made.
- Review: the native loading/error appearance, stable frame and month title,
  and Retry returning to the real month without starting a meeting sync.
  Checkpoint 15 is user-approved October 3, 2026, committed as `1f1472a`.

## Checkpoint 16: Action Items settings

- Replaced Home's Bootstrap settings host with the shared native dialog lifecycle:
  Escape, opt-in backdrop dismissal, close button, Done and opener focus restoration.
- Shared Dashboard settings partial now uses theme-token controls and divider-only
  rows in both Home and Preferences. Other Preferences sections are not migrated.
- Retained all three preference fields, initial checked values, immediate-save POST
  endpoint and manual Copilot refresh endpoint. Home items still update on reload.
- Save feedback now requires confirmed server values, disables only the saving
  control, and restores its last confirmed value on failure. Refresh keeps its
  button geometry, reports valid zero/singular/plural counts and exposes persistent
  errors. Neither action claims success for failed or malformed responses.
- Validation: 72 scoped JS tests passed; 17 isolated Home tests and 27 isolated
  Copilot tests passed. New persistence tests exercise both boolean values for
  every toggle. Editor diagnostics and whitespace checks are clean.
- Live dev: native dialog and Preferences shared partial rendered with actual
  checked preferences. Verified Escape/Done/backdrop focus behavior and all eight
  theme geometries at the unchanged desktop viewport. Replayed HTTP 503 save
  failure and a rejected refresh only, verified rollback/error/retry availability,
  then removed interceptors and reloaded. No live preference writes, WorkIQ syncs,
  customer changes or draft changes occurred. Home is left open to clean settings.
- User review: approved October 3, 2026. Committed as `6d15a91`.
- Estimated full-redesign completion at sign-off: about 16% by effort.

## Checkpoint 17: shared Action Item preview and editor

- Replaced the shared Bootstrap host/body/editor with native workbench dialogs,
  divider-only metadata, theme-token form controls, associated labels and native
  close/backdrop/Escape/focus behavior.
- Preserved `viewActionItem(id, options)` across Home, Action Items, Projects and
  Engagements. Existing rich descriptions, title/contact/priority, due/overdue
  metadata, completed state, Source, Linked Note and conditional Engagement link
  remain available. Source URLs retain new-tab behavior and only HTTP(S) links
  become clickable; unsupported schemes report an unavailable link.
- Kept GET, PUT, completion toggle, Copilot Save with optional due date, Dismiss
  and Not Useful contracts. Successful writes still refresh the calling page on
  close. Saved/completed Copilot items immediately show their persisted project
  state instead of leaving stale Copilot-only actions available.
- Plain-text editing still strips rich description markup, as before. Engagement
  callers with `onEdit` still hand off to their existing Quill editor after closing
  the preview. New/edit Note forms are untouched.
- Read failures now show Retry. Reads are abortable and identity-checked; late
  replies cannot overwrite another selection or reopen a dismissed preview.
  Cached-history returns resume only an interrupted read.
- Writes disable controls until confirmed. Errors remain visible, restore the
  completed checkbox to the confirmed state and preserve failed edit drafts.
  Dirty edits require Keep editing/Discard before cancel, close, selection change
  or same-tab navigation; pending saves block those transitions.
- Project previews in Initiative Tracker still hide and restore the legacy parent
  dialog, including rapid close during the parent's opening/hiding transition.
  Both native child dialogs are relocated/tagged for cleanup; manager cleanup no
  longer passes native dialogs to Bootstrap.
- Scoped validation: 65 JS tests and 97 isolated Python tests passed. Tests cover
  real API contracts, all shared template consumers, old/new reply ordering,
  retries, successful and failed writes, Copilot transitions, dirty/busy guards,
  Quill handoff and native/legacy parent restoration. Diagnostics/whitespace clean.
- Live dev: real task 9 opens from Home, Project 3 and Action Items. Verified
  native editor, dirty Escape/Keep editing/Discard, opener restoration, failed
  read/Retry recovery and failed PUT draft retention. Failure replay interceptors
  were removed. Editor geometry/theme controls checked in all eight themes at the
  unchanged desktop viewport. No live writes, completion toggles, dismissals or
  Copilot pulls were sent. Existing New Note drafts remain untouched.
- Live data limitations: no dated-task tab or Project rows in Initiative Tracker,
  and the inspected Engagement has no task rows. Those unavailable branches use
  scoped isolated regression tests, not invented live records or sample previews.
  The task calendar migration was not started.
- Review status: user-approved October 3, 2026, committed as `c1242b3`.
- Estimated full-redesign completion at sign-off: about 17% by effort.

## Checkpoint 18: shared Revenue Buckets filter

- Replaced the Bootstrap popover with an app-owned native popover, compact
  theme-token controls, literal bucket labels, searchable rows, Select all,
  mixed selection, an explicit no-results state and a no-selection hint.
- Preserved the public filter API, selection/version storage keys, sorted bucket
  discovery, all document-wide bucket rows, counts and existing callbacks.
  Empty selection still means show every bucket, not hide every row.
  Locally saved choices are pruned to page buckets; server compensated-bucket
  fallback retains its existing unpruned behavior. A missing taxonomy marker
  still means legacy version zero.
- Version changes invalidate stale local choices. HTTP/network/JSON/schema and
  storage failures now log context, retain visible feedback and offer Retry.
  Failed persistence still permits filtering on the current page. Late taxonomy
  or fallback replies cannot replace a newer choice; superseded fallback errors
  are logged without leaving an irrelevant warning.
- Multiple hosts share selections and callbacks without duplicate controls or
  IDs. Seller's summary and Full View preview synchronize their filter controls
  and correctly count only visible preview rows.
- Search receives focus on opening. Escape closes only the filter, restores its
  invoker and cannot dismiss a parent Seller preview or trigger page navigation.
  This also works after a recovered Retry button becomes hidden. Outside click
  closes without stealing the clicked target's focus. Panels retain their opening
  side while searching; smaller results cannot flip placement. Above-button
  panels keep their bottom edge six pixels above the button's top edge, while
  below-button panels keep their top edge six pixels below the button.
  Reopening or resizing recalculates placement; growing feedback clamps
  coordinates only when required to remain inside the viewport.
  Panels close on page exit.
- Scoped validation: 98 JS tests and 15 isolated Python tests passed. Coverage
  includes Home summary/native dialogs/freshness regressions, real preference/
  taxonomy APIs, all/none semantics, persistence, literal labels, empty/search
  states, concurrent hydration, stale responses, failure/retry and desktop-edge
  positioning. Diagnostics and whitespace checks are clean.
- Live dev: verified all five consumers using existing records: Home, Revenue
  Analyzer, customer 456 revenue, Austin Card's revenue alerts and Seller 14's
  summary/Full View preview. Reopening the preview leaves exactly one invoker.
  Selecting Sentinel temporarily gives matching `3/7` labels on both Seller
  hosts and a preview count of seven matching its seven visible rows.
- Live failure replay: taxonomy HTTP 503 and local-storage quota failures show
  persistent feedback and recover via Retry. Read interception and temporary
  storage overrides were removed. Exact original selection/version values
  (`["Databases","Fabric"]`, version `3`) and Graphite/dark were restored.
  No server preference saves, reviews, syncs or customer writes were sent;
  both protected New Note draft tabs remain untouched.
- All eight theme pairs retain a bounded popover at the unchanged 1806 x 1167
  desktop viewport; Graphite dark/light were visually inspected. Temporarily
  disabling the Bootstrap framework stylesheet leaves the filter's width
  (280px), height (333.5px), typography, background and color scheme unchanged.
  This proves the filter's independence, not the surrounding legacy pages'.
  Opening/closing the filter leaves Home's workspace at y=78, height=1065 and
  the 24px status bar at y=1143, with zero bottom gap.
- Search-placement follow-up: reproduced the user's above-to-below jump live.
  The initial fixed-top correction was superseded by the user's explicit
  bottom-anchor preference. Searching `d`, `data`, no results and clearing now
  keeps the popover bottom at y=863.984375, exactly six pixels above the button
  top at y=869.984375. The top moves as content shrinks while the popup stays
  attached above its invoker, never flipping below it. Every tested state
  remains inside the unchanged desktop viewport. No preferences or live
  records were changed.
- Review status: user-approved October 3, 2026, including bottom anchoring and
  overlapping selections persisting across pages. Page-specific bucket discovery
  and Home's existing top-ten-before-filter behavior were explained and accepted.
  Committed as `b53752c`. Whole HOME, remaining
  revenue previews and New Note/edit form layouts are not signed off here.
- Approved full-redesign estimate remains about 17% by effort at checkpoint
  18 sign-off; this small slice does not change the rounded estimate.

## Checkpoint 19: shared Review Alert editor

- Status: DONE, technically checked October 4 UTC, user-approved October 3 local.
  Baseline: `b53752c`. This checkpoint migrates the shared editor first, not the
  preview shells or detailed alert bodies. The following audit informed scope.
- Live Home preview inspected with an existing matched-customer alert. Preserve
  customer/bucket title, category, average/latest revenue, monthly trend, priority,
  recommended action/rationale, risk/opportunity, analyzed date/month count,
  previous-review hint, current review badge, product/month totals and links to
  customer revenue and product pages. Detailed body styling remains a later slice.
- Preview GET: `/api/revenue/analysis/<id>/detail` currently returns shared HTML
  with no identity wrapper. Unmatched-customer alerts return a successful
  explanatory fragment, not a failure; preserve this distinction. Missing
  analyses return 404. Current Home loader has no Retry, request cancellation or
  stale-response protection.
- Review editor is shared by Home, Revenue Analyzer, customer revenue, seller
  revenue alerts and Seller detail. Preserve five statuses (New, To be reviewed,
  Reviewed, Actioned, Dismissed), review notes, newest-first history and local-time
  history timestamps. History GET: `/api/revenue/analysis/<id>/review-history`.
  PATCH `/api/revenue/analysis/<id>/review` creates an immutable history entry,
  strips notes, clears previous-review hints and returns confirmed status/notes/
  timestamp/history. Keep read operations separate from writes.
- Both legacy Home preview and nested Review Alert editor were opened live, then
  closed without entering data or saving. Existing alert has no review history;
  history-positive coverage must use isolated tests if no suitable live record
  is available. Protected New Note tabs were not touched.
- Important coupling: a Bootstrap Review Alert child cannot be displayed above a
  native top-layer preview parent without migration or a deliberate handoff.
  Migrate the shared editor first or in the same slice; do not ship the initially
  considered native preview-only change with an inaccessible Review button.
- Existing refresh behavior: preview hosts mark dirty when Review is clicked,
  not only after a confirmed save. Seller also has Full View parent hide/restore
  behavior and reload-on-close. Preserve established parent workflows while
  determining a confirmed-save event contract across every consumer.
- Implementation checks required: native close/Escape/focus/parent restoration,
  independent history loading/retry, identity/stale-response checks, explicit
  save failures retaining form state, confirmed badge/button/row updates,
  dirty/busy guards, repeated opens, unmatched/missing records and live theme
  geometry. Existing tests: `TestReviewAPI` in `tests/test_revenue.py`;
  native record/dialog tests provide reusable lifecycle coverage.
- User approved the editor, draft protection and Seller parent restoration on
  October 3, 2026. The approved completion estimate is about 18% by effort.

### Implementation and verification

- Replaced the Bootstrap Review Alert modal with a native shared editor and
  discard confirmation. Preserved five statuses, notes, status/action/hint
  macros, API paths and public `openReviewModal`/`saveReview` entry points.
  Workbench styling uses the existing theme tokens and shared dialog lifecycle.
- History reads have loading, explicit empty/failure states, Retry, abort and
  generation protection. Retry never resets status or notes. History notes
  remain literal text; timestamps use the shared local-time converter without
  doubling an existing timezone offset.
- Dirty close/switch offers Keep editing or Discard edits; pending saves block
  closing, replacement and duplicate writes. A page-leave warning protects
  dirty/busy forms. Existing native Escape and opener-focus behavior is reused.
- PATCH success requires HTTP success plus confirmed status and canonical notes.
  Unconfirmed saves retain edits and report persistent failure. A post-confirmed
  UI error is distinguished from a failed/unconfirmed write and does not tell
  the user to submit the same review again.
- Confirmed saves update matching badges, buttons, row opacity and previous
  review hints across hosts, then emit `sb:revenue-review-saved`. Merely opening
  or cancelling review no longer marks preview hosts dirty or reloads a page.
  Document fallback events are guarded against non-Element targets.
- Native editor/discard dialogs temporarily stay within an invoking legacy
  modal's focus-trap boundary and return to their original DOM hosts on close.
  Seller drilldowns restore Revenue Full View before refreshing; accumulated
  confirmed changes survive repeated drilldowns and direct Full View reviews.
- Automated validation: 53 scoped JS tests covering review, native dialog,
  local timestamps and Revenue Buckets; 40 isolated pytest tests covering five
  host renders, real detail-fragment macros, review APIs and Home contracts.
  All pass. The VS Code runner omitted class-based coverage, so the authoritative
  pytest counts are from the scoped plain terminal run. Existing SQLAlchemy
  legacy-query warnings remain.
- Live existing-data validation: Home alert 1069; Revenue Analyzer; customer
  456 revenue; Austin Card seller alerts; Seller 14 Full View -> alert detail ->
  native review -> discard -> detail close -> restored Full View. Typed drafts
  were discarded without saving. Notes focus/retention and clean/nested closing
  were checked; cancellation remained on the same page.
- Live failure replay intercepted one history GET (503) and one PATCH (500).
  History Retry recovered against the real API while retaining the draft;
  save failure retained edits and showed persistent feedback. Every interceptor
  was removed; no live review writes were sent. Eight inspected live alerts had
  no history; non-empty timelines and confirmed-success writes are covered by
  isolated fixtures, not invented live records.
- Desktop checks at the unchanged 1806 x 1167 viewport: all eight theme pairs
  remained bounded with no horizontal body overflow; notes contrast ranged
  from 13.41:1 to 15.28:1. Graphite dark/light were visually inspected. Temporary
  theme attributes were restored without changing preferences or storage.
- Bootstrap stylesheet removal was used to check native control geometry,
  revealing inherited heading/control resets; the review component now defines
  those explicitly. Final editor geometry was identical with and without
  Bootstrap CSS (800 x 507.70 pixels). Graphite/dark and the exact saved
  Databases/Fabric bucket selection plus taxonomy version were restored.
  Protected New Note tabs remain untouched.
- Diagnostics and whitespace checks are clean. Approved checkpoint 19 was
  committed as `cb9f0e4`; no push, merge or deployment has been performed.

### User checkoff

1. Home Revenue Alert -> Review: status choices, notes, history and close control
   should use the workbench style; the existing alert-detail body is unchanged.
2. Change a status or notes, then Escape/Cancel: Keep editing retains the draft;
   Discard closes just the editor and returns focus to its Review button.
3. Revenue Analyzer, customer revenue and seller revenue alerts use the same
   editor. Closing without saving should not reload the page.
4. Seller -> Revenue Full View -> alert -> Review: closing the editor returns to
   the alert; closing the alert restores Full View.
5. If deliberately saving a real review, verify the saved status/notes and its
   new history entry on reopen. The badge updates only after confirmation.

## Checkpoint 20: native Home Revenue Alert preview and shared details

- Status: DONE, technically checked and user-approved October 4, including the
  final header ordering and New status color.
  Baseline: `cb9f0e4`. Approved overall completion is about 19% by effort.
- Scope: Home's larger Revenue Alert preview is native. The shared alert body
  is migrated wherever the detail API fragment is used: Home, Revenue Analyzer,
  seller revenue alerts and Seller Revenue Full View drilldown. Other hosts'
  outer preview frames and the customer revenue page are not migrated here.
- Audited and retained: customer/bucket title, category labels and fallbacks,
  average/latest revenue, monthly trend and its +/-3% thresholds, priority and
  40/60/80 severity thresholds, recommended action/rationale, risk-before-
  opportunity dollar impact, analysis date/month count, review badge/button/
  previous hint, seven latest month columns, all-history totals, product links
  and the conditional Full Revenue Page link. Zero values remain dashes;
  negative amounts remain visible; monthly change color thresholds stay strict
  +/-10%, with no comparison when the previous value is non-positive.
- Replaced stacked colored cards with divider-separated summary, review
  metadata and a semantic product table. Table headers have explicit scope,
  an accessible caption and a keyboard-focusable horizontal-scroll region.
  No new cards, Bootstrap utility classes or mobile layout rules were added.
- October 4 layout refinement: grouped the review badge, analysis date/month
  count and pencil beside the category in the top-right header; removed the
  separate metadata row. All 35 scoped revenue UI tests passed, including
  header containment/single-instance assertions for every category. Live Home
  confirmed right-edge alignment, no group overflow, and Review close restoring
  focus to the header pencil without closing the larger preview.
- Follow-up refinement orders the header metadata as analysis date/month count,
  review status, category and pencil. New uses the shared theme's muted amber
  status color, consistently across revenue review badges; status labels remain
  explicit so color is not the only cue.
- Home uses the existing `SBRecordDialog` loader rather than duplicating fetch,
  Retry, cancellation or focus logic. Detail fragments now identify the exact
  analysis. HTTP failures, non-HTML replies and identity mismatches show Retry
  rather than old/wrong data. Matched alerts with no products keep their
  summary; unmatched alerts are identified successful empty states. Missing
  analyses still return 404.
- The approved native Review Alert child opens above the native Home parent.
  Its pending/dirty guards are preserved. Parent transitions are blocked
  while the child is open, and closing the child restores the parent's
  ordinary status. Home reloads on parent close only after a confirmed review;
  cancelling review does not reload. Other legacy parent workflows remain.
- Automated validation: 64 scoped JS tests across Revenue preview/review,
  native record loader/dialog, local timestamps and Revenue Buckets; 64
  isolated pytest tests across review/detail rendering, threshold boundaries,
  real seven-month product queries/totals, unmatched/missing branches, Home
  parity and review APIs. All pass; only existing SQLAlchemy warnings remain.
- Live validation used existing alerts 1069 and 332. Alert 1069 retains the
  exact $15,557 average, $352 latest, -23.9%/mo trend, priority 95, $3,711 risk
  and 15 table rows observed before migration. Full Revenue Page navigated
  to existing customer 456's revenue page. No customer/review writes were sent.
- Live history/editor close and typed-draft Keep editing/Discard were checked
  within the native Home parent. Closing the editor restores parent focus;
  parent close was blocked during the child and its status recovered afterward.
  Revenue Analyzer and seller alert legacy previews showed the same new body
  and still opened/closed Review; Seller Full View drilldown returned to its
  parent after discarding edits.
- Live failure replay: 503, non-HTML 200 and wrong-identity HTML all showed an
  empty body plus explicit Retry, then recovered against the actual detail
  API. A delayed real 1069 read deliberately ignored cancellation while 332
  opened; after the older response arrived, title and body still identified
  332. Every interceptor/fetch hook was removed afterward.
- At the user's unchanged current 1602 x 1167 desktop viewport, all eight
  theme pairs stayed bounded with no horizontal body overflow. Minimum sampled
  detail-text contrast ranged from 7.31:1 to 8.94:1. Graphite dark and light
  were visually inspected. Removing Bootstrap CSS left dialog, summary and
  product-table geometry identical. Theme attributes were restored without
  saving preferences or changing bucket storage.
- Final refinement validation: all 35 scoped revenue UI tests pass. Live
  header order and pencil focus restoration pass; New badge contrast is
  11.02:1 in Graphite dark and 7.44:1 in Graphite light. Original theme restored.
- Diagnostics and whitespace checks are clean. Protected New Note draft tabs
  were not touched. Checkpoint 20 is committed as `401846d`; no push/merge/deploy.

### User checkoff for checkpoint 20

1. On Home, click a Revenue Alert row. This time the larger window itself
   should be restyled, including summary, review metadata and product table.
   Check readability and scroll through the products.
2. Click its small pencil. The previously approved Review Alert editor should
   still work; Escape/Discard returns to the larger window without closing it.
3. Optional: the Full Revenue Page and product links should take you to the
   existing destinations. No real review save or network-failure test is needed.

## Checkpoint 21: shared native Revenue Alert preview frames

- Status: DONE, technically checked and user-approved October 4.
  Baseline: `401846d`. Approved overall completion is about 20% by effort.
- Scope: replace the remaining alert-detail Bootstrap frames in Revenue Analyzer,
  seller revenue alerts and Seller Full View drilldown. Extract the approved Home
  frame into one include, preserving its markup, identities, Review include and
  deferred helper. All four hosts now share the same frame/controller.
  Revenue lists/summary cards, Seller Full View parent and customer revenue full
  page remain legacy; New Note drafts/forms are not in this slice.
- Retained contracts: existing row launchers and link/button guards, customer/
  bucket title, detail API/identity, all approved shared-body fields and links,
  native Review/discard protection and confirmed-only refresh. No API, database
  or review-write changes. Home retains `homeAlertDetailModal`/`homeAlertBody`;
  the other hosts retain `alertDetailModal`/`alertDetailBody`.
- All previews now use the same abort/version-protected, HTML/identity-checked
  loader, visible loading/error/Retry states and child-aware transition guards.
  Preview dimensions remain stable during loading, failures and recovery.
- Seller Full View hides before the native drilldown opens and returns only
  when that drilldown closes, not when its Review/discard child closes.
  Selections made during the parent's hide transition coalesce to the newest
  request. Confirmed changes accumulate across drilldowns and refresh the
  Seller page on final Full View close. Standalone seller alerts refresh on
  their own close; opening/cancelling Review never triggers a refresh.
- Automated validation: 46 scoped JS tests across preview/review and shared
  native record/dialog helpers, plus 64 isolated pytest tests across all four
  host frames, Review integration/APIs, detail parity and Home. All pass.
  The former inline Seller-chain test is replaced by shared-controller tests
  covering direct-parent saves, repeated drilldowns, deferred refresh and
  queued selections. Only existing SQLAlchemy warnings remain.
- Live host matrix: Home, Revenue Analyzer, seller alerts and seller compact
  preview each show existing alert 1069 in one native dialog, exact identity,
  all 15 product/total rows and no horizontal overflow.
- Live Seller Full View: opening 1069 hides the parent; a temporary Review draft
  can be kept/discarded without closing the detail; Escape from the detail
  restores Full View and its 12 existing rows. The bucket picker still closes
  first on Escape without closing Full View, and restores as one control.
  Stored Databases/Fabric selection remains unchanged.
- Live failure checks in Analyzer: 503, JSON MIME at 200 and wrong-identity HTML
  each clear the old body and show Retry; all recover against the real API.
  Loading, error and recovered frames measure exactly 1071px high at the
  unchanged 1602 x 1167 desktop viewport. A delayed real 1069 response ignoring
  abort cannot replace newly selected 332's title/body; all fetch hooks removed.
- All eight dark/light theme pairs remain within the viewport with no body
  horizontal overflow. Graphite dark is visually inspected and restored,
  without saving theme preferences. No live review writes or protected draft
  interactions; diagnostics/whitespace checks are clean.
- Checkpoint 21 is committed as `a4ec9a8`. No push, merge or deployment.

### User checkoff for checkpoint 21

1. Revenue Analyzer: click an alert row away from its links/pencil. Its large
   window should now match Home's approved workbench preview. Open the pencil,
   then Escape back to the large window.
2. Seller page: Revenue -> Full View -> click an alert row. Close its large
   preview and confirm Full View returns instead of dropping you to the page.
3. Optional: the seller revenue alerts full page uses that same native preview.
   No real review save or manufactured network failure is needed.

## Checkpoint 22: shared Revenue alert lists and native Seller Full View

- Status: DONE, technically checked and user-approved October 4.
  Baseline: `a4ec9a8`. Approved overall completion is about 22% by effort.
- Scope: migrate the shared alert table/optional three-value summary in Analyzer,
  seller alerts and Seller Full View; replace the Seller Full View Bootstrap
  frame/launcher with the shared native dialog lifecycle. Revenue page headers,
  category cards, toolbars, seller compact summary and customer revenue remain
  legacy. No New Note form/draft changes.
- Parity inventory: default descending priority; reversible number, text,
  currency and status sorting; optional Seller column; customer revenue/Hub
  links and TPID export metadata; category labels/fallbacks; action, average,
  risk-before-opportunity amount, full rationale, review badge/previous hint/
  pencil; bucket identities, summary fields and filtered visible count.
  All data/API routes are unchanged. Seller links use the native blue person
  tag convention instead of saturated legacy badge fills.
- Native sorting buttons expose direction through `aria-sort`; every table
  has a caption/scoped headers and a keyboard-focusable horizontal scroll
  region. Both row clicks and a labeled native Open button launch previews,
  without intercepting customer links or Review. Customer/bucket names travel
  as escaped data attributes rather than inline JavaScript string literals.
- Full View stays open beneath native alert/Review/discard children, preserving
  sorting, filter and scroll state. Closing a child returns to its opener;
  closing Full View restores its original launcher. Underlying Full View
  closing is guarded while children are open. Confirmed review changes still
  accumulate until final Full View close; standalone previews retain their
  own confirmed-only refresh. No Bootstrap hide/return bridge remains.
- Processed states stay subdued using muted ink rather than whole-row
  transparency, preserving readable amounts and status colors. Native table
  opacity remains 1 even after the legacy shared review updater sets 0.6.
  Other legacy consumers retain their existing transparency behavior.
- Native sorting headers provide `data-export-label`; the shared export helper
  retains those labels when removing control buttons and excludes native
  dialog/popover tables as well as legacy ones. Existing ordinary/boolean cell
  behavior remains. CSV, clipboard and email destinations/buttons are retained.
- Automated validation: 77 scoped JS tests across alert sorting/guarded opening,
  report export helpers, native Full View/review lifecycle, record/dialog and
  bucket filter; 79 isolated pytest tests across lists/identities/statuses,
  all preview hosts, empty states, dollar impact, Home, review APIs and the
  six existing report-export host cases. All pass; existing SQLAlchemy warnings only.
- Live existing data: Austin Card's 12 alert rows, six visible Databases/Fabric
  rows and matching count remain. Keyboard Enter sorts Avg ACR ascending across
  all rows. 1069's detail still shows all 15 product/total rows. A temporary
  Review draft is retained by Keep editing, then discarded without any write;
  attempted underlying Full View closing is blocked. Closing detail restores
  focus to 1069's Open button and keeps sorting; final Full View close restores
  focus to the original launcher.
- Buckets Escape closes the picker first, leaving native Full View open.
  Stored Databases/Fabric selection is unchanged. Full Page navigates to the
  existing seller alerts URL; Analyzer/seller list open buttons and Home's
  original launcher still load the exact 1069 detail.
- Live CSV generation preserves all eleven column labels and exports exactly
  the 14 currently visible Analyzer rows; disk download was suppressed only for
  validation and the original browser functions restored afterward.
- All eight theme pairs stay bounded during desktop validation, with no outer
  body horizontal overflow. The final observed desktop viewport is 1770 x 1223,
  and Full View measures 1320 x 1127, bounded without body overflow.
  No shared-page viewport was resized by the assistant. Processed Actioned status
  text contrast is 6.13:1-6.37:1; temporary theme/status/style changes restored.
  Graphite dark Full View visually inspected. Protected draft tabs untouched;
  no live review/customer writes, no push/merge/deploy.
- Checkpoint 22 is approved and committed as `25a14d4`, including the preview
  controller's updated native parent integration alongside this list.

### User checkoff for checkpoint 22

1. Seller -> Revenue -> Full View: the larger list itself now uses the native
   workbench. Check summary/list readability and click a column heading twice
   to reverse its sort.
2. Open an alert using its row or expand button, then its pencil. Escape out
   of Review and the alert preview; Full View should stay open with the same
   sort/filter. Close Full View to return to the seller page.
3. Optional: Analyzer and the seller's revenue full page use the same new
   table. Their surrounding headers/cards are intentionally not migrated yet.
   No real review save or network-failure exercise is needed.

## Checkpoint 23: Revenue Analyzer and seller alert pages

- Status: VERIFY, technical validation complete; user sign-off pending.
  Product revision audited: `25a14d4`. Implementation is not committed yet.
  Approved full-redesign completion remains about 22% by effort.
- Pages: REV-DASH (`/reports/revenue`, `/revenue` redirect) and REV-SELL
  (`/revenue/seller/<seller_name>`, including its existing embed variant).
  This migrates their headings, summaries and controls, not their complete outer
  page frame. The legacy background/footer and missing workspace outline remain
  unfinished shell work, as raised in the October 4 review. Customer revenue,
  the compact Seller Hub summary and other reports' export UI also remain.
- Replaced colored category cards and the enclosing list card with a compact
  command header, divider-only category definition list and native list toolbar.
  Both pages use the full-width breadcrumb context bar immediately below the
  navbar. Seller alerts retain their person title and command group.
  The approved shared alert list, filters, review/preview dialogs and APIs remain.

### Page-specific parity inventory

| Surface | Preserved contract | Verification |
| --- | --- | --- |
| Analyzer title | Revenue Analyzer and existing revenue-trend subtitle | Isolated render and live page |
| Export commands | CSV, formatted clipboard with plain-text fallback, Outlook .eml with CSV attachment | Isolated handlers/default-host tests; live generated output with downloads and clipboard writes intercepted locally |
| Export identity | `revenue-analyzer` filenames and explicit Revenue Analyzer title, not the new list heading | Live CSV, HTML/plain clipboard and .eml inspection |
| Data commands | Import Data, Products and Configure destinations; Re-analyze remains POST to the existing endpoint | Isolated rendering; unchanged route wiring, no live job started |
| Categories | All four counts, monthly risk/opportunity and Volatile review hint; missing categories show zero | Isolated populated/empty branches; unchanged live values |
| List metadata | Total analysis count, last import date and conditional month count | Isolated render and existing live import |
| Buckets | Existing shared picker, saved choices, taxonomy version and visible-row count | Existing filter regressions; live Analyzer/seller navigation |
| Sellers | Conditional count/list, original seller destinations and hidden menu/column in seller mode | Isolated seller-mode scoping; live mouse/keyboard menu |
| Job notices | Import/analysis incomplete and failed branches, optional details and import start timestamp | All four isolated branches; literal escaped details |
| Recovery | Import link or POST Re-run analysis; persistent warnings are not dismissible | Isolated native notice/form assertions |
| Empty Analyzer | No alerts yet, import guidance and Import Data action | Isolated no-data render |
| Seller header | Name, canonical Home/Seller/Revenue trail, optional Seller Hub, Products and CSV-for-Teams destinations; redundant subtitle removed in checkpoint 24 | Isolated matched/unmatched seller branches and live seller page |
| Embed | Existing embed condition omits page header/commands but retains summary/list/preview | Isolated embed render |
| Shared alerts | Sort controls, customer/seller links, explicit Open/Review, summaries and preview identity | Shared regressions; existing alert opening/Escape/focus restoration |

### Implementation and evidence

- Reused the existing navigation controller, now discovering document-wide menu
  triggers. Page menus explicitly anchor to their own command; existing header
  menus retain bar-bottom placement. Arrow keys, wrapping, Home/End, Escape,
  outside dismissal and overlay closing remain centralized.
  Page scrolling dismisses command menus without jumping back to the invoker;
  scrolling inside a menu and the existing sticky-header menus are unaffected.
- Added an optional native presentation to the existing export partial without
  duplicating its extraction/export logic or changing unmigrated report defaults.
  Native notifications use the shared notice/dismiss behavior and literal text.
  Warning/error notifications remain until dismissed. Success notices retain the
  three-second timeout, but do not remove a focused dismiss control.
- Native page CSS defines its own main-content geometry instead of depending on
  Bootstrap's container/spacing reset. Live Analyzer root/header/category/table
  dimensions are identical with Bootstrap CSS enabled and temporarily disabled.
  No mobile rules or shared viewport resizing were introduced.
- Automated: 96 scoped JS tests and 136 isolated Python tests passed.
  Coverage includes native page chrome, every warning branch, category units,
  zero/empty state, matched/unmatched seller, embed, seller-mode server scoping,
  legacy report exports, page/header menu behavior and existing revenue/Home
  preview/review/filter contracts. Only existing SQLAlchemy legacy-query warnings.
- Live Analyzer retains 43 rows, 14 visible rows, category counts 3/8/20/11,
  existing risk/opportunity values and September 28 import with 27 months.
  Existing seller alerts retain 12 total rows and six visible saved-bucket rows.
  CSV and formatted/plain clipboard outputs retain eleven column labels and
  exactly fourteen visible rows; .eml retains the correct subject and attachment.
  Validation did not write the user's clipboard or create download files.
- Live Sellers menu opens directly below its command, keyboard focuses a
  menuitem, End moves to the last entry, and Escape restores command focus.
  A real menu link navigates to the existing seller alert page. Existing alert
  detail retains fifteen product/total rows and Escape restores its row Open button.
  The `/revenue` alias was verified redirecting to the native Analyzer.
- Replayed only clipboard API failure to verify persistent native error feedback
  and dismiss-to-main focus. Original clipboard/download hooks were restored.
  No import, analysis, review, preference or customer write was initiated.
- Analyzer's eight theme pairs remain bounded at the existing 1768 x 1167 desktop
  viewport. Header/category small-text contrast is at least 5.47:1. Theme
  attributes were restored to Graphite/dark without changing saved preferences.
  Saved Databases/Fabric selection and taxonomy version 3 remain unchanged.
  Protected New Note tabs are untouched.
- Seller page command geometry is also bounded and unchanged in all eight theme
  pairs. Editor diagnostics and whitespace checks are clean.

### User checkoff for checkpoint 23

1. Revenue Analyzer: inspect the compact command row and four divider-separated
   summaries. The old colored category cards/list card should be gone.
2. Sellers -> a seller: inspect the matching native breadcrumb/header/commands.
   No review save, re-analysis, import or repeated nested-dialog testing is needed.

### October 4 breadcrumb placement correction

- User review identified that breadcrumbs were wrongly placed inside the seller
  workspace instead of Home's under-navbar context bar. Moved them into the new
  base `context_bar` slot, before feedback/status strips and outside main content.
  Analyzer uses that same slot for its current-page label. Embed variants omit it.
- Promoted Home's existing 32-pixel context-bar styling into shared navigation
  CSS; Home retains its breadcrumb content, draft control and layout. The shared
  styling is reused rather than independently recreating the strip.
- The seller bar spans the viewport and starts exactly at the navbar's 46-pixel
  bottom edge; its height remains 32 pixels. The workspace has no duplicate
  breadcrumb. Existing six visible rows and saved bucket choices are unchanged.
- Remaining background, legacy footer and workspace boundary feedback is recorded
  as unfinished work, not approved or silently dropped. Page rows remain BUILDING
  even if this headings/commands checkpoint receives sign-off.
- Correction validation: 121 isolated Revenue/Home/navigation rendering tests and
  16 navigation JS tests passed. Live Home retains the same 32-pixel strip in all
  eight theme pairs and its one existing draft control. The later app-wide
  standard replaces the mock Overview/Activity hierarchy with plain Home.
  Revenue bars sit directly below navigation; keyboard breadcrumb focus is visible
  and Enter follows the existing Analyzer link. Saved buckets and protected New
  Note tabs remain untouched. Diagnostics and whitespace checks are clean.

### October 4 app-wide canonical breadcrumb standard

User-approved October 4, 2026, together with checkpoint 23 Revenue page chrome.
Approved overall redesign completion is approximately 24% by effort.
Committed locally as `60dbdb3`; no push or merge.

- The user approved extending the under-navbar breadcrumb bar to all pages,
  including pages that previously had no trail. A central resolver covers all
  90 full-page endpoints; a template-inheritance coverage test prevents new pages
  from silently relying on a generic fallback.
- Non-home pages start with linked Home and end with an unlinked current page.
  Only actual parent destinations are included. Names are escaped, `>` separators
  are quiet and hidden from assistive technology, and keyboard focus is visible.
  Long labels retain their full accessible text and title while truncating visually.
- Home now shows a single Home location label. Its draft button, full-height
  workbench geometry and protected Note tabs are preserved.
- Customer Revenue uses Home > actual Seller > actual Customer > Revenue.
  Seller-wide Revenue uses Home > actual Seller > Revenue. Revenue Analyzer uses
  Home > Reports > Revenue Analyzer. Missing assignments are omitted; unmatched
  imported seller names use valid reporting parents instead of fictional hubs.
- Removed obsolete in-content breadcrumb components, including shared project
  and engagement fragments. Embedded previews keep the underlying page's trail,
  without growing a second navigation frame.
- Live development checks cover Home, Reports, Analyzer, Seller Hub, Customer Hub,
  customer/seller Revenue, Partners, Topics, Settings and Admin logs. Every
  non-home bar is outside main content, starts at y=46, and stays 32 pixels high.
  Eight theme variants maintain at least 6.75:1 ancestor-link contrast, no trail
  overflow on the checked live records, and unchanged strip height. Keyboard Tab
  gives an actual ancestor link its two-pixel native focus outline.
- A real long-name customer also truncates at the 36-character-width cap without
  bar overflow, preserving its full title and accessible name. Keyboard Enter on
  Austin Card's breadcrumb opens the actual Seller Hub, not Analyzer.
- Final scoped validation: 514 Python tests and 22 native navigation/export JS
  tests passed. The expanded page sweep exposed an unrelated existing
  seller-engagement API assertion expecting 83% story completeness when the
  current seven-field model correctly returns 71% (five filled fields). That one
  assertion is excluded from the final scoped selection; API behavior and its
  assertion are unchanged. The obsolete Home Bootstrap-icon assertion is updated
  to verify Home's actual current-location label.
- Scope remains breadcrumb placement, hierarchy and styling, not page-body
  migration. Revenue's legacy background/footer and workspace boundary remain
  unfinished. No records or saved preferences were changed; no commit, push,
  merge or deployment is authorized by this scope approval.

## Checkpoint 24: continuous workbench shell and Revenue pilot

Status: VERIFY for full pages; shell composition approved October 4, 2026,
committed as `4320872`. Scrolling is technically verified but was not manually reviewed by
the user because their visible alerts did not require it. This checkpoint establishes
the [shared shell contract](GLOBAL-SHELL.md#shared-shell-contract-checkpoint-24).
Analyzer and seller Revenue are its first non-Home examples.
Estimated full-redesign completion at this commit: about 25% by effort.

- Added an opt-in base `body_class` hook and shared native page-frame stylesheet.
  Only the two migrated full pages opt in; Home, other legacy pages and embedded
  consumers keep their existing geometry.
- Superseded the uncommitted centered/outlined frame experiment. The work surface
  meets the shell edges; borders divide functional command, summary and work
  regions rather than enclosing a content rectangle.
- The alert viewport owns scrolling and keeps column headers sticky. Commands,
  summaries, 46px navigation, 32px breadcrumbs and the 24px status rail stay in
  place. This shell does not prescribe a single layout for all future pages.
- The status rail reports actual shown/loaded alerts after filtering, without
  changing existing totals or export scope. Seller scope stays explicit; Analyzer
  retains import date/month metadata in the rail. Copyright/companion text remains
  available in the existing Help/Keyboard Shortcuts reference on opted-in pages.
- User review removes the redundant seller-header "Customers needing attention"
  subtitle. The consolidated metric retains that label and its existing count.
- Empty shared feedback stacks no longer consume space in this frame; actual
  notices and status strips retain their existing behavior.
- Approved table, review and preview workflows are preserved. Queue/detail
  selection, comparison modes and customer-versus-alert metric naming remain
  separate decisions, not incidental changes in this shell pilot.

### Verification

- 145 scoped Python tests passed: Revenue rendering, new full-page opt-in and
  embed contracts, unchanged Home/navigation, and app-wide breadcrumb coverage.
- 73 scoped JS tests passed for view counts, bucket filtering, native sorting,
  menus, record loading/guards, Revenue preview return and report exports.
- Live dev uses the current 1517 x 1167 desktop viewport, without resizing it.
  Surface is x=0/y=78, width=1517; status rail is y=1143, height=24.
  Breadcrumbs remain y=46, height=32; no document overflow.
- Saved Databases/Fabric buckets still show 6 of 12 seller alerts and 14 of 43
  Analyzer alerts. All 43 real Analyzer rows were temporarily revealed through
  row styles to exercise long-table scrolling and zero-visible counts without
  saving filter preferences. The 1771px table scroll extent leaves command bands,
  sticky headings and status fixed. Original row visibility and sort are restored.
- All eight palette/mode variants on both pages preserve edge connectivity with
  no horizontal overflow. Measured Analyzer primary-cell contrast is at least
  13.03:1, status at least 6.49:1, and seller summary/table/status text at least
  6.38:1. Theme attributes are restored without preference writes.
- The integrated browser is visible during these checks, unlike the earlier
  frame experiment. Native Priority click and Ctrl+End scroll the table to
  1771px. Actual alert 1069 opens through its native button with fifteen product/
  total rows; native Escape restores its opener and the same table scroll.
  Real table scroll events dismiss the page-level Sellers menu.
- Native Tab reaches the focusable seller alert viewport with a 2px inset
  indicator, avoiding clipping at the shell edges. Help opens natively with the
  retained app/legal copy; Escape restores the header Help control.
- No customer data, analysis/review records, saved preferences, clipboard or
  downloads were modified. Protected New Note tabs were not navigated or reloaded.

### Visual review

The user approved the connected surface, command/summary bands and useful bottom
status on October 4, 2026. They explicitly did not manually review scrolling
because their visible alerts did not require it; the technical evidence above
remains distinct from user review. Approval is for the shell, not the wider
interim table as the final Revenue design.

There is deliberately no new queue/inspector interaction in this checkpoint.
Adopt the approved contract incrementally, not with a global legacy-page restyle.
Customer Revenue and its charts are not migrated by this pilot.

## Checkpoint 25: seller Revenue queue and inspector

Status: technically verified and visually approved October 4, 2026, including
restored priority colors; committed as `747058a`. The user selected this workflow pilot instead of
migrating customer Revenue first. Approved progress is about 26%.

### Scope and parity

- Standalone seller Revenue starts in Queue after successful enhancement. A
  366px priority-ordered alert queue and independently scrolling detail inspector
  divide the continuous work surface. The existing table is retained behind the
  Queue/Table view control and remains the server-rendered fallback.
- Queue selection is per analysis ID, not per customer. Each row carries customer,
  bucket, category, priority, risk/opportunity and the shared review-state badge.
  Arrow Up/Down, Home and End select visible alerts with one roving tab stop.
- User review restored semantic queue priority colors: 80+ danger, 60-79 warning,
  40-59 accent and below 40 neutral. Queue, native table and detail share one
  priority-tone macro, with threshold-boundary regression coverage.
  Follow-up validation: 82 scoped Python tests and seven queue JavaScript checks
  pass. Live selected/unselected priorities match table/detail colors across all
  eight themes; all four queue tone rules resolve to existing semantic tokens.
- Detail uses the exact shared `revenue_alert_detail.html` response, including
  guidance, reviewed state, previous-review hint, metrics and product/month
  totals. Customer Hub and Full Revenue Page remain distinct destinations.
  No invented charts or new analysis rules.
- The shared `SBRecordDialog.create` controller adds explicit `presentation:
  'panel'`, guarded `clear()`/`refresh()` and optional external `isBusy` for
  persistent hosts. It retains identity/content-type checking, cancellation,
  stale-response rejection, error/Retry, date rendering and mount/disposal.
  Existing dialog callers keep their original lifecycle.
- The approved Review Alert editor owns writes and dirty/save protection. Review
  blocks queue selection and mode changes, including when no pane body is mounted.
  Only a confirmed selected-pane review refreshes its detail after editor close.
  Cancel/discard does not trigger a reload. Shared review badges update in both
  views through the existing confirmed-write event.
- Visibility follows the existing table's filtered rows, not a second filter
  implementation. An excluded selection advances to the highest-priority visible
  alert; zero results clear obsolete details and show an explicit recovery hint.
  Comparison sorting does not reorder the priority queue.
- Seller totals and CSV-for-Teams retain their existing all-bucket scope. The
  summary remains visible in both modes. Its count now truthfully says Alerts
  Needing Attention: two buckets for one customer count as two alerts. Risk and
  opportunity remain separate.
- The shared summary markup is extracted unchanged into one partial, with a
  default label preserving other hosts. Analyzer, embedded seller lists, Seller
  Full View, Home and customer Revenue retain their existing workflows.
- Scripts initialize after the shared record loader. Invalid queue/table identity
  or missing loader produces explicit feedback rather than a false success.
  Mode changes do not write preferences. Cached-history return resumes selection.

### Verification

- 149 isolated scoped Python tests pass, covering unchanged hosts, single summary,
  literal metadata, native controls, script ordering, duplicate-customer/different-
  bucket identities, alert-count semantics, empty states and shell/breadcrumb parity.
- 84 scoped JavaScript checks cover shared dialog/panel reads and guards, queue
  keyboard/selection/filter/mode/review/history behavior, sorting, filters, menus,
  status counts and exports.
- Live dev remains at the unchanged 1517 x 1167 desktop viewport. Austin Card
  shows 6 of 12 alerts with the saved Databases/Fabric filter. Alert 1069 loads
  fifteen product/total rows. Native Arrow Down selects actual alert 332 and
  its matching body. Table sorting and switching back preserve queue selection.
- All eight palette/mode pairs preserve geometry and avoid document/inspector
  horizontal overflow. Sampled selected-row, summary and status text contrast
  is at least 5.40:1. Theme attributes are restored without preference writes.
- Native detail-region wheel scrolling leaves the queue, page commands, selected
  customer heading and bottom status fixed; document scrolling remains zero.
- A replayed read-only HTTP 503 exposes Error/Retry and removes stale detail.
  Removing the interceptor and native Retry restores real alert 1069 and all
  fifteen product/total rows, with title focus retained.
- Native Review opens for actual alert 332. Temporary unsaved notes survive
  Keep editing. A guarded programmatic Table request is rejected without changing
  selection. Discard closes the temporary draft, restores the actual Review
  opener and clears the obsolete busy hint. No live review PATCH is submitted.
- Temporary table-row visibility changes exercise Fabric-only 3/12 and zero
  results without saving filters. Selection follows the correct actual alert 250,
  zero results clear the inspector, and original row styles/filter values are
  restored. These visibility probes are distinct from the automated picker tests.
- No live business data, saved preferences, exports or clipboard are changed.
  Protected New Note tabs are untouched.

### Visual review

The user approved the standalone seller queue/detail composition and semantic
priority correction, while leaving room for later refinements. Modal Full View
retains a compact native table for contextual comparison; Full Page opens the
sustained-work queue/detail layout. Shared content and actions remain consistent,
not identical composition. The approved shell is not being reopened. Analyzer
remains Table-only; customer Revenue migration follows next.

## Checkpoint 26: customer Revenue analysis and history

Status: VERIFY, technically verified and user-approved October 4, 2026;
committed as `9a4ddef`. Approved overall progress is about 27%.

### Scope and parity

- Both customer Revenue aliases adopt the continuous workbench shell. Commands
  remain fixed above independently scrolling context/history panes; breadcrumbs
  retain canonical Seller > Customer > Revenue ancestry and Help owns legal copy.
- Replace floating Bootstrap analysis cards with divider-separated native strips.
  Extract the existing preview header, metrics, guidance and previous-review
  hint into a shared summary include. Customer analysis retains its Inactive
  label; previews retain Churned. Thresholds, risk-before-opportunity and native
  Review actions remain unchanged. Neutral priorities now use the same muted
  semantic token in detail as in queue/table.
- Total Revenue and bucket product grids use native table styling and accessible
  captions/headers. Share the exact product grid and month-cell formatting with
  the existing detail body, including seven-month windows, zero/negative amounts,
  change-color thresholds, product destinations and all-history totals.
- Bucket filters apply to analysis strips, total-table bucket rows and history
  sections together. The all-bucket aggregate remains independent, now explicitly
  labeled as including hidden buckets. No totals or analysis are recalculated.
- The status rail counts actual analysis/history regions rather than duplicate
  `data-bucket` appearances. A zero-result filter has recovery feedback; no-data
  customers retain their distinct no-history message. Embedded pages do not
  acquire the full-page shell/status rail.
- At the user's request, the initial stacked reading layout becomes a 340px
  bucket-context pane beside a product grid capped at 1120px, down from about
  1660px. Analysis, rationale, metrics and Review stay alongside selected history.
  Navigation lists only in-scope buckets and does not change the saved filter.
  A single visible bucket has no redundant chooser. Overview is separate, retains
  all-bucket totals and supplies a single-bucket return link when appropriate.
- Selection supports fragment links and Back/Forward, advances when filtering
  excludes the current bucket, protects an open Review editor, and distinguishes
  missing analysis from missing history. Embedded/no-data pages retain their
  stacked fallback. Full History and product pages retain their existing legacy
  destinations. No navigation preference, report, service/query or write API is added.
- Contextual Help covers both aliases without claiming bucket/product routes.

### Verification

- 170 scoped Python tests pass across Revenue, breadcrumbs, Home and navigation.
  Coverage includes shared preview parity, both customer aliases, all categories,
  metadata/escaping, analysis-only/no-data customers, embed boundaries, grand
  totals, no-product buckets and real seven-month/all-history amount semantics.
- 102 scoped JavaScript checks pass across customer navigation, scope counts,
  zero-result recovery, fragments/history/focus, Review deferral, embed fallback,
  Help aliases, shared filters, Review, preview/controller, queue and shell helpers.
  Editor diagnostics and whitespace validation are clean.
- Existing Standard Technology Inc. dev data has ten analyses and ten history
  buckets. All eleven monthly grids retain identical pre/post cell-text hashes
  and row counts. Saved Databases/Fabric selection shows one history bucket and
  one analysis; selecting all shows ten of each, not thirty duplicate appearances.
- All eight themes retain the 340px context pane and 1120px product grid, semantic
  priority colors, and no document or pane horizontal overflow at the unchanged
  desktop viewport. Theme attributes are restored without preference writes.
- Native Review opens actual alert 1069, loads existing history, protects an
  unsaved temporary draft through Keep editing, and discards it with focus returned
  to its opener. No live review PATCH is submitted.
- Native Select all exposes ten bucket destinations. Selecting Other Services
  displays its 35-row grid at 1120px without writing the saved filter. Its history
  scrolls 384px while context/document scrolling stay zero. Back returns to
  Overview and Forward restores Other Services. Initial stacked-layout testing
  identified a native fragment root-scroll regression; scoped root overflow
  clipping keeps opted-in workbench frames fixed, without changing legacy/Home.
- Full History opens the actual Databases product-history page. F1 opens correct
  customer Revenue guidance. Seller queue reload still selects alert 1069 and
  renders fifteen product/total rows after the shared extraction.
- Temporary local filter selections are restored to the exact original
  Databases/Fabric value. No live business data, clipboard, protected draft tabs
  or persistent theme preferences are changed.

### Visual review

The user approved the context/history split October 4 and requested that future
pages follow this type of design decision. Preserve useful adjacent context,
readable table widths, separate scope/navigation and nonredundant controls without
forcing the same composition everywhere. The customer reading layout is distinct
from the approved seller triage queue. Customer bucket Full History follows next;
other full-history/product surfaces remain future work.

## Checkpoint 27: customer bucket product history

Status: VERIFY, technically verified and user-approved October 4, 2026;
committed as `aaf6cfd`. Approved predecessor: `9a4ddef`.
Approved overall progress is about 28%.

### Scope and design reasoning

- Both customer bucket aliases adopt the continuous standalone workbench.
  Breadcrumbs retain real Home > Seller > Customer > Revenue > Bucket ancestry.
  Embedded pages keep stacked content without taking over the host shell.
- The page already has one bucket in scope. Do not add a duplicate chooser,
  saved filter or product-navigation list that merely repeats the comparison grid.
  Place useful analysis and actual product/month scope beside the reading area.
- Context remains 340px. The recent comparison grid is capped at 1120px rather
  than its previous 1270px. Three-column full-history tables are capped at 640px.
  Context and reading panes scroll independently beneath fixed commands/status.
- Reuse the shared summary, monthly cell formatter, product grid and native Review.
  The grid's optional bucket-total row defaults on for existing hosts, but is off
  here to preserve the original product-only comparison.
- Preserve the bucket's rationale even with a NO ACTION recommendation through an
  explicit summary option. Existing preview/customer defaults remain unchanged.
- Replace Bootstrap's single collapsed history group with native details/summary,
  still closed initially and exposing every product together when opened.
  Keep every imported history row, newest-first order, chronological predecessor
  lookup and exact change/zero-denominator semantics. No route/query/write API changes.
- Shared Review adds direct review access beside the bucket analysis. Help covers
  both aliases and distinguishes seven displayed months from all-history totals.

### Feature parity evidence

| ID | Original information/control | Native destination and verification | Result |
| --- | --- | --- | --- |
| BUCKET-01 | Customer/bucket title, ownership trail, back link | Canonical context bar, fixed commands, customer context; both aliases/embeds tested; live return reaches customer Revenue | PASS |
| BUCKET-02 | Category, rationale, priority, risk-before-opportunity | Shared semantic analysis; NO ACTION rationale and Inactive label covered without changing preview defaults | PASS |
| BUCKET-03 | Recent seven-month product comparison and all-history totals | Shared grid, unchanged cells/product links; zero/negative amounts and exact +/-10% boundaries tested | PASS |
| BUCKET-04 | One collapsed full-history group | Native details, initially closed; keyboard expansion exposes all fourteen live product histories | PASS |
| BUCKET-05 | Newest-first history, revenue, change from previous imported row | Exact pre/post cell hash for all fifteen grids; positive/zero/negative predecessor cases and change colors tested | PASS |
| BUCKET-06 | Product drilldown links | Shared original destination; actual product page opens and Back returns to bucket history | PASS |
| BUCKET-07 | Empty product data and absent analysis | Distinct analysis/product/history messages; isolated populated/empty fixtures and embed boundaries | PASS |
| BUCKET-08 | Readable content and complete history | Eight themes retain 340px context, 1120px recent grid, 640px history; reading scrolls 1800px with context/document at zero | PASS |
| BUCKET-09 | Alert review available elsewhere | Shared editor now available in context; live dirty draft discarded, zero PATCH requests, opener focus restored | PASS |
| BUCKET-10 | Scope and assistance | Actual product/imported-month counts, all-history total labels; F1 opens bucket-specific native Help | PASS |

### Verification and handoff

- 187 isolated Python tests pass across Revenue UI/shared content and report
  breadcrumbs. Twenty-nine scoped JavaScript checks pass for customer navigation,
  customer/bucket Help aliases and the shared Review editor. Editor diagnostics
  and whitespace checks are clean.
- Live pre/post SHA-256 of all table cells matches, including every recent/full
  grid and row count. No financial values, chronology or product destinations change.
- Native keyboard history expansion, independent long-history scrolling, Review
  discard, F1 Help, product navigation and return to customer Revenue are verified.
  Saved Databases/Fabric filter remains unchanged. No live review is saved.
- The user approved the bucket history composition October 4 and requested the
  next phase. Product-level Revenue detail follows next.

## Checkpoint 28: product Revenue comparison and history

Status: VERIFY, technically verified and user-approved October 5, 2026;
committed as `e286617`. Approved predecessor: `aaf6cfd`. Approved progress
is about 29%.

### Scope and design reasoning

- Both product-detail aliases adopt the continuous standalone shell and retain
  canonical Products ancestry. The job is cross-customer comparison and reading,
  not bucket analysis. Use the three-column comparison as the navigator
  beside selected customer history, rather than adding a duplicate customer list.
- Compact product-wide summary replaces three floating metric cards. Values and
  denominator stay identical. Labels now say customer entries and average per
  entry because the existing query counts customer/bucket rows, not unique names.
  Searching never recalculates the summary or changes saved bucket preferences.
- Search covers customer, bucket and formatted total. A row or its
  clock button selects history; customer Revenue and Hub links retain their
  separate original destinations. Excluding selection advances within results;
  zero matches clear stale history and offer Clear recovery.
- Keep selection keyed by unique row IDs and histories keyed by the existing
  customer-name grouping. Duplicate bucket entries remain distinct and share the
  same existing history. Aggregation, ordering and query behavior are unchanged;
  this slice does not reinterpret the route's grouping as bucket-specific data.
- Preserve every monthly history table in SSR. Standalone enhancement presents
  one at a time; embedded/no-script content remains stacked. An invalid mapping
  reports an error before replacing that fallback. Missing history and an empty
  product have distinct feedback. Consolidation metadata remains independently
  available, with every member exposed through a native disclosure.
- Extract the exact bucket monthly-history renderer for reuse with product
  histories. Preserve reverse rendering, chronological-predecessor lookup,
  zero/negative amounts, percentage rounding and strict +/-10% color thresholds.
  Bucket caption/disclosure behavior stays unchanged.
- Product search gets a unique ID so it cannot collide with the shared note
  picker. Browser-restored form values are reconciled after pageshow, preventing
  stale search scope on Back. Selection supports fragments and Back/Forward,
  safe focus movement and stable scroll for unchanged customer history.
- Comparison is bounded to 1120px; standalone graph/history fill the reading pane.
  Embedded/no-script histories retain their 640px reading limit. Both panes scroll independently;
  search, summary, commands/status and selected customer identity stay visible.
  No new routes, models, services, write APIs or dependencies are added.

### Feature parity evidence

| ID | Original control/information | Native destination and verification | Result |
| --- | --- | --- | --- |
| PRODUCT-01 | Product name, Products destination and canonical trail | Fixed command band, same links and both path aliases; embedded boundary tested | PASS |
| PRODUCT-02 | Count, total and average | Identical values/denominator, explicit entry and all-history labels; duplicates, empty and search tested | PASS |
| PRODUCT-03 | Search across comparison row text | Three visible fields, case-insensitive input/clear and explicit zero matches; date search removed with its column by user request | PASS |
| PRODUCT-04 | Customer/bucket/total comparison | Three columns and all 63 live entries; Latest Month removed by explicit user request | PASS |
| PRODUCT-05 | Matched Revenue/Hub links and unmatched names | Actual Hub navigation and return verified; unmatched entries have no invented links | PASS |
| PRODUCT-06 | Complete customer history and month counts | All 63 history tables retain cell hash and row counts; selected history remains reachable for every entry | PASS |
| PRODUCT-07 | Consolidated member preview and totals | Native complete member list; live seven-member, 28-entry product and isolated aggregation/escaping tests | PASS |
| PRODUCT-08 | Empty and missing history | Disabled empty search, zero metrics and distinct missing-history feedback tested | PASS |
| PRODUCT-09 | Reading context and desktop themes | Full-pane standalone graph/history, no horizontal/root overflow, independent scrolling and sticky customer heading | PASS |
| PRODUCT-10 | Help and integration boundaries | F1 opens Product Revenue for both path aliases; unique search ID and restored-form Back behavior covered | PASS |

### Verification and handoff

- 197 scoped Python tests pass across product rendering, shared Revenue content
  and report breadcrumbs. Forty JavaScript checks pass across product/customer
  navigation, Help aliases and shared Review. Editor diagnostics and whitespace
  checks are clean.
- All history table cell values and row counts match the live pre-change fingerprint.
  Shared extraction also retains the prior bucket page's fifteen-table fingerprint.
  Product count, total and average stay identical throughout search/selection.
- Native Enter selection, Back/Forward, search/no-match/Clear, Hub navigation and
  restoration, consolidation disclosure and F1 Help are verified. Eight themes
  retain comparison scroll 650px and history scroll 189px while document stays
  at zero; selected-customer heading stays visible.
- The original saved Databases/Fabric filter and Graphite dark theme remain
  unchanged. No Revenue writes or protected draft changes occur.
- The user approved product comparison/history October 5, including all requested
  graph and width refinements. Committed as `e286617`; Products directory follows.
  The seller product family remains future work.

### Requested trend graph refinement

- Add a 220px monthly revenue line graph above the selected customer's exact-value
  history. It reuses the existing local Chart.js vendor, not a new dependency or
  remote script. Only one chart exists at a time; selection destroys the old one,
  repeated same-customer selection retains it, and zero results clear it.
- Graph calendar dates run oldest to newest without changing the table's original
  ordering or change calculations. Missing months are null gaps, never invented
  zeroes. Zero and negative revenue remain exact points, one month remains visible,
  and hover identifies the fiscal month with its precise currency amount.
- Theme changes repaint from the existing accent, muted and line tokens.
  Embeds/no-script fallback retain tables without a miniature chart application.
  Canvas has an accessible label and the full history remains the text equivalent.
- Refinement validation: 10 product Python tests and 16 product/controller/chart
  JavaScript checks pass. The live 64-table fingerprint and all three summary
  values remain unchanged. Selection/search update the graph from the exact
  matching records; zero results dispose it and Clear restores it. Native hover
  shows the correct fiscal month and precise amount. All eight theme variants
  retain a 640px by 220px graph, zero document/horizontal overflow and independent
  history scrolling. Graphite dark and the original selection/search are restored.
- Requested mirrored dollar labels use a right-hand axis with the exact left-hand
  bounds, tick values, currency formatting and theme typography. It adds no second
  data series, chart-area gridlines or right border.
- Mirrored-scale validation: six chart tests pass, including negative/fractional
  ticks and independent Chart.js limit rounding. Live labels and their vertical
  positions match exactly in all eight themes (zero pixel offset). The selected
  customer, chart data and desktop viewport are preserved.

### Requested comparison and width refinement

- Remove Latest Month from product comparison, its search scope, placeholder,
  contextual Help, column-specific styling and associated assertions. Imported
  history dates and other Revenue pages remain unchanged.
- The standalone reading section, graph and table now use its full content width
  instead of stopping at 640px. Consolidated-member disclosure shares that width.
  The change is explicitly scoped to the enhanced product page; embedded and
  no-script stacked history retain their existing reading width.
- Refinement verification: 10 product Python tests and 17 JavaScript checks pass.
  Both aliases and embedded rendering have exactly three columns/search fields.
  In all eight live themes, section/table/chart widths exactly match the available
  799px reading width, with no horizontal/document overflow. All 63 history tables
  retain their exact cell fingerprint; summaries, current selection and imported
  graph data remain unchanged.

## Checkpoint 29: Products directory

Status: VERIFY, technically verified and user-approved October 5, 2026,
including the shared sorting follow-up. Approved predecessor: `e286617`.
Committed as `aed2350`. Approved effort estimate is about 31%.

### Composition and preserved contract

- The initial single-list design is superseded by the user's requested two-stage
  browsing workflow. Products and their usage/totals are on the left; the selected
  product's customer/bucket consumption is on the right. Customer names open the
  approved graph/history workbench with the exact customer/bucket entry selected.
  There is no duplicate product queue, all-customer history stack or empty filler.
  Fixed title/search context, independently scrolling panes, sticky column headers
  and a filtered-count rail keep the actual comparison work in view.
- Both Products aliases retain canonical Reports > Revenue Analyzer ancestry.
  Full Product destinations, default total-descending order, literal product names,
  displayed currency and all usage values are unchanged. Regular product clicks
  inspect in place; modified/new-tab clicks retain native full-page navigation.
- The original Customers heading counted positive-revenue customer/bucket pairs.
  Consolidation sums member counts, including repeated pairs across members.
  Label these Usage entries and explain the count, rather than claiming unique
  customers or silently recalculating the service. The extracted rollup preserves
  existing query/aggregation semantics; no model or stored-data changes.
- Search retains all three visible fields, adds native Clear and an explicit
  zero-match recovery, and reports shown/loaded product counts. It does not
  mutate revenue, sorting, consolidation, saved bucket preferences or links.
  Browser-restored search is reconciled after pageshow; excluded focused links
  return focus safely to search.
- Genuine empty data keeps the existing import destination and explanatory
  feedback, with disabled search and accurate zero scope. SSR leaves all rows
  readable. Embeds omit the full page shell and use a local count, never the
  parent's status rail.
- Both levels use the extracted customer table and summary, backed by
  `get_product_comparison`. Existing product aliases accept `comparison=1` for
  an identity-tagged, history-free HTML fragment. It returns before the costly
  monthly-history queries. Full-page defaults retain Customer Revenue/Hub links,
  native clock selection and the original name-keyed history grouping.
- The shared guarded panel loader verifies the real product name through an
  optional identity mapper; default numeric record guards remain unchanged.
  Loading, failures, Retry, disposal and stale-response cancellation are reused.
  No fragment script activation or duplicate custom fetch handler is introduced.
- Incoming customer links use exact customer-name/bucket query values, not a
  revenue-sorted row number. Repeated customer names remain distinguishable;
  unmatched imported names are navigable too. Missing bookmarks show explicit
  feedback instead of displaying another product/customer as if it matched.
- Contextual native Help covers both directory aliases, without displacing the
  Product Revenue Help route. No new URL routes, writes, dependencies or distinct
  analytical features are added.

### Parity and verification

| ID | Original information/action | Native destination and verification | Result |
| --- | --- | --- | --- |
| DIRECTORY-01 | Page identity, two aliases and ancestry | Continuous frame on both standalone aliases; canonical breadcrumbs and embed boundaries tested | PASS |
| DIRECTORY-02 | Every product and its original destination | All 573 products retain values/order/Full Product links; literal/slash names and native modified clicks tested | PASS |
| DIRECTORY-03 | Customer count and total revenue | Same positive-pair counts and consolidation sums, clarified Usage entries label, unchanged currency/order | PASS |
| DIRECTORY-04 | Search over row text | Case-insensitive product/count/amount search, Clear, explicit zero matches and safe focus, with no value/order mutation | PASS |
| DIRECTORY-05 | All-product count | Footer reports shown/loaded scope; embed owns its own count, including genuine zero data | PASS |
| DIRECTORY-06 | Empty data and import recovery | Isolated empty tests retain import link, native feedback and disabled search | PASS |
| DIRECTORY-07 | Reading/navigation context | Product/customer panes scroll independently; Back restores product, search and both positions exactly; embeds retain a 1120px ordinary list | PASS |
| DIRECTORY-08 | Theme/Help compatibility | Eight live themes retain width/scroll geometry; native F1 opens correct Help; both Help aliases tested | PASS |
| DIRECTORY-09 | Customer consumption and product history | Shared summaries/table match full detail; non-first customer opens with correct selection and visible graph; name-keyed history remains unchanged | PASS |
| DIRECTORY-10 | Reliable inspector reads | Shared cancellation, identity checks and disposal covered; live 503 surfaces failure and Retry recovers actual customer data | PASS |

- 107 scoped Python tests pass across directory, approved product detail and
  report breadcrumbs. Forty-four JavaScript checks pass across directory,
  product selection, graph and shared guarded panel behavior.
- The initial list-only slice verified the original 573-row/links fingerprint.
  The two-pane slice preserves the directory query, all 573 products and their
  destinations; its current `{cells, href}` snapshot hashes to
  `4e447e3a65af3c0f66bcf4fc1bca46a63a0d817ea412514de4b6969d46b741d0`.
  All 63 approved SQL history tables still match the exact prior fingerprint
  `af1877bb16215aaf14a62b3df953c3fb43f54d907a45d63a1b17a20aaf08ed11`.
  Positive-pair exclusion, duplicate buckets and consolidated-member counts are
  explicitly tested. Consolidated preview totals deduplicate the same pairs as
  full detail, while directory usage counts intentionally retain member summing.
- Live Premium SSD customer comparison matches all 151 full-detail entries.
  Clicking the ninth SQL customer, CDATA SOFTWARE/Databases, opens only its
  history and graph. Back restores SQL search, the selected SQL product and exact
  left/right scroll positions of 120px/200px.
- Live read failure/recovery is verified on Blob Storage: a simulated 503 shows
  failure without stale customers, then Retry restores all 167 actual entries.
- All eight themes keep document geometry at the unchanged 1724x1167 desktop
  viewport with no document/horizontal overflow. Both column headers align
  exactly with their own scroll regions after 600px scrolling. Actual embedded
  `/revenue/products?embed=1` retains 573 rows, 1120px width, local count and no shell
  or active inspector. The standalone aliases retain canonical ancestry.
- The active dev tab is left on the complete directory in Graphite dark, search
  cleared, reading scroll at zero and Help closed. Protected drafts are untouched.
- Directory and sorting are user-approved. Seller product list/detail are next.

### Shared sortable columns: October 5 follow-up

- User requested ascending/descending sorting for every column in every pane
  of the recent table-based workbenches. One shared opt-in helper now covers
  Products, product/customer comparison, every monthly-history table, Customer
  Overview and bucket grids, Bucket Full History, Revenue Analyzer, seller
  alert tables and the product matrices in loaded inspectors/compact previews.
  Non-tabular summaries, graphs and bucket navigation are not sortable columns.
  Unmigrated seller product pages retain their existing behavior.
- Native header buttons indicate the current direction and announce the next
  action. Text sorts naturally; money, usage, priority and change use exact raw
  values, not rounded display text. Month sorts by actual ISO calendar date.
  Missing months stay distinct from imported zeroes; unavailable values sort
  last in either direction. Summary rows keep their slots, ties are stable and
  existing row nodes, links, controls and semantic financial colors are retained.
- Each table owns its sort state within browser history. Search fallback follows
  current DOM order without replacing stable entry/loader identities. Seller
  queue ordering and keyboard navigation follow Table order without changing
  the current selection. Graph chronology/data and server-calculated monthly
  changes do not depend on the visible row order.
- 127 scoped Python tests and 110 JavaScript checks pass. Coverage includes exact
  calendar/financial metadata, missing versus zero values, pinned aggregates,
  fragment mounting, sorted search fallback, queue keyboard order, safe history
  restoration and nested reading offsets.
- Live checks cover all columns in both Products panes (573 products and 197
  selected-product customer entries), all 16 customer tables, all 13 bucket
  tables, the Product Revenue comparison and selected monthly history, all
  Analyzer columns, seller Table/queue and loaded inspector matrices, an actual
  APCO alert preview and the 573-row Products embed. All 116 Product Revenue
  tables expose sorting controls. Totals, financial colors, scope and graph
  context remain unchanged.
- Actual header clicks reorder the seller queue; Home selects its new first
  alert and loads the matching matrix. A visible customer link opens the exact
  graph/history entry; Back restores Products' independently sorted columns and
  exact 300px/220px pane offsets. No saved scope or customer records are changed.
- Eight themes retain unclipped header labels and no document overflow at the
  unchanged 1724x1167 desktop viewport. The embed stays an ordinary 1120px list,
  without an active inspector or outer shell. Help and the persisted design
  context now establish sorting as a shared future workbench requirement.
- The dev tab is returned to Virtual Machines Dv3 Series in Graphite dark,
  blank search, default descending totals and zero reading offsets. Protected
  drafts remain untouched. This follow-up is user-approved October 5, 2026.

## Checkpoint 30: Seller Products and monthly comparison

Status: VERIFY, technically verified and user-approved October 5, 2026.
Committed as `e98c879`. Approved predecessor: `aed2350`; approved effort estimate is about 33%.

### Composition and preserved scope

- Seller Products reuses the approved directory template/controller and shared
  comparison markup, rather than duplicating the browser. Products are on the
  left; actual seller-scoped customer consumption is on the right. The original
  Back to Alerts link remains, and native headings replace the old two-button
  sorting controls. Existing `sort=revenue` and `sort=customers` URLs retain
  their initial descending order, while every column sorts both ways.
- The full seller product page stays a wide customer/month comparison grid.
  Comparing recent months across customers is a different task from examining
  one customer's full product history, so no redundant selector or graph pane
  is forced into this page. Fixed title, full-scope summary/search bands,
  independently scrolling grid, sticky headings and truthful shown/loaded
  counts connect it to the continuous shell.
- Seller membership still comes from the existing revenue-analysis query, not
  a silently substituted live account assignment. Directory usage retains
  positive customer/bucket counts and consolidated member summing. Seller
  detail retains zero/negative entries and deduplicated consolidated pairs.
  Labels explain that these are entries, not unique customers.
- Shared rollup accepts an optional seller scope without altering global
  defaults. Existing seller product routes accept `comparison=1` and return
  before monthly-history reads. The shared loader checks product identity and
  seller identity, retaining cancellation, visible failure and Retry.
- Customer links open the scoped monthly grid at the exact customer/bucket
  entry. Native Customer Revenue and bucket links use the original matched IDs;
  unmatched imports remain plain text. View All Customers remains a separate
  global destination retaining the requested entry. Back to Products retains the product,
  while browser Back
  restores the directory's search, independent sorts and reading context.
- Two tightly coupled route defects are corrected: customer IDs were omitted
  from the monthly summary, suppressing intended links; monthly history was
  keyed only by name, allowing one bucket to overwrite another. Seller history
  now uses `(customer_name, bucket)` and regression tests cover distinct values.
  The approved global product history grouping is not changed.
- Every monthly column uses exact financial sort values. Missing months remain
  distinct from imported zeroes. Currency, seven-month chronological coverage,
  all-history totals and change-color thresholds are retained. Consolidated
  members are fully available through native disclosure, not a truncated list.
- Embeds remain ordinary scoped lists/grids with local counts, without outer
  shell or an active directory inspector. F1 has dedicated seller-directory and
  monthly-comparison guidance rather than matching generic Seller Alerts Help.

### Verification

- 142 scoped Python tests and 119 JavaScript checks pass across the affected
  Revenue hosts and controllers. Isolated coverage includes seller boundaries,
  consolidation, nonpositive entries, literal names, both legacy sort URLs,
  customer IDs, separate bucket histories, seven recent months versus full
  totals, lightweight reads, empty data, embeds, search and safe Back restoration.
- All 237 live Rick Bowles products retain their exact original values/order/
  destinations, fingerprint
  `1be16f994b05452f4a99e62fc7e552e2c8a37628ed92ae4a078191fbbe895176`.
  Premium SSD's four monthly rows and ten headings retain exact original values,
  fingerprint `a4860e9018840d886c8d05983866c87fc9b438b927dbdca91a5518bde55eb2d6`.
- All three columns in both directory panes and all ten monthly-grid columns
  sort correctly in both directions. Financial text/colors and selected scope
  remain unchanged. Actual matched links open Customer Revenue successfully.
- A simulated Blob Storage read 503 hides stale content, shows an explicit
  failure with the scoped full-page destination, and Retry restores its four
  actual customer entries. No sample data or separate server is used.
- The Virtual Machines Esv5 comparison opens Actabl/General Purpose Compute
  exactly. Filtering Actabl shows 2 of 6 entries without changing full totals.
  After a Customer Revenue drilldown, Back restores that search and Bucket ASC.
  Back again restores the selected product, `virtual` search, both Name ASC
  sorts and the directory's exact 240px reading offset.
- Both pages pass eight live theme geometries at the unchanged current
  1724x1174 desktop viewport, with no clipped headers or document overflow.
  Actual directory/detail embeds retain 237/6 rows, correct local counts and
  no shell; the directory is a 1120px ordinary list with its inspector hidden.
- Seller-scoped panes with few customer entries do not overflow vertically in
  this live dataset. Shared controller tests cover restoration of overflowing
  customer-pane positions; no artificial records or viewport changes are used.
- Protected note drafts are untouched. No customer/revenue records are edited.
  No push, merge or deployment is authorized. This family is user-approved;
  Revenue report surfaces are next.

## Checkpoint 31: Revenue report surfaces

Status: VERIFY, technically verified and user-approved October 5, 2026.
Committed as `15e8333`. Approved predecessor: `e98c879`; approved effort estimate is about 35%.

### Composition and preserved behavior

- Revenue Reports is a native directory row for the one actual Synapse report,
  with its original description/destination and a Revenue Analyzer command.
  No invented reports, filler cards or unnecessary selector pane.
- Synapse retains New and Current as real navigable scopes, four quiet full-report
  summary measures and all seller groups. A continuous, independently scrolling
  reading area replaces stacked Bootstrap cards. Seller labels and column headings
  stay together while scrolling. With only three current seller groups, the task
  benefits from visible grouped comparisons rather than a redundant sidebar.
- Existing routes, redirects, provider queries, matched customer IDs, all-history
  totals, complete-month calculations, fiscal labels, default ordering and
  positive-amount/dash formatting are unchanged. No model or analytical endpoints
  are added. Header copy distinguishes the New imported-month window from
  Current's unrestricted imported-history population. All four columns in every
  group sort in both directions through the
  approved shared sorter. Dates use ISO calendar values, financial fields retain
  exact fractions/zero/negatives, and Unknown dates remain unavailable.
- Native export commands reuse the existing helper and feedback. Header labels
  remain exportable after conversion to sorting buttons. CSV/EML filenames retain
  their modes; formatted copies retain account links and every grouped table.
  Export selection is restricted to the actual Synapse tables, not Help tables.
- The existing `synapseCustomersMode` preference still applies before paint only
  when the URL has no explicit mode. Explicit and server-normalized modes win.
  Preference redirects preserve other query parameters, embed context and fragments.
  Storage/invalid-preference/navigation failures are logged and visibly explained,
  without disabling usable scope links.
- A private reading-position controller merges per-report offsets into browser
  history without replacing independent table sorts or other feature state.
  Restore follows sorting; malformed context and history-write failures report
  explicitly. Compact embeds never own the parent's reading history, hide the
  outer shell/status and retain embed context when switching modes.
- Dedicated F1 Help explains the two populations, financial scope, sorting,
  remembered mode, matched customer navigation and complete export scope.

### Verification

- 160 scoped Python tests pass for new native rendering, existing report behavior,
  exports and canonical breadcrumbs. 48 JavaScript checks pass for preferences,
  reading restoration, export contracts and the shared sorter. Editor diagnostics
  and whitespace validation are clean.
- Original/new current-mode table fingerprint is identical:
  `8bf904fbdceff7f899934dc99534bb9e18cb540cc61c791073bd2fa7f425a2f9`.
  Its three tables retain 28 customers, three seller groups, $1,337,727 all-history
  revenue and $43,514 latest-month revenue.
- Original/new new-mode table fingerprint is identical:
  `c242591519e0fe2b3a3011aa1f273d34838c957204d75a15221827169dbe93d8`.
  Its one table retains three customers, one seller group, $442 total and $0 latest.
- All 16 live column headings pass both directions, 32 column/direction checks.
  First Usage explicitly orders April, July and August 2026 chronologically.
  Returning from New to Current restores the current group's Total Revenue ASC.
- A visible Hanger Inc. row opens actual Customer Revenue at customer 107.
  Back restores Current, Total Revenue ASC and the exact 340px reading offset.
- Actual CSV/EML payload generation and clipboard HTML retain mode-specific
  filenames, all three current-mode headers/tables, 28 rows and 28 original
  account hyperlinks. Clipboard row names match the live tables; EML includes
  its mode-specific CSV attachment. Downloads and clipboard writes were
  intercepted locally for validation, not sent or left on the user's clipboard.
- The report-directory link respects the saved Current mode. Actual current
  embed retains 28 rows, both mode links retain `embed=1`, and it has no shell,
  status bar or horizontal overflow.
- Eight Synapse theme geometries retain distinct approved surfaces/readable ink
  and unclipped headers without changing the current desktop viewport or saved
  theme preferences. At a 500px reading offset the seller and table headings
  remain at their intended 0px and 44px sticky offsets.
- Empty imports, no matching users, unmatched names, unknown dates, fractional/
  nonpositive values and preference/history failures are tested only against
  isolated fixtures. Live verification uses the existing development database.
  No customer/revenue records are manually changed; protected drafts are untouched.
  No push, merge or deployment is authorized.

## Checkpoint 32: Revenue analysis configuration

Status: VERIFY, technically verified and user-approved October 5, 2026.
Approved predecessor: `15e8333`; approved effort estimate is about 36%.
Committed locally as `350e152` after user approval.

### Composition and parity

- A readable 1120px settings editor sits inside the full-width continuous
  workbench. Four contextual sections replace Bootstrap cards and the detached
  About panel. Each explanation stays beside its fields, without inventing a
  selector or redundant settings sidebar.
- Save Configuration and Cancel stay in the command band. The native submit
  button associates with the original POST form through its `form` attribute;
  browser number validation and keyboard semantics remain browser-owned.
  Cancel still returns to Revenue Analyzer without submitting.
- All nine original names, values, input types, step values, optional status
  and absence of min/max constraints remain. Saved zeroes do not fall back to
  defaults. Dollar values remain integers; drop/growth remain stored signed
  decimal ratios. The old percent suffixes are clarified as ratio/ratio-per-month,
  with the existing -0.15/0.08 examples, not a new conversion or calculation.
- Original gates, overrides, tier boosts and category sensitivity explanations
  remain beside their controls. Loaded-source status distinguishes built-in
  defaults from saved configuration without implying current edits are saved.
  Saving does not re-run analysis; the original next-analysis/Re-analyze guidance
  remains available, including the Analyzer link.
- Routes, model, providers and save logic are unchanged. No dependencies,
  analytical endpoints, auto-save, new field restrictions or client save protocol.
  The existing shared native input/command styles are reused; one local macro
  keeps field labels, accessible descriptions and unit treatment consistent.
- Compact embeds omit shell/status and stack section explanations above ordinary
  fields. They do not contain a miniature full-window editor. Dedicated F1 Help
  describes the actual thresholds and save/apply timing.

### Verification

- 248 scoped Python tests pass across native configuration, revenue analysis/
  routes, breadcrumbs and existing native Revenue hosts. Eight new isolated
  contracts cover default/saved/zero values, both full and embedded rendering,
  native number constraints, form association, create/update POST, unchanged
  ratios, redirect/flash, read-only Cancel and no implicit analysis.
  The 66 SQLAlchemy `Query.get()` warnings are pre-existing.
- Original/new live input fingerprint is identical:
  `4d7ebec3c966d118417bb2416b86b5d99919f3bdda3e7d084db7497bc65a8e86`.
  All nine field names/values/types/steps/range/required properties are unchanged.
  Native header-button activation submits the original nine-value payload to
  `/revenue/config` by POST; the submit event was intercepted locally only to
  avoid writing the live configuration. Actual persistence is verified in the
  isolated test database, including loading through `AnalysisConfig.from_db`.
- Live frame geometry is edge-to-edge: main/surface x=0 and width=1724; the
  header begins exactly at the context bar's 78px bottom. The editor remains
  constrained inside that surface rather than centering the whole page.
  An initially duplicated legacy stylesheet overrode the frame; it was removed
  and a stylesheet-order regression assertion prevents its return.
- All eight approved themes retain distinct surfaces/readable ink, no horizontal
  overflow and unclipped labels/inputs/commands at the current desktop viewport.
  Theme attributes are restored; no saved theme preference or viewport changes.
- Actual embed renders all nine fields with one stacked context column and
  two category-field columns, without navbar, frame or status and without
  horizontal overflow. No sample records or separate server are used.
- The actual F1 handler opens native Revenue Configuration Help with ratio and
  analysis-timing guidance. Help syntax/editor diagnostics and whitespace validation are clean.
  No customer, revenue or configuration records are manually written in live
  development; protected note drafts are untouched. No push, merge or deployment.
  Revenue sync/import remains the next separate surface.

## Checkpoint 33: Revenue sync/import

Status: VERIFY, technically verified and user-approved October 5, 2026.
Approved predecessor: `350e152`; approved effort estimate is about 37%.
Committed locally as `a6b6253` after user approval.

### Composition and parity

- A continuous maintenance surface separates three actual jobs: recent import
  history, stored-month coverage and compensated-bucket editing. Sync commands,
  truthful status, streaming progress, results and taxonomy notices stay above
  the independent reading regions. No invented selector, filler cards or chart.
- The same ten most recent imports and all stored months retain dates, filenames
  and counters. Every column sorts both ways through the shared table engine.
  Imported timestamps use exact numeric seconds, attaching UTC only to SQLite's
  timezone-less UTC values. Months use ISO calendar dates; counts retain raw
  integers. Nullable legacy new/updated counters are unavailable, never fake zeroes.
- The shared bucket engine accepts an explicit list and an inline composition.
  Its existing popover hosts, local persistence, taxonomy handling, fallback reads,
  search and selection semantics remain unchanged. A separate edit-only callback
  performs this import page's existing plain-array compensated-bucket POST.
  Initial/hydrated reads never write preferences or confirm a fiscal year.
  Requests are serialized and intermediate queued edits coalesced, so older
  saves cannot overwrite a newer choice. Unconfirmed saves remain visible with
  Retry; the local choice is not rolled back or falsely called server-confirmed.
- The original empty MSXI payload and SSE endpoint remain. HTTP/body/content
  checks, UTF-8/chunk/CRLF/multiline parsing and strict event/result validation
  replace silent skips. EOF without a terminal result cannot report success.
  A disconnected result tells users to check status, not automatically re-run
  a potentially active sync. All original completion metrics remain.
- Only actual review/reset notices display a change banner. Unchanged/first
  imports do not manufacture one. Dismissal waits for server confirmation.
  Stale status responses cannot erase newer completion or resurrect a notice.
  A post-completion bucket read failure does not relabel the sync as failed.
  Users explicitly refresh the stored-data tables after confirmed completion.
- DSS has no bucket region or bucket reads. Empty stores hide that region until
  sync completes. Compact embeds stack ordinary task regions and omit navigation,
  frame and status. The optional brainrot IDs/global bridge remain, with a scoped
  compatibility wrapper; hydration does not open remote media.

### Verification

- 178 scoped Python tests pass across import rendering, sync/taxonomy services,
  revenue APIs, configuration and breadcrumbs. Seven new rendering contracts
  cover full/embed and SE/DSS contexts, exact UTC precision, original values,
  literal filenames, empty stores, nullable counters and Help.
  The 26 SQLAlchemy `Query.get()` warnings are pre-existing.
- 76 JavaScript tests pass across the page controller, shared bucket engine and
  shared sorting. Coverage includes stream boundaries/UTF-8, malformed events,
  wrong HTTP/content/body, terminal EOF, missing completion, all status states,
  invalid metrics, repeated clicks, completion counters, genuine notices,
  confirmed dismissal, late responses, serialized/coalesced writes, save/read
  Retry, hydration without writes, DSS/embed boundaries and the brainrot bridge.
- Original/native live data fingerprints match after normalizing presentation
  back to the original date/source/counter shape:
  - Import history: `5712bb794cc09c2a3844c6944c5b136b6fe617af1b8a2396dc79604a4e758de7`.
  - Stored months: `21ed15d9c46c3bc2c5cd87ccfff5935489bd9f314202a7460067122fe6137f5e`.
  - Ten history records, 27 stored months and 19 bucket choices remain; Databases
    and Fabric stay selected in both browser storage and the actual controls.
- All seven headings are activated in both directions on the live page, with
  monotonic ordering verified and original sort/history state restored.
  Bucket search finds Fabric, reports unmatched queries and restores all
  nineteen rows without changing selection. Month scrolling is independent
  of history and buckets; the actual F1 handler opens Revenue Import Help.
- Eight approved theme pairs retain edge-to-edge 1724px geometry, a header
  beginning at the 78px context boundary, the footer at 1174px and no horizontal
  overflow. Theme attributes, saved preferences and viewport remain unchanged.
  The actual embed has all 10/27/19 records in a stacked composition, without
  navbar, shell/status or horizontal overflow.
- A controlled live GET-status 503 displays an alert and recovers through the
  real Check status command after the interception is removed. The truthful
  live result remains Previous sync incomplete, not a fabricated successful
  sync inferred from import history. No live sync, preference POST, notice
  DELETE or media activation is performed; those paths are isolated tests.
- Editor diagnostics and patch whitespace are clean. Protected note drafts
  and production are untouched. No new dependencies, migrations, reports,
  analytical endpoints or SalesIQ tools; no push, merge or deployment.

## Checkpoint 34: Main Reports directory

Status: VERIFY, technically verified and user-approved October 5, 2026.
Approved predecessor: `a6b6253`; approved effort estimate is about 38%.

### Composition and parity

- A native grouped directory replaces the Bootstrap card grid. The four
  canonical menu groups stay beside their actual destinations, with report
  names and original purpose descriptions aligned in readable rows. The
  internal 1420px reading width is constrained, not the full-window surface.
  All fifteen reports fit the current desktop view without an invented sidebar.
- All group titles, report IDs/names/descriptions/icons, URLs and ordering come
  from the unchanged report registry. The Reports menu remains untouched and
  its existing parity test still verifies exact grouping and destinations.
  A whole named row is a real anchor with an accessible name/description;
  repeated generic View Report buttons are gone, not report destinations.
- Find a report matches normalized, case-insensitive name, description or group
  text locally. It hides unmatched original nodes without replacing or reordering
  links. Matching reports/groups appear in the status rail. No-match, empty
  registry and Clear/focus states are distinct. Filtering never changes the
  target report's data, registry, menu or stored preferences.
- Back restores the query before the existing shared report reading helper
  restores its offset. History updates merge rather than overwrite reading,
  sorting, drafts or unrelated feature state. Malformed owned filter state is
  visible and can be explicitly repaired with Clear; blocked history writes
  remain visible instead of claiming saved context.
- Compact embeds use ordinary grouped lists with descriptions beneath names.
  Their filter stays local, without navigation, frame/status or parent-history
  access. SE/DSS retain the same actual report registry. No new routes, business
  queries, reports, models, dependencies or SalesIQ tools.
- This is a navigation directory, not an analytical data table. Its canonical
  group/menu order is deliberate; this checkpoint does not implicitly migrate
  any report body or mark the full Reports family DONE.

### Verification

- 165 scoped Python tests pass across the native directory, report services/
  registry, breadcrumbs and approved Revenue report hosts. Five new contracts
  cover full/embed and both roles, exact IDs/order, accessible row names/
  descriptions, controls, script order, statuses and contextual Help.
- Sixteen JavaScript tests pass across local filtering and the reused shared
  report reading helper. Tests cover names/purposes/groups, case/whitespace,
  literal markup-like text, retained nodes/order, no matches, empty registry,
  Clear/focus, Back/query restoration, history merging, embed isolation,
  malformed-state repair and blocked persistence, including local Clear/focus
  remaining usable when saving navigation context fails.
- October 5 review correction: row dividers now follow preceding visible rows,
  not hidden DOM siblings. The live `acr` filter has no top divider above
  Connect Impact or Milestone Tracker. Computed borders are also verified for
  Planning, Milestone and unfiltered results: only subsequent visible rows
  within a group have a divider. A stylesheet regression contract covers the rule.
- Original/native live registry fingerprint is identical:
  `0ce0460799e54c6d8446f7e5f49de4d44c3747ac83f82f0ae2e6a2a69b47bcbe`.
  It covers all four group titles and fifteen names/descriptions/URLs/icons.
- Live filtering finds Synapse Customers alone and all four Planning & Reviews
  destinations through the group name. An unmatched query gives an explicit
  zero-match state; Clear restores all fifteen and returns focus to search.
  Actual row activation opens the live Current Synapse report. Browser Back
  restores the Synapse query and its one visible row; the current directory
  fits the viewport, so its actual reading offset is zero. Nonzero owned reading
  restoration remains covered by the shared helper tests, not a fabricated
  live overflow claim. Search and original history state are restored afterward.
- All eight approved theme pairs retain a 1724px edge-to-edge surface, header
  at the 78px context boundary, footer at 1174px, all fifteen entries and no
  horizontal overflow. Theme preferences and the desktop viewport are untouched.
  The actual F1 handler opens native Reports Help with filtering/Back guidance.
- Actual embedded rendering has all fifteen rows, stacked group composition,
  one local Marketing match and complete Clear restoration, without navbar,
  shell/status or horizontal overflow. Filtering/Clear leave parent history
  unchanged. The working browser finishes on the normal Reports directory.
- Editor diagnostics and patch whitespace are clean. No manual live record or
  preference writes, no production access, and protected note drafts are
  untouched. Checkpoint 34 is committed as `da43a54`; no push, merge or deployment.

## Checkpoint 35: Workload Report

Status: VERIFY, technically verified and user-approved October 6, 2026.
Committed locally as `70ec157`; no push, merge or deployment.
Approved predecessor: `da43a54`; approved effort estimate is about 39%.

### Composition and parity

- The full-window report has fixed native title/export, date-scope and summary
  bands. A narrower sortable topic list supplies real context beside the
  selected topic's full-width customer grid. Each region owns its reading;
  selected-topic and column headings remain pinned. Topic selection is not a
  filter and does not alter totals, saved date scope or export scope.
- The original provider/query is unchanged. Latest customer/topic note dates
  determine inclusive date visibility. Earlier qualifying notes do not rescue
  an entry whose latest note is outside the range. Engagements remain
  customer-wide; milestone counts/ACR remain topic-linked active milestones,
  not recomputed financials or engagement counts within the date range.
- Source topic/customer order, raw amounts, IDs, note dates, Committed meaning,
  customer favicons, customer links and TPID export links are preserved.
  Unique Customers keeps the original trimmed, case-sensitive name counting;
  customer/workload entries counts appearances. Grand-total ACR deduplicates
  milestone IDs, while group/row ACR retain original potentially overlapping sums.
  Display rounding uses the original locale-based zero-fraction convention.
- Every topic/customer table column sorts both ways using exact text, numeric
  or ISO calendar keys. Date filtering updates the topic count/ACR keys and
  reapplies active sorting without recreating rows, links or controls.
- CSV/Clipboard/Email target nonempty date-visible customer tables from all
  topics, including hidden unselected panels. Date-hidden rows retain inline
  display filtering for shared export compatibility. Empty date scopes cannot
  export a misleading collection of headers. Export title stays Workload Report.
- Dates default to current fiscal quarter. The existing storage key and object
  shape remain. Saved All now actually restores; manual edits clear preset
  styling. Malformed/unavailable storage, failed saves, invalid ranges and view
  state failures are explicit, not silent defaults or success-shaped zeros.
  Retry saves the latest local scope after write failure. Invalid ranges retain
  the previous valid data and do not overwrite saved scope. Original rolling
  preset local-subtraction/UTC-serialization boundaries remain unchanged.
- Back history merges with other feature/draft/sort state and restores scope,
  selection and independent reading positions without writing preferences.
  Compact embeds retain ordinary expandable native workload groups, with
  actual disclosure-state chevrons and the same sortable/exportable tables.
  They do not own the window or their parent's contextual history.

### Verification

- 76 scoped Python tests pass across native Workload rendering/provider parity,
  Reports registry/services and the approved Reports directory. Five new tests
  cover full/embed composition, columns/keys, date/export controls, favicons/
  links, topic-linked financial precision, latest-note dates, customer-wide
  engagements, active/closed milestones, seller scope, empty sources and Help.
- 48 JavaScript tests pass (18 Workload and 30 shared sorter). They cover
  deduplication, trimmed name semantics, fractional/
  negative/zero ACR, inclusive/open/missing dates, invalid values/overflow,
  rolling boundaries, saved All, manual presets, changed sort keys, all-topic
  export flags, explicit failures/Retry, Back offsets, history merging and embeds.
  Shared sorter tests cover its actual ordering, row identity and state contract.
- Original/native full live metadata SHA-256 is identical:
  `bd7f4b5e962aa87af0adb2d570e95293adeee663f3ba964c1ef3e37f849b2276`.
  All shows 81 topics, 187 entries, 22 unique names and $210,500/month. Current
  FQ2 is honestly empty. August 2026 gives 22 topics, 32 entries, five customer
  names and $200,000/month, with recalculated topic ACR still descending.
- All 82 live tables pass 816 column/direction ordering checks. A separate
  816 actual heading activations verify direction toggles and ordering.
  The deliberately rapid test-only heading burst triggered Chrome's navigation
  throttling warning; ordinary customer navigation/Back subsequently succeeded.
- Actual customer navigation from Cost Management opens CUSTOMER BANK.
  Back restores topic 18, All scope, ascending ACR, 550px left reading and
  unchanged totals. The actual customer pane fits this desktop viewport and
  has zero offset; nonzero right-offset restoration is unit-tested rather than
  claimed as live overflow.
- Intercepted real exporter output contains CSV and EML downloads with the
  correct filenames/title, 81 HTML tables, 187 customer rows and 187 TPID
  links. It includes unselected topics without sorter-label artifacts; no real
  clipboard write, email send or local download was performed.
- Live inverted dates retain 187 entries and report the previous-valid-scope
  error. An intentionally blocked storage write applies FQ2 locally with Retry,
  then confirms the current scope after recovery. Real F1 Help explains latest
  notes, deduplication and all-topic exports.
- Actual embed has 81 expandable groups, a working state-driven chevron and
  sortable customer grid, all 81 export tables and unchanged totals, without
  navbar/window frame/status. All eight approved themes retain desktop width,
  y=78 surface boundary, footer bottom=1174, legible native date controls and
  complete column labels without document/pane horizontal overflow.
- No analytical routes, business queries, models, new SalesIQ tools or
  dependencies. No live record/server-preference changes, production access,
  protected-draft navigation, push, merge or deployment. The user's original
  absent saved date filter is restored after browser verification.

## Checkpoint 36: Engagement / Milestone Hygiene

Status: VERIFY, technically verified and user-approved October 6, 2026.
Approved predecessor: `70ec157`. Approved overall effort is about 40%.

### Composition and parity

- Fixed native title/export, summary and queue bands surround one continuous
  reading surface. Engagement gaps and milestone gaps are task-specific tabs,
  not an unnecessary split window. Every data column sorts both directions, using
  raw financial, story, customer/status and ISO calendar values. On Team only
  and Group by Seller retain the original storage key, shape and meaning.
- The provider, business queries and remediation endpoints are unchanged.
  Engagement gaps still mean active engagements with no milestone relationship
  at all, including completed relationships. Milestone gaps still mean active,
  customer-owned milestones with no engagements. Seller mode remains
  provider-scoped. The all-team summary does not become the filtered count.
- Original record IDs, customer names, local/MSX links, export URLs, ACR, due
  dates, source-milestone seed metadata and repair action datasets remain.
  Story percentage is now visible as well as graphical. Confirmed reason text
  and story percentage export without save-state/retry or action-button chrome.
- Reason saves are debounced and serialized per row. Concurrent edits coalesce
  without overwriting newer text. Only confirmed snapshots affect annotation
  counts and exports. HTTP, JSON and confirmation failures show Not saved plus
  Retry note. Dirty/busy reasons block repair operations and protect navigation.
- Native dialogs retain Add Milestones, Add to Engagement and Create Engagement,
  including all story fields, status options, native amount/date constraints and
  the existing ability to create without selected milestones. Edited drafts
  require explicit discard; pending writes block closing. Obsolete/aborted
  choice reads cannot overwrite another dialog. Empty existing-engagement
  choices hand off to seeded creation without Bootstrap modal events.
- The shared milestone picker has an opt-in native renderer with in-flow
  scrolling results, combobox/listbox state, keyboard selection and read Retry.
  Source selection survives failed optional reads. Default consumers keep their
  original Bootstrap rendering/request behavior.
- Confirmed repairs read the authoritative embedded report and reconcile both
  queues. Both source collections validate before either is mutated. Existing
  reason/input identities survive; removed controls dispose, new gaps appear,
  stale export URLs are cleared and sort wrappers rebuild around retained rows.
  Failed refresh retries are read-only. An uncertain creation with an unresolved
  source remains blocked rather than automatically risking a duplicate record.
- CSV/Clipboard/Email export both queues regardless of the active tab, respecting
  team filtering. Seller-group headings identify the seller in exported column
  labels. Native plaintext clipboard payload/fallback includes every export
  table; legacy first-table plaintext behavior remains unchanged.
- Back merges/restores queue, team scope, grouping, sorts and reading without
  preference writes. Native reading regions disable automatic scroll anchoring
  so explicit restoration is not shifted by row/table rebuilding.
  Embeds show ordinary stacked labeled regions, without navigation/window/status
  ownership or changes to their parent's report history.

### Verification

- 273 scoped Python checks pass across Hygiene, engagement remediation, reports
  and shared Revenue export/frame contracts. Coverage includes full/embed native
  markup, raw precision/dates, saved annotations, export labels, form constraints,
  seller scope, completed links, inactive/no-account exclusions, real isolated
  link/add/create writes and legitimate creation without milestones. The older
  legacy-frame assertion now excludes the already-approved native Reports hub.
- 77 JavaScript checks cover serialized/latest-wins reasons, failed confirmations,
  deletion, disposal, scope/row schemas, HTTP/JSON failures, atomic reconciliation,
  ambiguous creation recovery, stale choices, discard/write/navigation guards,
  native/legacy picker behavior and clipboard payload/fallback scope.
  Thirty of these are the unchanged shared sorter regressions. Shared dialog
  tests verify opt-in popup Escape ownership before closing a repair; empty
  picker results consume Enter instead of submitting the form. The Help contract
  validates all 55 current routes rather than freezing obsolete release content.
- Original/native live canonical metadata SHA-256 matches exactly:
  engagements `a16c8c40ed47823a302f7a8dc5519d8b1afee38283b0e6941a6b339afadcfca8`;
  milestones `734bf0b6a72b50f294b736fbeb517871aa8ac384ce9992bc178ec8b4f14e07f6`.
  Intentional visible story/retry additions are normalized for comparison.
  The live source remains seven engagement gaps, 938 milestone gaps, 43 on-team
  gaps and zero annotations.
- All six columns pass 204 actual heading activations and ordering checks across
  all/on-team and grouped/ungrouped scopes. Text comparisons normalize whitespace,
  matching the shared sorter's established natural case-insensitive semantics.
  Filter/group rebuilding retains every one of the 945 source rows.
- Actual BL HARBERT navigation and Back restore milestone scope, grouping,
  ascending ACR and the exact 640px reading position. An initial 100px anchoring
  shift was reproduced and corrected before final verification.
- Real CSV/EML and HTML/plaintext clipboard output is intercepted without real
  downloads, clipboard writes or email sends. Both ungrouped tables export all
  50 filtered records. Grouped output exports six tables with the same 50 records
  and all five visible seller labels. Story percentages remain; actions, save
  chrome and sort-direction descriptions do not export.
- Real dialogs load customer choices. CUSTOMER BANK's milestone picker displays
  590 actual options. MANSFIELD OIL's empty engagement list hands off to a seeded
  creation with one selected source milestone. Edited draft cancellation opens
  the explicit discard dialog; confirmation closes without a record write.
- Live embeds show both ordinary regions, all 945 source rows and actual Help,
  without navbar/window/status chrome or report-history mutation. Eight approved
  dark/light themes retain the 1724px desktop width, native token colors, complete
  column labels and no document horizontal overflow. A successful foreground
  screenshot verifies the real full-page composition.
- No analytical/provider changes, new models/migrations/tools or dependencies.
  No manual live record/server-preference changes, production access,
  protected-draft navigation, push, merge or deployment. Original local scope
  `{"onlyOnTeam":true,"groupBySeller":false}` and test sort/reading state are restored.
  User approved Hygiene October 6, including the following visual-review refinements.

### October 6 visual-review refinement

- Fix is a plain, non-sortable action heading in both queues and every rebuilt
  seller table. Data columns retain both sorting directions. Previously saved
  Fix sorts reset to source order without changing other sorts or Back context.
- Full/embed rendering and table-rebuild regressions explicitly verify five
  sortable headings plus the plain Fix heading. The original 204-activation
  evidence above predates this intentional action-column exception.
- The inherited export separator is removed only in the Hygiene header. There
  are no commands after Email here; Revenue toolbars retain their useful divider.
- Hygiene is committed locally as `9195a2c8`. Approved effort remains about 40%.

## Checkpoint 37: What's New

- Status: VERIFY, technically verified and awaiting user visual review.
- Composition: a continuous desktop activity workbench with Created and Updated
  beside each other, independent reading regions and fixed commands/scope/status.
  The two lists are comparisons, not a selector/detail pattern or decorative cards.
- Existing provider, MSX/local timestamp precedence, seller-mode default and DSS
  presentation are preserved. Incomplete creation metadata can legitimately put a
  milestone in both lists; counts describe entries rather than deduplicated IDs.
- Seven lookback presets retain the 1-90 day clamp. A non-preset URL such as five
  days has an honest selected option. Last 24 hours replaces the misleading Today
  label without changing the rolling query. Empty text names the actual window.
- Seller, area and team intersect across both lists. Saved ungrouped and empty
  change-type selections work. Native seller/customer details retain original
  collapse keys, filter-match counts and expanded-only export scope.
- Audit labels still come from all cached history. Subset filtering affects
  Updated only; its date becomes the latest matching audit, even before the
  lookback. All types restore the milestone date. Calendar text, tooltip and raw
  date sort keys change together without local-time date shifts.
- All five data columns sort in both directions. On Team is boolean membership,
  not alphabetical action text. Full-precision ACR and calendar keys remain.
  Explicit source ordinals preserve provider chronology across group rebuilds
  and pre-mounted historical sorts. The old malformed Updated six-cell row is
  corrected to five matching cells.
- Native join/leave dialogs require confirmation. Only confirmed responses
  update every occurrence, raw membership sort keys, export booleans, filter
  counts and action labels. Pending writes protect closing/navigation. Explicit
  rejection can be retried manually; uncertain responses remain blocked with an
  MSX review link, without automatic duplicate requests.
- CSV/Clipboard/Email retain both lists and section/seller/customer context.
  JSON-safe shared export configuration fixes apostrophes and quoted values
  without changing legacy export scope. No trailing divider follows Email.
- Storage read/save and history failures are explicit. Failed lookback saves
  leave the existing window and selected value intact, with Retry lookback.
  Back merges report state with shared sort state and restores both reading
  positions. Embedded lists stack without navigation/footer/window ownership.

### Verification

- 218 scoped Python checks, followed by 10 final focused checks, cover native full/embed markup, all five cells/columns,
  stable source ordinals, raw precision, links/booleans, MSX precedence/local
  fallback, overlap, all-history/latest audits, actual clamped/custom windows,
  seller defaults, DSS rendering, Help and shared export consumers.
- 85 JavaScript checks cover intersecting scopes, Updated-only type semantics,
  audit fallback/reset, calendar/time validation, legacy preference schemas,
  lookback range, all-occurrence membership reconciliation, serialized confirmed
  writes, explicit rejection and uncertain-response suppression. Shared sorter,
  dialog, picker, Hygiene and native/legacy clipboard regressions remain scoped.
- The live fourteen-day report retains 296 Created and 180 Updated records.
  Initial original/native canonical record metadata SHA-256 matches exactly:
  `11ce3ad38102305ae8f1486a6e3ec49034b325b19384720aa68a1b8779d6e80b`.
  The final live projection is `14bcb85f2fa54dc22b86da818c19f91b59d6e7fc31db027c143d3402f2de5481`
  with the same counts. The live source is not frozen across navigation/time
  checks; source semantics and output fields also have isolated regressions.
- 1,110 actual heading activations verify both directions of every column across
  all 109 grouped tables and both ungrouped tables, with zero ordering failures.
  Eight intersecting filter/type scenarios match expected IDs, counts and audit
  date keys. On Team yields 0/24; Off Team 296/156; Title 296/142; no types 296/0.
- Collapsing the five-entry first seller leaves counts 296/180 while exportable
  rows drop from 476 to 471. Confirmation opening/canceling does not change
  scope or checkbox state. Actual CSV/EML and clipboard payloads are intercepted:
  109 tables, 476 data rows and 476 retained MSX links, with proper What's New
  title and no action/sort instructions. Nothing downloads, sends or replaces
  the user's clipboard during testing.
- Browser-intercepted membership responses exercise confirmed success, explicit
  rejection and network uncertainty. Success removes the source from On Team
  and changes 24 to 23; the server remains on-team, proving no real write.
  Rejection remains retryable; uncertainty blocks a second request.
- Real milestone navigation and Back restore 640px/700px offsets, counts
  296/142, selected Title, ascending Created ACR, descending Updated date and
  identical first-five record orders. Native Help opens with the correct page
  content. Menu Escape events close and restore summary focus; this browser
  harness's physical key method emits no DOM key event, so that method cannot
  verify keyboard delivery.
- Actual lookback navigation changes fourteen-day counts 296/180 to three-day
  counts 41/32, then Back restores fourteen days and 296/180. Fresh visits restore
  the saved three-day preference without adding a redirect loop. A retained
  pending select value initially disagreed with the restored source window;
  immutable server window metadata and resetting it before navigation/after
  restoration fix this, with a focused control regression.
- Deliberately intercepted preference/history failures show explicit notices,
  valid current scope and successful recovery. Eight approved theme token pairs
  retain the 1724x1174 desktop frame, 889px reading regions and zero document
  overflow. Five-day source checks initially return 235 records; the later
  actual embed renders 231 as the rolling cutoff advances, without window chrome
  or report-owned history.
- No provider/model/migration/tool/dependency changes, manual live membership
  writes, production access or protected-draft navigation. No push, merge or
  deployment. This checkpoint remains uncommitted pending visual approval.
  Original fourteen-day local preferences, empty collapse state, unsaved day
  preference, default source ordering/reading, Graphite Dark and empty test
  history are restored for review.
