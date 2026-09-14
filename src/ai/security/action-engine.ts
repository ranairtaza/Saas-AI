import { AIContext } from '../providers/provider';
import { AITool } from '../tools/registry';
import { prisma } from '../../lib/db';
import { logAudit } from '../../audit/logger';
import { hasPermission } from '../../permissions/rbac';
import * as crypto from 'crypto';

export class ActionEngine {
  /**
   * Proposes a new action and creates a PendingAction record
   */
  static async proposeAction(context: AIContext, tool: AITool, args: any, conversationId: string): Promise<any> {
    if (!tool.buildAction) {
      throw new Error(`Tool ${tool.name} does not support action building.`);
    }

    try {
      // 1. Build the action to get human description and sanitized args
      const { humanDescription, sanitizedArgs } = await tool.buildAction(context, args);

      // 2. Create the pending action in the database
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const action = await prisma.pendingAction.create({
        data: {
          organizationId: context.organizationId,
          actionName: tool.name,
          humanDescription,
          actionArgs: JSON.stringify(sanitizedArgs),
          status: 'WAITING',
          actionType: tool.riskLevel,
          riskLevel: tool.riskLevel || 'LOW',
          requestingUserId: context.userId,
          conversationId,
          idempotencyKey: crypto.randomUUID(),
          expiresAt,
        },
      });

      // 3. Log the proposal
      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_PROPOSED',
        resource: `pendingAction:${action.id}`,
        status: 'SUCCESS',
        details: {
          toolName: tool.name,
          riskLevel: tool.riskLevel,
        },
      });

