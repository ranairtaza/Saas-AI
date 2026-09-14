import { AIContext } from '../../ai/providers/provider';
import { AITool } from '../tools/registry';
import { hasPermission } from '../../permissions/rbac';
import { logAudit } from '../../audit/logger';

export class PermissionGate {
  static async verify(context: AIContext, tool: AITool): Promise<boolean> {
    // 1. Verify User is authenticated (context exists)
    if (!context || !context.userId || !context.organizationId) {
      return false;
    }

    // 2. Check tool permission if required
    if (tool.requiredPermission && !hasPermission(context.role, tool.requiredPermission as any)) {
      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_EXECUTED',
        resource: `tool:${tool.name}`,
        status: 'FAILURE',
        details: { reason: 'RBAC_DENIED' },
      });
      return false;
    }

    // 3. Check risk level validity
    const allowedRiskLevels = ['READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!allowedRiskLevels.includes(tool.riskLevel)) {
      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_EXECUTED',
        resource: `tool:${tool.name}`,
        status: 'FAILURE',
        details: { reason: 'INVALID_RISK_LEVEL' },
      });
      return false;
    }

    // CRITICAL tools are never allowed via AI
    if (tool.riskLevel === 'CRITICAL') {
      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_EXECUTED',
        resource: `tool:${tool.name}`,
        status: 'FAILURE',
        details: { reason: 'CRITICAL_RISK_REJECTED' },
      });
      return false;
    }

    return true;
  }
}
