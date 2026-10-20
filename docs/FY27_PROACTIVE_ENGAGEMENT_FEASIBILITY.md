# FY27 Proactive Data & Analytics Engagement: Feasibility

**Prepared:** October 19, 2026  
**Status:** Planning and discovery only. No reports, widgets, or schema changes implemented.

## Bottom line

Sales Buddy already has enough data and infrastructure to build a useful proactive
engagement dashboard without starting a new data platform.

- **Already usable:** P-to-F renewal and Fabric capacity pressure widgets, Initiative
  Tracker, and the existing Connect whitespace-wins widget.
- **Good next builds:** a Synapse modernization widget, Fabric workload-expansion
  queues, and a saved-trial-capacity follow-up queue.
- **Possible with more work:** a consolidated motion worklist, broader Microsoft-estate
  modernization, acquisition prospecting, and progress tracking across signals and work.
- **Not reliably knowable today:** on-prem SQL inventory and renewals, competitive
  non-Azure estates, actual trial expiry, M365 licensing whitespace, governance maturity,
  or funding eligibility and approvals.

The key distinction is **a prospecting signal is not a qualified opportunity, a
migration recommendation, or a completed outcome**. We can surface reasons to
engage now without pretending we know the customer's entire estate.

## Scope and evidence

This assessment uses the FY27 motion descriptions supplied by the product owner
as the planning brief. It does not independently validate official field guidance,
the 40% SQL migration target, program rules, or Josh Lee's Fabric Dashboard.

The review inspected the current models, report services, widget registry,
filtering, and sync behavior. A read-only check of the existing development
database confirmed populated revenue, strategic-pillar, Fabric, P-to-F, marketing,
opportunity, milestone, and engagement data. No customer records were changed.
Account names, financial amounts, and account-level findings are intentionally
excluded from this document.

Verified source vocabulary includes:

- Synapse, including Dedicated SQL Pool; Azure Analysis Services; Azure Data
  Explorer; and Azure Databricks product revenue.
- AI and scenario signals including Foundry Agents, Azure OpenAI, Machine Learning,
  Event Hubs, Stream Analytics, IoT Hub, and Arc-related products.
- Fabric workload summaries named `Power BI`, `OneLake`, `Data Integration`,
  `Data Warehousing Core`, `DE and DS`, `Real Time Intelligence`, `Copilot`,
  `AppDev`, `Planning`, and `SQLDb`.
- Fabric capacity records containing F-SKUs, recognized trial-audit SKUs, and P-SKUs.
- Source-defined strategic pillars, including AI, Analytics, and Databases.

These observations establish that useful source families are present, not that
every local customer has complete or current data.

### Effort labels

These describe implementation shape, not delivery commitments.

| Label | Meaning |
| --- | --- |
| Ready | Report and widget already exist; assemble a dashboard. |
| Small | Thin report-backed provider, widget presentation, registration, and scoped tests. No new source or schema. |
| Medium | New cohort rules, joins, drilldowns, or classifications using existing data. More than a wrapper. |
| Large | New imports, durable workflow/history, source discovery, or substantial validation. Access dependencies may dominate. |
| Blocked today | The authoritative evidence is not currently stored or its availability has not been established. |

## 1. What we can do now with little work

### Existing building blocks

| Building block | What it already provides | Remaining work |
| --- | --- | --- |
| Upcoming P-to-F renewals | Subscription expirations in the next 90 days, source renewal assessments, and annual SA expiration amounts. | **Ready.** Add the existing widget to a dashboard. This is Power BI Premium renewal data, not SQL renewal data. |
| Fabric capacity pressure | Saved throttling and utilization signals, summary counts, and an attention shortlist linked to the full report. | **Ready.** Add the existing widget. Counts describe capacities, not necessarily unique customers. |
| Initiative Tracker | Named initiatives containing existing engagements, milestones, and projects, with linked work and ACR summaries. | **Ready** for manually grouping work under these motions. It is not an automated prospect-management system. |
| Connect whitespace wins | Existing Fabric/database ramping and sustained-win calculations. | **Ready** as an outcome-oriented companion. Its FY27 setup gates and confirmed definitions remain intact; it is not a prospect list. |
| Custom dashboards | Multiple dashboards, library previews, summary/detail variants, persisted layouts, and Customer/Seller filters. | **Ready.** We do not need a new dashboard builder. |

