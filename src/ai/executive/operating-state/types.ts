import { z } from 'zod';
import {
  BusinessContextSchema,
  ExecutiveRecommendationSchema,
  BusinessGoalSchema
} from '../types';

export const ExecutiveOperatingStateSchema = z.object({
  organizationId: z.string(),
  timestamp: z.string().datetime().or(z.date()),
  
  // High-level context & telemetry
  businessContext: BusinessContextSchema.optional(),
  
  // Governance Constraints
  activeGovernancePolicy: z.object({
    policyVersion: z.number(),
    riskTolerance: z.string(),
    maxFinancialExposure: z.number(),
    restrictedDomains: z.array(z.string()),
    restrictedActions: z.array(z.string()),
  }).optional().nullable(),
  
  // Active Decisions
  activeDecisions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    domain: z.string(),
    decisionType: z.string(),
    status: z.string(),
    priority: z.string(),
    governanceVerdict: z.string(),
    createdAt: z.string().datetime().or(z.date()),
  })),
  
  // Recent Learning Signals
  recentLearningSignals: z.array(z.object({
    id: z.string(),
    domain: z.string(),
    metric: z.string(),
    varianceStatus: z.string(),
    effectiveness: z.string(),
    confidence: z.string(),
    hypothesisResult: z.string(),
    createdAt: z.string().datetime().or(z.date()),
  })),
  
  // Active Forecasts
  activeForecasts: z.array(z.object({
    id: z.string(),
    domain: z.string(),
    metric: z.string(),
    currentValue: z.number(),
    forecastValue: z.number(),
    forecastHorizon: z.string(),
    direction: z.string(),
    confidence: z.string(),
    createdAt: z.string().datetime().or(z.date()),
  })),
  
  // Strategic Action Plans
  actionPlans: z.array(z.object({
    id: z.string(),
    actionType: z.string(),
    domain: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string(),
    confidence: z.string(),
    expectedImpact: z.string(),
    governanceVerdict: z.string(),
    createdAt: z.string().datetime().or(z.date()),
  })),

  // Human-Gated Pending Actions
  pendingActions: z.array(z.object({
    id: z.string(),
    actionName: z.string(),
    actionType: z.string(),
    status: z.string(),
    riskLevel: z.string(),
    createdAt: z.string().datetime().or(z.date()),
  })),

  // Outcome Attributions
  recentOutcomeAttributions: z.array(z.object({
    id: z.string(),
    attributionStatus: z.string(),
    confidence: z.string(),
    targetMetric: z.string(),
    actualDeltaValue: z.number().nullable(),
    createdAt: z.string().datetime().or(z.date()),
  })).default([]),
});

export type ExecutiveOperatingState = z.infer<typeof ExecutiveOperatingStateSchema>;
