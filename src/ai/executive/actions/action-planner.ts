import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed } from '../../../lib/db-guard';
import { logAudit } from '../../../audit/logger';
import { hasPermission } from '../../../permissions/rbac';
import { PERMISSIONS } from '../../../permissions/definitions';
import {
  CreateActionPlanInput,
  ApproveActionPlanInput,
  RejectActionPlanInput,
  DeferActionPlanInput,
  ExecutiveActionPlanRecord,
  ActionPlanPriority,
  ActionPlanUrgency,
  ExecutiveActionType,
} from './types';
import { ActionPrioritizationEngine } from './prioritization-engine';
import { ActionImpactCalculator } from './impact-calculator';
import { ExecutiveGovernanceEngine } from '../governance/governance-engine';
import { GovernancePolicyService } from '../governance/policy-service';
import { GovernanceVerdict, ApprovalAuthority } from '../governance/types';
import { DecisionAuthorityEvaluator } from '../decisions/authority-evaluator';
import { DecisionAuthority } from '../decisions/types';
import { ForecastConfidence, ForecastHorizon } from '../forecasting/types';
import * as crypto from 'crypto';

export class ExecutiveActionPlanner {
  /**
   * Generates a canonical, business-semantic idempotency key:
   * SHA-256(organizationId + ':' + actionType + ':' + sourceSignalId + ':' + sourceForecastId + ':' + target + ':' + recommendationVersion)
   */
  static createCanonicalIdempotencyKey(params: {
    organizationId: string;
    actionType: string;
    sourceSignalId?: string | null;
    sourceForecastId?: string | null;
    target: string;
    recommendationVersion?: string;
  }): string {
    const version = params.recommendationVersion || 'v1';
    const signalId = params.sourceSignalId ? params.sourceSignalId.trim() : 'NONE';
    const forecastId = params.sourceForecastId ? params.sourceForecastId.trim() : 'NONE';
    const target = params.target.trim().toLowerCase();
    const actionType = params.actionType.trim().toUpperCase();
    const orgId = params.organizationId.trim();

    const canonicalIdentity = `${orgId}:${actionType}:${signalId}:${forecastId}:${target}:${version}`;
    return crypto.createHash('sha256').update(canonicalIdentity).digest('hex');
  }
  /**
   * Deterministically generates, governs, prioritizes, and persists candidate action plans.
   */
  static async planActions(organizationId: string, userId?: string): Promise<ExecutiveActionPlanRecord[]> {
    assertDatabaseWritesAllowed('plan executive actions');

    // 1. Fetch organizational governance policy
    const policy = await GovernancePolicyService.getPolicy(organizationId);

    // 2. Fetch latest telemetry & business metrics
    const [leads, unassignedLeads, forecasts, learningSignals, goals] = await Promise.all([
      prisma.lead.findMany({
        where: { organizationId },
        select: { id: true, status: true, score: true, companyName: true, contactName: true, createdAt: true },
        take: 100,
      }),
      prisma.lead.count({
        where: {
          organizationId,
          score: { gte: 70 },
          activities: { none: {} },
        },
      }),
      prisma.executiveForecast.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.executiveLearningSignal.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.businessGoal.findMany({
        where: { organizationId },
        select: { id: true, title: true, kpiKey: true, targetValue: true, currentValue: true, status: true },
      }),
    ]);

    const activeLeadsCount = leads.length;
    const qualifiedLeadsCount = leads.filter(l => (l.score || 0) >= 70).length;

    // Derived telemetry
    const revenueForecast = forecasts.find(f => f.domain === 'REVENUE');
    const pipelineForecast = forecasts.find(f => f.domain === 'PIPELINE');
    const opsForecast = forecasts.find(f => f.domain === 'OPERATIONS');

    const createdPlans: any[] = [];

    // --------------------------------------------------------------------------
    // CANDIDATE 1: Operational Backlog / Capacity Allocation
    // --------------------------------------------------------------------------
    if (unassignedLeads > 0 || (opsForecast && opsForecast.direction === 'INCREASING')) {
      const targetCount = unassignedLeads > 0 ? unassignedLeads : 5;
      const govEvaluation = ExecutiveGovernanceEngine.evaluateStrategy(
        {
          strategyId: `strat-ops-${organizationId}`,
          strategyName: 'Reallocate Capacity for Unassigned High-Priority Leads',
          domain: 'OPERATIONS',
          actionName: 'allocate_capacity',
          expectedImpact: 80,
          evidenceStrength: 85,
          riskScore: 25,
          confidence: 85,
          operationalPressure: targetCount > 10 ? 65 : 35,
          estimatedFinancialExposure: 0,
          alignedGoalKeys: goals.map(g => g.kpiKey),
          conflictingGoalKeys: [],
          hasActiveRefutedHypothesis: false,
          hasMissingEvidence: false,
        },
        policy
      );

      const impact = ActionImpactCalculator.calculateExpectedImpact({
        actionType: 'ALLOCATE_CAPACITY',
        domain: 'OPERATIONS',
        confidence: 'HIGH',
        currentMetricValue: targetCount,
        forecastMetricValue: 0,
        targetMetric: 'unassignedHighPriorityLeads',
        horizon: 'SHORT_TERM',
        telemetryEvidenceCount: leads.length,
      });

      const priorityRes = ActionPrioritizationEngine.calculatePriority({
        actionType: 'ALLOCATE_CAPACITY',
        urgency: targetCount >= 5 ? 'HIGH' : 'MEDIUM',
        riskLevel: 'LOW',
        confidence: 'HIGH',
        expectedCost: 0,
        isReversible: true,
        governanceVerdict: govEvaluation.verdict,
      });

      const idempotencyKey = this.createCanonicalIdempotencyKey({
        organizationId,
        actionType: 'ALLOCATE_CAPACITY',
        sourceSignalId: null,
        sourceForecastId: opsForecast?.id ?? null,
        target: 'unassigned_high_priority_leads',
        recommendationVersion: 'v1',
      });

      const plan = await this.upsertActionPlan({
        organizationId,
        forecastId: opsForecast?.id,
        actionType: 'ALLOCATE_CAPACITY',
        domain: 'OPERATIONS',
        title: `Allocate Sales Capacity for ${targetCount} High-Priority Leads`,
        description: `Immediately distribute ${targetCount} qualified prospects currently lacking assigned account executives.`,
        whyNow: `High-priority prospects experience conversion rate decay of up to 40% if uncontacted past 48 hours.`,
        evidence: [
          { sourceType: 'TELEMETRY', metric: 'unassignedHighPriorityLeads', detail: `${targetCount} qualified leads unassigned`, value: targetCount },
          ...(opsForecast ? [{ sourceType: 'FORECAST' as const, metric: opsForecast.metric, detail: `Ops forecast: ${opsForecast.forecastValue}` }] : []),
        ],
        expectedImpact: impact.expectedImpact,
        expectedMetricChange: impact.expectedMetricChange,
        targetMetric: impact.targetMetric,
        timeHorizon: impact.timeHorizon,
        expectedCost: 0,
        riskLevel: 'LOW',
        urgency: targetCount >= 5 ? 'HIGH' : 'MEDIUM',
        priority: priorityRes.priority,
        priorityScore: priorityRes.priorityScore,
        confidence: 'HIGH',
        governanceVerdict: govEvaluation.verdict,
        governanceExplanation: govEvaluation.explanation,
        requiredAuthority: govEvaluation.requiredApproval,
        status: govEvaluation.verdict === 'BLOCKED' ? 'BLOCKED' : 'PROPOSED',
        idempotencyKey,
        actionPayload: {
          targetTool: 'assign_lead',
          actionArgs: { count: targetCount, criteria: 'unassigned_high_score' },
          humanDescription: `Batch assign ${targetCount} high-priority leads to available sales reps`,
          riskLevel: 'LOW',
        },
      });

      createdPlans.push(plan);
    }

    // --------------------------------------------------------------------------
    // CANDIDATE 2: Pipeline Review & Deal Re-engagement
    // --------------------------------------------------------------------------
    const isPipelineRisk = pipelineForecast && (pipelineForecast.direction === 'DECREASING' || pipelineForecast.riskSignals.includes('PIPELINE_RISK'));
    if (isPipelineRisk || activeLeadsCount > 0) {
      const currentPipeline = pipelineForecast?.currentValue ?? (activeLeadsCount * 2500);
      const forecastPipeline = pipelineForecast?.forecastValue ?? (currentPipeline * 0.85);

      const govEvaluation = ExecutiveGovernanceEngine.evaluateStrategy(
        {
          strategyId: `strat-pipe-${organizationId}`,
          strategyName: 'Targeted Review of At-Risk Pipeline Deals',
          domain: 'PIPELINE',
          actionName: 'review_pipeline',
          expectedImpact: 75,
          evidenceStrength: 80,
          riskScore: 30,
          confidence: 80,
          operationalPressure: 40,
          estimatedFinancialExposure: 0,
          alignedGoalKeys: goals.map(g => g.kpiKey),
          conflictingGoalKeys: [],
          hasActiveRefutedHypothesis: false,
          hasMissingEvidence: false,
        },
        policy
      );

      const impact = ActionImpactCalculator.calculateExpectedImpact({
        actionType: 'REVIEW_PIPELINE',
        domain: 'PIPELINE',
        confidence: 'HIGH',
        currentMetricValue: currentPipeline,
        forecastMetricValue: forecastPipeline,
        targetMetric: 'pipelineValue',
        horizon: 'MEDIUM_TERM',
        telemetryEvidenceCount: leads.length,
      });

      const priorityRes = ActionPrioritizationEngine.calculatePriority({
        actionType: 'REVIEW_PIPELINE',
        urgency: isPipelineRisk ? 'HIGH' : 'MEDIUM',
        riskLevel: isPipelineRisk ? 'HIGH' : 'MEDIUM',
        confidence: 'HIGH',
        expectedCost: 0,
        isReversible: true,
        governanceVerdict: govEvaluation.verdict,
      });

      const idempotencyKey = this.createCanonicalIdempotencyKey({
        organizationId,
        actionType: 'REVIEW_PIPELINE',
        sourceSignalId: isPipelineRisk ? 'signal_pipeline_risk' : null,
        sourceForecastId: pipelineForecast?.id ?? null,
        target: 'pipeline_deal_stages',
        recommendationVersion: 'v1',
      });

      const plan = await this.upsertActionPlan({
        organizationId,
        forecastId: pipelineForecast?.id,
        actionType: 'REVIEW_PIPELINE',
        domain: 'PIPELINE',
        title: 'Conduct Pipeline Deal Re-engagement Review',
        description: 'Review stale pipeline opportunities with deal size exceeding $10,000 to identify stuck stages.',
        whyNow: isPipelineRisk
          ? 'Phase 30 predictive forecast indicates pipeline contraction over the 30-day horizon.'
          : 'Periodic pipeline velocity check to sustain quarterly revenue trajectory.',
        evidence: [
          { sourceType: 'TELEMETRY', metric: 'pipelineValue', detail: `Current pipeline valuation: $${currentPipeline.toLocaleString()}` },
          ...(pipelineForecast ? [{ sourceType: 'FORECAST' as const, metric: 'pipelineValue', detail: `Projected pipeline: $${forecastPipeline.toLocaleString()}` }] : []),
        ],
        expectedImpact: impact.expectedImpact,
        expectedMetricChange: impact.expectedMetricChange,
        targetMetric: impact.targetMetric,
        timeHorizon: impact.timeHorizon,
        expectedCost: 0,
        riskLevel: isPipelineRisk ? 'HIGH' : 'MEDIUM',
        urgency: isPipelineRisk ? 'HIGH' : 'MEDIUM',
        priority: priorityRes.priority,
        priorityScore: priorityRes.priorityScore,
        confidence: 'HIGH',
        governanceVerdict: govEvaluation.verdict,
        governanceExplanation: govEvaluation.explanation,
        requiredAuthority: govEvaluation.requiredApproval,
        status: govEvaluation.verdict === 'BLOCKED' ? 'BLOCKED' : 'PROPOSED',
        idempotencyKey,
        actionPayload: {
          targetTool: 'audit_pipeline',
          actionArgs: { minDealValue: 10000, stageFilter: 'STALLED' },
          humanDescription: 'Generate executive pipeline health audit across stalled deals',
          riskLevel: 'LOW',
        },
      });

      createdPlans.push(plan);
    }

    // --------------------------------------------------------------------------
    // CANDIDATE 3: Revenue Protection / Strategic Intervention
    // --------------------------------------------------------------------------
    const revenueGoal = goals.find(g => g.kpiKey.toLowerCase().includes('revenue'));
    const isRevenueAtRisk = revenueForecast?.direction === 'DECREASING' || (revenueGoal && revenueGoal.status === 'AT_RISK');

    if (isRevenueAtRisk) {
      const currentRev = revenueForecast?.currentValue ?? revenueGoal?.currentValue ?? 50000;
      const forecastRev = revenueForecast?.forecastValue ?? (currentRev * 0.85);

      const govEvaluation = ExecutiveGovernanceEngine.evaluateStrategy(
        {
          strategyId: `strat-rev-${organizationId}`,
          strategyName: 'Investigate Revenue Gap & Optimize Conversion Channels',
          domain: 'REVENUE',
          actionName: 'investigate_revenue',
          expectedImpact: 85,
          evidenceStrength: 75,
          riskScore: 45,
          confidence: 75,
          operationalPressure: 55,
          estimatedFinancialExposure: 0,
          alignedGoalKeys: revenueGoal ? [revenueGoal.kpiKey] : [],
          conflictingGoalKeys: [],
          hasActiveRefutedHypothesis: false,
          hasMissingEvidence: false,
        },
        policy
      );

      const impact = ActionImpactCalculator.calculateExpectedImpact({
        actionType: 'INVESTIGATE_REVENUE_DROP',
        domain: 'REVENUE',
        confidence: 'HIGH',
        currentMetricValue: currentRev,
        forecastMetricValue: forecastRev,
        targetMetric: 'revenueMTD',
        horizon: 'MEDIUM_TERM',
        telemetryEvidenceCount: leads.length,
      });

      const priorityRes = ActionPrioritizationEngine.calculatePriority({
        actionType: 'INVESTIGATE_REVENUE_DROP',
        urgency: 'HIGH',
        riskLevel: 'HIGH',
        confidence: 'HIGH',
        expectedCost: 0,
        isReversible: true,
        governanceVerdict: govEvaluation.verdict,
      });

      const idempotencyKey = this.createCanonicalIdempotencyKey({
        organizationId,
        actionType: 'INVESTIGATE_REVENUE_DROP',
        sourceSignalId: isRevenueAtRisk ? 'signal_revenue_at_risk' : null,
        sourceForecastId: revenueForecast?.id ?? null,
        target: 'revenue_shortfall_trajectory',
        recommendationVersion: 'v1',
      });

      const plan = await this.upsertActionPlan({
        organizationId,
        forecastId: revenueForecast?.id,
        actionType: 'INVESTIGATE_REVENUE_DROP',
        domain: 'REVENUE',
        title: 'Investigate Revenue Shortfall Trajectory',
        description: 'Execute deep-dive diagnostic on conversion drop-offs and customer renewal pacing.',
        whyNow: 'Monthly revenue pacing is lagging target milestones with projected 15% shortfall.',
        evidence: [
          { sourceType: 'TELEMETRY', metric: 'revenueMTD', detail: `Current revenue: $${currentRev.toLocaleString()}` },
          ...(revenueForecast ? [{ sourceType: 'FORECAST' as const, metric: 'revenueMTD', detail: `Forecast revenue: $${forecastRev.toLocaleString()}` }] : []),
        ],
        expectedImpact: impact.expectedImpact,
        expectedMetricChange: impact.expectedMetricChange,
        targetMetric: impact.targetMetric,
        timeHorizon: impact.timeHorizon,
        expectedCost: 0,
        riskLevel: 'HIGH',
        urgency: 'HIGH',
        priority: priorityRes.priority,
        priorityScore: priorityRes.priorityScore,
        confidence: 'HIGH',
        governanceVerdict: govEvaluation.verdict,
        governanceExplanation: govEvaluation.explanation,
        requiredAuthority: govEvaluation.requiredApproval,
        status: govEvaluation.verdict === 'BLOCKED' ? 'BLOCKED' : 'PROPOSED',
        idempotencyKey,
        actionPayload: {
          targetTool: 'revenue_diagnostic',
          actionArgs: { varianceThreshold: 0.15 },
          humanDescription: 'Compile comprehensive revenue variance diagnosis',
          riskLevel: 'MEDIUM',
        },
      });

      createdPlans.push(plan);
    }

    // Log proposal audit
    if (userId && createdPlans.length > 0) {
      await logAudit({
        organizationId,
        userId,
        action: 'EXECUTIVE_ACTION_PLAN_CREATED',
        resource: `actionPlans:${createdPlans.length}`,
        status: 'SUCCESS',
        details: { count: createdPlans.length },
      });
    }

    return this.listActionPlans(organizationId);
  }

