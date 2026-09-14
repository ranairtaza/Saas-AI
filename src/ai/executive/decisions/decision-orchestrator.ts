import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed } from '../../../lib/db-guard';
import {
  CreateDecisionInput,
  ApproveDecisionInput,
  RejectDecisionInput,
  DeferDecisionInput,
  ExecutiveDecisionRecord,
  ExecutiveDecisionRecordSchema,
} from './types';
import { DecisionStateMachine } from './state-machine';
import { DecisionAuthorityEvaluator } from './authority-evaluator';
import * as crypto from 'crypto';



export class DecisionOrchestrator {
  /**
   * Creates a new Executive Decision from a governed strategic recommendation.
   */
  static async createDecision(input: CreateDecisionInput): Promise<ExecutiveDecisionRecord> {
    assertDatabaseWritesAllowed('create executive decision');

    const requiredAuthority = DecisionAuthorityEvaluator.determineAuthority(
      input.governanceVerdict,
      input.riskScore
    );

    // Initial status determined deterministically by governance verdict
    let initialStatus: any = 'PENDING';
    if (input.governanceVerdict === 'BLOCKED') {
      initialStatus = 'BLOCKED';
    } else if (input.governanceVerdict === 'INSUFFICIENT_EVIDENCE') {
      initialStatus = 'DEFERRED';
    }

    const expiresAt = new Date(Date.now() + (input.expiresInDays || 7) * 24 * 60 * 60 * 1000);

    const decision = await prisma.executiveDecision.create({
      data: {
        organizationId: input.organizationId,
        strategyId: input.strategyId,
        recommendationId: input.recommendationId,
        title: input.title,
        description: input.description,
        domain: input.domain,
        decisionType: input.decisionType,
        status: initialStatus,
        priority: input.priority,
        requiredAuthority,
        governanceVerdict: input.governanceVerdict,
        governanceExplanation: input.governanceExplanation,
        policyVersion: input.policyVersion,
        riskScore: input.riskScore,
        financialExposure: input.financialExposure,
        evidenceConfidence: input.evidenceConfidence,
        requestedByUserId: input.requestedByUserId,
        metadata: input.governanceVerdict !== 'BLOCKED' && input.actionProposal ? JSON.stringify({ actionProposal: input.actionProposal }) : null,
        expiresAt,
      },
    });

    // Record creation audit entry
    await prisma.executiveDecisionAudit.create({
      data: {
        decisionId: decision.id,
        organizationId: decision.organizationId,
        actorUserId: input.requestedByUserId,
        event: input.governanceVerdict === 'BLOCKED' ? 'GOVERNANCE_BLOCKED' : 'DECISION_CREATED',
        fromStatus: null,
        toStatus: initialStatus,
        reason: input.governanceVerdict === 'BLOCKED' 
          ? `Governance blocked: ${input.governanceExplanation}`
          : 'Generated from governed strategic recommendation.',
        policyVersion: input.policyVersion,
      },
    });


    return this.getDecision(decision.id, input.organizationId) as Promise<ExecutiveDecisionRecord>;
  }

