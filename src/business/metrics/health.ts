import { MetricEngine } from './engine';

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA'
}

export class BusinessHealthEngine {
  /**
   * Evaluates the health of a specific metric by comparing current to previous/baseline.
   * This is a simplified MVP deterministic evaluator.
   */
  static evaluateMetricHealth(
    metricKey: string,
    currentValue: number,
    baselineValue: number
  ): HealthStatus {
    if (baselineValue === 0 && currentValue === 0) return HealthStatus.INSUFFICIENT_DATA;
    if (baselineValue === 0) return HealthStatus.HEALTHY; // Started generating data

    const growth = MetricEngine.calculateGrowthPercentage(baselineValue, currentValue);

    // Simplistic rules based on metric key
    if (metricKey === 'revenue' || metricKey === 'profit' || metricKey === 'lead_count') {
      if (growth < -20) return HealthStatus.CRITICAL;
      if (growth < -5) return HealthStatus.WARNING;
      return HealthStatus.HEALTHY;
    }

    if (metricKey === 'expenses') {
      if (growth > 20) return HealthStatus.CRITICAL;
      if (growth > 10) return HealthStatus.WARNING;
      return HealthStatus.HEALTHY;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Evaluates overall business health by looking at multiple individual metric healths.
   * A simplistic MVP rule: if any critical, overall critical. If any warning, overall warning.
   */
  static evaluateOverallHealth(metricHealths: HealthStatus[]): HealthStatus {
    if (metricHealths.length === 0) return HealthStatus.INSUFFICIENT_DATA;

    let hasWarning = false;
    for (const status of metricHealths) {
      if (status === HealthStatus.CRITICAL) return HealthStatus.CRITICAL;
      if (status === HealthStatus.WARNING) hasWarning = true;
    }

    return hasWarning ? HealthStatus.WARNING : HealthStatus.HEALTHY;
  }
}