  /**
   * Helper to upsert an action plan deterministically by idempotency key.
   */
  private static async upsertActionPlan(input: CreateActionPlanInput): Promise<any> {
    const existing = await prisma.executiveActionPlan.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    const expiresAt = new Date(Date.now() + (input.expiresInDays || 7) * 24 * 60 * 60 * 1000);
    const evidenceStr = JSON.stringify(input.evidence || []);
    const actionPayloadStr = input.actionPayload ? JSON.stringify(input.actionPayload) : null;
    const dependenciesStr = JSON.stringify(input.dependencies || []);

    if (existing) {
      // Do not overwrite human decision if already decided
      if (['APPROVED', 'REJECTED', 'DEFERRED', 'EXECUTING', 'COMPLETED'].includes(existing.status)) {
        return existing;
      }

      return prisma.executiveActionPlan.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description,
          whyNow: input.whyNow,
          evidence: evidenceStr,
          expectedImpact: input.expectedImpact,
          expectedMetricChange: input.expectedMetricChange,
          targetMetric: input.targetMetric,
          timeHorizon: input.timeHorizon,
          riskLevel: input.riskLevel,
          urgency: input.urgency,
          priority: input.priority || existing.priority,
          priorityScore: input.priorityScore ?? existing.priorityScore,
          confidence: input.confidence,
          governanceVerdict: input.governanceVerdict,
          governanceExplanation: input.governanceExplanation,
          requiredAuthority: input.requiredAuthority,
          status: input.governanceVerdict === 'BLOCKED' ? 'BLOCKED' : existing.status,
          actionPayload: actionPayloadStr,
          expiresAt,
        },
      });
    }

    return prisma.executiveActionPlan.create({
      data: {
        organizationId: input.organizationId,
        decisionId: input.decisionId,
        forecastId: input.forecastId,
        learningSignalId: input.learningSignalId,
        actionType: input.actionType,
        domain: input.domain,
        title: input.title,
        description: input.description,
        whyNow: input.whyNow,
        evidence: evidenceStr,
        expectedImpact: input.expectedImpact,
        expectedMetricChange: input.expectedMetricChange,
        targetMetric: input.targetMetric,
        timeHorizon: input.timeHorizon || 'MEDIUM_TERM',
        expectedCost: input.expectedCost || 0.0,
        riskLevel: input.riskLevel,
        urgency: input.urgency,
        priority: input.priority || 'MEDIUM',
        priorityScore: input.priorityScore ?? 50,
        confidence: input.confidence,
        governanceVerdict: input.governanceVerdict,
        governanceExplanation: input.governanceExplanation,
        requiredAuthority: input.requiredAuthority,
        status: input.governanceVerdict === 'BLOCKED' ? 'BLOCKED' : input.status,
        idempotencyKey: input.idempotencyKey,
        dependencies: dependenciesStr,
        actionPayload: actionPayloadStr,
        expiresAt,
      },
    });
  }

  /**
   * Retrieves action plans with strict tenant isolation and optional filtering.
   */
  static async listActionPlans(
    organizationId: string,
    filters?: { status?: string; priority?: string; domain?: string; limit?: number }
  ): Promise<ExecutiveActionPlanRecord[]> {
    const where: any = { organizationId };

    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.domain) where.domain = filters.domain;

    const plans = await prisma.executiveActionPlan.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      take: filters?.limit || 50,
    });

    return plans as ExecutiveActionPlanRecord[];
  }

  /**
   * Retrieves a single action plan with tenant isolation.
   */
  static async getActionPlan(id: string, organizationId: string): Promise<ExecutiveActionPlanRecord | null> {
    const plan = await prisma.executiveActionPlan.findFirst({
      where: { id, organizationId },
    });
    return plan as ExecutiveActionPlanRecord | null;
  }

  /**
   * Approves an action plan with RBAC authority enforcement and stages ActionEngine PendingAction.
   */
  static async approveActionPlan(
    id: string,
    organizationId: string,
    input: ApproveActionPlanInput
  ): Promise<{ plan: ExecutiveActionPlanRecord; pendingActionId?: string }> {
    assertDatabaseWritesAllowed('approve executive action plan');

    const plan = await prisma.executiveActionPlan.findFirst({
      where: { id, organizationId },
    });

    if (!plan) {
      throw new Error(`Action plan "${id}" not found for organization.`);
    }

    // 1. Governance BLOCKED invariant
    if (plan.governanceVerdict === 'BLOCKED') {
      throw new Error(`Action plan is BLOCKED by organizational governance policy: ${plan.governanceExplanation}`);
    }

    // 2. State machine invariant
    if (['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'BLOCKED'].includes(plan.status)) {
      throw new Error(`Cannot approve action plan in current status: "${plan.status}".`);
    }

    // 3. RBAC & Authority verification via Phase 28 DecisionAuthorityEvaluator
    const requiredAuthority = (plan.requiredAuthority as DecisionAuthority) || 'MANAGER';
    const authCheck = DecisionAuthorityEvaluator.isAuthorized(input.userRole, requiredAuthority);
    if (!authCheck.authorized) {
      throw new Error(authCheck.reason || `User role "${input.userRole}" lacks authority "${requiredAuthority}" to approve executive action plans.`);
    }

    let stagedPendingActionId: string | undefined = undefined;

    // 4. Stage ActionEngine PendingAction if requested and payload exists
    if (input.stagePendingAction && plan.actionPayload) {
      try {
        const payload = JSON.parse(plan.actionPayload);
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
                title: `Action Plan: ${plan.title}`,
              },
            });
            convId = newConv.id;
          }
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const pendingAction = await prisma.pendingAction.create({
          data: {
            organizationId,
            actionName: payload.targetTool || 'execute_action_plan',
            humanDescription: `[Executive Action Plan] ${payload.humanDescription || plan.title}`,
            actionArgs: JSON.stringify(payload.actionArgs || {}),
            status: 'WAITING',
            actionType: payload.riskLevel || plan.riskLevel || 'MEDIUM',
            riskLevel: payload.riskLevel || plan.riskLevel || 'MEDIUM',
            requestingUserId: input.decidedByUserId,
            conversationId: convId,
            idempotencyKey: crypto.randomUUID(),
            expiresAt,
          },
        });

        if (pendingAction) {
          stagedPendingActionId = pendingAction.id;

          await logAudit({
            organizationId,
            userId: input.decidedByUserId,
            action: 'EXECUTIVE_ACTION_PLAN_STAGED',
            resource: `pendingAction:${pendingAction.id}`,
            status: 'SUCCESS',
            details: { actionPlanId: plan.id, tool: payload.targetTool },
          });
        }
      } catch (err) {
        console.warn('[ExecutiveActionPlanner] Warning: could not stage ActionEngine PendingAction:', err);
      }
    }

    // 5. Update Action Plan status
    const updated = await prisma.executiveActionPlan.update({
      where: { id: plan.id },
      data: {
        status: 'APPROVED',
        approvedByUserId: input.decidedByUserId,
        approvedAt: new Date(),
        pendingActionId: stagedPendingActionId || plan.pendingActionId,
      },
    });

    // 6. Audit log
    await logAudit({
      organizationId,
      userId: input.decidedByUserId,
      action: 'EXECUTIVE_ACTION_PLAN_APPROVED',
      resource: `actionPlan:${plan.id}`,
      status: 'SUCCESS',
      details: {
        reason: input.approvalReason,
        stagedPendingActionId,
      },
    });

    return {
      plan: updated as ExecutiveActionPlanRecord,
      pendingActionId: stagedPendingActionId,
    };
  }

  /**
   * Rejects an action plan with required reason.
   */
  static async rejectActionPlan(
    id: string,
    organizationId: string,
    input: RejectActionPlanInput
  ): Promise<ExecutiveActionPlanRecord> {
    assertDatabaseWritesAllowed('reject executive action plan');

    const plan = await prisma.executiveActionPlan.findFirst({
      where: { id, organizationId },
    });

    if (!plan) {
      throw new Error(`Action plan "${id}" not found for organization.`);
    }

    if (input.userRole === 'READ_ONLY') {
      throw new Error('READ_ONLY role cannot reject action plans.');
    }

    const updated = await prisma.executiveActionPlan.update({
      where: { id: plan.id },
      data: {
        status: 'REJECTED',
        rejectionReason: input.rejectionReason,
      },
    });

    await logAudit({
      organizationId,
      userId: input.decidedByUserId,
      action: 'EXECUTIVE_ACTION_PLAN_REJECTED',
      resource: `actionPlan:${plan.id}`,
      status: 'SUCCESS',
      details: { reason: input.rejectionReason },
    });

    return updated as ExecutiveActionPlanRecord;
  }

  /**
   * Defers an action plan for future evaluation.
   */
  static async deferActionPlan(
    id: string,
    organizationId: string,
    input: DeferActionPlanInput
  ): Promise<ExecutiveActionPlanRecord> {
    assertDatabaseWritesAllowed('defer executive action plan');

    const plan = await prisma.executiveActionPlan.findFirst({
      where: { id, organizationId },
    });

    if (!plan) {
      throw new Error(`Action plan "${id}" not found for organization.`);
    }

    const updated = await prisma.executiveActionPlan.update({
      where: { id: plan.id },
      data: {
        status: 'DEFERRED',
      },
    });

    await logAudit({
      organizationId,
      userId: input.decidedByUserId,
      action: 'EXECUTIVE_ACTION_PLAN_DEFERRED',
      resource: `actionPlan:${plan.id}`,
      status: 'SUCCESS',
      details: { reason: input.deferralReason },
    });

    return updated as ExecutiveActionPlanRecord;
  }

  /**
   * Generates summary statistics for the Executive Command Center Action Queue.
   */
  static async getActionQueueSummary(organizationId: string): Promise<any> {
    const plans = await prisma.executiveActionPlan.findMany({
      where: { organizationId },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
    });

    const proposedCount = plans.filter(p => p.status === 'PROPOSED').length;
    const pendingApprovalCount = plans.filter(p => p.status === 'PENDING_APPROVAL' || p.status === 'PROPOSED').length;
    const approvedCount = plans.filter(p => p.status === 'APPROVED').length;
    const blockedCount = plans.filter(p => p.status === 'BLOCKED' || p.governanceVerdict === 'BLOCKED').length;

    const criticalCount = plans.filter(p => p.priority === 'CRITICAL').length;
    const highCount = plans.filter(p => p.priority === 'HIGH').length;
    const mediumCount = plans.filter(p => p.priority === 'MEDIUM').length;
    const lowCount = plans.filter(p => p.priority === 'LOW').length;

    const topPriorities = plans
      .filter(p => p.status === 'PROPOSED' || p.status === 'PENDING_APPROVAL')
      .slice(0, 5);

    return {
      totalActions: plans.length,
      proposedCount,
      pendingApprovalCount,
      approvedCount,
      blockedCount,
      priorityBreakdown: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
      },
      topPriorities,
    };
  }
}
