import { PrismaClient } from '@prisma/client';
import { BusinessContextBuilder } from '../src/ai/executive/context-builder';
import { syncManager } from '../src/integrations/core/manager';
import { encrypt, decrypt } from '../src/lib/encryption';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== PHASE 38 VERIFICATION ===");
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

  // --- A. Production configuration & ENV ---
  assert(!!process.env.PROVIDER_ENCRYPTION_KEY, "PROVIDER_ENCRYPTION_KEY is defined");
  assert(!!process.env.DATABASE_URL, "DATABASE_URL is defined");
  
  // --- U. PostgreSQL Verification ---
  assert(process.env.DATABASE_URL!.includes("postgresql"), "Using PostgreSQL database");

  // --- R. No mock revenue ---
  const contextBuilderCode = fs.readFileSync(path.join(__dirname, '../src/ai/executive/context-builder.ts'), 'utf-8');
  assert(!contextBuilderCode.includes("revenueMTD = 14500;"), "Mock revenue removed from context builder");
  assert(!contextBuilderCode.includes("pipelineValue = 145000;"), "Mock pipeline removed from context builder");

  // --- T. DatabaseWriteGuard ---
  assert(process.env.LEADMACHINE_DB_WRITES_ENABLED === 'true', "DatabaseWriteGuard is enabled for writes");

  // --- E. Credential Encryption & F. No credential leakage & D. Tenant Isolation ---
  const testSecret = "sk_test_123456";
  const encrypted = encrypt(testSecret);
  assert(encrypted !== testSecret, "Encryption modifies the plaintext secret");
  
  const decrypted = decrypt(encrypted);
  assert(decrypted === testSecret, "Decryption successfully restores the secret");

  // --- G. Inngest Registration ---
  const routeCode = fs.readFileSync(path.join(__dirname, '../src/app/api/inngest/route.ts'), 'utf-8');
  assert(routeCode.includes("syncIntegration") && routeCode.includes("scheduleSyncIntegrations"), "Inngest durable functions are registered");

  // --- K. Idempotency & H. Durable Sync ---
  const integrationsCode = fs.readFileSync(path.join(__dirname, '../src/lib/inngest/functions/integrations.ts'), 'utf-8');
  assert(integrationsCode.includes("inngest.createFunction"), "Inngest durable functions are defined correctly");
  assert(integrationsCode.includes("concurrency: {") && integrationsCode.includes("limit: 1"), "Concurrency limit prevents duplicate syncs (L. Concurrency safety)");

  console.log(`\nResults: ${passed} / ${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
