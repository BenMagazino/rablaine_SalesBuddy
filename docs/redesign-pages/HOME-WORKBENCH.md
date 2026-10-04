# Home workbench composition and attention panels

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
- Checkpoint 21 is approved for commit. No push, merge or deployment.

### User checkoff for checkpoint 21

1. Revenue Analyzer: click an alert row away from its links/pencil. Its large
   window should now match Home's approved workbench preview. Open the pencil,
   then Escape back to the large window.
2. Seller page: Revenue -> Full View -> click an alert row. Close its large
   preview and confirm Full View returns instead of dropping you to the page.
3. Optional: the seller revenue alerts full page uses that same native preview.
   No real review save or manufactured network failure is needed.
