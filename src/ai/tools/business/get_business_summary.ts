import { AITool } from '../registry';
import { prisma } from '../../../lib/db';

export const getBusinessSummaryTool: AITool = {
  name: 'getBusinessSummary',
  description: 'Gets a high-level summary of business metrics like lead count and recent activity.',
  parameters: { type: 'object', properties: {} },
  requiredPermission: 'business:read',
  riskLevel: 'READ_ONLY',
  execute: async (context, args) => {
    const leadCount = await prisma.lead.count({ where: { organizationId: context.organizationId } });
    const discoveryJobs = await prisma.discoveryJob.count({ where: { organizationId: context.organizationId } });
    
    return {
      success: true,
      data: {
        totalLeads: leadCount,
        totalDiscoveryJobs: discoveryJobs,
      }
    };
  }
};
