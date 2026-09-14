import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed } from '../../../lib/db-guard';
import { logAudit } from '../../../audit/logger';
import {
  ExecutiveOutcomeData,
  TelemetrySnapshot,
  HistoricalDecisionSummary,
  ExecutiveLearningSignal,
  HistoricalStrategyFeedback,
} from './types';
import { TelemetrySnapshotService } from './snapshot-service';
import { AttributionEngine } from './attribution-engine';
import { OutcomeEvaluator } from './evaluator';
import { ExecutiveMemoryService } from '../memory-service';

export class ExecutiveOutcomeService {
  /**
   * Initializes an ExecutiveOutcome in MEASURING state with an immutable beforeSnapshot.
   */
  static async initializeOutcome(
    organizationId: string,
    params: {
      recommendationId: string;
      decisionId?: string | null;
      pendingActionId?: string | null;
      domain?: string;
      targetKpiKey?: string | null;
      targetGoalId?: string | null;
      measurementWindowDays?: number;
      expectedValue?: number | null;
      beforeSnapshot?: TelemetrySnapshot;
      userId?: string;
    }
  ): Promise<ExecutiveOutcomeData> {
    assertDatabaseWritesAllowed('initialize executive outcome');

    // 1. Check for existing outcome to prevent duplicate initialization
    const existing = await prisma.executiveOutcome.findFirst({
      where: {
        organizationId,
        recommendationId: params.recommendationId,
      },
    });

    if (existing) {
      return {
        ...existing,
        beforeSnapshot: JSON.parse(existing.beforeSnapshot),
        afterSnapshot: existing.afterSnapshot ? JSON.parse(existing.afterSnapshot) : null,
      } as any;
    }

    // 2. Capture immutable beforeSnapshot
    const beforeSnapshot =
      params.beforeSnapshot || (await TelemetrySnapshotService.captureSnapshot(organizationId));

    const baselineValue = TelemetrySnapshotService.extractMetricValue(
      beforeSnapshot,
      params.targetKpiKey,
      params.targetGoalId
    );

    const windowDays = params.measurementWindowDays || 7;
    const startedAt = new Date();
    const evaluationDueAt = new Date(startedAt.getTime() + windowDays * 24 * 60 * 60 * 1000);

    // 3. Create outcome record
    const created = await prisma.executiveOutcome.create({
      data: {
        organizationId,
        recommendationId: params.recommendationId,
        decisionId: params.decisionId || null,
        pendingActionId: params.pendingActionId || null,
        domain: params.domain || 'REVENUE',
        targetKpiKey: params.targetKpiKey || null,
        targetGoalId: params.targetGoalId || null,
        status: 'MEASURING',
        measurementWindowDays: windowDays,
        expectedValue: params.expectedValue ?? null,
        startedAt,
        evaluationDueAt,
        beforeSnapshot: JSON.stringify(beforeSnapshot),
        baselineValue,
      },
    });

    // 4. Audit log
    await logAudit({
      organizationId,
      userId: params.userId || 'system',
      action: 'EXECUTIVE_OUTCOME_INITIALIZED',
      resource: `executiveOutcome:${created.id}`,
      status: 'SUCCESS',
      details: {
        recommendationId: params.recommendationId,
        decisionId: params.decisionId,
        pendingActionId: params.pendingActionId,
        windowDays,
        baselineValue,
        expectedValue: params.expectedValue,
      },
    });

    return {
      ...created,
      beforeSnapshot,
      afterSnapshot: null,
    } as any;
  }

