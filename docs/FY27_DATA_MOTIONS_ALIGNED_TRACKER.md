# FY27 Data Motions: Revised Guidance and Delivery Tracker

Updated: October 20, 2026.

## Purpose and evidence

This tracker follows the work-context review in [response.md](../response.md).
Use it for future prioritization and definition alignment. Preserve the
[original implementation tracker](./FY27_DATA_MOTIONS_TRACKER.md) as the record
of the initial six delivered scopes, not proof of complete FY27 motion coverage.

The response reports managerial guidance and document contents, but does not
provide direct source links or formal citations. Those claims are supplied context,
not independently verified primary-source evidence. Source confirmation remains
an explicit task below. No reports, widgets or business rules change merely
because this document is created.

### Corrected strategic scope

- **Fabric:** acquisition/whitespace, modernization and workload expansion.
- **Databases:** acquisition/whitespace, renewal/EOS-driven modernization and
  consumption expansion.
- **Data + AI:** covered by existing Fabric Acquisition. The user explicitly declined
  a separate AI/Foundry attach report, widget or targeting view.
- **RTI:** a streaming-to-Fabric entry point or workload-expansion play for customers
  without RTI usage, including those with no Fabric capacity.
- **Arc/ESU:** a path within SQL renewal/EOS/migration, not a standalone headline motion.

The response attributes success measures to management as:

- Database consumption growth, including month-over-month growth.
- New Fabric wins in whitespace accounts with continuing consumption.
- Fabric workload expansion and consumption growth.

**Candidate signals, customer qualification, work in progress and achieved
outcomes must remain separate.** Do not add overlapping motion counts and label
the result unique customers.

## Completion rules

- Existing implementation/placement checks below record already delivered work.
- New checklist items track changes required by the revised guidance.
- A built queue is not a qualified opportunity or a completed customer outcome.
- Mark new implementation complete only after its cohort, source, date window,
  missing-data behavior and shared report/widget calculation are tested.
- Mark dashboard placement complete only after the user confirms it.
- Confirm managerial definitions separately from implementation correctness.

## Existing implementation baseline

| Existing deliverable | Coded | Dashboard | Revised interpretation |
| --- | --- | --- | --- |
| Fabric acquisition | [x] | [x] | Keep as Fabric Whitespace candidate generation. |
| Fabric expansion | [x] | [x] | Keep the Power BI-heavy workload-expansion queue. |
| Trial to Paid | [x] | [x] | Trial capacities without paid F-SKUs, linked to the matching audit. |
| P to F | [x] | [x] | Keep the management-supplied renewal motion. |
| Fabric modernization | [x] | [x] | Keep as modernization signals; add named source submotions. |
| Real-Time Intelligence | [x] | [x] | Streaming customers without RTI usage, including Fabric entry points. |
| Database whitespace | [x] | [x] | Grid-backed Database gaps with AI, Analytics or Apps spend; user confirmed complete. |
| Database expansion | [x] | [x] | Analyzer-backed growth and consumption-risk signals; user confirmed complete on October 21. |

Fabric Capacity Pressure is also an existing supporting report/widget, not a new
database motion or proof of a qualified expansion opportunity.

## Remaining additions

1. SQL Renewals.
2. SQL EOS / ESU.

The database growth motion reuses Revenue Analyzer. Its motion widget includes
growth opportunities and consumption risks, without a separate report or scoring engine.
Database Whitespace is complete. Named-source Fabric Modernization refinements are
implemented. On October 20, the user confirmed that existing Fabric Acquisition
is sufficient for AI attach; no separate addition is planned.

Keep the Fabric targeting/wording corrections below visible alongside this order.
Do not silently substitute the old "four remaining motions" backlog.

## Fabric work register

### Acquire: Fabric Whitespace

**Direction:** Keep the existing acquisition report/widget. The response maps it
to management's FabricWhiteSpace motion.

- Existing queue: no positive monthly net Fabric ACR in the current partial month
  or previous three months; missing revenue observations count as $0.
