import { z } from 'zod';
import { DomainHealthSchema } from '../events/types';

// ============================================================================
// 1. OUTCOME LIFECYCLE & EVALUATION ENUMS
// ============================================================================

export const ExecutiveOutcomeStatusSchema = z.enum([
  'MEASURING',
  'EVALUATING',
  'MEASURED',
  'CANCELLED',
  'EXPIRED',
]);
export type ExecutiveOutcomeStatus = z.infer<typeof ExecutiveOutcomeStatusSchema>;

export const OutcomeResultStatusSchema = z.enum([
  'SUCCESS',
  'PARTIAL',
  'NEUTRAL',
  'NEGATIVE',
  'INCONCLUSIVE',
]);
export type OutcomeResultStatus = z.infer<typeof OutcomeResultStatusSchema>;

export const AttributionLevelSchema = z.enum([
  'DIRECT_CAUSAL',
  'CORRELATED',
  'INCONCLUSIVE',
  'NONE',
  'INSUFFICIENT_EVIDENCE',
]);
export type AttributionLevel = z.infer<typeof AttributionLevelSchema>;

export const HypothesisValidationStatusSchema = z.enum([
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'INCONCLUSIVE',
  'REFUTED',
]);
export type HypothesisValidationStatus = z.infer<typeof HypothesisValidationStatusSchema>;

// Phase 29: Outcome Variance, Confidence, and Decision Effectiveness
export const VarianceStatusSchema = z.enum([
  'POSITIVE',
  'NEUTRAL',
  'NEGATIVE',
  'INCONCLUSIVE',
]);
export type VarianceStatus = z.infer<typeof VarianceStatusSchema>;

export const OutcomeConfidenceSchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
  'INSUFFICIENT',
]);
export type OutcomeConfidence = z.infer<typeof OutcomeConfidenceSchema>;

export const DecisionEffectivenessSchema = z.enum([
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'NEUTRAL',
  'UNDERPERFORMED',
  'FAILED',
  'INCONCLUSIVE',
]);
export type DecisionEffectiveness = z.infer<typeof DecisionEffectivenessSchema>;

// ============================================================================
// 2. TELEMETRY SNAPSHOT SCHEMAS
// ============================================================================

export const GoalSnapshotItemSchema = z.object({
  goalId: z.string(),
  kpiKey: z.string(),
  currentValue: z.number(),
  targetValue: z.number(),
  progressPct: z.number(),
  status: z.string(),
});
export type GoalSnapshotItem = z.infer<typeof GoalSnapshotItemSchema>;

export const TelemetrySnapshotSchema = z.object({
  timestamp: z.string().or(z.date()),
  revenueMTD: z.number().nullable().default(null),
  pipelineValue: z.number().nullable().default(null),
  activeLeadsCount: z.number().nullable().default(null),
  qualifiedLeadsCount: z.number().nullable().default(null),
  unassignedHighPriorityLeads: z.number().nullable().default(null),
  businessHealthScore: z.number().min(0).max(100),
  domainHealthScores: z
    .object({
      revenue: z.number(),
      pipeline: z.number(),
      goals: z.number(),
      operations: z.number(),
    })
    .optional(),
  goalStatuses: z.array(GoalSnapshotItemSchema).default([]),
});
export type TelemetrySnapshot = z.infer<typeof TelemetrySnapshotSchema>;

// ============================================================================
// 3. EXECUTIVE OUTCOME SCHEMAS
// ============================================================================

export const ExecutiveOutcomeSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  recommendationId: z.string(),
  decisionId: z.string().nullable().optional(),
  pendingActionId: z.string().nullable().optional(),
  domain: z.string().default('REVENUE'),
  targetKpiKey: z.string().nullable().optional(),
  targetGoalId: z.string().nullable().optional(),

  status: ExecutiveOutcomeStatusSchema.default('MEASURING'),
  measurementWindowDays: z.number().int().positive().default(7),
  startedAt: z.string().datetime().or(z.date()),
  evaluationDueAt: z.string().datetime().or(z.date()),
  evaluatedAt: z.string().datetime().or(z.date()).nullable().optional(),

  beforeSnapshot: z.string().or(TelemetrySnapshotSchema),
  afterSnapshot: z.string().or(TelemetrySnapshotSchema).nullable().optional(),

  // Expected vs Actual metrics (Phase 29)
  expectedValue: z.number().nullable().optional(),
  actualValue: z.number().nullable().optional(),
  variance: z.number().nullable().optional(),
  variancePercentage: z.number().nullable().optional(),
  varianceStatus: VarianceStatusSchema.nullable().optional(),
  confidence: OutcomeConfidenceSchema.nullable().optional(),
  effectivenessStatus: DecisionEffectivenessSchema.nullable().optional(),

  baselineValue: z.number(),
  finalValue: z.number().nullable().optional(),
  deltaValue: z.number().nullable().optional(),
  deltaPercentage: z.number().nullable().optional(),
  healthScoreDelta: z.number().nullable().optional(),

  resultStatus: OutcomeResultStatusSchema.nullable().optional(),
  attributionLevel: AttributionLevelSchema.nullable().optional(),
  attributionRationale: z.string().nullable().optional(),

  hypothesisStatus: HypothesisValidationStatusSchema.nullable().optional(),
  falsified: z.boolean().default(false),

  effectivenessScore: z.number().min(0).max(100).nullable().optional(),
  executiveMemoryId: z.string().nullable().optional(),

  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});
