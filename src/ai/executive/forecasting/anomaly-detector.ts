import { AnomalyClassification, AnomalyDetectionResult } from './types';
import { ValidatedPeriod } from './data-quality-gate';

export class AnomalyDetector {
  /**
   * Evaluates whether an observed metric value is a statistical anomaly relative to historical periods.
   */
  static detect(
    metric: string,
    validPeriods: ValidatedPeriod[],
    currentValue: number | null | undefined
  ): AnomalyDetectionResult {
    if (
      currentValue === null ||
      currentValue === undefined ||
      typeof currentValue !== 'number' ||
      isNaN(currentValue) ||
      !isFinite(currentValue)
    ) {
      return {
        metric,
        status: 'INSUFFICIENT_DATA',
        currentValue: null,
        historicalMean: null,
        deviationPct: null,
        explanation: `No valid current observation provided for anomaly detection on ${metric}.`,
      };
    }

    if (!validPeriods || validPeriods.length < 3) {
      return {
        metric,
        status: 'INSUFFICIENT_DATA',
        currentValue,
        historicalMean: null,
        deviationPct: null,
        explanation: `Insufficient historical observations for ${metric} to detect anomalies (found ${validPeriods ? validPeriods.length : 0}, minimum 3 required).`,
      };
    }

    const values = validPeriods.map((p) => p.value);
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    let deviationPct = 0;
    if (mean !== 0) {
      deviationPct = Math.round((Math.abs(currentValue - mean) / Math.abs(mean)) * 10000) / 100;
    } else {
      deviationPct = currentValue !== 0 ? 100 : 0;
    }

    let isAnomaly = false;
    if (stdDev > 0) {
      const zScore = Math.abs(currentValue - mean) / stdDev;
      if (zScore >= 2.5 || (zScore >= 2.0 && deviationPct >= 40)) {
        isAnomaly = true;
      }
    } else {
      // Historical data had zero standard deviation (all identical)
      if (deviationPct >= 20) {
        isAnomaly = true;
      }
    }

    const status: AnomalyClassification = isAnomaly ? 'ANOMALY' : 'NORMAL';

    const explanation = isAnomaly
      ? `Observation (${currentValue}) deviates significantly (${deviationPct}% from historical mean of ${Math.round(mean * 100) / 100}) across ${n} baseline periods.`
      : `Observation (${currentValue}) is within expected historical variance (${deviationPct}% from mean of ${Math.round(mean * 100) / 100}).`;

    return {
      metric,
      status,
      currentValue,
      historicalMean: Math.round(mean * 100) / 100,
      deviationPct,
      explanation,
    };
  }
}