- Default report uses adjacent AI/Databases/Other Analytics spend. Its All customers
  option removes that requirement. Widgets retain the $2,000/month footprint cutoff.
- Dropped/stale accounts are excluded. This is account scope, not qualification.

Follow-up:

- [ ] Confirm the cited managerial whitespace outcome definition.
- [ ] Treat the $2,000 cutoff as prioritization/noise suppression, not policy.
- [ ] Verify/reuse existing whitespace outcome logic where appropriate: the response
  describes at least three zero months followed by at least three consumption months,
  with consumption continuing. Do not confuse this with the current candidate window.
- [ ] Distinguish candidates from sustained new-consumption wins.

### Acquire: Trial -> Paid

**Direction:** Retain trial discovery, but tighten the business interpretation.
The response suggested active trials without Fabric ACR. The user's clarified
implementation rule is **a trial capacity and no paid F SKU**. Do not add a separate
ACR eligibility requirement.

- Existing widget finds saved trial SKUs, shows P/F-capacity overlap and 15-day
  utilization, and splits observed usage at 0.1%.
- [x] Use a trial capacity present in the latest synced snapshot as active for this workflow.
- [x] Rename the user-facing motion to Trial to Paid.
- [x] Exclude customers with any paid F SKU from both widget variants and all their cohorts.
  Retain eligible P-SKU customers and the existing utilization/history calculations.
- [x] Keep Details focused on Customer, Avg used and History rather than SKU-overlap columns.
- [x] Add a matching Trial to Paid audit in Fabric Consumption and link the widget to it.
  Keep the broader Trial audit, remove the all-customer overview option, and map old
  links/preferences for that removed option to the capacities view.
- [x] Remove the redundant P-only overview selection and its filtering code.
  Keep P-SKU badges/context and use the separate P to F report for renewal audits.
  Old links/preferences for the removed selection open the capacities view.
- [x] Verify the native latest-snapshot and cross-tenant paid F exclusions, scope filters,
  utilization queues and read tool. Live audit and both widget variants agree on
  21 customers (11 getting started, 10 building momentum), including 2 with P-SKUs.
- [x] Keep engagement creation and trial -> F-SKU conversion tracking manual.
  The user creates an engagement from the surfaced insight and tracks the outcome;
  automatic conversion detection is not part of this change.

### Acquire / cross-platform: AI/Foundry -> Fabric Attach

**Decision:** Not planned as a separate addition. On October 20, 2026, the user
confirmed that existing Fabric Acquisition is sufficient for AI attach.
Do not build an additional report, widget or AI-led targeting view for this motion.

### Acquire: Competitive / third-party Fabric acquisition

- [ ] Establish available, customer-confirmed competitive/third-party estate evidence.
- [ ] Define an actionable candidate cohort before implementing a queue.

This is an additional play in the response, not a delivered feature. Azure
Databricks ACR does not establish a non-Azure Databricks or competing-platform estate.

### Modernize: Named sources -> Fabric

**Direction:** Retain Fabric Modernization as a signals umbrella, with explicit
legacy-source subtypes rather than treating all adjacent spend equivalently.

- [x] Identify Synapse -> Fabric with a dotted underline on the widget's Other Analytics
  amount when net Synapse revenue is positive. Hover text says "Includes Synapse".
- [x] Add ADF / pipeline -> Fabric discovery using verified local source names:
  Azure Data Factory v2, Data Flow and Managed Airflow.
- [x] Retain AAS, ADX and Azure Databricks under Other Analytics, alongside Synapse.
  Keep ADF separate in the report and both widget variants. Synapse-branded pipelines
  stay in Synapse and are not counted again as ADF.
- [x] Verify report/widget totals, indicator eligibility, scope, cutoffs and complete-month
  boundaries in scoped tests. The live widget shows 22 candidates, including 7
  ADF-only customers, with no horizontal overflow at its saved half-width size.
- [ ] Distinguish customer-confirmed consolidation/migration work from observed spend.
- [ ] Agree evidence for outcomes such as consolidation, retired workloads, reduced
  cost/complexity and a governed data foundation.

