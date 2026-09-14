import { z } from 'zod';

// ============================================================================
// 1. EPISTEMIC SEPARATION PRIMITIVES (FACT, OBSERVATION, HYPOTHESIS)
// ============================================================================

export const ExecutiveFactSchema = z.object({
  id: z.string().uuid().optional(),
  statement: z.string().min(1, 'Fact statement is required'),
  sourceTable: z.string().describe('Originating database table or authoritative provider'),
  sourceField: z.string().optional(),
  value: z.any(),
  observedAt: z.string().datetime().or(z.date()),
});

export type ExecutiveFact = z.infer<typeof ExecutiveFactSchema>;

export const ExecutiveObservationSchema = z.object({
  id: z.string().uuid().optional(),
  statement: z.string().min(1, 'Observation statement is required'),
  derivedFromFacts: z.array(z.string()).describe('References to fact statements or IDs'),
  metricCategory: z.enum(['FINANCIAL', 'PIPELINE', 'CONVERSION', 'OPERATIONAL', 'GOAL_ALIGNMENT']),
});

export type ExecutiveObservation = z.infer<typeof ExecutiveObservationSchema>;

export const ExecutiveHypothesisSchema = z.object({
  id: z.string().uuid().optional(),
  hypothesis: z.string().min(1, 'Hypothesis statement is required'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Mandatory confidence rating for hypotheses'),
  confidenceRationale: z.string().describe('Evidence-grounded rationale for confidence level'),
  supportingObservations: z.array(z.string()),
  falsificationCriteria: z.string().optional().describe('Condition under which this hypothesis would be invalidated'),
});

export type ExecutiveHypothesis = z.infer<typeof ExecutiveHypothesisSchema>;

// ============================================================================
// 2. BUSINESS GOALS & KPI SCHEMAS
// ============================================================================

export const BusinessGoalStatusSchema = z.enum(['ON_TRACK', 'AT_RISK', 'BEHIND', 'ACHIEVED', 'DRAFT', 'MISSED', 'CANCELLED']);
export type BusinessGoalStatus = z.infer<typeof BusinessGoalStatusSchema>;

export const BusinessGoalSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  title: z.string().min(1),
  kpiKey: z.string().min(1),
  targetValue: z.number(),
  currentValue: z.number().default(0),
  unit: z.enum(['CURRENCY', 'COUNT', 'PERCENTAGE', 'RATIO']).or(z.string()),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  status: BusinessGoalStatusSchema.default('ON_TRACK'),
  source: z.enum(['USER_DEFINED', 'IMPORTED', 'SYSTEM_RECOMMENDED']).default('USER_DEFINED'),
  period: z.enum(['MONTH', 'QUARTER', 'YEAR', 'CUSTOM']).default('CUSTOM'),
  progressPct: z.number().min(0).max(100).optional(),
  gapValue: z.number().optional(),
  timeElapsedPct: z.number().min(0).max(100).optional(),
});

export type BusinessGoalData = z.infer<typeof BusinessGoalSchema>;

// ============================================================================
// 2.5 PLANNING & TARGET GAP SCHEMAS (PHASE 42)
// ============================================================================

export const GoalOutlookSchema = z.enum(['ON_TRACK', 'AT_RISK', 'LIKELY_TO_MISS', 'INSUFFICIENT_DATA']);
export type GoalOutlook = z.infer<typeof GoalOutlookSchema>;

export const PlanningGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  kpiKey: z.string(),
  targetValue: z.number(),
  actualValue: z.number().nullable(),
  forecastValue: z.number().nullable(),
  progressPct: z.number().nullable(),
  actualGap: z.number().nullable(),
  forecastGap: z.number().nullable(),
  outlook: GoalOutlookSchema,
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  source: z.string(),
  period: z.string(),
});

export type PlanningGoal = z.infer<typeof PlanningGoalSchema>;

// ============================================================================
// 3. EXECUTIVE MEMORY SCHEMAS
// ============================================================================

export const ExecutiveMemoryCategorySchema = z.enum([
  'STRATEGY',
  'DECISION',
  'ANOMALY_RESOLUTION',
  'POLICY',
  'MARKET_INSIGHT',
]);
export type ExecutiveMemoryCategory = z.infer<typeof ExecutiveMemoryCategorySchema>;

export const ExecutiveMemoryEntrySchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  category: ExecutiveMemoryCategorySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  facts: z.array(z.string()).default([]),
  observations: z.array(z.string()).default([]),
  outcome: z.string().optional(),
  sourceActionId: z.string().optional(),
  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});

export type ExecutiveMemoryEntryData = z.infer<typeof ExecutiveMemoryEntrySchema>;

// ============================================================================
// 4. DETERMINISTIC PRIORITY & ACTION PROPOSAL SCHEMAS
// ============================================================================

export const ExecutivePriorityLevelSchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type ExecutivePriorityLevel = z.infer<typeof ExecutivePriorityLevelSchema>;

export const ExecutivePriorityInputSchema = z.object({
  revenueExposure: z.number().min(0).max(100).describe('Normalized scale 0-100 of direct financial impact'),
  urgency: z.number().min(0).max(100).describe('Normalized scale 0-100 of time sensitivity'),
  goalAlignment: z.number().min(0).max(100).describe('Normalized scale 0-100 of impact on active business goals'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.number().min(0).max(100)).describe('Confidence rating or weight'),
});

