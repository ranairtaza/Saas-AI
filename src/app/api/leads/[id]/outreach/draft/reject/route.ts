import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { hasPermission } from '@/permissions/rbac';
import { RejectDraftRequestSchema } from '@/lib/leads/outreach/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'lead:update')) {
      return NextResponse.json({ error: 'Permission denied: Missing lead:update' }, { status: 403 });
    }

    const resolvedParams = await params;
    const leadId = resolvedParams.id;

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RejectDraftRequestSchema.safeParse(rawBody);
    const reason = parseResult.success ? parseResult.data.reason : undefined;

    if (isDatabaseWritesAllowed()) {
      const draft = await prisma.outreachDraft.findFirst({
        where: { leadId, organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (!draft) {
        return NextResponse.json({ error: 'No draft found to reject' }, { status: 404 });
      }

      if (draft.status === 'APPROVED') {
        return NextResponse.json({ error: 'Cannot reject an already approved outreach draft' }, { status: 400 });
      }

      // Update draft status to REJECTED
      const updatedDraft = await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: {
          status: 'REJECTED',
          rejectedBy: user.id,
          rejectionReason: reason || 'Rejected by user',
        },
      });

      // If there is an active PendingAction, invalidate/reject it
      if (draft.pendingActionId) {
        await prisma.pendingAction.updateMany({
          where: {
            id: draft.pendingActionId,
            status: 'WAITING',
          },
          data: {
            status: 'REJECTED',
          },
        });
      }

      const { logAudit } = await import('@/audit/logger');
      await logAudit({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'OUTREACH_DRAFT_REJECTED',
        resource: `outreachDraft:${updatedDraft.id}`,
        status: 'SUCCESS',
        details: {
          reason: reason || 'No reason provided',
          version: updatedDraft.version,
        },
      });

      return NextResponse.json({ success: true, persisted: true, status: 'REJECTED' });
    }

    return NextResponse.json({ success: true, persisted: false, status: 'REJECTED', message: 'Rejected in mock mode' });
  } catch (error: any) {
    console.error('[Outreach Reject] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
