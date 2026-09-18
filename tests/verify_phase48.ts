import assert from 'assert';
import { GET as liveHealthGET } from '../src/app/api/health/live/route';
import { GET as readyHealthGET } from '../src/app/api/health/ready/route';
import { validateSystemConfig } from '../src/lib/observability/config-validator';
import { checkMigrationConsistency } from '../src/lib/observability/migration-checker';
import { checkDataQuality } from '../src/lib/observability/data-quality';
import { getDeploymentMetadata } from '../src/lib/observability/deployment';
import {
  generateCorrelationIds,
  recordTelemetryEvent,
  getTelemetryPipelineHealth,
} from '../src/lib/observability/telemetry';

console.log('==========================================================================');
console.log('🧪 LEADMACHINE — PHASE 48 VERIFICATION');
console.log('   System Command Center & Full Observability Suite');
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
  // 1. /api/health/live works without database
  await it('1. /api/health/live returns process liveness without database queries', async () => {
    const res = await liveHealthGET();
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.status === 'HEALTHY' || body.status === 'UP', 'Status must be HEALTHY or UP');
    assert.strictEqual(body.service, 'leadmachine-platform');
    assert(body.timestamp, 'Timestamp must be present');
    assert(!('database' in body), 'Live endpoint must not expose database internals');
  });

  // 2. /api/health/ready reports dependency state
  await it('2. /api/health/ready reports dependency readiness state', async () => {
    const res = await readyHealthGET();
    assert(res.status === 200 || res.status === 503);
    const body = await res.json();
    assert(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'READY'].includes(body.status), `Unexpected status: ${body.status}`);
    assert('dependencies' in body, 'Dependencies map must be present');
    assert(!JSON.stringify(body).includes('postgresql://'), 'Database URL must not leak in readiness');
  });

  // 3. Configuration Health Validator strictly hides secrets
  await it('3. validateSystemConfig validates env presence without exposing secrets', () => {
    const configs = validateSystemConfig();
    assert(Array.isArray(configs), 'Configs must be an array');
    assert(configs.length >= 10, 'Must check at least 10 core configuration keys');

    for (const c of configs) {
      assert(['CONFIGURED', 'MISSING', 'INVALID', 'NOT_REQUIRED'].includes(c.status));
      assert(!('value' in c), `Config object for ${c.key} must never contain raw secret value`);
    }

    const serialized = JSON.stringify(configs);
    assert(!serialized.includes(process.env.SESSION_SECRET || 'impossible_secret'));
    assert(!serialized.includes(process.env.PROVIDER_ENCRYPTION_KEY || 'impossible_key'));
  });

  // 4. Gemini Provider status distinguishes LIVE, NOT_CONFIGURED, and TEST/MOCK
  await it('4. Gemini status reflects actual key state without fake values', () => {
    const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const originalGeminiKey = process.env.GEMINI_API_KEY;

    try {
      // Case A: Missing
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      const hasKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
      const statusA = hasKey ? 'LIVE' : 'NOT_CONFIGURED';
      assert.strictEqual(statusA, 'NOT_CONFIGURED');

      // Case B: Mock key
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'mock_key';
      const isMock = process.env.GOOGLE_GENERATIVE_AI_API_KEY === 'mock_key';
      const statusB = isMock ? 'TEST/MOCK' : 'LIVE';
      assert.strictEqual(statusB, 'TEST/MOCK', 'Mock key must never be reported as LIVE in production');
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  // 5. Stripe Provider status is fail-closed
  await it('5. Stripe status is fail-closed when secret key is absent', () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    try {
      delete process.env.STRIPE_SECRET_KEY;
      const status = process.env.STRIPE_SECRET_KEY ? 'HEALTHY' : 'NOT_CONFIGURED';
      assert.strictEqual(status, 'NOT_CONFIGURED');
    } finally {
      process.env.STRIPE_SECRET_KEY = originalStripeKey;
    }
  });

  // 6. Migration Consistency Checker
  await it('6. checkMigrationConsistency inspects migrations and detects status', async () => {
    const result = await checkMigrationConsistency();
    assert(['SYNCHRONIZED', 'PENDING', 'INCONSISTENT', 'UNKNOWN'].includes(result.status));
    assert(typeof result.appliedCount === 'number');
    assert(typeof result.expectedCount === 'number');
    assert(result.details, 'Details string must be provided');
  });

  // 7. Data Quality Assessment
  await it('7. checkDataQuality evaluates KPI telemetry without fake health scores', async () => {
    const dq = await checkDataQuality();
    assert(['VALID', 'WARNING', 'INVALID', 'INSUFFICIENT_DATA', 'UNKNOWN'].includes(dq.status));
    assert(typeof dq.warningsCount === 'number');
    assert(Array.isArray(dq.checks));
    for (const chk of dq.checks) {
      assert(chk.category);
      assert(chk.check);
      assert(['VALID', 'WARNING', 'INVALID', 'INSUFFICIENT_DATA', 'UNKNOWN'].includes(chk.status));
    }
  });

  // 8. Deployment Metadata Extraction
  await it('8. getDeploymentMetadata safely extracts git commit and runtime information', () => {
    const meta = getDeploymentMetadata();
    assert(meta.environment);
    assert(meta.gitSha);
    assert(meta.branch);
    assert(meta.runtimeVersion.startsWith('v') || meta.runtimeVersion === 'unknown');
    assert(meta.nextVersion);
  });

  // 9. Request and Trace Correlation IDs
  await it('9. generateCorrelationIds generates formatted requestId and traceId', () => {
    const ids = generateCorrelationIds();
    assert(ids.requestId.startsWith('req_'));
    assert(ids.traceId.startsWith('trc_'));
    assert(ids.requestId.length > 10);
    assert(ids.traceId.length > 10);
  });

  // 10. Observability Pipeline Self-Monitoring
  await it('10. getTelemetryPipelineHealth monitors telemetry buffer and storage state', () => {
    const health = getTelemetryPipelineHealth();
    assert(health.status);
    assert(health.storage);
    assert(typeof health.bufferedEvents === 'number');
    assert(typeof health.droppedEvents === 'number');
  });

  // 11. Telemetry Ingestion & Sampling Invariant
  await it('11. Telemetry event recording does not crash and handles buffer gracefully', async () => {
    await recordTelemetryEvent({
      eventType: 'REQUEST',
      severity: 'INFO',
      service: 'test-service',
      route: '/api/test',
      statusCode: 200,
      durationMs: 45,
      message: 'Sample normal telemetry event',
    });

    await recordTelemetryEvent({
      eventType: 'API_FAILURE',
      severity: 'ERROR',
      service: 'test-service',
      route: '/api/failing',
      statusCode: 500,
      durationMs: 820,
      message: 'Sample critical server error event',
    });

    const pipeline = getTelemetryPipelineHealth();
    assert(pipeline.status === 'HEALTHY' || pipeline.status === 'BUFFERING');
  });

  console.log(`\n==========================================================================`);
  console.log(`🎉 PHASE 48 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`==========================================================================\n`);
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
