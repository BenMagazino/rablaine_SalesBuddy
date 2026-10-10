# Fabric consumption imports

Fabric consumption is a **manual import only**. It is not registered with the
scheduler and does not run during account sync, revenue sync, or app startup.
Power BI access uses the current Azure CLI sign-in and respects the source
model's row-level security.

Open **Reports > Fabric Consumption** and select **Import from MSXi**.
The import runs independently of the page, so you can navigate away and return
to its progress. The report lists every local customer, marks those without a
valid TPID, and distinguishes missing measurements from numeric zero.
Choose a customer for workload shares, per-tenant/capacity operation details,
SKU metrics, throttling, and hourly utilization history. Large operation and
history tables display 200 rows per page; sorting applies within each page.
The capacity graph uses the full saved history and does not clamp utilization
at 100%. Its dotted reference line marks the 80% scale-up threshold and its
dashed reference line represents 100% of capacity. Both also appear in hover previews.
Hover over the Inspect capacity graph to see the nearest saved hourly point's
date, time (UTC), and utilization in a hover box beside the graph point, with a
marker on the graph. Missing measurements
are explicitly labeled. Keyboard users can focus the graph and use arrow keys,
Home, or End to inspect points.

**Capacity overview** switches to one row per customer/capacity, including
placeholder rows for customers without capacities. All filtered rows sort
together by consumption, CU hours, or any workload percentage. Consumption and
CU hours use source-retained capacity history; hovering a **Used %** value shows
the native latest-hour utilization, or explicitly indicates a missing measurement.
Workload shares are customer-wide rolling
28-day shares repeated on each capacity, not per-capacity shares. An absent
workload is shown as zero only when known workload measures reconcile to the
positive customer total; otherwise it remains unknown. Sort any workload
column to compare customer usage.
Both views share the Fabric Consumption header and tab-style navigation:
**Customer detail** and **Capacity overview**. Both complete report surfaces are
centered at a maximum width of 1536px, shrinking when the window is narrower.
The report header, tabs, filters, and content share the same edges, with
surface-colored content and subtle borders against canvas-colored gutters.
App navigation, breadcrumbs, and the bottom status rail remain full width.
Customer links in the overview select that row's capacity under **Inspect capacity**
in customer detail. Links use tenant and capacity IDs, not display numbering, so
trial-first ordering does not change the target. Capacity selection stays in the
URL across reloads; selecting another customer clears it.

Opening either view reuses the existing snapshot and never starts an MSXi import.
The shared **Import from MSXi** command is available in both views, with the same
status, in the right side of the tab row, shows only the last successful snapshot
date after completion, rather than timestamps or row counts. Failed attempts do not
replace the successful date. After an import finishes, the active
view refreshes its saved data. The selected customer's heading is a single
**Customer Name (TPID)** link to their customer profile.
During an import, the tab row shows only the source's live progress percentage and
message, in that order, left-aligned in a compact 300px status area on the right.
The percentage stays anchored as messages change; longer messages truncate.
Hovering the status reveals the full message.
Refreshing or switching views reconnects to the ongoing backend import;
it does not cancel it. Stopping or restarting the Flask backend interrupts the import.
Browser reload re-reads that snapshot. Use **Import from MSXi** only when
you want fresh source measurements; customer detail updates automatically
when an import it is monitoring completes.
The overview uses one persistent segmented view selector: **All customers**,
**Only customers with capacities** (the initial default), **Trial audit**, or
**P-SKU audit**. Audit modes are mutually exclusive and automatically exclude rows
without capacities. Search combines with the selected mode. The detail view's
**Only customers with capacities** checkbox remains an independent preference.

Capacity numbers such as `1/3` identify each capacity within a customer. They
are stable across table sorting and filtering, and match the detail view.
Hover, focus, or click a number to see its full tenant/capacity identifiers,
SKU, and utilization. Escape dismisses the popup. Short workload headings
(DI, DW, DE/DS, PBI, RTI) retain full names on hover.
The overview scrolls in both directions when its content exceeds the work
region; the customer column stays pinned during horizontal scrolling.
Zeros and missing values use quieter text without changing their meaning.
Customer detail shows the workload chart and capacity utilization first.
Full workload tables, capacity metrics, and hourly outcomes are expandable,
so all imported measurements remain available without dominating the page.
The customer capacity table lists every capacity without a height cap.
Its sortable average utilization column uses consumed CU divided by available
CU including autoscale over the source-retained history, immediately after the capacity label.
This is capacity-weighted utilization, not
an arithmetic mean of hourly percentages or a fabricated full-month average.
Hover, focus, or click average utilization to preview that capacity's saved
history graph. The popup and detail chart share the same renderer and points;
previewing another capacity does not change the selected detail capacity.
Identity popups sit just left of the capacity label and graph popups just right
of the average utilization, leaving both columns accessible for scanning
successive rows. Previews switch sides when space near the viewport edge is limited.
Capacity hover cards show the customer's assigned seller below the heading,
using the current local assignment rather than the imported snapshot.
Fabric Consumption remembers the last successfully viewed customer in localStorage.
Opening the page without a customer in the URL restores that customer; explicit
customer links take precedence. Deleted customers are cleared from the saved selection.
Capacity Overview's **Trial audit** mode selects customers
with an imported FTL4 or FTL64 capacity and includes all their capacity rows,
including paid SKUs. It reflects the saved snapshot, not
live trial status or proof that migration is underway.
In Trial audit, each customer's capacities are numbered with
trial SKUs first, then paid SKUs. Numbering uses all that customer's capacities
before search filtering. Leaving audit modes restores normal numbering; metric sorting
still controls the displayed row order when selected.
FTL and P SKU labels remain highlighted in the normal overview, without either
audit mode selected. Trial audit additionally colors FTL Used % values
from green at 0%, through amber at 25%, to full red at 50%
and above. Missing measurements and paid-capacity values retain neutral styling.
The **P-SKU audit** mode similarly includes all capacities
for customers with P-number SKUs and numbers P capacities first.
It does not color usage percentages. Search does not change numbering, and metric
sorting still controls displayed row order.

