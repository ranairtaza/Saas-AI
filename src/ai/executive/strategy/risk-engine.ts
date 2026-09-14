import { StrategicRisk, StrategicRiskType, StrategicPriorityCategory } from './types';
import * as crypto from 'crypto';

export class RiskEngine {
  /**
   * Deterministically evaluates risks based on business context.
   */
  static evaluateRisks(params: {
    goals: any[];
    outlooks: Record<string, any>;
    metrics: Record<string, any>;
    anomalies: Record<string, any>;
  }): StrategicRisk[] {
    const risks: StrategicRisk[] = [];

    // Evaluate Goal Miss risks
    for (const goal of params.goals) {
      const outlookObj = params.outlooks[goal.id];
      const outlookStr = (goal as any).outlook || (outlookObj ? outlookObj.outlook : null);

      if (outlookStr === 'LIKELY_TO_MISS') {
        const forecastData = params.outlooks[goal.kpiKey] || {};
        const metric = params.metrics[goal.kpiKey];
        const historicalPeriods = forecastData.historicalPeriodsUsed || 0;
        const actualValue = goal.actualValue !== undefined ? goal.actualValue : goal.currentValue;
        const targetValue = goal.targetValue;
        const isUnderTarget = actualValue !== null && actualValue < targetValue;
        const isDataSufficient = metric && metric.confidence !== 'LOW' && metric.conflict !== true && metric.freshness !== 'STALE';

        if (historicalPeriods >= 3 && isUnderTarget && isDataSufficient) {
          risks.push({
            id: crypto.randomUUID(),
            type: 'PERSISTENT_UNDERPERFORMANCE',
            category: 'GOAL_PERFORMANCE',
            description: `Goal ${goal.title} has persistently missed targets over ${historicalPeriods} periods.`,
            severity: 'CRITICAL',
            confidence: 'HIGH',
            sourceMetrics: [goal.kpiKey],
            sourceGoals: [goal.id],
            measurementRisk: false,
          });
        } else {
          risks.push({
            id: crypto.randomUUID(),
            type: 'GOAL_MISS',
            category: 'GOAL_PERFORMANCE',
            description: `Goal ${goal.title} is LIKELY_TO_MISS.`,
            severity: 'CRITICAL',
            confidence: 'HIGH',
            sourceMetrics: [goal.kpiKey],
            sourceGoals: [goal.id],
            measurementRisk: false,
          });
        }
      } else if (outlookStr === 'AT_RISK') {
        risks.push({
          id: crypto.randomUUID(),
          type: 'GOAL_AT_RISK',
          category: 'GOAL_PERFORMANCE',
          description: `Goal ${goal.title} is AT_RISK.`,
          severity: 'HIGH',
          confidence: 'MEDIUM',
          sourceMetrics: [goal.kpiKey],
          sourceGoals: [goal.id],
          measurementRisk: false,
        });
      }
    }

    // Evaluate Data Quality / Staleness / Conflicts
    for (const [key, metric] of Object.entries(params.metrics)) {
      if (metric.freshness === 'STALE' || metric.status === 'STALE') {
        risks.push({
          id: crypto.randomUUID(),
          type: 'DATA_STALENESS',
          category: 'DATA_QUALITY',
          description: `Metric ${key} is stale.`,
          severity: 'MEDIUM',
          confidence: 'HIGH',
          sourceMetrics: [key],
          sourceGoals: [],
          measurementRisk: true,
        });
      }

      if (metric.conflict === true || metric.status === 'CONFLICTING') {
        risks.push({
          id: crypto.randomUUID(),
          type: 'DATA_CONFLICT',
          category: 'DATA_QUALITY',
          description: `Metric ${key} has conflicting data sources.`,
          severity: 'HIGH',
          confidence: 'HIGH',
          sourceMetrics: [key],
          sourceGoals: [],
          measurementRisk: true,
        });
      }
    }

    // Evaluate Anomalies (Forecast Declines or Unexpected changes)
    for (const [key, anomaly] of Object.entries(params.anomalies)) {
      if (anomaly.type === 'NEGATIVE_TREND' || anomaly.type === 'SUDDEN_DROP') {
        risks.push({
          id: crypto.randomUUID(),
          type: 'KPI_DECLINE',
          category: 'OPERATIONS',
          description: `Anomaly detected in ${key}: ${anomaly.description}`,
          severity: anomaly.severity === 'HIGH' ? 'CRITICAL' : 'HIGH',
          confidence: 'MEDIUM',
          sourceMetrics: [key],
          sourceGoals: [],
          measurementRisk: false,
        });
      }
    }

    return risks;
  }
}
