import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { validateSystemConfig } from '@/lib/observability/config-validator';
import { checkMigrationConsistency } from '@/lib/observability/migration-checker';
import { checkDataQuality } from '@/lib/observability/data-quality';
import { getDeploymentMetadata } from '@/lib/observability/deployment';
import { getTelemetryPipelineHealth } from '@/lib/observability/telemetry';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = Number(process.env.SYSTEM_HEALTH_CACHE_TTL_MS || '10000');

interface CacheRecord {
  data: any;
  cachedAt: number;
  timeRange: string;
}

let cachedSnapshot: CacheRecord | null = null;

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Fast read-cache check
    if (!forceRefresh && cachedSnapshot && cachedSnapshot.timeRange === timeRange) {
      if (Date.now() - cachedSnapshot.cachedAt < CACHE_TTL_MS) {
        return NextResponse.json(cachedSnapshot.data);
      }
    }

    // Time window calculation
    let hours = 24;
    if (timeRange === '1h') hours = 1;
    else if (timeRange === '6h') hours = 6;
    else if (timeRange === '7d') hours = 24 * 7;
    else if (timeRange === '30d') hours = 24 * 30;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Parallel execution of diagnostic queries
    const [
      dbPingResult,
      telemetryEvents,
      migrationCheck,
      dataQuality,
      connections,
      syncJobs,
      aiUsageCount,
      failedWebhooks,
      securityEvents,
    ] = await Promise.all([
      // 1. PostgreSQL DB ping & latency
      (async () => {
        try {
          const start = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          return { status: 'HEALTHY' as const, latencyMs: Date.now() - start };
        } catch {
          return { status: 'UNAVAILABLE' as const, latencyMs: 0 };
        }
      })(),

      // 2. Query telemetry events for selected timeRange
      prisma.systemTelemetryEvent.findMany({
        where: { createdAt: { gte: since } },
        select: {
          statusCode: true,
          durationMs: true,
          route: true,
          severity: true,
          eventType: true,
          createdAt: true,
        },
        take: 2000,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),

      // 3. Migration consistency
      checkMigrationConsistency(),

      // 4. Data quality assessment
      checkDataQuality(),

      // 5. Integrations status
      prisma.integrationConnection.findMany({
        select: {
          id: true,
          status: true,
          lastSyncAt: true,
          lastError: true,
          integration: { select: { provider: true } },
        },
      }).catch(() => []),

      // 6. Background sync jobs
      prisma.syncJob.findMany({
        where: { createdAt: { gte: since } },
        select: { status: true, createdAt: true, trigger: true, durationMs: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),

      // 7. AI usage records
      prisma.aIUsageRecord.count({
        where: { createdAt: { gte: since } },
      }).catch(() => 0),

      // 8. Billing webhook failures
      prisma.webhookEvent.count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      }).catch(() => 0),

      // 9. Security audit events
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since },
          OR: [{ status: 'FAILURE' }, { status: 'REJECTED' }, { riskLevel: 'SENSITIVE' }],
        },
        select: {
          id: true,
          action: true,
          resource: true,
          status: true,
          riskLevel: true,
          createdAt: true,
          ipAddress: true,
        },
        take: 15,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),
    ]);

    // Compute Performance Metrics
    const totalRequests = telemetryEvents.length;
    const errors4xx = telemetryEvents.filter((e: any) => e.statusCode && e.statusCode >= 400 && e.statusCode < 500).length;
    const errors5xx = telemetryEvents.filter((e: any) => e.statusCode && e.statusCode >= 500).length;
    const slowRequests = telemetryEvents.filter((e: any) => e.durationMs && e.durationMs >= 750).length;

    const latencies = telemetryEvents
      .map((e: any) => e.durationMs)
      .filter((l: any): l is number => typeof l === 'number')
      .sort((a: number, b: number) => a - b);

    const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;
    const p50Ms = latencies.length ? Math.round(latencies[Math.floor(latencies.length * 0.5)]) : 0;
    const p95Ms = latencies.length ? Math.round(latencies[Math.floor(latencies.length * 0.95)]) : 0;
    const p99Ms = latencies.length ? Math.round(latencies[Math.floor(latencies.length * 0.99)]) : 0;

    // Slowest routes
    const routeDurations: Record<string, number[]> = {};
    const routeErrors: Record<string, number> = {};
    for (const e of telemetryEvents) {
      if (e.route && e.durationMs) {
        if (!routeDurations[e.route]) routeDurations[e.route] = [];
        routeDurations[e.route].push(e.durationMs);
      }
      if (e.route && e.statusCode && e.statusCode >= 400) {
        routeErrors[e.route] = (routeErrors[e.route] || 0) + 1;
      }
    }

    const topSlowRoutes = Object.entries(routeDurations)
      .map(([route, durs]) => ({
        route,
        avgMs: Math.round(durs.reduce((a, b) => a + b, 0) / durs.length),
        count: durs.length,
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 5);

    const topFailingRoutes = Object.entries(routeErrors)
      .map(([route, errCount]) => ({ route, count: errCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // AI Configuration State
    const hasGeminiKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
    const isMockGemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY === 'mock_key';
    const geminiStatus = hasGeminiKey ? (isMockGemini ? 'TEST/MOCK' : 'LIVE') : 'NOT_CONFIGURED';

    // Job Stats & Stale Detection
    const staleJobMinutes = Number(process.env.SYSTEM_STALE_JOB_MINUTES || '30');
    const staleThresholdTime = new Date(Date.now() - staleJobMinutes * 60 * 1000);
    const staleJobs = syncJobs.filter((j: any) => j.status === 'RUNNING' && new Date(j.createdAt) < staleThresholdTime).length;

    const jobStats = {
      running: syncJobs.filter((j: any) => j.status === 'RUNNING').length,
      failed: syncJobs.filter((j: any) => j.status === 'FAILED').length,
      completed: syncJobs.filter((j: any) => j.status === 'COMPLETED').length,
      stale: staleJobs,
      total: syncJobs.length,
    };

    // Configuration Checks
    const configResults = validateSystemConfig();
    const missingRequiredConfigs = configResults.filter((c: any) => c.required && c.status === 'MISSING').length;

    // Deterministic System Alerts Engine (Part 16)
    const alerts: Array<{
      id: string;
      severity: 'CRITICAL' | 'WARNING';
      type: string;
      message: string;
      createdAt: string;
      status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
    }> = [];

    if (dbPingResult.status !== 'HEALTHY') {
      alerts.push({
        id: 'alert-db-unreachable',
        severity: 'CRITICAL',
        type: 'DATABASE_UNAVAILABLE',
        message: 'PostgreSQL database unreachable or disconnected.',
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (migrationCheck.status === 'INCONSISTENT') {
      alerts.push({
        id: 'alert-migration-inconsistency',
        severity: 'CRITICAL',
        type: 'MIGRATION_INCONSISTENCY',
        message: `Database migration inconsistency: ${migrationCheck.details}`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (errors5xx > 10) {
      alerts.push({
        id: 'alert-5xx-spike',
        severity: 'CRITICAL',
        type: 'SERVER_ERROR_SPIKE',
        message: `High 5xx server error spike: ${errors5xx} errors detected in ${timeRange}.`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (jobStats.stale > 0) {
      alerts.push({
        id: 'alert-stale-jobs',
        severity: 'WARNING',
        type: 'STALE_BACKGROUND_JOBS',
        message: `${jobStats.stale} background job(s) running for longer than ${staleJobMinutes} minutes without completion.`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (jobStats.failed > 0) {
      alerts.push({
        id: 'alert-failed-jobs',
        severity: 'WARNING',
        type: 'JOB_FAILURE',
        message: `${jobStats.failed} background sync job(s) failed in ${timeRange}.`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (dataQuality.warningsCount > 0) {
      alerts.push({
        id: 'alert-data-quality',
        severity: 'WARNING',
        type: 'DATA_QUALITY_DEGRADATION',
        message: `${dataQuality.warningsCount} data quality warning(s) flagged across telemetry and integrations.`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (missingRequiredConfigs > 0) {
      alerts.push({
        id: 'alert-missing-config',
        severity: 'WARNING',
        type: 'CONFIGURATION_MISSING',
        message: `${missingRequiredConfigs} required production environment variables missing.`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    // Determine Overall Status
    const overallStatus =
      dbPingResult.status === 'HEALTHY' && migrationCheck.status === 'SYNCHRONIZED' && errors5xx === 0 && missingRequiredConfigs === 0
        ? 'HEALTHY'
        : dbPingResult.status === 'HEALTHY'
        ? 'DEGRADED'
        : 'UNAVAILABLE';

    const deployment = getDeploymentMetadata();
    const telemetryPipeline = getTelemetryPipelineHealth();

    const snapshotData = {
      timestamp: new Date().toISOString(),
      timeRange,
      overallStatus,
      deployment,
      database: {
        status: dbPingResult.status,
        latencyMs: dbPingResult.latencyMs,
        writeGate: isDatabaseWritesAllowed() ? 'WRITES_ENABLED' : 'READ_ONLY_SAFEGUARD',
        databaseId: process.env.LEADMACHINE_DATABASE_ID || 'unspecified',
        migrations: migrationCheck,
      },
      performance: {
        totalRequests,
        errors4xx,
        errors5xx,
        slowRequests,
        avgLatencyMs,
        p50Ms,
        p95Ms,
        p99Ms,
        topSlowRoutes,
        topFailingRoutes,
      },
      ai: {
        status: geminiStatus,
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        requests: aiUsageCount,
      },
      integrations: {
        connections,
        total: connections.length,
        active: connections.filter((c: any) => c.status === 'ACTIVE').length,
        failing: connections.filter((c: any) => c.status === 'FAILING').length,
      },
      jobs: jobStats,
      billing: {
        status: process.env.STRIPE_SECRET_KEY ? 'HEALTHY' : 'NOT_CONFIGURED',
        failedWebhooks,
      },
      security: {
        recentEvents: securityEvents,
      },
      dataQuality,
      configuration: configResults,
      alerts,
      observabilityPipeline: telemetryPipeline,
    };

    cachedSnapshot = {
      data: snapshotData,
      cachedAt: Date.now(),
      timeRange,
    };

    return NextResponse.json(snapshotData, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/system/snapshot] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
