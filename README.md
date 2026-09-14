<div align="center">

# LeadMachine 🚀

**Autonomous Executive Operating System & Predictive Lead Intelligence Platform**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-635BFF?style=flat-square&logo=stripe)](https://stripe.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Overview

**LeadMachine** is an enterprise-grade autonomous operating system designed for modern SaaS companies. It bridges high-level executive decision-making with tactical lead generation by orchestrating continuous lead discovery, AI-powered enrichment, predictive forecasting, automated governance guardrails, and deterministic business intelligence.

Built from the ground up for speed, safety, and scale using Next.js 16 (App Router), Prisma ORM, PostgreSQL, and Serverless event workers.

---

## Key Capabilities

### 🧠 Autonomous Executive Operations
- **Real-Time Operating State**: Unifies telemetry, active decisions, forecast models, and action plans into a single state of business health.
- **Attention & Decision Queues**: Surfaces high-priority executive alerts and human-gated decisions with explainable audit trails.
- **Strategic Simulation & Forecasting**: Deterministic Weighted Moving Average (WMA) predictive models for canonical metrics (ARR, MRR, churn, customer growth) with explicit confidence intervals.
- **Outcome Attribution Engine**: Conservative, evidence-based graph tying business metrics back to specific executive actions and recommendations.

### 🎯 Lead Discovery & Intelligent Enrichment
- **Multi-Source Enrichment Pipeline**: Cascading providers (Apollo, Website Scraper, Tech Detector, Mock) with built-in SSRF protection.
- **Deterministic Lead Qualification & Scoring**: Instant categorization based on ICP match, company size, tech stack, and intent signals.
- **Context-Aware Outreach Drafting**: Generates hyper-personalized outreach sequences that auto-refresh or mark stale upon context mutation.

### 🛡️ Enterprise Governance & Safety
- **Fail-Closed Write Guards**: Strict environment and identity guards to prevent accidental destructive writes in production.
- **Human-in-the-Loop Safeguards**: High-risk AI actions require manual stakeholder approval before execution.
- **Fine-Grained RBAC**: Role-based access control protecting executive endpoints and organizational data boundaries.

### 💳 Tiered Billing & Usage Metering
- **Stripe Checkout & Customer Portal**: Integrated subscription lifecycle handling for Pro and Business tiers.
- **Credit-Based Metering**: Real-time usage tracking and rate-limiting powered by Upstash Redis.
- **Webhook Ingestion**: Resilient webhook listeners for subscription upgrades, cancellations, and renewals.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, Turbopack, Server Actions) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) (Strict mode) |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org) & [Prisma ORM 5](https://www.prisma.io) |
| **Styling & UI** | [Tailwind CSS 4](https://tailwindcss.com), [Lucide Icons](https://lucide.dev), [Recharts](https://recharts.org) |
| **Rate Limiting & Cache** | [Upstash Redis](https://upstash.com) |
| **Event Orchestration** | [Inngest](https://www.inngest.com) |
| **Payments** | [Stripe](https://stripe.com) |
| **Authentication** | Custom Stateless Session Management (Jose / JWT + HTTP-only cookies) |

---

## Architecture & Directory Structure

```
├── docs/                 # Documentation, specifications, and architecture audits
├── prisma/
│   ├── schema.prisma     # Production database schema definitions
│   └── migrations/       # Immutable PostgreSQL migrations
├── src/
│   ├── ai/               # Executive intelligence, forecasting, and strategy synthesis
│   │   ├── executive/    # Operating state, outcomes evaluator, attention engine
│   │   └── orchestrator.ts
│   ├── app/              # Next.js App Router (pages, layouts, and API routes)
│   │   ├── (auth)/       # Authentication pages (login, register)
│   │   ├── (dashboard)/  # Authenticated executive dashboard, leads, and billing
│   │   └── api/          # Modular REST API endpoints
│   ├── audit/            # Structured audit logger and telemetry
│   ├── business/         # Core metrics engine, CRM snapshotter, and BI insights
│   ├── components/       # Reusable UI components, charts, and executive panels
│   ├── integrations/     # Third-party integrations (Stripe, CSV importer, CRM)
│   ├── lib/              # Core utilities, db client, session, auth, and guardrails
│   └── permissions/      # RBAC policies and definitions
└── tests/                # Automated regression test suites
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or later
- **npm** or **pnpm**
- **PostgreSQL**: A running instance (local or hosted on Neon, Supabase, etc.)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/ranairtaza/Saas-AI.git
cd Saas-AI
npm install
```

### 3. Environment Setup
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env
```

Ensure the key variables are configured:
- `DATABASE_URL`: Connection string with pooling for serverless execution.
- `DIRECT_URL`: Direct connection string for Prisma migrations.
- `LEADMACHINE_DB_WRITES_ENABLED`: Set to `"true"` to enable database writes.
- `SESSION_SECRET`: Random 32+ character string for token signing.
- `PROVIDER_ENCRYPTION_KEY`: Random 32+ character string for secrets encryption.

### 4. Database Setup & Seed
Generate the Prisma Client and apply migrations:
```bash
npx prisma generate
npx prisma migrate deploy
```

*(Optional)* Seed sample data for local development:
```bash
node seed.mjs
```

### 5. Running the Application
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality Assurance & Testing

The codebase includes an extensive suite of automated tests covering lead discovery, enrichment, executive operating states, forecasting, and attribution:

```bash
# Run the complete regression test matrix
npx tsx tests/run_full_regression.ts
```

---

## Deployment to Vercel

1. Push your code to your GitHub repository.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Set the Framework Preset to **Next.js**.
4. Configure all environment variables from `.env.example` in the Vercel project settings.
5. Deploy! Vercel automatically runs `prisma generate && next build`.

---

## License

This project is licensed under the [MIT License](LICENSE).