The report uses the last three complete calendar months, averaging each customer's
spend over its available months within that window, or $0 when no months are available.
Summary amounts sum these customer-level averages. Its $50/$100 combined Other Analytics
plus ADF three-month cutoffs and the widget's combined-source > Fabric rule are
local implementation heuristics. ADF-only prospects can qualify.
Confirm before changing them; do not label them managerial qualification rules.

### Modernize: P2F

**Direction:** Keep the supplied renewal report and widget.

- Summary covers the next 90 days; Details includes all dated future renewals.
- [ ] Confirm which actioned/completed migration fields the supplied workbook exposes.
- [ ] Keep renewal timing/status separate from verified migration completion.

### Expand: Fabric workload expansion

**Direction:** Keep the existing queue. The response attributes direct managerial
support to targeting disproportionately Power BI-heavy Fabric customers.

- Existing scope: paid F-SKU, complete rolling 28-day workload mix and >=80% Power BI.
- Displays SKU context, utilization and workloads above 1%.
- [ ] Keep 80% and 1% labeled as operational thresholds, not official policy.
- [ ] Define next-workload plays: OneLake, DE, DW, integration, RTI and IQ as appropriate.
- [ ] Confirm which plays have measurable source evidence; do not infer separate
  DE/DS adoption from the combined source summary.
- [ ] Relate expansion work to new workload adoption and consumption growth.

Capacity pressure remains a supporting expansion signal, not proof that more
capacity or a particular workload is the correct recommendation.

### Acquire / Expand: Streaming -> RTI

**Direction:** Surface only streaming customers without RTI usage. This is an entry
point to Fabric when no Fabric capacity exists, not only an expansion opportunity.

- Current inputs: native rolling 28-day RTI CU-hours/share plus Event Hubs, ASA and
  IoT average monthly ACR over the last three complete months.
- [x] Require positive net ACR in at least one of Event Hubs, ASA or IoT over the
  last three complete months, with no minimum spend cutoff.
- [x] Exclude customers with positive RTI usage, even when streaming ACR is positive.
- [x] Treat missing RTI measurements as 0 in eligibility, the report, widgets and read tool.
  Accounts without Fabric data qualify through their streaming consumption.
- [x] Reuse the shared calculation and preserve existing dashboard placements and scope filters.
- [x] Omit zero-only RTI columns from report/widget tables; retain customer and streaming ACR.
- [x] Verify shared report/widget counts in tests and the live development app:
  111 scoped RTI/SalesIQ tests pass. Live grouped/flat reports, API and both widget
  variants agree on 35 prospects, with no positive RTI usage. The saved half-width
  Details widget has no horizontal overflow.

RTI CU-hours remain rolling 28-day measurements. ACR uses three-month totals
divided by three and excludes the current month. Engagement creation and
trial -> F-SKU conversion tracking remain manual.

## Database work register

### Acquire: Database Whitespace - complete

**Direction:** Make this a first-class queue, not an incidental database filter.
The response identifies DatabaseWhiteSpace in the manager's motion workbook.

**Status:** User confirmed the discovery report/widget complete on October 20, 2026.
On-prem evidence and achieved-outcome tracking remain follow-ups, not blockers for this scope.

- [x] Reuse the existing source-defined Databases pillar and Whitespace Grid window:
  62 days before the latest imported month, averaging stored monthly pillar totals.
  The user explicitly chose the existing report rules, without a Fabric-style rewrite.
- [x] Identify customers without Databases coverage in that grid and with positive
  AI, Analytics or Apps coverage. Developer, Infra and Security alone do not qualify.
  Missing target coverage is a gap; all-zero accounts remain outside the grid.
  Preserve the report's net-credit and current account scope.
- [x] Rank and total only AI, Analytics (including Fabric) and Apps footprint.
- [ ] Add known on-prem database evidence where trustworthy and available.
- [x] Share the unchanged grid calculation between the existing report and widgets,
  without an additional minimum spend, stale-account exclusion or calendar window.