export type ExecutivePriorityInput = z.infer<typeof ExecutivePriorityInputSchema>;

export const ExecutiveActionProposalSchema = z.object({
  actionName: z.string().min(1),
  actionArgs: z.record(z.string(), z.any()),
  humanDescription: z.string().min(1),
  riskLevel: z.enum(['READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  requiresApproval: z.boolean().default(true),
});

export type ExecutiveActionProposal = z.infer<typeof ExecutiveActionProposalSchema>;

// ============================================================================
// 5. EXECUTIVE RECOMMENDATION SCHEMA
// ============================================================================

export const ExecutiveRecommendationStatusSchema = z.enum([
  'ACTIVE',
  'PROPOSED',
  'APPROVED',
  'DISMISSED',
  'EXPIRED',
]);
export type ExecutiveRecommendationStatus = z.infer<typeof ExecutiveRecommendationStatusSchema>;

export const ExecutiveRecommendationSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string(),
  domain: z.enum(['REVENUE', 'MARKETING', 'OPERATIONS', 'FINANCE']).default('REVENUE'),
  priorityScore: z.number().min(0).max(100),
  priorityLevel: ExecutivePriorityLevelSchema,
  title: z.string().min(1),
  executiveSummary: z.string().min(1),
  reasoning: z.object({
    facts: z.array(z.string()).min(1, 'At least one verified fact is required'),
    observations: z.array(z.string()).min(1, 'At least one observation is required'),
    hypotheses: z.array(ExecutiveHypothesisSchema).min(1, 'At least one hypothesis is required'),
  }),
  expectedImpact: z.string().min(1),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  actionProposal: ExecutiveActionProposalSchema,
  status: ExecutiveRecommendationStatusSchema.default('ACTIVE'),
  pendingActionId: z.string().optional().nullable(),
  createdAt: z.string().datetime().or(z.date()).optional(),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
});

export type ExecutiveRecommendationData = z.infer<typeof ExecutiveRecommendationSchema>;

// ============================================================================
// 6. BUSINESS CONTEXT SCHEMA
// ============================================================================

export const BusinessContextSchema = z.object({
  organizationId: z.string(),
  identity: z.object({
    name: z.string(),
    industry: z.string().default('General Business'),
    businessModel: z.string().default('B2B SaaS'),
    targetMarket: z.string().default('Enterprise / Mid-Market'),
    operatingPriorities: z.string().default('Grow Revenue'),
    operatingCurrency: z.string().default('USD'),
    timezone: z.string().default('UTC'),
  }),
  telemetry: z.object({
    metrics: z.object({
      revenueMTD: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('CURRENCY'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      revenueLastMonth: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('CURRENCY'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      revenueGrowth: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('PERCENTAGE'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }).optional(),
      transactionsMTD: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      newCustomersMTD: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      activeSubscriptions: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      totalLeads: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      qualifiedLeads: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      activeLeadsCount: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      unassignedHighPriorityLeads: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('COUNT'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
      pipelineValue: z.object({
        value: z.number().nullable().default(null),
        unit: z.string().default('CURRENCY'),
        source: z.string().default('NONE'),
        freshness: z.string().default('UNAVAILABLE'),
        lastUpdatedAt: z.string().datetime().or(z.date()).nullable(),
      }),
    }),
    recentAnomalies: z.array(
      z.object({
        metric: z.string(),
        deviationPct: z.number(),
        description: z.string(),
      })
    ).default([]),
    dataFreshness: z.array(
      z.object({
        provider: z.string(),
        status: z.string(),
        freshness: z.string(),
        lastSuccessfulSyncAt: z.string().datetime().or(z.date()).nullable(),
      })
    ).default([]),
  }),
  goals: z.array(BusinessGoalSchema).default([]),
  planning: z.object({
    goals: z.array(PlanningGoalSchema).default([]),
    priorities: z.array(z.any()).default([]), // For executive priorities
  }).optional(),
  recentMemories: z.array(ExecutiveMemoryEntrySchema).default([]),
  policies: z.array(
    z.object({
      rule: z.string(),
      riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    })
  ).default([]),
  historicalPerformance: z
    .object({
      totalRecommendations: z.number().default(0),
      totalExecuted: z.number().default(0),
      totalMeasured: z.number().default(0),
      successRatePct: z.number().min(0).max(100).default(0),
      effectivenessScore: z.number().min(0).max(100).default(0),
      domainPerformance: z.record(z.string(), z.any()).default({}),
      topValidatedStrategies: z.array(z.string()).default([]),
      refutedHypotheses: z.array(z.string()).default([]),
      learningSignalsCount: z.number().optional(),
      strategyFeedback: z.array(z.any()).optional(),
    })
    .optional(),

  untrustedExternalData: z.array(z.string()).default([]),
  predictiveOutlook: z
    .object({
      forecasts: z.record(z.string(), z.any()).default({}),
      trends: z.record(z.string(), z.any()).default({}),
      anomalies: z.record(z.string(), z.any()).default({}),
      generatedAt: z.string().datetime().or(z.date()),
    })
    .optional(),
  strategy: z
    .object({
      priorities: z.array(z.any()).default([]),
      risks: z.array(z.any()).default([]),
      recommendations: z.array(z.any()).default([]),
    })
    .optional(),
  executionPlanning: z
    .object({
      initiatives: z.array(z.any()).default([]),
    })
    .optional(),
  assembledAt: z.string().datetime().or(z.date()),
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;
