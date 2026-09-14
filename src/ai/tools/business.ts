import { AITool } from './registry';
import { prisma } from '../../lib/db';

export const getLeadsSummaryTool: AITool = {
  name: 'getLeadsSummary',
  description: 'Gets a summary of all leads for the current organization.',
  parameters: {
    type: 'object',
    properties: {},
  },
  riskLevel: 'READ_ONLY',
  requiredPermission: 'lead:read',
  execute: async (context, args) => {
    const totalLeads = await prisma.lead.count({
      where: { organizationId: context.organizationId }
    });

    return {
      success: true,
      data: {
        totalLeads,
      }
    };
  }
};
