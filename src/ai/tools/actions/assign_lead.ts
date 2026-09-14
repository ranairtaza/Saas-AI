import { AITool } from '../registry';
import { AIContext } from '../../providers/provider';
import { prisma } from '../../../lib/db';

export const assignLeadTool: AITool = {
  name: 'assign_lead',
  description: 'Proposes assigning a lead to a specific user. Requires human approval.',
  riskLevel: 'MEDIUM',
  requiredPermission: 'lead:update',
  parameters: {
    type: 'object',
    properties: {
      leadId: { type: 'string', description: 'The ID of the lead' },
      userId: { type: 'string', description: 'The ID of the user to assign the lead to' },
    },
    required: ['leadId', 'userId'],
  },
  
  buildAction: async (context: AIContext, args: any) => {
    const { leadId, userId } = args;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!lead) {
      throw new Error(`Lead not found or you don't have access to it.`);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId, organizationId: context.organizationId },
    });

    if (!targetUser) {
      throw new Error(`User not found or they don't belong to your organization.`);
    }

    return {
      humanDescription: `Assign lead "${lead.companyName}" to user ${targetUser.name || targetUser.email}`,
      sanitizedArgs: {
        leadId,
        userId,
        oldOwnerId: lead.ownerId
      }
    };
  },

  executeAction: async (context: AIContext, args: any) => {
    const { leadId, userId, oldOwnerId } = args;

    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!currentLead) {
      throw new Error('Lead no longer exists.');
    }

    if (currentLead.ownerId !== oldOwnerId) {
      throw new Error('Lead owner was modified concurrently. Aborting.');
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { ownerId: userId },
    });

    // Record activity
    await prisma.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.userId,
        type: 'ASSIGNMENT',
        content: `Lead assigned via AI Assistant.`,
        oldValue: oldOwnerId || 'Unassigned',
        newValue: userId,
      }
    });

    return {
      success: true,
      leadId,
      message: `Lead successfully assigned.`,
    };
  }
};
