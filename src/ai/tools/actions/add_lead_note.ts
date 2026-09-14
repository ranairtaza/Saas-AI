import { AITool } from '../registry';
import { AIContext } from '../../providers/provider';
import { prisma } from '../../../lib/db';

export const addLeadNoteTool: AITool = {
  name: 'add_lead_note',
  description: 'Proposes adding a note to a specific lead. Requires human approval.',
  riskLevel: 'LOW',
  requiredPermission: 'lead:update',
  parameters: {
    type: 'object',
    properties: {
      leadId: { type: 'string', description: 'The ID of the lead' },
      noteContent: { type: 'string', description: 'The content of the note to add' },
    },
    required: ['leadId', 'noteContent'],
  },
  
  buildAction: async (context: AIContext, args: any) => {
    const { leadId, noteContent } = args;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!lead) {
      throw new Error(`Lead not found or you don't have access to it.`);
    }

    return {
      humanDescription: `Add a note to lead "${lead.companyName}": "${noteContent}"`,
      sanitizedArgs: {
        leadId,
        noteContent,
      }
    };
  },

  executeAction: async (context: AIContext, args: any) => {
    const { leadId, noteContent } = args;

    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId, organizationId: context.organizationId },
    });

    if (!currentLead) {
      throw new Error('Lead no longer exists.');
    }

    // Record activity as the note
    await prisma.leadActivity.create({
      data: {
        organizationId: context.organizationId,
        leadId,
        userId: context.userId,
        type: 'NOTE',
        content: noteContent,
      }
    });

    return {
      success: true,
      leadId,
      message: `Note added to lead.`,
    };
  }
};
