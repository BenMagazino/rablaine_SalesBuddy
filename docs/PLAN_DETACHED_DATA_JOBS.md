# Plan: Detached import, sync and refresh jobs

**Status:** Regular-data-sync slice implemented on `feature/detached-sync-jobs`.
Concurrent conflict groups, file-backed live status and coordinated background
writes are the approved next slice below. The Home freshness launcher, uploads,
destructive workflows and cancellation remain deferred.
**Captured:** October 3, 2026.
**Requested by:** User, after approving the Home data-freshness bar.

## Goal

Start a data operation, leave the page, keep working, and return later to its
actual progress and result. A browser connection observes the operation; it must
not own its execution.

Use the recently implemented MP3-processing pattern in DiscordDNDTranscriber as
the behavioral reference. Build on Sales Buddy's existing durable queue, rather
than introducing another queue or keeping work alive with a hidden browser tab.

This also enables clicking a freshness timestamp, inspecting its status, and
starting that sync without navigating away from a note, report or calendar.
The exact launcher UX remains a design proposal, not a signed-off mockup.

## Implemented slice

[sync_jobs.py](../app/services/sync_jobs.py) is the single admission and execution
registry. Frontend adapters, schedulers and headless callers all use
`admit_sync(operation, options, initiator=...)`; only the separate durable worker
executes domain services. Generic queue admission rejects `sync:` handler names,
and pre-upgrade calendar/preparation jobs translate to canonical admission.

Open **Settings > Sync Test Console** at `/admin/sync-console`. The page lists
every registered operation, supported JSON options, active progress, latest
outcome, last successful refresh and worker availability. Start a new run or
explicitly retry the previous failed run with its original captured options.
Run details expose the saved result, error and bounded event/attempt history.
Running jobs show current progress first. Retained errors from earlier attempts
are labeled separately, with automatic recovery distinguished from a current failure.
Leaving or closing the browser stops observation, not execution.

### Operation inventory

| Registry key | Source and scope | Existing launchers |
|---|---|---|
| `accounts` | MSX account discovery, alignment, sellers and territories | Admin, onboarding, scheduler/headless |
| `accounts-selected` | Captured account and territory selection | Account import |
| `milestones` | Full opportunities, milestones, tasks and comments | Tracker, onboarding, scheduler, preparation dependency |
| `customer-milestones` | One customer's milestones | Customer tracker |
| `customer-data` | One customer's opportunities, milestones and comments | TPID import follow-up |
| `revenue` | MSXI ACR, reconciliation and optional saved analysis | Revenue import, onboarding, milestone follow-up |
| `revenue-analysis` | Saved revenue trends | Revenue Analyze |
| `u2c` | Official MSXI baseline and local matching | U2C report, scheduled/follow-up |
| `marketing` | Summaries, interactions and contacts | Admin, milestone follow-up |
| `fabric` | Fabric workloads, capacities, utilization and revenue | Report, customer tab, weekly scheduler |
| `fabric-revenue` | Saved Fabric revenue only | Fabric revenue refresh |
| `meetings` | Calendar/attendee cache for a captured date | Meeting picker refresh and cache miss |
| `meeting-aura` | Captured business-day calendar window | Picker, daily/startup scheduler, account follow-up |
| `copilot-actions` | Daily WorkIQ action suggestions | Home, daily/startup scheduler |
| `favicons` | All icons or missing icons only | Admin |
| `milestone-dates` | On-team milestone audit histories | Reports |
| `activity-reconciliation` | Refresh MSX tasks/activities and match saved meetings | Activity Coverage |
| `calendar-population` | Resumable fiscal-year calendar | Activity Coverage |
| `meeting-preparation` | WorkIQ summaries and milestone matching | Activity Coverage |