  /**
   * Evaluates an outcome capturing afterSnapshot, computing deltas & variances, and creating ExecutiveMemory & LearningSignals.
   */
  static async evaluateOutcome(
    organizationId: string,
    outcomeId: string,
    options?: {
      afterSnapshot?: TelemetrySnapshot;
      isEarly?: boolean;
      userId?: string;
      confoundingFactors?: any[];
    }
  ): Promise<ExecutiveOutcomeData> {
    assertDatabaseWritesAllowed('evaluate executive outcome');

    const isEarly = options?.isEarly || false;
    const userId = options?.userId || 'system';

    // 1. Fetch outcome and related entities
    const outcome = await prisma.executiveOutcome.findFirst({
      where: { id: outcomeId, organizationId },
      include: {
        recommendation: true,
        pendingAction: true,
      },
    });

    if (!outcome) {
      throw new Error(`Executive outcome ${outcomeId} not found`);
    }

    if (outcome.status === 'MEASURED') {
      return {
        ...outcome,
        beforeSnapshot: JSON.parse(outcome.beforeSnapshot),
        afterSnapshot: outcome.afterSnapshot ? JSON.parse(outcome.afterSnapshot) : null,
      } as any;
    }

    const now = new Date();
    const isEarlyEvaluation = isEarly || now < outcome.evaluationDueAt;

    await logAudit({
      organizationId,
      userId: userId || 'system',
      action: 'EXECUTIVE_OUTCOME_EVALUATION_STARTED',
      resource: `executiveOutcome:${outcomeId}`,
      status: 'SUCCESS',
      details: { isEarly: isEarlyEvaluation, dueAt: outcome.evaluationDueAt.toISOString() },
    });

    // 2. Capture afterSnapshot
    const beforeSnapshot: TelemetrySnapshot = JSON.parse(outcome.beforeSnapshot);
    const afterSnapshot: TelemetrySnapshot =
      options?.afterSnapshot || (await TelemetrySnapshotService.captureSnapshot(organizationId));

    const finalValue = TelemetrySnapshotService.extractMetricValue(
      afterSnapshot,
      outcome.targetKpiKey,
      outcome.targetGoalId
    );
    const { deltaValue, deltaPercentage } = OutcomeEvaluator.calculateDelta(outcome.baselineValue, finalValue);

    let actionPlanId = null;
    if (outcome.decisionId) {
      const plan = await prisma.executiveActionPlan.findFirst({
        where: { decisionId: outcome.decisionId }
      });
      if (plan) actionPlanId = plan.id;
    }

    const attribution = await AttributionEngine.evaluateCausality({
      prisma,
      outcomeId: outcome.id,
      organizationId,
      decisionId: outcome.decisionId,
      actionPlanId,
      pendingActionId: outcome.pendingActionId,
      actionName: outcome.pendingAction?.actionName,
      targetKpiKey: outcome.targetKpiKey,
      baselineValue: outcome.baselineValue,
      finalValue,
      deltaValue,
      deltaPercentage,
      expectedImpactValue: outcome.expectedValue,
      confoundingFactors: options?.confoundingFactors,
    });

    // 3. Execute deterministic evaluation
    const evalResult = OutcomeEvaluator.evaluate({
      domain: outcome.domain,
      targetKpiKey: outcome.targetKpiKey,
      targetGoalId: outcome.targetGoalId,
      actionName: outcome.pendingAction?.actionName || null,
      expectedImpact: outcome.recommendation?.expectedImpact || null,
      expectedValue: outcome.expectedValue ?? null,
      beforeSnapshot,
      afterSnapshot,
      isEarlyEvaluation: isEarly,
      attributionLevel: attribution.level,
      attributionRationale: attribution.rationale,
    });
    // Override confidence based on strict attribution analysis
    evalResult.confidence = attribution.confidence;

    // 4. Synthesize Episodic Executive Memory Entry
    const recTitle = outcome.recommendation?.title || 'Executive Action';
    const memoryTitle = `[Outcome] ${recTitle}: ${evalResult.resultStatus}`;
    const memorySummary =
      evalResult.attributionLevel === 'DIRECT_CAUSAL'
        ? `Action directly resolved target metric from ${outcome.baselineValue} to ${evalResult.finalValue} (Δ ${evalResult.deltaPercentage}%).`
        : `Following ${recTitle}, target metric moved from ${outcome.baselineValue} to ${evalResult.finalValue} (Δ ${evalResult.deltaPercentage}%) with ${evalResult.attributionLevel} attribution.`;

    const memoryFacts = [
      `Baseline ${outcome.targetKpiKey || 'KPI'}: ${outcome.baselineValue}`,
      `Final ${outcome.targetKpiKey || 'KPI'}: ${evalResult.finalValue}`,
      `Metric Delta: ${evalResult.deltaValue} (${evalResult.deltaPercentage}%)`,
      `Expected: ${outcome.expectedValue ?? 'N/A'}, Actual: ${evalResult.finalValue}, Variance: ${evalResult.variance ?? 0}`,
      `Health Score Delta: ${evalResult.healthScoreDelta} pts`,
      `Attribution: ${evalResult.attributionLevel}`,
      `Hypothesis Validation: ${evalResult.hypothesisStatus}`,
      `Effectiveness: ${evalResult.effectivenessStatus || evalResult.resultStatus}`,
    ];

    const memoryObservations = [
      evalResult.attributionRationale,
      `Observed outcome classified as ${evalResult.resultStatus} with Decision Effectiveness Score ${evalResult.effectivenessScore}/100 and confidence ${evalResult.confidence || 'MEDIUM'}.`,
    ];

    const memoryCategory = outcome.domain === 'REVENUE' || outcome.domain === 'FINANCE' ? 'STRATEGY' : 'DECISION';

    const memoryEntry = await ExecutiveMemoryService.createMemory(organizationId, {
      category: memoryCategory,
      title: memoryTitle,
      summary: memorySummary,
      facts: memoryFacts,
      observations: memoryObservations,
      outcome: evalResult.resultStatus,
      sourceActionId: outcome.pendingActionId || undefined,
      userId,
    });

    // 5. Create Structured Learning Signal (Phase 29)
    await prisma.executiveLearningSignal.create({
      data: {
        organizationId,
        decisionId: outcome.decisionId,
        outcomeId: outcome.id,
        domain: outcome.domain,
        strategyKey: outcome.recommendation?.title || null,
        metric: outcome.targetKpiKey || 'business_health',
        expectedValue: evalResult.expectedValue ?? outcome.baselineValue,
        actualValue: evalResult.actualValue ?? evalResult.finalValue,
        variance: evalResult.variance ?? 0,
        variancePercentage: evalResult.variancePercentage ?? 0,
        varianceStatus: evalResult.varianceStatus ?? 'INCONCLUSIVE',
        effectiveness: evalResult.effectivenessStatus ?? 'INCONCLUSIVE',
        confidence: evalResult.confidence ?? 'MEDIUM',
        hypothesisResult: evalResult.hypothesisStatus,
        evidence: evalResult.attributionRationale,
      },
    });

    // 6. Update outcome record in database
    const updated = await prisma.executiveOutcome.update({
      where: { id: outcomeId },
      data: {
        status: 'MEASURED',
        afterSnapshot: JSON.stringify(afterSnapshot),
        finalValue: evalResult.finalValue,
        actualValue: evalResult.actualValue ?? evalResult.finalValue,
        deltaValue: evalResult.deltaValue,
        deltaPercentage: evalResult.deltaPercentage,
        variance: evalResult.variance ?? 0,
        variancePercentage: evalResult.variancePercentage ?? 0,
        varianceStatus: evalResult.varianceStatus ?? 'INCONCLUSIVE',
        confidence: evalResult.confidence ?? 'MEDIUM',
        effectivenessStatus: evalResult.effectivenessStatus ?? 'INCONCLUSIVE',
        healthScoreDelta: evalResult.healthScoreDelta,
        resultStatus: evalResult.resultStatus,
        attributionLevel: evalResult.attributionLevel,
        attributionRationale: evalResult.attributionRationale,
        hypothesisStatus: evalResult.hypothesisStatus,
        falsified: evalResult.falsified,
        effectivenessScore: evalResult.effectivenessScore,
        evaluatedAt: evalResult.evaluatedAt,
        executiveMemoryId: memoryEntry.id,
      },
    });

    // 7. Save the explicit attribution graph (Phase 35)
    await prisma.executiveOutcomeAttribution.create({
      data: {
        organizationId,
        outcomeId: outcome.id,
        decisionId: outcome.decisionId,
        actionPlanId,
        pendingActionId: outcome.pendingActionId,
        attributionStatus: evalResult.attributionLevel,
        confidence: evalResult.confidence || 'MEDIUM',
        targetMetric: outcome.targetKpiKey || 'business_health',
        baselineValue: outcome.baselineValue,
        expectedImpactValue: outcome.expectedValue,
        actualDeltaValue: evalResult.deltaValue,
        attributionRationale: evalResult.attributionRationale,
        confoundingFactors: options?.confoundingFactors ? JSON.stringify(options.confoundingFactors) : '[]',
      }
    });

    // 8. Log final audit records
    await logAudit({
      organizationId,
      userId: userId || 'system',
      action: 'EXECUTIVE_OUTCOME_EVALUATED',
      resource: `executiveOutcome:${outcomeId}`,
      status: 'SUCCESS',
      details: {
        resultStatus: evalResult.resultStatus,
        effectiveness: evalResult.effectivenessStatus,
        variance: evalResult.variance,
        attributionLevel: evalResult.attributionLevel,
        hypothesisStatus: evalResult.hypothesisStatus,
        effectivenessScore: evalResult.effectivenessScore,
        memoryId: memoryEntry.id,
      },
    });

    await logAudit({
      organizationId,
      userId: userId || 'system',
      action: 'EXECUTIVE_MEMORY_CREATED_FROM_OUTCOME',
      resource: `executiveMemory:${memoryEntry.id}`,
      status: 'SUCCESS',
      details: { outcomeId },
    });

    return {
      ...updated,
      beforeSnapshot,
      afterSnapshot,
    } as any;
  }

