import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { validateSystemConfig } from '@/lib/observability/config-validator';
import { checkMigrationConsistency } from '@/lib/observability/migration-checker';
import { checkDataQuality } from '@/lib/observability/data-quality';
import { getDeploymentMetadata } from '@/lib/observability/deployment';
import {
  getTelemetryPipelineHealth,
  getAggregateCounters,
  getTimeWindowAggregateCounters,
} from '@/lib/observability/telemetry';
import { isSystemOperator } from '@/permissions/definitions';
import { getSystemDependencyHealth } from '@/lib/observability/dependency-health';
import {
  SYSTEM_SLOW_REQUEST_MS,
  SYSTEM_5XX_ALERT_THRESHOLD,
  SYSTEM_STALE_JOB_MINUTES,
  SYSTEM_HEALTH_CACHE_TTL_MS,
} from '@/lib/observability/alert-constants';

export const dynamic = 'force-dynamic';

export interface SnapshotCacheRecord {
  data: any;
  cachedAt: number;
  timeRange: string;
  organizationId: string | null;
}

// Tenant-scoped in-memory cache keyed strictly by organizationId + timeRange
export const tenantSnapshotCache = new Map<string, SnapshotCacheRecord>();

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isGlobalOperator = isSystemOperator(user);
    if (!isGlobalOperator && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Owner or Admin role required' },
        { status: 403 }
      );
    }

    // Strict tenant barrier: Non-operator must have an active organizationId
    if (!isGlobalOperator && !user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: User is not associated with an organization' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Tenant isolation: if not global operator, strictly scope to user.organizationId
    const effectiveOrgId = isGlobalOperator ? searchParams.get('organizationId') || null : user.organizationId;
    const orgFilter = effectiveOrgId ? { organizationId: effectiveOrgId } : {};

    // Cache key incorporates tenant identity: <organizationId>:<timeRange>
    const cacheKey = `${effectiveOrgId || 'global'}:${timeRange}`;
    const cached = tenantSnapshotCache.get(cacheKey);

    if (!forceRefresh && cached && cached.timeRange === timeRange) {
      if (Date.now() - cached.cachedAt < SYSTEM_HEALTH_CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
      }
    }

    // Time window calculation
    let hours = 24;
    if (timeRange === '1h') hours = 1;
    else if (timeRange === '6h') hours = 6;
    else if (timeRange === '7d') hours = 24 * 7;
    else if (timeRange === '30d') hours = 24 * 30;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Parallel execution of diagnostic and tenant-isolated queries
    const [
      dependencyHealth,
      telemetryEvents,
      migrationCheck,
      dataQuality,
      connections,
      syncJobs,
      aiUsageCount,
      failedWebhooks,
      securityEvents,
      billingRecord,
    ] = await Promise.all([
      // 1. Centralized dependency health evaluation
      getSystemDependencyHealth({
        organizationId: effectiveOrgId,
        forceFresh: forceRefresh,
      }),

      // 2. Query telemetry events strictly scoped by organization (unless global operator)
      prisma.systemTelemetryEvent.findMany({
        where: {
          createdAt: { gte: since },
          ...orgFilter,
        },
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

      // 4. Data quality assessment (strictly tenant-scoped)
      checkDataQuality(effectiveOrgId || undefined),

      // 5. Integrations status (strictly tenant-scoped)
      prisma.integrationConnection.findMany({
        where: orgFilter,
        select: {
          id: true,
          status: true,
          lastSyncAt: true,
          lastError: true,
          integration: { select: { provider: true } },
        },
      }).catch(() => []),

      // 6. Background sync jobs (strictly tenant-scoped)
      prisma.syncJob.findMany({
        where: {
          createdAt: { gte: since },
          ...orgFilter,
        },
        select: { status: true, createdAt: true, trigger: true, durationMs: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),

      // 7. AI usage records (strictly tenant-scoped)
      prisma.aIUsageRecord.count({
        where: {
          createdAt: { gte: since },
          ...orgFilter,
        },
      }).catch(() => 0),

      // 8. Billing webhook failures (global operator only)
      isGlobalOperator
        ? prisma.webhookEvent.count({
            where: { status: 'FAILED', createdAt: { gte: since } },
          }).catch(() => 0)
        : Promise.resolve(0),

      // 9. Security audit events (strictly tenant-scoped)
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since },
          ...orgFilter,
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

      // 10. Organization Billing record
      effectiveOrgId
        ? prisma.organizationBilling.findUnique({
            where: { organizationId: effectiveOrgId },
            include: { plan: { select: { name: true, slug: true } } },
          }).catch(() => null)
        : null,
    ]);

    // Compute Performance Metrics with time-bucketed aggregation and truthful semantics
    const observedRequests = telemetryEvents.length;
    const windowCounters = getTimeWindowAggregateCounters(since.getTime(), Date.now(), effectiveOrgId);

    // Determine calculation mode and exact request totals
    let totalRequests = windowCounters.exactTotalRequests;
    let calculationMode: 'EXACT' | 'SAMPLED' | 'INSUFFICIENT_DATA' = 'EXACT';

    if (totalRequests === 0 && observedRequests === 0) {
      calculationMode = 'INSUFFICIENT_DATA';
    } else if (observedRequests > totalRequests) {
      // If sampled telemetry stored in DB exceeds in-memory bucket counter (e.g. process restart),
      // reflect observed telemetry and clearly label calculationMode as SAMPLED
      totalRequests = observedRequests;
      calculationMode = 'SAMPLED';
    }

    const observed4xx = telemetryEvents.filter((e: any) => e.statusCode && e.statusCode >= 400 && e.statusCode < 500).length;
    const observed5xx = telemetryEvents.filter((e: any) => e.statusCode && e.statusCode >= 500).length;
    const observedSlow = telemetryEvents.filter((e: any) => e.durationMs && e.durationMs >= SYSTEM_SLOW_REQUEST_MS).length;

    // Use exact aggregate error counters if exact mode is available, otherwise observed sampled count
    const errors4xx = calculationMode === 'EXACT' ? windowCounters.errors4xx : observed4xx;
    const errors5xx = calculationMode === 'EXACT' ? windowCounters.errors5xx : observed5xx;
    const slowRequests = calculationMode === 'EXACT' ? windowCounters.slowRequests : observedSlow;

    const latencies = telemetryEvents
      .map((e: any) => e.durationMs)
      .filter((l: any): l is number => typeof l === 'number')
      .sort((a: number, b: number) => a - b);

    const hasLatencyData = latencies.length > 0;
    const avgLatencyMs = hasLatencyData ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : null;
    const p50Ms = hasLatencyData ? Math.round(latencies[Math.floor(latencies.length * 0.5)]) : null;
    const p95Ms = hasLatencyData ? Math.round(latencies[Math.floor(latencies.length * 0.95)]) : null;
    const p99Ms = hasLatencyData ? Math.round(latencies[Math.floor(latencies.length * 0.99)]) : null;

    // Slowest and failing routes
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

    // Job Stats & Stale Detection
    const staleThresholdTime = new Date(Date.now() - SYSTEM_STALE_JOB_MINUTES * 60 * 1000);
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

    // Deterministic System Alerts Engine
    const alerts: Array<{
      id: string;
      severity: 'CRITICAL' | 'WARNING';
      type: string;
      message: string;
      createdAt: string;
      status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
    }> = [];

    const dbHealth = dependencyHealth.dependencies.database;

    if (dbHealth.status !== 'AVAILABLE') {
      alerts.push({
        id: 'alert-db-unreachable',
        severity: 'CRITICAL',
        type: 'DATABASE_UNAVAILABLE',
        message: `PostgreSQL database issue: ${dbHealth.evidence}`,
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

    if (errors5xx >= SYSTEM_5XX_ALERT_THRESHOLD) {
      alerts.push({
        id: 'alert-5xx-spike',
        severity: 'CRITICAL',
        type: 'SERVER_ERROR_SPIKE',
        message: `High 5xx server error spike: ${errors5xx} errors detected in ${timeRange} (threshold: ${SYSTEM_5XX_ALERT_THRESHOLD}).`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      });
    }

    if (jobStats.stale > 0) {
      alerts.push({
        id: 'alert-stale-jobs',
        severity: 'WARNING',
        type: 'STALE_BACKGROUND_JOBS',
        message: `${jobStats.stale} background job(s) running for longer than ${SYSTEM_STALE_JOB_MINUTES} minutes without completion.`,
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

    // Determine Overall Status deterministically
    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = dependencyHealth.overallStatus;
    if (dbHealth.status !== 'AVAILABLE') {
      overallStatus = 'UNAVAILABLE';
    } else if (
      migrationCheck.status !== 'SYNCHRONIZED' ||
      errors5xx > 0 ||
      missingRequiredConfigs > 0 ||
      dependencyHealth.overallStatus === 'DEGRADED'
    ) {
      overallStatus = 'DEGRADED';
    }

    const deployment = getDeploymentMetadata();
    const telemetryPipeline = getTelemetryPipelineHealth();

    const snapshotData = {
      timestamp: new Date().toISOString(),
      timeRange,
      overallStatus,
      tenantContext: {
        isGlobalOperator,
        organizationId: effectiveOrgId,
        isolated: !isGlobalOperator,
      },
      deployment,
      database: {
        status: dbHealth.status,
        latencyMs: dbHealth.latencyMs,
        writeGate: isDatabaseWritesAllowed() ? 'WRITES_ENABLED' : 'READ_ONLY_SAFEGUARD',
        databaseId: process.env.LEADMACHINE_DATABASE_ID || 'unspecified',
        migrations: migrationCheck,
      },
      performance: {
        observedRequests,
        totalRequests,
        // Deterministic telemetry attribution: calculationMode: 'SAMPLED' | 'EXACT' | 'INSUFFICIENT_DATA'
        calculationMode,
        samplingNote:
          calculationMode === 'EXACT'
            ? 'Exact request volume aggregated from time-bucketed metric counters'
            : 'Calculated from sampled telemetry and high-water aggregate counters',
        errors4xx,
        errors5xx,
        slowRequests,
        avgLatencyMs: avgLatencyMs ?? 0,
        p50Ms: p50Ms ?? 0,
        p95Ms: p95Ms ?? 0,
        p99Ms: p99Ms ?? 0,
        observedP50Ms: p50Ms,
        observedP95Ms: p95Ms,
        observedP99Ms: p99Ms,
        observedAvgLatencyMs: avgLatencyMs,
        latencyCalculationMode: hasLatencyData ? 'SAMPLED' : 'INSUFFICIENT_DATA',
        topSlowRoutes,
        topFailingRoutes,
      },
      ai: {
        status: dependencyHealth.dependencies.ai.status,
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
        status: dependencyHealth.dependencies.billing.status,
        plan: billingRecord?.plan?.name || 'Standard',
        subscriptionStatus: billingRecord?.subscriptionStatus || 'TRIAL',
        failedWebhooks,
      },
      security: {
        recentEvents: securityEvents,
      },
      dataQuality,
      configuration: configResults,
      alerts,
      observabilityPipeline: telemetryPipeline,

      // Explicit structure separating global infrastructure from organization telemetry
      infrastructure: {
        runtime: deployment.runtimeVersion,
        processUptime: Math.floor(process.uptime()),
        deployment,
        database: {
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
          writeGate: isDatabaseWritesAllowed() ? 'WRITES_ENABLED' : 'READ_ONLY_SAFEGUARD',
          databaseId: process.env.LEADMACHINE_DATABASE_ID || 'unspecified',
          migrations: migrationCheck,
        },
        dependencies: dependencyHealth.dependencies,
      },
      tenant: {
        organizationId: effectiveOrgId,
        isolated: !isGlobalOperator,
        telemetry: {
          observedRequests,
          totalRequests,
          calculationMode: (calculationMode === 'SAMPLED' ? ('SAMPLED' as const) : calculationMode),
          errors4xx,
          errors5xx,
          slowRequests,
          avgLatencyMs: avgLatencyMs ?? 0,
          observedP50Ms: p50Ms,
          observedP95Ms: p95Ms,
          observedP99Ms: p99Ms,
          observedAvgLatencyMs: avgLatencyMs,
          latencyCalculationMode: hasLatencyData ? 'SAMPLED' : 'INSUFFICIENT_DATA',
          topSlowRoutes,
          topFailingRoutes,
        },
        integrations: {
          connections,
          total: connections.length,
          active: connections.filter((c: any) => c.status === 'ACTIVE').length,
          failing: connections.filter((c: any) => c.status === 'FAILING').length,
        },
        jobs: jobStats,
        ai: {
          status: dependencyHealth.dependencies.ai.status,
          provider: 'gemini',
          model: 'gemini-1.5-pro',
          requests: aiUsageCount,
        },
        billing: {
          status: dependencyHealth.dependencies.billing.status,
          plan: billingRecord?.plan?.name || 'Standard',
          subscriptionStatus: billingRecord?.subscriptionStatus || 'TRIAL',
        },
        security: {
          recentEvents: securityEvents,
        },
        dataQuality,
      },
    };

    tenantSnapshotCache.set(cacheKey, {
      data: snapshotData,
      cachedAt: Date.now(),
      timeRange,
      organizationId: effectiveOrgId,
    });

    return NextResponse.json(snapshotData, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/system/snapshot] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
