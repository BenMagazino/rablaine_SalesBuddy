/**
 * Contextual page help — press F1 for help about the current page.
 *
 * Maps URL patterns to help content (title, description, tips).
 * Falls back to a generic help message for unmapped pages.
 */
const PageHelp = (function () {

  // ── Help content by route pattern ───────────────────────────────────
  // Patterns are checked top-to-bottom; first match wins.
  // Use {id} as a placeholder for numeric path segments.

  const helpMap = [
    // ── Home ──
    { pattern: /^\/$/, title: 'Dashboard', content: `
      <p>Your home base — calendar of notes &amp; meetings, plus quick access to drafts and engagements.</p>

      <h6>The calendar</h6>
      <ul>
        <li><strong>Solid colored entries</strong> are real notes you've written. Click to view, hover to highlight all notes for that customer.</li>
        <li><strong>Dashed-border entries</strong> are <em>ghost meetings</em> — meetings pulled from your Outlook calendar that don't have a note yet. Click one to start a note pre-filled with the meeting subject and external attendees.</li>
        <li><strong>Today's badge</strong> turns <span class="sb-help-indicator">orange</span> if today's meetings haven't been refreshed today. Click it to pull a fresh copy from WorkIQ.</li>
        <li><strong>+</strong> on any day creates a new note dated to that day.</li>
        <li><strong>X</strong> on a ghost dismisses it. For recurring meetings, hover the <i class="bi bi-arrow-repeat"></i> icon and click the red X to dismiss the whole series.</li>
      </ul>

      <h6>Calendar icon legend</h6>
      <table class="sb-help-table sb-help-legend">
        <tbody>
          <tr><td><i class="bi bi-star-fill sb-help-hva"></i></td><td>High-Value Activity (HVA) attached</td></tr>
          <tr><td><i class="bi bi-check2-square sb-help-task"></i></td><td>Other MSX task attached</td></tr>
          <tr><td><i class="bi bi-flag-fill sb-help-milestone"></i></td><td>Milestone linked, with no task attached yet</td></tr>
          <tr><td><i class="bi bi-diagram-3 sb-help-engagement"></i></td><td>Engagement linked</td></tr>
          <tr><td><i class="bi bi-sticky sb-help-muted"></i></td><td>General note without a customer</td></tr>
          <tr><td><i class="bi bi-calendar-event sb-help-muted"></i></td><td>Outlook meeting matched to a customer</td></tr>
          <tr><td><i class="bi bi-question-circle sb-help-warning"></i></td><td>Outlook meeting needs a customer match</td></tr>
          <tr><td><i class="bi bi-arrow-repeat sb-help-muted"></i></td><td>Recurring meeting</td></tr>
        </tbody>
      </table>

      <h6>Background meeting sync (the typing dots)</h6>
      <p>Sales Buddy quietly pulls today + the next 4 business days of meetings from WorkIQ each morning, plus a catch-up sweep whenever you start the app and any of those days are stale. While that's running, you'll see <strong>typing dots</strong> on each calendar day:</p>
      <ul>
        <li>Dots mean that day's meetings are being fetched or queued up next</li>
        <li>As each day finishes, its ghosts fade in and the dots disappear</li>
        <li><strong>Click any dot</strong> to surface the floating progress card. Close it with the X — sync keeps running in the background.</li>
      </ul>

      <h6>Quick actions</h6>
      <ul>
        <li><span class="kbd">/</span> — jump to any customer</li>
        <li><span class="kbd">Ctrl</span>+<span class="kbd">K</span> — quick note creation</li>
        <li><span class="kbd">?</span> — full keyboard shortcuts list</li>
      </ul>
    `},

    // ── Notes ──
    { pattern: /^\/notes\/?$/, title: 'Notes', content: `
      <p>All your call notes in one place. Each note captures what was discussed, which technologies came up, and who was involved.</p>
      <h6>Tips</h6>
      <ul>
        <li>Use the filters at the top to narrow by customer, seller, topic, or date range</li>
        <li>Click a note title to view the full note with all details</li>
        <li><strong>New Note</strong> — attach it to a customer and tag relevant topics</li>
      </ul>
    `},
    { pattern: /^\/note\/new/, title: 'New Note', content: `
      <p>Create a new call note. Capture what happened, who was there, and what technologies were discussed.</p>
      <h6>Tips</h6>
      <ul>
        <li>Select a <strong>customer</strong> first — this links the note to their record</li>
        <li>Add <strong>topics</strong> to categorize what was discussed (e.g., "Fabric", "Copilot")</li>
        <li>Use <span class="kbd">Ctrl</span>+<span class="kbd">Enter</span> to save quickly</li>
        <li>The AI can auto-suggest topics from your note content</li>
      </ul>
    `},
    { pattern: /^\/note\/\d+\/edit/, title: 'Edit Note', content: `
      <p>Update this note's content, topics, or attachments.</p>
      <h6>Tips</h6>
      <ul>
        <li>Use <span class="kbd">Ctrl</span>+<span class="kbd">Enter</span> to save quickly</li>
        <li>Changes are saved when you click <strong>Save</strong> — there's no auto-save</li>
      </ul>
    `},
    { pattern: /^\/note\/\d+/, title: 'View Note', content: `
      <p>Full details of this call note — content, topics, sellers, and linked customer.</p>
      <h6>Actions</h6>
      <ul>
        <li><strong>Edit</strong> — modify the note content or tags</li>
        <li><strong>Delete</strong> — permanently remove (cannot be undone)</li>
        <li>Click any <strong>topic badge</strong> to see all notes with that topic</li>
        <li>Click the <strong>customer name</strong> to jump to their record</li>
      </ul>
    `},

    // ── Customers ──
    { pattern: /^\/(?:revenue\/)?products\/?$/, title: 'Products', content: `
      <p>Find imported products and compare their usage and total revenue, highest revenue first.</p>
      <ul>
        <li>Search product names, usage counts or formatted revenue. Clear restores the complete directory.</li>
        <li>Click any column heading in either pane to sort ascending; click again for descending. Arrows show the current order. Sorting and browsing context survive Back.</li>
        <li>Select a product on the left to compare its customers, buckets and all-history consumption on the right.</li>
        <li>Choose a customer name on the right to open Product Revenue with that exact customer/bucket entry selected, including its graph and monthly history. The arrow beside a matched name opens Customer Hub.</li>
        <li>Open product goes directly to the complete history workbench. Browser Back restores your product, search and both reading positions.</li>
        <li>Usage entries count positive-revenue customer/bucket pairs, not unique customers. Consolidated products add counts across their members.</li>
        <li>Search only changes visible products. Values include all imported months and do not change saved bucket filters.</li>
      </ul>
    `},
    { pattern: /^\/(?:revenue\/product|product)\/.+$/, title: 'Product Revenue', content: `
      <p>Compare customer entries using one product, then inspect imported customer history alongside the table.</p>
      <ul>
        <li>Search customer names, buckets or total revenue. Select a row or its clock button to view history.</li>
        <li>Every comparison and history column sorts both ways. Fiscal months sort by their calendar dates; revenue and change sort by exact values, not rounded text. Unavailable changes stay last.</li>
        <li>Sorting history does not reorder the graph or recalculate Change, which still compares preceding imported months.</li>
        <li>Arriving from Products selects the customer/bucket entry you chose, even when several buckets share a customer name.</li>
        <li>Customer-name links open Customer Revenue; the arrow beside a matched name opens Customer Hub.</li>
        <li>Entries are customer/bucket rows, so a customer may appear more than once. Totals and averages include all entries and all imported months, not just search results.</li>
        <li>History retains the imported customer grouping. Change is unavailable when preceding revenue is zero or negative.</li>
        <li>The monthly revenue graph reads oldest to newest. Hover a point for its exact amount; missing imported months are gaps, not zero revenue. The table below retains every original value.</li>
        <li>For consolidated products, expand the member list to see every included product.</li>
      </ul>
    `},
    { pattern: /^\/customers\/?$/, title: 'Customers', content: `
      <p>Your customer directory. Each customer can have notes, engagements, opportunities, and revenue data linked to them.</p>
      <h6>Tips</h6>
      <ul>
        <li>Use the search bar to filter by name</li>
        <li>Click a customer to see all their linked notes, engagements, and revenue</li>
        <li><span class="kbd">/</span> opens quick customer lookup from any page</li>
      </ul>
    `},
    { pattern: /^\/customer\/new/, title: 'New Customer', content: `
      <p>Add a new customer to track. You'll be able to attach notes, engagements, and revenue data to them.</p>
      <h6>Tips</h6>
      <ul>
        <li>The <strong>name</strong> is the only required field</li>
        <li>Adding a territory helps with filtering and reporting later</li>
      </ul>
    `},
    { pattern: /^\/customer\/\d+\/edit/, title: 'Edit Customer', content: `
      <p>Update this customer's information — name, territory, sellers, and other details.</p>
    `},
    { pattern: /^\/(?:revenue\/customer\/\d+\/bucket\/[^/]+|customer\/\d+\/revenue\/bucket\/[^/]+)\/?$/, title: 'Bucket Product History', content: `
      <p>Product revenue for one customer and bucket, with analysis alongside the history.</p>
      <ul>
        <li>The recent grid shows up to seven imported months. Product totals include all imported months.</li>
        <li>Expand <strong>Full Product History</strong> to read every product's monthly history, initially newest first. Every recent-product and history column sorts ascending or descending; totals remain pinned.</li>
        <li>Change compares each imported month with the preceding imported month. It is unavailable when preceding revenue is zero or negative.</li>
        <li>Use the pencil to review the alert, a product name for its detail page, or <strong>Customer Revenue</strong> to return to bucket navigation.</li>
      </ul>
    `},
    { pattern: /^\/(?:revenue\/customer\/\d+|customer\/\d+\/revenue)\/?$/, title: 'Customer Revenue', content: `
      <p>Bucket analysis and monthly product revenue for this customer.</p>
      <ul>
        <li>Use <strong>Buckets</strong> to filter analysis and history together.</li>
        <li>Use the left context pane to examine a visible bucket without changing your saved filter.</li>
        <li><strong>Overview</strong> shows Total Revenue, which includes hidden buckets. Total columns include all imported months, not just the seven displayed.</li>
        <li>Click any Overview or product-grid column to toggle ascending/descending. Summary totals remain pinned and Buckets filters stay unchanged.</li>
        <li>Use <strong>Full History</strong> for all months in a bucket, or the pencil to review an alert.</li>
      </ul>
    `},
    { pattern: /^\/customer\/\d+/, title: 'Customer Details', content: `
      <p>Everything about this customer — notes, engagements, opportunities, and revenue all in one place.</p>
      <h6>Actions</h6>
      <ul>
        <li><strong>New Note</strong> — add a call note linked to this customer</li>
        <li><strong>New Engagement</strong> — create a tracked engagement</li>
        <li>Scroll down to see revenue data and engagement history</li>
      </ul>
    `},

    // ── Engagements ──
    { pattern: /^\/engagement\/\d+\/edit/, title: 'Edit Engagement', content: `
      <p>Update this engagement's details, status, and linked milestones.</p>
    `},
    { pattern: /^\/engagement\/\d+/, title: 'Engagement Details', content: `
      <p>Track a specific customer engagement — its status, linked notes, milestones, and AI-generated story.</p>
      <h6>Actions</h6>
      <ul>
        <li><strong>Generate Story</strong> — AI creates a summary from linked call notes</li>
        <li><strong>Link Notes</strong> — attach relevant call notes to this engagement</li>
        <li><strong>Milestones</strong> — track this engagement against MSX milestones</li>
      </ul>
    `},

    // ── Sellers ──
    { pattern: /^\/sellers\/?$/, title: 'Sellers', content: `
      <p>Your team directory. Sellers are the people who attend customer calls and own relationships.</p>
      <h6>Tips</h6>
      <ul>
        <li>Click a seller to see all their linked notes and customers</li>
        <li>Sellers can be assigned to territories for filtering</li>
      </ul>
    `},
    { pattern: /^\/seller\/new/, title: 'New Seller', content: `
      <p>Add a new seller to your team. They'll appear as an option when creating notes.</p>
    `},
    { pattern: /^\/seller\/\d+/, title: 'Seller Details', content: `
      <p>This seller's profile — linked notes, customers, territory, and activity.</p>
    `},

    // ── Territories ──
    { pattern: /^\/territories\/?$/, title: 'Territories', content: `
      <p>Organize your customers and sellers by territory (region, segment, etc.).</p>
      <h6>Tips</h6>
      <ul>
        <li>Territories help filter and group across the app</li>
        <li>Assign territories to customers and sellers for better organization</li>
      </ul>
    `},
    { pattern: /^\/territory\/\d+/, title: 'Territory Details', content: `
      <p>All customers and sellers in this territory, plus linked notes and activity.</p>
    `},

    // ── Topics ──
    { pattern: /^\/topics\/?$/, title: 'Topics', content: `
      <p>Topics are the technologies and themes discussed in your calls (e.g., "Fabric", "Copilot Studio", "Migration").</p>
      <h6>Tips</h6>
      <ul>
        <li>Tag notes with topics to make them searchable</li>
        <li>Click a topic to see all notes where it was discussed</li>
        <li>The AI can auto-suggest topics when you create a note</li>
      </ul>
    `},
    { pattern: /^\/topic\/\d+/, title: 'Topic Details', content: `
      <p>All notes tagged with this topic, plus associated customers and sellers.</p>
    `},

    // ── Partners ──
    { pattern: /^\/partners\/?$/, title: 'Partners', content: `
      <p>Your partner directory — ISVs, SIs, and other organizations you work with.</p>
      <h6>Tips</h6>
      <ul>
        <li>Rate partners (1-5 stars) based on your experience</li>
        <li>Add <strong>specialties</strong> to track what each partner is good at</li>
        <li>Add <strong>contacts</strong> with email and phone for quick reference</li>
        <li><strong>Share Directory</strong> — send your partner list and saved details to another Sales Buddy user who is currently online (both users must be running Sales Buddy at the same time)</li>
      </ul>
    `},
    { pattern: /^\/partners\/new/, title: 'New Partner', content: `
      <p>Add a new partner organization to your directory.</p>
      <h6>Tips</h6>
      <ul>
        <li>Add a <strong>website</strong> and we'll grab the favicon automatically</li>
        <li>Tag relevant <strong>specialties</strong> so you can find them later</li>
        <li>Add contacts — mark one as <strong>primary</strong> for quick access</li>
      </ul>
    `},
    { pattern: /^\/partners\/\d+\/edit/, title: 'Edit Partner', content: `
      <p>Update this partner's details, contacts, specialties, and rating.</p>
    `},
    { pattern: /^\/partners\/\d+/, title: 'Partner Details', content: `
      <p>Full profile for this partner — overview, contacts, specialties, and linked notes.</p>
      <h6>Actions</h6>
      <ul>
        <li><strong>Share</strong> — send this partner to a teammate via Socket.IO</li>
        <li><strong>Edit</strong> — update details, add contacts</li>
        <li>Click specialties to see other partners with the same skills</li>
      </ul>
    `},

    // ── Specialties ──
    { pattern: /^\/specialties\/?$/, title: 'Specialties', content: `
      <p>Manage the list of specialties that can be assigned to partners (e.g., "Migrations", "Purview", "Copilot Studio").</p>
    `},

    // ── Pods & Solution Engineers ──
    { pattern: /^\/pods\/?$/, title: 'Pods', content: `
      <p>Pods are groups of sellers that work together. Great for organizing team coverage.</p>
    `},
    { pattern: /^\/pod\/\d+/, title: 'Pod Details', content: `
      <p>Members of this pod and their collective activity.</p>
    `},
    { pattern: /^\/solution-engineers\/?$/, title: 'Solution Engineers', content: `
      <p>Your solution engineering team. SEs provide technical depth on customer calls.</p>
    `},
    { pattern: /^\/solution-engineer\/\d+/, title: 'Solution Engineer Details', content: `
      <p>This SE's profile — linked notes, customers, and specialties.</p>
    `},

    // ── Milestones ──
    { pattern: /^\/milestones\/?$/, title: 'Milestones', content: `
      <p>Track MSX milestones and their linked engagements.</p>
      <h6>Tips</h6>
      <ul>
        <li>Milestones sync with MSX via AI-generated engagement stories</li>
        <li>Use the <strong>Milestone Tracker</strong> for a board view</li>
      </ul>
    `},
    { pattern: /^\/reports\/connect-goals/, title: 'Connect Goals', content: `
      <p>This FY27 Data action center tracks the goals Sales Buddy can measure and links each gap to the report where you can act on it. Definitions remain provisional until manager confirmation.</p>

      <h6>Quarterly U2C progression</h6>
      <p><strong>Goal: 40% by quarter end.</strong> Committed Data milestone ACR is divided by the official quarter-start snapshot ACR. The status color compares actual progress with a linear expected pace for today.</p>

      <h6>Quota attainment</h6>
      <p><strong>Goal: 100% weighted attainment.</strong> Official quota, actuals, performance-goal weights, and weighted attainment remain in MINT. Use the dashboard link to open MINT Earnings directly; Sales Buddy does not estimate this metric.</p>

      <h6>Milestone team coverage</h6>
      <p><strong>Goal: 50%.</strong> Active Data milestones due this or next fiscal year are weighted by estimated monthly ACR. The metric compares ACR on milestones where you are on the team with all in-scope milestone ACR.</p>

      <h6>Milestone HVA coverage</h6>
      <p><strong>Goal: 100%.</strong> Every active, on-team Data milestone due this or next fiscal year should have at least one qualifying HVA activity in the current fiscal year. Technical Workshop, Demo, L300+ Demo, Architecture Design Session, and PoC/Pilot counts provide additional technical-validation context.</p>

      <h6>Whitespace wins</h6>
      <p><strong>Goal: one Databases win and one Fabric win per fiscal half.</strong> After three complete zero-ACR months, an activation appears as ramping until the same customer and bucket remain above $0 for three consecutive months. Consumption must remain positive through the latest available month, so a customer that later returns to $0 no longer counts. Any positive ACR qualifies; there is no minimum spend threshold.</p>
    `},
    { pattern: /^\/reports\/activity-coverage/, title: 'Activity Coverage', content: `
      <p>Review every stored fiscal-year meeting, find activities already logged in MSX, and prepare missing activities without leaving Sales Buddy.</p>

      <h6>Meetings and milestones</h6>
      <p><strong>Meetings</strong> covers calendar activity one meeting at a time. <strong>Milestones</strong> finds active milestones where you are on team but have no HVA task during the current fiscal year. A prepared meeting draft does not count until its MSX activity is created.</p>
      <ul>
        <li><strong>Show covered</strong> adds milestones with a current-FY HVA task.</li>
        <li><strong>Show inactive</strong> adds completed, cancelled, and other inactive milestones.</li>
        <li><strong>HVA in FYxx</strong> preserves prior-year evidence while leaving the milestone uncovered for current-year reporting.</li>
        <li><strong>Create HVA Task</strong> creates a standalone open MSX task and never links it to a meeting.</li>
      </ul>

      <h6>Recommended workflow</h6>
      <ol>
        <li><strong>Catch Up Calendar</strong> imports calendar days after the last successful import through today. It adds meetings; it does not create MSX activities.</li>
        <li><strong>Match Milestones</strong> first runs the improved account sync once when needed, refreshes milestones and existing activities, then uses WorkIQ meeting context to prepare a subject, description, activity type, and suggested milestone for each unlogged customer meeting.</li>
        <li>Use <strong>Prepared</strong> and the chevron above the Date column to audit suggestions. Correct the customer, milestone, activity type, duration, or draft text when needed.</li>
        <li><strong>Create Activity</strong> creates one open MSX task for that meeting. Nothing is created until you click it.</li>
      </ol>

      <h6>Weekly and Full FY views</h6>
      <p><strong>Weekly</strong> keeps review batches small and provides week-by-week navigation. <strong>Full FY</strong> shows every fiscal-year meeting in one continuous list. Matching and calendar import operate across the fiscal year in either view; the toggle only changes what is displayed.</p>

      <h6>Toolbar actions</h6>
      <table class="sb-help-table">
        <tbody>
          <tr><td><strong>Match Milestones</strong></td><td>Prepares unlogged meetings with WorkIQ and suggests milestones. Does not create MSX tasks.</td></tr>
          <tr><td><strong>Re-run Matching</strong></td><td>Replaces prior AI summaries, drafts, activity types, and milestone suggestions for all unlogged meetings. Customer matches, dismissals, notes, and linked MSX activities stay unchanged.</td></tr>
          <tr><td><strong>Catch Up Calendar</strong></td><td>Imports calendar meetings since the last completed day. Use it after time away or when recent days are missing.</td></tr>
        </tbody>
      </table>

      <h6>Reviewing a meeting</h6>
      <ul>
        <li><strong>Customer</strong> searches name, nickname, and TPID.</li>
        <li><strong>Milestone</strong> searches milestone name/number, opportunity, and workload. <span class="sb-help-indicator" data-tone="info">On Team</span> identifies milestones where you are on the team.</li>
        <li>A <strong>★</strong> beside an activity type means it qualifies for HVA credit. Preparation prefers a matching HVA type, then falls back to a more accurate non-HVA type when needed.</li>
        <li><strong>Save</strong> stores your edits without creating anything in MSX.</li>
        <li><strong>Enrich</strong> refreshes draft text for one meeting. Use <strong>Re-run Matching</strong> when you need to replace preparation across the fiscal year.</li>
        <li><strong>Dismiss</strong> removes a meeting from coverage. Recurring meetings can be dismissed once or as a series.</li>
      </ul>

      <h6>Status and filters</h6>
      <ul>
        <li><strong>Logged</strong> has an existing linked MSX activity.</li>
        <li><strong>Ready</strong> has a customer and selected milestone and can be created after review.</li>
        <li><strong>Customer</strong> or <strong>Milestone</strong> needs manual matching.</li>
        <li><strong>Prepared</strong> finished WorkIQ preparation; <strong>Failed</strong> needs a retry.</li>
      </ul>
    `},
    { pattern: /^\/reports\/milestone-tracker/, title: 'Milestone Tracker', content: `
      <p>Board view of all milestones across your customers, pulled from MSX.</p>
      <h6>Manual Sync</h6>
      <ul>
        <li>Click <strong>Sync from MSX</strong> to pull the latest data on demand</li>
        <li>Every sync refreshes <em>all</em> milestones and opportunities for every customer with an MSX account link</li>
        <li>Sync typically takes 6-10 minutes depending on how many customers you have</li>
      </ul>
      <h6>Scheduled Sync</h6>
      <ul>
        <li>A Windows scheduled task (<code>SalesBuddy-MilestoneSync</code>) runs automatically on Mon/Wed/Fri</li>
        <li>The sync time is randomly assigned between 9:30 AM and 4:30 PM when first registered, spreading load across users</li>
        <li>It only runs if Sales Buddy is already running - it won't start the server on its own</li>
        <li>The task is registered the first time you run <code>start.bat</code></li>
        <li>Enable or disable it from <strong>Admin Panel > Milestone Sync</strong> toggle</li>
      </ul>
      <h6>Tips</h6>
      <ul>
        <li>Use the filters to narrow by seller, status, quarter, or workload area</li>
        <li>Click any row to view milestone details</li>
        <li>The MSX icon opens the milestone directly in MSX</li>
      </ul>
    `},
    { pattern: /^\/milestone\/\d+/, title: 'Milestone Details', content: `
      <p>This milestone's tasks, linked engagements, and MSX sync status.</p>
    `},

    // ── Revenue ──
    { pattern: /^\/revenue\/import/, title: 'Revenue Import', content: `
      <p>Pull ACR (Azure Consumed Revenue) straight from MSXI using your Azure sign-in.</p>
      <h6>Tips</h6>
      <ul>
        <li>Requires the corporate VPN - no export or file needed</li>
        <li>Each sync replaces the stored revenue with a fresh two-year pull</li>
        <li>After syncing, revenue will appear on customer and seller pages</li>
      </ul>
    `},
    { pattern: /^\/revenue\/config/, title: 'Revenue Configuration', content: `
      <p>Configure revenue tracking settings — product groupings, alert thresholds, and seller mappings.</p>
    `},
    { pattern: /^\/reports\/workload/, title: 'Workload Report', content: `
      <p>Customers grouped by workload topic. Use this to find accounts working on a specific technology for workshop targeting or account team questions.</p>
      <h6>How it works</h6>
      <ul>
        <li>Topics from your notes are used as workload tags</li>
        <li>Click a topic row to expand and see the customers</li>
        <li><strong>Committed</strong> badge means at least one milestone linked to a note with this topic is committed</li>
        <li><strong>Last Activity</strong> shows the most recent note date for that topic + customer</li>
      </ul>
      <h6>Column definitions</h6>
      <ul>
        <li><strong>Engagements</strong> - active engagements for this customer (all, not topic-scoped)</li>
        <li><strong>Milestones</strong> - active milestones linked to notes that are tagged with this topic. A milestone appears here because you wrote a note about it and tagged it with this workload.</li>
        <li><strong>Est. ACR</strong> - sum of monthly usage from those topic-linked milestones only (not the customer's full ACR)</li>
      </ul>
      <h6>Date filter</h6>
      <p>Use the From/To date pickers or preset buttons to scope which notes are considered. Only customers with notes in the selected date range will appear. Filter settings are saved between visits.</p>
    `},
    { pattern: /^\/reports\/revenue-reports/, title: 'Revenue Reports', content: `
      <p>Open Synapse Customers to review adoption grouped by seller. Revenue Analyzer returns to the broader revenue review.</p>
    `},
    { pattern: /^\/reports\/synapse-customers/, title: 'Synapse Customers', content: `
      <p>New shows customers whose first imported Synapse usage is within the last six complete imported months. Current includes customers with any Synapse spend in imported history.</p>
      <p>The report remembers New or Current when you visit without an explicit mode. A mode supplied in the URL always wins.</p>
      <p>Click any table heading to sort ascending or descending within its seller group. First Usage uses calendar dates, not fiscal-label text.</p>
      <p>Total Revenue includes all imported history. Latest Month excludes the in-progress calendar month; Avg (Last 4mo) uses up to four complete imported months. A dash means no positive amount for that measure.</p>
      <p>Customer links open matched Revenue pages. CSV, Clipboard and Email export all seller tables in their visible order; formatted exports retain account links.</p>
    `},
    { pattern: /^\/reports\/revenue\/?$/, title: 'Revenue Dashboard', content: `
      <p>Overview of Azure Consumed Revenue across your customers — flagging who needs attention and why.</p>
      <h6>Categories</h6>
      <table class="sb-help-table">
        <tbody>
          <tr>
            <td><span class="sb-help-indicator" data-tone="danger">Declining</span></td>
            <td>Revenue is declining month-over-month <em>and</em> dropped sharply recently. These customers may be migrating away or shutting down workloads.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator">Recent Dip</span></td>
            <td>Overall trend was stable or positive, but there was a sudden drop in the last 1-2 months. Could be a billing anomaly, a paused project, or the start of something worse.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator" data-tone="success">EXPANSION</span></td>
            <td>Revenue is growing with positive momentum — customer is near or at their historical max. Good time to engage and help them scale further.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator" data-tone="neutral">Volatile</span></td>
            <td>Revenue swings significantly month to month (high coefficient of variation). Hard to predict — worth a conversation to understand usage patterns.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator" data-tone="info">Stagnant</span></td>
            <td>Revenue is flat with low variance. Customer is using Azure but not growing. May be an opportunity to introduce new services.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator" data-tone="neutral">Healthy</span></td>
            <td>No concerning signals — revenue is stable with normal patterns. No action needed.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator" data-tone="info">New Customer</span></td>
            <td>Recently started generating revenue (first few months of usage). Worth an early check-in to ensure onboarding is going well.</td>
          </tr>
          <tr>
            <td><span class="sb-help-indicator" data-tone="neutral">Inactive</span></td>
            <td>Revenue dropped to $0 in this bucket after previously generating usage. The customer stopped using this specific product/service.</td>
          </tr>
        </tbody>
      </table>
      <h6>Tips</h6>
      <ul>
        <li>The <strong>Priority</strong> score (0-100) ranks how urgently a customer needs attention</li>
        <li>The <strong>$ Impact</strong> column shows estimated monthly revenue at risk or opportunity</li>
        <li>Every alert column sorts ascending or descending through its heading. Alert previews use the same sortable product grids, with summary totals pinned.</li>
        <li>Click a customer to see their full revenue breakdown with monthly charts</li>
        <li>Use <strong>Re-analyze</strong> after a fresh import to update all categories</li>
      </ul>
    `},
    { pattern: /^\/revenue\/seller\/[^/]+\/products\/?$/, title: 'Seller Products', content: `
      <p>Browse this seller's products beside their customer consumption. Choose a product on the left, then a customer entry to open the seller's recent-month comparison.</p>
      <p>Search product names, usage counts or totals. Every column sorts in both directions. Usage counts retain customer/bucket pairs and consolidated member counts.</p>
      <p>Open product reads the full monthly grid. Back restores product selection, search, sorting and pane positions. Embedded views remain compact lists.</p>
    `},
    { pattern: /^\/revenue\/seller\/[^/]+\/product\//, title: 'Seller Product Comparison', content: `
      <p>Compare this seller's customer and bucket entries across the seven most recent imported months. Total revenue includes all imported months, not only the displayed months.</p>
      <p>Search customer, bucket or amount; Clear restores every entry. Every column sorts ascending or descending without changing monthly comparisons or totals.</p>
      <p>Customer and bucket links open their Revenue pages when matched. View All Customers opens the global product workbench; Back to Products returns to the seller's browser. Consolidated products disclose every member.</p>
    `},
    { pattern: /^\/revenue\/seller\//, title: 'Seller Revenue Alerts', content: `
      <p>Revenue alerts for this seller's customers, initially sorted by priority. Review each alert and mark it as actioned, reviewed, or dismissed.</p>
      <p>Use Table view to sort any column in either direction; the alert queue follows that order. Product columns in the detail pane also sort both ways, with totals pinned.</p>
      <h6>Alert Categories</h6>
      <table class="sb-help-table">
        <tbody>
          <tr><td><span class="sb-help-indicator" data-tone="danger">Declining</span></td><td>Revenue is trending down with a recent sharp drop. Customer may be migrating away or reducing workloads.</td></tr>
          <tr><td><span class="sb-help-indicator">Recent Dip</span></td><td>Overall trend was stable but there was a sudden recent drop. Could be temporary or the start of something bigger.</td></tr>
          <tr><td><span class="sb-help-indicator" data-tone="success">Expansion</span></td><td>Growing usage with positive momentum. Good time to engage about scaling.</td></tr>
          <tr><td><span class="sb-help-indicator" data-tone="neutral">Volatile</span></td><td>Large month-to-month swings. Worth understanding what drives the variation.</td></tr>
        </tbody>
      </table>
    `},

    // ── Search ──
    { pattern: /^\/search/, title: 'Search', content: `
      <p>Full-text search across all your notes, customers, and engagements.</p>
      <h6>Tips</h6>
      <ul>
        <li>Search by keyword, customer name, topic, or seller</li>
        <li>Use filters to narrow results by type</li>
        <li>Results are ranked by relevance</li>
      </ul>
    `},

    // ── Analytics ──
    { pattern: /^\/analytics/, title: 'Analytics', content: `
      <p>Charts and metrics about your note-taking activity, customer coverage, and team engagement.</p>
    `},

    // ── Settings ──
    { pattern: /^\/preferences/, title: 'Settings', content: `
      <p>Your personal Sales Buddy preferences — display options, defaults, and account settings.</p>
    `},

    // ── Fill My Day ──
    { pattern: /^\/fill-my-day/, title: 'Fill My Day', content: `
      <p>Meeting prep tool — quickly review customer context and past notes before your calls today.</p>
      <h6>Tips</h6>
      <ul>
        <li>Syncs with your calendar to show upcoming meetings</li>
        <li>Click a meeting to see relevant notes and customer history</li>
      </ul>
    `},

    // ── Connect Export ──
    { pattern: /^\/connect-export/, title: 'Connect Export', content: `
      <p>Export your notes in Connect-compatible format for uploading to the Connect system.</p>
    `},

    // ── Admin ──
    { pattern: /^\/admin\/ai-logs/, title: 'AI Logs', content: `
      <p>View recent AI gateway calls — prompts, responses, tokens used, and latency.</p>
    `},
    { pattern: /^\/admin\/favicons/, title: 'Favicon Management', content: `
      <p>View and refresh favicons for customers with websites. Useful if icons are missing or outdated.</p>
    `},
    { pattern: /^\/admin/, title: 'Admin Panel', content: `
      <p>System administration — AI settings, data management, and application configuration.</p>
    `},
  ];

  // ── Fallback help ───────────────────────────────────────────────────

  const fallbackHelp = {
    title: 'Sales Buddy Help',
    content: `
      <p>Sales Buddy helps Azure technical sellers capture and retrieve customer call notes.</p>
      <h6>Keyboard Shortcuts</h6>
      <table class="sb-help-table">
        <tbody>
          <tr><td><span class="kbd">F1</span></td><td>Page help (you're here!)</td></tr>
          <tr><td><span class="kbd">/</span></td><td>Quick customer lookup</td></tr>
          <tr><td><span class="kbd">Ctrl</span>+<span class="kbd">K</span></td><td>New note</td></tr>
          <tr><td><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></td><td>Submit form</td></tr>
          <tr><td><span class="kbd">/</span> or <span class="kbd">?</span></td><td>Customer search / Keyboard shortcuts</td></tr>
        </tbody>
      </table>
      <p class="sb-help-muted">Press <span class="kbd">F1</span> on any page for help specific to that page.</p>
    `,
  };

  // ── Public API ──────────────────────────────────────────────────────

  function show() {
    const path = window.location.pathname;

    // Find matching help content
    let help = null;
    for (const entry of helpMap) {
      if (entry.pattern.test(path)) {
        help = entry;
        break;
      }
    }

    const title = help ? help.title : fallbackHelp.title;
    const content = help ? help.content : fallbackHelp.content;

    // Populate and toggle the shared native help dialog.
    const titleEl = document.getElementById('pageHelpModalLabel');
    const bodyEl = document.getElementById('pageHelpBody');
    if (!titleEl || !bodyEl) throw new Error('Page help dialog content is missing');

    titleEl.textContent = title;
    bodyEl.innerHTML = content;
    bodyEl.scrollTop = 0;

    SBDialog.toggle('pageHelpModal');
  }

  return { show };
})();
