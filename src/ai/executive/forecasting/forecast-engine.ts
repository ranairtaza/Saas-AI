import {
  ForecastHorizon,
  ForecastDomain,
  ForecastConfidence,
  ForecastDirection,
  ForecastScenarioType,
  PredictiveRiskSignal,
  ExecutiveForecastData,
  ScenarioForecastItem,
  MetricForecastResult,
  TrendResult,
  AnomalyDetectionResult,
  ForecastEvaluationResult,
  ForecastConfidenceLevel,
} from './types';
import { BusinessContext } from '../types';
import { ExecutiveLearningSignal } from '../outcomes/types';
import { DataQualityGate, RawSnapshotInput, ValidatedPeriod } from './data-quality-gate';
import { TrendDetector } from './trend-detector';
import { AnomalyDetector } from './anomaly-detector';
import { ForecastEvaluator } from './forecast-evaluator';

export interface MetricForecastInput {
  domain: ForecastDomain;
  metric: string;
  currentValue: number;
  horizon: ForecastHorizon;
  scenarioType?: ForecastScenarioType;
  growthRatePct?: number; // Estimated baseline period growth %
  historicalSignals?: ExecutiveLearningSignal[];
  targetGoalValue?: number;
}

export class ForecastEngine {
  /**
   * Maps horizon enum to concrete days.
   */
  static getHorizonDays(horizon: ForecastHorizon): number {
    switch (horizon) {
      case 'SHORT_TERM':
        return 14;
      case 'MEDIUM_TERM':
        return 30;
      case 'LONG_TERM':
        return 90;
      default:
        return 30;
    }
  }

  /**
   * Deterministically calculates uncertainty range [lowerBound, upperBound] based on confidence.
   */
  static calculateUncertaintyRange(
    projectedValue: number,
    confidence: ForecastConfidence,
    horizonDays: number
  ): { lowerBound: number; upperBound: number } {
    // Uncertainty widens over longer time horizons and lower confidence
    let baseUncertaintyPct = 0.05; // 5% base

    switch (confidence) {
      case 'HIGH':
        baseUncertaintyPct = 0.05;
        break;
      case 'MEDIUM':
        baseUncertaintyPct = 0.12;
        break;
      case 'LOW':
        baseUncertaintyPct = 0.25;
        break;
      case 'INSUFFICIENT':
        baseUncertaintyPct = 0.40;
        break;
    }

    // Time scaling: sqrt(days / 30)
    const timeFactor = Math.sqrt(horizonDays / 30);
    const totalUncertaintyPct = baseUncertaintyPct * timeFactor;

    const lowerBound = Math.round(Math.max(0, projectedValue * (1 - totalUncertaintyPct)) * 100) / 100;
    const upperBound = Math.round((projectedValue * (1 + totalUncertaintyPct)) * 100) / 100;

    return { lowerBound, upperBound };
  }

