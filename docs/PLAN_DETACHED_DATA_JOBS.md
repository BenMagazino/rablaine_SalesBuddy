# Plan: Detached import, sync and refresh jobs

**Status:** Deferred, not implemented.
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

### Sales Buddy already has part of the foundation

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

### Current disconnect-sensitive entry points

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

- `POST /api/jobs/<operation>`: validate/admit; return `202` and job ID/status URL.
- `GET /api/jobs/<job_id>`: persisted state, stage, progress, result and error.
- `GET /api/jobs?source=...`: active run plus bounded recent history for a source.
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

Initially wire the Home bar plus existing import pages to the shared observer.
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