## Backend entry points

- `app.services.fabric_consumption.sync_fabric_consumption(progress=None, *, claimed=False)`
  imports every current database customer's numeric TPID. The optional callback
  receives progress dictionaries. The result contains `success`, `import_id`,
  and row/customer counts, or `success: false` with an `error`.
  `claimed=True` is reserved for a route that already acquired the atomic
  `SyncStatus` claim. The service renews its heartbeat every 20 seconds and
  persists progress and completion for page-independent polling.
- `get_fabric_report(customer_id=None)` returns `snapshot`, the full `customers`
  directory, selected `customer` detail, `totals`, and source `metadata`.
  Selected detail includes workload shares, operation details, capacity/SKU
  summaries, and nested UTC time-series points. Customers without source data
  remain visible with null metrics.
- `has_fabric_data()` reports whether a complete snapshot exists.

`FabricConsumptionImport` stores the successful snapshot header.
`FabricConsumptionRecord` stores customer totals, capacity workload totals,
workload/operation details, capacity summaries, and trends. Numeric metrics use
JSON to retain all report measures without replacing unknown values with zeros.
Only the latest successful snapshot is retained. All result sets are fetched and
validated before one transaction replaces it. Network errors, truncation,
out-of-scope accounts, missing result families, and non-reconciling consumption
detail preserve the previous snapshot.

## Source semantics

The reports share semantic model `27b59ca8-3fcf-47ee-9db3-f05f0f2b4188`:

- Workload report: `ab993815-0671-4c70-b07f-dc9b96dff8c0`
- Capacity report: `ed8e1bea-f0fd-4603-81fb-7ed8bd7bc3e6`

`Account.Account TPID` is a display label containing the account name and TPID,
not a numeric join key. Queries use the separate numeric `Account.TPID` column.
The report's top-500 account subquery is removed. All configured TPIDs are
queried in chunks with complete cursor pagination and strict scope checks.
High-volume workload-operation and time-series queries are additionally
subchunked by discovered capacity IDs, rather than issuing one unbounded query
for a large account batch.

Workload queries preserve PROD/MSIT, Fabric/Fabric Trial/Power BI Premium,
notification, and 365-day calendar context ending yesterday on the Power BI
service's UTC clock, not the desktop's local clock. The model's
`CU Hours (28d)` measure defines the actual rolling workload window.
Workload percentages use the reported CU-hour denominator, not a guessed sum
of selected workloads. Customer workload numerators are queried directly at
workload grain rather than inferred from operation rows, which can legitimately
have blank current-period CU hours while retaining prior-period growth measures.
MAU is read in a separate query to avoid an expensive cross-fact query plan.
Details retain tenant, capacity, SKU, workload, artifact,
and operation grain. Direct Lake is an overlapping subset of consumption and
must not be added to workload totals.

Capacity queries preserve the NRT report's retained-history context. NRT history
is not the same period as the rolling 28-day workload measures. Report-native
latest utilization, maximum 30-second utilization, users, throttling,
rejections, autoscale, and unsmoothed CU hours are retained. The additional
history-wide utilization is calculated as:

```
100 * (interactive CU seconds + background CU seconds)
    / (available CU seconds + available autoscale CU seconds)
```

Missing operands or a nonpositive denominator produce null. Percentages may
exceed 100 and are not capped. The captured maximum-30-second measure's
divide-by-zero fallback is deliberately changed from zero to null, so an
unavailable denominator is not reported as zero utilization.
Time-series rows retain successful, failed,
cancelled, rejected, invalid, and in-progress operation counts.

The HAR's Unix-millisecond NRT timestamps match its UTC as-of label. They are
stored and returned as UTC. The report labels its Pacific display as "PST"
even during daylight saving time; display conversion should use
`America/Los_Angeles`, not a fixed minus-eight-hour offset.

Authentication and DSR decoding reuse the existing revenue reader's stateless
helpers. Fabric keeps its own report/model/MWC state and never changes revenue
configuration or its cached report token.