- [x] Build Summary/Details widgets, customer/seller scope, seller grouping, pillar
  source readiness and a shared SalesIQ read tool. Scoped tests cover report parity.
- [x] Verify 101 scoped Python and 54 JavaScript tests, plus live report/widget parity:
  41 qualifying customers, identical monthly amounts and 5 seller groups.
  Details is saved at half width on FY27 Data Motions,
  with no horizontal overflow and existing placements/filters preserved.
- [x] Add a generic Focus whitespace selector, independent of displayed spend columns,
  using the existing seller grouping. The widget opens the same AI/Analytics/Apps-qualified
  Database cohort with those three spend columns, excluding existing Database coverage.
  Hide the focused pillar's
  zero-only column without changing saved column selections.
  Normal saved focus, column and sort preferences are unchanged by this linked visit.
- [x] Verify focused navigation, column-independent qualification and seller grouping.
  Generic focus retains all-pillar coverage; the Database widget entry uses only
  AI, Analytics or Apps coverage regardless of the displayed columns.
- [x] Confirm the development dashboard placement with the user.
- [ ] Separate acquisition candidates from sustained new database-consumption wins.

Do not copy Fabric's $2,000 widget cutoff or lookback blindly. The response suggests
analogous candidate logic and continuous-consumption outcomes, not identical rules.

### Modernize: SQL Renewal & Migration - priority 1

**Direction:** Replace generic SQL-consumption prospecting with a compelling-event queue.

- [x] Establish source-reported renewal dates, on-prem SA license cores and source
  freshness/provenance, without claiming the feed is a verified customer estate.
- [x] List all future SQL expirations nearest first, including zero and unknown
  amounts; show the inclusive next-90-day count without capping the full queue.
- [x] Show capped SQL-on-IaaS cores and modeled monthly ACR as context, not the
  source population or qualified migration pipeline.
- [ ] Add customer-confirmed assessment and migration evidence.
- [ ] Show linked MSX opportunities, milestones and confirmed customer work.
- [x] Build SQL Renewals report, Summary/Details widgets and shared SalesIQ read
  tool. Apply current customer/seller scope to the complete calculation and carry
  exact scope into the report. Sellers display only when explicitly grouped.
- [x] Pull Azure Migrations and ADS Accelerate Arc together through one atomic
  SQL Motions job, manual report controls, widget readiness and weekly scheduling.
  Both sources must validate before a saved snapshot changes; successful empty
  snapshots are ready and failed imports preserve the previous complete snapshot.
- [x] Verify live shared import: 206 current accounts, 206 account-level migration
  rows, 850 subscription/version/category Arc rows; 56 future renewal customers,
  8 within 90 days. Verify native library previews, grouping, padding and reports.
- [x] Pass 551 scoped Python and 74 JavaScript tests across the new SQL source,
  atomic sync, reports/tools, queue/scheduling, dashboard integration and shared
  widget/export regressions. Verify live one-customer/empty scope parity and
  unchanged saved dashboard layout and local editor draft.
- [x] User approved the saved widget placement on October 21, 2026. Capture the
  ten-widget FY27 Data Motions v1 dashboard as a template installed once on upgrade.

**Source warning:** The response says management could not verify the discovered
on-prem report and considered it more than a month stale. Do not use it as
authoritative eligibility evidence without validation.

#### SQL source audit: October 21, 2026

Live read-only Power BI queries succeeded against the Azure Migrations model
`6fabe7d5-5892-4900-ae69-a1664e35ab8d`, backing Power BI report
`638cab13-868e-4b0b-8c63-45818ba14848`. The MSXi wrapper report is
`dd4b53f0-63b6-45a6-9ae7-eb11d07469e6`, SQL Renewals tab.

All 206 active development customer TPIDs matched. This audit used explicit
customer scope without copying the report's segment/geography exclusions:

| Available signal | Active customers with evidence |
| --- | ---: |
| Next SQL expiration date | 56 |
| Positive next SQL expiration amount | 44 |
| Positive SQL install-base measure | 121 |
| Positive modeled monthly SQL opportunity | 113 |
| Positive SQL-on-IaaS capped cores | 56 |

