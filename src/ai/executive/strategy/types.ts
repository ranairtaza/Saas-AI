import { z } from 'zod';
import {
  ExecutiveFactSchema,
  ExecutiveObservationSchema,
  ExecutiveHypothesisSchema,
  BusinessGoalSchema,
  ExecutivePriorityLevelSchema,
} from '../types';

// ============================================================================
// 1. BUSINESS DOMAINS & RELATIONSHIP PRIMITIVES
// ============================================================================

export const BusinessDomainSchema = z.enum([
  'REVENUE',
  'PIPELINE',
  'MARKETING',
  'SALES',
  'OPERATIONS',
  'CUSTOMER',
  'FINANCE',
  'GOVERNANCE',
  'GOALS',
]);
export type BusinessDomain = z.infer<typeof BusinessDomainSchema>;

export const DependencyTypeSchema = z.enum([
  'VERIFIED_DEPENDENCY',
  'OBSERVED_CORRELATION',
  'STRATEGIC_HYPOTHESIS',
  'INCONCLUSIVE',
]);
export type DependencyType = z.infer<typeof DependencyTypeSchema>;

export const EvidenceStrengthSchema = z.enum(['STRONG', 'MODERATE', 'WEAK', 'UNVERIFIED']);
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;

export const CrossDomainDependencySchema = z.object({
  id: z.string().optional(),
  sourceDomain: BusinessDomainSchema,
  sourceMetric: z.string().min(1),
  targetDomain: BusinessDomainSchema,
  targetMetric: z.string().min(1),
  relationshipType: DependencyTypeSchema,
  evidenceStrength: EvidenceStrengthSchema,
  confidence: z.number().min(0).max(100),
  elasticityCoefficient: z.number().optional().describe('Deterministic mathematical propagation factor if known'),
  rationale: z.string().min(1),
  falsificationCriteria: z.string().optional(),
});
export type CrossDomainDependency = z.infer<typeof CrossDomainDependencySchema>;

// ============================================================================
// 2. STRATEGIC HYPOTHESIS & SUPPORTING FACTS
// ============================================================================

export const StrategicHypothesisSchema = z.object({
  id: z.string().optional(),
  hypothesis: z.string().min(1),
  supportingFacts: z.array(z.string().or(ExecutiveFactSchema)),
  supportingMetrics: z.record(z.string(), z.number()).default({}),
  assumptions: z.array(z.string()).min(1),
  expectedImpact: z.string().min(1),
  affectedDomains: z.array(BusinessDomainSchema).min(1),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  confidenceScore: z.number().min(0).max(100),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  measurementPlan: z.string().min(1),
  historicalValidation: z.enum(['SUPPORTED', 'CONTRADICTED', 'NO_PRIOR_DATA']).default('NO_PRIOR_DATA'),
});
export type StrategicHypothesis = z.infer<typeof StrategicHypothesisSchema>;

// ============================================================================
// 3. SCENARIO SIMULATION SCHEMAS
// ============================================================================

export const ScenarioVariableTypeSchema = z.enum([
  'PERCENTAGE_CHANGE',
  'ABSOLUTE_CHANGE',
  'CAPACITY_CHANGE',
  'CONVERSION_CHANGE',
  'VOLUME_CHANGE',
]);
export type ScenarioVariableType = z.infer<typeof ScenarioVariableTypeSchema>;

export const ScenarioInputVariableSchema = z.object({
  metric: z.string().min(1),
  domain: BusinessDomainSchema,
  variableType: ScenarioVariableTypeSchema,
  baselineValue: z.number(),
  changeValue: z.number(),
  unit: z.string().default('%'),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});
export type ScenarioInputVariable = z.infer<typeof ScenarioInputVariableSchema>;

export const ScenarioSimulationRequestSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  targetGoalId: z.string().optional(),
  inputs: z.array(ScenarioInputVariableSchema).min(1),
  projectionWindowDays: z.number().int().positive().default(30),
});
export type ScenarioSimulationRequest = z.infer<typeof ScenarioSimulationRequestSchema>;

