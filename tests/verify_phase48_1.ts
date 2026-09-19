/**
 * Phase 48.1 Verification Suite: Observability Security, Health Truth & CI Hardening
 *
 * Mandatory 20-Point Behavioral Test Suite:
 * 1. Snapshot requires authentication.
 * 2. Snapshot rejects unauthorized roles.
 * 3. Snapshot is organization scoped.
 * 4. Organization A cannot see B telemetry.
 * 5. Organization B cannot see A telemetry.
 * 6. Organization A cannot see B security events.
 * 7. Organization A cannot see B integration data.
 * 8. Snapshot cache is tenant isolated (request as A, request as B, verify no leakage).
 * 9. Error endpoint is tenant isolated.
 * 10. Health distinguishes CONFIGURED from AVAILABLE.
 * 11. Missing Gemini is NOT_CONFIGURED.
 * 12. Missing Stripe is NOT_CONFIGURED.
 * 13. DB unavailable => readiness unavailable.
 * 14. No secrets leak from health endpoints.
 * 15. Sampled telemetry is labelled observed/sampled, not exact request volume.
 * 16. Missing historical data is not rendered as zero.
 * 17. Migration status is dynamically determined.
 * 18. CI workflow contains an actual PostgreSQL service.
 * 19. Existing Phase 48 tests still pass.
 * 20. No regression to existing route protection.
 */

import assert from 'assert';
import { NextRequest } from 'next/server';
import prisma from '../src/lib/db';
import { setTestUserOverride } from '../src/lib/session';
import { GET as snapshotGET, tenantSnapshotCache } from '../src/app/api/system/snapshot/route';
import { GET as overviewGET } from '../src/app/api/system/overview/route';
import { GET as errorsGET } from '../src/app/api/system/errors/route';
import { GET as readyHealthGET } from '../src/app/api/health/ready/route';
import { GET as systemHealthGET } from '../src/app/api/system/health/route';
import {
  recordMetricToBucket,
  clearMetricBuckets,
  getTimeWindowAggregateCounters,
} from '../src/lib/observability/telemetry';
import {
  checkDatabaseHealth,
  checkGeminiHealth,
  checkStripeHealth,
  checkUpstashHealth,
  checkInngestHealth,
  getSystemDependencyHealth,
} from '../src/lib/observability/dependency-health';
import { checkMigrationConsistency } from '../src/lib/observability/migration-checker';
import { checkDataQuality } from '../src/lib/observability/data-quality';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

