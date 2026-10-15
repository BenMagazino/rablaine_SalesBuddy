# P to F

Reports > P to F reads Power BI Premium renewal details and the published
Premium-to-Fabric renewal assessments. Customer names and links come from Sales
Buddy, joined by TPID; the original source name is retained in saved data.

## Source and scope

- Report: `7f2070e7-0ebf-4e95-a788-3eb59d0ed833`.
- Dataset: `9de04ab0-f2d4-46ec-aabb-894827b3496f`.
- Account assessments: `\u25e6 Fabric WCS`.
- Subscription details: `\u25e6 Fabric WCS (Detail)`.
- Queries include all valid local customer TPIDs, using the signed-in user's
  source permissions. The capture's exclusions for US Federal and blank account
  SubSegment remain in effect.
- The fiscal window contains two prior years, the current year and the next year,
  using Microsoft's July boundary. On October 15, 2026, that is FY25 through FY28.
- Full expiration dates come from the source DateTime columns. `01-Jun-27` is
  the stored June 1 date, not a day inferred from the visual's `Jun 2027` label.
  Expirations are calendar dates and do not shift with the user's timezone.

## Interpreting the rows

The report and customer Fabric tabs show one subscription-details table.
Renewal Status replaces PSKU Renewal $ as the final column. Subscription Status
describes the subscription; Renewal Status is an account assessment joined by
TPID. Distinct statuses from multiple assessment rows are listed together,
without duplicating subscription rows or choosing one assessment arbitrarily.
Missing assessments display as Not supplied. Assessment amounts are not added
to subscription-detail amounts, and the separate assessment table is not shown.
Renewal Status uses green checks for renewed assessments, amber alerts for
pending or partial renewals, and red crosses for Not Renewed. Labels remain
visible alongside the icons, and unrecognized source statuses stay neutral.
Hover over a status or focus it with the keyboard for its source threshold
explanation. The popup defines P-SKU and F-SKU and does not invent a rule for
Not Renewed or other undocumented source statuses.

The source calculation legend applies these conditions in order:

1. Both P-SKU and F-SKU renewal ratios are at least 75%:
   **PSKU Renewed + New Fabric**.
2. Only P-SKU is at least 75%: **PSKU Renewed**.
3. Only F-SKU is at least 75%: **P-to-F Renewed**.
4. F-SKU is at least 30% but below 75%: **Partial P-to-F**.
5. Otherwise: **Pending Renewal**.

The model also returns **Not Renewed**, which the captured legend does not
explain. Sales Buddy imports the actual model statuses and ratios rather than
reimplementing an incomplete formula. Percentages above 100% are valid source
values. Blank dollar amounts remain missing, not zero.

F-SKU RI and PAYG ACR are annualized source measures, not reservation inventory,
contract commitments, or amounts to add to renewal dollars. SA Expiration $ and
PSKU Renewal $ retain the source's dollar values without currency conversion.
The capture does not establish a fuller definition of the SA abbreviation.

## Refresh and storage

P to F is part of the durable `fabric` sync. Refreshing from either the Fabric
360 report or P to F report runs telemetry, revenue and renewals in one job, with
one progress indicator and no separate P to F operation in Sync Status.
The weekly scheduler checks at startup and every five minutes. If either the
Fabric or renewal snapshot is missing or at least seven days old, it queues the
shared job. Automatic work requires the current Data SE specialty in SE Mode,
including a recheck when a queued job executes. Other specialties and DSS Mode
can refresh manually. Failed/interrupted overdue attempts wait an hour before
the scheduler retries.

The existing complete-pagination Power BI reader uses a report-isolated token
and dataset identity. Both result families must finish and validate before a
single transaction replaces the previous snapshot. Failed imports retain saved
data; a verified complete empty response can remove obsolete rows.
Each source retains its own atomic snapshot. If telemetry succeeds but renewals
fail, the shared job reports failure explicitly: refreshed telemetry remains,
and the previous complete renewal snapshot is retained.

New tables `ptof_imports` and `ptof_records` are created idempotently by the
application's existing `db.create_all()` startup path. No existing table or
column changes are required. Customer views lazy-load saved P to F data above
Fabric consumption, hide the section when no rows exist, and show explicit read
errors with Retry. The customer Fabric tab shows data only, without report
headers, explanations, import timestamps, sync status, or refresh controls.
Renewal details appear under P to F Status. Workload mix shows its chart without
the four summary metrics, rolling-window caption, or expandable workload tables;
those remain on the standalone Fabric report.
Use the standalone reports or Sync Status to refresh data.
The `report_ptof` SalesIQ tool reuses the same read service.
