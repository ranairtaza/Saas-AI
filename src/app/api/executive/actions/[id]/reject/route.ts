import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { ExecutiveActionPlanner } from '@/ai/executive/actions/action-planner';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role as any, PERMISSIONS.LEAD_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    if (!body.rejectionReason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const result = await ExecutiveActionPlanner.rejectActionPlan(id, user.organizationId, {
      decidedByUserId: user.id,
      userRole: user.role as any,
      rejectionReason: body.rejectionReason,
    });

    return NextResponse.json({ plan: result }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/actions/[id]/reject POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reject action plan' },
      { status: 400 }
    );
  }
}