### Small, useful additions

#### A. Synapse modernization prospects

**Fastest useful version:** expose the existing Synapse report as a widget.

- Summary: number of accounts in the report's selected cohort.
- Detailed: customer, seller, latest complete-month Synapse ACR, four-month average,
  and links to the report and customer.
- Reuse the product-user calculations rather than implementing a second Synapse query
  inside the widget.
- Explicitly label the period and cohort.

**Important existing behavior:** the report defaults to **new** users. Its
**current** view actually includes customers with any historical positive spend,
even if their latest month is zero. Neither label alone defines a current migration
prospect. First observed use also means first use in imported history, not necessarily
the customer's actual adoption date.

Effort is **Small** for an accurately labeled wrapper. A genuinely prioritized
modernization queue is **Medium**: define recent positive spend, preserve historical
users separately, and optionally add Fabric adoption and existing-work context.
Do not silently change the original report's cohort while building the widget.

#### B. Fabric workload expansion

The saved workload summaries already support:

- Ranking measured customers by Power BI share.
- Showing customers with only one positive measured workload.
- Finding measured estates with no observed OneLake, warehouse, or RTI usage.
- Linking directly to Fabric Consumption for the underlying workload mix.

A ranked workload-mix widget is **Small to Medium**. A full multi-cohort report
with configurable thresholds is **Medium**.

Start with actual percentages and positive-workload counts rather than declaring
an arbitrary BI-heavy cutoff to be official FY27 policy. The supplied field-wide
"under 5%" observation is not automatically a per-customer qualification rule.

Use customer-wide workload summaries once per customer. The overview repeats
those shares on every capacity row; adding those rows together would double-count.
Only interpret an absent workload as zero when the known workload measures
reconcile to a positive total. Otherwise the answer is unknown.

#### C. Trial-capacity follow-up

The existing Fabric overview already has Trial audit behavior using `FTL4` and
`FTL64` and includes a customer's other capacities for context.

A widget can surface:

- Customers with recognized trial SKUs in the saved snapshot.
- Observed paid F-SKU capacity alongside the trial, if present.
- Saved utilization and observed workload mix.
- Links to investigate in Fabric Consumption.

This is **Small to Medium** if we extract/reuse the same audit predicate rather
than introducing inconsistent SKU rules.

Call it **Trial follow-up**, not **Active trials expiring soon**. A trial SKU in
a saved snapshot does not establish current trial validity, expiry, procurement
status, or that no paid Fabric exists elsewhere.

## 2. Feasibility across all proposed motions