export type ExecutiveOutcomeData = z.infer<typeof ExecutiveOutcomeSchema>;

// ============================================================================
// 3.5 EXECUTIVE OUTCOME ATTRIBUTION SCHEMA
// ============================================================================

export const ExecutiveOutcomeAttributionSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  outcomeId: z.string(),
  decisionId: z.string().nullable().optional(),
  actionPlanId: z.string().nullable().optional(),
  pendingActionId: z.string().nullable().optional(),

  attributionStatus: AttributionLevelSchema,
  confidence: OutcomeConfidenceSchema,

  targetMetric: z.string(),
  baselineValue: z.number(),
  expectedImpactValue: z.number().nullable().optional(),
  actualDeltaValue: z.number(),

  attributionRationale: z.string(),
  confoundingFactors: z.string().default('[]'),

  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});
export type ExecutiveOutcomeAttribution = z.infer<typeof ExecutiveOutcomeAttributionSchema>;


// ============================================================================
// 4. OUTCOME EVALUATION RESULT SCHEMA
// ============================================================================

export const OutcomeEvaluationSchema = z.object({
  finalValue: z.number().nullable(),
  deltaValue: z.number().nullable(),
  deltaPercentage: z.number().nullable(),
  healthScoreDelta: z.number(),
  expectedValue: z.number().nullable().optional(),
  actualValue: z.number().nullable().optional(),
  variance: z.number().nullable().optional(),
  variancePercentage: z.number().nullable().optional(),
  varianceStatus: VarianceStatusSchema.optional(),
  confidence: OutcomeConfidenceSchema.optional(),
  effectivenessStatus: DecisionEffectivenessSchema.optional(),
  resultStatus: OutcomeResultStatusSchema,
  attributionLevel: AttributionLevelSchema,
  attributionRationale: z.string(),
  hypothesisStatus: HypothesisValidationStatusSchema,
  falsified: z.boolean(),
  effectivenessScore: z.number().min(0).max(100),
  inconclusiveReason: z.string().nullable().optional(),
  evaluatedAt: z.date().or(z.string()),
  evaluationMode: z.enum(['SCHEDULED', 'EARLY_MANUAL']).default('SCHEDULED'),
});
export type OutcomeEvaluation = z.infer<typeof OutcomeEvaluationSchema>;

// ============================================================================
// 5. LEARNING SIGNAL SCHEMA (PHASE 29)
// ============================================================================

export const ExecutiveLearningSignalSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  decisionId: z.string().nullable().optional(),
  outcomeId: z.string().nullable().optional(),
  domain: z.string(),
  strategyKey: z.string().nullable().optional(),
  metric: z.string(),
  expectedValue: z.number().nullable(),
  actualValue: z.number().nullable(),
  variance: z.number().nullable(),
  variancePercentage: z.number().nullable(),
  varianceStatus: VarianceStatusSchema,
  effectiveness: DecisionEffectivenessSchema,
  confidence: OutcomeConfidenceSchema,
  hypothesisResult: HypothesisValidationStatusSchema,
  evidence: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()).optional(),
});
export type ExecutiveLearningSignal = z.infer<typeof ExecutiveLearningSignalSchema>;

// ============================================================================
// 6. HISTORICAL DECISION & STRATEGY PERFORMANCE SUMMARY SCHEMA
// ============================================================================

export const DomainPerformanceItemSchema = z.object({
  total: z.number(),
  successful: z.number(),
  winRatePct: z.number(),
});

export const HistoricalStrategyFeedbackSchema = z.object({
  strategyKey: z.string(),
  domain: z.string(),
  sampleCount: z.number(),
  historicalSuccessRate: z.number(),
  averageVariance: z.number(),
  recommendedConfidence: OutcomeConfidenceSchema,
  refutedHypothesisCount: z.number(),
  status: z.enum([
    'HISTORICALLY_SUCCESSFUL',
    'HISTORICALLY_UNDERPERFORMED',
    'INSUFFICIENT_EVIDENCE',
    'NEUTRAL',
  ]),
});
export type HistoricalStrategyFeedback = z.infer<typeof HistoricalStrategyFeedbackSchema>;

export const HistoricalDecisionSummarySchema = z.object({
  totalRecommendations: z.number().default(0),
  totalExecuted: z.number().default(0),
  totalMeasured: z.number().default(0),
  successRatePct: z.number().min(0).max(100).default(0),
  effectivenessScore: z.number().min(0).max(100).default(0),
  domainPerformance: z.record(z.string(), DomainPerformanceItemSchema).default({}),
  topValidatedStrategies: z.array(z.string()).default([]),
  refutedHypotheses: z.array(z.string()).default([]),
  learningSignalsCount: z.number().default(0),
  strategyFeedback: z.array(HistoricalStrategyFeedbackSchema).default([]),
});
export type HistoricalDecisionSummary = z.infer<typeof HistoricalDecisionSummarySchema>;