  /**
   * Approves a pending/deferred decision after verifying authority and state machine rules.
   */
  static async approveDecision(
    decisionId: string,
    organizationId: string,
    input: ApproveDecisionInput
  ): Promise<{ decision: ExecutiveDecisionRecord; pendingActionId?: string }> {
    assertDatabaseWritesAllowed('approve executive decision');

    const decision = await prisma.executiveDecision.findFirst({
      where: { id: decisionId, organizationId },
    });

    if (!decision) {
      throw new Error(`Decision "${decisionId}" not found for organization.`);
    }

    // 1. State machine validation
    const transitionCheck = DecisionStateMachine.validateTransition(
      decision.status as any,
      'APPROVED',
      decision.governanceVerdict as any
    );
    if (!transitionCheck.valid) {
      throw new Error(transitionCheck.error || 'Invalid transition to APPROVED.');
    }

    // 2. Authority / RBAC validation
    const authorityCheck = DecisionAuthorityEvaluator.isAuthorized(
      input.userRole,
      decision.requiredAuthority as any
    );
    if (!authorityCheck.authorized) {
      throw new Error(authorityCheck.reason || 'Insufficient authority to approve decision.');
    }

    let stagedPendingActionId: string | undefined = undefined;

    // 3. Stage ActionEngine PendingAction if requested and action proposal exists
    if (input.stagePendingAction && decision.metadata) {
      try {
        const meta = JSON.parse(decision.metadata);
        if (meta.actionProposal) {
          const actionProposal = meta.actionProposal;

          // Find or create conversation for pending action
          let convId = input.conversationId;
          if (!convId) {
            const activeConv = await prisma.conversation.findFirst({
              where: { organizationId, userId: input.decidedByUserId },
            });
            if (activeConv) {
              convId = activeConv.id;
            } else {
              const newConv = await prisma.conversation.create({
                data: {
                  organizationId,
                  userId: input.decidedByUserId,
                  title: `Executive Decision: ${decision.title}`,
                },
              });
              convId = newConv.id;
            }
          }

          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const pendingAction = await prisma.pendingAction.create({
            data: {
              organizationId,
              actionName: actionProposal.actionName,
              humanDescription: `[Executive Decision] ${actionProposal.humanDescription || decision.title}`,
              actionArgs: JSON.stringify(actionProposal.actionArgs || {}),
              status: 'WAITING',
              actionType: actionProposal.riskLevel || 'MEDIUM',
              riskLevel: actionProposal.riskLevel || 'MEDIUM',
              requestingUserId: input.decidedByUserId,
              conversationId: convId,
              idempotencyKey: crypto.randomUUID(),
              expiresAt,
            },
          });

          if (pendingAction) {
            stagedPendingActionId = pendingAction.id;
          }
        }
      } catch (err) {
        console.warn('[DecisionOrchestrator] Warning: could not stage PendingAction:', err);
      }
    }


    // 4. Update Decision Record
    const updated = await prisma.executiveDecision.update({
      where: { id: decision.id },
      data: {
        status: 'APPROVED',
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        decisionReason: input.decisionReason || 'Approved by authorized decision-maker.',
        pendingActionId: stagedPendingActionId || decision.pendingActionId,
      },
    });

    // 5. Write Audit Entry
    await prisma.executiveDecisionAudit.create({
      data: {
        decisionId: decision.id,
        organizationId: decision.organizationId,
        actorUserId: input.decidedByUserId,
        event: 'DECISION_APPROVED',
        fromStatus: decision.status,
        toStatus: 'APPROVED',
        reason: input.decisionReason || 'Approved by authorized decision-maker.',
        policyVersion: decision.policyVersion,
        metadata: stagedPendingActionId ? JSON.stringify({ pendingActionId: stagedPendingActionId }) : null,
      },
    });

    const fullRecord = await this.getDecision(decision.id, organizationId);
    return {
      decision: fullRecord!,
      pendingActionId: stagedPendingActionId,
    };
  }

  /**
   * Rejects a decision.
   */
  static async rejectDecision(
    decisionId: string,
    organizationId: string,
    input: RejectDecisionInput
  ): Promise<ExecutiveDecisionRecord> {
    assertDatabaseWritesAllowed('reject executive decision');

    const decision = await prisma.executiveDecision.findFirst({
      where: { id: decisionId, organizationId },
    });

    if (!decision) {
      throw new Error(`Decision "${decisionId}" not found for organization.`);
    }

    const transitionCheck = DecisionStateMachine.validateTransition(
      decision.status as any,
      'REJECTED',
      decision.governanceVerdict as any
    );
    if (!transitionCheck.valid) {
      throw new Error(transitionCheck.error || 'Invalid transition to REJECTED.');
    }

    const authorityCheck = DecisionAuthorityEvaluator.isAuthorized(
      input.userRole,
      decision.requiredAuthority as any
    );
    if (!authorityCheck.authorized) {
      throw new Error(authorityCheck.reason || 'Insufficient authority to reject decision.');
    }

    await prisma.executiveDecision.update({
      where: { id: decision.id },
      data: {
        status: 'REJECTED',
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        decisionReason: input.rejectionReason,
      },
    });

    await prisma.executiveDecisionAudit.create({
      data: {
        decisionId: decision.id,
        organizationId: decision.organizationId,
        actorUserId: input.decidedByUserId,
        event: 'DECISION_REJECTED',
        fromStatus: decision.status,
        toStatus: 'REJECTED',
        reason: input.rejectionReason,
        policyVersion: decision.policyVersion,
      },
    });

    return (await this.getDecision(decision.id, organizationId))!;
  }

