import { NextResponse } from 'next/server';
import { getSystemDependencyHealth } from '@/lib/observability/dependency-health';

export const dynamic = 'force-dynamic';

export type DependencyHealthState =
  | 'CONFIGURED'
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export async function GET() {
  const health = await getSystemDependencyHealth({ forceFresh: true });

  const isDbAvailable = health.dependencies.database.available;
  const applicationReadiness = isDbAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
  const statusCode = health.overallStatus === 'UNAVAILABLE' ? 503 : 200;

  return NextResponse.json(
    {
      status: health.overallStatus,
      timestamp: health.checkedAt,
      readiness: {
        application: applicationReadiness,
        requiredServicesOperational: isDbAvailable,
      },
      dependencies: {
        database: {
          status: health.dependencies.database.status,
          latencyMs: health.dependencies.database.latencyMs,
          required: true,
        },
        ai: {
          status: health.dependencies.ai.status,
          required: false,
        },
        billing: {
          status: health.dependencies.billing.status,
          required: false,
        },
        cache: {
          status: health.dependencies.cache.status,
          required: false,
        },
        jobs: {
          status: health.dependencies.jobs.status,
          required: false,
        },
      },
    },
    { status: statusCode }
  );
}