  /**
   * Evaluates forecast confidence based on data completeness and historical learning signals.
   */
  static evaluateConfidence(params: {
    hasData: boolean;
    dataPointsCount: number;
    learningSignalsCount: number;
    variancePct?: number;
  }): ForecastConfidence {
    if (!params.hasData || params.dataPointsCount === 0) {
      return 'INSUFFICIENT';
    }

    const variance = Math.abs(params.variancePct || 0);

    if (params.learningSignalsCount >= 3 && variance <= 10) {
      return 'HIGH';
    }

    if (params.learningSignalsCount >= 1 || params.dataPointsCount >= 2) {
      if (variance > 25) {
        return 'LOW';
      }
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Classifies trajectory direction.
   */
  static classifyDirection(currentValue: number, forecastValue: number): ForecastDirection {
    if (currentValue === 0) {
      if (forecastValue > 0) return 'INCREASING';
      if (forecastValue < 0) return 'DECREASING';
      return 'STABLE';
    }

    const deltaPct = ((forecastValue - currentValue) / Math.abs(currentValue)) * 100;

    if (deltaPct > 2.5) return 'INCREASING';
    if (deltaPct < -2.5) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Generates a single deterministic forecast for a specific metric.
   */
  static generateMetricForecast(
    orgId: string,
    input: MetricForecastInput
  ): ExecutiveForecastData {
    const horizonDays = this.getHorizonDays(input.horizon);
    const timeFactor = horizonDays / 30; // normalized to 30-day baseline

    const signals = input.historicalSignals || [];
    const signalsForDomain = signals.filter((s) => s.domain === input.domain);

    // Calculate historical performance adjustment modifier (Phase 29 feedback)
    let learningAdjustmentPct = 0;
    if (signalsForDomain.length > 0) {
      const avgVariance =
        signalsForDomain.reduce((sum, s) => sum + (s.variancePercentage ?? 0), 0) /
        signalsForDomain.length;
      // Dampen historical variance effect to prevent runaway extrapolation
      learningAdjustmentPct = Math.max(-15, Math.min(15, avgVariance * 0.3));
    }

    // Default baseline monthly growth
    const baseGrowthPct = input.growthRatePct ?? 5; // 5% baseline monthly growth
    let scenarioMultiplier = 1.0;

    if (input.scenarioType === 'OPTIMISTIC') {
      scenarioMultiplier = 1.25; // 25% optimistic acceleration
    } else if (input.scenarioType === 'CONSERVATIVE') {
      scenarioMultiplier = 0.75; // 25% conservative haircut
    }

    const isDecreasingMetric =
      input.metric.toLowerCase().includes('unassigned') ||
      input.metric.toLowerCase().includes('churn') ||
      input.metric.toLowerCase().includes('latency');

    let forecastValue = input.currentValue;

    if (isDecreasingMetric) {
      // For decreasing metrics (backlog), positive action reduces the value
      const reductionRate = (0.2 * timeFactor * scenarioMultiplier);
      forecastValue = Math.max(0, Math.round(input.currentValue * (1 - reductionRate) * 100) / 100);
    } else {
      const effectiveGrowthRate =
        ((baseGrowthPct + learningAdjustmentPct) / 100) * timeFactor * scenarioMultiplier;
      forecastValue = Math.round(input.currentValue * (1 + effectiveGrowthRate) * 100) / 100;
    }

    const confidence = this.evaluateConfidence({
      hasData: input.currentValue !== undefined && !isNaN(input.currentValue),
      dataPointsCount: 3,
      learningSignalsCount: signalsForDomain.length,
      variancePct: Math.abs(learningAdjustmentPct),
    });

    const { lowerBound, upperBound } = this.calculateUncertaintyRange(
      forecastValue,
      confidence,
      horizonDays
    );

    const direction = this.classifyDirection(input.currentValue, forecastValue);

    // Assemble grounded evidence statement
    const evidenceParts: string[] = [
      `Current ${input.metric} telemetry baseline: ${input.currentValue.toLocaleString()}.`,
      `Projected ${input.horizon.toLowerCase().replace('_', ' ')} (${horizonDays}d) ${input.scenarioType || 'BASELINE'} trajectory.`,
    ];
    if (signalsForDomain.length > 0) {
      evidenceParts.push(
        `Informed by ${signalsForDomain.length} historical Phase 29 learning signal(s) in ${input.domain} (avg variance modifier: ${learningAdjustmentPct > 0 ? '+' : ''}${Math.round(learningAdjustmentPct)}%).`
      );
    }
    const evidence = evidenceParts.join(' ');

    const assumptions: string[] = [
      `Market and operational parameters remain within historical bounds over ${horizonDays} days.`,
      `Telemetry ingestion data quality remains consistent.`,
    ];
    if (input.scenarioType === 'OPTIMISTIC') {
      assumptions.push('Optimal lead response velocity and pipeline conversion execution.');
    } else if (input.scenarioType === 'CONSERVATIVE') {
      assumptions.push('Factoring in potential operational latency and market headwinds.');
    }

    // Evaluate predictive risks for this metric
    const riskSignals: PredictiveRiskSignal[] = [];

    if (input.metric === 'unassignedHighPriorityLeads' && forecastValue > 5) {
      riskSignals.push({
        riskType: 'OPERATIONAL_RISK',
        riskLevel: forecastValue > 10 ? 'HIGH' : 'MEDIUM',
        probabilityPct: 80,
        impactSeverity: 'HIGH',
        metric: input.metric,
        threshold: 5,
        projectedValue: forecastValue,
        horizon: input.horizon,
        explanation: `Unassigned lead backlog projected at ${forecastValue}, exceeding operational SLA capacity threshold (5).`,
      });
    }

    if (input.metric === 'revenueMTD' && input.targetGoalValue && forecastValue < input.targetGoalValue * 0.85) {
      riskSignals.push({
        riskType: 'REVENUE_RISK',
        riskLevel: 'HIGH',
        probabilityPct: 75,
        impactSeverity: 'HIGH',
        metric: input.metric,
        threshold: input.targetGoalValue,
        projectedValue: forecastValue,
        horizon: input.horizon,
        explanation: `Projected revenue ($${forecastValue.toLocaleString()}) falls below target goal threshold ($${input.targetGoalValue.toLocaleString()}).`,
      });
    }

    return {
      organizationId: orgId,
      sourceType: 'TELEMETRY',
      domain: input.domain,
      metric: input.metric,
      currentValue: input.currentValue,
      forecastValue,
      forecastHorizon: input.horizon,
      horizonDays,
      lowerBound,
      upperBound,
      confidence,
      direction,
      scenarioType: input.scenarioType || 'BASELINE',
      evidence,
      assumptions,
      riskSignals,
    };
  }

  /**
   * Generates a comprehensive multi-domain forecast suite from business context and historical learning signals.
   */
  static generateExecutiveForecasts(
    context: BusinessContext,
    historicalSignals: ExecutiveLearningSignal[] = []
  ): {
    forecasts: ExecutiveForecastData[];
    scenarioComparisons: ScenarioForecastItem[];
    topPredictiveRisks: PredictiveRiskSignal[];
  } {
    const orgId = context.organizationId;
    const telemetry = context.telemetry;
    const forecasts: ExecutiveForecastData[] = [];
    const scenarioComparisons: ScenarioForecastItem[] = [];
    const topPredictiveRisks: PredictiveRiskSignal[] = [];

    // 1. Core Supported Telemetry Metrics
    const metricsConfig: Array<{
      domain: ForecastDomain;
      metric: string;
      currentValue: number;
      growthRatePct: number;
      targetGoalKpi?: string;
    }> = [
      {
        domain: 'REVENUE',
        metric: 'revenueMTD',
        currentValue: (telemetry.metrics.revenueMTD?.value ?? 0),
        growthRatePct: 8,
        targetGoalKpi: 'revenue_mrr',
      },
      {
        domain: 'PIPELINE',
        metric: 'pipelineValue',
        currentValue: (telemetry.metrics.pipelineValue?.value ?? 0),
        growthRatePct: 10,
        targetGoalKpi: 'pipeline_target',
      },
      {
        domain: 'SALES',
        metric: 'qualifiedLeadsCount',
        currentValue: (telemetry.metrics.qualifiedLeads?.value ?? 0),
        growthRatePct: 12,
      },
      {
        domain: 'OPERATIONS',
        metric: 'unassignedHighPriorityLeads',
        currentValue: (telemetry.metrics.unassignedHighPriorityLeads?.value ?? 0),
        growthRatePct: -20, // reducing
      },
    ];

    // Check for target goals
    const goalMap: Record<string, number> = {};
    for (const g of context.goals || []) {
      if (g.kpiKey && g.targetValue) {
        goalMap[g.kpiKey] = g.targetValue;
      }
    }

    // Generate Medium-Term Baseline Forecasts for all metrics
    for (const m of metricsConfig) {
      const targetGoalVal = m.targetGoalKpi ? goalMap[m.targetGoalKpi] : undefined;

      const baselineForecast = this.generateMetricForecast(orgId, {
        domain: m.domain,
        metric: m.metric,
        currentValue: m.currentValue,
        horizon: 'MEDIUM_TERM',
        scenarioType: 'BASELINE',
        growthRatePct: m.growthRatePct,
        historicalSignals,
        targetGoalValue: targetGoalVal,
      });

      forecasts.push(baselineForecast);
      topPredictiveRisks.push(...baselineForecast.riskSignals);

      // Generate Optimistic & Conservative Scenarios for comparison
      const optForecast = this.generateMetricForecast(orgId, {
        domain: m.domain,
        metric: m.metric,
        currentValue: m.currentValue,
        horizon: 'MEDIUM_TERM',
        scenarioType: 'OPTIMISTIC',
        growthRatePct: m.growthRatePct,
        historicalSignals,
      });

      const consForecast = this.generateMetricForecast(orgId, {
        domain: m.domain,
        metric: m.metric,
        currentValue: m.currentValue,
        horizon: 'MEDIUM_TERM',
        scenarioType: 'CONSERVATIVE',
        growthRatePct: m.growthRatePct,
        historicalSignals,
      });

      const variancePotentialPct =
        baselineForecast.forecastValue > 0
          ? Math.round(
              ((optForecast.forecastValue - consForecast.forecastValue) /
                baselineForecast.forecastValue) *
                100
            )
          : 0;

      scenarioComparisons.push({
        metric: m.metric,
        domain: m.domain,
        currentValue: m.currentValue,
        baselineForecast: baselineForecast.forecastValue,
        optimisticForecast: optForecast.forecastValue,
        conservativeForecast: consForecast.forecastValue,
        variancePotentialPct,
        confidence: baselineForecast.confidence,
      });
    }

    // Add Short-Term and Long-Term forecasts for key Revenue & Pipeline metrics
    const shortTermRev = this.generateMetricForecast(orgId, {
      domain: 'REVENUE',
      metric: 'revenueMTD',
      currentValue: (telemetry.metrics.revenueMTD?.value ?? 0),
      horizon: 'SHORT_TERM',
      growthRatePct: 8,
      historicalSignals,
    });
    forecasts.push(shortTermRev);

    const longTermPipeline = this.generateMetricForecast(orgId, {
      domain: 'PIPELINE',
      metric: 'pipelineValue',
      currentValue: (telemetry.metrics.pipelineValue?.value ?? 0),
      horizon: 'LONG_TERM',
      growthRatePct: 10,
      historicalSignals,
    });
    forecasts.push(longTermPipeline);

    return {
      forecasts,
      scenarioComparisons,
      topPredictiveRisks,
    };
  }

  /**
   * Phase 41: Deterministically forecasts the next period value for a metric
   * using validated historical snapshots.
   */
  static forecastMetric(
    metric: string,
    rawSnapshots: RawSnapshotInput[],
    options?: { asOfDate?: Date; method?: 'WEIGHTED_MOVING_AVERAGE' | 'LINEAR_TREND' }
  ): MetricForecastResult {
    const qualityResult = DataQualityGate.validate(metric, rawSnapshots, options);

    if (qualityResult.status === 'INSUFFICIENT_DATA') {
      return {
        metric,
        forecastValue: null,
        forecastPeriod: 'NEXT_PERIOD',
        source: {
          historicalMetrics: [metric],
          providers: qualityResult.providersUsed,
        },
        method: options?.method || 'WEIGHTED_MOVING_AVERAGE',
        confidence: 'INSUFFICIENT_DATA',
        status: 'INSUFFICIENT_DATA',
        historicalPeriodsUsed: qualityResult.validPeriods.length,
        generatedAt: new Date(),
        explanation: qualityResult.explanation,
      };
    }

    if (qualityResult.status === 'CONFLICTING') {
      return {
        metric,
        forecastValue: null,
        forecastPeriod: 'NEXT_PERIOD',
        source: {
          historicalMetrics: [metric],
          providers: qualityResult.providersUsed,
        },
        method: options?.method || 'WEIGHTED_MOVING_AVERAGE',
        confidence: 'LOW',
        status: 'CONFLICTING',
        historicalPeriodsUsed: qualityResult.validPeriods.length,
        generatedAt: new Date(),
        explanation: qualityResult.explanation,
      };
    }

    if (qualityResult.status === 'INVALID') {
      return {
        metric,
        forecastValue: null,
        forecastPeriod: 'NEXT_PERIOD',
        source: {
          historicalMetrics: [metric],
          providers: qualityResult.providersUsed,
        },
        method: options?.method || 'WEIGHTED_MOVING_AVERAGE',
        confidence: 'INSUFFICIENT_DATA',
        status: 'UNAVAILABLE',
        historicalPeriodsUsed: 0,
        generatedAt: new Date(),
        explanation: qualityResult.explanation,
      };
    }

    const validPeriods = qualityResult.validPeriods;
    const n = validPeriods.length;
    const values = validPeriods.map((p) => p.value);

    // Forecasting via Weighted Moving Average (WMA)
    // weights w_i = i + 1 for i = 0 ... n-1
    let weightSum = 0;
    let weightedValueSum = 0;
    for (let i = 0; i < n; i++) {
      const weight = i + 1;
      weightSum += weight;
      weightedValueSum += weight * values[i];
    }
    const rawForecast = weightedValueSum / weightSum;
    const forecastValue = Math.round(rawForecast * 100) / 100;

    // Calculate next period string
    const lastPeriod = validPeriods[validPeriods.length - 1].period;
    const forecastPeriod = DataQualityGate.getNextPeriodKey(lastPeriod);

    // Compute Confidence (Monotonic Downgrade):
    let confidenceScore = n >= 5 ? 3 : 2; // Initial confidence based on data quantity

    // 1. Volatility penalty
    if (qualityResult.volatilityPct > 30) {
      confidenceScore = Math.min(confidenceScore, confidenceScore - 1);
    }

    // 2. Missing periods penalty
    if (qualityResult.hasMissingPeriods) {
      confidenceScore = Math.min(confidenceScore, confidenceScore - 1);
    }

    // 3. Freshness penalty
    if (qualityResult.isStale) {
      confidenceScore = Math.min(confidenceScore, 1); // Max LOW
    }

    // Final mapping (weakest applicable state)
    let confidence: ForecastConfidenceLevel = 'LOW';
    if (confidenceScore >= 3) confidence = 'HIGH';
    else if (confidenceScore === 2) confidence = 'MEDIUM';
    else if (confidenceScore <= 1) confidence = 'LOW';

    const explanation = `Forecast of ${forecastValue.toLocaleString()} for ${forecastPeriod} calculated using weighted moving average across ${n} validated historical periods.`;

    return {
      metric,
      forecastValue,
      forecastPeriod,
      source: {
        historicalMetrics: [metric],
        providers: qualityResult.providersUsed,
      },
      method: options?.method || 'WEIGHTED_MOVING_AVERAGE',
      confidence,
      status: 'FORECASTED',
      historicalPeriodsUsed: n,
      generatedAt: new Date(),
      explanation,
    };
  }

  /**
   * Phase 41: Deterministically classifies trend for a historical series.
   */
  static detectTrend(
    metric: string,
    rawSnapshots: RawSnapshotInput[],
    options?: { asOfDate?: Date }
  ): TrendResult {
    const qualityResult = DataQualityGate.validate(metric, rawSnapshots, options);
    return TrendDetector.detect(metric, qualityResult.validPeriods);
  }

  /**
   * Phase 41: Deterministically evaluates whether a current observation is anomalous.
   */
  static detectAnomaly(
    metric: string,
    rawSnapshots: RawSnapshotInput[],
    currentValue: number | null | undefined,
    options?: { asOfDate?: Date }
  ): AnomalyDetectionResult {
    const qualityResult = DataQualityGate.validate(metric, rawSnapshots, options);
    return AnomalyDetector.detect(metric, qualityResult.validPeriods, currentValue);
  }

  /**
   * Phase 41: Evaluates forecast accuracy against actual observed values.
   */
  static evaluateForecast(
    metric: string,
    forecastPeriod: string,
    forecastValue: number,
    actualValue: number | null | undefined
  ): ForecastEvaluationResult {
    return ForecastEvaluator.evaluate(metric, forecastPeriod, forecastValue, actualValue);
  }
}
