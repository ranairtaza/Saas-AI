import { z } from 'zod';
import { BusinessDomainSchema } from '../strategy/types';

// ============================================================================
// 1. GOVERNANCE VERDICTS & PRIMITIVES
// ============================================================================

export const GovernanceVerdictSchema = z.enum([
  'ALLOWED',
  'ALLOWED_WITH_WARNING',
  'REQUIRES_ESCALATION',
  'BLOCKED',
  'INSUFFICIENT_EVIDENCE',
]);
export type GovernanceVerdict = z.infer<typeof GovernanceVerdictSchema>;

export const RiskToleranceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

export const CapacityStatusSchema = z.enum([
  'CAPACITY_AVAILABLE',
  'CAPACITY_PRESSURED',
  'CAPACITY_EXCEEDED',
  'UNKNOWN',
]);
export type CapacityStatus = z.infer<typeof CapacityStatusSchema>;

export const GoalAlignmentStatusSchema = z.enum([
  'ALIGNED',
  'PARTIALLY_ALIGNED',
  'CONFLICTING',
  'UNKNOWN',
]);
export type GoalAlignmentStatus = z.infer<typeof GoalAlignmentStatusSchema>;

export const ApprovalAuthoritySchema = z.enum([
  'NONE',
  'MANAGER',
  'EXECUTIVE',
  'EXPLICIT_HUMAN',
]);
export type ApprovalAuthority = z.infer<typeof ApprovalAuthoritySchema>;

// ============================================================================
// 2. GOVERNANCE POLICY CONFIGURATION SCHEMA
// ============================================================================

export const ExecutiveGovernancePolicySchema = z.object({
  id: z.string().optional(),
  organizationId: z.string(),
  riskTolerance: RiskToleranceSchema.default('MEDIUM'),
  maxFinancialExposure: z.number().nonnegative().default(10000),
  maxLeadCapacityPerRep: z.number().int().positive().default(50),
  restrictedDomains: z.array(BusinessDomainSchema).default([]),
  restrictedActions: z.array(z.string()).default([]),
  minEvidenceConfidence: z.number().min(0).max(100).default(70),
  requireExecutiveApprovalAboveRisk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  policyVersion: z.number().int().positive().default(1),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});
export type ExecutiveGovernancePolicy = z.infer<typeof ExecutiveGovernancePolicySchema>;

// ============================================================================
// 3. GOVERNANCE EVALUATION INPUT & RESULT
// ============================================================================

export const GovernanceEvaluationInputSchema = z.object({
  strategyId: z.string(),
  strategyName: z.string(),
  domain: BusinessDomainSchema,
  actionName: z.string(),
  expectedImpact: z.number().min(0).max(100),
  evidenceStrength: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  operationalPressure: z.number().min(0).max(100),
  estimatedFinancialExposure: z.number().nonnegative().optional(),
  conflictingGoalKeys: z.array(z.string()).optional().default([]),
  alignedGoalKeys: z.array(z.string()).optional().default([]),
  hasActiveRefutedHypothesis: z.boolean().optional().default(false),
  hasMissingEvidence: z.boolean().optional().default(false),
});

export type GovernanceEvaluationInput = z.infer<typeof GovernanceEvaluationInputSchema>;

export const GovernanceEvaluationResultSchema = z.object({
  strategyId: z.string(),
  strategyName: z.string(),
  verdict: GovernanceVerdictSchema,
  riskTolerance: RiskToleranceSchema,
  riskScore: z.number().min(0).max(100),
  capacityStatus: CapacityStatusSchema,
  goalAlignmentStatus: GoalAlignmentStatusSchema,
  requiredApproval: ApprovalAuthoritySchema,
  financialExposure: z.number().nonnegative(),
  maxFinancialExposure: z.number().nonnegative(),
  triggeredPolicies: z.array(z.string()),
  warnings: z.array(z.string()),
  violations: z.array(z.string()),
  escalationReasons: z.array(z.string()),
  explanation: z.string(),
  policyVersion: z.number(),
  evaluatedAt: z.date().or(z.string()),
});
export type GovernanceEvaluationResult = z.infer<typeof GovernanceEvaluationResultSchema>;

export const GovernedStrategicOptionSchema = z.object({
  optionId: z.string(),
  name: z.string(),
  domain: BusinessDomainSchema,
  description: z.string(),
  strategicScore: z.number().min(0).max(100),
  expectedImpact: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
  governance: GovernanceEvaluationResultSchema,
  isExecutable: z.boolean(),
});
export type GovernedStrategicOption = z.infer<typeof GovernedStrategicOptionSchema>;
