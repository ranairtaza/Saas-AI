import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveDashboardService } from '@/ai/executive/dashboard-service';
import { recordTelemetry } from '@/lib/observability/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const mode = (req.nextUrl.searchParams.get('mode') as 'snapshot' | 'deep' | 'full') || 'full';
    const dashboardData = await ExecutiveDashboardService.getDashboardReadModel(user.organizationId, {
      forceRefresh,
      mode,
    });

    const durationMs = Date.now() - startTime;
    recordTelemetry({
      organizationId: user.organizationId,
      userId: user.id,
      eventType: 'REQUEST',
      severity: 'INFO',
      route: '/api/executive/dashboard',
      method: 'GET',
      statusCode: 200,
      durationMs,
      metadata: { mode, forceRefresh, durationMs },
    });

    return NextResponse.json(dashboardData, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/dashboard GET] Error:', error);

    recordTelemetry({
      eventType: 'ERROR',
      severity: 'ERROR',
      route: '/api/executive/dashboard',
      method: 'GET',
      statusCode: 500,
      durationMs: Date.now() - startTime,
      message: error.message || 'Failed to get executive dashboard read model',
    });

    return NextResponse.json(
      { error: error.message || 'Failed to get executive dashboard read model' },
      { status: 500 }
    );
  }
}
