import { BusinessContext } from '../types';
import { ExecutiveEventData } from './types';
import { EventNormalizer } from './event-normalizer';

export interface EventDetectionContext {
  businessContext: BusinessContext;
  conflictingEvidenceCount?: number;
  recentPendingActions?: Array<{
    id: string;
    actionName: string;
    status: string;
    updatedAt: Date;
  }>;
}

export class ExecutiveEventRules {
  /**
   * Rule 1: Evaluate unassigned high-priority leads backlog
   */
  static evaluateUnassignedLeads(context: EventDetectionContext): ExecutiveEventData | null {
    const count = context.businessContext.telemetry.metrics.unassignedHighPriorityLeads?.value;
    if (count === null || count === undefined || count <= 0) return null;

    const severity = count >= 3 ? 'CRITICAL' : 'HIGH';
    const avgDeal = (context.businessContext.telemetry.metrics as any).averageDealSize?.value;
    const estimatedExposure = avgDeal ? count * avgDeal : null;

    return EventNormalizer.normalizeEvent({
      organizationId: context.businessContext.organizationId,
      eventType: 'UNASSIGNED_HIGH_VALUE_LEAD',
      domain: 'REVENUE',
      severity,
      title: `${count} High-Value Lead${count > 1 ? 's' : ''} Require Immediate Territory Assignment`,
      summary: estimatedExposure
        ? `${count} qualified lead${count > 1 ? 's' : ''} (score >= 75) remain unassigned, exposing approximately $${estimatedExposure.toLocaleString()} in potential pipeline value to velocity decay.`
        : `${count} qualified lead${count > 1 ? 's' : ''} (score >= 75) remain unassigned, risking pipeline velocity decay without an assigned account executive.`,
      sourceTable: 'leads',
      sourceRecordId: 'backlog',
      facts: [
        `Unassigned high-priority leads in queue: ${count}`,
        `Total qualified leads: ${context.businessContext.telemetry.metrics.qualifiedLeads?.value ?? 0}`,
        estimatedExposure
          ? `Estimated pipeline exposure: $${estimatedExposure.toLocaleString()}`
          : `Pipeline exposure: Uncalculated (requires configured deal size)`,
      ],
      metadata: { unassignedCount: count, estimatedExposure: estimatedExposure ?? undefined },
      dedupKey: `count_${count}`,
    });
  }

  /**
   * Rule 2: Evaluate Business Goals milestone status degradation
   */
  static evaluateGoalStatusDegradation(context: EventDetectionContext): ExecutiveEventData[] {
    const events: ExecutiveEventData[] = [];

    for (const goal of context.businessContext.goals) {
      if (goal.status === 'AT_RISK' || goal.status === 'BEHIND') {
        const severity = goal.status === 'BEHIND' ? 'CRITICAL' : 'HIGH';
        const eventType = goal.status === 'BEHIND' ? 'GOAL_BEHIND' : 'GOAL_AT_RISK';

        events.push(
          EventNormalizer.normalizeEvent({
            organizationId: context.businessContext.organizationId,
            eventType,
            domain: 'REVENUE',
            severity,
            title: `Strategic Milestone "${goal.title}" is ${goal.status}`,
            summary: `Progress for "${goal.title}" is currently at ${goal.progressPct}% with ${goal.timeElapsedPct}% of timeframe elapsed. Current pacing gap: ${goal.gapValue?.toLocaleString()} ${goal.unit}.`,
            sourceTable: 'business_goals',
            sourceRecordId: goal.id,
            facts: [
              `Target goal: "${goal.title}" (${goal.targetValue} ${goal.unit})`,
              `Current achieved value: ${goal.currentValue} ${goal.unit}`,
              `Milestone progress: ${goal.progressPct}% (Target timeline elapsed: ${goal.timeElapsedPct}%)`,
              `Status: ${goal.status}`,
            ],
            metadata: {
              goalId: goal.id,
              progressPct: goal.progressPct,
              gapValue: goal.gapValue,
              status: goal.status,
            },
            dedupKey: `status_${goal.status}_progress_${goal.progressPct}`,
          })
        );
      }
    }

    return events;
  }

