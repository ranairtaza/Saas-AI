import { PriorityEngine } from './priority-engine';
import { RiskEngine } from './risk-engine';
import { StrategyRecommendationEngine } from './recommendation-engine';
import { StrategicPriority, StrategicRisk, Phase43StrategicRecommendation } from './types';

export class ExecutiveStrategyService {
  /**
   * Synthesizes the Executive Strategy layer deterministically from Phase 40-42 outputs.
   */
  static synthesizeStrategy(params: {
    goals: any[];
    outlooks: Record<string, any>;
    metrics: Record<string, any>;
    anomalies: Record<string, any>;
  }): {
    priorities: StrategicPriority[];
    risks: StrategicRisk[];
    recommendations: Phase43StrategicRecommendation[];
  } {
    const risks = RiskEngine.evaluateRisks(params);
    const priorities = PriorityEngine.calculatePriorities(params);
    
    // Link risks to priorities if they share source metrics or goals
    for (const priority of priorities) {
      const relatedRisks = risks.filter(
        r =>
          r.sourceMetrics.some(m => priority.sourceMetrics.includes(m)) ||
          r.sourceGoals.some(g => priority.sourceGoals.includes(g))
      );
      priority.relatedRisks = Array.from(new Set([...priority.relatedRisks, ...relatedRisks.map(r => r.id)]));
    }

    const recommendations = StrategyRecommendationEngine.generateRecommendations({ priorities, risks });

    return {
      priorities,
      risks,
      recommendations,
    };
  }
}
