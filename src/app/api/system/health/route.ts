import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { checkMigrationConsistency } from '@/lib/observability/migration-checker';
import { validateSystemConfig } from '@/lib/observability/config-validator';
import { getDeploymentMetadata } from '@/lib/observability/deployment';
import { getTelemetryPipelineHealth } from '@/lib/observability/telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Owner or Admin role required' },
        { status: 403 }
      );
    }

    // 1. PostgreSQL Database & Latency
    let dbStatus: 'HEALTHY' | 'UNAVAILABLE' = 'HEALTHY';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'UNAVAILABLE';
    }

    // 2. Migration State
    const migrationCheck = await checkMigrationConsistency();

    // 3. Database Write Safety Configuration
    const writesAllowed = isDatabaseWritesAllowed();
    const dbIdentifier = process.env.LEADMACHINE_DATABASE_ID || 'unspecified';

    // 4. Gemini AI Configuration
    const hasGeminiKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
    const isMockGemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY === 'mock_key';
    const geminiStatus = hasGeminiKey ? (isMockGemini ? 'TEST/MOCK' : 'LIVE') : 'NOT_CONFIGURED';

    // 5. Stripe Billing Configuration
    const hasStripeKey = Boolean(process.env.STRIPE_SECRET_KEY);
    const stripeStatus = hasStripeKey ? 'HEALTHY' : 'NOT_CONFIGURED';

    // 6. Upstash Redis Cache
    const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    const upstashStatus = hasUpstash ? 'HEALTHY' : 'NOT_CONFIGURED';

    // 7. Inngest Background Workflows
    const hasInngest = Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY);
    const inngestStatus = hasInngest ? 'HEALTHY' : 'NOT_CONFIGURED';

    // 8. Integrations Subsystem
    let integrationsStatus: 'HEALTHY' | 'DEGRADED' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
    try {
      const activeConnections = await prisma.integrationConnection.count({ where: { status: 'ACTIVE' } });
      const failingConnections = await prisma.integrationConnection.count({ where: { status: 'FAILING' } });
      if (activeConnections > 0) {
        integrationsStatus = failingConnections > 0 ? 'DEGRADED' : 'HEALTHY';
      }
    } catch {
      integrationsStatus = 'DEGRADED';
    }

    // 9. Config Validation Summary
    const configResults = validateSystemConfig();
    const missingRequired = configResults.filter((c) => c.required && c.status === 'MISSING').length;

    // 10. Deployment & Observability Pipeline Health
    const deployment = getDeploymentMetadata();
    const telemetryPipeline = getTelemetryPipelineHealth();

    const overallStatus =
      dbStatus === 'HEALTHY' && migrationCheck.status === 'SYNCHRONIZED' && missingRequired === 0
        ? 'HEALTHY'
        : dbStatus === 'HEALTHY'
        ? 'DEGRADED'
        : 'UNAVAILABLE';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallStatus,
      deployment,
      dependencies: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          writeGate: writesAllowed ? 'WRITES_ENABLED' : 'READ_ONLY_SAFEGUARD',
          databaseId: dbIdentifier,
          migrations: migrationCheck,
        },
        ai: {
          status: geminiStatus,
          provider: 'gemini',
          model: 'gemini-1.5-pro',
        },
        billing: {
          status: stripeStatus,
          failClosedActive: true,
        },
        cache: {
          status: upstashStatus,
        },
        jobs: {
          status: inngestStatus,
        },
        integrations: {
          status: integrationsStatus,
        },
      },
      observabilityPipeline: telemetryPipeline,
      configurationSummary: {
        totalChecks: configResults.length,
        missingRequired,
        valid: configResults.filter((c) => c.status === 'CONFIGURED').length,
      },
    });
  } catch (error: any) {
    console.error('[API /api/system/health] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
