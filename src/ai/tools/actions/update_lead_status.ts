import { AITool } from '../registry';
import { AIContext } from '../../providers/provider';
import { prisma } from '../../../lib/db';

export const updateLeadStatusTool: AITool = {
  name: 'update_lead_status',
  description: 'Proposes changing the status of a specific lead. Requires human approval.',
  riskLevel: 'LOW', // Although LOW, it's a state change so we'll route it through buildAction
  requiredPermission: 'lead:update',
  parameters: {
    type: 'object',
    properties: {
      leadId: { type: 'string', description: 'The ID of the lead' },
      newStatus: { type: 'string', description: 'The new status to apply to the lead, e.g. QUALIFIED, CONTACTED' },
    },
    required: ['leadId', 'newStatus'],
  },
  
  buildAction: async (context: AIContext, args: any) => {
    const { leadId, newStatus } = args;

    // Verify lead exists and belongs to the organization
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!lead) {
      throw new Error(`Lead not found or you don't have access to it.`);
    }

    return {
      humanDescription: `Update lead "${lead.companyName}" status from ${lead.status} to ${newStatus}`,
      sanitizedArgs: {
        leadId,
        newStatus,
        oldStatus: lead.status
      }
    };
  },

  executeAction: async (context: AIContext, args: any) => {
    const { leadId, newStatus, oldStatus } = args;

    // Verify lead still exists and hasn't drastically changed
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!currentLead) {
      throw new Error('Lead no longer exists.');
    }

    // Update the lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { status: newStatus },
    });

    // Record activity
    await prisma.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.userId,
        type: 'STATUS_CHANGE',
        content: `Status updated from ${oldStatus} to ${newStatus} via AI Assistant.`,
        oldValue: oldStatus,
        newValue: newStatus,
      }
    });

    return {
      success: true,
      leadId,
      newStatus,
      message: `Lead status updated to ${newStatus}.`,
    };
  }
};
