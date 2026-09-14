import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveOutcomeService } from '@/ai/executive/outcomes/outcome-service';

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
    const domain = searchParams.get('domain') || 'REVENUE';
    const strategyKey = searchParams.get('strategyKey') || '';

    const feedback = await ExecutiveOutcomeService.getHistoricalStrategyFeedback(
      user.organizationId,
      domain,
      strategyKey
    );

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/learning/feedback GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
