import { prisma } from '../lib/db';

export type AuditAction = 
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_DELETED'
  | 'AI_CHAT_INITIATED'
  | 'AI_ACTION_EXECUTED'
  | 'AI_ACTION_PROPOSED'
  | 'AI_ACTION_REJECTED'
  | 'AI_SENSITIVE_ACTION_APPROVED'
  | 'AI_ACTION_CANCELLED'
  | 'BILLING_UPDATED'
  | 'OUTREACH_DRAFT_GENERATED'
  | 'OUTREACH_DRAFT_REGENERATED'
  | 'OUTREACH_DRAFT_EDITED'
  | 'OUTREACH_APPROVAL_REQUESTED'
  | 'OUTREACH_DRAFT_APPROVED'
  | 'OUTREACH_DRAFT_REJECTED'
  | 'OUTREACH_DRAFT_STALE'
  | 'ENRICHMENT_REQUESTED'
  | 'ENRICHMENT_STARTED'
  | 'ENRICHMENT_COMPLETED'
  | 'ENRICHMENT_PARTIAL'
  | 'ENRICHMENT_FAILED'
  | 'ENRICHMENT_REFRESHED'
  | 'ENRICHMENT_CONFLICT_DETECTED'
  | 'EXECUTIVE_REASONING_RUN'
  | 'EXECUTIVE_RECOMMENDATION_CREATED'
  | 'EXECUTIVE_RECOMMENDATION_PROPOSED'
  | 'EXECUTIVE_GOAL_CREATED'
  | 'EXECUTIVE_GOAL_UPDATED'
  | 'EXECUTIVE_MEMORY_CREATED'
  | 'EXECUTIVE_MEMORY_UPDATED'
  | 'EXECUTIVE_EVENT_DETECTED'
  | 'EXECUTIVE_EVENT_RESOLVED'
  | 'EXECUTIVE_BRIEFING_GENERATED'
  | 'EXECUTIVE_HEALTH_EVALUATED'
  | 'EXECUTIVE_OUTCOME_INITIALIZED'
  | 'EXECUTIVE_OUTCOME_EVALUATION_STARTED'
  | 'EXECUTIVE_OUTCOME_EVALUATED'
  | 'EXECUTIVE_OUTCOME_CANCELLED'
  | 'EXECUTIVE_MEMORY_CREATED_FROM_OUTCOME'
  | 'EXECUTIVE_ACTION_PLAN_CREATED'
  | 'EXECUTIVE_ACTION_PLAN_APPROVED'
  | 'EXECUTIVE_ACTION_PLAN_REJECTED'
  | 'EXECUTIVE_ACTION_PLAN_DEFERRED'
  | 'EXECUTIVE_ACTION_PLAN_BLOCKED'
  | 'EXECUTIVE_ACTION_PLAN_STAGED';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'REJECTED';

export interface AuditLogEntry {
  organizationId: string;
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  details?: Record<string, any>;
  riskLevel?: string;
  ipAddress?: string;
  status: AuditStatus;
}

/**
 * Creates an immutable audit log entry.
 */
export async function logAudit(entry: AuditLogEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        input: entry.input ? JSON.stringify(entry.input) : undefined,
        output: entry.output ? JSON.stringify(entry.output) : (entry.details ? JSON.stringify(entry.details) : undefined),
        ipAddress: entry.ipAddress,
        status: entry.status,
        riskLevel: entry.riskLevel || 'READ',
      },
    });
  } catch (error) {
    // In a production environment, this should fall back to a file or stdout
    // so we don't lose audit logs if the DB goes down.
    console.error('FAILED TO WRITE AUDIT LOG', entry, error);
  }
}
