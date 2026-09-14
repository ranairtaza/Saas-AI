import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveForecastingService } from '@/ai/executive/forecasting/forecasting-service';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain') || undefined;
    const horizon = searchParams.get('horizon') || undefined;
    const confidence = searchParams.get('confidence') || undefined;
    const scenarioType = searchParams.get('scenarioType') || undefined;

    const forecasts = await ExecutiveForecastingService.listForecasts(
      user.organizationId,
      { domain, horizon, confidence, scenarioType }
    );

    return NextResponse.json({ forecasts, total: forecasts.length }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/forecasts GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const summary = await ExecutiveForecastingService.generateAndSaveForecasts(
      user.organizationId,
      user.id
    );

    return NextResponse.json({ summary }, { status: 201 });
  } catch (error: any) {
    console.error('[API /api/executive/forecasts POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
