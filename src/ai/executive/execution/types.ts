import { z } from 'zod';
import { StrategicPriorityCategorySchema } from '../strategy/types';

// ============================================================================
// 1. EVIDENCE & CAPABILITY SCHEMAS
// ============================================================================

export const ExecutionEvidenceSourceTypeSchema = z.enum([
  'GOAL',
  'PRIORITY',
  'RISK',
  'RECOMMENDATION',
  'FORECAST',
  'METRIC',
]);

export const ExecutionEvidenceSchema = z.object({
  sourceType: ExecutionEvidenceSourceTypeSchema,
  sourceId: z.string(),
  explanation: z.string(),
});
export type ExecutionEvidence = z.infer<typeof ExecutionEvidenceSchema>;

export const CapabilityCategorySchema = z.enum(['CRM', 'DISCOVERY', 'INTEGRATION', 'REPORTING', 'SYSTEM']);
export type CapabilityCategory = z.infer<typeof CapabilityCategorySchema>;

export const CapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: CapabilityCategorySchema,
  supported: z.boolean(),
  requiresApproval: z.boolean(),
  requiredIntegration: z.string().nullable(),
  actionType: z.string().nullable(),
});
export type Capability = z.infer<typeof CapabilitySchema>;

// ============================================================================
// 2. ACTION PROPOSAL SCHEMAS
// ============================================================================

export const ActionProposalSchema = z.object({
  tool: z.string(),
  parameters: z.record(z.string(), z.any()),
  requiresApproval: z.boolean(),
});
export type ActionProposal = z.infer<typeof ActionProposalSchema>;

// ============================================================================
// 3. EXECUTION STEP SCHEMAS
// ============================================================================

export const ExecutionStepTypeSchema = z.enum([
  'ANALYZE',
  'REVIEW',
  'CONFIGURE',
  'CREATE',
  'UPDATE',
  'SYNC',
  'COMMUNICATE',
  'MEASURE',
  'APPROVE',
  'DECIDE',
]);
export type ExecutionStepType = z.infer<typeof ExecutionStepTypeSchema>;

export const ExecutionStepReadinessSchema = z.enum([
  'READY',
  'BLOCKED',
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_DEPENDENCY',
  'MISSING_INPUT',
  'UNSUPPORTED',
  'COMPLETED',
  'FAILED',
]);
export type ExecutionStepReadiness = z.infer<typeof ExecutionStepReadinessSchema>;

export const ExecutionStepStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
]);
export type ExecutionStepStatus = z.infer<typeof ExecutionStepStatusSchema>;

export const ExecutionStepSchema = z.object({
  id: z.string(),
  initiativeId: z.string(),
  order: z.number(),
  title: z.string(),
  description: z.string(),
  type: ExecutionStepTypeSchema,
  dependencies: z.array(z.string()).default([]), // IDs of steps this step depends on
  ownerRole: z.string(),
  requiredCapabilities: z.array(z.string()).default([]), // IDs of required Capabilities
  requiredInputs: z.array(z.string()).default([]),
  expectedOutcome: z.string().nullable(),
  actionProposal: ActionProposalSchema.nullable(),
  readiness: ExecutionStepReadinessSchema,
  status: ExecutionStepStatusSchema,
  evidence: z.array(ExecutionEvidenceSchema).default([]),
});
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;

// ============================================================================
// 4. EXECUTION PLAN SCHEMAS
// ============================================================================

export const ExecutionPlanStatusSchema = z.enum([
  'DRAFT',
  'READY_FOR_REVIEW',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
  'FAILED',
  'CANCELLED',
  'REJECTED',
]);
export type ExecutionPlanStatus = z.infer<typeof ExecutionPlanStatusSchema>;

export const ExecutionPlanSchema = z.object({
  id: z.string(),
  initiativeId: z.string(),
  status: ExecutionPlanStatusSchema,
  steps: z.array(ExecutionStepSchema),
  dependencyGraph: z.enum(['VALID', 'MISSING_DEPENDENCY', 'CYCLE_DETECTED']).default('VALID'),
  readiness: ExecutionStepReadinessSchema,
  blockers: z.array(z.string()).default([]),
  evidence: z.array(ExecutionEvidenceSchema).default([]),
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// ============================================================================
// 5. STRATEGIC INITIATIVE SCHEMAS
// ============================================================================

export const StrategicInitiativeStatusSchema = z.enum([
  'PROPOSED',
  'READY',
  'BLOCKED',
  'IN_REVIEW',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
]);
export type StrategicInitiativeStatus = z.infer<typeof StrategicInitiativeStatusSchema>;

export const StrategicInitiativeSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  title: z.string(),
  description: z.string(),
  category: StrategicPriorityCategorySchema,
  objective: z.string(),
  expectedOutcome: z.string().nullable(),
  priorityId: z.string().nullable(),
  recommendationId: z.string().nullable(),
  relatedRiskIds: z.array(z.string()).default([]),
  goalIds: z.array(z.string()).default([]),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  status: StrategicInitiativeStatusSchema,
  evidence: z.array(ExecutionEvidenceSchema).default([]),
  executionPlan: ExecutionPlanSchema.nullable(),
});
export type StrategicInitiative = z.infer<typeof StrategicInitiativeSchema>;