| Motion | Useful version using today's data | Effort | What that version cannot establish |
| --- | --- | --- | --- |
| Fabric modernization | Synapse prospects first; extend to AAS, ADX, and Azure Databricks using observed product revenue. Overlay Fabric adoption and linked work. | Small for Synapse wrapper; Medium for broader cohort/report. | Suitability, migration complexity, complete legacy EDW inventory, or competitive estate. Azure Databricks spend is not non-Azure Databricks evidence. |
| Fabric acquisition | Rank accounts with relevant Analytics/Data/AI signals and no observed Fabric ACR in the current month plus the previous three months. Missing revenue observations count as $0; the report can include all current customers regardless of other spend. Accounts flagged stale after dropping out of account sync are excluded. | Medium. | True absence of Fabric, M365 licensing, procurement intent, or tenant-wide non-adoption. Missing revenue does not establish non-adoption. |
| Fabric expansion | Rank Power BI-dominant or narrow-workload measured estates; identify unobserved target workloads. | Small to Medium. | Business readiness, workload fit, or separately measured DE and DS adoption from the combined summary alone. |
| Fabric trial conversion | Recognized trial-capacity snapshot plus paid-capacity/revenue context and follow-up work. | Small to Medium for signal queue; Large for actual conversion tracking. | Active/expired status, expiry dates, or historical trial-to-paid conversion without additional evidence/history. |
| Power BI to Fabric | Existing P-to-F renewal widget plus P-SKU and workload-mix context. | Ready for renewals; Medium for consolidation. | A complete Power BI Pro/PPU/license estate, or proof that renewal equals broader Fabric adoption. |
| RTI | Direct observed RTI usage for expansion, plus Event Hubs, Stream Analytics, and IoT consumption as discovery signals. Notes and engagements can add confirmed context. | Medium. | External Kafka inventory, streaming architecture, or automatic proof that RTI should replace the current platform. |
| Data/AI foundation | Foundry Agents/OpenAI/ML consumption and relevant linked work, paired with observed Fabric/workload context. | Medium for candidate discovery; Large for validated foundation assessment. | Whether data is governed, mature, agent-ready, or architecturally needs Fabric. Missing Fabric is not missing governance. |
| SQL migration | Surface observed Azure SQL/SQL VM/Arc footprints and explicitly recorded migration work as conversation starters. | Medium for cloud-footprint/work queues; Blocked today for renewal-driven on-prem qualification. | On-prem SQL server counts, versions, renewals, EOS exposure, or the 40% migration denominator. |
| DB modernization | Database pillar/product footprint, growth/decline, and linked modernization engagements or milestones. | Medium for a proxy worklist; Large for validated propensity/assessment. | Estate topology, compatibility, migration readiness, third-party/on-prem inventory, or best target architecture. |
| Arc bridge | Observed Arc-related consumption and manually confirmed bridge engagements. | Medium for signal/work visibility; Blocked today for automatic bridge qualification. | That Arc consumption represents SQL, that the customer cannot migrate this cycle, or why Arc is the right recommendation. |

One customer can legitimately appear in several rows. For example, Synapse
modernization, a P-to-F renewal, and RTI expansion are separate reasons to engage,
not three distinct customers.

## 3. What is feasible but takes substantial work

### A. One consolidated proactive engagement worklist

Existing reports can supply evidence, but no single service currently normalizes
all these signals into an account-and-motion queue.

Useful additions would include:

- One customer row with multiple motion badges and drilldown evidence.
- Current seller assignment, source dates, measured periods, and unknown-data flags.
- Linked active engagements, opportunities, milestones, and open actions.
- A distinction between "candidate with no linked qualifying work" and "already engaged."
- Separate counts for unique customers, motion matches, capacities, and subscriptions.
- Ranking by visible signals, not an unexplained propensity score.

**Effort: Medium** for a read-only consolidation over existing records.
**Large** if it includes persistent qualification, dismissal/snooze, ownership
changes, next-review dates, saved reasons, or motion history.

Absence of linked work only means we found no matching local work. MSX data is
cached/scoped, and links may be incomplete. An unrelated active opportunity must
not automatically suppress a customer's other motion candidates.

### B. Microsoft-estate modernization beyond Synapse

We can query existing AAS, ADX, Databricks, and other observed product families.
The harder work is agreeing what each signal means, consolidating SKUs, validating
recency, and matching work to the correct source platform and target scenario.

Use explicit, tested product-family mappings. For example, Dedicated SQL Pool is
visible under Synapse labels; a standalone "SQL DW" label is not a safe prerequisite.
Product spend can prioritize a conversation, not certify migration suitability.

### C. Durable motion execution and outcomes

We can begin immediately with Initiative Tracker sections such as Modernize to
Fabric, Drive New Analytics, and Database Modernization, linking existing work.

True end-to-end reporting needs more:

`Signal -> qualified -> assessment/proposal -> funded engagement -> delivery -> observed outcome`

That would require agreed states, evidence links, timestamps, and attribution
rules. Existing engagement/milestone status is useful context but does not encode
all these steps. Won or committed work is not automatically migrated production
workload or realized consumption.

### D. Conversion and adoption trends across snapshots

Revenue accumulates monthly history. Fabric retains source-provided capacity
history, but its import replaces the prior Fabric snapshot. P-to-F also replaces
its previous snapshot.

This supports saved telemetry investigation, not a complete historical series of
trial membership, workload classifications, or renewal assessment transitions.
Reliable "trial converted," "adopted RTI this quarter," and cohort funnel reporting
need durable observations or another authoritative history source.

### E. Official propensity and funding integration

