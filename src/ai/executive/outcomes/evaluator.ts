import {
  TelemetrySnapshot,
  OutcomeResultStatus,
  AttributionLevel,
  HypothesisValidationStatus,
  OutcomeEvaluation,
  VarianceStatus,
  OutcomeConfidence,
  DecisionEffectiveness,
} from './types';
import { TelemetrySnapshotService } from './snapshot-service';

export interface EvaluationInput {
  domain: string;
  targetKpiKey?: string | null;
  targetGoalId?: string | null;
  actionName?: string | null;
  expectedImpact?: string | null;
  expectedValue?: number | null;
  beforeSnapshot: TelemetrySnapshot;
  afterSnapshot: TelemetrySnapshot;
  isEarlyEvaluation?: boolean;
  attributionLevel: AttributionLevel;
  attributionRationale: string;
}

export class OutcomeEvaluator {
  /**
   * Deterministically calculates numerical delta and percentage delta.
   */
  static calculateDelta(
    baselineValue: number | null,
    finalValue: number | null
  ): { deltaValue: number | null; deltaPercentage: number | null } {
    if (baselineValue === null || finalValue === null) {
      return { deltaValue: null, deltaPercentage: null };
    }
    const deltaValue = Math.round((finalValue - baselineValue) * 100) / 100;

    let deltaPercentage = 0;
    if (baselineValue === 0) {
      deltaPercentage = finalValue === 0 ? 0 : 100;
    } else {
      deltaPercentage = Math.round(((deltaValue / Math.abs(baselineValue)) * 100) * 100) / 100;
    }

    return { deltaValue, deltaPercentage };
  }

  /**
   * Phase 29: Deterministically calculates numerical variance between expected and actual outcomes.
   *
   * Formula:
   * For increasing metrics: variance = actualValue - expectedValue
   * For decreasing metrics (e.g. backlog, churn, response time): variance = expectedValue - actualValue
   */
  static calculateVariance(
    expectedValue?: number | null,
    actualValue?: number | null,
    isDecreasingMetric: boolean = false
  ): { variance: number; variancePercentage: number; varianceStatus: VarianceStatus } {
    if (
      expectedValue === undefined ||
      expectedValue === null ||
      isNaN(expectedValue) ||
      actualValue === undefined ||
      actualValue === null ||
      isNaN(actualValue)
    ) {
      return { variance: 0, variancePercentage: 0, varianceStatus: 'INCONCLUSIVE' };
    }

    const rawVariance = isDecreasingMetric
      ? expectedValue - actualValue
      : actualValue - expectedValue;

    const variance = Math.round(rawVariance * 100) / 100;

    let variancePercentage = 0;
    if (expectedValue === 0) {
      variancePercentage = actualValue === 0 ? 0 : 100;
    } else {
      variancePercentage = Math.round(((rawVariance / Math.abs(expectedValue)) * 100) * 100) / 100;
    }

    let varianceStatus: VarianceStatus = 'NEUTRAL';
    if (variance > 0) {
      varianceStatus = 'POSITIVE';
    } else if (variance < 0) {
      varianceStatus = 'NEGATIVE';
    }

    return { variance, variancePercentage, varianceStatus };
  }

