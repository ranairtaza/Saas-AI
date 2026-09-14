import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';
import { DecisionOrchestrator } from '@/ai/executive/decisions/decision-orchestrator';

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
      return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
    }

    const decision = await DecisionOrchestrator.rejectDecision(id, user.organizationId, {
      decidedByUserId: user.id,
      userRole: user.role,
      rejectionReason: body.rejectionReason,
    });

    return NextResponse.json({ decision }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/executive/decisions/[id]/reject POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reject decision' },
      { status: 400 }
    );
  }
}
