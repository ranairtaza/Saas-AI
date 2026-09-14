import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed } from '../../../lib/db-guard';

export class RecommendationEngine {
  /**
   * Deterministically generates system-recommended goals based on forecasts
   * Recommendations remain in DRAFT status and must be explicitly approved to become ACTIVE.
   */
  static async generateGoalRecommendations(
    organizationId: string,
    predictiveOutlook: any
  ): Promise<any[]> {
    assertDatabaseWritesAllowed('generate goal recommendations');

    const recommendations = [];

    // Simple deterministic rule: If forecast is HIGH confidence and positive, suggest a goal 5% above forecast
    for (const [kpiKey, data] of Object.entries(predictiveOutlook.forecasts || {})) {
      const forecastData = data as any;
      
      if (
        forecastData &&
        forecastData.confidence === 'HIGH' &&
        forecastData.forecastedValue > 0
      ) {
        // Only recommend if there isn't already an active goal for this KPI
        const existingGoal = await prisma.businessGoal.findFirst({
          where: {
            organizationId,
            kpiKey,
            status: { notIn: ['DRAFT', 'CANCELLED'] },
          },
        });

        if (!existingGoal) {
          const suggestedTarget = Math.round(forecastData.forecastedValue * 1.05);

          const recommendation = await prisma.businessGoal.create({
            data: {
              organizationId,
              title: `Achieve ${suggestedTarget} for ${kpiKey}`,
              kpiKey,
              targetValue: suggestedTarget,
              unit: forecastData.unit || 'COUNT',
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
              status: 'DRAFT',
              source: 'SYSTEM_RECOMMENDED',
              period: 'MONTH',
            },
          });

          recommendations.push({
            id: recommendation.id,
            kpiKey,
            suggestedTarget,
            explanation: `Based on a highly confident forecast of ${forecastData.forecastedValue}, we recommend a stretch target of ${suggestedTarget}.`,
          });
        }
      }
    }

    return recommendations;
  }
}
