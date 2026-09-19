import { prisma } from '../../../lib/db';
import { isDatabaseWritesAllowed } from '../../../lib/db-guard';
import { ExecutiveOperatingState } from './types';
import { BusinessContextBuilder } from '../context-builder';

interface CacheEntry {
  state: ExecutiveOperatingState;
  cachedAt: number;
}

const stateCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds TTL for fast deterministic dashboard loads

export function invalidateOperatingStateCache(organizationId?: string): void {
  if (organizationId) {
    stateCache.delete(organizationId);
  } else {
    stateCache.clear();
  }
}

export class ExecutiveOperatingSystemService {
  /**
   * Synthesizes the active business command loop state.
   * This is a read-only deterministic operation that aggregates existing intelligence.
   */
  static async getOperatingState(
    organizationId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ExecutiveOperatingState> {
    // Check in-memory org cache for sub-second deterministic retrieval
    if (!options?.forceRefresh) {
      const cached = stateCache.get(organizationId);
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.state;
      }
    }

    // Parallel fetch of all executive entities (eliminates sequential N+1 latency)
    const [
      businessContext,
      policy,
      decisions,
      learningSignals,
      forecasts,
      actionPlans,
      pendingActions,
      recentOutcomeAttributions,
    ] = await Promise.all([
      BusinessContextBuilder.buildBusinessContext(organizationId),
      prisma.executiveGovernancePolicy.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          policyVersion: true,
          riskTolerance: true,
          maxFinancialExposure: true,
          restrictedDomains: true,
          restrictedActions: true,
        },
      }).catch(() => null),
      prisma.executiveDecision.findMany({
        where: {
          organizationId,
          status: { in: ['PENDING', 'APPROVED', 'DEFERRED'] },
        },
        orderBy: { priority: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          domain: true,
          decisionType: true,
          status: true,
          priority: true,
          governanceVerdict: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.executiveLearningSignal.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          domain: true,
          metric: true,
          varianceStatus: true,
          effectiveness: true,
          confidence: true,
          hypothesisResult: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.executiveForecast.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          domain: true,
          metric: true,
          currentValue: true,
          forecastValue: true,
          forecastHorizon: true,
          direction: true,
          confidence: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.executiveActionPlan.findMany({
        where: {
          organizationId,
          status: { in: ['PROPOSED', 'GOVERNANCE_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING'] },
        },
        orderBy: { priorityScore: 'desc' },
        take: 20,
        select: {
          id: true,
          actionType: true,
          domain: true,
          title: true,
          status: true,
          priority: true,
          confidence: true,
          expectedImpact: true,
          governanceVerdict: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.pendingAction.findMany({
        where: {
          organizationId,
          status: 'WAITING',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          actionName: true,
          actionType: true,
          status: true,
          riskLevel: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.executiveOutcomeAttribution.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          attributionStatus: true,
          confidence: true,
          targetMetric: true,
          actualDeltaValue: true,
          createdAt: true,
        },
      }).catch(() => []),
    ]);

    const result: ExecutiveOperatingState = {
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

    if (stateCache.size >= 100) {
      const oldestKey = stateCache.keys().next().value;
      if (oldestKey) stateCache.delete(oldestKey);
    }
    stateCache.set(organizationId, { state: result, cachedAt: Date.now() });
    return result;
  }
}
