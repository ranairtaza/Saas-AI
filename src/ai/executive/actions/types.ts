import { z } from 'zod';
import { GovernanceVerdictSchema, ApprovalAuthoritySchema } from '../governance/types';
import { ForecastDomainSchema, ForecastConfidenceSchema, ForecastHorizonSchema } from '../forecasting/types';

// ============================================================================
// 1. ACTION PLAN ENUMS & PRIMITIVES
// ============================================================================

export const ExecutiveActionTypeSchema = z.enum([
  'FOLLOW_UP_LEAD',
  'CONTACT_CUSTOMER',
  'REVIEW_PIPELINE',
  'INVESTIGATE_REVENUE_DROP',
  'ALLOCATE_CAPACITY',
  'REVIEW_MARKETING_PERFORMANCE',
  'REVIEW_OPERATIONAL_RISK',
  'REVIEW_STRATEGY',
  'REQUEST_HUMAN_DECISION',
]);
export type ExecutiveActionType = z.infer<typeof ExecutiveActionTypeSchema>;

export const ActionPlanStatusSchema = z.enum([
  'PROPOSED',
  'GOVERNANCE_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'DEFERRED',
  'EXECUTING',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'BLOCKED',
]);
export type ActionPlanStatus = z.infer<typeof ActionPlanStatusSchema>;

export const ActionPlanPrioritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);
export type ActionPlanPriority = z.infer<typeof ActionPlanPrioritySchema>;

export const ActionPlanUrgencySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);
export type ActionPlanUrgency = z.infer<typeof ActionPlanUrgencySchema>;

// ============================================================================
// 2. ACTION PLAN GROUNDED SCHEMAS
// ============================================================================

export const ActionEvidenceCitationSchema = z.object({
  sourceType: z.enum(['TELEMETRY', 'FORECAST', 'RISK_SIGNAL', 'LEARNING_SIGNAL', 'DECISION', 'GOAL']),
  sourceId: z.string().optional(),
  metric: z.string().optional(),
  detail: z.string(),
  value: z.any().optional(),
});
export type ActionEvidenceCitation = z.infer<typeof ActionEvidenceCitationSchema>;

export const ActionPayloadBridgeSchema = z.object({
  targetTool: z.string(),
  actionArgs: z.record(z.string(), z.any()),
  conversationId: z.string().optional(),
  leadId: z.string().optional(),
  humanDescription: z.string(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'SENSITIVE']).default('MEDIUM'),
});
export type ActionPayloadBridge = z.infer<typeof ActionPayloadBridgeSchema>;

// ============================================================================
// 3. INPUT & RECORD SCHEMAS
// ============================================================================

export const CreateActionPlanInputSchema = z.object({
  organizationId: z.string().min(1),
  decisionId: z.string().optional(),
  forecastId: z.string().optional(),
  learningSignalId: z.string().optional(),
  actionType: ExecutiveActionTypeSchema,
  domain: ForecastDomainSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  whyNow: z.string().min(1),
  evidence: z.array(ActionEvidenceCitationSchema).default([]),
  expectedImpact: z.string().min(1),
  expectedMetricChange: z.number().optional(),
  targetMetric: z.string().optional(),
  timeHorizon: ForecastHorizonSchema.default('MEDIUM_TERM'),
  expectedCost: z.number().min(0).default(0),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  urgency: ActionPlanUrgencySchema.default('MEDIUM'),
  priority: ActionPlanPrioritySchema.optional(),
  priorityScore: z.number().min(0).max(100).optional(),
  confidence: ForecastConfidenceSchema.default('MEDIUM'),
  governanceVerdict: GovernanceVerdictSchema,
  governanceExplanation: z.string(),
  requiredAuthority: ApprovalAuthoritySchema.default('MANAGER'),
  status: ActionPlanStatusSchema.default('PROPOSED'),
  idempotencyKey: z.string().min(1),
  dependencies: z.array(z.string()).optional().default([]),
  actionPayload: ActionPayloadBridgeSchema.optional(),
  expiresInDays: z.number().int().positive().optional().default(7),
});
export type CreateActionPlanInput = z.input<typeof CreateActionPlanInputSchema>;

export const ApproveActionPlanInputSchema = z.object({
  decidedByUserId: z.string().min(1),
  userRole: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY']),
  approvalReason: z.string().optional(),
  stagePendingAction: z.boolean().optional().default(true),
  conversationId: z.string().optional(),
});
export type ApproveActionPlanInput = z.input<typeof ApproveActionPlanInputSchema>;

export const RejectActionPlanInputSchema = z.object({
  decidedByUserId: z.string().min(1),
  userRole: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY']),
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});
export type RejectActionPlanInput = z.infer<typeof RejectActionPlanInputSchema>;

export const DeferActionPlanInputSchema = z.object({
  decidedByUserId: z.string().min(1),
  userRole: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY']),
  deferralReason: z.string().optional(),
});
export type DeferActionPlanInput = z.infer<typeof DeferActionPlanInputSchema>;

export const ExecutiveActionPlanRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  decisionId: z.string().nullable(),
  forecastId: z.string().nullable(),
  learningSignalId: z.string().nullable(),
  actionType: ExecutiveActionTypeSchema,
  domain: ForecastDomainSchema,
  title: z.string(),
  description: z.string(),
  whyNow: z.string(),
  evidence: z.string(),
  expectedImpact: z.string(),
  expectedMetricChange: z.number().nullable(),
  targetMetric: z.string().nullable(),
  timeHorizon: z.string(),
  expectedCost: z.number(),
  riskLevel: z.string(),
  urgency: z.string(),
  priority: ActionPlanPrioritySchema,
  priorityScore: z.number(),
  confidence: ForecastConfidenceSchema,
  governanceVerdict: GovernanceVerdictSchema,
  governanceExplanation: z.string(),
  requiredAuthority: ApprovalAuthoritySchema,
  status: ActionPlanStatusSchema,
  idempotencyKey: z.string(),
  dependencies: z.string(),
  actionPayload: z.string().nullable(),
  pendingActionId: z.string().nullable(),
  approvedByUserId: z.string().nullable(),
  approvedAt: z.date().nullable(),
  rejectionReason: z.string().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ExecutiveActionPlanRecord = z.infer<typeof ExecutiveActionPlanRecordSchema>;