Excluded from this one-shot sync registry: destructive FY/restore workflows,
file uploads, backups/exports, interactive CRUD or draft enrichment/lookups,
authentication token refresh, health checks, telemetry and continuous partner
sharing subscriptions. Those are not regular bounded data-refresh runs.
Individual onboarding/FY sync phases use admission, but this slice does not
detach an entire browser-orchestrated multi-step workflow.

### Persisted contract and recovery

- `POST /api/jobs/start/<operation>` returns `202`, a stable `job_id`, initial
  snapshot and `status_url`, only after admission commits.
- `GET /api/jobs` reads the complete catalog, retained successes and worker health.
- `GET /api/jobs/<job_id>` reads that run and its latest 200 saved events.
- `POST /api/jobs/<job_id>/retry` creates a new run with the original options.
  The failed run remains inspectable.
- Unique active-resource and request keys protect cross-process admission.
  Identical requests share a run; incompatible resource/options return `409`.
  Full/customer milestone writes share ownership; Fabric variants and ACR/analysis
  also share their respective resource families. Worker claims serialize syncs.
- Known phase/batch totals produce measured progress, capped at 99 until terminal
  completion commits. Unknown-duration queries remain indeterminate. SQLite
  progress is deferred during an atomic domain write, then its latest measured
  unit is saved after commit. Progress must never commit domain data prematurely.
- Structured domain failures, partial counts, warnings and retry attempts remain
  available. Starting or failing a new attempt does not erase the last success.
- Safe registered operations have at most three attempts with bounded backoff.
  Only typed transient network failures or explicitly classified source failures
  qualify. Other failures, including authentication and SQL errors, are terminal.
  Interrupted unsafe work requires explicit retry; safe work can be reclaimed.
- Worker and progress heartbeats are separate: a busy worker is healthy, and
  its job exposes the last measured activity time. No browser heartbeat owns work.
- `scripts\dev.ps1` starts web and worker with the same development database and
  credentials, restarts crashed workers, and stops both. Production retains the
  existing crash/health-aware supervisor. Jobs wait durably if the worker is absent.

Existing JSON callers use [ui-jobs.js](../static/js/ui-jobs.js) to observe accepted
receipts until a real terminal result. Cache-miss GETs reread the completed cache.
Existing SSE starts observe saved events; the stream never executes the sync.
The canonical console APIs bypass this compatibility wait and acknowledge promptly.

## Required behavior

- Start once, receive a stable job ID, and return promptly.
- Navigation, reload, closing a progress surface, and losing a polling/stream
  connection do not stop the accepted job.
- Reopening a page reconstructs progress from server-side state, without
  restarting the operation or relying on that tab's memory/local storage.
- Manual, scheduled and onboarding launches use the same execution and conflict
  rules. Two tabs cannot accidentally run duplicate or incompatible operations.
- Outcomes, errors, warnings, partial writes and retry attempts remain inspectable.
- Starting a new attempt does not erase the last successful refresh timestamp.
- Jobs persist across a backend restart. Recovery is explicit and operation-safe;
  do not promise uninterrupted execution while the application is actually quit.
- Closing a panel is not cancellation. Cancellation, if offered, is an explicit
  server-side action supported only at safe boundaries.

## Approved concurrency and write-wait design (October 14, 2026)

### Real-world scope

Scheduled syncs usually run while the app is idle. A manually triggered sync
usually means the user is waiting for a fresh report. Pressing every console
button must remain safe, but does not need optimal throughput. Avoid building a
general-purpose database traffic scheduler for this personal desktop app.

### Execution and conflict groups

- Remove global single-sync execution. Independent groups can fetch and prepare
  concurrently; adding worker slots alone is insufficient while the global claim
  guard exists.
- Reserve a logical conflict group for the whole run, including fetching.
  Groups cover conflicting business logic and dependencies, not just shared tables.
  Identical active requests reuse their existing run. Different requests in a
  conflicting group wait durably rather than failing admission.
- Show the blocking sync name and job ID for a queued group member.
- Do not introduce an arbitrary two-job cap or speculative external-service
  limits. Preserve source error handling and safe retries for actual failures.
