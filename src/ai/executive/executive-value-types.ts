import { z } from 'zod';

// ============================================================================
// 1. EVIDENCE SUFFICIENCY
// ============================================================================

export const EvidenceSufficiencySchema = z.enum([
  'SUFFICIENT',
  'PARTIAL',
  'INSUFFICIENT',
]);
export type EvidenceSufficiency = z.infer<typeof EvidenceSufficiencySchema>;

// ============================================================================
// 2. VALUE CATEGORY DISTINCTION
// ============================================================================

export const ValueCategorySchema = z.enum([
  'ACTUAL',
  'FORECAST',
  'EXPECTED',
  'ESTIMATED',
  'INSUFFICIENT_EVIDENCE',
]);
export type ValueCategory = z.infer<typeof ValueCategorySchema>;

// ============================================================================
// 3. EXECUTIVE INSIGHT EXPLANATION (WHAT / WHY / SO_WHAT / NOW_WHAT)
// ============================================================================

export const ExecutiveInsightExplanationSchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  soWhat: z.string().min(1),
  nowWhat: z.string().min(1),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']),
  evidenceSufficiency: EvidenceSufficiencySchema,
});
export type ExecutiveInsightExplanation = z.infer<typeof ExecutiveInsightExplanationSchema>;

// ============================================================================
// 4. EXECUTIVE OPPORTUNITY
// ============================================================================

export const ExecutiveOpportunitySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  domain: z.string(),
  category: z.enum([
    'PIPELINE_GROWTH',
    'LEAD_FOLLOW_UP',
    'CONVERSION_IMPROVEMENT',
    'CUSTOMER_ACTIVITY',
    'CAPACITY',
    'OPERATIONAL_IMPROVEMENT',
  ]),
  businessImpact: z.string(),
  impactValueCategory: ValueCategorySchema,
  estimatedImpactValue: z.number().optional(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']),
  evidenceSufficiency: EvidenceSufficiencySchema,
  sourceIds: z.array(z.string()),
  explanation: ExecutiveInsightExplanationSchema,
});
export type ExecutiveOpportunity = z.infer<typeof ExecutiveOpportunitySchema>;

// ============================================================================
// 5. EXECUTIVE RISK
// ============================================================================

export const ExecutiveRiskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  domain: z.string(),
  category: z.enum([
    'REVENUE_DECLINE',
    'PIPELINE_DETERIORATION',
    'LEAD_QUALITY_DETERIORATION',
    'CONVERSION_DETERIORATION',
    'OPERATIONAL_RISK',
    'FORECAST_UNCERTAINTY',
    'INSUFFICIENT_TELEMETRY',
    'GOVERNANCE_BLOCK',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  businessImpact: z.string(),
  impactValueCategory: ValueCategorySchema,
  estimatedImpactValue: z.number().optional(),
  consequenceOfInaction: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']),
  evidenceSufficiency: EvidenceSufficiencySchema,
  sourceIds: z.array(z.string()),
  explanation: ExecutiveInsightExplanationSchema,
});
export type ExecutiveRisk = z.infer<typeof ExecutiveRiskSchema>;

// ============================================================================
// 6. EXECUTIVE ATTENTION ITEM (§5 Full Model)
// ============================================================================

export const ExecutiveAttentionItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  domain: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  whyNow: z.string().min(1),
  businessImpact: z.string(),
  evidence: z.array(z.string()),
  sourceIds: z.array(z.string()),
  currentState: z.string(),
  forecastState: z.string().optional(),
  risk: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']),
  governanceVerdict: z.string().optional(),
  requiredAuthority: z.string().optional(),
  relatedDecisionId: z.string().optional(),
  relatedActionPlanId: z.string().optional(),
  consequenceOfInaction: z.string(),
  recommendedReview: z.string(),
  evidenceSufficiency: EvidenceSufficiencySchema,
});
export type ExecutiveAttentionItem = z.infer<typeof ExecutiveAttentionItemSchema>;

// ============================================================================
// 7. EXECUTIVE PRIORITY
// ============================================================================

export const ExecutivePriorityItemSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  title: z.string().min(1),
  domain: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  source: z.enum(['DECISION', 'ACTION_PLAN', 'FORECAST', 'LEARNING_SIGNAL', 'TELEMETRY']),
  sourceId: z.string(),
  governanceVerdict: z.string().optional(),
  isActionable: z.boolean(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']),
  evidenceSufficiency: EvidenceSufficiencySchema,
});
export type ExecutivePriorityItem = z.infer<typeof ExecutivePriorityItemSchema>;

// ============================================================================
// 8. COMMERCIAL VALUE SIGNALS
// ============================================================================

export const CommercialValueSignalsSchema = z.object({
  opportunitiesIdentified: z.number().int().min(0),
  risksIdentified: z.number().int().min(0),
  decisionsSupported: z.number().int().min(0),
  actionsRecommended: z.number().int().min(0),
  forecastsGenerated: z.number().int().min(0),
  learningSignalsProcessed: z.number().int().min(0),
  governanceChecksPerformed: z.number().int().min(0),
  attentionItemsSurfaced: z.number().int().min(0),
  estimatedValueCreated: z.string().optional(),
  roiEvidenceSufficiency: z.enum(['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT_CAUSAL_EVIDENCE']).default('INSUFFICIENT_CAUSAL_EVIDENCE'),
  evidenceDisclaimer: z.string().default(
    'Value signals represent system activity counts. Causal business ROI requires sufficient operational history and cannot be claimed without verified outcome data.'
  ),
});
export type CommercialValueSignals = z.infer<typeof CommercialValueSignalsSchema>;

// ============================================================================
// 9. EXECUTIVE BRIEFING SUMMARY (Enhanced)
// ============================================================================

export const ExecutiveBriefingSummarySchema = z.object({
  overallState: z.string(),
  strongestOpportunity: z.string().optional(),
  highestRisk: z.string().optional(),
  mostImportantChange: z.string().optional(),
  forecastDirection: z.string().optional(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']),
  comparisonAvailable: z.boolean(),
  comparisonNote: z.string().optional(),
});
export type ExecutiveBriefingSummary = z.infer<typeof ExecutiveBriefingSummarySchema>;

// ============================================================================
// 10. ROOT: EXECUTIVE VALUE SYNTHESIS
// ============================================================================

export const ExecutiveValueSynthesisSchema = z.object({
  organizationId: z.string(),
  synthesizedAt: z.string().datetime().or(z.date()),
  health: z.object({
    overallScore: z.number().min(0).max(100),
    status: z.enum(['HEALTHY', 'STABLE', 'ATTENTION_NEEDED', 'CRITICAL_RISK']),
    domains: z.record(z.string(), z.object({
      score: z.number().min(0).max(100),
      status: z.string(),
      factors: z.array(z.string()),
    })),
  }),
  opportunities: z.array(ExecutiveOpportunitySchema),
  risks: z.array(ExecutiveRiskSchema),
  priorities: z.array(ExecutivePriorityItemSchema),
  attentionItems: z.array(ExecutiveAttentionItemSchema),
  briefingSummary: ExecutiveBriefingSummarySchema,
  commercialValueSignals: CommercialValueSignalsSchema,
  overallEvidenceSufficiency: EvidenceSufficiencySchema,
});
export type ExecutiveValueSynthesis = z.infer<typeof ExecutiveValueSynthesisSchema>;