  /**
   * Retrieves an outcome by ID with tenant isolation.
   */
  static async getOutcome(organizationId: string, outcomeId: string): Promise<ExecutiveOutcomeData | null> {
    const outcome = await prisma.executiveOutcome.findFirst({
      where: { id: outcomeId, organizationId },
      include: {
        recommendation: true,
        pendingAction: true,
        executiveMemory: true,
      },
    });

    if (!outcome) return null;

    return {
      ...outcome,
      beforeSnapshot: JSON.parse(outcome.beforeSnapshot),
      afterSnapshot: outcome.afterSnapshot ? JSON.parse(outcome.afterSnapshot) : null,
    } as any;
  }

  /**
   * Lists outcomes for an organization with optional filters.
   */
  static async listOutcomes(
    organizationId: string,
    filters?: { status?: string; domain?: string; resultStatus?: string }
  ): Promise<ExecutiveOutcomeData[]> {
    const where: any = { organizationId };

    if (filters?.status) where.status = filters.status;
    if (filters?.domain) where.domain = filters.domain;
    if (filters?.resultStatus) where.resultStatus = filters.resultStatus;

    const outcomes = await prisma.executiveOutcome.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return outcomes.map((o) => ({
      ...o,
      beforeSnapshot: JSON.parse(o.beforeSnapshot),
      afterSnapshot: o.afterSnapshot ? JSON.parse(o.afterSnapshot) : null,
    })) as any;
  }

