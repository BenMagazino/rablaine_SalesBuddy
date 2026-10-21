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
- **Data + AI:** a real cross-platform attach scenario, not a generic
  "AI-ready foundation" assessment.
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
| Fabric trial conversion | [x] | [x] | Existing trial follow-up; align to Trial -> Paid targeting. |
| P to F | [x] | [x] | Keep the management-supplied renewal motion. |
| Fabric modernization | [x] | [x] | Keep as modernization signals; add named source submotions. |
| Real-Time Intelligence | [x] | [x] | Streaming customers without RTI usage, including Fabric entry points. |

Fabric Capacity Pressure is also an existing supporting report/widget, not a new
database motion or proof of a qualified expansion opportunity.

## Recommended build order from the response

1. Database Whitespace.
2. SQL Renewals.
3. SQL EOS / ESU.
4. AI/Foundry -> Fabric Attach.
5. Database Expansion.
6. Refactor Fabric Modernization into named submotions.

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
The response describes the target as an **active Fabric trial with no Fabric ACR**.

- Existing widget finds saved trial SKUs, shows P/F-capacity overlap and 15-day
  utilization, and splits observed usage at 0.1%.
- [x] Use a trial capacity present in the latest synced snapshot as active for this workflow.
- [ ] Rename the user-facing motion to Trial -> Paid.
- [ ] Add the no-Fabric-ACR target cohort without hiding useful paid/trial context.
- [x] Keep engagement creation and trial -> F-SKU conversion tracking manual.
  The user creates an engagement from the surfaced insight and tracks the outcome;
  automatic conversion detection is not part of this change.

### Acquire / cross-platform: AI/Foundry -> Fabric Attach

**Direction:** Replace the old Data/AI foundation concept with
**Fabric attach to AI / Unify Data Estate for AI**.

Seller action: determine what governed enterprise data and business context the
customer's AI/agent workloads require; qualify Fabric/OneLake/Fabric IQ as the
supporting platform where appropriate.

- [ ] Confirm segment-specific targeting and the source product/measure mapping.
- [ ] Build an AI-investment plus absent/underpenetrated-Fabric candidate queue.
- [ ] Show AI/Foundry, Fabric, database and analytics context.
- [ ] Include relevant known AI/Foundry pipeline where available.
- [ ] Add a shared report, widget and read tool; verify and place on the dashboard.

The response cites an SME&C targeting example of **Foundry >$1,000/month and
Fabric <$1,000/month**. Confirm applicability, measurement window and product
definitions before implementing it. Do not substitute the entire AI pillar for
Foundry without evidence. Another cited land scenario combines low Foundry/low
Fabric with meaningful M365/D365 footprint; those terms and sources remain undefined.

AI consumption is not proof of poor governance, missing foundations or a Fabric need.

### Acquire: Competitive / third-party Fabric acquisition

- [ ] Establish available, customer-confirmed competitive/third-party estate evidence.
- [ ] Define an actionable candidate cohort before implementing a queue.

This is an additional play in the response, not a delivered feature. Azure
Databricks ACR does not establish a non-Azure Databricks or competing-platform estate.

### Modernize: Named sources -> Fabric

**Direction:** Retain Fabric Modernization as a signals umbrella, with explicit
legacy-source subtypes rather than treating all adjacent spend equivalently.

- [ ] Make Synapse -> Fabric an explicit submotion.
- [ ] Add ADF / pipeline -> Fabric discovery using verified source mappings.
- [ ] Retain AAS, ADX and Azure Databricks as clearly identified source signals.
- [ ] Distinguish customer-confirmed consolidation/migration work from observed spend.
- [ ] Agree evidence for outcomes such as consolidation, retired workloads, reduced
  cost/complexity and a governed data foundation.

Existing report averages three complete months. Its $50/$100 three-month cutoffs
and the widget's Other Analytics > Fabric rule are local implementation heuristics.
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

### Acquire: Database Whitespace - priority 1

**Direction:** Make this a first-class queue, not an incidental database filter.
The response identifies DatabaseWhiteSpace in the manager's motion workbook.

- [ ] Confirm which Azure database products/pillars count and the stable zero-spend window.
- [ ] Identify accounts with $0 observed Azure database ACR over that window.
- [ ] Show/rank adjacent Azure, Fabric and AI footprint.
- [ ] Add known on-prem database evidence where trustworthy and available.
- [ ] Define missing-data and current-account scope explicitly.
- [ ] Build shared report/widget/read tool; test and add to the dashboard.
- [ ] Separate acquisition candidates from sustained new database-consumption wins.

Do not copy Fabric's $2,000 widget cutoff or lookback blindly. The response suggests
analogous candidate logic and continuous-consumption outcomes, not identical rules.

### Modernize: SQL Renewal & Migration - priority 2

**Direction:** Replace generic SQL-consumption prospecting with a compelling-event queue.

- [ ] Establish renewal dates, on-prem SQL evidence and source freshness/provenance.
- [ ] Prioritize upcoming renewals, EOS/ESU exposure and assessment/migration evidence.
- [ ] Use existing Azure SQL consumption as context, not the source population.
- [ ] Show linked MSX opportunities, milestones and confirmed customer work.
- [ ] Build shared report/widget/read tool; test and add to the dashboard.

**Source warning:** The response says management could not verify the discovered
on-prem report and considered it more than a month stale. Do not use it as
authoritative eligibility evidence without validation.

### Modernize: SQL EOS / ESU - priority 3

**Direction:** Make SQL 2016 EOS/ESU an explicit queue, not a generic Arc tile.

- [ ] Establish authoritative SQL-version/EOS/ESU exposure and relevant dates.
- [ ] Show affected footprint, renewal timing, Arc presence and existing Azure SQL.
- [ ] Link assessments, migration work and MSX opportunity/milestone status.
- [ ] Support customer-confirmed paths: migrate, modernize, Arc/ESU bridge or blocked/deferred.
- [ ] Build shared report/widget/read tool; test and add to the dashboard.

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

### Expand: Database Consumption Growth - priority 5

**Direction:** Replace the old generic DB modernization concept with a distinct
existing-consumer expansion queue.

- [ ] Define the database consumption measure and comparable complete-month windows.
- [ ] Identify existing consumers with low, stagnant or declining consumption as
  discovery signals; validate whether low penetration is actually known.
- [ ] Show month-over-month growth and customer-confirmed expansion/modernization work.
- [ ] Build shared report/widget/read tool; test and add to the dashboard.
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
- [ ] Enterprise Majors Growth Plan, reportedly updated October 20:
  Foundry/Fabric attach scenarios and SME&C targeting applicability.
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
