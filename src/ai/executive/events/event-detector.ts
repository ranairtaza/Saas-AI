import { BusinessContext } from '../types';
import { ExecutiveEventData } from './types';
import { EventDetectionContext, ExecutiveEventRules } from './event-rules';
import { prisma } from '../../../lib/db';

export class ExecutiveEventDetector {
  /**
   * Detects all active events deterministically for an organization
   */
  static async detectEvents(
    businessContext: BusinessContext,
    options?: { conflictingEvidenceCount?: number }
  ): Promise<ExecutiveEventData[]> {
    let conflictingCount = options?.conflictingEvidenceCount;

    if (conflictingCount === undefined) {
      try {
        conflictingCount = await prisma.enrichmentEvidence.count({
          where: {
            organizationId: businessContext.organizationId,
            verificationStatus: 'CONFLICTING',
          },
        });
      } catch {
        conflictingCount = 0;
      }
    }

    const detectionContext: EventDetectionContext = {
      businessContext,
      conflictingEvidenceCount: conflictingCount,
    };

    const detected: ExecutiveEventData[] = [];

    // 1. Unassigned leads
    const unassignedEvent = ExecutiveEventRules.evaluateUnassignedLeads(detectionContext);
    if (unassignedEvent) detected.push(unassignedEvent);

    // 2. Goal status degradations
    const goalEvents = ExecutiveEventRules.evaluateGoalStatusDegradation(detectionContext);
    detected.push(...goalEvents);

    // 3. Revenue pacing lag
    const revenueEvent = ExecutiveEventRules.evaluateRevenuePacing(detectionContext);
    if (revenueEvent) detected.push(revenueEvent);

    // 4. Enrichment conflicts
    const conflictEvent = ExecutiveEventRules.evaluateEnrichmentConflicts(detectionContext);
    if (conflictEvent) detected.push(conflictEvent);

    return detected;
  }
}