These populations overlap and are not qualified migration opportunities.

- **Renewal feed:** Next-up date/amount measures and raw expiration date, renewal
  date, product categories, annual exit revenue and record-modification timestamps
  are queryable. Renewal records were stamped October 21. Validate next-up measure
  logic and dollar semantics before labeling amounts as contract value.
- **Estate definitions:** The report glossary defines SQL install base as on-prem
  SQL license cores with Software Assurance, not server or instance counts.
  SQL-on-IaaS capped cores are an estimated Azure footprint capped at that base.
  Monthly SQL opportunity is a finance-assumption model, not customer-qualified
  pipeline. Reuse native measures rather than summing monthly snapshots.
- **Freshness:** The source status lists on-prem install base refreshed October 7
  on a monthly cadence; its raw processing stamp is October 6. Account/pipeline
  data refreshed October 20 and Arc metrics October 21. SQL attributes were
  stamped October 20. These timestamps do not verify the customer's actual estate.
- **Azure Migrations EOS gap:** The seven observed SQL attribute labels include
  `SQL ESU (2012 or 2014)`, not SQL 2016. Explicit ESU consumption fields concern
  SQL 2012. No SQL 2016 version inventory, affected cores, entitlement or ESU
  coverage was established from this model. The additional Arc source below
  supplies version-specific evidence. An old-version label is not proof of
  uncovered exposure.
- **Workflow context:** Assessment type/status, migration stage/tools and
  opportunity/milestone identifiers exist in the schema/capture. Additional live
  queries for that context returned Power BI internal errors, so current retrieval
  and joins remain unverified.
- **App integration, corrected after user guidance:** The initial 401 probe used
  the wrong CLI context. The existing `%USERPROFILE%\SalesBuddyDev\.azure`
  corporate sign-in works. With that process-scoped context, the existing QES
  client successfully pulled renewal evidence for 56 active customers, without
  product-code changes or a new sign-in. Next-up amounts arrive as numbers or
  numeric strings; dates arrive as epoch milliseconds. Normalize these explicitly
  when implementing the importer.

Next: validate renewal measure definitions and report filter behavior, then
implement the renewal queue. Use the Arc evidence below for SQL 2016 candidates,
without assuming uncovered ESU exposure or complete estate coverage.

#### Additional Arc version source audit: October 21, 2026

The user supplied `sqlarcversion.har`, capturing **ADS Accelerate Execution**,
MSXi wrapper report `a1b4fb49-ca8b-401d-b511-64138045add2`. Its Power BI report is
`c91bff6e-45ab-477b-90dc-5226a19ea1e2`, model
`4a6b504b-b557-4012-9aa3-d875cb9252b2`
(`WWBI_MSXI_ADSAccelerateInitiative_OneAMP`).

- **Version evidence found:** `ARC BY License Type` provides TPID, subscription
  ID/display name, SQLVersion, DiscoveryType, Value and processed_timestamp.
  Additional fields include paid Standard/Enterprise, nonproduction, blocked,
  unknown-state and missing-SQL-extension counts. Their presence does not establish
  SQL 2016 ESU coverage or entitlement.
- **Live application pull verified:** The existing QES client, with the isolated
  dev identity, returned 711 account/version/category rows across 47 of the 206
  active dev customers. SQL Server 2016 has positive `All Discovered` values on
  **26 accounts**, totaling **295 source-defined discovery counts**. The count
  unit still needs confirmation; do not call it license cores or physical servers.
  Accounts without rows are unknown, not verified free of old SQL versions.
- **No double counting:** Discovery categories include All Discovered, Enterprise,
  Standard, Non Production and NA. Count only All Discovered for overall discovery
  totals, not All Discovered plus its component categories. The captured detail
  visual explicitly excludes All Discovered, unlike the version chart.
- **Scope:** Audit pulls used explicit active TPIDs, without the captured report's
  nonblank pipeline-stage and HQ/DS filters. Do not silently require an existing
  opportunity to discover an account's SQL 2016 footprint.
