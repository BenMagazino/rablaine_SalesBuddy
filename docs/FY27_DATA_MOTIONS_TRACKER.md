# FY27 Data Motions Implementation Tracker

Working checklist for [section 2 of the proactive engagement feasibility assessment](./FY27_PROACTIVE_ENGAGEMENT_FEASIBILITY.md#2-feasibility-across-all-proposed-motions).

Check **Coded** when the intended report/widget works and has been verified.
Check **Added** when it is placed on your FY27 Data Motions dashboard.
Check a motion's heading when both are complete for the scope you chose.
Dashboard placement stays unchecked until you confirm it.

## Checklist

### 1. [ ] Fabric modernization

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Customers with positive Synapse, AAS, ADX, or Azure Databricks
  revenue over the last three complete calendar months, alongside Fabric spend
  for the same period.
- **Boundary:** Consumption signals are not migration-readiness assessments.
  Azure Databricks is not evidence of non-Azure Databricks.
- **Report/widget:** Fabric Modernization report, replacing Synapse Customers.
  Summary and Details widgets show report-qualified customers whose Other Analytics spend
  exceeds Fabric spend, with seller sorting and viewer-controlled seller grouping.
  Summary includes their count and combined Other Analytics spend for the same period.
- **Revenue cutoffs:** Exclude Other Analytics totals below $50, or below $100 with positive
  Fabric spend, using unrounded three-month net totals.
- **Notes / follow-up:** One row per customer, source-product columns and Fabric Capacity
  revenue, grouped by current seller. Partial monthly coverage is explicit.
  Report and widget validated against saved revenue; user review and dashboard placement
  remain pending.

### 2. [ ] Fabric acquisition

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Relevant Analytics/Data/AI footprint with no observed
  Fabric ACR in a defined, covered period.
- **Boundary:** Missing coverage stays unknown. No observed Fabric ACR does not
  prove no Fabric adoption, and does not establish M365 licensing.
- **Report/widget:**
- **Notes / follow-up:**

### 3. [x] Fabric expansion

- [x] Coded
- [x] Added to dashboard
- **Starting scope:** Power BI-dominant or narrow-workload measured estates,
  with target workloads not observed in the available data.
- **Boundary:** Usage mix does not establish workload fit or business readiness.
  The source summary combines Data Engineering and Data Science.
- **Report/widget:** Fabric expansion, Summary / Details. Links to Fabric Consumption
  > Capacity overview > F-SKU audit, one row per customer.
- **Notes / follow-up:** Single Power BI-led queue (80%+ Power BI consumption).
  Only customers with paid F-SKUs qualify; Details shows their largest F-SKU
  with P/Trial context, average capacity utilization, PBI share, and
  known workloads above 1%, with optional seller grouping in the viewer Filters panel.
  Incomplete mixes remain excluded. Added to the FY27 Data Motions dashboard
  and confirmed complete for this scope.

### 4. [x] Fabric trial conversion

- [x] Coded
- [x] Added to dashboard
- **Starting scope:** Summary counts of customers with saved Fabric trials,
  customers with P-SKUs and trials, and customers with F-SKUs and trials.
- **Boundary:** Saved SKUs do not establish active/expired status, expiry dates,
  or verified conversion. Actual conversion tracking requires more evidence/history.
- **Report/widget:** Fabric trial conversion, Summary / Details. Links to Fabric Consumption
  > Capacity overview > Trial audit.
- **Notes / follow-up:** Counts distinct customers, not capacities. P/F groups can
  overlap. Details lists each customer once, split below/at-or-above 0.1% average
  trial utilization. Shows P/F-SKU context and average observed history days
  across trials, using the saved source's trailing 15-day window. Customer links
  open Fabric detail; the table scrolls within the chosen widget height.
  Added to the FY27 Data Motions dashboard and confirmed actionable.

### 5. [x] Power BI to Fabric

- [x] Coded
- [x] Added to dashboard
- **Scope:** Surface management's supplied P-to-F customer list through the
  existing report and the widget we just built. No additional discovery or
  workload-mix analysis is required for this motion.
- **Report/widget:** Upcoming P-to-F renewals, Summary / Details.
- **Notes:** Details covers all dated future renewals in the
  saved report and shows customer/product, expiration, and renewal status.
  The table scrolls within the widget, keeping the title and column headings visible.
  Summary retains the next 90 days. Added to the FY27 Data Motions dashboard;
  future layout adjustments do not affect completion.

### 6. [ ] RTI

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Observed RTI usage for expansion, plus Event Hubs,
  Stream Analytics, and IoT consumption for discovery. Add confirmed context
  from notes and engagements.
- **Boundary:** These signals do not establish external Kafka inventory,
  architecture, or whether RTI should replace the current platform.
- **Report/widget:**
- **Notes / follow-up:**

### 7. [ ] Data/AI foundation

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Foundry Agents/OpenAI/ML consumption and relevant linked
  work, paired with observed Fabric/workload context.
- **Boundary:** This is candidate discovery, not a governance or agent-readiness
  assessment. Missing Fabric does not mean missing governance.
- **Report/widget:**
- **Notes / follow-up:**

### 8. [ ] SQL migration

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Observed Azure SQL/SQL VM/Arc footprints and explicitly
  recorded migration work as conversation starters.
- **Boundary:** Renewal-driven on-prem qualification is blocked without an
  authoritative inventory/renewal source. No server counts, EOS qualification,
  or progress against the 40% migration target can be inferred from cloud ACR.
- **Report/widget:**
- **Notes / follow-up:**

### 9. [ ] DB modernization

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Database pillar/product footprint, growth/decline,
  and linked modernization engagements or milestones.
- **Boundary:** A proxy worklist is not validated propensity, topology,
  compatibility, migration readiness, or a target-architecture recommendation.
- **Report/widget:**
- **Notes / follow-up:**

### 10. [ ] Arc bridge

- [ ] Coded
- [ ] Added to dashboard
- **Starting scope:** Observed Arc-related consumption and manually confirmed
  bridge engagements.
- **Boundary:** Arc spend does not necessarily represent SQL or explain why
  the customer cannot migrate this cycle. Automatic bridge qualification is
  blocked without explicit customer-confirmed constraints.
- **Report/widget:**
- **Notes / follow-up:**

## Before checking a motion complete

- The agreed cohort and date window are clear.
- Report, widget, and read tool share the same calculations where applicable.
- Customer/Seller filters affect the entire calculation, not just visible rows.
- Missing data is distinguishable from zero or confirmed absence.
- Relevant scoped tests pass and the widget works with live dev data.
- The chosen variation is added to the intended dashboard and the layout is saved.

Customers may qualify for several motions. Do not add motion counts together
and label the result unique customers.
