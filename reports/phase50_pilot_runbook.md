# LeadMachine Phase 50 — Controlled First-Customer Pilot Runbook

**Document Version:** 1.0.0  
**Phase:** 50 (Controlled Pilot Onboarding)  
**Production URL:** `https://saas-ai-sooty.vercel.app`  
**Database Cluster:** Supabase PostgreSQL Pooler (`aws-0-ap-northeast-1.pooler.supabase.com:6543`)  
**Accepted Baseline:** `Phase 49.3` / Commit `87a4b1f`  
**Pilot Constraint:** Exactly **ONE** customer organization onboarded and monitored at a time.

---

## 1. Executive Summary & Pilot Scope

This runbook establishes the exact operational procedure for onboarding the **first controlled pilot customer** onto LeadMachine.

### Core Pilot Principles
1. **Single-Tenant Pilot Focus:** Only one pilot organization is onboarded during this initial validation cycle to ensure dedicated oversight.
2. **Deterministic Data Truthfulness:** Metrics, forecasts, and health scores are strictly derived from real data. Unconnected or empty sources display explicit unrated states (`—` / `UNRATED` / `INSUFFICIENT DATA`), never fabricated numbers or fake trends.
3. **Non-Bypassable Human Governance:** AI recommendations and strategic proposals remain strictly advisory. Every action requires explicit human approval before execution.
4. **Zero Breaking Changes:** No mobile apps, voice interfaces, or unapproved architectural modifications are permitted during pilot operations.

---

## 2. Integration & Data Freshness Status Taxonomy

LeadMachine enforces an unambiguous 8-state data freshness model across all business telemetry providers:

| Status Code | Label in UI | Description | Behavioral Guarantee |
|---|---|---|---|
| `NOT_CONFIGURED` | **NOT CONNECTED** | Provider API key or OAuth token is absent from tenant settings. | Zero fabricated metrics; dependent KPIs render as `—` (Unrated). |
| `CONFIGURED` | **CONNECTED** | Valid API credentials are saved and verified. | Provider is ready to initiate background synchronization. |
| `SYNCING` | **SYNCING** | Telemetry ingestion job is currently executing. | Background lock active; UI indicates sync in progress. |
| `CURRENT` | **CURRENT** | Telemetry synchronized within the last 24 hours. | Data is fresh; real-time calculations active. |
| `AGING` | **AGING** | Telemetry synchronized between 24 and 72 hours ago. | Warnings displayed indicating data is aging. |
| `STALE` | **STALE** | Telemetry not updated for > 72 hours. | Forecasts and health scores flagged with stale warnings. |
| `ERROR` | **ERROR** | Upstream provider rejected sync (e.g. invalid API key, network timeout). | Graceful error banner displayed; no client stack trace leak. |
| `INSUFFICIENT_DATA` | **INSUFFICIENT DATA** | Organization lacks sufficient historical telemetry to calculate baselines. | Read-model returns `overallScore: "—"`, `status: "UNRATED"`, `confidence: "UNAVAILABLE"`. |

---

## 3. Step-by-Step Pilot Onboarding Procedure

### Step 1: Pre-Flight Production Health Check
Before sending registration credentials to the pilot customer, verify platform readiness:
1. Open `https://saas-ai-sooty.vercel.app/api/health/live`  
   * Expected: HTTP 200, `status: "HEALTHY"`, `service: "leadmachine-platform"`.
2. Open `https://saas-ai-sooty.vercel.app/api/health/ready`  
   * Expected: HTTP 200, `readiness.application: "AVAILABLE"`, `dependencies.database.status: "AVAILABLE"`.

---

### Step 2: Account Registration (`/register`)
Direct the pilot customer owner to `https://saas-ai-sooty.vercel.app/register`:
1. Customer enters:
   * **Full Name** (e.g., `Jane Doe`)
   * **Work Email** (e.g., `jane@acmecorp.com`)
   * **Password** (Minimum 8 characters)
   * **Organization Name** (e.g., `Acme Technologies`)
2. Upon submission:
   * A new `Organization` is created in Supabase.
   * User is provisioned with the `OWNER` role.
   * Default free trial `CreditAccount` is initialized with 100 discovery credits.
   * Signed `session` JWT cookie (HS256) is issued via HttpOnly cookie.
   * User is redirected automatically to `/onboarding`.

---

### Step 3: Executive Onboarding Flow (`/onboarding`)
The customer completes the 4-step guided onboarding workflow:

1. **Step 1: The Operating Loop**
   * Explains the 4-stage executive loop: *Business Data → Business State → What Matters → Owner Approval*.
   * Reinforces human-governance guarantee and zero fake data commitments.
