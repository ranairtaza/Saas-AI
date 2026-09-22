import { z } from 'zod';

// ============================================================================
// 1. FORECASTING ENUMS & PRIMITIVES
// ============================================================================

export const ForecastHorizonSchema = z.enum([
  'SHORT_TERM',  // 7 - 14 days
  'MEDIUM_TERM', // 30 - 60 days
  'LONG_TERM',   // 90+ days
]);
export type ForecastHorizon = z.infer<typeof ForecastHorizonSchema>;

export const ForecastDomainSchema = z.enum([
  'REVENUE',
  'PIPELINE',
  'SALES',
  'OPERATIONS',
  'FINANCE',
  'MARKETING',
  'GOVERNANCE',
]);
export type ForecastDomain = z.infer<typeof ForecastDomainSchema>;

export const ForecastConfidenceSchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
  'INSUFFICIENT',
]);
export type ForecastConfidence = z.infer<typeof ForecastConfidenceSchema>;

export const ForecastDirectionSchema = z.enum([
  'INCREASING',
  'DECREASING',
  'STABLE',
  'VOLATILE',
]);
export type ForecastDirection = z.infer<typeof ForecastDirectionSchema>;

export const ForecastScenarioTypeSchema = z.enum([
  'BASELINE',
  'OPTIMISTIC',
  'CONSERVATIVE',
]);
export type ForecastScenarioType = z.infer<typeof ForecastScenarioTypeSchema>;

export const ForecastSourceTypeSchema = z.enum([
  'TELEMETRY',
  'STRATEGY_SCENARIO',
  'OUTCOME_LEARNING',
  'GOAL',
]);
export type ForecastSourceType = z.infer<typeof ForecastSourceTypeSchema>;

export const PredictiveRiskTypeSchema = z.enum([
  'CAPACITY_RISK',
  'PIPELINE_RISK',
  'CONVERSION_RISK',
  'REVENUE_RISK',
  'OPERATIONAL_RISK',
  'STRATEGY_RISK',
]);
export type PredictiveRiskType = z.infer<typeof PredictiveRiskTypeSchema>;

// ============================================================================
// 2. PREDICTIVE RISK SIGNAL SCHEMA
// ============================================================================

export const PredictiveRiskSignalSchema = z.object({
  riskType: PredictiveRiskTypeSchema,
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  probabilityPct: z.number().min(0).max(100),
  impactSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  metric: z.string(),
  threshold: z.number(),
  projectedValue: z.number(),
  horizon: ForecastHorizonSchema,
  explanation: z.string(),
});
export type PredictiveRiskSignal = z.infer<typeof PredictiveRiskSignalSchema>;

// ============================================================================
// 3. EXECUTIVE FORECAST RECORD SCHEMA
// ============================================================================

export const ExecutiveForecastSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  sourceType: ForecastSourceTypeSchema.default('TELEMETRY'),
  sourceId: z.string().nullable().optional(),
  domain: ForecastDomainSchema,
  metric: z.string().min(1),
  currentValue: z.number().nullable(),
  forecastValue: z.number().nullable(),
  forecastHorizon: ForecastHorizonSchema,
  horizonDays: z.number().int().positive().default(30),
  lowerBound: z.number().nullable(),
  upperBound: z.number().nullable(),
  confidence: ForecastConfidenceSchema,
  direction: ForecastDirectionSchema,
  scenarioType: ForecastScenarioTypeSchema.default('BASELINE'),
  evidence: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  riskSignals: z.array(PredictiveRiskSignalSchema).default([]),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});
export type ExecutiveForecastData = z.infer<typeof ExecutiveForecastSchema>;

// ============================================================================
// 4. SCENARIO FORECAST COMPARISON SCHEMA
// ============================================================================