- Prepare fetched data before opening each write transaction. Preserve required
  atomic replacements; do not manufacture partial commits for concurrency.
  Multi-stage syncs can have multiple fetch/prepare/save phases.

### Live status independent of SQLite writes

- Each run has a local JSON status file, keyed by job ID, containing progress,
  phase, heartbeat, attempt and worker identity. SQLite remains the durable
  admission/options/outcome/history ledger.
- Publish with atomic replacement and one coordinated publisher per run.
  An earlier attempt cannot overwrite a replacement attempt's status.
- Readers reconcile file identity and heartbeat freshness with durable state.
  Database congestion must not make a healthy worker look dead.
- Persist successful terminal state only after domain data commits. If final
  bookkeeping is waiting, show that honestly instead of claiming completion.
- Surface file read/write failures explicitly. Retain status until the terminal
  outcome is durable; bound event history and clean obsolete status files safely.

### Background database writes

- Use a crash-safe, cross-process write gate outside SQLite for background sync
  transactions. Fetching remains concurrent; sync writers take turns.
- Expose the actual gate owner so observers can say "Waiting to save" and name
  the sync saving ahead of them. Waiting must not hold SQLite's writer lock.
- WAL permits concurrent readers, not concurrent writers or guaranteed FIFO
  fairness. Preserve atomic writes and release ownership on commit/rollback/crash.
- Do not add an application-wide write coordinator, user-write priority,
  starvation policy or guaranteed queue-position estimates in this slice.
  Ordinary app writes keep SQLite's lock-wait behavior. Its timeout is currently
  10 seconds; timeouts must remain explicit failures, never false saved states.

### Interactive save notice

- For a noticeable interactive save wait, observe the background-write gate
  through an independent status request while the original save is pending.
  Do not rely on a blocked request to send an interim response.
- Display the real owner only while it owns the gate. Preserve input, prevent
  duplicate submission, and keep the notice through pending save completion.
  Completion means the actual response, not merely release of the write gate.
  On timeout/failure, stop claiming an automatic save is pending and allow retry.
- Use the following approved copy verbatim, replacing only "Fabric sync" with
  the actual sync name:

  **Waiting to save**

  Fabric sync is saving data. Your save will continue when it finishes. Keep this page open until saving completes.

  If you run into this, let Alex know how you ran into this (did you manually start syncs, is this start of the day and syncs are running in the background, stuff like that). He clearly knew this could happen but didn't think it actually would so now you gotta wait.

### Acceptance

Verify independent fetches overlap, conflicts wait with a named blocker,
background transactions do not overlap, rollback preserves prior data, and
file-backed progress/heartbeats remain readable during a real SQLite write lock.
Verify crash/attempt recovery, browser reconnect, current-versus-previous error
presentation and the exact interactive notice through save success and failure.
Use isolated databases for automated tests and the existing development server
for desktop browser validation. Do not merge or push without user approval.

## Evidence and reference architecture

### DiscordDNDTranscriber

Read-only inspection found the pattern the user described:

| Evidence | Relevant behavior |
|---|---|
| [runner.ts](../../DiscordDNDTranscriber/src/runner.ts), `reserve`, `pump`, `cancel`, `stop` | Runner-owned queue, busy-job protection, independent execution, cancellation and shutdown |
| [domain.ts](../../DiscordDNDTranscriber/src/domain.ts), job/progress schemas | Persisted stage, step history, timing, outcome and queued operation |
| [server.ts](../../DiscordDNDTranscriber/src/server.ts), startup recovery | Requeues persisted in-flight operations and handles deletion/shutdown ownership |
| [app.js](../../DiscordDNDTranscriber/public/app.js), job refresh loop | Browser polls job state about every three seconds and reconstructs the selected job |
| [progress.js](../../DiscordDNDTranscriber/public/progress.js) | Renders persisted step progress, including completed runs |
| [uploads.ts](../../DiscordDNDTranscriber/src/uploads.ts) | Upload acceptance and file ownership are separate from processing |
| [runner.test.ts](../../DiscordDNDTranscriber/tests/runner.test.ts) | Failed-run retry and resuming saved Azure jobs instead of submitting duplicates |