export const ProjectedMetricOutputSchema = z.object({
  metric: z.string(),
  domain: BusinessDomainSchema,
  baselineValue: z.number(),
  projectedValue: z.number(),
  deltaValue: z.number(),
  deltaPercentage: z.number(),
  confidence: z.number().min(0).max(100).nullable(),
  uncertaintyRange: z.object({
    lowerBound: z.number().nullable(),
    upperBound: z.number().nullable(),
  }),
});
export type ProjectedMetricOutput = z.infer<typeof ProjectedMetricOutputSchema>;

export const PropagatedEffectSchema = z.object({
  sourceMetric: z.string(),
  targetMetric: z.string(),
  targetDomain: BusinessDomainSchema,
  impactDescription: z.string(),
  projectedDeltaPct: z.number().nullable(),
  propagationStatus: z.enum(['DETERMINISTIC_PROJECTION', 'ESTIMATED_RANGE', 'UNKNOWN']),
  rationale: z.string(),
});
export type PropagatedEffect = z.infer<typeof PropagatedEffectSchema>;

export const ScenarioSimulationResultSchema = z.object({
  scenarioId: z.string(),
  title: z.string(),
  organizationId: z.string(),
  simulatedAt: z.date().or(z.string()),
  inputs: z.array(ScenarioInputVariableSchema),
  baselineSnapshot: z.record(z.string(), z.number()),
  projectedMetrics: z.array(ProjectedMetricOutputSchema),
  propagatedEffects: z.array(PropagatedEffectSchema),
  projectedHealthScore: z.number().min(0).max(100),
  healthScoreDelta: z.number(),
  assumptions: z.array(z.string()),
  uncertainties: z.array(z.string()),
  riskScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
});
export type ScenarioSimulationResult = z.infer<typeof ScenarioSimulationResultSchema>;

// ============================================================================
// 4. STRATEGIC OPTIONS & SCORING SCHEMAS
// ============================================================================

export const StrategicOptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  domain: BusinessDomainSchema,
  description: z.string().min(1),
  objective: z.string().min(1),
  expectedImpact: z.number().min(0).max(100).describe('Normalized 0-100 impact on key business goals'),
  goalAlignment: z.number().min(0).max(100).describe('Normalized 0-100 alignment with active goals'),
  evidenceStrength: z.number().min(0).max(100).describe('Normalized 0-100 empirical backing from outcomes'),
  confidence: z.number().min(0).max(100).describe('Normalized 0-100 confidence'),
  risk: z.number().min(0).max(100).describe('Normalized 0-100 risk score'),
  operationalPressure: z.number().min(0).max(100).describe('Normalized 0-100 capacity overhead'),
  strategicScore: z.number().min(0).max(100).describe('Deterministic weighted strategic score'),
  projectedOutcomes: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  actionProposal: z.object({
    actionName: z.string(),
    actionArgs: z.record(z.string(), z.any()),
    requiresApproval: z.boolean().default(true),
  }),
});
export type StrategicOption = z.infer<typeof StrategicOptionSchema>;

export const StrategyComparisonResultSchema = z.object({
  organizationId: z.string(),
  evaluatedAt: z.date().or(z.string()),
  options: z.array(StrategicOptionSchema),
  recommendedOptionId: z.string(),
  rankingRationale: z.string(),
  historicalContextInsights: z.array(z.string()),
});
export type StrategyComparisonResult = z.infer<typeof StrategyComparisonResultSchema>;

// ============================================================================
// 5. STRATEGIC RECOMMENDATION & COMPREHENSIVE ANALYSIS
// ============================================================================

export const StrategicRecommendationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  objective: z.string().min(1),
  primaryDomain: BusinessDomainSchema,
  secondaryDomains: z.array(BusinessDomainSchema).default([]),
  strategicHypothesis: StrategicHypothesisSchema,
  selectedOption: StrategicOptionSchema,
  alternativeOptions: z.array(StrategicOptionSchema),
  supportingFacts: z.array(z.string()),
  scenarioProjection: ScenarioSimulationResultSchema.optional(),
  historicalValidationSummary: z.string(),
  refutedHypothesisWarnings: z.array(z.string()).default([]),
  measurementPlan: z.string(),
  recommendedNextStep: z.string(),
  requiresHumanApproval: z.boolean().default(true),
  governanceVerdict: z.string().optional(),
  governanceExplanation: z.string().optional(),
});
export type StrategicRecommendation = z.infer<typeof StrategicRecommendationSchema>;

