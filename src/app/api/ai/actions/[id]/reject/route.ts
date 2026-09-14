import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAudit } from '@/audit/logger';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch the action
    const action = await prisma.pendingAction.findUnique({
      where: { id, organizationId: user.organizationId }
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action.status !== 'WAITING') {
      return NextResponse.json({ error: 'Only WAITING actions can be rejected' }, { status: 400 });
    }

    // 2. Reject it atomically
    const updateResult = await prisma.pendingAction.updateMany({
      where: { id, status: 'WAITING' },
      data: { status: 'REJECTED', approvingUserId: user.id }
    });

    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'Action already processed' }, { status: 400 });
    }

    // 3. Log Audit
    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'AI_ACTION_REJECTED',
      resource: `pendingAction:${action.id}`,
      status: 'SUCCESS',
      details: {
        toolName: action.actionName
      },
      riskLevel: action.riskLevel as any
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error rejecting action:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