  /**
   * Phase 29: Evaluates outcome confidence based on evidence completeness and attribution.
   */
  static evaluateConfidence(params: {
    dataCompletenessPct?: number;
    sampleCount?: number;
    attributionLevel: AttributionLevel;
  }): OutcomeConfidence {
    const completeness = params.dataCompletenessPct ?? 100;
    const count = params.sampleCount ?? 1;

    if (completeness < 50 || count === 0) {
      return 'INSUFFICIENT';
    }

    if (completeness >= 80 && params.attributionLevel === 'DIRECT_CAUSAL') {
      return 'HIGH';
    }

    if (
      completeness >= 65 &&
      (params.attributionLevel === 'CORRELATED' || params.attributionLevel === 'DIRECT_CAUSAL')
    ) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Phase 29: Deterministically classifies decision effectiveness.
   */
  static classifyEffectiveness(params: {
    varianceStatus: VarianceStatus;
    variancePercentage: number;
    resultStatus: OutcomeResultStatus;
    attributionLevel: AttributionLevel;
    hasSufficientEvidence: boolean;
  }): DecisionEffectiveness {
    if (!params.hasSufficientEvidence || params.varianceStatus === 'INCONCLUSIVE') {
      return 'INCONCLUSIVE';
    }

    if (params.resultStatus === 'SUCCESS') {
      if (params.varianceStatus === 'POSITIVE' || params.variancePercentage >= 0) {
        return 'SUCCESS';
      }
      return 'PARTIAL_SUCCESS';
    }

    if (params.resultStatus === 'PARTIAL') {
      if (params.variancePercentage >= -15) {
        return 'PARTIAL_SUCCESS';
      }
      return 'UNDERPERFORMED';
    }

    if (params.resultStatus === 'NEUTRAL' || Math.abs(params.variancePercentage) <= 2) {
      return 'NEUTRAL';
    }

    if (params.resultStatus === 'NEGATIVE') {
      return 'FAILED';
    }

    return 'INCONCLUSIVE';
  }

  /**
   * Classifies outcome result status based on pure deterministic rules.
   */
  static classifyResult(params: {
    kpiKey?: string | null;
    baselineValue: number | null;
    finalValue: number | null;
    deltaValue: number | null;
    deltaPercentage: number | null;
    healthScoreDelta: number | null;
  }): OutcomeResultStatus {
    if (params.baselineValue === null || params.finalValue === null || params.deltaValue === null || params.deltaPercentage === null || params.healthScoreDelta === null) {
      return 'INCONCLUSIVE';
    }
    const key = (params.kpiKey || '').toLowerCase();
    const isDecreasingMetric =
      key === 'unassigned_leads' ||
      key === 'unassigned_high_priority_leads' ||
      key === 'unassigned' ||
      key === 'response_time' ||
      key === 'churn_rate';

    if (isDecreasingMetric) {
      if (params.finalValue === 0 || params.deltaValue <= -params.baselineValue * 0.5) {
        return 'SUCCESS';
      }
      if (params.deltaValue < 0) {
        return 'PARTIAL';
      }
      if (params.deltaValue === 0) {
        return 'NEUTRAL';
      }
      return 'NEGATIVE';
    }

    // Increasing metric (revenue, pipeline, qualified leads, health score, etc.)
    if (params.deltaPercentage >= 10 || params.healthScoreDelta >= 10) {
      return 'SUCCESS';
    }
    if (params.deltaPercentage > 0 || params.healthScoreDelta > 0) {
      return 'PARTIAL';
    }
    if (params.deltaPercentage === 0 && params.healthScoreDelta === 0) {
      return 'NEUTRAL';
    }
    if (params.deltaPercentage < 0 || params.healthScoreDelta < 0) {
      return 'NEGATIVE';
    }

    return 'INCONCLUSIVE';
  }



  /**
   * Evaluates original hypothesis validity against observed outcome and attribution.
   */
  static evaluateHypothesis(params: {
    resultStatus: OutcomeResultStatus;
    attributionLevel: AttributionLevel;
  }): { status: HypothesisValidationStatus; falsified: boolean } {
    if (params.resultStatus === 'SUCCESS' && params.attributionLevel === 'DIRECT_CAUSAL') {
      return { status: 'SUPPORTED', falsified: false };
    }

    if (
      (params.resultStatus === 'SUCCESS' && params.attributionLevel === 'CORRELATED') ||
      (params.resultStatus === 'PARTIAL' && (params.attributionLevel === 'DIRECT_CAUSAL' || params.attributionLevel === 'CORRELATED'))
    ) {
      return { status: 'PARTIALLY_SUPPORTED', falsified: false };
    }

    if (params.resultStatus === 'NEGATIVE') {
      return { status: 'REFUTED', falsified: true };
    }

    return { status: 'INCONCLUSIVE', falsified: false };
  }

  /**
   * Deterministically calculates the organization Decision Effectiveness Score (0–100).
   *
   * Formula:
   * (Execution Rate * 0.20) + (Outcome Win Rate * 0.50) + (Health Delta Factor * 0.20) + (Hypothesis Precision * 0.10)
   */
  static calculateEffectivenessScore(params: {
    totalRecommendations: number;
    totalExecuted: number;
    successCount: number;
    partialCount: number;
    totalMeasured: number;
    avgHealthScoreDelta: number;
    supportedCount: number;
    refutedCount: number;
  }): number {
    // 1. Execution Rate (0-100)
    const executionRate =
      params.totalRecommendations > 0
        ? Math.min(100, (params.totalExecuted / params.totalRecommendations) * 100)
        : 100;

    // 2. Outcome Win Rate (0-100)
    const winRate =
      params.totalMeasured > 0
        ? Math.min(
            100,
            ((params.successCount + 0.5 * params.partialCount) / params.totalMeasured) * 100
          )
        : 50;

    // 3. Health Score Delta Factor (0-100)
    // Baseline 50 pts at 0 delta; +2.5 pts per +1 health delta; -2.5 pts per -1 delta
    const healthDeltaFactor = Math.min(
      100,
      Math.max(0, 50 + params.avgHealthScoreDelta * 2.5)
    );

    // 4. Hypothesis Precision (0-100)
    const totalRatedHypotheses = params.supportedCount + params.refutedCount;
    const hypothesisPrecision =
      totalRatedHypotheses > 0
        ? (params.supportedCount / totalRatedHypotheses) * 100
        : 50;

    const composite =
      executionRate * 0.2 +
      winRate * 0.5 +
      healthDeltaFactor * 0.2 +
      hypothesisPrecision * 0.1;

    return Math.round(Math.min(100, Math.max(0, composite)));
  }

  /**
   * Executes a full deterministic outcome evaluation.
   */
  static evaluate(input: EvaluationInput): OutcomeEvaluation {
    const baselineValue = TelemetrySnapshotService.extractMetricValue(
      input.beforeSnapshot,
      input.targetKpiKey,
      input.targetGoalId
    );

    const finalValue = TelemetrySnapshotService.extractMetricValue(
      input.afterSnapshot,
      input.targetKpiKey,
      input.targetGoalId
    );

    const { deltaValue, deltaPercentage } = this.calculateDelta(baselineValue, finalValue);
    const healthScoreDelta =
      input.afterSnapshot.businessHealthScore - input.beforeSnapshot.businessHealthScore;

    const resultStatus = this.classifyResult({
      kpiKey: input.targetKpiKey,
      baselineValue,
      finalValue,
      deltaValue,
      deltaPercentage,
      healthScoreDelta,
    });

    const hypothesis = this.evaluateHypothesis({
      resultStatus,
      attributionLevel: input.attributionLevel,
    });

    // Phase 29 Expected vs Actual Variance
    const isDecreasingMetric =
      (input.targetKpiKey || '').toLowerCase().includes('unassigned') ||
      (input.targetKpiKey || '').toLowerCase().includes('churn') ||
      (input.targetKpiKey || '').toLowerCase().includes('response');

    const { variance, variancePercentage, varianceStatus } = this.calculateVariance(
      input.expectedValue,
      finalValue,
      isDecreasingMetric
    );

    const confidence = this.evaluateConfidence({
      dataCompletenessPct: 100,
      sampleCount: 1,
      attributionLevel: input.attributionLevel,
    });

    const effectivenessStatus = this.classifyEffectiveness({
      varianceStatus,
      variancePercentage,
      resultStatus,
      attributionLevel: input.attributionLevel,
      hasSufficientEvidence: confidence !== 'INSUFFICIENT',
    });

    // Compute single-outcome effectiveness score
    const effectivenessScore = this.calculateEffectivenessScore({
      totalRecommendations: 1,
      totalExecuted: 1,
      successCount: resultStatus === 'SUCCESS' ? 1 : 0,
      partialCount: resultStatus === 'PARTIAL' ? 1 : 0,
      totalMeasured: 1,
      avgHealthScoreDelta: healthScoreDelta,
      supportedCount: hypothesis.status === 'SUPPORTED' ? 1 : 0,
      refutedCount: hypothesis.status === 'REFUTED' ? 1 : 0,
    });

    return {
      finalValue,
      deltaValue,
      deltaPercentage,
      healthScoreDelta,
      expectedValue: input.expectedValue ?? undefined,
      actualValue: finalValue ?? undefined,
      variance,
      variancePercentage,
      varianceStatus,
      confidence,
      effectivenessStatus,
      resultStatus,
      attributionLevel: input.attributionLevel,
      attributionRationale: input.attributionRationale,
      hypothesisStatus: hypothesis.status,
      falsified: hypothesis.falsified,
      effectivenessScore,
      evaluatedAt: new Date(),
      evaluationMode: input.isEarlyEvaluation ? 'EARLY_MANUAL' : 'SCHEDULED',
    };
  }
}