export const ScenarioForecastItemSchema = z.object({
  metric: z.string(),
  domain: ForecastDomainSchema,
  currentValue: z.number().nullable(),
  baselineForecast: z.number().nullable(),
  optimisticForecast: z.number().nullable(),
  conservativeForecast: z.number().nullable(),
  variancePotentialPct: z.number().nullable(),
  confidence: ForecastConfidenceSchema,
});
export type ScenarioForecastItem = z.infer<typeof ScenarioForecastItemSchema>;

// ============================================================================
// 5. EXECUTIVE FORECAST SUMMARY SCHEMA
// ============================================================================

export const ExecutiveForecastSummarySchema = z.object({
  totalForecasts: z.number().default(0),
  highConfidenceCount: z.number().default(0),
  identifiedRisksCount: z.number().default(0),
  forecasts: z.array(ExecutiveForecastSchema).default([]),
  topPredictiveRisks: z.array(PredictiveRiskSignalSchema).default([]),
  scenarioComparisons: z.array(ScenarioForecastItemSchema).default([]),
  generatedAt: z.string().datetime().or(z.date()),
});
export type ExecutiveForecastSummary = z.infer<typeof ExecutiveForecastSummarySchema>;

// ============================================================================
// 6. PHASE 41 PREDICTIVE BI CONTRACTS
// ============================================================================

export const ForecastStatusSchema = z.enum([
  'FORECASTED',
  'INSUFFICIENT_DATA',
  'UNAVAILABLE',
  'CONFLICTING',
]);
export type ForecastStatus = z.infer<typeof ForecastStatusSchema>;

export const ForecastConfidenceLevelSchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
  'INSUFFICIENT_DATA',
]);
export type ForecastConfidenceLevel = z.infer<typeof ForecastConfidenceLevelSchema>;

export const TrendClassificationSchema = z.enum([
  'STRONGLY_INCREASING',
  'INCREASING',
  'STABLE',
  'DECREASING',
  'STRONGLY_DECREASING',
  'INSUFFICIENT_DATA',
]);
export type TrendClassification = z.infer<typeof TrendClassificationSchema>;

export const AnomalyClassificationSchema = z.enum([
  'NORMAL',
  'ANOMALY',
  'INSUFFICIENT_DATA',
]);
export type AnomalyClassification = z.infer<typeof AnomalyClassificationSchema>;

export const MetricForecastResultSchema = z.object({
  metric: z.string(),
  forecastValue: z.number().nullable(),
  forecastPeriod: z.string(),
  source: z.object({
    historicalMetrics: z.array(z.string()),
    providers: z.array(z.string()).default([]),
  }),
  method: z.string(),
  confidence: ForecastConfidenceLevelSchema,
  status: ForecastStatusSchema,
  historicalPeriodsUsed: z.number(),
  generatedAt: z.string().datetime().or(z.date()),
  explanation: z.string(),
});
export type MetricForecastResult = z.infer<typeof MetricForecastResultSchema>;

export const TrendResultSchema = z.object({
  metric: z.string(),
  trend: TrendClassificationSchema,
  growthRatePct: z.number().nullable(),
  periodsAnalyzed: z.number(),
  explanation: z.string(),
});
export type TrendResult = z.infer<typeof TrendResultSchema>;

export const AnomalyDetectionResultSchema = z.object({
  metric: z.string(),
  status: AnomalyClassificationSchema,
  currentValue: z.number().nullable(),
  historicalMean: z.number().nullable(),
  deviationPct: z.number().nullable(),
  explanation: z.string(),
});
export type AnomalyDetectionResult = z.infer<typeof AnomalyDetectionResultSchema>;

export const ForecastEvaluationResultSchema = z.object({
  metric: z.string(),
  forecastPeriod: z.string(),
  forecastValue: z.number(),
  actualValue: z.number().nullable(),
  absoluteError: z.number().nullable(),
  percentageError: z.number().nullable(),
  status: z.enum(['EVALUATED', 'UNKNOWN']),
});
export type ForecastEvaluationResult = z.infer<typeof ForecastEvaluationResultSchema>;

