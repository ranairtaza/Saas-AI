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
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const result = await ExecutiveActionPlanner.approveActionPlan(id, user.organizationId, {
      decidedByUserId: user.id,
      userRole: user.role as any,
      approvalReason: body.approvalReason,
      stagePendingAction: body.stagePendingAction ?? true,
      conversationId: body.conversationId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/actions/[id]/approve POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve action plan' },
      { status: 400 }
    );
  }
}
