import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import prisma from '@/lib/db';
import { validateSystemConfig } from '@/lib/observability/config-validator';
import { checkMigrationConsistency } from '@/lib/observability/migration-checker';
import { isSystemOperator } from '@/permissions/definitions';
import {
  SYSTEM_SLOW_REQUEST_MS,
  SYSTEM_5XX_ALERT_THRESHOLD,
} from '@/lib/observability/alert-constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isGlobalOperator = isSystemOperator(user);
    if (!isGlobalOperator && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Owner or Admin role required to access System Command Center' },
        { status: 403 }
      );
    }

    if (!isGlobalOperator && !user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: User is not associated with an organization' },
        { status: 403 }
      );
    }

    // Tenant isolation
    const effectiveOrgId = isGlobalOperator ? null : user.organizationId;
    const orgFilter = effectiveOrgId ? { organizationId: effectiveOrgId } : {};

    // 1. Database Health Check
    let dbStatus = 'AVAILABLE';
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = 'UNAVAILABLE';
    }

    // 2. Query Recent Telemetry for Performance Metrics (Last 24 hours, tenant-scoped)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const telemetryEvents = await prisma.systemTelemetryEvent.findMany({
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
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const observedRequests = telemetryEvents.length;
    const errors4xx = telemetryEvents.filter((e: any) => e.statusCode && e.statusCode >= 400 && e.statusCode < 500).length;
    const errors5xx = telemetryEvents.filter((e: any) => e.statusCode && e.statusCode >= 500).length;
    const slowRequests = telemetryEvents.filter((e: any) => e.durationMs && e.durationMs >= SYSTEM_SLOW_REQUEST_MS).length;

    const latencies = telemetryEvents
      .map((e: any) => e.durationMs)
      .filter((l: any): l is number => typeof l === 'number')
      .sort((a: number, b: number) => a - b);

    const avgLatency = latencies.length ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;
    const p50 = latencies.length ? Math.round(latencies[Math.floor(latencies.length * 0.5)]) : 0;
    const p95 = latencies.length ? Math.round(latencies[Math.floor(latencies.length * 0.95)]) : 0;
    const p99 = latencies.length ? Math.round(latencies[Math.floor(latencies.length * 0.99)]) : 0;

    // Slowest routes
    const routeDurations: Record<string, number[]> = {};
    for (const e of telemetryEvents) {
      if (e.route && e.durationMs) {
        if (!routeDurations[e.route]) routeDurations[e.route] = [];
        routeDurations[e.route].push(e.durationMs);
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

    // 3. AI Usage / Status (tenant-scoped)
    const hasGemini = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
    const aiUsageCount = await prisma.aIUsageRecord.count({
      where: {
        createdAt: { gte: since },
        ...orgFilter,
      },
    });

    // 4. Integrations Status (tenant-scoped)
    const connections = await prisma.integrationConnection.findMany({
      where: orgFilter,
      select: { status: true, lastSyncAt: true, lastError: true, integration: { select: { provider: true } } },
    });

    // 5. Jobs Status (SyncJobs, tenant-scoped)
    const syncJobs = await prisma.syncJob.findMany({
      where: {
        createdAt: { gte: since },
        ...orgFilter,
      },
      select: { status: true },
    });
    const jobStats = {
      running: syncJobs.filter((j: any) => j.status === 'RUNNING').length,
      failed: syncJobs.filter((j: any) => j.status === 'FAILED').length,
      completed: syncJobs.filter((j: any) => j.status === 'COMPLETED').length,
      total: syncJobs.length,
    };

    // 6. Billing Status
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    const failedWebhooks = await prisma.webhookEvent.count({
      where: { status: 'FAILED', createdAt: { gte: since } },
    });

    // 7. Security Events from AuditLog (tenant-scoped)
    const securityEvents = await prisma.auditLog.findMany({
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
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // 8. Configuration Validation
    const configResults = validateSystemConfig();
    const missingRequiredConfigs = configResults.filter((c: any) => c.required && c.status === 'MISSING').length;

    // 9. Real Migration Status Check
    const migrationCheck = await checkMigrationConsistency();

    // 10. Automated Alert Generation
    const alerts: Array<{ id: string; severity: 'CRITICAL' | 'WARNING'; message: string; timestamp: string }> = [];
    if (dbStatus !== 'AVAILABLE') {
      alerts.push({ id: 'alert-db', severity: 'CRITICAL', message: 'PostgreSQL Database unreachable or unhealthy', timestamp: new Date().toISOString() });
    }
    if (errors5xx >= SYSTEM_5XX_ALERT_THRESHOLD) {
      alerts.push({ id: 'alert-5xx', severity: 'CRITICAL', message: `High 5xx server error count: ${errors5xx} errors in 24h`, timestamp: new Date().toISOString() });
    }
    if (jobStats.failed > 0) {
      alerts.push({ id: 'alert-jobs', severity: 'WARNING', message: `${jobStats.failed} background sync jobs failed recently`, timestamp: new Date().toISOString() });
    }
    if (missingRequiredConfigs > 0) {
      alerts.push({ id: 'alert-config', severity: 'WARNING', message: `${missingRequiredConfigs} required production environment variables missing`, timestamp: new Date().toISOString() });
    }
    if (failedWebhooks > 0) {
      alerts.push({ id: 'alert-billing', severity: 'WARNING', message: `${failedWebhooks} Stripe webhook events failed processing`, timestamp: new Date().toISOString() });
    }

    const overallStatus = dbStatus === 'AVAILABLE' && migrationCheck.status === 'SYNCHRONIZED' && errors5xx === 0 && missingRequiredConfigs === 0 ? 'HEALTHY' : 'DEGRADED';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallStatus,
      tenantContext: {
        isGlobalOperator,
        organizationId: effectiveOrgId,
        isolated: !isGlobalOperator,
      },
      system: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        migrations: migrationCheck.status,
        migrationDetails: migrationCheck.details,
      },
      performance: {
        observedRequests,
        calculationMode: 'SAMPLED',
        errors4xx,
        errors5xx,
        slowRequests,
        avgLatencyMs: avgLatency,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
        topSlowRoutes,
      },
      ai: {
        status: hasGemini ? (aiUsageCount > 0 ? 'AVAILABLE' : 'CONFIGURED') : 'NOT_CONFIGURED',
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        requests24h: aiUsageCount,
      },
      integrations: {
        totalConnections: connections.length,
        active: connections.filter((c: any) => c.status === 'ACTIVE').length,
        failing: connections.filter((c: any) => c.status === 'FAILING').length,
      },
      jobs: jobStats,
      billing: {
        status: hasStripe ? 'CONFIGURED' : 'NOT_CONFIGURED',
        failedWebhooks24h: failedWebhooks,
      },
      security: {
        recentEvents: securityEvents,
      },
      configuration: configResults,
      alerts,
    });
  } catch (error: any) {
    console.error('[SystemOverview] Failed to fetch system overview:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