console.log('==========================================================================');
console.log('🧪 LEADMACHINE — PHASE 48.1 VERIFICATION');
console.log('   Observability Security, Health Truth & CI Hardening Suite');
console.log('==========================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    console.error(`❌ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  const orgAId = `test-org-a-${Date.now()}`;
  const orgBId = `test-org-b-${Date.now()}`;
  const userAId = `user-a-${Date.now()}`;
  const userBId = `user-b-${Date.now()}`;

  try {
    // Setup test database fixtures for Org A and Org B
    await prisma.organization.createMany({
      data: [
        { id: orgAId, name: 'Tenant A Verification Corp' },
        { id: orgBId, name: 'Tenant B Verification Corp' },
      ],
    });

    await prisma.user.createMany({
      data: [
        {
          id: userAId,
          email: `admin-a-${Date.now()}@example.com`,
          passwordHash: 'hash-a',
          role: 'ADMIN',
          organizationId: orgAId,
        },
        {
          id: userBId,
          email: `admin-b-${Date.now()}@example.com`,
          passwordHash: 'hash-b',
          role: 'ADMIN',
          organizationId: orgBId,
        },
      ],
    });

    // Create distinctive telemetry for A and B
    await prisma.systemTelemetryEvent.createMany({
      data: [
        {
          organizationId: orgAId,
          userId: userAId,
          eventType: 'REQUEST',
          severity: 'INFO',
          route: '/org-a-test-route',
          statusCode: 200,
          durationMs: 120,
          message: 'Telemetry exclusively for Org A',
        },
        {
          organizationId: orgAId,
          userId: userAId,
          eventType: 'ERROR',
          severity: 'ERROR',
          route: '/org-a-error-route',
          statusCode: 500,
          durationMs: 350,
          message: 'Error exclusively for Org A',
        },
        {
          organizationId: orgBId,
          userId: userBId,
          eventType: 'REQUEST',
          severity: 'INFO',
          route: '/org-b-test-route',
          statusCode: 200,
          durationMs: 140,
          message: 'Telemetry exclusively for Org B',
        },
        {
          organizationId: orgBId,
          userId: userBId,
          eventType: 'ERROR',
          severity: 'ERROR',
          route: '/org-b-error-route',
          statusCode: 500,
          durationMs: 400,
          message: 'Error exclusively for Org B',
        },
      ],
    });

    // Create distinctive Security AuditLog for A and B
    await prisma.auditLog.createMany({
      data: [
        {
          organizationId: orgAId,
          userId: userAId,
          action: 'ORG_A_SENSITIVE_EXPORT',
          status: 'FAILURE',
          riskLevel: 'SENSITIVE',
          resource: 'leads',
        },
        {
          organizationId: orgBId,
          userId: userBId,
          action: 'ORG_B_SENSITIVE_KEY_ROTATION',
          status: 'FAILURE',
          riskLevel: 'SENSITIVE',
          resource: 'api_keys',
        },
      ],
    });

    // Create distinctive Integration for A and B
    const testIntegration = await prisma.integration.findFirst();
    let integrationId = testIntegration?.id;
    if (!integrationId) {
      const created = await prisma.integration.create({
        data: {
          provider: `provider-${Date.now()}`,
          name: 'Test Integration Provider',
          type: 'CRM',
        },
      });
      integrationId = created.id;
    }

    await prisma.integrationConnection.createMany({
      data: [
        {
          organizationId: orgAId,
          integrationId,
          status: 'ACTIVE',
        },
        {
          organizationId: orgBId,
          integrationId,
          status: 'ACTIVE',
        },
      ],
    });

    // ==========================================
    // 1. Snapshot requires authentication
    // ==========================================
    await it('1. Snapshot requires authentication', async () => {
      setTestUserOverride(null);
      const req = new NextRequest('http://localhost:3000/api/system/snapshot');
      const res = await snapshotGET(req);
      assert.strictEqual(res.status, 401, 'Unauthenticated call must return 401');
      const body = await res.json();
      assert.strictEqual(body.error, 'Unauthorized');
    });

    // ==========================================
    // 2. Snapshot rejects unauthorized roles
    // ==========================================
    await it('2. Snapshot rejects unauthorized roles', async () => {
      setTestUserOverride({
        id: 'member-user',
        email: 'member@test.com',
        role: 'MEMBER',
        organizationId: orgAId,
      });
      const req = new NextRequest('http://localhost:3000/api/system/snapshot');
      const res = await snapshotGET(req);
      assert.strictEqual(res.status, 403, 'MEMBER role must be rejected with 403');
    });

    // ==========================================
    // 3. Snapshot is organization scoped
    // ==========================================
    await it('3. Snapshot is organization scoped', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin@org-a.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });
      const req = new NextRequest('http://localhost:3000/api/system/snapshot?timeRange=24h&refresh=true');
      const res = await snapshotGET(req);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.tenantContext.organizationId, orgAId);
      assert.strictEqual(body.tenantContext.isolated, true);
      assert.strictEqual(body.tenantContext.isGlobalOperator, false);
    });

    // ==========================================
    // 4. Organization A cannot see B telemetry
    // ==========================================
    let snapshotAData: any;
    await it('4. Organization A cannot see B telemetry', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin@org-a.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });
      const req = new NextRequest('http://localhost:3000/api/system/snapshot?timeRange=24h&refresh=true');
      const res = await snapshotGET(req);
      assert.strictEqual(res.status, 200);
      snapshotAData = await res.json();

      const slowRouteStrings = JSON.stringify(snapshotAData.performance.topSlowRoutes);
      const failingRouteStrings = JSON.stringify(snapshotAData.performance.topFailingRoutes);

      assert(
        slowRouteStrings.includes('/org-a-test-route') || failingRouteStrings.includes('/org-a-error-route'),
        'Org A must see its own route telemetry'
      );
      assert(!slowRouteStrings.includes('/org-b-test-route'), 'Org A MUST NOT see Org B test route');
      assert(!failingRouteStrings.includes('/org-b-error-route'), 'Org A MUST NOT see Org B error route');
    });

    // ==========================================
    // 5. Organization B cannot see A telemetry
    // ==========================================
    let snapshotBData: any;
    await it('5. Organization B cannot see A telemetry', async () => {
      setTestUserOverride({
        id: userBId,
        email: 'admin@org-b.com',
        role: 'ADMIN',
        organizationId: orgBId,
      });
      const req = new NextRequest('http://localhost:3000/api/system/snapshot?timeRange=24h&refresh=true');
      const res = await snapshotGET(req);
      assert.strictEqual(res.status, 200);
      snapshotBData = await res.json();

      const slowRouteStrings = JSON.stringify(snapshotBData.performance.topSlowRoutes);
      const failingRouteStrings = JSON.stringify(snapshotBData.performance.topFailingRoutes);

      assert(
        slowRouteStrings.includes('/org-b-test-route') || failingRouteStrings.includes('/org-b-error-route'),
        'Org B must see its own route telemetry'
      );
      assert(!slowRouteStrings.includes('/org-a-test-route'), 'Org B MUST NOT see Org A test route');
      assert(!failingRouteStrings.includes('/org-a-error-route'), 'Org B MUST NOT see Org A error route');
    });

    // ==========================================
    // 6. Organization A cannot see B security events
    // ==========================================
    await it('6. Organization A cannot see B security events', async () => {
      const securityA = snapshotAData.security.recentEvents;
      assert(Array.isArray(securityA), 'Security events must be an array');
      const serialized = JSON.stringify(securityA);
      assert(serialized.includes('ORG_A_SENSITIVE_EXPORT'), 'Org A must see its own audit log');
      assert(!serialized.includes('ORG_B_SENSITIVE_KEY_ROTATION'), 'Org A MUST NOT see Org B audit events');
    });

    // ==========================================
    // 7. Organization A cannot see B integration data
    // ==========================================
    await it('7. Organization A cannot see B integration data', async () => {
      const connectionsA = snapshotAData.integrations.connections;
      assert(Array.isArray(connectionsA), 'Connections must be an array');
      // Query Org A connections from DB to verify IDs match
      const orgAConnections = await prisma.integrationConnection.findMany({
        where: { organizationId: orgAId },
        select: { id: true },
      });
      const orgBConnections = await prisma.integrationConnection.findMany({
        where: { organizationId: orgBId },
        select: { id: true },
      });

      const returnedIds = connectionsA.map((c: any) => c.id);
      for (const conn of orgAConnections) {
        assert(returnedIds.includes(conn.id), 'Org A connection must be present');
      }
      for (const conn of orgBConnections) {
        assert(!returnedIds.includes(conn.id), 'Org B connection MUST NOT be present in Org A snapshot');
      }
    });

    // ==========================================
    // 8. Snapshot cache is tenant isolated
    // ==========================================
    await it('8. Snapshot cache is tenant isolated', async () => {
      // Step 1: Request as A (populates Org A cache)
      setTestUserOverride({
        id: userAId,
        email: 'admin@org-a.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });
      const reqA = new NextRequest('http://localhost:3000/api/system/snapshot?timeRange=24h');
      const resA = await snapshotGET(reqA);
      assert.strictEqual(resA.status, 200);

      // Verify cache contains Org A key
      assert(tenantSnapshotCache.has(`${orgAId}:24h`), 'Cache must contain Org A key');

      // Step 2: Request same snapshot as B WITHOUT force-refresh
      setTestUserOverride({
        id: userBId,
        email: 'admin@org-b.com',
        role: 'ADMIN',
        organizationId: orgBId,
      });
      const reqB = new NextRequest('http://localhost:3000/api/system/snapshot?timeRange=24h');
      const resB = await snapshotGET(reqB);
      assert.strictEqual(resB.status, 200);
      const dataBFromCache = await resB.json();

      // Ensure B receives B data, NOT A's cached snapshot
      assert.strictEqual(dataBFromCache.tenantContext.organizationId, orgBId);
      const serializedB = JSON.stringify(dataBFromCache);
      assert(serializedB.includes('/org-b-test-route') || serializedB.includes('ORG_B_SENSITIVE'), 'B must receive B data');
      assert(!serializedB.includes('/org-a-test-route'), 'B MUST NOT receive A data from cache');
      assert(!serializedB.includes('ORG_A_SENSITIVE_EXPORT'), 'B MUST NOT receive A security audit from cache');

      // Verify cache now contains both distinct keys
      assert(tenantSnapshotCache.has(`${orgAId}:24h`), 'Cache has Org A key');
      assert(tenantSnapshotCache.has(`${orgBId}:24h`), 'Cache has Org B key');
    });

    // ==========================================
    // 9. Error endpoint is tenant isolated
    // ==========================================
    await it('9. Error endpoint is tenant isolated', async () => {
      // Query errors as Org A
      setTestUserOverride({
        id: userAId,
        email: 'admin@org-a.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });
      const errReqA = new NextRequest('http://localhost:3000/api/system/errors?limit=50');
      const errResA = await errorsGET(errReqA);
      assert.strictEqual(errResA.status, 200);
      const errDataA = await errResA.json();

      assert(Array.isArray(errDataA.events), 'Events must be an array');
      for (const ev of errDataA.events) {
        assert.strictEqual(ev.organizationId, orgAId, 'All errors returned to Org A admin must belong to Org A');
        assert.notStrictEqual(ev.organizationId, orgBId, 'No Org B errors may be returned to Org A');
      }

      // Query errors as Org B
      setTestUserOverride({
        id: userBId,
        email: 'admin@org-b.com',
        role: 'ADMIN',
        organizationId: orgBId,
      });
      const errReqB = new NextRequest('http://localhost:3000/api/system/errors?limit=50');
      const errResB = await errorsGET(errReqB);
      assert.strictEqual(errResB.status, 200);
      const errDataB = await errResB.json();

      for (const ev of errDataB.events) {
        assert.strictEqual(ev.organizationId, orgBId, 'All errors returned to Org B admin must belong to Org B');
        assert.notStrictEqual(ev.organizationId, orgAId, 'No Org A errors may be returned to Org B');
      }
    });

    // ==========================================
    // 10. Health distinguishes CONFIGURED from AVAILABLE
    // ==========================================
    await it('10. Health distinguishes CONFIGURED from AVAILABLE', async () => {
      const upstashHealth = await checkUpstashHealth();
      assert(['CONFIGURED', 'NOT_CONFIGURED'].includes(upstashHealth.status));
      assert(typeof upstashHealth.configured === 'boolean');
      assert(typeof upstashHealth.available === 'boolean');
      assert(upstashHealth.evidence.length > 0);

      const dbHealth = await checkDatabaseHealth();
      assert.strictEqual(dbHealth.status, 'AVAILABLE', 'PostgreSQL database ping must return AVAILABLE');
      assert.strictEqual(dbHealth.configured, true);
      assert.strictEqual(dbHealth.available, true);
    });

    // ==========================================
    // 11. Missing Gemini is NOT_CONFIGURED
    // ==========================================
    await it('11. Missing Gemini is NOT_CONFIGURED', async () => {
      const origGoogle = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      const origGemini = process.env.GEMINI_API_KEY;
      try {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        const health = await checkGeminiHealth();
        assert.strictEqual(health.status, 'NOT_CONFIGURED');
        assert.strictEqual(health.configured, false);
        assert.strictEqual(health.available, false);
      } finally {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = origGoogle;
        process.env.GEMINI_API_KEY = origGemini;
      }
    });

    // ==========================================
    // 12. Missing Stripe is NOT_CONFIGURED
    // ==========================================
    await it('12. Missing Stripe is NOT_CONFIGURED', async () => {
      const origStripe = process.env.STRIPE_SECRET_KEY;
      try {
        delete process.env.STRIPE_SECRET_KEY;
        const health = await checkStripeHealth();
        assert.strictEqual(health.status, 'NOT_CONFIGURED');
        assert.strictEqual(health.configured, false);
        assert.strictEqual(health.available, false);
      } finally {
        process.env.STRIPE_SECRET_KEY = origStripe;
      }
    });

    // ==========================================
    // 13. DB unavailable => readiness unavailable
    // ==========================================
    await it('13. DB unavailable => readiness unavailable', async () => {
      const origDbUrl = process.env.DATABASE_URL;
      try {
        process.env.DATABASE_URL = 'postgresql://invalid_user:invalid_pass@localhost:9999/nonexistent';
        // When DB is unreachable, checkDatabaseHealth reports UNAVAILABLE
        const origQueryRaw = prisma.$queryRaw;
        (prisma as any).$queryRaw = async () => {
          throw new Error('Connection refused to mock database');
        };

        try {
          const dbHealth = await checkDatabaseHealth();
          assert.strictEqual(dbHealth.status, 'UNAVAILABLE');
          assert.strictEqual(dbHealth.available, false);

          const res = await readyHealthGET();
          assert.strictEqual(res.status, 503, 'Readiness must return HTTP 503 when core DB is unavailable');
          const body = await res.json();
          assert.strictEqual(body.status, 'UNAVAILABLE');
          assert.strictEqual(body.readiness.requiredServicesOperational, false);
        } finally {
          (prisma as any).$queryRaw = origQueryRaw;
        }
      } finally {
        process.env.DATABASE_URL = origDbUrl;
      }
    });

    // ==========================================
    // 14. No secrets leak from health endpoints
    // ==========================================
    await it('14. No secrets leak from health endpoints', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin@org-a.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });

      const readyRes = await readyHealthGET();
      const readyJson = await readyRes.json();
      const readyStr = JSON.stringify(readyJson);

      assert(!readyStr.includes('postgresql://'), 'Readiness must not contain DB URL credentials');
      assert(!readyStr.includes(process.env.SESSION_SECRET || 'impossible_secret'));

      const sysRes = await systemHealthGET();
      const sysJson = await sysRes.json();
      const sysStr = JSON.stringify(sysJson);

      assert(!sysStr.includes('postgresql://'), 'System health must not contain DB URL');
      assert(!sysStr.includes(process.env.SESSION_SECRET || 'impossible_secret'));
      assert(!sysStr.includes(process.env.PROVIDER_ENCRYPTION_KEY || 'impossible_key'));
    });

    // ==========================================
    // 15. Sampled telemetry is labelled observed/sampled, not exact request volume
    // ==========================================
    await it('15. Sampled telemetry is labelled observed/sampled, not exact request volume', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin@org-a.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });
      const req = new NextRequest('http://localhost:3000/api/system/snapshot?timeRange=24h&refresh=true');
      const res = await snapshotGET(req);
      const json = await res.json();

      assert('observedRequests' in json.performance, 'Must contain observedRequests field');
      assert.strictEqual(json.performance.calculationMode, 'SAMPLED', 'calculationMode must be SAMPLED');
      assert('observedP50Ms' in json.performance, 'Percentiles must be labelled observed');
      assert('observedP95Ms' in json.performance, 'p95 must be labelled observed');
    });

    // ==========================================
    // 16. Missing historical data is not rendered as zero
    // ==========================================
    await it('16. Missing historical data is not rendered as zero', async () => {
      const fakeOrgId = `empty-org-${Date.now()}`;
      const dqReport = await checkDataQuality(fakeOrgId);
      assert(
        dqReport.checks.some((c) => c.status === 'INSUFFICIENT_DATA'),
        'Data quality checks with zero history must return INSUFFICIENT_DATA rather than false 0 validity'
      );
    });

    // ==========================================
    // 17. Migration status is dynamically determined
    // ==========================================
    await it('17. Migration status is dynamically determined', async () => {
      const migrationCheck = await checkMigrationConsistency();
      assert(['SYNCHRONIZED', 'PENDING', 'INCONSISTENT', 'UNKNOWN'].includes(migrationCheck.status));
      assert(typeof migrationCheck.appliedCount === 'number');
      assert(typeof migrationCheck.expectedCount === 'number');
      assert(migrationCheck.appliedCount > 0, 'Must detect real applied migrations in Postgres');
      assert(migrationCheck.expectedCount > 0, 'Must count filesystem migrations');
    });

    // ==========================================
    // 18. CI workflow contains an actual PostgreSQL service
    // ==========================================
    await it('18. CI workflow contains an actual PostgreSQL service', () => {
      const ciPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml');
      assert(fs.existsSync(ciPath), 'ci.yml must exist');
      const ciContent = fs.readFileSync(ciPath, 'utf8');

      assert(ciContent.includes('services:'), 'ci.yml must configure services block');
      assert(ciContent.includes('image: postgres:16'), 'ci.yml must use postgres:16');
      assert(ciContent.includes('--health-cmd'), 'ci.yml must specify health check command');
      assert(ciContent.includes('pg_isready'), 'ci.yml health check must use pg_isready');
      assert(ciContent.includes('prisma migrate deploy'), 'ci.yml must deploy prisma migrations to test DB');
    });

    // ==========================================
    // 19. Existing Phase 48 tests still pass
    // ==========================================
    await it('19. Existing Phase 48 tests still pass', () => {
      const output = execSync('npx tsx tests/verify_phase48.ts', {
        encoding: 'utf8',
        env: { ...process.env, LEADMACHINE_DB_WRITES_ENABLED: 'false' },
      });
      assert(output.includes('PHASE 48 VERIFICATION COMPLETE'), 'Existing Phase 48 test suite must pass 100%');
    });

    // ==========================================
    // 20. No regression to existing route protection
    // ==========================================
    await it('20. No regression to existing route protection', () => {
      const proxyPath = path.join(process.cwd(), 'src', 'proxy.ts');
      assert(fs.existsSync(proxyPath), 'src/proxy.ts must exist');
      const proxyContent = fs.readFileSync(proxyPath, 'utf8');

      assert(proxyContent.includes("'/system'"), 'Must protect /system private routes');
      assert(proxyContent.includes("'/api/system'"), 'Must protect /api/system routes');
      assert(proxyContent.includes("'/dashboard'"), 'Must protect /dashboard routes');
      assert(proxyContent.includes('jwtVerify'), 'Must enforce cryptographically secure JWT verification');
      assert(proxyContent.includes('isProtectedPath'), 'Must check protected paths');
    });

    // ==========================================
    // 21. Non-global user cannot override organizationId via query parameters
    // ==========================================
    await it('21. Non-global user cannot override organizationId via query parameters', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin-a@example.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });

      // Attempt to force Org B data by sending ?organizationId=orgBId
      const req = new NextRequest(`http://localhost:3000/api/system/snapshot?organizationId=${orgBId}&refresh=true`);
      const res = await snapshotGET(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      // Must be strictly scoped to Org A, ignoring query parameter
      assert.strictEqual(json.tenant.organizationId, orgAId, 'Must ignore ?organizationId= for non-operator');
      assert.strictEqual(json.tenant.isolated, true);
      const routes = json.performance.topSlowRoutes.map((r: any) => r.route);
      assert(!routes.includes('/org-b-test-route'), 'Must never return Org B routes to Org A admin');
    });

    // ==========================================
    // 22. Time-window request totals strictly respect requested time window
    // ==========================================
    await it('22. Time-window request totals strictly respect requested time window', async () => {
      clearMetricBuckets();
      const now = Date.now();
      const tMinus2h = now - 2.5 * 60 * 60 * 1000;
      const tMinus30m = now - 30 * 60 * 1000;
      const tMinus10d = now - 10 * 24 * 60 * 60 * 1000;

      // Seed time-bucketed metrics for orgAId
      recordMetricToBucket(
        {
          organizationId: orgAId,
          eventType: 'REQUEST',
          route: '/t-minus-2h',
          statusCode: 200,
        },
        tMinus2h
      );

      recordMetricToBucket(
        {
          organizationId: orgAId,
          eventType: 'REQUEST',
          route: '/t-minus-30m',
          statusCode: 200,
        },
        tMinus30m
      );

      recordMetricToBucket(
        {
          organizationId: orgAId,
          eventType: 'REQUEST',
          route: '/t-minus-10d',
          statusCode: 200,
        },
        tMinus10d
      );

      // Also create telemetry events in DB with historical createdAt
      await prisma.systemTelemetryEvent.createMany({
        data: [
          {
            organizationId: orgAId,
            eventType: 'REQUEST',
            route: '/t-minus-2h',
            statusCode: 200,
            durationMs: 150,
            createdAt: new Date(tMinus2h),
          },
          {
            organizationId: orgAId,
            eventType: 'REQUEST',
            route: '/t-minus-30m',
            statusCode: 200,
            durationMs: 110,
            createdAt: new Date(tMinus30m),
          },
          {
            organizationId: orgAId,
            eventType: 'REQUEST',
            route: '/t-minus-10d',
            statusCode: 200,
            durationMs: 95,
            createdAt: new Date(tMinus10d),
          },
        ],
      });

      // 1. Query window: 1h
      const counters1h = getTimeWindowAggregateCounters(now - 60 * 60 * 1000, now, orgAId);
      assert.strictEqual(counters1h.exactTotalRequests, 1, '1h window must contain exactly 1 request (t-30m)');

      // 2. Query window: 7d (168h)
      const counters7d = getTimeWindowAggregateCounters(now - 7 * 24 * 60 * 60 * 1000, now, orgAId);
      assert.strictEqual(counters7d.exactTotalRequests, 2, '7d window must contain 2 requests (t-30m and t-2h), excluding t-10d');

      // 3. Query window: 30d
      const counters30d = getTimeWindowAggregateCounters(now - 30 * 24 * 60 * 60 * 1000, now, orgAId);
      assert.strictEqual(counters30d.exactTotalRequests, 3, '30d window must contain all 3 requests');

      // Exercise snapshot GET with 1h timeRange
      setTestUserOverride({
        id: userAId,
        email: 'admin-a@example.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });

      const res1h = await snapshotGET(new NextRequest(`http://localhost:3000/api/system/snapshot?timeRange=1h&refresh=true`));
      assert.strictEqual(res1h.status, 200);
      const json1h = await res1h.json();

      // Check that /t-minus-2h and /t-minus-10d are excluded from 1h snapshot
      const slowRoutes1h = json1h.performance.topSlowRoutes.map((r: any) => r.route);
      assert(!slowRoutes1h.includes('/t-minus-2h'), 'T-2h route must not appear in 1h snapshot');
      assert(!slowRoutes1h.includes('/t-minus-10d'), 'T-10d route must not appear in 1h snapshot');
    });

    // ==========================================
    // 23. Performance semantics distinguish EXACT, SAMPLED, and truthful percentiles
    // ==========================================
    await it('23. Performance semantics distinguish EXACT, SAMPLED, and truthful percentiles', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin-a@example.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });

      const res = await snapshotGET(new NextRequest(`http://localhost:3000/api/system/snapshot?timeRange=24h&refresh=true`));
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert(['EXACT', 'SAMPLED', 'INSUFFICIENT_DATA'].includes(json.performance.calculationMode));
      assert(typeof json.performance.totalRequests === 'number');
      assert(typeof json.performance.observedRequests === 'number');
      assert(json.performance.observedP95Ms !== undefined, 'Must provide observedP95Ms');
      assert(json.performance.observedP99Ms !== undefined, 'Must provide observedP99Ms');
      assert(['SAMPLED', 'INSUFFICIENT_DATA'].includes(json.performance.latencyCalculationMode));
    });

    // ==========================================
    // 24. Overview endpoint delegates to snapshot with identical data structure
    // ==========================================
    await it('24. /api/system/overview delegates to /api/system/snapshot with identical data structure', async () => {
      setTestUserOverride({
        id: userAId,
        email: 'admin-a@example.com',
        role: 'ADMIN',
        organizationId: orgAId,
      });

      const reqOverview = new NextRequest(`http://localhost:3000/api/system/overview?timeRange=24h&refresh=true`);
      const resOverview = await overviewGET(reqOverview);
      assert.strictEqual(resOverview.status, 200);
      const jsonOverview = await resOverview.json();

      assert(jsonOverview.infrastructure !== undefined, 'Overview must provide infrastructure scope');
      assert(jsonOverview.tenant !== undefined, 'Overview must provide tenant scope');
      assert.strictEqual(jsonOverview.tenant.organizationId, orgAId, 'Overview must be tenant isolated');
    });

  } finally {
    // Clean up test organizations and related records
    setTestUserOverride(undefined);
    try {
      await prisma.systemTelemetryEvent.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      }).catch(() => {});
      await prisma.auditLog.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      }).catch(() => {});
      await prisma.integrationConnection.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      }).catch(() => {});
      await prisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      }).catch(() => {});
    } catch {
      // Ignored cleanup errors
    }
  }

  console.log('==========================================================================');
  console.log(`🎉 PHASE 48.1 HARDENING VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==========================================================================');
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
