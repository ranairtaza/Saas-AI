import { AITool } from '../registry';
import { prisma } from '../../../lib/db';

export const getDiscoverySummaryTool: AITool = {
  name: 'getDiscoverySummary',
  description: 'Gets a summary of discovery jobs, statuses, and processed counts.',
  parameters: { type: 'object', properties: {} },
  requiredPermission: 'discovery:read',
  riskLevel: 'READ_ONLY',
  execute: async (context, args) => {
    const jobs = await prisma.discoveryJob.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    return {
      success: true,
      data: {
        recentJobs: jobs.map(j => ({ id: j.id, status: j.status, processed: j.processed })),
      }
    };
  }
};
