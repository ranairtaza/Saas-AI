import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed } from '../../../lib/db-guard';
import { logAudit } from '../../../audit/logger';
import {
  ExecutiveForecastData,
  ExecutiveForecastSummary,
  ScenarioForecastItem,
  PredictiveRiskSignal,
} from './types';
import { ForecastEngine } from './forecast-engine';
import { BusinessContextBuilder } from '../context-builder';
import { ExecutiveOutcomeService } from '../outcomes/outcome-service';

export class ExecutiveForecastingService {
  /**
   * Generates, deterministically calculates, and saves executive forecasts for an organization.
   */
  static async generateAndSaveForecasts(
    organizationId: string,
    userId?: string
  ): Promise<ExecutiveForecastSummary> {
    assertDatabaseWritesAllowed('generate and save executive forecasts');

    // 1. Fetch authoritative BusinessContext
    const context = await BusinessContextBuilder.buildBusinessContext(organizationId);

    // 2. Fetch historical Phase 29 learning signals
    const learningSignals = await ExecutiveOutcomeService.listLearningSignals(organizationId);

    // 3. Compute deterministic forecasts, scenarios, and predictive risks
    const { forecasts, scenarioComparisons, topPredictiveRisks } =
      ForecastEngine.generateExecutiveForecasts(context, learningSignals);

    // 4. Persist forecasts to database with transaction
    // Clean old telemetry baseline forecasts to keep predictions fresh
    await prisma.executiveForecast.deleteMany({
      where: {
        organizationId,
        sourceType: 'TELEMETRY',
      },
    });

    const savedForecasts: ExecutiveForecastData[] = [];

    for (const f of forecasts) {
      const created = await prisma.executiveForecast.create({
        data: {
          organizationId,
          sourceType: f.sourceType,
          sourceId: f.sourceId || null,
          domain: f.domain,
          metric: f.metric,
          currentValue: f.currentValue,
          forecastValue: f.forecastValue,
          forecastHorizon: f.forecastHorizon,
          horizonDays: f.horizonDays,
          lowerBound: f.lowerBound,
          upperBound: f.upperBound,
          confidence: f.confidence,
          direction: f.direction,
          scenarioType: f.scenarioType,
          evidence: f.evidence,
          assumptions: JSON.stringify(f.assumptions || []),
          riskSignals: JSON.stringify(f.riskSignals || []),
          metadata: f.metadata ? JSON.stringify(f.metadata) : null,
        },
      });

      savedForecasts.push({
        ...created,
        assumptions: JSON.parse(created.assumptions),
        riskSignals: JSON.parse(created.riskSignals),
        metadata: created.metadata ? JSON.parse(created.metadata) : null,
      } as any);
    }

    // 5. Audit Logging
    await logAudit({
      organizationId,
      userId: userId || 'system',
      action: 'EXECUTIVE_FORECASTS_GENERATED' as any,
      resource: `executiveForecasts:${organizationId}`,
      status: 'SUCCESS',
      details: {
        forecastsCount: savedForecasts.length,
        risksCount: topPredictiveRisks.length,
        learningSignalsIncorporated: learningSignals.length,
      },
    });

    const highConfidenceCount = savedForecasts.filter((f) => f.confidence === 'HIGH').length;

    return {
      totalForecasts: savedForecasts.length,
      highConfidenceCount,
      identifiedRisksCount: topPredictiveRisks.length,
      forecasts: savedForecasts,
      topPredictiveRisks,
      scenarioComparisons,
      generatedAt: new Date(),
    };
  }

  /**
   * Retrieves active forecasts for an organization with optional filters.
   */
  static async listForecasts(
    organizationId: string,
    filters?: { domain?: string; horizon?: string; confidence?: string; scenarioType?: string }
  ): Promise<ExecutiveForecastData[]> {
    const where: any = { organizationId };

    if (filters?.domain) where.domain = filters.domain;
    if (filters?.horizon) where.forecastHorizon = filters.horizon;
    if (filters?.confidence) where.confidence = filters.confidence;
    if (filters?.scenarioType) where.scenarioType = filters.scenarioType;

    const records = await prisma.executiveForecast.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { domain: 'asc' }],
      take: 50,
    });

    return records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      sourceType: r.sourceType as any,
      sourceId: r.sourceId,
      domain: r.domain as any,
      metric: r.metric,
      currentValue: r.currentValue,
      forecastValue: r.forecastValue,
      forecastHorizon: r.forecastHorizon as any,
      horizonDays: r.horizonDays,
      lowerBound: r.lowerBound,
      upperBound: r.upperBound,
      confidence: r.confidence as any,
      direction: r.direction as any,
      scenarioType: r.scenarioType as any,
      evidence: r.evidence,
      assumptions: JSON.parse(r.assumptions || '[]'),
      riskSignals: JSON.parse(r.riskSignals || '[]'),
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Generates an on-demand forecast summary without requiring prior stored records.
   */
  static async getForecastSummary(organizationId: string): Promise<ExecutiveForecastSummary> {
    const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
    const learningSignals = await ExecutiveOutcomeService.listLearningSignals(organizationId);

    const { forecasts, scenarioComparisons, topPredictiveRisks } =
      ForecastEngine.generateExecutiveForecasts(context, learningSignals);

    const highConfidenceCount = forecasts.filter((f) => f.confidence === 'HIGH').length;

    return {
      totalForecasts: forecasts.length,
      highConfidenceCount,
      identifiedRisksCount: topPredictiveRisks.length,
      forecasts,
      topPredictiveRisks,
      scenarioComparisons,
      generatedAt: new Date(),
    };
  }

  /**
   * Phase 41: Assembles complete Predictive Business Intelligence & Outlook
   * across canonical metrics using validated historical snapshots.
   */
  static async getPredictiveOutlook(organizationId: string): Promise<{
    forecasts: Record<string, any>;
    trends: Record<string, any>;
    anomalies: Record<string, any>;
    generatedAt: Date;
  }> {
    if (!organizationId) {
      throw new Error('Organization ID is required for predictive outlook');
    }

    const metrics = await prisma.businessMetric.findMany({
      where: { organizationId },
      include: {
        snapshots: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    const canonicalKeys = [
      'REVENUE_MTD',
      'REVENUE_LAST_MONTH',
      'NEW_CUSTOMERS_MTD',
      'ACTIVE_SUBSCRIPTIONS',
      'TOTAL_LEADS',
      'QUALIFIED_LEADS',
      'TRANSACTIONS_MTD',
      'PIPELINE_VALUE',
    ];

    const forecasts: Record<string, any> = {};
    const trends: Record<string, any> = {};
    const anomalies: Record<string, any> = {};

    for (const key of canonicalKeys) {
      const metricRecord = metrics.find((m) => m.key === key);
      const snapshots = metricRecord?.snapshots || [];

      // Pass through ForecastEngine
      const forecast = ForecastEngine.forecastMetric(key, snapshots);
      const trend = ForecastEngine.detectTrend(key, snapshots);

      const latestVal = snapshots.length > 0 ? snapshots[snapshots.length - 1].value : null;
      const anomaly = ForecastEngine.detectAnomaly(key, snapshots, latestVal);

      forecasts[key] = forecast;
      trends[key] = trend;
      anomalies[key] = anomaly;
    }

    return {
      forecasts,
      trends,
      anomalies,
      generatedAt: new Date(),
    };
  }
}