The reference uses polling, not SSE/WebSockets. Copy the ownership and persisted
progress model, not its TypeScript implementation, MP3 stages, upload protocol or
concurrency numbers. Sales Buddy's SQLite writes need different concurrency policy.

### Foundation at plan capture, before migration

- [Job](../app/models.py) and [job_queue.py](../app/services/job_queue.py) persist
  pending/running/done/failed jobs, payloads, results, attempts, claim ownership,
  heartbeat and retry backoff. A guarded update claims jobs.
- [worker.py](../app/worker.py) runs the durable queue in a separate process.
  [supervisor.py](../app/supervisor.py) manages web and worker processes separately.
- [activity_enrichment.py](../app/services/activity_enrichment.py) already returns
  a job ID for queued meeting preparation. Activity-coverage population also uses
  this queue. Extend/reuse this prior art.
- [SyncStatus](../app/models.py) is a per-source latest-attempt summary, not a
  progress journal. `mark_started()` clears the previous completion. Keep its
  existing consumers working while introducing retained successful history.
- Queue dedupe currently checks then inserts; it is not an atomic concurrent
  admission guarantee. The worker executes queue jobs serially, but separate
  scheduler threads and current route threads can still overlap them.
- Queue execution currently considers a returned dictionary a completed job.
  Adapters must translate domain `success: false` or a terminal generator error
  into a real failed outcome,
  rather than marking a failed sync done because it did not raise.
- [dev.ps1](../scripts/dev.ps1) starts Flask, not the durable queue worker.
  Standalone development therefore needs explicit worker lifecycle wiring before
  queue-backed manual operations become the default.

### Pre-migration disconnect-sensitive entry points

This is an evidence-backed seed inventory, not a completed exhaustive audit:

| Operation | Current entry point | Migration concern |
|---|---|---|
| Accounts | [msx.py](../app/routes/msx.py), `/api/msx/accounts/sync` | SSE response consumes the work generator; non-SSE fallback starts a daemon thread. Preserve source selection, alignment/FY context and post-import meeting work |
| Milestones | [milestones.py](../app/routes/milestones.py), `/api/milestone-tracker/sync` | SSE generator owns work; JSON fallback uses a daemon thread. Preserve failure recording and customer-specific sync semantics |
| ACR | [revenue.py](../app/routes/revenue.py), `/api/revenue/sync` | SSE generator owns work; JSON fallback uses a daemon thread. Preserve fiscal-year options, analysis follow-up and bucket notices |
| U2C | [reports.py](../app/routes/reports.py), `/api/reports/u2c/import-official` | Synchronous request, with existing cross-process lock and `SyncStatus` claim in [scheduled_sync.py](../app/services/scheduled_sync.py) |
| Marketing | [msx.py](../app/routes/msx.py), `/api/msx/sync-marketing` | SSE generator versus daemon fallback; worker exception handling must not leave a progress consumer hanging |
| Backup-all | [backup.py](../app/routes/backup.py), `/api/backup/backup-all` | SSE request runs the backup generator; non-SSE path runs synchronously |
| FY finalization | [admin.py](../app/routes/admin.py), `/api/admin/fy/finalize-stream` | Destructive workflow with confirmation and file cleanup. Audit separately; never expose as a one-click freshness-bar refresh |
| Revenue analysis | [revenue.py](../app/routes/revenue.py), `/revenue/analyze` | Request-owned analysis should become trackable background work |

