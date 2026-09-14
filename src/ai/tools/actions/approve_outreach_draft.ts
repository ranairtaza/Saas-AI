import { AITool } from '../registry';
import { AIContext } from '../../providers/provider';
import { prisma } from '../../../lib/db';
import { isDatabaseWritesAllowed } from '../../../lib/db-guard';
import { computeOutreachContextHash } from '../../../lib/leads/outreach/context-builder';
import { logAudit } from '../../../audit/logger';

export const approveOutreachDraftTool: AITool = {
  name: 'approve_outreach_draft',
  description: 'Approves a personalized outreach email draft for future dispatch. Requires Manager or Admin approval.',
  riskLevel: 'MEDIUM', // Requires at least MANAGER role for approval
  requiredPermission: 'lead:update',
  parameters: {
    type: 'object',
    properties: {
      draftId: { type: 'string', description: 'The ID of the outreach draft' },
      leadId: { type: 'string', description: 'The ID of the associated lead' },
      contextHash: { type: 'string', description: 'The context hash at time of draft creation' },
    },
    required: ['draftId', 'leadId'],
  },

  buildAction: async (context: AIContext, args: any) => {
    const { draftId, leadId } = args;

    // Verify lead exists and belongs to the organization
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!lead) {
      throw new Error(`Lead not found or you don't have access to it.`);
    }

    // Verify draft if database writes are enabled
    let subject = 'Outreach Draft';
    if (isDatabaseWritesAllowed()) {
      const draft = await prisma.outreachDraft.findFirst({
        where: { id: draftId, organizationId: context.organizationId, leadId },
      });
      if (!draft) {
        throw new Error(`Outreach draft not found or access denied.`);
      }
      if (draft.status === 'APPROVED') {
        throw new Error(`This outreach draft is already approved.`);
      }
      if (draft.status === 'REJECTED') {
        throw new Error(`Cannot approve a rejected outreach draft.`);
      }
      subject = draft.subject;
    }

    return {
      humanDescription: `Approve outreach draft for "${lead.companyName}" (Subject: "${subject}") for future dispatch`,
      sanitizedArgs: {
        draftId,
        leadId,
        companyName: lead.companyName,
        subject,
      },
    };
  },

  executeAction: async (context: AIContext, args: any) => {
    const { draftId, leadId, companyName } = args;

    if (!isDatabaseWritesAllowed()) {
      return {
        success: true,
        persisted: false,
        draftId,
        status: 'APPROVED',
        message: 'Draft approved in mock/in-memory mode (DB writes disabled).',
      };
    }

    // Verify draft exists and is active
    const draft = await prisma.outreachDraft.findFirst({
      where: { id: draftId, organizationId: context.organizationId, leadId },
      include: { lead: true },
    });

    if (!draft) {
      throw new Error('Outreach draft no longer exists.');
    }

    // Verify context freshness (stale protection)
    const currentContextHash = computeOutreachContextHash({
      leadId: draft.lead.id,
      companyName: draft.lead.companyName,
      domain: draft.lead.domain,
      contactTitle: draft.lead.contactTitle,
      score: draft.lead.score,
      scoreCategory: draft.lead.score ? (draft.lead.score >= 75 ? 'HIGH' : draft.lead.score >= 50 ? 'MEDIUM' : 'LOW') : null,
      enrichmentDataString: draft.lead.enrichmentData,
    });

    if (draft.contextHash && currentContextHash !== draft.contextHash) {
      // Transition draft to STALE
      await prisma.outreachDraft.update({
        where: { id: draftId },
        data: { status: 'STALE' },
      });
      throw new Error('Lead context has changed since draft was generated. Please regenerate the draft before approving.');
    }

    const now = new Date();

    // Transition to APPROVED
    const updatedDraft = await prisma.outreachDraft.update({
      where: { id: draftId },
      data: {
        status: 'APPROVED',
        approvedBy: context.userId,
        approvedAt: now,
      },
    });

    // Record activity in LeadActivity log
    await prisma.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.userId,
        type: 'OUTREACH_APPROVED',
        content: `Outreach draft v${updatedDraft.version} ("${updatedDraft.subject}") approved for future dispatch.`,
      },
    });

    // Record in AuditLog
    await logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      action: 'OUTREACH_DRAFT_APPROVED',
      resource: `outreachDraft:${draftId}`,
      status: 'SUCCESS',
      details: {
        leadId,
        version: updatedDraft.version,
        generationMode: updatedDraft.generationMode,
        contextHash: updatedDraft.contextHash,
      },
    });

    return {
      success: true,
      persisted: true,
      draftId,
      status: 'APPROVED',
      approvedAt: now.toISOString(),
      message: 'Outreach draft successfully approved for future dispatch.',
    };
  },
};