  /**
   * Defers a decision for future review or evidence collection.
   */
  static async deferDecision(
    decisionId: string,
    organizationId: string,
    input: DeferDecisionInput
  ): Promise<ExecutiveDecisionRecord> {
    assertDatabaseWritesAllowed('defer executive decision');

    const decision = await prisma.executiveDecision.findFirst({
      where: { id: decisionId, organizationId },
    });

    if (!decision) {
      throw new Error(`Decision "${decisionId}" not found for organization.`);
    }

    const transitionCheck = DecisionStateMachine.validateTransition(
      decision.status as any,
      'DEFERRED',
      decision.governanceVerdict as any
    );
    if (!transitionCheck.valid) {
      throw new Error(transitionCheck.error || 'Invalid transition to DEFERRED.');
    }

    const authorityCheck = DecisionAuthorityEvaluator.isAuthorized(
      input.userRole,
      decision.requiredAuthority as any
    );
    if (!authorityCheck.authorized) {
      throw new Error(authorityCheck.reason || 'Insufficient authority to defer decision.');
    }

    const expiresAt = input.deferUntil ? new Date(input.deferUntil) : decision.expiresAt;

    await prisma.executiveDecision.update({
      where: { id: decision.id },
      data: {
        status: 'DEFERRED',
        decisionReason: input.deferralReason,
        expiresAt,
      },
    });

    await prisma.executiveDecisionAudit.create({
      data: {
        decisionId: decision.id,
        organizationId: decision.organizationId,
        actorUserId: input.decidedByUserId,
        event: 'DECISION_DEFERRED',
        fromStatus: decision.status,
        toStatus: 'DEFERRED',
        reason: input.deferralReason,
        policyVersion: decision.policyVersion,
      },
    });

    return (await this.getDecision(decision.id, organizationId))!;
  }

  /**
   * Retrieves a decision with its full immutable audit history.
   */
  static async getDecision(
    decisionId: string,
    organizationId: string
  ): Promise<ExecutiveDecisionRecord | null> {
    const d = await prisma.executiveDecision.findFirst({
      where: { id: decisionId, organizationId },
      include: {
        auditHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!d) return null;

    return {
      id: d.id,
      organizationId: d.organizationId,
      strategyId: d.strategyId,
      recommendationId: d.recommendationId,
      pendingActionId: d.pendingActionId,
      title: d.title,
      description: d.description,
      domain: d.domain as any,
      decisionType: d.decisionType as any,
      status: d.status as any,
      priority: d.priority as any,
      requiredAuthority: d.requiredAuthority as any,
      governanceVerdict: d.governanceVerdict as any,
      governanceExplanation: d.governanceExplanation,
      policyVersion: d.policyVersion,
      riskScore: d.riskScore,
      financialExposure: d.financialExposure,
      evidenceConfidence: d.evidenceConfidence,
      requestedByUserId: d.requestedByUserId,
      decidedByUserId: d.decidedByUserId,
      decisionReason: d.decisionReason,
      metadata: d.metadata ? JSON.parse(d.metadata) : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      decidedAt: d.decidedAt,
      expiresAt: d.expiresAt,
      auditHistory: d.auditHistory.map((a) => ({
        id: a.id,
        decisionId: a.decisionId,
        organizationId: a.organizationId,
        actorUserId: a.actorUserId,
        event: a.event as any,
        fromStatus: a.fromStatus as any,
        toStatus: a.toStatus as any,
        reason: a.reason,
        policyVersion: a.policyVersion,
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Lists decisions for an organization with optional status and priority filtering.
   */
  static async listDecisions(
    organizationId: string,
    filters?: { status?: string; priority?: string; limit?: number }
  ): Promise<ExecutiveDecisionRecord[]> {
    const records = await prisma.executiveDecision.findMany({
      where: {
        organizationId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.priority ? { priority: filters.priority } : {}),
      },
      include: {
        auditHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });

    return records.map((d) => ({
      id: d.id,
      organizationId: d.organizationId,
      strategyId: d.strategyId,
      recommendationId: d.recommendationId,
      pendingActionId: d.pendingActionId,
      title: d.title,
      description: d.description,
      domain: d.domain as any,
      decisionType: d.decisionType as any,
      status: d.status as any,
      priority: d.priority as any,
      requiredAuthority: d.requiredAuthority as any,
      governanceVerdict: d.governanceVerdict as any,
      governanceExplanation: d.governanceExplanation,
      policyVersion: d.policyVersion,
      riskScore: d.riskScore,
      financialExposure: d.financialExposure,
      evidenceConfidence: d.evidenceConfidence,
      requestedByUserId: d.requestedByUserId,
      decidedByUserId: d.decidedByUserId,
      decisionReason: d.decisionReason,
      metadata: d.metadata ? JSON.parse(d.metadata) : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      decidedAt: d.decidedAt,
      expiresAt: d.expiresAt,
      auditHistory: d.auditHistory.map((a) => ({
        id: a.id,
        decisionId: a.decisionId,
        organizationId: a.organizationId,
        actorUserId: a.actorUserId,
        event: a.event as any,
        fromStatus: a.fromStatus as any,
        toStatus: a.toStatus as any,
        reason: a.reason,
        policyVersion: a.policyVersion,
        metadata: a.metadata ? JSON.parse(a.metadata) : null,
        createdAt: a.createdAt,
      })),
    }));
  }
}