Consumers include [admin_panel.html](../templates/admin_panel.html),
[milestone_tracker.html](../templates/milestone_tracker.html),
[revenue_import.html](../templates/revenue_import.html), and onboarding/sync
flows in [base.html](../templates/base.html). Several currently warn on leaving.
Do not just fix one page while leaving the same operation request-owned elsewhere.

The existing [progress-unification plan](PLAN_SYNC_PROGRESS_UNIFICATION.md)
addresses streaming plumbing and a marketing hang, not detached execution.
This plan broadens the ownership/API scope. Preserve its useful exception/drain
requirements, but do not build a competing queue or preserve request-owned work
merely to avoid changing SSE readers.

## Proposed architecture

### 1. Separate admission, execution and observation

```text
Page / bottom-bar launcher / scheduler
    -> validate and admit operation
    -> persist job + captured options/input references
    -> return job ID

Existing durable worker
    -> claim job
    -> run domain service under its own application context
    -> persist progress and terminal outcome

Any page or reopened status surface
    -> read job snapshot/history
    -> show current state without owning the work
```

Business logic stays in services. Move account-sync orchestration out of the
route closure; capture required request options before enqueueing. Workers must
not access `request`, `g`, request-bound sessions, or an open upload stream.
Resolve Azure credentials in the worker using the correct dev/production identity.
Do not persist tokens in job payloads or progress logs.

### 2. Durable run identity and progress

Extend the existing queue model where appropriate; determine precise columns and
related records during implementation, with idempotent migrations and no data loss.

Required persisted information:

- Source/type, validated options, scope, initiator kind and stable run/job identity.
- Queue/running/terminal state, attempt number, start/end times and result summary.
- Current stage, optional measurable percent, processed/total counts and message.
- Ordered step/event history with sequence/cursor, bounded retention and timings.
- Useful warnings/errors and whether earlier writes have already committed.
- Links between parent sync and follow-up work when completion depends on it.
- Last successful source refresh separately from the active/latest attempt.

Bind progress callbacks to a specific job/attempt, not module-global request
callback state. One operation's retries or messages must not leak into another.

Use existing queue states internally, with explicit display states for retry
waiting, worker unavailable, interruption and cancellation where supported.
Do not invent percent completion where a stage has no measurable total.
Record success only after required data writes and post-processing finish.
Keep U2C's refresh-check time distinct from MSXi's weekly publication/version.

Use UTC server timestamps and the shared UTC-to-local renderer. Preserve existing
naive-UTC SQLite comparison conventions at the storage boundary.

### 3. One shared job API and observer

Proposed routes, subject to the repository's blueprint conventions:

- `POST /api/jobs/start/<operation>`: validate/admit; return `202` and job ID/status URL.
- `GET /api/jobs/<job_id>`: persisted state, stage, progress, result and error.
- `GET /api/jobs`: the complete catalog, latest runs, retained successes and worker health.
- Optional read-only event/history endpoint using a sequence cursor.
- Explicit retry endpoint; optional cancellation endpoint for supported handlers.

Use an allowlisted operation registry, never arbitrary handler names from clients.
Keep existing start routes as adapters during migration, with all callers tested.
Validate early and recheck prerequisites at execution time. Repeated POSTs with an
idempotency key must recover the original job ID if the response was lost.
Different options for a conflicting active operation must not silently reuse the
wrong job or overwrite its payload.

Prefer a shared polling observer first, following the Transcriber reference.
Start with roughly 2-3 second visible polling for active jobs and slower idle
checks; pause hidden-page reads and refetch on return. Coalesce requests, preserve
focus, report read failures honestly, and abort only observation on disposal.
If SSE is retained later, it reads persisted progress with replay/reconnect
semantics. The SSE response never executes or cancels the underlying sync.

### 4. Worker health, concurrency and recovery

- Reuse the existing separate worker and supervisor. Make development start,
  restart and shutdown handle the worker reliably with the same DB and credentials.
- Persist before acknowledging admission. Distinguish "queued, waiting for worker"
  from "running"; never fake progress when no worker is consuming jobs.