- **Freshness:** Scoped Arc data was processed October 21 at 12:14:25 UTC.
  The source quality table reports `RptARCByLicenseTypeVersionOneLake` as Pass
  at 11:51:12 UTC. Separately, `RptConsumptionOpportunity` reports
  `Fail: Row count variance > 15.0%`; do not imply all supporting pipeline data
  passed just because the Arc feed did.
- **Access:** Power BI Copilot schema access rejected this model's Read-only
  permission level. Normal report reads through the app's QES transport succeeded;
  no captured credentials, permission changes or access-control workarounds were used.

This closes the missing SQL 2016 candidate-discovery evidence, not the entire
EOS/ESU qualification gap. Still establish count semantics, eligible production
footprint, actual ESU coverage/entitlement, lifecycle mapping and customer validation.

**Source consolidation check:** A live comparison using the same 206 active TPIDs
found 33 accounts in ADS Expirations and 9 in ADS Subscription Renewals, with
positive amounts in each respective population. Only 27 of Azure Migrations'
56 next-SQL-expiration accounts appeared in ADS Expirations; 28 of the 56 were
absent from both ADS renewal tables. Populations overlap and must not be added.
ADS expiration data is month-level, whereas the original source exposes exact
expiration/renewal dates. The models may differ in eligibility or upstream
definitions; no equivalence was established. Keep Azure Migrations for renewal
coverage and ADS Accelerate for version-specific Arc evidence rather than silently
substituting the latter for both motions.

**Historical workbook reconciliation:** Read the user's `FY27 Motions.xlsx`
without saving or changing it, and compared `SQLRenewalsESU` with fresh live pulls
on October 21. Its 1,375 rows represent 1,373 TPIDs overall; 114 accounts remain
in the current 206-account active dev scope. All 114 are present as unique account
rows in the ADS estate feed, and 95 have identical Enterprise/Standard core pairs
(including any zero pairs). Of the 29 scoped workbook rows with expiration dates,
10 dates are already past. All 19 remaining future expiration dates exactly match
Azure Migrations' next-SQL-expiration date; 15 also match the expiration amount
within one cent. Four amount comparisons do not match and remain to be explained.
This is strong renewal-source reconciliation, not proof of unchanged amounts.
The workbook's ESU labels do not state SQL version or ESU coverage. Of 26 current
SQL 2016 candidate accounts, 22 appear somewhere in its SQL tab; do not equate
the workbook's generic ESU cohort with the version-specific SQL 2016 queue.

### Modernize: SQL EOS / ESU - priority 2

**Direction:** Make SQL 2016 EOS/ESU an explicit queue, not a generic Arc tile.

**Candidate source:** The audited ADS Accelerate Arc feed above supplies explicit
SQL 2016 evidence for 26 active dev accounts. ESU coverage and eligibility are
still unverified; missing discovery rows must not imply no exposure.

- [ ] Establish authoritative SQL-version/EOS/ESU exposure and relevant dates.
- [x] Build an explicit SQL Server 2016 discovery queue from positive All Discovered
  observations only. Do not add overlapping license categories or historical
  processing snapshots. Other old SQL versions do not qualify.
- [x] Show account totals, observed subscription counts and expandable subscription
  evidence. Keep this queue focused on SQL 2016
  discovery rather than unrelated account-level renewal signals.
- [ ] Confirm affected production footprint, ESU protection and customer estate completeness.
- [ ] Link assessments, migration work and MSX opportunity/milestone status.
- [ ] Support customer-confirmed paths: migrate, modernize, Arc/ESU bridge or blocked/deferred.
- [x] Build SQL 2016 EOS / ESU report, Summary/Details widgets and shared SalesIQ
  read tool, using the same SQL Motions snapshot and scope rules as SQL Renewals.
  Keep ESU protection explicitly unknown and the discovery unit unverified.
- [x] Verify live 26-customer cohort and 295 source-defined discovery counts against
  the earlier audit. Verify grouped/ungrouped native previews and subscription detail.
  Upstream quality notes and refresh dates are available in the report, without
  implying that passing checks prove a current or complete customer estate.