2. **Step 2: Operating Profile & Business Goals**
   * Customer selects **Industry** (e.g., `B2B SaaS / Software`).
   * Customer selects **Business Model** (e.g., `Subscriptions (ARR/MRR)`).
   * Customer defines **Target Market / ICP** (e.g., `Mid-Market CFOs`).
   * Customer enters optional **Target ARR Goal** (starts empty/unset; no default financial target is forced or persisted).
   * Customer selects **Primary Operating Priority** (e.g., `Accelerate ARR Growth`).
3. **Step 3: Integrations & Data Freshness Model**
   * Outlines monitored pillars: Stripe (Billing), Gemini (AI Reasoning), CRM (Lead Intelligence).
   * Transparently demonstrates that unconnected providers remain `NOT CONNECTED`.
4. **Step 4: Baseline Review & First Human Approval**
   * Shows initial unrated truth baseline (`ARR: Awaiting Sync`, `Pipeline: 0`, `Health: UNRATED`).
   * Stages **Recommended Decision #1**: *"Initialize Executive Monitoring Baseline for [Priority]"*.
   * Approval checkbox is **unchecked by default**; requires deliberate user interaction by an authorized `OWNER`/`ADMIN`. Non-executive roles cannot self-approve.
   * Final launch button remains disabled until approval is explicitly checked.
   * Clicks **"Launch Executive Command Center"**.
   * Transaction creates `BusinessProfile`, `ExecutiveGovernancePolicy`, optional `BusinessGoal` (initialized in semantically neutral `DRAFT` status), and approved `ExecutiveDecision` with audit history.

---

### Step 4: Optional Business Integration Connection (`/settings/providers`)
If the pilot customer has active Stripe or CRM credentials to connect:
1. Navigate to **Settings → Providers** (`https://saas-ai-sooty.vercel.app/settings/providers`).
2. Input live Stripe Secret Key (`sk_live_...` or `sk_test_...` for sandbox).
3. System verifies connectivity and updates status from `NOT_CONFIGURED` to `CONFIGURED`.
4. Trigger safe read-only sync (`POST /api/integrations/sync`).
5. Verify resulting revenue telemetry updates on the Executive Dashboard.

---

### Step 5: Handover to Executive Command Center (`/executive`)
1. Customer is redirected to `https://saas-ai-sooty.vercel.app/executive`.
2. Confirm the initial dashboard render:
   * Fast snapshot loads in `< 3.5s`.
   * Hero score reflects truthful baseline (`—` / `UNRATED` if no Stripe connected; actual calculated score if connected).
   * Attention panel displays staged priority focus.
   * Opportunities, risks, and forecasts render strictly without fabricated heuristics.

---

## 4. Human Governance & Decision Approval Protocol

During the pilot period:
- **Zero Autonomous Execution:** No external outreach, mutation, or billing changes are executed without the customer clicking **"Approve"** in the Executive Decision panel.
- **Audit Trails:** Every decision approval, rejection, or deferral creates an immutable `ExecutiveDecisionAudit` record with timestamp and actor user ID.
- **Financial Thresholds:** High-risk actions (financial exposure > $5,000 or confidence < 70%) are automatically flagged with `REQUIRES_ESCALATION` governance verdicts.

---

## 5. Known Limitations & Operational Constraints

1. **Third-Party CRM OAuth:** Live Salesforce/HubSpot OAuth flows require customer-specific App Client IDs. Pilot customers using direct API keys or manual lead uploads are supported immediately.
2. **Edge Telemetry Sampling:** System snapshots under extreme edge volume distinguish `EXACT` vs `SAMPLED` metrics; exact request volume is buffered asynchronously.
3. **Single Active Pilot:** Onboarding a second simultaneous customer is deferred until Phase 51 after collecting 14 days of operational telemetry from Pilot Customer #1.

---

## 6. Pilot Emergency & Rollback Runbook

### Scenario A: Database Connectivity Degradation
* **Symptoms:** `/api/health/ready` returns `dependencies.database.status: "DEGRADED"`.
* **Action:** Check Supabase connection pooler utilization. Ensure database write guard (`LEADMACHINE_DB_WRITES_ENABLED="true"`) is active.

### Scenario B: Customer Request for Data Purge
* **Procedure:** Owner accesses **Settings → Organization** and submits a data deletion request.
* **Execution:** System cascade-deletes tenant leads, decisions, goals, and profiles while retaining anonymized audit compliance logs.

---

## 7. Pilot Sign-Off Verification Checklist

- [x] Live production URL active on HTTPS with HSTS: `https://saas-ai-sooty.vercel.app`
- [x] Hardened live smoke test: 32 Passed, 1 Blocked (OAuth sync), 0 Failed
- [x] Full regression suite passing: 36 / 36 test suites passing
- [x] Production build clean: 74 / 74 routes compiled
- [x] Truthful degraded state verified (`UNRATED` for empty tenants)
- [x] Multi-tenant isolation verified live across tenants A and B
- [x] Human decision approval workflow verified with persistent audit logging
- [x] Onboarding state machine and goals setup verified
