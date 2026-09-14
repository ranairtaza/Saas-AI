# Phase 6A Runtime Limitations

## Serverless Background Execution Limitation
The current asynchronous discovery architecture is designed to unblock the client immediately by queueing a `DiscoveryJob` and triggering an internal background processor. 

**Limitation:** 
This background processor is triggered via a "fire-and-forget" HTTP request (`fetch` without `await`) to an internal Next.js API route (`/api/internal/process-job`).
- **Local Node execution:** This pattern works perfectly. The Node.js process stays alive, the background thread processes the job, and the database is updated.
- **Serverless deployments (e.g. Vercel, AWS Lambda):** This pattern is inherently unsafe. Serverless platforms freeze or terminate the execution environment almost immediately after the primary HTTP response is sent to the client. The background processor will likely be killed mid-execution, resulting in jobs forever stuck in the `RUNNING` state.

## Required Future Hardening (Phase 6B/Production)
For a production deployment on serverless infrastructure, this MVP queuing system MUST be replaced with a durable background execution system:
- BullMQ (with Redis)
- Inngest
- Trigger.dev
- AWS SQS + Worker

These were intentionally excluded from Phase 6A to prevent scope creep.

## Database Concurrency
We are currently using SQLite. SQLite does not gracefully handle high-concurrency writes. The in-batch deduplication protects against duplicate inserts within the *same* job chunk, but race conditions between two concurrent jobs processing the exact same domain simultaneously could still result in duplicate `DiscoveryResult` rows, as SQLite lacks advanced row-level locking or `ON CONFLICT DO NOTHING` clauses without constraints. This will be resolved when migrating to PostgreSQL.