- [x] User approved the saved widget placement on October 21, 2026. The FY27 Data
  Motions v1 template preserves the approved layout and seller/grouping controls.

Do not infer SQL version, EOS exposure or ESU eligibility from cloud/Arc spend alone.

### Modernize: Database migration paths

These are subtypes within the database modernization family, not automatically
separate dashboard tiles:

- SQL modernization -> Azure SQL DB / MI.
- On-prem SQL -> Azure SQL VM / MI.
- Oracle -> Azure SQL / PostgreSQL.
- PostgreSQL and MySQL modernization.
- Arc/ESU bridge when immediate migration is not feasible.

- [ ] Confirm the taxonomy, target evidence and overlap with renewal/EOS queues.
- [ ] Record customer-confirmed source/target and the reason for a bridge or deferral.

### Expand: Database Consumption Growth - priority 3

**Direction:** Reuse the existing Revenue Analyzer for this motion, not a separate
report, widget or set of trend calculations.

- [x] Agree to reuse the analyzer; the separate implementation was discarded on October 21.
- [x] Confirm the analyzer already has a Databases bucket and product drill-downs.
- [x] Agree to include both growth opportunities and consumption risks, keeping
  their labels and estimates separate. Small/flat spend alone does not qualify.
- [x] Reuse saved Databases alerts with priority 20+, New/To be reviewed status and
  Expansion Outreach or Check-in recommendations, excluding Monitor/No action.
- [x] Apply motion scope before the normal top-50 limit, with identical report and
  widget membership. Existing normal analyzer bucket filtering remains unchanged.
- [x] Reuse the revenue widget presentation in Database Expansion Summary/Details,
  linking to the existing analyzer preset with customer/seller scope preserved and
  normal bucket preferences untouched. No new trend calculation or standalone report.
- [x] Verify 216 scoped Python and 37 JavaScript tests, live five-row parity
  (3 growth, 2 risk), scoped/empty click-throughs, exports and product/review dialogs.
  Save half-width Details beside Database Whitespace without changing other widgets.
- [x] Confirm live widget placement and user review on October 21, 2026.
- [ ] Link customer-confirmed expansion/modernization work and achieved outcomes.
- [ ] Assess database + Fabric attach through mirroring/OneLake where appropriate.

The response cites a managerial example of consumers below $5,000/month. This is
an investigative cohort, not a universal cutoff or proof of expansion potential.

## Source confirmation checklist

The response attributes the guidance to these references. Obtain primary links
and confirm applicable segment, dates and definitions before treating details as policy.

- [ ] Josh Lee's July 9 direction: Databases and Fabric priorities and success measures.
- [ ] May 15 FY27 Motions workbook: P2F, Synapse2Fabric, SQL Renewals,
  SQL 2016 ESU, FabricWhiteSpace and DatabaseWhiteSpace.
- [ ] September 24 whitespace clarification and sustained-consumption definition.
- [ ] October 1 Alex/Josh 1:1: Power BI-heavy expansion and database-growth cohorts.
- [ ] FY27 Job 2 guidance: Fabric workloads, migrations, RTI and mirroring.
- [ ] Active-trial/no-Fabric-ACR targeting and September 3 Trial -> Paid guidance.
- [ ] Current SQL execution resources, workload taxonomy and on-prem source warning.
- [ ] Fabric preload workflow: validate signals, engage, then qualify/block/close with reasons.

## Cross-cutting backlog

- [ ] Distinguish signal, validated candidate, in-progress work and achieved outcome.
- [ ] Define whether Qualified, Blocked and closed-with-reason states should be stored
  in Sales Buddy, mapped to existing MSX state or remain manual.
- [ ] Retain source dates, evidence, scope and unknown-data flags.
- [ ] Keep reports, widgets and read tools on shared business logic.
- [ ] Preserve existing delivered behavior until an intentional rule change is agreed.
- [ ] Review the revised tracker with the user before starting the next build.
