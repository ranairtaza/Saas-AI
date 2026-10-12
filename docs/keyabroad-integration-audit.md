# LeadMachine × KeyAbroad CRM — Integration Recovery Audit

## Current Architecture and Data Flow
- **Registration**: The `keyabroadAdapter` is instantiated and registered via `SyncManager` in `src/integrations/core/manager.ts`.
- **Trigger**: Syncs are triggered by scheduling an Inngest background job (`integrations/sync.requested`), passing `organizationId` and `connectionId`.
- **Fetch & Map**: The adapter fetches from the external KeyAbroad CRM via `KEYABROAD_CRM_BASE_URL/api/integrations/leadmachine`. It uses Bearer token authentication (api key stored encrypted in `ProviderCredential`).
- **Persistence**: 
  - Leads are mapped and upserted into the `Lead` table.
  - Metrics (Total Leads, Active Leads, Students, Pipeline Value) are aggregated and saved to `BusinessMetric` and `MetricSnapshot`.

## Verified Implementation Status
- **Adapter Code**: Exists (`src/integrations/providers/keyabroad/adapter.ts`) and is well-structured for pagination, fetching, mapping, and metric aggregation.
- **Unit Tests**: Exist (`tests/integrations/providers/keyabroad/adapter.test.ts`) and completely pass, but they mock the DB and global `fetch`.
- **API Endpoint**: The endpoint `/api/integrations/leadmachine` does not exist in the LeadMachine source code, which is correct as KeyAbroad is an external separate application.

## Exact Blockers and Supporting Evidence
1. **Database Unreachable**: The configured `DATABASE_URL` points to a Supabase database pooler, but the tenant/user is not found.
   - *Evidence*: `prisma db pull` and Prisma Client throw `FATAL: (ENOTFOUND) tenant/user postgres.kqwiumjxeuzdhjzxpmeo not found`.
2. **Missing Vercel Environment Variables**: While the project is actually linked now as `keyabroad/saas-ai-sooty`, it has no configuration stored in Vercel.
   - *Evidence*: `vercel env ls` outputs `No Environment Variables found for keyabroad/saas-ai-sooty`.
3. **Missing Integration Base URL**: The required configuration for the remote CRM API is not present locally.
   - *Evidence*: `KEYABROAD_CRM_BASE_URL` is completely absent from the `.env` variables list.

## Required Configuration Variable NAMES
- `DATABASE_URL`
- `DIRECT_URL`
- `KEYABROAD_CRM_BASE_URL`

## Missing Implementation and Tests
- Real-world API integration tests (current tests only mock `fetch`).
- End-to-end integration scenario (validating connection -> fetching data -> checking database without mocks).
- Error handling for specific rate limits or API schema changes from KeyAbroad.

## Ordered Remediation Plan
1. **Database Recovery**: Restore the Supabase tenant `postgres.kqwiumjxeuzdhjzxpmeo` or provision a new DB, and update `DATABASE_URL` & `DIRECT_URL`.
2. **Vercel Config**: Add the necessary environment variables to the Vercel project `keyabroad/saas-ai-sooty`.
3. **Local Sync**: Run `vercel env pull` to pull valid environment variables to the local `.env`.
4. **CRM URL setup**: Configure `KEYABROAD_CRM_BASE_URL` with the real KeyAbroad external URL.
5. **Credentials**: Insert a valid KeyAbroad CRM API key into the `ProviderCredential` table for testing.
6. **Integration Testing**: Execute the sync and verify records.

## Acceptance Criteria for a Real, Authenticated, Read-Only CRM Sync
- The adapter successfully calls the KeyAbroad API without throwing network errors.
- The KeyAbroad API responds with HTTP 200 OK.
- Leads are successfully paginated and saved into the local `Lead` table.
- Metrics are correctly calculated based on fetched data.
- Absolute zero direct database connections are made to KeyAbroad (API only).
- Credentials are not logged in plain text during the sync.