  /**
   * Lists structured learning signals for an organization (Phase 29).
   */
  static async listLearningSignals(
    organizationId: string,
    filters?: { domain?: string; varianceStatus?: string; effectiveness?: string }
  ): Promise<ExecutiveLearningSignal[]> {
    const where: any = { organizationId };

    if (filters?.domain) where.domain = filters.domain;
    if (filters?.varianceStatus) where.varianceStatus = filters.varianceStatus;
    if (filters?.effectiveness) where.effectiveness = filters.effectiveness;

    const signals = await prisma.executiveLearningSignal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return signals.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      decisionId: s.decisionId,
      outcomeId: s.outcomeId,
      domain: s.domain,
      strategyKey: s.strategyKey,
      metric: s.metric,
      expectedValue: s.expectedValue,
      actualValue: s.actualValue,
      variance: s.variance,
      variancePercentage: s.variancePercentage,
      varianceStatus: s.varianceStatus as any,
      effectiveness: s.effectiveness as any,
      confidence: s.confidence as any,
      hypothesisResult: s.hypothesisResult as any,
      evidence: s.evidence,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Retrieves historical feedback for a specific strategy to inform Phase 26 strategy synthesis.
   */
  static async getHistoricalStrategyFeedback(
    organizationId: string,
    domain: string,
    strategyKey: string
  ): Promise<HistoricalStrategyFeedback> {
    const signals = await prisma.executiveLearningSignal.findMany({
      where: {
        organizationId,
        domain,
        ...(strategyKey ? { strategyKey: { contains: strategyKey } } : {}),
      },
    });

    if (signals.length === 0) {
      return {
        strategyKey,
        domain,
        sampleCount: 0,
        historicalSuccessRate: 0,
        averageVariance: 0,
        recommendedConfidence: 'INSUFFICIENT',
        refutedHypothesisCount: 0,
        status: 'INSUFFICIENT_EVIDENCE',
      };
    }

    const sampleCount = signals.length;
    const successCount = signals.filter(
      (s) => s.effectiveness === 'SUCCESS' || s.effectiveness === 'PARTIAL_SUCCESS'
    ).length;
    const refutedCount = signals.filter((s) => s.hypothesisResult === 'REFUTED').length;
    const totalVariance = signals.reduce((sum, s) => sum + (s.variance ?? 0), 0);

    const historicalSuccessRate = Math.round((successCount / sampleCount) * 100);
    const averageVariance = Math.round((totalVariance / sampleCount) * 100) / 100;

    let status: 'HISTORICALLY_SUCCESSFUL' | 'HISTORICALLY_UNDERPERFORMED' | 'INSUFFICIENT_EVIDENCE' | 'NEUTRAL' = 'NEUTRAL';
    if (historicalSuccessRate >= 70 && sampleCount >= 2) {
      status = 'HISTORICALLY_SUCCESSFUL';
    } else if (historicalSuccessRate < 40 || refutedCount >= 2) {
      status = 'HISTORICALLY_UNDERPERFORMED';
    }

    let recommendedConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' = 'MEDIUM';
    if (sampleCount >= 3 && status === 'HISTORICALLY_SUCCESSFUL') {
      recommendedConfidence = 'HIGH';
    } else if (sampleCount === 1) {
      recommendedConfidence = 'LOW';
    }

    return {
      strategyKey,
      domain,
      sampleCount,
      historicalSuccessRate,
      averageVariance,
      recommendedConfidence,
      refutedHypothesisCount: refutedCount,
      status,
    };
  }

  /**
   * Retrieves outcomes that have passed their evaluationDueAt and are ready for measurement.
   */
  static async getDueOutcomes(organizationId: string): Promise<ExecutiveOutcomeData[]> {
    const now = new Date();
    const outcomes = await prisma.executiveOutcome.findMany({
      where: {
        organizationId,
        status: 'MEASURING',
        evaluationDueAt: { lte: now },
      },
    });

    return outcomes.map((o) => ({
      ...o,
      beforeSnapshot: JSON.parse(o.beforeSnapshot),
      afterSnapshot: o.afterSnapshot ? JSON.parse(o.afterSnapshot) : null,
    })) as any;
  }

  /**
   * Computes aggregated historical decision performance metrics and learning signals summary.
   */
  static async calculateOrganizationPerformance(
    organizationId: string
  ): Promise<HistoricalDecisionSummary> {
    const [recommendations, measuredOutcomes, learningSignals] = await Promise.all([
      prisma.executiveRecommendation.findMany({
        where: { organizationId },
      }),
      prisma.executiveOutcome.findMany({
        where: { organizationId, status: 'MEASURED' },
        include: { recommendation: true },
      }),
      prisma.executiveLearningSignal.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalRecommendations = recommendations.length;
    const totalExecuted = recommendations.filter(
      (r) => r.status === 'APPROVED' || r.status === 'PROPOSED'
    ).length;
    const totalMeasured = measuredOutcomes.length;

    let successCount = 0;
    let partialCount = 0;
    let supportedCount = 0;
    let refutedCount = 0;
    let totalHealthDelta = 0;

    const domainStats: Record<string, { total: number; successful: number; winRatePct: number }> = {};
    const validatedStrategies: string[] = [];
    const refutedHypotheses: string[] = [];

    for (const o of measuredOutcomes) {
      const dom = o.domain || 'REVENUE';
      if (!domainStats[dom]) {
        domainStats[dom] = { total: 0, successful: 0, winRatePct: 0 };
      }
      domainStats[dom].total += 1;

      if (o.resultStatus === 'SUCCESS') {
        successCount += 1;
        domainStats[dom].successful += 1;
        if (o.recommendation?.title && !validatedStrategies.includes(o.recommendation.title)) {
          validatedStrategies.push(o.recommendation.title);
        }
      } else if (o.resultStatus === 'PARTIAL') {
        partialCount += 1;
      }

      if (o.hypothesisStatus === 'SUPPORTED') {
        supportedCount += 1;
      } else if (o.hypothesisStatus === 'REFUTED') {
        refutedCount += 1;
        if (o.recommendation?.title && !refutedHypotheses.includes(o.recommendation.title)) {
          refutedHypotheses.push(o.recommendation.title);
        }
      }

      if (o.healthScoreDelta) {
        totalHealthDelta += o.healthScoreDelta;
      }
    }

    // Calculate domain win rates
    for (const dom of Object.keys(domainStats)) {
      const stats = domainStats[dom];
      stats.winRatePct =
        stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0;
    }

    const successRatePct =
      totalMeasured > 0
        ? Math.round(((successCount + 0.5 * partialCount) / totalMeasured) * 100)
        : 0;

    const avgHealthDelta = totalMeasured > 0 ? totalHealthDelta / totalMeasured : 0;

    const effectivenessScore = OutcomeEvaluator.calculateEffectivenessScore({
      totalRecommendations,
      totalExecuted,
      successCount,
      partialCount,
      totalMeasured,
      avgHealthScoreDelta: avgHealthDelta,
      supportedCount,
      refutedCount,
    });

    // Group strategy feedback by strategy title
    const strategyFeedbackMap: Record<string, { domain: string; count: number; successes: number; refuted: number; varianceSum: number }> = {};
    for (const signal of learningSignals) {
      const key = signal.strategyKey || 'General Strategy';
      if (!strategyFeedbackMap[key]) {
        strategyFeedbackMap[key] = {
          domain: signal.domain,
          count: 0,
          successes: 0,
          refuted: 0,
          varianceSum: 0,
        };
      }
      strategyFeedbackMap[key].count += 1;
      if (signal.effectiveness === 'SUCCESS' || signal.effectiveness === 'PARTIAL_SUCCESS') {
        strategyFeedbackMap[key].successes += 1;
      }
      if (signal.hypothesisResult === 'REFUTED') {
        strategyFeedbackMap[key].refuted += 1;
      }
      strategyFeedbackMap[key].varianceSum += (signal.variance ?? 0);
    }

    const strategyFeedback: HistoricalStrategyFeedback[] = Object.entries(strategyFeedbackMap).map(
      ([key, data]) => {
        const winRate = Math.round((data.successes / data.count) * 100);
        let status: 'HISTORICALLY_SUCCESSFUL' | 'HISTORICALLY_UNDERPERFORMED' | 'INSUFFICIENT_EVIDENCE' | 'NEUTRAL' = 'NEUTRAL';
        if (winRate >= 70 && data.count >= 2) status = 'HISTORICALLY_SUCCESSFUL';
        else if (winRate < 40 || data.refuted >= 2) status = 'HISTORICALLY_UNDERPERFORMED';

        let conf: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' = 'MEDIUM';
        if (data.count >= 3 && status === 'HISTORICALLY_SUCCESSFUL') conf = 'HIGH';
        else if (data.count === 1) conf = 'LOW';

        return {
          strategyKey: key,
          domain: data.domain,
          sampleCount: data.count,
          historicalSuccessRate: winRate,
          averageVariance: Math.round((data.varianceSum / data.count) * 100) / 100,
          recommendedConfidence: conf,
          refutedHypothesisCount: data.refuted,
          status,
        };
      }
    );

    return {
      totalRecommendations,
      totalExecuted,
      totalMeasured,
      successRatePct,
      effectivenessScore,
      domainPerformance: domainStats,
      topValidatedStrategies: validatedStrategies.slice(0, 5),
      refutedHypotheses: refutedHypotheses.slice(0, 5),
      learningSignalsCount: learningSignals.length,
      strategyFeedback: strategyFeedback.slice(0, 5),
    };
  }
}
