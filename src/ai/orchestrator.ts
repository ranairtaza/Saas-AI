import { LLMProvider, AIContext, ChatMessage } from './providers/provider';
import { ToolRegistry } from './tools/registry';
import { hasPermission } from '../permissions/rbac';
import { logAudit } from '../audit/logger';
import { ActionEngine } from './security/action-engine';

export class AIOrchestrator {
  constructor(
    private provider: LLMProvider,
    private registry: ToolRegistry
  ) {}

  async processChat(context: AIContext, messages: ChatMessage[], conversationId: string): Promise<ChatMessage> {
    // 1. Verify basic AI chat permission
    if (!hasPermission(context.role, 'ai:chat')) {
      throw new Error("Permission denied: Missing 'ai:chat'");
    }

    // 2. Log that chat was initiated
    await logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      action: 'AI_CHAT_INITIATED',
      resource: 'orchestrator',
      status: 'SUCCESS',
    });

    // 2.5. Inject Business Intelligence Context for executive reasoning
    const { BusinessContextBuilder } = await import('./executive/context-builder');
    const businessContext = await BusinessContextBuilder.buildBusinessContext(context.organizationId);

    const anomalies = businessContext.telemetry.recentAnomalies
      .map(a => `- ${a.metric}: ${a.description} (Deviation: ${a.deviationPct}%)`)
      .join('\n');

    const intelligenceContext: ChatMessage = {
      role: 'system',
      content: `[SYSTEM: VERIFIED BUSINESS INTELLIGENCE LAYER]
You are a Business AI Executive Assistant.
You must NEVER calculate financial totals, growth, or margin yourself.
Rely ONLY on the facts below.

--- VERIFIED FACTS ---
Business: ${businessContext.identity.name} (${businessContext.identity.industry})
Revenue (MTD): $${businessContext.telemetry.metrics.revenueMTD.value}
Pipeline: $${businessContext.telemetry.metrics.pipelineValue.value}
Total Leads: ${businessContext.telemetry.metrics.activeLeadsCount.value}
Unassigned High-Priority Leads: ${businessContext.telemetry.metrics.unassignedHighPriorityLeads.value}

Detected Anomalies: 
${anomalies || 'None'}
----------------------

Use this context to answer the user's questions.`
    };
    
    // 3. Loop until no more tool calls or max iterations reached
    let currentMessages: ChatMessage[] = [intelligenceContext, ...messages];
    const MAX_TURNS = 5;

    for (let i = 0; i < MAX_TURNS; i++) {
      const { message: aiMessage } = await this.provider.generateCompletion(
        context,
        currentMessages,
        { tools: this.registry.getToolSchemas() }
      );

      currentMessages.push(aiMessage);

      if (aiMessage.toolCalls && aiMessage.toolCalls.length > 0) {
        // Execute tool calls
        for (const call of aiMessage.toolCalls) {
          const tool = this.registry.getTool(call.name);
          if (!tool) {
            currentMessages.push({
              role: 'tool',
              name: call.name,
              content: JSON.stringify({ error: `Tool ${call.name} not found` }),
            });
            continue;
          }

          // RBAC check for the tool via PermissionGate
          const { PermissionGate } = await import('./security/permission-gate');
          const isAllowed = await PermissionGate.verify(context, tool);
          if (!isAllowed) {
            currentMessages.push({
              role: 'tool',
              name: call.name,
              content: JSON.stringify({ error: `Permission denied or risk level rejected for tool ${call.name}` }),
            });
            continue;
          }

          try {
            // Determine if tool requires ActionEngine proposal
            if (['MEDIUM', 'HIGH'].includes(tool.riskLevel) || tool.buildAction) {
              const proposedAction = await ActionEngine.proposeAction(context, tool, call.args || {}, conversationId);
              
              currentMessages.push({
                role: 'tool',
                name: call.name,
                content: JSON.stringify(proposedAction),
              });
              
              // If we propose an action, we can return immediately and let the LLM see the success
              // The next iteration will pick it up and present it to the user.
            } else if (tool.execute) {
              const result = await tool.execute(context, call.args || {});
              currentMessages.push({
                role: 'tool',
                name: call.name,
                content: JSON.stringify(result),
              });
              await logAudit({
                organizationId: context.organizationId,
                userId: context.userId,
                action: 'AI_ACTION_EXECUTED',
                resource: `tool:${call.name}`,
                status: 'SUCCESS',
              });
            } else {
              throw new Error(`Tool ${tool.name} is missing implementation`);
            }
          } catch (err: any) {
            currentMessages.push({
              role: 'tool',
              name: call.name,
              content: JSON.stringify({ error: err.message }),
            });
            await logAudit({
              organizationId: context.organizationId,
              userId: context.userId,
              action: 'AI_ACTION_EXECUTED',
              resource: `tool:${call.name}`,
              status: 'FAILURE',
              details: { error: err.message },
            });
          }
        }
      } else {
        // No more tool calls, return the final message
        return aiMessage;
      }
    }

    return {
      role: 'assistant',
      content: 'I reached the maximum number of reasoning steps.',
    };
  }
}
