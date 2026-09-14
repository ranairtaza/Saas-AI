import { z } from 'zod';
import {
  ExecutiveFactSchema,
  ExecutiveObservationSchema,
  ExecutiveHypothesisSchema,
  ExecutivePriorityLevelSchema,
} from '../types';

// ============================================================================
// 1. EVENT DOMAIN & SEVERITY ENUMS
// ============================================================================

export const EventDomainSchema = z.enum([
  'REVENUE',
  'MARKETING',
  'OPERATIONS',
  'FINANCE',
  'CUSTOMER_SUCCESS',
  'GOVERNANCE',
]);

export type EventDomain = z.infer<typeof EventDomainSchema>;

export const EventSeveritySchema = z.enum([
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export type EventSeverity = z.infer<typeof EventSeveritySchema>;

export const EventTypeSchema = z.enum([
  'REVENUE_PACING_LAG',
  'PIPELINE_VELOCITY_DROP',
  'UNASSIGNED_HIGH_VALUE_LEAD',
  'GOAL_STATUS_DEGRADED',
  'GOAL_AT_RISK',
  'GOAL_BEHIND',
  'ENRICHMENT_CONFLICT',
  'HIGH_VALUE_LEAD_DISCOVERED',
  'PENDING_ACTION_APPROVED',
  'PENDING_ACTION_REJECTED',
  'METRIC_ANOMALY_DETECTED',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const EventDeduplicationStateSchema = z.enum([
  'NEW',
  'DUPLICATE',
  'UPDATED',
  'RESOLVED',
]);

export type EventDeduplicationState = z.infer<typeof EventDeduplicationStateSchema>;

// ============================================================================
// 2. EXECUTIVE EVENT SCHEMAS
// ============================================================================

export const ExecutiveEventSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().min(1),
  eventType: EventTypeSchema,
  domain: EventDomainSchema,
  severity: EventSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceTable: z.string().min(1),
  sourceRecordId: z.string().nullable().optional(),
  facts: z.array(z.string().or(ExecutiveFactSchema)),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  fingerprint: z.string().optional().nullable(),
  occurredAt: z.date().or(z.string()),
  createdAt: z.date().or(z.string()).optional(),
  processed: z.boolean().default(false),
  processedAt: z.date().or(z.string()).nullable().optional(),
  resolved: z.boolean().default(false),
  resolvedAt: z.date().or(z.string()).nullable().optional(),
});

export type ExecutiveEventData = z.infer<typeof ExecutiveEventSchema>;

// ============================================================================
// 3. BUSINESS HEALTH EVALUATOR SCHEMAS
// ============================================================================

export const DomainHealthSchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(['HEALTHY', 'STABLE', 'ATTENTION_NEEDED', 'CRITICAL_RISK']),
  weight: z.number().min(0).max(1),
  rationale: z.string(),
  factors: z.array(z.string()),
});

export type DomainHealth = z.infer<typeof DomainHealthSchema>;

export const BusinessHealthSchema = z.object({
  overallScore: z.number().min(0).max(100),
  status: z.enum(['HEALTHY', 'STABLE', 'ATTENTION_NEEDED', 'CRITICAL_RISK']),
  evaluatedAt: z.date().or(z.string()),
  domains: z.object({
    revenue: DomainHealthSchema,
    pipeline: DomainHealthSchema,
    goals: DomainHealthSchema,
    operations: DomainHealthSchema,
  }),
  summary: z.string(),
});

export type BusinessHealth = z.infer<typeof BusinessHealthSchema>;

// ============================================================================
// 4. EXECUTIVE OBSERVATION RESULT SCHEMA
// ============================================================================

export const ExecutiveObservationResultSchema = z.object({
  organizationId: z.string().min(1),
  observedAt: z.date().or(z.string()),
  verifiedFacts: z.array(z.string().or(ExecutiveFactSchema)),
  observations: z.array(z.string().or(ExecutiveObservationSchema)),
  hypotheses: z.array(ExecutiveHypothesisSchema),
  activeEventCount: z.number(),
  criticalEventCount: z.number(),
});

export type ExecutiveObservationResult = z.infer<typeof ExecutiveObservationResultSchema>;

// ============================================================================
// 5. EXECUTIVE BRIEFING SCHEMA
// ============================================================================

export const ExecutiveBriefingSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().min(1),
  generatedAt: z.date().or(z.string()),
  health: BusinessHealthSchema,
  executiveSummary: z.string().min(1),
  topPriorities: z.array(
    z.object({
      priorityLevel: ExecutivePriorityLevelSchema,
      title: z.string(),
      summary: z.string(),
      impact: z.string(),
      actionAvailable: z.boolean().default(false),
      recommendationId: z.string().optional(),
    })
  ),
  keyChanges: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  recommendedActions: z.array(
    z.object({
      actionName: z.string(),
      description: z.string(),
      riskLevel: z.string(),
      requiresApproval: z.boolean(),
      recommendationId: z.string().optional(),
    })
  ),
  supportingFacts: z.array(z.string().or(ExecutiveFactSchema)),
  observations: z.array(z.string().or(ExecutiveObservationSchema)).optional(),
  hypotheses: z.array(ExecutiveHypothesisSchema).optional(),
  generatedBy: z.enum(['AI', 'DETERMINISTIC_FALLBACK']).default('AI'),
});

export type ExecutiveBriefing = z.infer<typeof ExecutiveBriefingSchema>;