Importing a validated propensity list or program feed is technically plausible,
but its source, permissions, fields, identity grain, refresh rules, and allowed
use must first be established. The same applies to using additional measures from
Josh Lee's dashboard: its contents and access have not been inspected here.

Manual recording can track an assessment or funding discussion earlier, but must
be labeled user-confirmed, not an official eligibility or approval result.

## 4. What we cannot reliably do today, and why

These are current evidence limitations, not declarations that future integration
is impossible.

| Desired answer | Missing evidence or constraint | What would unblock it |
| --- | --- | --- |
| Every on-prem SQL server, its version, and its renewal/EOS event | No authoritative server inventory, SQL renewal feed, or server-level lifecycle mapping is currently modeled. Cloud ACR and P-to-F renewals cannot substitute. | Approved inventory/renewal source, server-to-account mapping, and validated lifecycle definitions. |
| Progress against "move 40% of on-prem SQL servers" | No agreed baseline server population or verified per-server migration outcome. | Dated baseline, inclusion rules, durable server identities, and outcomes linked to the same population. |
| Customers on Snowflake, non-Azure Databricks, or other non-Azure EDWs | Azure revenue is not a competitive-estate inventory. Text mentions or compete-threat levels are incomplete evidence. | Authoritative competitive/propensity data or explicit customer-confirmed structured records. |
| M365 customers with no Fabric adoption | No complete M365 licensing/deployment feed joined to the relevant customer/tenant population. | Approved M365 account/tenant data plus Fabric coverage and agreed adoption criteria. |
| Full Power BI-only estate | P-SKU renewals, embedded-product revenue, and saved workload telemetry cover different slices, not all Power BI licenses or usage. | Broader licensing/usage coverage and clear account/tenant reconciliation. |
| Live trials, expiry countdowns, and verified conversion | Saved capacity SKUs are not trial lifecycle records; prior membership snapshots are replaced. | Trial entitlement/start/expiry data and conversion evidence/history. |
| Governance maturity and agent-ready data quality | No authoritative catalog, lineage, access-policy, data-quality, or governance-assessment feed. | A defined assessment and validated customer/tool evidence. |
| A reliable DE-versus-DS split | The imported workload summary combines them as `DE and DS`. Operation/artifact detail exists, but a complete classification has not been established. | Validated detailed mapping or separate authoritative source measures. |
| A complete Kafka/streaming/IoT architecture | Consumption products and notes are partial signals, not architecture inventory. | Customer-confirmed architecture or an approved discovery source. |
| Official Frontier Accelerate eligibility, allocations, approvals, or Factory delivery | No verified program integration or complete structured program lifecycle is stored. | Approved program source and rules, or clearly labeled manual evidence for narrower tracking. |
| Why an account cannot migrate this cycle | Revenue and Arc presence do not record the decision, constraints, or timing. | Explicit qualification with customer-confirmed reasons and review date. |

## 5. Recommended delivery sequence

### Pass 1: A useful dashboard without a new workflow system

1. Assemble existing P-to-F renewals and Fabric capacity pressure widgets.
2. Build the Synapse widget, explicitly distinguishing historical users from
   recently spending candidates.
3. Add a Fabric workload-mix/expansion widget.
4. Add Trial follow-up if the saved capacity audit is useful in daily prospecting.
5. Use Initiative Tracker to group the engagements and milestones we actually pursue.

This gives us modernization, renewal, expansion, trial follow-up, and execution
visibility while staying close to existing code.

### Pass 2: Consolidate prospecting and contextual work

Build a report with multiple reasons to engage per customer, product-family
coverage beyond Synapse, and linked-work context. Reuse the same providers in its
widgets and SalesIQ tools.

Add acquisition, RTI, and Data/AI foundation discovery as clearly labeled
heuristics, not claims of complete estate knowledge.

### Pass 3: Add sources and durable qualification only where justified

Prioritize SQL inventory/renewals, competitive propensity, trial lifecycle, or
program tracking based on actual source access and seller value. Do not design a
large schema around data we have not established we can receive.

## 6. Implementation guardrails

- **Report first, shared provider underneath.** Keep eligibility and calculations
  in services; reports, widgets, and SalesIQ call the same logic. The presentation
  can change later without rewriting the business rules.
