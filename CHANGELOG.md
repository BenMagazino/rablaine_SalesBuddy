# What's New in Sales Buddy

Recent updates and improvements, newest first.

## 2026-04-29

- Rewrote milestone sync for a big performance boost (roughly 3-4x faster). Updated how we actually sync from MSX:
  - Opportunities: now scoped to the current Microsoft fiscal year through the next FY (a ~24-month window), plus any opp with no close date set. Previously we pulled all open opps regardless of close date but skipped recently-Won / Lost ones - now those come back too while their milestones still matter.
  - Stale milestone refresh: any local milestone that wasn't returned by the active sync (out-of-window, closed opp, etc.) is now refreshed in batches by milestone GUID directly, instead of round-tripping through the parent opportunity one at a time.
- Sync progress bar now reflects actual time spent per phase so it stops sitting at 82% for half the run.
- Cache-bust the changelog fetch so the Updates card shows new entries right after a push instead of waiting for GitHub's CDN to expire.

## 2026-04-28

- Add changelog viewer to admin Updates card so you can see what's new before and after applying an update
- Remove dead "Committed to bottom" toggle from U2C report (the toggle never did anything because committed and remaining milestones live in separate tables)

## 2026-04-27

- Fix Import Attendees getting stuck in "ready" mode after a failed scrape
- Stop milestone sync from re-marking completed milestones as stale
- Add DSS opportunity comment writeback option when creating notes.  Disabled by default, change in Settings.

## 2026-04-24

- Calendar columns now equal width with proper text truncation so long meeting titles don't break the layout

## 2026-04-23

- Add stale customer report broken down by territory and seller
- Show calendar sync icon when hovering a date so you can refresh just that day
- Improve meeting picker UX consistency and add ghost highlight styling
- Use the daily meeting cache for past-day meeting imports (faster, no live MSX call)
- Make scheduled task failures show up in the admin panel instead of silently failing
- Improve customer matching by trying the first token of the customer name
- Fix WorkIQ parser when meeting subjects contain pipe characters
- Fix a bug where ghost-aura sync was wiping calendar days

## 2026-04-22

- Add morning aura sync that prefetches the day's meetings on app start, with calendar dots showing which days have synced
- Add surgical per-day refresh so you can re-sync just one day from the calendar
- Note form now waits for ghost-aura before showing meeting picker so you don't see stale data
- Add WorkIQ failure telemetry to App Insights for diagnosing scrape issues
- Fix ANSI escape codes corrupting WorkIQ scrape output

## 2026-04-21

- Notes list now paginates so it loads fast even on customers with hundreds of notes
- Customer JSON backup now runs async, so saving a note no longer blocks for 20-60 seconds
- Fix SQLite lock contention during the async backup
- Auto-paste contact avatar after creating a new contact

## 2026-04-17