export const MultiDomainStrategyAnalysisSchema = z.object({
  organizationId: z.string(),
  analyzedAt: z.date().or(z.string()),
  crossDomainSignals: z.array(
    z.object({
      domain: BusinessDomainSchema,
      status: z.enum(['HEALTHY', 'STABLE', 'ATTENTION_NEEDED', 'CRITICAL_RISK']),
      primaryMetric: z.string(),
      currentValue: z.number(),
      trend: z.enum(['INCREASING', 'DECREASING', 'STABLE']),
    })
  ),
  dependencies: z.array(CrossDomainDependencySchema),
  strategicHypotheses: z.array(StrategicHypothesisSchema),
  strategicOptions: z.array(StrategicOptionSchema),
  recommendedStrategy: StrategicRecommendationSchema.nullable().optional(),
  refutedHypotheses: z.array(z.string()).default([]),
  governedOptions: z.array(z.any()).optional(),
  governanceSummary: z.record(z.string(), z.any()).optional(),
});
export type MultiDomainStrategyAnalysis = z.infer<typeof MultiDomainStrategyAnalysisSchema>;

// ============================================================================
// 6. PHASE 43: DETERMINISTIC STRATEGIC PRIORITY & RISK
// ============================================================================

export const StrategicPriorityCategorySchema = z.enum([
  'REVENUE',
  'GROWTH',
  'LEAD_GENERATION',
  'CONVERSION',
  'CUSTOMER_RETENTION',
  'OPERATIONS',
  'DATA_QUALITY',
  'INTEGRATION_HEALTH',
  'GOAL_PERFORMANCE',
]);
export type StrategicPriorityCategory = z.infer<typeof StrategicPriorityCategorySchema>;

export const StrategicRiskTypeSchema = z.enum([
  'GOAL_MISS',
  'GOAL_AT_RISK',
  'FORECAST_DECLINE',
  'KPI_DECLINE',
  'DATA_STALENESS',
  'DATA_CONFLICT',
  'INTEGRATION_FAILURE',
  'PERSISTENT_UNDERPERFORMANCE',
]);
export type StrategicRiskType = z.infer<typeof StrategicRiskTypeSchema>;

export const StrategicRiskSchema = z.object({
  id: z.string(),
  type: StrategicRiskTypeSchema,
  category: StrategicPriorityCategorySchema,
  description: z.string(),
  severity: ExecutivePriorityLevelSchema,
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  sourceMetrics: z.array(z.string()).default([]),
  sourceGoals: z.array(z.string()).default([]),
  measurementRisk: z.boolean().default(false), // True if data quality/integration issue
});
export type StrategicRisk = z.infer<typeof StrategicRiskSchema>;

export const StrategicPrioritySchema = z.object({
  id: z.string(),
  category: StrategicPriorityCategorySchema,
  priority: ExecutivePriorityLevelSchema,
  impact: z.number().min(0).max(100),
  urgency: z.number().min(0).max(100),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  description: z.string(),
  sourceMetrics: z.array(z.string()).default([]),
  sourceGoals: z.array(z.string()).default([]),
  relatedRisks: z.array(z.string()).default([]), // IDs of StrategicRisk
});
export type StrategicPriority = z.infer<typeof StrategicPrioritySchema>;

export const Phase43StrategicRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: ExecutivePriorityLevelSchema,
  category: StrategicPriorityCategorySchema,
  focusAreas: z.array(z.string()),
  addressedRisks: z.array(z.string()).default([]),
  addressedPriorities: z.array(z.string()).default([]),
  status: z.enum(['DRAFT']),
});
export type Phase43StrategicRecommendation = z.infer<typeof Phase43StrategicRecommendationSchema>;