      // Return a special response that the orchestrator will recognize
      return {
        _isPendingAction: true,
        pendingActionId: action.id,
        humanDescription,
        riskLevel: tool.riskLevel,
        message: `I have prepared an action: ${humanDescription}. It requires your approval before I can proceed.`,
      };
    } catch (error: any) {
      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_PROPOSED',
        resource: `tool:${tool.name}`,
        status: 'FAILURE',
        details: { reason: error.message },
      });
      throw error;
    }
  }

  /**
   * Approves a pending action. Only transitions WAITING -> APPROVED.
   */
  static async approveAction(context: AIContext, pendingActionId: string): Promise<any> {
    const action = await prisma.pendingAction.findUnique({
      where: { id: pendingActionId, organizationId: context.organizationId },
    });

    if (!action) {
      throw new Error('Pending action not found');
    }

    if (action.status !== 'WAITING') {
      throw new Error(`Action is not waiting for approval. Current status: ${action.status}`);
    }

    if (action.expiresAt < new Date()) {
      await prisma.pendingAction.update({
        where: { id: action.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Action has expired');
    }

    const registryModule = await import('../tools/registry');
    const { updateLeadStatusTool } = await import('../tools/actions/update_lead_status');
    const { addLeadNoteTool } = await import('../tools/actions/add_lead_note');
    const { assignLeadTool } = await import('../tools/actions/assign_lead');
    const { deleteLeadTool } = await import('../tools/actions/delete_lead');
    
    const tempRegistry = new registryModule.ToolRegistry();
    tempRegistry.register(updateLeadStatusTool);
    tempRegistry.register(addLeadNoteTool);
    tempRegistry.register(assignLeadTool);
    tempRegistry.register(deleteLeadTool);

    const tool = tempRegistry.getTool(action.actionName);
    if (!tool || !tool.executeAction) {
      throw new Error(`Executable action for ${action.actionName} not found.`);
    }

    // Authorization checks
    if (tool.requiredPermission && !hasPermission(context.role, tool.requiredPermission as any)) {
      throw new Error(`Permission denied: Missing '${tool.requiredPermission}'`);
    }

    // Approval authority based on risk
    if (tool.riskLevel === 'MEDIUM' && !['OWNER', 'ADMIN', 'MANAGER'].includes(context.role)) {
      throw new Error(`Permission denied: Risk level ${tool.riskLevel} requires higher authority`);
    }
    if (tool.riskLevel === 'HIGH' && !['OWNER', 'ADMIN'].includes(context.role)) {
      throw new Error(`Permission denied: Risk level ${tool.riskLevel} requires higher authority`);
    }
    if (tool.riskLevel === 'CRITICAL' && context.role !== 'OWNER') {
      throw new Error(`Permission denied: Risk level ${tool.riskLevel} requires higher authority`);
    }

    const updateResult = await prisma.pendingAction.updateMany({
      where: { 
        id: action.id, 
        status: 'WAITING' 
      },
      data: { 
        status: 'APPROVED',
        approvingUserId: context.userId
      },
    });

    if (updateResult.count === 0) {
      throw new Error('Action could not be approved or was already processed.');
    }

    await logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      action: 'AI_ACTION_EXECUTED' as any, // Using fallback cast if AI_ACTION_APPROVED is not in enum
      resource: `pendingAction:${action.id}`,
      status: 'SUCCESS',
    });

    return await prisma.pendingAction.findUnique({ where: { id: action.id } });
  }

  /**
   * Executes an action that was previously approved
   */
  static async executeApprovedAction(context: AIContext, pendingActionId: string): Promise<any> {
    // 1. Verify the pending action
    const action = await prisma.pendingAction.findUnique({
      where: { id: pendingActionId, organizationId: context.organizationId },
    });

    if (!action) {
      throw new Error('Pending action not found');
    }

    if (action.status !== 'APPROVED') {
      throw new Error(`Action is not approved. Current status: ${action.status}`);
    }

    if (action.expiresAt < new Date()) {
      await prisma.pendingAction.update({
        where: { id: action.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Action has expired');
    }

    const registryModule = await import('../tools/registry');
    const { updateLeadStatusTool } = await import('../tools/actions/update_lead_status');
    const { addLeadNoteTool } = await import('../tools/actions/add_lead_note');
    const { assignLeadTool } = await import('../tools/actions/assign_lead');
    const { deleteLeadTool } = await import('../tools/actions/delete_lead');
    
    const tempRegistry = new registryModule.ToolRegistry();
    tempRegistry.register(updateLeadStatusTool);
    tempRegistry.register(addLeadNoteTool);
    tempRegistry.register(assignLeadTool);
    tempRegistry.register(deleteLeadTool);

    const tool = tempRegistry.getTool(action.actionName);
    if (!tool || !tool.executeAction) {
      throw new Error(`Executable action for ${action.actionName} not found.`);
    }

    // Authorization checks
    if (tool.requiredPermission && !hasPermission(context.role, tool.requiredPermission as any)) {
      throw new Error(`Permission denied: Missing '${tool.requiredPermission}'`);
    }

    // Approval authority based on risk
    if (tool.riskLevel === 'MEDIUM' && !['OWNER', 'ADMIN', 'MANAGER'].includes(context.role)) {
      throw new Error(`Permission denied: Risk level ${tool.riskLevel} requires higher authority`);
    }
    if (tool.riskLevel === 'HIGH' && !['OWNER', 'ADMIN'].includes(context.role)) {
      throw new Error(`Permission denied: Risk level ${tool.riskLevel} requires higher authority`);
    }
    if (tool.riskLevel === 'CRITICAL' && context.role !== 'OWNER') {
      throw new Error(`Permission denied: Risk level ${tool.riskLevel} requires higher authority`);
    }

    // 2. Mark as executing atomically
    const updateResult = await prisma.pendingAction.updateMany({
      where: { 
        id: action.id, 
        status: 'APPROVED' 
      },
      data: { status: 'EXECUTING' },
    });

    if (updateResult.count === 0) {
      throw new Error('Action was already processed or cancelled.');
    }

    try {
      const args = JSON.parse(action.actionArgs);

      // Capture beforeSnapshot immediately prior to state mutation
      let beforeSnapshot: any = null;
      try {
        const { TelemetrySnapshotService } = await import('../executive/outcomes/snapshot-service');
        beforeSnapshot = await TelemetrySnapshotService.captureSnapshot(context.organizationId);
      } catch (snapshotErr) {
        console.warn('[ActionEngine] Warning: Could not capture pre-execution snapshot:', snapshotErr);
      }

      // 3. Execute the tool
      const result = await tool.executeAction(context, args);

      // 4. Update action as executed
      await prisma.pendingAction.update({
        where: { id: action.id },
        data: {
          status: 'EXECUTED',
          executionResult: JSON.stringify(result),
          approvingUserId: context.userId,
        },
      });

      // 5. If associated with an ExecutiveRecommendation, initialize ExecutiveOutcome
      try {
        const rec = await prisma.executiveRecommendation.findFirst({
          where: { pendingActionId: action.id, organizationId: context.organizationId },
        });

        if (rec) {
          await prisma.executiveRecommendation.update({
            where: { id: rec.id },
            data: { status: 'APPROVED' },
          });

          let targetKpiKey = 'unassigned_leads';
          if (action.actionName === 'assign_lead') {
            targetKpiKey = 'unassigned_leads';
          } else if (rec.domain === 'REVENUE') {
            targetKpiKey = 'revenue_mrr';
          }

          const { ExecutiveOutcomeService } = await import('../executive/outcomes/outcome-service');
          await ExecutiveOutcomeService.initializeOutcome(context.organizationId, {
            recommendationId: rec.id,
            pendingActionId: action.id,
            domain: rec.domain,
            targetKpiKey,
            beforeSnapshot: beforeSnapshot || undefined,
            userId: context.userId,
          });
        }
      } catch (outcomeErr) {
        console.warn('[ActionEngine] Warning: Failed to initialize ExecutiveOutcome:', outcomeErr);
      }

      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_EXECUTED',
        resource: `pendingAction:${action.id}`,
        status: 'SUCCESS',
        details: {
          toolName: action.actionName,
        },
      });

      return result;
    } catch (err: any) {
      // 5. Update action as failed
      await prisma.pendingAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          failureReason: err.message,
          approvingUserId: context.userId,
        },
      });

      await logAudit({
        organizationId: context.organizationId,
        userId: context.userId,
        action: 'AI_ACTION_EXECUTED',
        resource: `pendingAction:${action.id}`,
        status: 'FAILURE',
        details: {
          toolName: action.actionName,
          error: err.message,
        },
      });

      throw err;
    }
  }
}
