# Saas-AI

AI-powered SaaS platform for lead intelligence, executive planning, and growth automation.

## What it does

Saas-AI is a modern AI business operating system that helps teams track leads, forecast performance, and automate strategic decision-making. It blends lead generation, enrichment, analytics, and billing into one clean SaaS dashboard.

## Live Demo

- Demo: https://saas-ai-sooty.vercel.app

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Stripe
- Inngest
- Upstash Redis

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- npm or pnpm

### Installation

```bash
git clone https://github.com/ranairtaza/Saas-AI.git
cd Saas-AI
npm install
cp .env.example .env
```

Then configure your environment variables and run:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000 to view the app.

## Key Features

- AI-powered lead discovery and enrichment
- Executive dashboard for monitoring business health
- Smart forecasting and outcome tracking
- Role-based access control and audit trails
- Stripe billing and subscription management
- Automated workflows and event-driven processing

## License

MIT License