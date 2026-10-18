<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="static/logo-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="static/logo.svg" />
    <img alt="Sales Buddy" src="static/logo.svg" width="500" />
  </picture>
</p>

A local-first productivity tool for Azure solution engineers and technical sellers. Unified customer views, call notes, revenue trends, milestones, and partner tracking - all in one place, running on your machine.

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-50fa7b)

## Download

**[Download Sales Buddy Installer (Windows)](https://github.com/rablaine/SalesBuddy/releases/latest)**

The MSI installer handles everything: prerequisites (Git, Python, Azure CLI, Node.js), repo clone, environment setup, scheduled tasks, and server startup. Just run it.

## Features

Daily Copilot suggestions accept either JSON or numbered WorkIQ follow-ups,
including their context and source links. A numbered-list fallback does not
repeat the WorkIQ call. If neither format can be parsed, existing suggestions
remain unchanged.

Milestone scheduling and Admin use the shared sync completion status. A manual
attempt completed that day counts toward the Mon/Wed/Fri schedule, even if it
ran before the configured time. Failed attempts do not cause repeated retries
that day, while interrupted attempts can catch up. Queued or running milestone
work is not duplicated, and the existing schedule and automatic-sync setting
remain unchanged.

On customer pages, desktop windows at least 1712px wide add a 320px History rail
without shrinking the existing 1344px dossier. It follows window width automatically;
compact windows retain the original layout. Hover or focus an event for a preview,
then select it to open its record. History includes call notes, engagement creation,
opportunity creation/closure, and creation/commitment/completion dates for milestones
where you are on the team. Gaps reflect elapsed time, with long gaps compressed.
This is recorded activity, not a complete audit trail. Opportunity source dates
populate through the existing MSX sync or detail refresh, never from local import
timestamps. Older events load on demand. A compact-window flyout is not included yet.

Press **Ctrl+Space** anywhere to open the Quick Launcher. Type any part of a page
or report title, then press Enter to open the first match, or use Tab and arrow
keys to choose another. Escape closes it and returns you to your work.
The launcher follows the current navigation menu and includes Home and Sync Status.

A logo-green light with a fading trail travels along the menu/toolbar divider
to acknowledge page navigation and foreground action requests without blocking
the current page. It stops when the destination page appears rather than replaying
during that page's initialization. Its glow straddles the divider; routine background
polling stays quiet. Light mode adjusts the green for contrast, and reduced motion uses
a stationary line instead.

Settings > Appearance also provides a page-local comet preview and a 10%-100%
brightness slider. Preview does not change the global on/off preference and ends
when you leave Settings. Brightness updates live while dragging and saves on
release for use throughout the app, including after a restart.
The indicator is enabled by default. Turn **Settings > Appearance > Page loading
indicator** off or on to change it immediately; the choice persists across restarts.

Regular data syncs share a durable SQLite job queue and a separate local worker.
Open **Admin Panel > Sync Status** to start a sync, inspect measured progress,
see worker availability, or start a new run after a failure. Closing the browser or leaving
the page does not cancel an accepted job. Compact rows show automatic schedules,
last status and success, with run diagnostics on hover or keyboard focus.
Reopening the console reads the same saved job. Unknown-duration source queries
use an indeterminate bar rather than
invented percentages. Last successful refreshes remain visible after failed runs.
Independent sync groups fetch concurrently; conflicting runs wait with a named
blocker, and background database transactions take turns. Live progress and
heartbeats use atomic local JSON files beside the database, so a long save cannot
hide status. If your own save waits behind a sync, a notice explains who is saving
and stays until the request finishes. Keep that page open; a failure remains an
explicit failure, not a promised automatic save.

`scripts\dev.ps1 start` launches Flask and the worker with the same development
database and Azure credentials, and restarts a crashed worker. Installed apps use
the existing process supervisor. Queued jobs remain saved while a worker is
unavailable. Safe transient failures have bounded retries; other failures require
a new manual start. Quitting the backend or shutting down the computer interrupts
execution, not the saved job history. Destructive FY/restore, uploads, backups,
interactive record edits and continuous sharing subscriptions are outside this
Sync Status page.

Calendar day refreshes and the automatic morning meeting sync share durable
per-date progress. Reloading Home or navigating between months restores queued
and running indicators without starting another sync. Each saved day redraws
after its cache is committed; failed dates retain their cached meetings and show
an explicit error. Morning sync fetches up to five dates in parallel, saves them
serially, and remains the only refresh path that purges expired meetings.

The Windows desktop title bar follows the saved theme and Light/Dark appearance,
including changes made in Settings without a reload. The theme-matched menu strip
opens the existing Windows-native File/Edit/View/Window/Help dropdowns and keeps
Back/Forward actions and keyboard shortcuts. Once a dropdown is open, moving
across the menu headings switches dropdowns without another click or a hover dwell.
Only the open menu stays highlighted while switching.
Clicking a menu heading while a dropdown is open collapses it.
The title and menu are mounted before the page's first paint so navigation
does not briefly expose content underneath the window controls.
Local styles, scripts and other template-linked assets use content-versioned
URLs, so pages reuse unchanged files while edits and updates refresh them automatically.
This requires the theme-aware Electron shell build;
browser usage is unchanged.

GPU rendering stays enabled by default. If desktop window dragging lags on your
machine, uncheck **View > Use GPU Rendering** to try software rendering instead.
Save unfinished work, then choose **Restart Now**, or choose **Later** and fully
quit and reopen Sales Buddy when convenient. Reloading a page or closing the
window to the tray does not apply the change. The preference is saved locally
for that desktop shell profile, not in your notes database. Re-enable the same
checkbox to switch back. Software rendering shifts rendering work to the CPU
and may perform differently on heavier pages. This control requires the updated
desktop shell; browser rendering is unchanged.

The desktop app remembers the last-focused window's size, position, and maximized
state across full restarts, updates, and shell rebuilds. Restoring a maximized
window returns to its previous normal size. Additional windows open with a small
cascade offset, and saved windows are fitted to an available monitor if your
display setup changes. First launch targets a centered 1600 x 1000 DIP window,
limited by the display's usable work area.

Window geometry is stored in `window-state\state.json` under Electron's local
user-data directory, outside the installation and notes database. The development
shell uses its separate profile. Start-minimized and tray behavior are unchanged.
This requires the updated Electron shell; a browser reload does not apply it.

For desktop shell development, start the live backend with `scripts\dev.ps1 start`,
then run `electron\node_modules\electron\dist\electron.exe electron --dev-client`.
Client-only mode connects to port 5000 with a separate shell profile. It leaves
the existing backend and production app alone, disables update/restart commands,
and exits when its last window closes.

Browse the [offline design-study archive](design-studies/index.html) for twelve
standalone UI iterations using entirely fictional data. See the
[archive guide](design-studies/README.md) for validation and capture instructions.

- **Native desktop workbench** - application-owned layouts, browser defaults, controls and Graphite, Midnight, Harbor and Carbon dark/light themes replace the Bootstrap UI framework. Choose your theme in Settings > Appearance; the palette saves independently of the Light/Dark switch and follows you across pages and restarts. Independent Bootstrap Icons remain. Shared shortcuts respect guarded editors and dialogs, and closed overlays do not consume the reading area. Ctrl+Enter saves notes from the rich-text editor through the normal Save button, including validation and pending-save guards.
- **SE specialty preference** - Settings > SE Mode lets you choose Data SE, Infra SE, Apps and AI SE, or Other. The choice saves immediately, defaults to Data SE, and survives backups and switching modes. Data SE enables the customer Fabric tab and weekly Fabric 360 refreshes.
- **Customer dossier** - native Engagements, Notes, Opportunities and Revenue tabs keep full account identity, ownership, contacts, relationships and rich notes. Commands and counts stay visible, data headings sort raw values both ways, and Back restores the selected tab, pipeline search and reading context. Account context and contact edits remain manual with protected drafts; original photo paste and Auto-fill saves remain explicit.
- **Opportunity detail** - native standalone and MSX Workspace previews share complete cached/fresh details, linked milestones and original forecast editors. Read-only opening updates the local MSX-detail cache, not remote team or business records. Milestone headings sort raw values; Back retains reading and sorting. Comment/team/favorite writes remain explicit, with protected drafts, pending guards and honest failures.
- **Notes directory** - a native chronological stream keeps original customer identity, local call dates, excerpts and every relationship link. All/Customer/General filters retain seller scope; page size is remembered locally and pagination preserves scope. Commands, displayed range and total stay visible, and Back restores reading position. Shared previews retain the canonical rich note body.
- **Native note workspace** - customer and general editors retain Quill, calendar imports, linked work and explicit saving. Edit drafts use separate note keys, and unchanged editor navigation does not replace creation drafts. Nonmodal context drawers work alongside SalesIQ; nested reviews remain modal. Standalone reading uses the shared wider frame while previews stay shell-free.
- **Fill My Day** - select a date and explicitly fetch external meetings, customer matches, WorkIQ summaries and AI enrichment. The native review keeps note HTML, topic toggles, matched milestone context, task fields and per-note saves. Task creation writes to MSX immediately; note saving remains separate. Back restores the review without repeating requests, unmatched meetings sort in their disclosure, and failed requests retain review entries for retry.
- **Note Templates** - create and edit reusable rich-text content in native manual forms with persistent formatting and save commands. Original name/content fields, formatting and Settings/default associations remain intact. Cancel protects drafts, Back restores content and editor context, and failed saves retain entries for retry. Note insertion still supports Replace or Add to top; executable markup is removed at display boundaries without rewriting saved template HTML.
- **Search Notes** - persistent native controls keep the original note-content substring search and customer, seller, territory and any-selected-topic filters. Results retain seller/customer grouping, excerpts and links; empty searches retain recent history, and Back restores controls and reading position. Search submits explicitly by GET, Clear Filters preserves seller-mode scope, and no date filters, relevance ranking, paging or exports are added.
- **Sellers directory** - compact native Growth/Acquisition records preserve every seller, territory, email alias and customer count. Expand records to read linked customers and sort Name or Latest note; Back restores expansion, sorting and reading position. New Seller and the existing role-dependent View as command remain explicit.
- **Seller forms** - native New/Edit identity and coverage fields retain name, email alias, seller type and multiple territories. Manual Save/Cancel stays visible, navigation guards unsubmitted entries, Back restores the draft and failed saves retain input. Creating an inline territory still saves immediately; use Back to recover unsaved seller entries.
- **Seller coverage** - native Milestones, Revenue and Engagements tabs retain all customer coverage, latest notes, territories, PODs and original commands. Compact milestone scope and the complete seller-locked tracker stay distinct; shared milestone and revenue previews preserve their full nested workflows. Data headings sort raw values both ways, and Back restores each reading region.
- **Territories directory** - compact native rows retain all territories, linked PODs and sellers, direct customer counts and territory-scoped New Customer commands. Sort Name, POD, Sellers or Customers both ways; Back restores sorting and reading position without changing the original alphabetical default.
- **PODs directory** - compact native roster rows preserve all PODs, territory and SE counts, unique sellers and assigned solution engineers. Sort each data heading both ways; open the original POD details from the name or row, with sorting and reading position restored on Back.
- **Internal Contacts directory** - compact native rows retain all Microsoft contacts, aliases and roles, with the original New/Edit destinations. Sort Name, Alias or Role both ways; Back restores sorting and reading position. Delete uses explicit native confirmation and retains original records if saving fails. No role-based filtering is added.
- **Specialties directory** - compact native rows retain all specialties, original descriptions, complete partner counts and New/detail/Edit links. Sort Name, Description or Partners both ways; Back restores sorting and reading position without changing the original database name order or saved preferences.
- **Specialty details** - native partner rows preserve the full description, partner links and contact/note counts. Sort Name, Contacts or Notes both ways; Back restores reading and sorting. Native deletion requires confirmation, preserves partners and their records, and rolls back associations on failure.
- **Specialty forms** - native New/Edit forms preserve required name, optional description and manual Create Specialty/Save Changes. Names remain unique ignoring case, partner associations stay unchanged, drafts restore on Back, and validation or failed saves retain entries for retry. Partner quick creation remains a separate immediate save.
- **Topics directory** - compact native rows retain all topics, descriptions and all-note counts. Sort Name, Description or Notes both ways; Back restores sorting and reading position. Default explicitly saves the original alphabetical or most-notes ordering, with honest failure recovery. New Topic and detail links are unchanged.
- **Topic forms** - New and Edit retain the original name and optional description with explicit Save Topic. Native draft guards and Back restoration protect manual entries; failed saves retain input for retry. Empty descriptions no longer appear as the text "None".
- **Partner forms** - New and Edit retain name, website, specialties, optional rating and notes with manual Create Partner/Save Changes. Draft and pending guards protect entries; failed saves retain input. Creating a specialty saves it immediately, independently of saving or cancelling the partner. Contacts remain on Partner Details.
- **Partner details** - Native connected regions retain partner notes, rating, specialties, contacts and linked notes with independent sorting and Back context. Contact add/edit saves manually with guarded drafts and retained failures; primary selection and photos save immediately. Meeting auto-fill keeps domain save, search, selectable review, edited notes, explicit import and retry, alongside existing native sharing.
- **Topic detail** - read all tagged notes across dates and roles in a native workbench, with original previews, full description, counts and every customer/seller/territory/topic/partner link. Sort meaningful data both ways; Back restores sorting and reading. Native deletion removes only the topic, with confirmation and rollback on failure.
- **Partners directory** - compact native rows retain every partner, rating, specialty and contact/note count. Sort all five data headings both ways; Back restores reading and sorting. Original creation, specialty and detail links remain. Shared native teammate and import-review dialogs preserve explicit recipient acceptance, complete preview groups and selection controls, with cancel protection and retryable, atomic failed imports. No linked customer notes or contact photos are added to sharing exports.
- **Internal Contact forms** - native New/Edit forms preserve required name, optional Microsoft alias and free-text role suggestions. Persistent manual Save/Cancel, guarded drafts and Back restoration protect unsubmitted work. Validation and save failures retain entries; duplicate creation still opens the existing contact. Edit deletion has its own explicit confirmation and POST.
- **Solution Engineers directory** - compact native rows preserve every engineer, email, specialty, POD assignment and existing Edit destination. Sort Name, Email, Specialty or PODs both ways; Back restores sorting and reading position. Unassigned engineers remain visible, with no new creation workflow.
- **Edit Solution Engineer** - the native manual-save form preserves name, email alias, specialty and POD checkboxes. Save/Cancel stays visible; unsubmitted fields and selections restore on Back, navigation guards protect drafts, and validation or save failures retain input for retry. Direct territory assignments and MSX sync remain unchanged.
- **Solution Engineer detail** - compact identity and connected coverage cells preserve assigned PODs, unique POD-derived territories and their full customer counts. Data headings sort both ways and Back restores reading context. Original email, Edit, POD and territory links remain; native deletion confirmation starts on Cancel and failed deletes preserve the record.
- **Edit POD** - native territory-scoped specialist assignments preserve MSX-managed identity and coverage. Choices keep their existing immediate-save API; failed saves retain input and offer Retry, pending saves guard navigation, and Back restores drafts without saving them. No New POD workflow is introduced.
- **POD coverage** - native coverage and technical-reading cells retain territory/customer counts, unique sellers, POD engineers and territory-scoped specialists. All record data headings sort both ways; Back preserves sorting and disclosure. Unselected specialist choices save through the existing API, with explicit retry and guarded failed drafts.
- **Territory forms** - native New/Edit naming forms preserve the alphabetical duplicate reference and existing coverage relationships. Manual Save/Cancel stays visible; guarded entry-local drafts restore on Back, and validation or save failures retain your input for retry.
- **Territory coverage** - the native seller roster sits beside scoped Accounts or Recent Notes reading. Accounts retain Growth/Acquisition seller ownership and lifetime note counts; Recent Notes retain direct customer territory and the last seven days. Data headings sort both ways, Back restores independent reading and sorting, and the explicit view preference saves only when changed. Existing links from note previews, customers, sellers, PODs and SEs open the same territory.
- **Customers directory** - native sortable customer rows preserve saved A-Z, seller grouping and note-count order, note filtering, favicon identity and scope. Commands stay visible, Back restores reading and expanded groups, and TPID import remains explicit with guarded unsubmitted input.
- **Customer forms** - native New/Edit account identity and ownership fields retain required name/TPID, optional metadata, seller mode and primary CSAM choices. Manual Save/Cancel commands stay visible, entry-local drafts guard navigation, and failed saves retain input without autosaving or changing enrichment providers.
- **Call Notes** - rich text editor with topic/seller/customer tagging, templates, and meeting import
- **Revenue Analyzer** - automatic MSXI sync, trend charts, growth alerts, seller/customer/product drill-downs
  - Sync combines source groups that share a normalized customer/bucket/product/month
    key, preserving their total revenue. Groups spanning different TPIDs remain
    unlinked rather than being assigned to the wrong customer.
  - Failed revenue writes retain the previous imported snapshot.
- **Strategic pillar whitespace** - compare customer adoption across AI, Analytics,
  Apps, Databases, Developer, Infra and Security using MSXI's `SuperStrategicPillar`,
  not an inferred service-bucket mapping. The regular ACR import also saves
  pillar/product/month revenue, without changing Revenue Analyzer's bucket data.
  Existing installations need one revenue import to populate this data. Grid
  averages retain the latest three imported months; reverse lookup and penetration
  retain historical positive-spend coverage. Product previews use the same official
  pillar classifications, with recent revenue and full monthly history.
- **Fabric Consumption** - import customer-scoped Fabric workload CU-hour
  shares and capacity/SKU utilization from MSXi. Reports > Fabric Consumption
  includes capacities, throttling, utilization history, and customer-wide reserved-instance
  versus PAYG revenue with fiscal YTD totals and monthly splits. Revenue share is not
  per-capacity reservation coverage. Import uses customer
  TPIDs and your corporate Azure sign-in. In SE Mode with Data SE selected, a full
  refresh runs weekly with on-boot catch-up, independently of milestone auto-sync.
  Failed or interrupted overdue imports retry after an hour, retaining the last good
  snapshot. Other specialties and DSS Mode do not sync automatically. Data SEs also
  have a Fabric tab on each customer with the same workload, capacity and revenue
  details, loaded from saved data only when the tab is opened.
- **P to F** - Reports > P to F imports Power BI Premium renewal details and the
  published Fabric migration assessments, with customer names matched by TPID and
  full expiration dates. Matching rows also appear above Fabric 360 on a customer's
  Fabric tab, even when that customer has no consumption snapshot. The report has
  a shared Fabric 360 refresh and progress indicator. One job updates workloads,
  capacities, revenue and renewals. Startup and weekly catch-up refresh both if
  either snapshot is stale or missing, only in SE Mode with the Data SE specialty. Source statuses,
  blank amounts and percentages above 100% are preserved. See [P to F](docs/p_to_f.md).
- **Milestone Tracker** - native desktop queue and calendar with MSX sync, task management, and AI matching from call notes. Search all saved milestone fields (including cached forecast comments) and use the searchable customer dropdown alongside the existing filters. Data headings sort both ways with raw values; CSV, Clipboard and Email preserve the filtered list. Back restores filters, view, calendar month, sorting and reading position.
- **Milestones directory** - browse customer-linked records in the native desktop frame, preserving newest-added order, source URLs and linked-call counts. Sort each data heading both ways; Back restores sorting and reading position. Open the existing details, New Milestone or Milestone Tracker without changing the cached data.
- **Internal project forms** - create or edit internal work with the original title, plain-text description, type, due date, edit-only status and eligible general notes. Native Save/Cancel commands stay visible; guarded entry-local drafts and failed-save input retention protect unsubmitted work without autosaving.
- **Project dossier** - read descriptions, dates, local follow-ups and linked notes in the native frame. Commands and task entry stay visible; Back restores reading context. Initiative Tracker uses the same complete body and guarded native task preview/editor, with failed task additions retained for retry.
- **Manual milestone forms** - create or edit an MSX URL and optional display title in the native desktop frame. Persistent Save/Cancel commands, visible validation/save errors and guarded unsubmitted changes preserve your work without autosaving or changing MSX.
- **Engagement forms** - write the story beside the customer's existing notes, opportunities and milestones, with persistent Save/Cancel and protected unsubmitted changes. Failed saves retain fields, people and selections. Existing-person selection stays in the draft; adding a new customer/internal contact still saves that person immediately.
- **Milestone details** - read linked work and forecast comments in independently scrolling native regions with persistent MSX/Edit/Delete commands and a compact read/save status rail. Back restores both reading positions; unsaved drafts and pending saves remain protected. Embedded previews retain the same canonical body without the standalone shell.
- **Action Items** - a native divider-separated dashboard preserves engagement, saved/generated Copilot and project tasks across the top, with hygiene beside a wider stale milestone cell below. Each cell scrolls independently. Project task rows open the preview/editor, with separate project links and sorting limited to surfaced fields. Hygiene sorts by Name or Customer. Back restores seller scope and every cell's reading position. Existing source links and task edit/completion workflows remain available.
- **Action-item ordering** - engagement and project detail views default to earliest due date,
  with undated items last and completed items after open work. Use Order to reverse the date
  sort or select Manual order, then move open tasks with the arrow controls. Engagements also
  support dragging the grip in Manual order. Each detail view remembers its selected sort;
  manual positions are saved with the tasks and survive refreshes.
- **Engagement directory** - a native desktop list retains the complete engagement population, seller/customer grouping, status and favorite filters, story health, dates, ACR and linked-work counts. Commands stay visible while the directory scrolls; Back restores filters, order and reading position. New Engagement uses the existing customer picker; creation, rich editing and full detail retain their existing workflows.
- **Engagement dossier** - the complete story and relationships sit alongside follow-ups and notes in native reading panes. Full pages and action-queue embeds share guarded rich task editors, original APIs and retained failed-save entries; note and shared task editors preserve rich descriptions too.
- **MSX Workspace** - browse cached opportunities, milestones and open tasks in native
  tabs with independent reading regions, raw-value column sorting and restored scope
  on Back. Applied filters are saved in localStorage for reloads and new report windows;
  task drafts and reading positions stay local to each window. Existing MSX details,
  forecast comments, team actions and task workflows
  remain available; failed task creation keeps the draft for retry.
- **AI Assistant** - auto-suggest topics, match milestones, analyze calls, generate Connect summaries (Azure OpenAI)
- **WorkIQ Integration** - import Teams meeting summaries directly into notes
- **Partner Management** - directory with contacts, specialties, and real-time sharing between instances
- **Connect Export** - structured self-eval summaries over date ranges with per-customer breakdowns
- **Global Search** - full-text across notes, customers, sellers, topics, and territories
- **Analytics Dashboard** - activity heatmap, engagement trends, top topics and customers
- **Custom Dashboards** - Saved dashboards appear by name in the top-level
  Dashboards menu and the Quick Launcher, separately from Reports and All Reports.
  They open as clean report views, without layout or management controls.
  Use **Dashboards > Manage Dashboards** to create,
  edit, rename, or delete them. Each entry has **View dashboard**, **Edit**, and **Delete**
  actions. Deleting requires confirmation and removes only the dashboard and its layout.
  In the editor, click the name or optional subtitle to edit it. Every change is saved
  to a local browser draft, not to the published dashboard. Subtitles can also be set on creation
  and cleared later; blank subtitles do not appear in dashboard views.
  The editor saves fixed-layout collections of report-backed widgets.
  Choose a Standard (1152px) or Wide (1344px) report container. The title and canvas
  share the existing report frame, side borders, and outer gutters.
  Editor actions and canvas controls share a full-width command bar above the bounded
  dashboard title and canvas. Canvas tools, save/discard actions, and dashboard deletion
  are grouped separately. Select a widget to reveal its appearance, position, and size
  controls; click empty canvas space to clear selection. Layout help expands on demand.
  That editor bar is absent from report views. Place widgets
  on a 12-column grid by dragging anywhere on a widget, using its bottom-right resize
  handle, or setting explicit position and size controls. Focus a widget and use arrow
  keys to move it, or focus its resize handle to resize with arrow keys. A click selects
  without moving it; Escape cancels a drag. Quarter, third, half, and full-width metric
  variations and half/full-width detailed variations share the four Connect Goals
  calculations. The searchable widget-library dialog shows actual-size previews using
  current synced data, with report, width, and variation filters.
  Opening an editor immediately enables layout editing, with name and subtitle editing
  available alongside it. Name, subtitle, display settings, widget additions/removals, and
  geometry persist together in local storage across reloads and navigation. Manage Dashboards
  marks these entries **Draft** and offers **Edit draft** to resume them. Drafts belong to the
  current browser profile and do not sync between browsers or installations.
  **Preview draft** shows the current draft without the editor grid, selection outlines,
  resize handles, or editable headings. Widget drill-throughs and charts work as in the
  saved dashboard. **Back to editing** resumes the same draft without publishing it.
  **Undo** / **Redo** or **Ctrl+Z** / **Ctrl+Y** step through editing changes, including
  widget additions/removals, geometry, display settings, and text edits.
  **Ctrl+Shift+Z** also redoes. Continuous name/subtitle typing is one dashboard undo step.
  **Delete** or **Backspace** removes the selected widget; **Escape** deselects it and
  cancels an active drag. Shortcuts leave text fields and open dialogs alone.
  Undo history is editor-session-only and resets on reload, Save, or Discard draft;
  the current draft still persists in local storage.
  **Save** publishes the complete dashboard in one transaction and clears its local draft.
  **Discard draft** requires confirmation and restores all saved settings, including text.
  Failed saves keep the draft. Conflicting saved changes are never silently overwritten.
  The **Display** selector switches between outlined **Cards** and flat **Dividers**
  with horizontal section rules. It previews immediately and saves or resets with the layout,
  without changing widget positions, sizes, gaps, or the Standard/Wide report frame.
  New dashboards use Cards. Widget-library previews follow the current draft display style
  and canvas width. Add or remove widgets freely while editing, without publishing or reloading.
  Overlapping positions are rejected without pushing neighbors. Widgets never reflow,
  shrink, or move when the window narrows; scroll the fixed report surface instead. Overflowing widget
  content scrolls inside its saved footprint, and removing a widget leaves its space empty.
  Existing vertical dashboards migrate into full-width slots in their original order.
  Changes in another window are detected before a stale draft can overwrite a newer layout.
  Widgets retain the FY27 Data scope, annual setup, drill-through reports, charts, and
  consumption history. Values are not saved snapshots. Full-window canvases and custom
  seller/date filters are not available yet.
  Compensation bucket choices are not restricted to Databases or Fabric. Any non-empty
  selection from the current imported taxonomy can be confirmed for the fiscal year;
  the existing Data goal calculations retain their report-specific scope.
  Dashboard layouts are stored locally in `dashboards` and `dashboard_widgets`;
  stable widget definitions and presentation support live in the code-owned catalog,
  independently of menu placement. Geometry uses zero-based `layout_column` and
  `layout_row`, plus `column_span`, `row_span` (64px rows with 12px gaps), and `variant_key`.
- **Reports Navigation** - divider-separated groups for planning and reviews, execution
  and coverage, pipeline health, and account insights. Connect Goals' action reports
  stay together, separate from planning and review pages. All Reports uses the same
  groups and report order.
- **U2C Trends** - U2C Attainment and Connect Goals preserve quarter-specific MSXi history
  and add a separate **Today (live)** marker for the current, non-final quarter.
  Today uses current synced commitment status and the milestone dollar amounts
  from the latest imported snapshot, not current milestone ACR. Published points
  remain unchanged, including a snapshot published on the same date as Today.
  The U2C Attainment graph distinguishes total pipeline from the 40% goal,
  and its U2C percentage turns green at that goal. Historical and finalized
  quarters keep their stored history. When the current payload has no matching
  publication date, it is saved as an **observed** point for the day, updated on
  repeat refreshes that day. Quarter rollover retries unfinished close-out and
  preserves the previous quarter's last saved data if MSXi no longer serves it.
  If the new quarter is not available yet, the previous quarter stays visible.
- **1:1 Preparation** - review recent activity and all open engagements in the native
  report frame. Sort highlight columns, scroll long milestone tables independently,
  and open existing records without losing your view or reading position on Back.
  Open 1:1 Notes keeps existing workspaces and explicit Manager/Other creation.
  CSV, clipboard and email exports include all highlight rows, including offscreen
  rows and original milestone URLs; customer activity lists remain separate.
- **1:1 Workspaces** - the existing hub uses a native directory with sortable person,
  type, standing context, queue/history counts and update dates. Seller quick starts
  retain their customer-book scope. Back restores the seller filter, table order,
  reading positions and an unsubmitted Manager/Other name. Creation remains explicit.
  Each workspace pairs the existing rich-text standing notes with an independently
  scrolling conversation agenda. Agenda search and engagement editing use native
  dialogs. Autosaves serialize newer edits, expose Retry save on failure and
  protect pending work before navigation, agenda changes or closing an inline workspace.
  Back restores the agenda, standing-note reading regions and discussion-history disclosure.
- **Initiative Tracker** - create named initiatives, select engagements and milestones,
  grouped by their current seller, with live status, commitment, dates, and ACR.
  A native desktop workbench keeps commands and save status visible while initiatives
  scroll. Work and picker columns sort both ways without crossing seller groups;
  raw due dates and ACR retain their original values. Back restores reading position,
  open editors, picker filters/selections and table sorting. Failed saves retain edits
  with retry feedback; unsaved initiative forms warn before leaving.
  When user-facing internal projects exist, **Add work** also offers **Projects**, with
  all statuses available. The system-only Copilot Saved Tasks type is excluded from the
  picker and does not enable this option. Projects have no customer or seller and open
  their full existing project
  content in the same detail modal. Their current points and discussion history stay
  with the initiative, even if the source project is later deleted.
  Click a work row to open its existing detail page in a modal, including engagement
  notes or milestone comments. The **(1:1 notes)** link beside a seller opens their
  full existing 1:1 workspace, including standing notes and the next conversation's
  agenda, without leaving the report. The **Points** icon opens an autosaved agenda block
  and dated discussion history. **Mark discussed** stores a separate history record
  and starts a fresh block for the next conversation. History stays with its initiative
  item; existing blocks created before date tracking show that instead of an invented
  creation timestamp. In **Add work > Milestones**, choose **From U2C** to select
  this quarter's still-uncommitted snapshot milestones. The picker identifies its
  snapshot and follows the workload filter saved on the U2C page. It
  uses U2C's remaining list without imposing the normal search's active-status
  restriction, so Hygiene/Duplicate and other remaining statuses are visible. It
  marks work already added and shows unsynced records without creating
  placeholder milestones. Selections stay curated when snapshots refresh.
  Find it under Reports or use the **Initiative Tracker** link on **1:1 Report**.
  Initiatives persist as you work on them; removing an initiative or item never deletes
  the linked work. **1:1 Report** remains the meeting-prep view for active work and recent activity.
- **Automatic Updates** - `update.bat` pulls latest code, migrates the database, and restarts
- **Daily Backups** - automatic OneDrive backup with daily/weekly/monthly retention

## Quick Start (Manual)

> If you installed via the MSI, skip to [First Run](#first-run).

```powershell
git clone https://github.com/rablaine/SalesBuddy.git C:\prod\SalesBuddy
cd C:\prod\SalesBuddy
start.bat
```

The launcher checks for prerequisites, offers to install anything missing via `winget`, creates the venv, and starts the server on `http://localhost:5151`.

<details>
<summary>Full manual setup</summary>

```powershell
git clone https://github.com/rablaine/SalesBuddy.git
cd SalesBuddy
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Add a secret key to .env:
python -c "import secrets; print(secrets.token_hex(32))"
flask run
```

Visit `http://localhost:5151`. The database creates itself on first run.

</details>

## First Run

A setup wizard walks you through:

1. **Welcome** - overview and theme selection
2. **Azure login** - authenticate for MSX integration
3. **Import Accounts** - pull customer accounts from MSX
4. **Import Milestones** - sync milestone data from MSX
5. **Import Revenue** - pull your ACR straight from MSXI for the Revenue Analyzer

All steps are optional and can be re-run from the Admin Panel.

The stored `se_specialty` preference defaults to `data` and is included in backups.
A specialty selector is not available in the settings UI yet.

## AI Features

AI is powered by Azure OpenAI through a shared APIM gateway. No Azure OpenAI resource or env vars needed.

**Requirements:** Azure CLI + Microsoft corp account (`@microsoft.com`)

The setup wizard handles authentication. AI features work automatically for any Microsoft corporate account.

## WorkIQ (Meeting Import)

Import Teams meeting summaries into notes via [WorkIQ](https://github.com/nicklhw/workiq).

**Requirements:** Node.js 18+ (installed automatically by the launcher) and a Microsoft 365 Copilot license.

Two modes: **Import from Meeting** (summary only) and **Auto-fill** (summary + AI topic/milestone matching). The summary prompt is customizable globally or per-meeting.

## Updating

Double-click `update.bat`. It backs up the database, pulls latest code, installs new dependencies, runs migrations, and restarts. If anything fails, it rolls back automatically.

## Backups

Automatic daily backups to OneDrive with retention rotation (7 daily, 4 weekly, 3 monthly).

```powershell
.\scripts\backup.ps1 -Setup    # Configure OneDrive path + daily schedule
.\scripts\backup.ps1 -Status   # Show backup status
.\scripts\backup.ps1            # Backup now
```

Or use the Admin Panel for one-click backups.

## Scripts

| File | Purpose |
|------|---------|
| `start.bat` | Launch the server (auto-setup on first run) |
| `stop.bat` | Stop the server |
| `update.bat` | Pull updates, migrate, restart |
| `backup.bat` | Run a backup or configure automatic backups |
| `restore.bat` | Interactive restore from a backup |
| `uninstall.bat` | Remove scheduled tasks and stop server |

## Scheduled Tasks

| Task | Trigger | Purpose |
|------|---------|---------|
| `SalesBuddy-AutoStart` | At login | Start the server automatically |
| `SalesBuddy-DailyBackup` | Daily 11:00 AM | Back up database to OneDrive |

Remove with `uninstall.bat` or `scripts\uninstall.ps1`.

## Build the MSI

If you want to build the installer from source:

```powershell
# Prerequisites: .NET SDK 8.0+ and WiX v4
dotnet tool install -g wix

cd installer
.\build.ps1
# Output: installer\output\SalesBuddy.msi
```

See [installer/README.md](installer/README.md) for details.

## Local Development

Start the live development server with the repository's launcher:

```powershell
.\scripts\dev.ps1 start
# Reload the server when needed:
.\scripts\dev.ps1 restart
```

Use `http://127.0.0.1:5000` and the existing `data/salesbuddy.db` for development,
browser validation, and feature demonstrations. Do not substitute sample-only
preview servers or copied databases unless explicitly requested. The installed
production app on port 5151 is separate.

Automated pytest tests still use their isolated database, not the live dev database.

## Running Tests

```powershell
pytest
pytest --cov=app tests/  # with coverage
```

## Documentation

| Guide | Description |
|-------|-------------|
| [MSX Integration](docs/MSX_INTEGRATION.md) | Account imports, milestone sync, API details |
| [WorkIQ Integration](docs/WORKIQ_INTEGRATION.md) | Meeting import setup and customization |
| [Connect Features](docs/CONNECT_FEATURES.md) | Self-eval export and impact signals |
| [App Insights](docs/APP_INSIGHTS.md) | Telemetry details and opt-out |
| [MSX Account Team Roles](docs/MSX_ACCOUNT_TEAM_ROLES.md) | Role definitions for account teams |

## Telemetry

Anonymous, aggregated feature usage data is sent to Application Insights. No personal data, customer names, or IP addresses are collected. See [App Insights](docs/APP_INSIGHTS.md) for details.

**Opt out:** Add `SALESBUDDY_TELEMETRY_OPT_OUT=true` to `.env` and restart.

## Compliance

The SQLite database is not encrypted at the application level. Encryption at rest is provided by BitLocker on your managed device. Must run on a Microsoft-managed, BitLocker-encrypted device. Do not copy the database to unmanaged or unencrypted storage.

## Uninstalling

**MSI install:** Use Add/Remove Programs in Windows Settings. Your database is preserved to `%TEMP%`.

**Manual install:** Run `uninstall.bat` to remove scheduled tasks, then delete the app folder. OneDrive backups are preserved.

## License

MIT - see [LICENSE](LICENSE) for details.

## Credits

Built by **Alex Blaine** ([@rablaine](https://github.com/rablaine)).

Thanks to **Ben Magazino** ([@SurfEzBum](https://github.com/SurfEzBum)) for testing, feedback, and helping shape the final product.

## Contact

For questions or suggestions, please open an issue on GitHub.
