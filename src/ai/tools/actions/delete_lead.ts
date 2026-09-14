import { AITool } from '../registry';
import { AIContext } from '../../providers/provider';
import { prisma } from '../../../lib/db';

export const deleteLeadTool: AITool = {
  name: 'delete_lead',
  description: 'Proposes deleting a lead. Requires human approval.',
  riskLevel: 'MEDIUM',
  requiredPermission: 'lead:delete',
  parameters: {
    type: 'object',
    properties: {
      leadId: { type: 'string', description: 'The ID of the lead' },
    },
    required: ['leadId'],
  },
  
  buildAction: async (context: AIContext, args: any) => {
    const { leadId } = args;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!lead) {
      throw new Error(`Lead not found or you don't have access to it.`);
    }

    return {
      humanDescription: `Delete lead "${lead.companyName}"`,
      sanitizedArgs: {
        leadId
      }
    };
  },

  executeAction: async (context: AIContext, args: any) => {
    const { leadId } = args;

    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!currentLead) {
      throw new Error('Lead no longer exists.');
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    return {
      success: true,
      leadId,
      message: `Lead successfully deleted.`,
    };
  }
};