- Make active-job admission atomic across processes, not check-then-insert.
  Define resource conflicts for full/customer syncs, FY operations, and analysis.
- Route scheduled/manual starts through the same admission rules, preserving
  cadence, catch-up behavior and nonfatal follow-up policy.
- Retain SQLite-safe sequential writes and short transactions. Progress writes
  must not contend with or roll back domain writes.
- A worker heartbeat proves liveness, not forward progress. Add stage activity
  timestamps and operation-specific timeout/stall diagnostics.
- On restart, recover queued work. Reclaim interrupted work only when its retry
  policy is safe. Use persisted checkpoints or idempotent upserts where proven;
  otherwise expose interruption and require an explicit retry.
- Never blindly rerun destructive FY/restore work, create duplicate external
  effects, or reset attempts/history to make an interrupted run look successful.
- Persist terminal errors even if no browser is attached. A failed future or
  missing progress sentinel cannot leave a job permanently "running".

### 5. Uploaded inputs and cancellation

For any file-based import found in the inventory, durably stage and validate the
input before accepting processing. Store a controlled file reference/checksum,
not a request stream or caller-supplied arbitrary path. Define staging cleanup,
retry lifetime, size limits and safe deletion after terminal processing.

Upload transfer itself cannot magically finish after its browser is closed.
The "safe to leave" guarantee starts after durable input/job acceptance; resumable
upload is a separate optional capability, not required to copy the MP3 pipeline.

Cancellation is cooperative, persisted and operation-specific. Queued jobs can
be withdrawn; running jobs need safe checks between units. Do not kill threads or
claim to undo already committed writes. Initial delivery can omit running-job
cancel controls until handlers have proven safe semantics.

## Proposed bottom-bar UX

Keep the current clean 24px band with its compact right-side Refresh status disclosure.
The left-view-count/center-date/right-disclosure balance is a visual trial, not
an approved background-job interaction contract.
Details stay on demand, not stacked under the calendar legend. Keep source order
Milestones, ACR, Accounts, U2C and equal text emphasis, not importance-based styling.
Do not add cards, permanent logs, new branding or a tall progress strip.

The current read-only popover is the starting point. Add per-source launch controls
there, or reveal a source's run details when its timestamp is selected:

- Last successful refresh and, if present, the active/latest attempt.
- Stage/counts and compact step history; full details/history available separately.
- A "Refresh now" action with prerequisites/options relevant to that source.
- An existing active run is shown instead of starting another copy.
- Running, queued, failed and completed states are unmistakable.

Dismiss it and continue working. Reopen it to inspect the same job. Keep "Refresh
status" as the bar disclosure and "Check now" as a read-only action; neither may
start four syncs accidentally.
Preserve existing details destinations via an explicit link. Default launches
use the existing supported operation options, not an inferred broad/destructive sync.

Do not reload the whole page when a job finishes or overwrite unsaved forms/drafts.
Invalidate affected caches and update safe views selectively; otherwise offer a
small "New data available" action. No focus-stealing completion modal.

The current slice uses the test console and existing import-page compatibility
observer. Wiring launch controls into the Home bar remains deferred.
If in-place launching must be available on every page, add one compact global
activity entry point to the shared shell in a separately reviewed UX slice.
Do not assume Home's footer already exists on note/report pages.

Keyboard activation, Escape/outside dismissal, focus return, accessible status
announcements and all existing themes are required. Validate only the actual
desktop Electron viewport; no mobile work.

## Implementation sequence

1. **Finish the inventory and operation contracts.** Include onboarding, manual
   and scheduled starts, customer-scoped variants, meeting/WorkIQ imports,
   marketing, favicons, backup/restore, alignment/FY flows, file imports and
   analysis. Classify long-running work; do not turn every small CRUD call into
   a job. Record prerequisites, conflicts, retries, partial writes and outputs.
