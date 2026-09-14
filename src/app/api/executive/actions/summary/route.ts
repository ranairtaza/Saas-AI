import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveActionPlanner } from '@/ai/executive/actions/action-planner';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const summary = await ExecutiveActionPlanner.getActionQueueSummary(user.organizationId);

    return NextResponse.json({ summary }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/actions/summary GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get action summary' }, { status: 500 });
  }
}
