import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { checkMigrationConsistency } from '@/lib/observability/migration-checker';
import { validateSystemConfig } from '@/lib/observability/config-validator';
import { getDeploymentMetadata } from '@/lib/observability/deployment';
import { getTelemetryPipelineHealth } from '@/lib/observability/telemetry';
import { isSystemOperator } from '@/permissions/definitions';
import { getSystemDependencyHealth } from '@/lib/observability/dependency-health';

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
        { error: 'Forbidden: Owner or Admin role required' },
        { status: 403 }
      );
    }

    const effectiveOrgId = isGlobalOperator ? null : user.organizationId;

    // 1. Centralized dependency health evaluation
    const healthReport = await getSystemDependencyHealth({
      organizationId: effectiveOrgId,
      forceFresh: true,
    });

    // 2. Migration state (Dynamic detection)
    const migrationCheck = await checkMigrationConsistency();

    // 3. Database Write Safety Configuration
    const writesAllowed = isDatabaseWritesAllowed();
    const dbIdentifier = process.env.LEADMACHINE_DATABASE_ID || 'unspecified';

    // 4. Config Validation Summary
    const configResults = validateSystemConfig();
    const missingRequired = configResults.filter((c) => c.required && c.status === 'MISSING').length;

    // 5. Deployment & Observability Pipeline Health
    const deployment = getDeploymentMetadata();
    const telemetryPipeline = getTelemetryPipelineHealth();

    // Determine overall status
    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' = healthReport.overallStatus;
    if (healthReport.dependencies.database.status !== 'AVAILABLE') {
      overallStatus = 'UNAVAILABLE';
    } else if (migrationCheck.status !== 'SYNCHRONIZED' || missingRequired > 0) {
      overallStatus = 'DEGRADED';
    }

    return NextResponse.json({
      timestamp: healthReport.checkedAt,
      overallStatus,
      tenantContext: {
        isGlobalOperator,
        organizationId: effectiveOrgId,
      },
      deployment,
      dependencies: {
        database: {
          status: healthReport.dependencies.database.status,
          latencyMs: healthReport.dependencies.database.latencyMs,
          writeGate: writesAllowed ? 'WRITES_ENABLED' : 'READ_ONLY_SAFEGUARD',
          databaseId: dbIdentifier,
          migrations: migrationCheck,
        },
        ai: {
          status: healthReport.dependencies.ai.status,
          provider: 'gemini',
          model: 'gemini-1.5-pro',
        },
        billing: {
          status: healthReport.dependencies.billing.status,
          failClosedActive: true,
        },
        cache: {
          status: healthReport.dependencies.cache.status,
        },
        jobs: {
          status: healthReport.dependencies.jobs.status,
        },
        integrations: {
          status: healthReport.dependencies.integrations.status,
        },
      },
      observabilityPipeline: telemetryPipeline,
      configurationSummary: {
        totalChecks: configResults.length,
        missingRequired,
        valid: configResults.filter((c) => c.status === 'CONFIGURED').length,
      },
    });
  } catch (error: unknown) {
    console.error('[API /api/system/health] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
