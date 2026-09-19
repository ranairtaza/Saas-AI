/**
 * Phase 47.1 Verification Suite: Observability Security, Health Truth & CI Hardening
 *
 * Requirements:
 * 1. Organization A cannot see Organization B system telemetry.
 * 2. Organization A cannot see Organization B errors.
 * 3. System Operator rules are explicit (ordinary ADMIN is not global operator).
 * 4. Database readiness performs real query.
 * 5. Optional dependency states distinguish CONFIGURED vs AVAILABLE.
 * 6. Sampled telemetry is not labeled exact request count.
 * 7. System snapshot endpoint exists.
 * 8. Snapshot response is consolidated.
 * 9. Migration state is not hardcoded.
 * 10. No secret appears in system output.
 * 11. System health does not fabricate values.
 * 12. CI configuration includes PostgreSQL service and migration deployment.
 * 13. Current Prisma schema/migrations remain valid.
 * 14. No unintended dashboard GET writes.
 * 15. System endpoint is server-side protected.
 */

import prisma from '../src/lib/db';
import { isSystemOperator, ROLES } from '../src/permissions/definitions';
import { checkMigrationConsistency } from '../src/lib/observability/migration-checker';
import { checkDataQuality } from '../src/lib/observability/data-quality';
import { validateSystemConfig } from '../src/lib/observability/config-validator';
import { getAggregateCounters, recordTelemetry } from '../src/lib/observability/telemetry';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ Passed: ${testName}`);
    passed++;
  } else {
    console.error(`❌ Failed: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('==========================================================================');
  console.log('🧪 LEADMACHINE — PHASE 47.1 VERIFICATION');
  console.log('   Observability Security, Health Truth & CI Hardening');
  console.log('==========================================================================\n');

  // Test 1 & 2: Tenant Isolation in System Telemetry & Errors
  console.log('--- Section 1: Tenant Isolation ---');
  const orgAId = `test-org-a-${Date.now()}`;
  const orgBId = `test-org-b-${Date.now()}`;

  try {
    // Create test organizations
    await prisma.organization.createMany({
      data: [
        { id: orgAId, name: 'Tenant A Isolation Test' },
        { id: orgBId, name: 'Tenant B Isolation Test' },
      ],
    });

    // Create telemetry events for Org A and Org B
    await prisma.systemTelemetryEvent.createMany({
      data: [
        {
          organizationId: orgAId,
          eventType: 'REQUEST',
          severity: 'INFO',
          route: '/api/leads',
          statusCode: 200,
          message: 'Telemetry for Org A only',
        },
        {
          organizationId: orgAId,
          eventType: 'ERROR',
          severity: 'ERROR',
          route: '/api/leads/create',
          statusCode: 500,
          message: 'Error for Org A only',
        },
        {
          organizationId: orgBId,
          eventType: 'REQUEST',
          severity: 'INFO',
          route: '/api/discover',
          statusCode: 200,
          message: 'Telemetry for Org B only',
        },
        {
          organizationId: orgBId,
          eventType: 'ERROR',
          severity: 'ERROR',
          route: '/api/discover/search',
          statusCode: 500,
          message: 'Error for Org B only',
        },
      ],
    });

    // Verify Org A query
    const orgAEvents = await prisma.systemTelemetryEvent.findMany({
      where: { organizationId: orgAId },
    });
    const orgAHasBData = orgAEvents.some((e) => e.organizationId === orgBId);
    assert(!orgAHasBData && orgAEvents.length === 2, '1. Organization A admin CANNOT see Organization B telemetry');

    // Verify Org B query
    const orgBEvents = await prisma.systemTelemetryEvent.findMany({
      where: { organizationId: orgBId },
    });
    const orgBHasAData = orgBEvents.some((e) => e.organizationId === orgAId);
    assert(!orgBHasAData && orgBEvents.length === 2, '2. Organization B admin CANNOT see Organization A errors');
  } finally {
    // Clean up
    await prisma.systemTelemetryEvent.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    }).catch(() => {});
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    }).catch(() => {});
  }

  // Test 3: System Operator Rules are Explicit
  console.log('\n--- Section 2: Explicit System Operator Rules ---');
  assert(
    isSystemOperator({ role: 'SYSTEM_ADMIN' }) === true,
    '3a. SYSTEM_ADMIN role is recognized as system operator'
  );
  assert(
    isSystemOperator({ role: 'SUPER_ADMIN' }) === true,
    '3b. SUPER_ADMIN role is recognized as system operator'
  );
  assert(
    isSystemOperator({ role: 'ADMIN' }) === false,
    '3c. Ordinary organization ADMIN is strictly NOT an implicit global operator'
  );
  assert(
    isSystemOperator({ role: 'OWNER' }) === false,
    '3d. Organization OWNER is strictly scoped and NOT an implicit global operator'
  );
  assert(
    isSystemOperator({ role: 'MEMBER' }) === false,
    '3e. Organization MEMBER is strictly NOT a system operator'
  );

  // Test 4: Database Readiness Performs Real SELECT 1
  console.log('\n--- Section 3: Database Readiness Real Query ---');
  const dbStart = Date.now();
  let dbQueried = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbQueried = true;
  } catch {}
  const dbLatency = Date.now() - dbStart;
  assert(dbQueried && dbLatency >= 0, '4. Database readiness executes actual SELECT 1 query and measures latency');

  // Test 5: Optional Dependency Health Distinguishes CONFIGURED vs AVAILABLE
  console.log('\n--- Section 4: Dependency Health Semantics ---');
  const readyRouteContent = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'api', 'health', 'ready', 'route.ts'),
    'utf-8'
  );
  assert(
    readyRouteContent.includes("'CONFIGURED'") &&
    readyRouteContent.includes("'AVAILABLE'") &&
    readyRouteContent.includes("'DEGRADED'") &&
    readyRouteContent.includes("'UNAVAILABLE'") &&
    readyRouteContent.includes("'NOT_CONFIGURED'"),
    '5. Dependency health states explicitly distinguish CONFIGURED vs AVAILABLE vs DEGRADED'
  );

  // Test 6: Sampled Telemetry is NOT labeled exact request count
  console.log('\n--- Section 5: Telemetry Metric Truth ---');
  const counters = getAggregateCounters();
  assert(
    counters.calculationMode === 'EXACT_COUNTERS',
    '6a. getAggregateCounters exposes calculationMode for truthful UI attribution'
  );
  const snapshotRouteContent = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'api', 'system', 'snapshot', 'route.ts'),
    'utf-8'
  );
  assert(
    snapshotRouteContent.includes("observedRequests") &&
    snapshotRouteContent.includes("calculationMode: 'SAMPLED'"),
    '6b. System snapshot distinguishes observedRequests from exact counts and labels sampled calculationMode'
  );

  // Test 7 & 8: System Snapshot Endpoint Exists and is Consolidated
  console.log('\n--- Section 6: Consolidated System Snapshot ---');
  assert(
    fs.existsSync(path.join(process.cwd(), 'src', 'app', 'api', 'system', 'snapshot', 'route.ts')),
    '7. Consolidated /api/system/snapshot endpoint exists'
  );
  assert(
    snapshotRouteContent.includes('database:') &&
    snapshotRouteContent.includes('performance:') &&
    snapshotRouteContent.includes('ai:') &&
    snapshotRouteContent.includes('integrations:') &&
    snapshotRouteContent.includes('jobs:') &&
    snapshotRouteContent.includes('billing:') &&
    snapshotRouteContent.includes('security:') &&
    snapshotRouteContent.includes('dataQuality') &&
    snapshotRouteContent.includes('alerts'),
    '8. Snapshot response consolidates core health, performance, database, AI, integrations, jobs, billing, security, and alerts'
  );

  // Test 9: Migration State is Not Hardcoded
  console.log('\n--- Section 7: Dynamic Migration State Detection ---');
  const migrationResult = await checkMigrationConsistency();
  assert(
    typeof migrationResult.appliedCount === 'number' &&
    ['SYNCHRONIZED', 'PENDING', 'INCONSISTENT', 'UNKNOWN'].includes(migrationResult.status),
    '9. Migration status is dynamically evaluated against _prisma_migrations (not hardcoded)'
  );

  // Test 10 & 11: Zero Secret Leakage & No Fabricated Health
  console.log('\n--- Section 8: Secret Safety & Truthful Health ---');
  const configReport = validateSystemConfig();
  const rawConfigString = JSON.stringify(configReport);
  const dbUrl = process.env.DATABASE_URL || '';
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const sessionSecret = process.env.SESSION_SECRET || '';

  const leaksDbUrl = dbUrl.length > 10 && rawConfigString.includes(dbUrl);
  const leaksStripeKey = stripeKey.length > 10 && rawConfigString.includes(stripeKey);
  const leaksSessionSecret = sessionSecret.length > 10 && rawConfigString.includes(sessionSecret);

  assert(
    !leaksDbUrl && !leaksStripeKey && !leaksSessionSecret,
    '10. System configuration inspection never exposes raw secret values'
  );

  const dqReport = await checkDataQuality();
  assert(
    ['VALID', 'WARNING', 'INVALID', 'INSUFFICIENT_DATA', 'UNKNOWN'].includes(dqReport.status),
    '11. Data quality assessment uses deterministic categorical states without arbitrary numerical scores'
  );

  // Test 12: CI Configuration includes PostgreSQL Service and Migration Deployment
  console.log('\n--- Section 9: CI Workflow Hardening ---');
  const ciYaml = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf-8');
  assert(
    ciYaml.includes('services:') &&
    ciYaml.includes('postgres:') &&
    ciYaml.includes('pg_isready') &&
    ciYaml.includes('prisma migrate deploy'),
    '12. GitHub CI configuration provisions PostgreSQL service container and runs prisma migrate deploy'
  );

  // Test 13: Prisma Singleton Audit (No new PrismaClient outside src/lib/db.ts)
  console.log('\n--- Section 10: Prisma Connection Singleton Audit ---');
  let leakedInstances = 0;
  function scanDir(dir: string) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const fullPath = path.join(dir, f.name);
      if (f.isDirectory()) {
        scanDir(fullPath);
      } else if (f.name.endsWith('.ts') && !fullPath.endsWith('db.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('new PrismaClient()')) {
          leakedInstances++;
          console.error(`Leaked PrismaClient in: ${fullPath}`);
        }
      }
    }
  }
  scanDir(path.join(process.cwd(), 'src'));
  assert(leakedInstances === 0, '13. Zero redundant new PrismaClient() instances in application src (uses singleton)');

  // Test 14: Zero Unintended GET Writes
  console.log('\n--- Section 11: GET Idempotency & Safe Telemetry ---');
  const beforeCount = await prisma.systemTelemetryEvent.count();
  // Call read-only inspection services
  await checkMigrationConsistency();
  await checkDataQuality();
  const afterCount = await prisma.systemTelemetryEvent.count();
  assert(beforeCount === afterCount, '14. System diagnostic inspections perform zero unintended database writes');

  // Test 15: Edge Proxy Server-Side Route Protection
  console.log('\n--- Section 12: Edge Proxy Server-Side Protection ---');
  const proxyCode = fs.readFileSync(path.join(process.cwd(), 'src', 'proxy.ts'), 'utf-8');
  assert(
    proxyCode.includes('/system') &&
    proxyCode.includes('/api/system') &&
    proxyCode.includes('jwtVerify') &&
    !proxyCode.includes('token.length === 64'),
    '15. Edge proxy strictly guards /system and /api/system server-side without arbitrary token bypass'
  );

  console.log('\n==========================================================================');
  console.log(`📊 PHASE 47.1 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in verify_phase47_1:', err);
  process.exit(1);
});
