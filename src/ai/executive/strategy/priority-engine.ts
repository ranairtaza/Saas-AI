import { BusinessGoalData, ExecutivePriorityLevel } from '../types';
import { StrategicPriority, StrategicPriorityCategory } from './types';
import * as crypto from 'crypto';

export const IMPACT_CRITICAL = 90;
export const URGENCY_CRITICAL = 85;
export const IMPACT_HIGH = 75;
export const URGENCY_HIGH = 70;
export const IMPACT_MEDIUM = 50;
export const URGENCY_MEDIUM = 50;
export const IMPACT_LOW = 25;
export const URGENCY_LOW = 25;

export class PriorityEngine {
  /**
   * Deterministically calculates strategic priorities from existing business context.
   * Does NOT use an LLM. Rules-based priority generation from Phase 40, 41, 42 signals.
   */
  static calculatePriorities(params: {
    goals: BusinessGoalData[];
    outlooks: Record<string, any>;
    metrics: Record<string, any>;
  }): StrategicPriority[] {
    const priorities: StrategicPriority[] = [];
    
    // Rule 1: Goal Miss Risk -> High/Critical Priority
    for (const goal of params.goals) {
      if (!goal.id) continue;
      const outlookObj = params.outlooks[goal.id];
      const outlookStr = (goal as any).outlook || (outlookObj ? outlookObj.outlook : null);

      if (outlookStr) {
        let priorityLevel: ExecutivePriorityLevel;
        let impact: number;
        let urgency: number;

        if (outlookStr === 'LIKELY_TO_MISS') {
          priorityLevel = 'CRITICAL';
          impact = IMPACT_CRITICAL;
          urgency = URGENCY_CRITICAL;
        } else if (outlookStr === 'AT_RISK') {
          priorityLevel = 'HIGH';
          impact = IMPACT_HIGH;
          urgency = URGENCY_HIGH;
        } else if (outlookStr === 'ON_TRACK') {
          priorityLevel = 'LOW';
          impact = IMPACT_LOW;
          urgency = URGENCY_LOW;
        } else {
          // POLICY: MEDIUM is reserved for explicitly defined future moderate-risk conditions.
          // No current Phase 43 input state maps to MEDIUM.
          // Unknown/unsupported conditions must remain safely unclassified.
          continue; 
        }

        priorities.push({
          id: crypto.randomUUID(),
          category: this.mapGoalToCategory(goal.kpiKey),
          priority: priorityLevel,
          impact: impact,
          urgency: urgency,
          confidence: 'HIGH',
          description: `Goal ${goal.title} is ${outlookStr.toLowerCase().replace(/_/g, ' ')}. Action required.`,
          sourceGoals: [goal.id],
          sourceMetrics: [goal.kpiKey],
          relatedRisks: [],
        });
      }
    }

    // Additional rules can be added here for data quality, etc.

    return priorities;
  }

  private static mapGoalToCategory(metricKey: string): StrategicPriorityCategory {
    const key = metricKey.toLowerCase();
    if (key.includes('revenue') || key.includes('mrr') || key.includes('arr')) return 'REVENUE';
    if (key.includes('lead') || key.includes('signup')) return 'LEAD_GENERATION';
    if (key.includes('churn') || key.includes('retention')) return 'CUSTOMER_RETENTION';
    if (key.includes('conversion')) return 'CONVERSION';
    if (key.includes('data') || key.includes('quality')) return 'DATA_QUALITY';
    if (key.includes('integration') || key.includes('sync')) return 'INTEGRATION_HEALTH';
    return 'GOAL_PERFORMANCE';
  }
}