- Add offline page that explains what's happening when the network drops
- Daily 7AM meeting cache job (closes #120)
- MSI auto-launch and salesbuddy:// protocol handler

## 2026-04-16

- Batched milestone sync and improved opportunity sorting

## 2026-04-15

- WorkIQ status card is now draggable so you can move it out of the way

## 2026-04-14

- Use project title instead of topic name for general note calendar labels (cleaner display)
- Fix installer git detection so reinstalls work cleanly

## 2026-04-13

- Revenue import improvements (better matching, fewer false negatives)

## 2026-04-12

- Remove revenue engagements (replaced by direct revenue tracking)
- Revenue analyzer refinements
- Stale milestone improvements

## 2026-04-10

- Preserve milestone status during stale opportunity sync (no more accidental status drops)
- Fix Enter key in engagement contact dropdown
- Day-normalize MoM/CV calculations in revenue analysis for more accurate trend detection

## 2026-04-09

- Add Recently Viewed entities so you can jump back to where you were (closes #85)
- Fuzzy matching for customer domains
- Inline contact creation from forms (no more modal jump)
- New Action Items hub page
- SalesIQ MCP improvements: new tools, URL linking, milestone filters, system prompt hints

## 2026-04-08

- Action items now have due dates and a calendar tab (closes #116)
- Convert key individuals to engagement contacts so they get the full contact treatment (closes #114)
- Prefetch WorkIQ meetings on note page load for faster meeting picker (closes #117)
- Customer M&A handling: detect stale customers and provide a merge tool (closes #41)

## 2026-04-07

- Auto-add partner from attendees: partner contacts in a meeting auto-link their partner to the note
- Fix duplicate task creation when saving a note with an existing task linked
- Committed milestones no longer show overdue styling and countdown text
- Task improvements: modal chaining, workload filter, back-to-milestones button
- New Connect Impact report ranked by committed ACR/mo
- SalesIQ chat now renders markdown tables
- Split U2C% and Attainment% into separate cards for clarity
- Action item description now opens in a Quill rich-text flyout

## 2026-04-06

- Engagement AI fields, dynamic note form layout, related notes, engagement badges
- Inline editable engagement panels on note form (#113)
- Action item flyout description field with click-to-edit badges (closes #112)
- U2C snapshot report for quarterly milestone attainment tracking (closes #32)
- Add CSAM, DSS, and DAE stats to account sync summary
- Add Marketing Insights to Reports nav menu
- Marketing insights sync and report
- Table paste support in rich text fields

## 2026-04-05

- Fix PWA install card race condition that hid the install prompt
- Add Opportunities and Milestones to Browse nav menu
- MSX workspace report now has seller filter and calculated ACR

## 2026-04-04

- Native MSI installer v1.0.0 (resilient install/uninstall, idempotent)
- MCP server for VS Code Copilot integration

## 2026-04-03

- Switch AI to Azure Management JWT auth, removing the consent flow and ai_enabled toggle
- Add Internal Contacts (model, UI, MSX sync)
- Rename "call logs" to "notes" throughout the app
- Rename "Copilot" to "SalesIQ" throughout the app

## 2026-04-02

- SalesIQ Phase 4: tools registry, chat panel UI, chat endpoint with tool-calling
- Manual Milestone Sync button in admin panel (closes #105)
- Sign MSI with Azure Artifact Signing for trusted installs
- Fix attendee modal backdrop stacking on retry/cancel (closes #109)
- Partner scrape: append notes instead of replacing, detect WorkIQ server errors (closes #107)
- Detect SYSTEM-owned backup task in admin panel (closes #106)

## 2026-04-01

- Customer names in exports now link to TPID URL
- Remove Quick Actions panel from analytics (closes #93)
- Reports route cleanup with consistent header standardization (closes #94)
- AI partner recommendations for engagements
- Commitment status filter on milestone tracker (closes #90)
- Add help icon to navbar (closes #98)
- Configurable date range for What's New report
- Whitespace bucket drill-down (closes #92)
- Dismiss and "not useful" feedback on SalesIQ task suggestions (closes #96)
- Specialties selector keyboard behavior consistency (closes #102)
- Delay revenue import reminder to the 10th of the month
- Fix duplicate project dropdown and JS errors on general notes
- Fix territory-to-POD parsing for suffixed names (closes #104)
- Fix comment posting in milestone modal (closes #103)

## 2026-03-31

- Favorites for milestones, engagements, and opportunities (#86)
- Milestone tracker multiselect filters
- Milestone tracker "lost" hygiene status
- Workload report ACR deduplication
- Contact photo support
- Contact scraper for meeting attendees

## 2026-03-30

- New What's New report
- Make What's New collapsible
- Light mode visual improvements
- Milestone view shows all statuses
- Edit partner contacts inline
- Milestone audit trail (see who changed what when)
- Milestone team hint and on-team badge so you know which milestones are yours
- One-on-one report reorganized
- Fix PWA navigation and cancel-button referrer behavior
- Fix milestone dropdown overflow

## 2026-03-29

- Keyboard shortcuts throughout the app
- Branding update
- MSI installer fixes and OS theme detection
- Milestone calendar tabs
- Fix dirty working tree handling on reinstall
- Suppress git credential popups during update
- Fix NuGet Python PATH detection during install

## 2026-03-28

- New Whitespace report
- Milestone sync scheduler with MWF schedule and startup catchup
- Navbar customer search with `/` keyboard shortcut
- UX navigation overhaul
