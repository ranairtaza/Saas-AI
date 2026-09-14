import { AITool } from '../registry';
import { prisma } from '../../../lib/db';

export const getCreditBalanceTool: AITool = {
  name: 'getCreditBalance',
  description: 'Gets the current available credits and reserved credits.',
  parameters: { type: 'object', properties: {} },
  requiredPermission: 'credits:read',
  riskLevel: 'READ_ONLY',
  execute: async (context, args) => {
    const org = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { apiCredits: true }
    });
    
    return {
      success: true,
      data: {
        availableCredits: org?.apiCredits || 0,
      }
    };
  }
};
