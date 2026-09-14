# Phase 6A Implementation Audit

## 1. Current Architecture
- **Framework:** Next.js 16.3.3 (App Router)
- **Language:** TypeScript
- **Database:** SQLite (local MVP) managed via Prisma ORM v5.22.0
- **Authentication:** Custom session-based authentication (`getCurrentUser()` in `src/lib/session.ts`) hashing session tokens with bcrypt.
- **Multi-tenancy:** Enforced via `organizationId` across `User`, `Session`, `Lead`, `DiscoveryJob`, `DiscoveryResult`, and `ProviderCredential`.
- **Discovery Flow:** Currently implemented as an asynchronous queue. `POST /api/discover` queues a `DiscoveryJob` and triggers an internal processor `POST /api/internal/process-job`, returning a `jobId`. The UI polls `GET /api/discover/[id]` and eventually fetches staging results via `GET /api/discover/[id]/results`.
- **Providers:** Abstraction exists (`LeadProvider` interface). `MockProvider` and `ApolloProvider` are implemented.
- **Provider Credentials:** Credentials are encrypted using `crypto` module (AES-256-GCM) via `src/lib/encryption.ts` and stored in `ProviderCredential`.

## 2. Existing Reusable Components
- `getCurrentUser()`: Securely authenticates the user via hashed session cookies and joins the `Organization`.
- `LeadProvider` interface: Exposes `search(criteria: TargetCriteria): Promise<NormalizedLead[]>`.
- Deduplication utilities: `normalizeEmail` and `normalizeDomain` inside `src/lib/providers/lead-provider.ts`.
- Validation: Zod schemas are used across API routes.

## 3. Required Modifications (to comply strictly with Phase 6A prompt constraints)
*Note: Some of these were proactively implemented, but need to be formally verified against the prompt's strict constraints.*
- **Internal Job Processor Protection:** The `process-job` route currently lacks a strict `INTERNAL_JOB_SECRET` environment variable check. It only validates the `jobId` and `organizationId`. We must implement the `INTERNAL_JOB_SECRET` check as explicitly required.
- **Provider Credential Schema:** Ensure it conforms perfectly to the requested schema. (It does).
- **DiscoveryResult Staging:** Ensure results are stored in `DiscoveryResult` and not automatically promoted to `Lead`. (It does).

## 4. Potential Compatibility Problems
- **SQLite Concurrency:** SQLite is prone to locking under concurrent read/write load. The batch deduplication limits sequential writes, but race conditions during `findFirst`/`create` loops still theoretically exist.
- **Next.js Route Handlers:** Dynamic route `params` are now Promises in Next.js 15+ (16.3.3 installed). (Already fixed in recent commit).

## 5. Security Risks
- The internal job processing route (`/api/internal/process-job`) currently lacks an internal secret token validation, meaning anyone who guesses a `jobId` could trigger processing. This must be fixed immediately.
- Encryption relies on `process.env.PROVIDER_ENCRYPTION_KEY`. The server must fail securely if this is missing. (We should add a strict check in `src/lib/encryption.ts`).

## 6. Serverless Limitations
- **Background Execution:** `fetch()`ing the internal processor without awaiting it (fire-and-forget) works in standard Node environments. However, Vercel/serverless environments may terminate the lambda execution context immediately after the HTTP response is sent, killing the background job. A durable queue (BullMQ/Inngest) is required for production.

## 7. Exact Implementation Sequence
1. **Security Fixes:** 
   - Update `src/lib/encryption.ts` to throw a fatal error if `PROVIDER_ENCRYPTION_KEY` is missing or invalid, rather than falling back to a hardcoded string.
   - Update `src/app/api/internal/process-job/route.ts` to require and validate an `INTERNAL_JOB_SECRET` header.
   - Update `src/app/api/discover/route.ts` to pass the `INTERNAL_JOB_SECRET` when triggering the job.
2. **Review Existing Implementation:** Ensure all components match the Phase 6A authorization prompt precisely.
3. **Write Documentation:** Create `PHASE_6A_RUNTIME_LIMITATIONS.md`.
4. **Update Tests:** Update `verify_phase6.mjs` to test the new internal secret logic.
5. **Run Verifications:** Execute tests and build.
6. **Generate Final Report:** Create `PHASE_6A_FINAL_REPORT.md`.
