import { prisma } from '../../lib/db';
import { assertDatabaseWritesAllowed, isDatabaseWritesAllowed } from '../../lib/db-guard';
import { BusinessContextBuilder } from './context-builder';
import { ExecutiveReasoningEngine } from './reasoning-engine';
import { ExecutiveRecommendationData, ExecutiveRecommendationSchema, BusinessContext } from './types';
import { ExecutiveMemoryService } from './memory-service';
import { logAudit } from '../../audit/logger';
import * as crypto from 'crypto';

export class ExecutiveService {
  /**
   * Retrieves unified business context
   */
  static async getBusinessContext(organizationId: string): Promise<BusinessContext> {
    return BusinessContextBuilder.buildBusinessContext(organizationId);
  }

  /**
   * Generates recommendations from business context and persists them
   */
  static async generateAndStoreRecommendations(
    organizationId: string,
    userId?: string
  ): Promise<ExecutiveRecommendationData[]> {
    const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
    const generated = await ExecutiveReasoningEngine.generateRecommendations(context, userId);
    const storedRecommendations: ExecutiveRecommendationData[] = [];

    if (!isDatabaseWritesAllowed()) {
      return generated;
    }

    try {
      assertDatabaseWritesAllowed('store executive recommendations');

      for (const rec of generated) {
        // Prevent duplicate active recommendations with identical title/domain
        const existing = await prisma.executiveRecommendation.findFirst({
          where: {
            organizationId,
            domain: rec.domain,
            title: rec.title,
            status: 'ACTIVE',
          },
        });

        if (existing) {
          storedRecommendations.push({
            ...rec,
            id: existing.id,
            createdAt: existing.createdAt,
          });
          continue;
        }

        const created = await prisma.executiveRecommendation.create({
          data: {
            organizationId,
            domain: rec.domain,
            priorityScore: rec.priorityScore,
            priorityLevel: rec.priorityLevel,
            title: rec.title,
            executiveSummary: rec.executiveSummary,
            reasoning: JSON.stringify(rec.reasoning),
            expectedImpact: rec.expectedImpact,
            confidence: rec.confidence,
            actionProposal: JSON.stringify(rec.actionProposal),
            status: 'ACTIVE',
            expiresAt: rec.expiresAt ? new Date(rec.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        if (userId) {
          await logAudit({
            organizationId,
            userId,
            action: 'EXECUTIVE_RECOMMENDATION_CREATED' as any,
            resource: `executiveRecommendation:${created.id}`,
            status: 'SUCCESS',
            details: { title: created.title, priorityScore: created.priorityScore },
          });
        }

        storedRecommendations.push({
          ...rec,
          id: created.id,
          createdAt: created.createdAt,
        });
      }
    } catch (err) {
      console.warn('[ExecutiveService] Storing recommendations skipped (read-only mode):', err);
      return generated;
    }

    return storedRecommendations;
  }

  /**
   * Retrieves active recommendations for an organization
   */
  static async getActiveRecommendations(organizationId: string): Promise<ExecutiveRecommendationData[]> {
    return this.getRecommendations(organizationId, { status: 'ACTIVE', limit: 10 });
  }

  /**
   * Retrieves stored recommendations for an organization
   */
  static async getRecommendations(
    organizationId: string,
    options?: {
      limit?: number;
      status?: string;
    }
  ): Promise<ExecutiveRecommendationData[]> {
    const limit = Math.min(options?.limit || 5, 20);

    if (!isDatabaseWritesAllowed()) {
      const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
      const generated = ExecutiveReasoningEngine.generateGroundedHeuristics(context);
      return generated.slice(0, limit);
    }

    const records = await prisma.executiveRecommendation.findMany({
      where: {
        organizationId,
        ...(options?.status ? { status: options.status } : { status: 'ACTIVE' }),
      },
      orderBy: { priorityScore: 'desc' },
      take: limit,
    });

    if (records.length === 0) {
      const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
      const generated = ExecutiveReasoningEngine.generateGroundedHeuristics(context);
      return generated.slice(0, limit);
    }

    return records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      domain: r.domain as any,
      priorityScore: r.priorityScore,
      priorityLevel: r.priorityLevel as any,
      title: r.title,
      executiveSummary: r.executiveSummary,
      reasoning: JSON.parse(r.reasoning),
      expectedImpact: r.expectedImpact,
      confidence: r.confidence as any,
      actionProposal: JSON.parse(r.actionProposal),
      status: r.status as any,
      pendingActionId: r.pendingActionId,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
  }

  /**
   * Proposes an executive recommendation as a governed ActionEngine PendingAction
   */
  static async proposeRecommendationAction(
    organizationId: string,
    recommendationId: string,
    requestingUserId: string,
    conversationId?: string
  ): Promise<{ recommendation: ExecutiveRecommendationData; pendingActionId: string }> {
    assertDatabaseWritesAllowed('propose executive action');

    // 1. Retrieve recommendation
    const rec = await prisma.executiveRecommendation.findFirst({
      where: { id: recommendationId, organizationId },
    });

    let actionProposal: any;
    let recTitle = '';

    if (rec) {
      actionProposal = JSON.parse(rec.actionProposal);
      recTitle = rec.title;
    } else {
      const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
      const generated = ExecutiveReasoningEngine.generateGroundedHeuristics(context);
      const matched = generated.find((g) => g.id === recommendationId) || generated[0];
      if (!matched) {
        throw new Error(`Recommendation ${recommendationId} not found`);
      }
      actionProposal = matched.actionProposal;
      recTitle = matched.title;
    }

    // 2. Stage governed PendingAction
    let targetConversationId = conversationId;
    if (!targetConversationId) {
      const existingConv = await prisma.conversation.findFirst({
        where: { organizationId, userId: requestingUserId },
      });
      if (existingConv) {
        targetConversationId = existingConv.id;
      } else {
        const newConv = await prisma.conversation.create({
          data: {
            organizationId,
            userId: requestingUserId,
            title: 'Executive Actions',
          },
        });
        targetConversationId = newConv.id;
      }
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pendingAction = await prisma.pendingAction.create({
      data: {
        organizationId,
        actionName: actionProposal.actionName,
        humanDescription: `[Executive Action] ${actionProposal.humanDescription}`,
        actionArgs: JSON.stringify(actionProposal.actionArgs),
        status: 'WAITING',
        actionType: actionProposal.riskLevel || 'MEDIUM',
        riskLevel: actionProposal.riskLevel || 'MEDIUM',
        requestingUserId,
        conversationId: targetConversationId,
        idempotencyKey: crypto.randomUUID(),
        expiresAt,
      },
    });

    // 3. Update recommendation status if stored
    if (rec) {
      await prisma.executiveRecommendation.update({
        where: { id: recommendationId },
        data: {
          status: 'PROPOSED',
          pendingActionId: pendingAction.id,
        },
      });
    }

    // 4. Log audit record
    await logAudit({
      organizationId,
      userId: requestingUserId,
      action: 'EXECUTIVE_RECOMMENDATION_PROPOSED' as any,
      resource: `executiveRecommendation:${recommendationId}`,
      status: 'SUCCESS',
      details: {
        pendingActionId: pendingAction.id,
        actionName: actionProposal.actionName,
        riskLevel: actionProposal.riskLevel,
      },
    });

    const parsedRec: ExecutiveRecommendationData = rec
      ? {
          id: rec.id,
          organizationId: rec.organizationId,
          domain: rec.domain as any,
          priorityScore: rec.priorityScore,
          priorityLevel: rec.priorityLevel as any,
          title: rec.title,
          executiveSummary: rec.executiveSummary,
          reasoning: JSON.parse(rec.reasoning),
          expectedImpact: rec.expectedImpact,
          confidence: rec.confidence as any,
          actionProposal: JSON.parse(rec.actionProposal),
          status: 'PROPOSED',
          pendingActionId: pendingAction.id,
          createdAt: rec.createdAt,
          expiresAt: rec.expiresAt,
        }
      : {
          id: recommendationId,
          organizationId,
          domain: 'REVENUE',
          priorityScore: 80,
          priorityLevel: 'CRITICAL',
          title: recTitle,
          executiveSummary: actionProposal.humanDescription,
          reasoning: {
            facts: ['Generated action proposal from executive heuristic engine.'],
            observations: ['Action requires human governance approval.'],
            hypotheses: [
              {
                hypothesis: 'Executing this action will resolve the identified executive priority.',
                confidence: 'HIGH',
                confidenceRationale: 'Directly maps to identified business anomaly.',
                supportingObservations: ['Action requires human governance approval.'],
              },
            ],
          },
          expectedImpact: 'Direct operational resolution.',
          confidence: 'HIGH',
          actionProposal,
          status: 'PROPOSED',
          pendingActionId: pendingAction.id,
        };

    return {
      recommendation: parsedRec,
      pendingActionId: pendingAction.id,
    };
  }

  /**
   * Feeds the outcome of an executed action back into Executive Memory
   */
  static async recordActionOutcomeToMemory(
    organizationId: string,
    params: {
      actionName: string;
      title: string;
      summary: string;
      outcome: string;
      facts: string[];
      observations: string[];
      pendingActionId?: string;
      userId?: string;
    }
  ): Promise<void> {
    assertDatabaseWritesAllowed('record_action_outcome_to_memory');

    await ExecutiveMemoryService.createMemory(
      organizationId,
      {
        category: 'DECISION',
        title: params.title,
        summary: params.summary,
        facts: params.facts,
        observations: params.observations,
        outcome: params.outcome,
        sourceActionId: params.pendingActionId,
        userId: params.userId,
      }
    );
  }

  /**
   * Dismisses an active recommendation
   */
  static async dismissRecommendation(
    organizationId: string,
    recommendationId: string,
    userId?: string
  ): Promise<void> {
    assertDatabaseWritesAllowed('dismiss executive recommendation');

    await prisma.executiveRecommendation.update({
      where: { id: recommendationId, organizationId },
      data: { status: 'DISMISSED' },
    });

    if (userId) {
      await logAudit({
        organizationId,
        userId,
        action: 'AI_ACTION_REJECTED',
        resource: `executiveRecommendation:${recommendationId}`,
        status: 'SUCCESS',
        details: { dismissedAt: new Date().toISOString() },
      });
    }
  }
}
