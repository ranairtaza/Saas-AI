import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isDatabaseWritesAllowed } from '@/lib/db-guard';
import { hasPermission } from '@/permissions/rbac';
import { computeOutreachContextHash } from '@/lib/leads/outreach/context-builder';
import { ActionEngine } from '@/ai/security/action-engine';

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

    // Load lead with organization scoping
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or access denied' }, { status: 404 });
    }

    if (!isDatabaseWritesAllowed()) {
      return NextResponse.json({
        success: true,
        persisted: false,
        status: 'PENDING_APPROVAL',
        message: 'Approval requested in mock mode (DB writes disabled).',
      });
    }

    // Load active draft
    const draft = await prisma.outreachDraft.findFirst({
      where: { leadId, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!draft) {
      return NextResponse.json({ error: 'No draft found to request approval for' }, { status: 404 });
    }

    if (draft.status === 'APPROVED') {
      return NextResponse.json({ error: 'This draft is already approved.' }, { status: 400 });
    }

    if (draft.status === 'REJECTED') {
      return NextResponse.json({ error: 'Cannot request approval for a rejected draft. Please regenerate first.' }, { status: 400 });
    }

    // Check context freshness (stale protection)
    const currentContextHash = computeOutreachContextHash({
      leadId: lead.id,
      companyName: lead.companyName,
      domain: lead.domain,
      contactTitle: lead.contactTitle,
      score: lead.score,
      scoreCategory: lead.score ? (lead.score >= 75 ? 'HIGH' : lead.score >= 50 ? 'MEDIUM' : 'LOW') : null,
      enrichmentDataString: lead.enrichmentData,
    });

    if (draft.contextHash && currentContextHash !== draft.contextHash) {
      await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: { status: 'STALE' },
      });
      return NextResponse.json({
        error: 'Lead context has changed since draft was generated. Please regenerate the draft before requesting approval.',
        isStale: true,
      }, { status: 400 });
    }

    // Check if an existing PendingAction is already WAITING for this draft
    if (draft.pendingActionId) {
      const existingAction = await prisma.pendingAction.findUnique({
        where: { id: draft.pendingActionId },
      });
      if (existingAction && existingAction.status === 'WAITING' && existingAction.expiresAt > new Date()) {
        return NextResponse.json({
          success: true,
          status: 'PENDING_APPROVAL',
          pendingActionId: existingAction.id,
          message: 'Approval request already waiting for manager review.',
        });
      }
    }

    // Propose action through ActionEngine
    const { approveOutreachDraftTool } = await import('@/ai/tools/actions/approve_outreach_draft');
    const { logAudit } = await import('@/audit/logger');

    const aiContext = {
      organizationId: user.organizationId,
      userId: user.id,
      role: user.role,
    };

    const proposed = await ActionEngine.proposeAction(
      aiContext,
      approveOutreachDraftTool,
      {
        draftId: draft.id,
        leadId: lead.id,
        contextHash: draft.contextHash,
      },
      'outreach-approval'
    );

    // Update draft status to PENDING_APPROVAL and associate pendingActionId
    await prisma.outreachDraft.update({
      where: { id: draft.id },
      data: {
        status: 'PENDING_APPROVAL',
        pendingActionId: proposed.pendingActionId || proposed.id,
      },
    });

    // Record in AuditLog
    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'OUTREACH_APPROVAL_REQUESTED',
      resource: `outreachDraft:${draft.id}`,
      status: 'SUCCESS',
      details: {
        pendingActionId: proposed.pendingActionId || proposed.id,
        version: draft.version,
        contextHash: draft.contextHash,
      },
    });

    return NextResponse.json({
      success: true,
      persisted: true,
      status: 'PENDING_APPROVAL',
      pendingAction: proposed,
    });
  } catch (error: any) {
    console.error('[Outreach Request Approval] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
