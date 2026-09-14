import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveActionPlanner } from '@/ai/executive/actions/action-planner';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_READ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const plan = await ExecutiveActionPlanner.getActionPlan(id, user.organizationId);

    if (!plan) {
      return NextResponse.json({ error: 'Action plan not found' }, { status: 404 });
    }

    return NextResponse.json({ plan }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/actions/[id] GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get action plan' }, { status: 500 });
  }
}
