import { classifyError, IntegrationError } from '../src/lib/integrations/errors';
import { calculateFreshness, calculateIntegrationHealth } from '../src/lib/integrations/health';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log("=== PHASE 39 VERIFICATION ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  // --- 1. Failure Classification ---
  assert(classifyError(new Error("Invalid API Key provided")) === 'AUTH_ERROR', "Classifies AUTH_ERROR correctly");
  assert(classifyError(new Error("Rate limit exceeded")) === 'RATE_LIMIT', "Classifies RATE_LIMIT correctly");
  assert(classifyError(new Error("Connection ETIMEDOUT")) === 'NETWORK_ERROR', "Classifies NETWORK_ERROR correctly");
  assert(classifyError({ code: 'P2002' }) === 'DATABASE_ERROR', "Classifies DATABASE_ERROR correctly");
  assert(classifyError(new Error("Stripe API is down")) === 'PROVIDER_ERROR', "Classifies PROVIDER_ERROR correctly");
  assert(classifyError(new IntegrationError('VALIDATION_ERROR', "Bad format")) === 'VALIDATION_ERROR', "Preserves IntegrationError code");
  assert(classifyError(new Error("Something completely random")) === 'UNKNOWN', "Defaults to UNKNOWN");

  // --- 2. Health Calculation ---
  const now = new Date();
  
  // Freshness
  assert(calculateFreshness(null) === 'UNKNOWN', "Null sync date is UNKNOWN freshness");
  assert(calculateFreshness(new Date(now.getTime() - 10 * 60 * 60 * 1000), now) === 'CURRENT', "Sync < 24h is CURRENT");
  assert(calculateFreshness(new Date(now.getTime() - 30 * 60 * 60 * 1000), now) === 'AGING', "Sync 24-48h is AGING");
  assert(calculateFreshness(new Date(now.getTime() - 50 * 60 * 60 * 1000), now) === 'STALE', "Sync > 48h is STALE");

  // Integration Health State
  assert(calculateIntegrationHealth('DISCONNECTED', null, 0, now) === 'DISCONNECTED', "Status DISCONNECTED overrides others");
  assert(calculateIntegrationHealth('ACTIVE', null, 0, now) === 'NEVER_SYNCED', "No syncs + ACTIVE is NEVER_SYNCED");
  assert(calculateIntegrationHealth('ACTIVE', new Date(now.getTime() - 1000), 0, now) === 'HEALTHY', "Recent sync is HEALTHY");
  assert(calculateIntegrationHealth('ACTIVE', new Date(now.getTime() - 1000), 2, now) === 'DEGRADED', "1-2 failures is DEGRADED");
  assert(calculateIntegrationHealth('ACTIVE', new Date(now.getTime() - 1000), 3, now) === 'FAILING', ">=3 failures is FAILING");
  assert(calculateIntegrationHealth('FAILING', new Date(now.getTime() - 1000), 1, now) === 'FAILING', "Connection FAILING overrides");
  assert(calculateIntegrationHealth('ACTIVE', new Date(now.getTime() - 50 * 60 * 60 * 1000), 0, now) === 'STALE', "STALE overrides healthy if too old");

  // --- 3. Schema Check ---
  const schemaStr = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf-8');
  assert(schemaStr.includes('trigger                 String                @default("SYSTEM")'), "SyncJob has trigger field");
  assert(schemaStr.includes('durationMs              Int?'), "SyncJob has durationMs field");
  assert(schemaStr.includes('errorCode               String?'), "SyncJob has errorCode field");
  assert(schemaStr.includes('updatedAt               DateTime              @updatedAt'), "SyncJob has updatedAt field");
  assert(schemaStr.includes('@@index([organizationId, createdAt])'), "SyncJob has new indexes");

  // --- 4. Context Builder Check ---
  const contextBuilderCode = fs.readFileSync(path.join(__dirname, '../src/ai/executive/context-builder.ts'), 'utf-8');
  assert(contextBuilderCode.includes("dataFreshness = await Promise.all"), "Context Builder fetches dataFreshness");
  assert(contextBuilderCode.includes("calculateFreshness(lastSuccessfulSyncAt)"), "Context Builder calls calculateFreshness");

  // --- 5. SyncIntegration Check ---
  const syncFuncCode = fs.readFileSync(path.join(__dirname, '../src/lib/inngest/functions/integrations.ts'), 'utf-8');
  assert(syncFuncCode.includes("attempt > 0 ? 'RETRYING' : 'RUNNING'"), "SyncIntegration handles Inngest retries correctly");
  assert(syncFuncCode.includes("const errorCode = classifyError(error)"), "SyncIntegration classifies errors");

  console.log(`\nResults: ${passed} / ${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(console.error);
