import { TrendClassification, TrendResult } from './types';
import { ValidatedPeriod } from './data-quality-gate';

export class TrendDetector {
  /**
   * Deterministically classifies trend for a historical series of validated periods.
   */
  static detect(metric: string, validPeriods: ValidatedPeriod[]): TrendResult {
    if (!validPeriods || validPeriods.length < 3) {
      return {
        metric,
        trend: 'INSUFFICIENT_DATA',
        growthRatePct: null,
        periodsAnalyzed: validPeriods ? validPeriods.length : 0,
        explanation: `Insufficient historical data to determine trend for ${metric}. Minimum 3 validated periods required.`,
      };
    }

    const n = validPeriods.length;
    const values = validPeriods.map((p) => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / n;

    // Linear regression slope: m = (n*sum(i*y) - sum(i)*sum(y)) / (n*sum(i^2) - (sum(i))^2)
    let sumI = 0;
    let sumY = 0;
    let sumIY = 0;
    let sumI2 = 0;

    for (let i = 0; i < n; i++) {
      sumI += i;
      sumY += values[i];
      sumIY += i * values[i];
      sumI2 += i * i;
    }

    const denom = n * sumI2 - sumI * sumI;
    const slope = denom !== 0 ? (n * sumIY - sumI * sumY) / denom : 0;

    // Relative growth rate per period: (slope / |mean|) * 100
    let growthRatePct = 0;
    if (mean !== 0) {
      growthRatePct = Math.round((slope / Math.abs(mean)) * 10000) / 100;
    } else {
      // If mean is 0, check if values changed
      growthRatePct = values[n - 1] > values[0] ? 100 : values[n - 1] < values[0] ? -100 : 0;
    }

    let trend: TrendClassification;
    if (growthRatePct > 10) {
      trend = 'STRONGLY_INCREASING';
    } else if (growthRatePct > 2) {
      trend = 'INCREASING';
    } else if (growthRatePct >= -2) {
      trend = 'STABLE';
    } else if (growthRatePct >= -10) {
      trend = 'DECREASING';
    } else {
      trend = 'STRONGLY_DECREASING';
    }

    const explanation = `Trend is ${trend.replace('_', ' ').toLowerCase()} with an average change of ${growthRatePct > 0 ? '+' : ''}${growthRatePct}% per period across ${n} validated historical periods.`;

    return {
      metric,
      trend,
      growthRatePct,
      periodsAnalyzed: n,
      explanation,
    };
  }
}
