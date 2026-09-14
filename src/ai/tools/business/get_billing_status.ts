import { AITool } from '../registry';
import { prisma } from '../../../lib/db';

export const getBillingStatusTool: AITool = {
  name: 'getBillingStatus',
  description: 'Gets safe billing information such as subscription status and plan.',
  parameters: { type: 'object', properties: {} },
  requiredPermission: 'billing:read',
  riskLevel: 'READ_ONLY',
  execute: async (context, args) => {
    const sub = await prisma.organizationBilling.findFirst({
      where: { organizationId: context.organizationId },
      orderBy: { currentPeriodEnd: 'desc' }
    });
    
    return {
      success: true,
      data: {
        status: sub?.subscriptionStatus || 'No active subscription',
        plan: sub?.planId || 'Free',
        currentPeriodEnd: sub?.currentPeriodEnd || null,
      }
    };
  }
};
