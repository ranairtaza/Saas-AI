# KeyAbroad CRM Connector Report

## Architecture
The KeyAbroad CRM connector integrates directly into LeadMachine's existing `SyncManager` architecture. It functions as an isolated integration adapter without needing destructive rewrites or parallel CRM infrastructures. The `keyabroadAdapter` acts as a data pipeline fetching raw KeyAbroad data via their authenticated REST API and normalizing it into the LeadMachine format using the established `Lead`, `BusinessMetric`, and `MetricSnapshot` structures.

## Provider Implementation
The integration is implemented in a dedicated `KeyAbroadCRMAdapter` class at `src/integrations/providers/keyabroad/adapter.ts`. It registers via the `SyncManager` (`src/integrations/core/manager.ts`). It adheres strictly to the `IntegrationProvider` interface.

## Authentication
Authentication is fully server-side, utilizing existing `ProviderCredential` storage to retrieve the encrypted API key via LeadMachine's standard `decrypt` utility. No service-role credentials or database accesses are made. Validation involves hitting the API endpoint `GET /api/integrations/leadmachine?limit=1` to ensure token validity. 

## API Contract
The API consumes the `GET /api/integrations/leadmachine` endpoint. It processes paginated datasets according to KeyAbroad's `has_more` convention using bounded limits (`limit=500`). Error conditions (401, 4xx, 5xx) are handled cleanly and reported directly into telemetry.

## Normalization
KeyAbroad records are converted to the standard `Lead` schema:
- `Enquiry` maps to Lead
- `Student` maps to Contact
Key fields (company name, contact name, email, phone, status) are safely preserved. We maintain strict semantic definitions for KeyAbroad: `total_budget_pkr` is preserved but not mapped out of currency scope blindly.

## Incremental Sync
The API supports incremental synchronization, primarily relying on `created_at` parameters due to the lack of strong `updated_at` properties in KeyAbroad. All overlaps are safely reconciled into `Lead` entries since Upsert strategy uses reliable identities.

## Idempotency
Duplicate injection is prevented by utilizing a strict deterministic `id` parameter pattern during Upsert operations (`keyabroad:${source_record_id}`) and setting `source` field explicitly. Data will merely update instead of repeating if already fetched.

## Metrics
Metrics are mapped onto LeadMachine's existing `BusinessMetric` and `MetricSnapshot` systems.
Derived metrics securely tracked:
- KeyAbroad Total Leads (Count)
- KeyAbroad Active Leads (Count)
- KeyAbroad Students (Count) 
- KeyAbroad Pipeline Value (PKR) (Currency)

## Data Quality
No synthetic data fabrication takes place. If KeyAbroad doesn't return adequate evidence for a given metric, the metric value remains unaltered or is marked as missing/insufficient (avoiding artificial pollution).

## Observability
Telemetry and observability naturally flow into the `SyncJob` tables handled centrally in the `SyncManager`. Complete transparency over sync times, record counts, and failure status is securely logged while entirely ignoring PII data (e.g. names/passports never hit `SyncJob`).

## Security
- HTTPS-only endpoint connection handling.
- Credentials decrypted strictly upon usage in-memory server-side.
- Zero plaintext API tokens stored in code or logs.
- Strictly **Read-Only**: No writes are dispatched to KeyAbroad.
- No direct database access or mock components utilized in production environment.

## Tests
Focused tests are integrated at `tests/integrations/providers/keyabroad/adapter.test.ts`. 
Tests cover:
- Connection Validation (200, 401, Missing tokens).
- Syncing (Missing tokens, Pagination, Metric upserts, Rate-limit 429 response handling).
- Idempotency via mock Upserts and call frequencies.

## Build
The solution compiles successfully within the current Next.js TS infrastructure.

## Production Configuration
The application requires the environment variable `KEYABROAD_CRM_BASE_URL` (Defaults to `https://api.keyabroad.com`) and secure injection of the respective tenant API Key into `ProviderCredential`.

## Known Limitations
1. KeyAbroad has no true `updated_at` for Enquiry/Student.
2. `created_at` is therefore used by the current API for incremental retrieval.
3. Existing-record modifications require reconciliation.
4. KeyAbroad is single-tenant.
5. LeadMachine must never write to KeyAbroad.