2. **Extend the existing durable infrastructure.** Progress/history, last-success
   projection, atomic admission, domain-failure handling and worker health.
   Wire reliable development worker lifecycle. Add isolated tests before migration.
3. **Pilot Milestones end to end.** Worker-owned service, start/status contract,
   reopened progress page and scheduled/manual consistency. Prove navigation
   detachment before migrating another source.
4. **Migrate ACR, Accounts and U2C individually.** Preserve analysis/bucket
   notices, account alignment/onboarding and meeting follow-up, and U2C's
   existing locks/publication semantics. Review and test each bounded slice.
5. **Wire shared observation and in-place launchers.** Reuse one controller on
   existing pages and the Home freshness surface. Review the launcher UX with
   the user before building it. Add a global entry point only after that review.
6. **Migrate remaining long-running operations.** Marketing/meeting imports,
   analyses, backup and identified file workflows. Treat destructive
   restore/FY operations as separate, explicitly confirmed migrations.
7. **Remove obsolete lifecycle plumbing.** Search all templates, scripts,
   schedulers, services, tests and docs for request-owned execution and per-page
   sync navigation warnings. Remove only warnings for migrated jobs; retain
   warnings protecting genuinely unsaved edits.

Use a separate feature branch from main when this deferred work begins. Do not
implement it as an incidental continuation of the current UI checkpoint.
Keep the redesign tracker, related documentation and changelog accurate.
If any Electron-bundled change is necessary, use the shell-update changelog marker.

## Acceptance and tests

- Start from an import page, navigate away during a real active stage, return,
  and observe the same job ID advancing to its true terminal result.
- Repeat with reload, observer disconnection, panel dismissal, multiple tabs and
  an initially lost POST response. No duplicated work or loss of history.
- Start from the bottom bar while editing a real note; no navigation, focus
  theft, draft loss or forced page reload. Closing the surface does not cancel.
- Verify same/different-option duplicate admission and manual/scheduled conflicts
  using concurrent requests/processes, not merely sequential unit calls.
- Test worker unavailable/stale, restart recovery, safe retry/backoff, stalled
  stages, heartbeat-thread shutdown, explicit domain failure, malformed persisted
  payloads, partial writes and observer-only read failures.
- Test staged input lifetime and rejected/failed uploads separately from jobs.
- Verify queued cancellation and safe running cancellation only where supported.
- Last successful timestamps survive new attempts/failures; progress is accurate,
  and U2C publication version is not replaced with its check timestamp.
- Confirm every old launcher and status consumer agrees on the same run/outcome.
- Preserve account discovery, milestone task/comment/team behavior, ACR data and
  analysis, compensated buckets, U2C outcomes and onboarding ordering.
- Extend [test_job_queue.py](../tests/test_job_queue.py) and add focused API,
  progress-controller and operation-adapter tests. Use isolated pytest DBs and
  scoped suites only. Live verification uses the existing dev environment;
  do not trigger destructive workflows just to demonstrate detachment.
- New queryable job history/status needs a thin read tool in
  [salesiq_tools.py](../app/services/salesiq_tools.py) and coverage tests; tools
  must reuse the same services rather than duplicate state logic.

## Decisions to confirm when this work is scheduled

- Final popover/pane placement and whether the launcher is Home-only initially
  or available throughout the desktop shell.
- Worker-down admission policy: accept a clearly waiting durable job or reject
  with repair guidance. Never report successful execution merely for acceptance.
- Per-operation automatic retry/recovery and cancellation boundaries.
- History/log retention limits and whether persisted events warrant SSE later.
- Which views update live versus show an unobtrusive "New data available" action.

## This planning pass does not do

No runtime changes, schema migrations, sync starts, file imports, dependency
installation, queue execution, commits, pushes, merges or deployments. The Home
freshness bar remains a read-only status observer until this plan is implemented
and the proposed launch UX is approved.
