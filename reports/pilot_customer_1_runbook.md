# Pilot Customer #1: Operations Runbook

## 1. PILOT SETUP
- [x] **Create/Verify Pilot Organization**: Tenant provisioned in production DB. (ID: `d5a889a1-316d-4a7b-adfc-72300601554d`)
- [x] **Verify OWNER Account & RBAC**: `ceo@pilot.test` created with `OWNER` role and `onboarded = true`. 
- [ ] **Record Pilot Start Date**: ______________
- [ ] **Verify Production Environment**: Ensure `NODE_ENV=production` and Vercel build is healthy.

## 2. DATA CONNECTION
*Requires explicit human authorization. No autonomous scraping.*
- [ ] **Verify CRM Integration Configuration**: Check `src/integrations/providers` (e.g., Salesforce, HubSpot).
- [ ] **Verify Stripe Integration Configuration**: Establish Stripe Connect or restricted API keys.
- [ ] **Require Explicit Authorization**: Customer must click "Connect" through standard OAuth/account linking workflows.
- [ ] **Confirm Successful Initial Sync**: Check `IntegrationConnection` and `SyncJob` records for success status.
- [ ] **Record Sync Timestamps & Coverage**:
  - Initial sync completed at: ______________
  - Leads imported: ______________
  - Revenue data imported: ______________

## 3. BASELINE
- [ ] Execute `reports/pilot_customer_1_baseline.md` to record empirical reality *before* LeadMachine acts.

## 4. DAY 1: INITIAL VALUE
- [ ] **Generate Executive Briefing**: Use `ExecutiveBriefingEngine.generateBriefing()` to digest initial CRM/Stripe data.
- [ ] **Generate Business Insights**: Use `BusinessIntelligenceEngine` to surface initial bottlenecks.
- [ ] **Generate Action Plans**: Wait for `ExecutiveActionPlanner` to propose interventions based on initial forecast data.
- [ ] **Review Outputs**: Verify factual accuracy against raw CRM data. No hallucinations allowed.
- [ ] **Record Feedback**: Capture owner's immediate reaction to the first briefing.

## 5. DAYS 2–7: DAILY OPERATION
- [ ] Maintain `reports/pilot_customer_1_daily_log.md`.
- [ ] Require daily review of new insights and action plans.
- [ ] Capture explicit approve/reject signals via `approveActionPlan()` and `rejectActionPlan()`.

## 6. SAFETY & GOVERNANCE RULES
- **No autonomous external actions**: The `ExecutiveActionPlanner` and `PendingAction` queues must remain strictly gated by the RBAC `ApproveActionPlanInput`.
- **No fabricated metrics**: All forecasts must be grounded in actual `Lead` and `BusinessMetric` telemetry.
- **No fabricated ROI**: Do not claim success unless the baseline measurement proves actual improvement.

## 7. DAY 7 EVALUATION
- [ ] Compare end-of-pilot metrics against `reports/pilot_customer_1_baseline.md`.
- [ ] Document qualitative time/operational savings reported by the business owner.
- [ ] Document which hypotheses require a full quarter to evaluate.

## 8. PILOT DECISION
- [ ] Summarize what worked and what failed.
- [ ] List required fixes (only for issues discovered during the pilot).
- [ ] Make the "Convert to Paid" decision.
