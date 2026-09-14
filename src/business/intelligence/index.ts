import { BusinessDataRepository } from '../data/repository';
import { METRIC_DEFINITIONS } from '../metrics/definitions';
import { MetricEngine } from '../metrics/engine';
import { BusinessHealthEngine, HealthStatus } from '../metrics/health';
import { AnomalyDetector, AnomalyResult } from '../metrics/anomaly';

export interface MetricIntelligence {
  metricKey: string;
  metricName: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  health: HealthStatus;
  anomaly?: AnomalyResult;
}

export interface BusinessIntelligenceReport {
  organizationId: string;
  overallHealth: HealthStatus;
  metrics: MetricIntelligence[];
  anomalies: AnomalyResult[];
  recommendations?: any[]; // Generated proactive recommendations
  events?: any[]; // Raw business telemetry events
  generatedAt: Date;
}

export class BusinessIntelligenceService {
  /**
   * Generates a deterministic business intelligence report for an organization.
   */
  static async generateReport(organizationId: string): Promise<BusinessIntelligenceReport> {
    if (!organizationId) throw new Error("Organization ID is required.");
    
    // In MVP, we evaluate the core metrics
    const coreMetrics = ['revenue', 'expenses', 'profit'];
    const metricIntelligences: MetricIntelligence[] = [];
    const allAnomalies: AnomalyResult[] = [];
    const healthStatuses: HealthStatus[] = [];

    // Simulate looking back 30 days for anomalies
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const key of coreMetrics) {
      const metricDef = METRIC_DEFINITIONS[key];
      if (!metricDef) continue;
      
      const summary = await BusinessDataRepository.getMetricSummary(organizationId, key);
      if (!summary) continue;

      const { current, previous, metric } = summary;
      const changePercent = MetricEngine.calculateGrowthPercentage(previous, current);
      const health = BusinessHealthEngine.evaluateMetricHealth(key, current, previous);
      
      healthStatuses.push(health);

      // Fetch historical snapshots for anomaly detection
      const historicalSnapshots = await BusinessDataRepository.getSnapshots(organizationId, metric.id, thirtyDaysAgo);
      const historicalValues = historicalSnapshots.map((s: any) => s.value);
      
      const anomalyResult = AnomalyDetector.detect(key, historicalValues, current);
      if (anomalyResult.isAnomaly) {
        allAnomalies.push(anomalyResult);
      }

      metricIntelligences.push({
        metricKey: key,
        metricName: metricDef.name,
        currentValue: current,
        baselineValue: previous, // simple baseline
        changePercent,
        health,
        anomaly: anomalyResult.isAnomaly ? anomalyResult : undefined
      });
    }

    const overallHealth = BusinessHealthEngine.evaluateOverallHealth(healthStatuses);

    // Fetch active recommendations and relevant business events
    const { prisma } = await import('../../lib/db');
    const recommendations = await prisma.executiveRecommendation.findMany({
      where: { organizationId, status: { in: ['PROPOSED', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const events = await prisma.executiveEvent.findMany({
      where: { organizationId, processed: false },
      orderBy: { occurredAt: 'desc' },
      take: 10
    });

    return {
      organizationId,
      overallHealth,
      metrics: metricIntelligences,
      anomalies: allAnomalies,
      recommendations,
      events,
      generatedAt: new Date()
    };
  }
}
