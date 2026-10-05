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
ready for checkpoint commit. Approved predecessor: `aaf6cfd`. Approved progress
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
  graph and width refinements. Commit this slice, then migrate the Products directory.
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
