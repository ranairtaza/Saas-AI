import { prisma } from '../../../lib/db';
import { isDatabaseWritesAllowed } from '../../../lib/db-guard';
import { ExecutiveOperatingState } from './types';
import { BusinessContextBuilder } from '../context-builder';

export class ExecutiveOperatingSystemService {
  /**
   * Synthesizes the active business command loop state.
   * This is a read-only deterministic operation that aggregates existing intelligence.
   */
  static async getOperatingState(organizationId: string): Promise<ExecutiveOperatingState> {
    // 1. Fetch Business Context
    const businessContext = await BusinessContextBuilder.buildBusinessContext(organizationId);

    // 2. Fetch Active Governance Policy (Phase 27)
    const policy = await prisma.executiveGovernancePolicy.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch Active Decisions (Phase 28)
    const decisions = await prisma.executiveDecision.findMany({
      where: {
        organizationId,
        status: { in: ['PENDING', 'APPROVED', 'DEFERRED'] },
      },
      orderBy: { priority: 'desc' },
      take: 20,
    });

    // 4. Fetch Recent Learning Signals (Phase 29)
    const learningSignals = await prisma.executiveLearningSignal.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // 5. Fetch Active Forecasts (Phase 30)
    const forecasts = await prisma.executiveForecast.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // 6. Fetch Active Action Plans (Phase 31)
    const actionPlans = await prisma.executiveActionPlan.findMany({
      where: {
        organizationId,
        status: { in: ['PROPOSED', 'GOVERNANCE_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING'] },
      },
      orderBy: { priorityScore: 'desc' },
      take: 20,
    });

    // 7. Fetch Human-gated Pending Actions (Execution Boundary)
    const pendingActions = await prisma.pendingAction.findMany({
      where: {
        organizationId,
        status: 'WAITING',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 8. Fetch Recent Outcome Attributions (Phase 35)
    const recentOutcomeAttributions = await prisma.executiveOutcomeAttribution.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      organizationId,
      timestamp: new Date().toISOString(),
      businessContext,
      activeGovernancePolicy: policy
        ? {
            policyVersion: policy.policyVersion,
            riskTolerance: policy.riskTolerance,
            maxFinancialExposure: policy.maxFinancialExposure,
            restrictedDomains: JSON.parse(policy.restrictedDomains || '[]'),
            restrictedActions: JSON.parse(policy.restrictedActions || '[]'),
          }
        : null,
      activeDecisions: decisions.map((d) => ({
        id: d.id,
        title: d.title,
        domain: d.domain,
        decisionType: d.decisionType,
        status: d.status,
        priority: d.priority,
        governanceVerdict: d.governanceVerdict,
        createdAt: d.createdAt.toISOString(),
      })),
      recentLearningSignals: learningSignals.map((s) => ({
        id: s.id,
        domain: s.domain,
        metric: s.metric,
        varianceStatus: s.varianceStatus,
        effectiveness: s.effectiveness,
        confidence: s.confidence,
        hypothesisResult: s.hypothesisResult,
        createdAt: s.createdAt.toISOString(),
      })),
      activeForecasts: forecasts.map((f) => ({
        id: f.id,
        domain: f.domain,
        metric: f.metric,
        currentValue: f.currentValue,
        forecastValue: f.forecastValue,
        forecastHorizon: f.forecastHorizon,
        direction: f.direction,
        confidence: f.confidence,
        createdAt: f.createdAt.toISOString(),
      })),
      actionPlans: actionPlans.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        domain: a.domain,
        title: a.title,
        status: a.status,
        priority: a.priority,
        confidence: a.confidence,
        expectedImpact: a.expectedImpact,
        governanceVerdict: a.governanceVerdict,
        createdAt: a.createdAt.toISOString(),
      })),
      pendingActions: pendingActions.map((pa) => ({
        id: pa.id,
        actionName: pa.actionName,
        actionType: pa.actionType,
        status: pa.status,
        riskLevel: pa.riskLevel,
        createdAt: pa.createdAt.toISOString(),
      })),
      recentOutcomeAttributions: recentOutcomeAttributions.map((a) => ({
        id: a.id,
        attributionStatus: a.attributionStatus,
        confidence: a.confidence,
        targetMetric: a.targetMetric,
        actualDeltaValue: a.actualDeltaValue,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}
