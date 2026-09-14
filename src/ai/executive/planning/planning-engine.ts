import { prisma } from '../../../lib/db';
import { PlanningGoal, GoalOutlook } from '../types';
import { BusinessIntelligenceEngine } from '../bi-engine';
import { ExecutiveForecastingService } from '../forecasting/forecasting-service';

export class PlanningEngine {
  static readonly AT_RISK_THRESHOLD = 0.85;

  /**
   * Deterministically evaluates active goals against current reality and predictive outlook
   */
  static async evaluateGoals(organizationId: string): Promise<PlanningGoal[]> {
    // 1. Fetch active goals
    const goals = await prisma.businessGoal.findMany({
      where: {
        organizationId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
    });

    if (goals.length === 0) return [];

    // 2. Fetch ground truth and forecast
    const telemetry = await BusinessIntelligenceEngine.assembleTelemetry(organizationId);
    let predictiveOutlook: any = { forecasts: {} };
    try {
      predictiveOutlook = await ExecutiveForecastingService.getPredictiveOutlook(organizationId);
    } catch (e) {
      // Non-blocking
    }

    const planningGoals: PlanningGoal[] = [];

    // 3. Evaluate each goal
    for (const goal of goals) {
      // Find actual value
      const metricData = (telemetry.metrics as any)[goal.kpiKey];
      const actualValue: number | null = metricData && metricData.value !== null ? metricData.value : null;
      const actualConfidence: string = metricData ? metricData.confidence : 'UNKNOWN';
      const actualFreshness: string = metricData ? metricData.freshness : 'UNAVAILABLE';

      // Find forecast value
      const forecastData = predictiveOutlook.forecasts[goal.kpiKey];
      const forecastValue: number | null = forecastData && forecastData.forecastedValue !== null ? forecastData.forecastedValue : null;
      const forecastConfidence: string = forecastData && forecastData.confidence ? forecastData.confidence : 'LOW';

      // Determine confidence (weakest link principle)
      const confMap: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 1, 'UNAVAILABLE': 1 };
      
      let actualScore = 1;
      if (actualValue !== null) {
        if (actualConfidence === 'HIGH' || actualFreshness === 'REAL_TIME' || actualFreshness === 'CURRENT') actualScore = 3;
        else if (actualConfidence === 'MEDIUM' || actualFreshness === 'AGING') actualScore = 2;
        else actualScore = 1; // STALE, CONFLICTING, LOW
      }

      const forecastScore = confMap[forecastConfidence] || 1;
      const finalScore = Math.min(actualScore, forecastScore);
      
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (finalScore === 3) confidence = 'HIGH';
      else if (finalScore === 2) confidence = 'MEDIUM';

      // Calculate progress and gaps
      let progressPct: number | null = null;
      let actualGap: number | null = null;
      if (actualValue !== null) {
        if (goal.targetValue <= 0) {
           progressPct = actualValue >= 0 ? 100 : 0;
        } else {
           progressPct = Math.min(100, Math.max(0, Math.round((actualValue / goal.targetValue) * 100)));
        }
        actualGap = Number((actualValue - goal.targetValue).toFixed(2));
      }

      let forecastGap: number | null = null;
      if (forecastValue !== null) {
        forecastGap = Number((forecastValue - goal.targetValue).toFixed(2));
      }

      // Classify outlook deterministically
      let outlook: GoalOutlook = 'INSUFFICIENT_DATA';
      if (forecastValue !== null) {
        if (forecastValue >= goal.targetValue) {
          outlook = 'ON_TRACK';
        } else if (forecastValue >= PlanningEngine.AT_RISK_THRESHOLD * goal.targetValue) {
          outlook = 'AT_RISK';
        } else {
          outlook = 'LIKELY_TO_MISS';
        }
      } else if (actualValue !== null && goal.endDate.getTime() < new Date().getTime()) {
        if (actualValue >= goal.targetValue) outlook = 'ON_TRACK';
        else outlook = 'LIKELY_TO_MISS';
      }

      // Determine Priority deterministically
      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (outlook === 'LIKELY_TO_MISS') {
        if (confidence === 'HIGH') priority = 'CRITICAL';
        else if (confidence === 'MEDIUM') priority = 'HIGH';
        else priority = 'MEDIUM';
      } else if (outlook === 'AT_RISK') {
        if (confidence === 'HIGH') priority = 'HIGH';
        else if (confidence === 'MEDIUM') priority = 'MEDIUM';
        else priority = 'LOW';
      } else {
        priority = 'LOW';
      }

      planningGoals.push({
        id: goal.id,
        title: goal.title,
        kpiKey: goal.kpiKey,
        targetValue: goal.targetValue,
        actualValue,
        forecastValue,
        progressPct,
        actualGap,
        forecastGap,
        outlook,
        confidence,
        priority,
        source: goal.source,
        period: goal.period,
      });
    }

    return planningGoals;
  }
}
