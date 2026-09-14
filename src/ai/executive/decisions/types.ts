import { z } from 'zod';
import { BusinessDomainSchema } from '../strategy/types';
import { GovernanceVerdictSchema } from '../governance/types';

// ============================================================================
// 1. DECISION ENUMS & PRIMITIVES
// ============================================================================

export const DecisionStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DEFERRED',
  'EXPIRED',
  'CANCELLED',
  'BLOCKED',
]);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionTypeSchema = z.enum([
  'STRATEGIC',
  'OPERATIONAL',
  'FINANCIAL',
  'RISK',
  'ESCALATION',
]);
export type DecisionType = z.infer<typeof DecisionTypeSchema>;

export const DecisionAuthoritySchema = z.enum([
  'NONE',
  'MANAGER',
  'EXECUTIVE',
  'EXPLICIT_HUMAN',
]);
export type DecisionAuthority = z.infer<typeof DecisionAuthoritySchema>;

export const DecisionPrioritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);
export type DecisionPriority = z.infer<typeof DecisionPrioritySchema>;

export const DecisionAuditEventSchema = z.enum([
  'DECISION_CREATED',
  'DECISION_VIEWED',
  'DECISION_APPROVED',
  'DECISION_REJECTED',
  'DECISION_DEFERRED',
  'DECISION_EXPIRED',
  'DECISION_CANCELLED',
  'GOVERNANCE_BLOCKED',
]);
export type DecisionAuditEvent = z.infer<typeof DecisionAuditEventSchema>;


// ============================================================================
// 2. DECISION RECORDS & AUDIT SCHEMAS
// ============================================================================

export const ExecutiveDecisionAuditRecordSchema = z.object({
  id: z.string(),
  decisionId: z.string(),
  organizationId: z.string(),
  actorUserId: z.string().nullable().optional(),
  event: DecisionAuditEventSchema,
  fromStatus: DecisionStatusSchema.nullable().optional(),
  toStatus: DecisionStatusSchema,
  reason: z.string().nullable().optional(),
  policyVersion: z.number().int().default(1),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type ExecutiveDecisionAuditRecord = z.infer<typeof ExecutiveDecisionAuditRecordSchema>;

export const ExecutiveDecisionRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  strategyId: z.string().nullable().optional(),
  recommendationId: z.string().nullable().optional(),
  pendingActionId: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string(),
  domain: BusinessDomainSchema,
  decisionType: DecisionTypeSchema,
  status: DecisionStatusSchema,
  priority: DecisionPrioritySchema,
  requiredAuthority: DecisionAuthoritySchema,
  governanceVerdict: GovernanceVerdictSchema,
  governanceExplanation: z.string(),
  policyVersion: z.number().int().default(1),
  riskScore: z.number().min(0).max(100).default(0),
  financialExposure: z.number().nonnegative().default(0),
  evidenceConfidence: z.number().min(0).max(100).default(0),
  requestedByUserId: z.string().nullable().optional(),
  decidedByUserId: z.string().nullable().optional(),
  decisionReason: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  decidedAt: z.date().or(z.string()).nullable().optional(),
  expiresAt: z.date().or(z.string()).nullable().optional(),
  auditHistory: z.array(ExecutiveDecisionAuditRecordSchema).optional().default([]),
});
export type ExecutiveDecisionRecord = z.infer<typeof ExecutiveDecisionRecordSchema>;

// ============================================================================
// 3. MUTATION REQUEST SCHEMAS
// ============================================================================

export const CreateDecisionInputSchema = z.object({
  organizationId: z.string(),
  strategyId: z.string().optional(),
  recommendationId: z.string().optional(),
  title: z.string().min(1),
  description: z.string(),
  domain: BusinessDomainSchema,
  decisionType: DecisionTypeSchema.default('STRATEGIC'),
  priority: DecisionPrioritySchema.default('MEDIUM'),
  governanceVerdict: GovernanceVerdictSchema,
  governanceExplanation: z.string(),
  policyVersion: z.number().int().default(1),
  riskScore: z.number().min(0).max(100).default(0),
  financialExposure: z.number().nonnegative().default(0),
  evidenceConfidence: z.number().min(0).max(100).default(0),
  actionProposal: z.object({
    actionName: z.string(),
    actionArgs: z.record(z.string(), z.any()),
    requiresApproval: z.boolean().default(true),
  }).optional(),
  requestedByUserId: z.string().optional(),
  expiresInDays: z.number().positive().optional().default(7),
});
export type CreateDecisionInput = z.infer<typeof CreateDecisionInputSchema>;

export const ApproveDecisionInputSchema = z.object({
  decidedByUserId: z.string(),
  userRole: z.string(),
  decisionReason: z.string().optional(),
  conversationId: z.string().optional(),
  stagePendingAction: z.boolean().default(true),
});
export type ApproveDecisionInput = z.infer<typeof ApproveDecisionInputSchema>;

export const RejectDecisionInputSchema = z.object({
  decidedByUserId: z.string(),
  userRole: z.string(),
  rejectionReason: z.string().min(1),
});
export type RejectDecisionInput = z.infer<typeof RejectDecisionInputSchema>;

export const DeferDecisionInputSchema = z.object({
  decidedByUserId: z.string(),
  userRole: z.string(),
  deferralReason: z.string().min(1),
  deferUntil: z.date().or(z.string()).optional(),
});
export type DeferDecisionInput = z.infer<typeof DeferDecisionInputSchema>;
