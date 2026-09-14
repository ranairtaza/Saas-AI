import { BusinessContext, ExecutiveHypothesis } from './types';
import { ExecutiveEventData, ExecutiveObservationResult, ExecutiveObservationResultSchema } from './events/types';

export class ExecutiveObservationEngine {
  /**
   * Synthesizes BusinessContext and active ExecutiveEvents into structured epistemic observations
   */
  static synthesizeObservations(
    context: BusinessContext,
    events: ExecutiveEventData[]
  ): ExecutiveObservationResult {
    const verifiedFacts: string[] = [];
    const observations: string[] = [];
    const hypotheses: ExecutiveHypothesis[] = [];

    // 1. Gather Telemetry Facts
    verifiedFacts.push(
      `Organization: ${context.identity.name} (${context.identity.industry})`,
      `Revenue MTD: $${(((context.telemetry.metrics.revenueMTD?.value || 0) || 0) || 0).toLocaleString()}`,
      `Pipeline Value: $${((context.telemetry.metrics.pipelineValue?.value || 0) || 0).toLocaleString()}`,
      `Total Active Leads: ${context.telemetry.metrics.activeLeadsCount?.value}`,
      `Qualified Leads (Score >= 75): ${(context.telemetry.metrics.qualifiedLeads?.value || 0)}`,
      `Unassigned High-Priority Leads: ${(context.telemetry.metrics.unassignedHighPriorityLeads?.value || 0)}`
    );

    // 2. Gather Event Facts
    for (const event of events) {
      verifiedFacts.push(`Event [${event.severity}] ${event.title}`);
      for (const fact of event.facts) {
        const factStr = typeof fact === 'string' ? fact : fact.statement;
        if (!verifiedFacts.includes(factStr)) {
          verifiedFacts.push(factStr);
        }
      }
    }

    // 3. Form Observations (Deductions from facts)
    const unassignedCount = (context.telemetry.metrics.unassignedHighPriorityLeads?.value || 0);
    const atRiskGoal = context.goals.find((g) => g.status === 'AT_RISK' || g.status === 'BEHIND');

    if ((unassignedCount ?? 0) > 0 && atRiskGoal) {
      observations.push(
        `Revenue milestone "${atRiskGoal.title}" is currently lagging (${atRiskGoal.status}) while ${(unassignedCount ?? 0)} high-value enterprise prospects remain unassigned.`
      );
      hypotheses.push({
        hypothesis:
          'Delayed account assignment and outreach latency are primary contributors to the revenue pacing deficit.',
        confidence: 'HIGH',
        confidenceRationale:
          'Direct correlation between enterprise pipeline stagnancy and missing sales milestone velocity.',
        supportingObservations: [
          `Revenue milestone "${atRiskGoal.title}" is currently lagging (${atRiskGoal.status}) while ${(unassignedCount ?? 0)} high-value enterprise prospects remain unassigned.`,
        ],
      });
    } else if ((unassignedCount ?? 0) > 0) {
      observations.push(
        `Pipeline velocity is vulnerable to conversion degradation due to ${(unassignedCount ?? 0)} unassigned qualified prospects in queue.`
      );
      hypotheses.push({
        hypothesis:
          'Rapid assignment of unallocated qualified accounts to sales reps will increase discovery meeting booking velocity.',
        confidence: 'HIGH',
        confidenceRationale:
          'Enterprise prospects demonstrate higher win rates when contacted within 24h of qualification.',
        supportingObservations: [
          `Pipeline velocity is vulnerable to conversion degradation due to ${(unassignedCount ?? 0)} unassigned qualified prospects in queue.`,
        ],
      });
    } else if (atRiskGoal) {
      observations.push(
        `Strategic target "${atRiskGoal.title}" has a gap of ${atRiskGoal.gapValue?.toLocaleString()} ${atRiskGoal.unit} relative to elapsed timeline (${atRiskGoal.timeElapsedPct}% elapsed).`
      );
      hypotheses.push({
        hypothesis:
          'Targeted acceleration of outbound discovery campaigns can bridge the milestone pacing gap before deadline.',
        confidence: 'MEDIUM',
        confidenceRationale:
          'Available addressable market exists in target industries based on recent enrichment runs.',
        supportingObservations: [
          `Strategic target "${atRiskGoal.title}" has a gap of ${atRiskGoal.gapValue?.toLocaleString()} ${atRiskGoal.unit} relative to elapsed timeline (${atRiskGoal.timeElapsedPct}% elapsed).`,
        ],
      });
    } else {
      observations.push(
        'Business telemetry reflects balanced operational velocity with zero priority assignment backlogs.'
      );
      hypotheses.push({
        hypothesis:
          'Current momentum provides headroom to initiate account discovery in adjacent market sectors.',
        confidence: 'HIGH',
        confidenceRationale: 'Stable revenue pacing and high lead conversion efficiency.',
        supportingObservations: [
          'Business telemetry reflects balanced operational velocity with zero priority assignment backlogs.',
        ],
      });
    }

    const criticalEventCount = events.filter((e) => e.severity === 'CRITICAL').length;

    return ExecutiveObservationResultSchema.parse({
      organizationId: context.organizationId,
      observedAt: new Date(),
      verifiedFacts,
      observations,
      hypotheses,
      activeEventCount: events.length,
      criticalEventCount,
    });
  }
}
