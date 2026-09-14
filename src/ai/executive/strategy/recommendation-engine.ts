import { StrategicPriority, StrategicRisk, Phase43StrategicRecommendation } from './types';
import * as crypto from 'crypto';

export class StrategyRecommendationEngine {
  /**
   * Deterministically generates strategic recommendations based on identified risks and priorities.
   */
  static generateRecommendations(params: {
    priorities: StrategicPriority[];
    risks: StrategicRisk[];
  }): Phase43StrategicRecommendation[] {
    const recommendations: Phase43StrategicRecommendation[] = [];

    // Group critical risks
    const criticalRisks = params.risks.filter(r => r.severity === 'CRITICAL');
    for (const risk of criticalRisks) {
      recommendations.push({
        id: crypto.randomUUID(),
        title: `Mitigate Critical Risk: ${risk.description}`,
        description: `Immediate action is required to address this critical risk affecting ${risk.category}.`,
        priority: 'CRITICAL',
        category: risk.category,
        focusAreas: risk.sourceMetrics,
        addressedRisks: [risk.id],
        addressedPriorities: [],
        status: 'DRAFT',
      });
    }

    // Group high priorities that aren't already addressed by critical risks
    const highPriorities = params.priorities.filter(p => p.priority === 'CRITICAL' || p.priority === 'HIGH');
    for (const priority of highPriorities) {
      recommendations.push({
        id: crypto.randomUUID(),
        title: `Focus on Strategic Priority: ${priority.category}`,
        description: `Strategic action required for ${priority.description}.`,
        priority: priority.priority,
        category: priority.category,
        focusAreas: priority.sourceMetrics,
        addressedRisks: priority.relatedRisks,
        addressedPriorities: [priority.id],
        status: 'DRAFT',
      });
    }

    return recommendations;
  }
}