  /**
   * Rule 3: Evaluate Revenue Pacing & Target Run-Rate Lag
   */
  static evaluateRevenuePacing(context: EventDetectionContext): ExecutiveEventData | null {
    const revGoal = context.businessContext.goals.find(
      (g) => g.kpiKey.toLowerCase().includes('revenue') || g.kpiKey.toLowerCase().includes('mrr')
    );

    if (revGoal && (revGoal.status === 'AT_RISK' || revGoal.status === 'BEHIND')) {
      return EventNormalizer.normalizeEvent({
        organizationId: context.businessContext.organizationId,
        eventType: 'REVENUE_PACING_LAG',
        domain: 'FINANCE',
        severity: revGoal.status === 'BEHIND' ? 'CRITICAL' : 'HIGH',
        title: 'Monthly Revenue Pacing Lags Strategic Baseline',
        summary: `Actual revenue MTD ($${context.businessContext.telemetry.metrics.revenueMTD?.value?.toLocaleString() ?? 'UNKNOWN'}) lags the expected target ($${revGoal.targetValue.toLocaleString()}).`,
        sourceTable: 'business_metrics',
        sourceRecordId: revGoal.id,
        facts: [
          `Revenue MTD: $${context.businessContext.telemetry.metrics.revenueMTD?.value?.toLocaleString() ?? 'UNKNOWN'}`,
          `Target: $${revGoal.targetValue.toLocaleString()}`,
          `Pacing progress: ${revGoal.progressPct}%`,
        ],
        metadata: {
          revenueMTD: context.businessContext.telemetry.metrics.revenueMTD?.value,
          targetRevenue: revGoal.targetValue,
        },
        dedupKey: `revenue_${context.businessContext.telemetry.metrics.revenueMTD?.value}`,
      });
    }

    return null;
  }

  /**
   * Rule 4: Evaluate Conflicting Enrichment Evidence in Leads
   */
  static evaluateEnrichmentConflicts(context: EventDetectionContext): ExecutiveEventData | null {
    const count = context.conflictingEvidenceCount || 0;
    if (count <= 0) return null;

    return EventNormalizer.normalizeEvent({
      organizationId: context.businessContext.organizationId,
      eventType: 'ENRICHMENT_CONFLICT',
      domain: 'OPERATIONS',
      severity: count >= 5 ? 'MEDIUM' : 'LOW',
      title: `${count} Contradictory Enrichment Attribute${count > 1 ? 's' : ''} Detected`,
      summary: `Automated multi-source enrichment identified ${count} contradictory evidence datapoints requiring authority resolution.`,
      sourceTable: 'enrichment_evidence',
      sourceRecordId: 'conflicts_aggregate',
      facts: [
        `Total active unverified/conflicting evidence records: ${count}`,
        'Deterministic authority hierarchy is active to prioritize highest confidence provider.',
      ],
      metadata: { conflictingEvidenceCount: count },
      dedupKey: `conflicts_${count}`,
    });
  }

  /**
   * Rule 5: Evaluate Governed Pending Actions approvals/rejections
   */
  static evaluatePendingActionState(context: EventDetectionContext): ExecutiveEventData[] {
    const events: ExecutiveEventData[] = [];
    if (!context.recentPendingActions) return events;

    for (const action of context.recentPendingActions) {
      if (action.status === 'APPROVED' || action.status === 'REJECTED') {
        const eventType = action.status === 'APPROVED' ? 'PENDING_ACTION_APPROVED' : 'PENDING_ACTION_REJECTED';
        events.push(
          EventNormalizer.normalizeEvent({
            organizationId: context.businessContext.organizationId,
            eventType,
            domain: 'GOVERNANCE',
            severity: 'INFO',
            title: `Executive Action "${action.actionName}" Was ${action.status}`,
            summary: `Governed action "${action.actionName}" was formally ${action.status.toLowerCase()} by an authorized user.`,
            sourceTable: 'pending_actions',
            sourceRecordId: action.id,
            facts: [
              `Action: ${action.actionName}`,
              `Status: ${action.status}`,
              `Timestamp: ${action.updatedAt.toISOString()}`,
            ],
            metadata: { actionId: action.id, status: action.status },
            dedupKey: `status_${action.status}`,
            occurredAt: action.updatedAt,
          })
        );
      }
    }

    return events;
  }
}
