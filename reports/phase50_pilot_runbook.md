# LeadMachine Phase 50 — Controlled First-Customer Pilot Runbook

**Document Version:** 1.0.1  
**Phase:** 50 (Controlled Pilot Onboarding)  
**Production URL:** `https://saas-ai-sooty.vercel.app`  
**Database Cluster:** Supabase PostgreSQL Pooler (`aws-0-ap-northeast-1.pooler.supabase.com:6543`)  
**Accepted Baseline:** `Phase 50 Production Audit Complete`  
**Pilot Constraint:** Exactly **ONE** customer organization onboarded and monitored at a time.

---

## 1. Executive Summary & Pilot Scope

This runbook establishes the exact operational procedure for onboarding the **first controlled pilot customer** onto LeadMachine.

### Core Pilot Principles
1. **Single-Tenant Pilot Focus:** Only one pilot organization is onboarded during this initial validation cycle to ensure dedicated oversight.
2. **Deterministic Data Truthfulness:** Metrics, forecasts, and health scores are strictly derived from real data. Unconnected or empty sources display explicit unrated states (`—` / `UNRATED` / `INSUFFICIENT DATA`), never fabricated numbers or fake trends. Missing data never defaults to 0% growth or synthetic estimates.
3. **Non-Bypassable Human Governance:** AI recommendations and strategic proposals remain strictly advisory. Every action requires explicit human approval before execution.
4. **Zero Breaking Changes:** No mobile apps, voice interfaces, or unapproved architectural modifications are permitted during pilot operations.

---

## 2. Integration Architecture: Apollo & Stripe

The system supports a strictly verified dual-integration architecture. Both must be managed under Settings -> Providers.

- **Apollo.io**: Used for B2B lead discovery and enrichment. Requires Apollo API Key.
- **Stripe**: Used for revenue and billing telemetry. Requires restricted Stripe Secret Key.

Credentials for both are encrypted at rest, never returned to the client, scoped securely by organization ID, and governed by strict RBAC mutation checks.

## 3. Data Freshness Status Taxonomy

LeadMachine enforces an unambiguous 8-state data freshness model across all business telemetry providers:

| Status Code | Label in UI | Description | Behavioral Guarantee |
|---|---|---|---|
| `NOT_CONFIGURED` | **NOT CONNECTED** | Provider API key or OAuth token is absent from tenant settings. | Zero fabricated metrics; dependent KPIs render as `—` (Unrated). |
| `CONFIGURED` | **CONNECTED** | Valid API credentials are saved and verified. | Provider is ready to initiate background synchronization. |
| `SYNCING` | **SYNCING** | Telemetry ingestion job is currently executing. | Background lock active; UI indicates sync in progress. |
| `CURRENT` | **CURRENT** | Telemetry synchronized within the last 24 hours. | Data is fresh; real-time calculations active. |
| `AGING` | **AGING** | Telemetry synchronized between 24 and 72 hours ago. | Warnings displayed indicating data is aging. |
| `STALE` | **STALE** | Telemetry not updated for > 72 hours. | Forecasts and health scores flagged with stale warnings. |
| `ERROR` | **ERROR** | Upstream provider rejected sync (e.g. invalid API key, network timeout). | Graceful error banner displayed; previous successful sync time is never overwritten. |
| `INSUFFICIENT_DATA` | **INSUFFICIENT DATA** | Organization lacks sufficient historical telemetry to calculate baselines. | Read-model returns `overallScore: "—"`, `status: "UNRATED"`, `confidence: "UNAVAILABLE"`. |

---

## 4. Step-by-Step Pilot Onboarding Procedure

### Step 1: Pre-Flight Production Health Check
Before sending registration credentials to the pilot customer, verify platform readiness:
1. Open `https://saas-ai-sooty.vercel.app/api/health/live`  
   * Expected: HTTP 200, `status: "HEALTHY"`, `service: "leadmachine-platform"`.
2. Open `https://saas-ai-sooty.vercel.app/api/health/ready`  
   * Expected: HTTP 200, `readiness.application: "AVAILABLE"`, `dependencies.database.status: "AVAILABLE"`.

### Step 2: Account Registration (`/register`)
Direct the pilot customer owner to `https://saas-ai-sooty.vercel.app/register`:
1. Customer enters Name, Email, Password, Organization Name.
2. Upon submission, a new `Organization` is created and user is assigned `OWNER`.

### Step 3: Executive Onboarding Flow (`/onboarding`)
1. **The Operating Loop**: Explains the cycle `Evidence -> Severity -> Root cause -> Minimal fix -> Regression test -> Production verification`.
2. **Operating Profile**: Select industry, business model, ICP. New goals are generated in `DRAFT` status and remain `DRAFT` until explicitly activated.
3. **Integrations**: Demonstrates Apollo and Stripe setups.
4. **Baseline Review**: Unrated truth baseline (`ARR: Awaiting Sync`, `Pipeline: 0`, `Health: UNRATED`). Action required by an `OWNER`/`ADMIN` to approve the Executive Decision to launch.

### Step 4: Business Integration Connection (`/settings/providers`)
1. Navigate to **Settings → Providers** (`https://saas-ai-sooty.vercel.app/settings/providers`).
2. Input live Stripe Secret Key and/or Apollo.io API Key.
3. System verifies connectivity and updates status from `NOT_CONFIGURED` to `CONFIGURED`.
4. Trigger safe read-only sync (`POST /api/integrations/sync`). Only fully successful syncs update the freshness timestamp.

### Step 5: Handover to Executive Command Center (`/executive`)
1. Customer redirected to `/executive`.
2. Initial dashboard renders truthfully without synthetic heuristics.

---

## 5. Human Governance & Decision Approval Protocol

During the pilot period:
- **Zero Autonomous Execution:** No external outreach, mutation, or billing changes are executed without the customer clicking **"Approve"** in the Executive Decision panel.
- **Audit Trails:** Every decision approval, rejection, or deferral creates an immutable `ExecutiveDecisionAudit` record with timestamp and actor user ID.
- **Financial Thresholds:** High-risk actions (financial exposure > $5,000 or confidence < 70%) are automatically flagged with `REQUIRES_ESCALATION` governance verdicts.

---

## 6. Known Limitations & Operational Constraints

1. **Third-Party CRM OAuth:** Live Salesforce/HubSpot OAuth flows require customer-specific App Client IDs. Pilot customers using direct API keys or manual lead uploads are supported immediately.
2. **Single Active Pilot:** Onboarding a second simultaneous customer is deferred until Phase 51 after collecting 14 days of operational telemetry from Pilot Customer #1.
3. **No Fabricated Elasticity:** Cross-domain impacts (e.g. leads converting to revenue) without telemetry are marked `UNKNOWN` and do not synthetically simulate pipeline growth.

---

## 7. Pilot Sign-Off Verification Checklist

- [x] Live production URL active on HTTPS with HSTS: `https://saas-ai-sooty.vercel.app`
- [x] Full regression suite passing: `npm test` verified across all modules
- [x] Production build clean: `npm run build` completed
- [x] Truthful degraded state verified (`UNRATED` for empty tenants)
- [x] Multi-tenant isolation verified live across tenants A and B
- [x] Human decision approval workflow verified with persistent audit logging
- [x] Onboarding state machine and `DRAFT` goals setup verified