- **Keep motion, signal, and work separate.** Use the three parent motions from
  the brief, with acquisition/expansion/trial/RTI/etc. as submotions or cohort
  labels. A customer can have many signals; an engagement can address several.
  These are working labels, not a proposed database schema yet.
- **Preserve real filter behavior.** Reuse Customer/Seller dashboard filters and
  apply them before totals, ranking, and previews. Do not filter only the displayed
  rows. Motion, workload, and territory filters would be additional work.
- **Keep reusable prospects independent of Connect gates.** General prospect
  widgets should not accidentally inherit the Connect FY27 compensation setup
  requirement or its sustained-win definition.
- **Honor missing data.** Distinguish known zero, missing measurements, no imported
  snapshot, invalid/unmatched identity, and out-of-scope source coverage.
  "No observed paid Fabric" is not "customer has no Fabric."
- **Use stable identities.** Prefer local customer IDs and validated TPIDs for
  joins, not names. Capacity identity includes tenant plus capacity; subscription,
  customer, and workload grains must stay distinct.
- **Keep time and units explicit.** Monthly ACR, annual renewal amounts, rolling
  28-day CU, latest-hour capacity pressure, and estimated pipeline are different
  measures. Never add them into a single dollar total.
- **Show freshness per source.** Revenue, Fabric telemetry, renewal assessments,
  marketing, and cached MSX work refresh separately. Automatic Fabric/P-to-F refresh
  is currently weekly for Data SEs and sellers; manual refresh remains available. Reading a
  widget must not launch imports.
- **Do not overstate history.** Use complete months for revenue comparisons and
  preserve unknown/gap states. Observed changes do not prove that an engagement
  caused them.
- **Wire every surface.** New analytical reports belong in the reports blueprint,
  Reports navigation, and reports hub. Register widget variants and read tools,
  update tool-coverage tests, and test provider/report/widget scope parity.
- **Treat the existing Synapse placement as legacy.** Its `/reports/` URL is
  currently served from the revenue blueprint. Extract reusable service logic
  where necessary, but put new analytical endpoints in the reports blueprint
  rather than expanding revenue management.
- **Keep small widgets genuinely small.** Use summary variants at quarter/third
  widths and investigative lists at half/full widths. A preview limit must not
  change the full cohort count.

Before building each new cohort, confirm its recency window, positive-usage rule,
unknown-data handling, and whether ranking alone is sufficient or a threshold is
actually needed. We do not need all future qualification decisions to ship Pass 1.

## Code references

| Area | Current implementation |
| --- | --- |
| Widget catalog, variants, and providers | [dashboards.py](../app/services/dashboards.py) |
| Customer/Seller filter resolution | [dashboard_filters.py](../app/services/dashboard_filters.py) |
| Existing Synapse route and default mode | [revenue.py](../app/routes/revenue.py) |
| Consolidated product users and revenue windows | [revenue_import.py](../app/services/revenue_import.py) |
| Revenue, Fabric, renewal, marketing, and work models | [models.py](../app/models.py) |
| Fabric workload/capacity reports and pressure provider | [fabric_consumption.py](../app/services/fabric_consumption.py) |
| Imported Fabric source measures | [fabric_consumption_pull.py](../app/services/fabric_consumption_pull.py) |
| P-to-F report and renewal widget provider | [ptof.py](../app/services/ptof.py) |
| Current automatic refresh eligibility and interval | [scheduled_sync.py](../app/services/scheduled_sync.py) |
| Source-defined pillar whitespace | [whitespace.py](../app/services/whitespace.py) |
| Existing Connect whitespace outcome definitions | [connect_goals.py](../app/services/connect_goals.py) |
| Initiative Tracker and linked-work presentation | [manager_one_on_one.py](../app/services/manager_one_on_one.py) |
| Marketing source import | [marketing_sync.py](../app/services/marketing_sync.py) |
| Read-tool registration | [salesiq_tools.py](../app/services/salesiq_tools.py) |

**Documentation caveat:** the opening manual-only sync description in
[fabric_consumption.md](./fabric_consumption.md) predates the current scheduler.
This assessment follows the current scheduler code and the newer shared-sync
description in [p_to_f.md](./p_to_f.md), not that obsolete scheduling statement.
