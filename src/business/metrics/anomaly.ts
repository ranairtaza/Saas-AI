export interface AnomalyResult {
  metricKey: string;
  currentValue: number;
  baselineValue: number;
  deviation: number;
  isAnomaly: boolean;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class AnomalyDetector {
  /**
   * Detects anomalies using a simple moving average and standard deviation approach.
   * Requires historical values and a current value.
   */
  static detect(metricKey: string, historicalValues: number[], currentValue: number): AnomalyResult {
    if (historicalValues.length < 3) {
      return {
        metricKey,
        currentValue,
        baselineValue: 0,
        deviation: 0,
        isAnomaly: false
      }; // Insufficient data to determine anomaly
    }

    // Calculate Moving Average
    const sum = historicalValues.reduce((a, b) => a + b, 0);
    const movingAverage = sum / historicalValues.length;

    // Calculate Standard Deviation
    const squaredDiffs = historicalValues.map(val => Math.pow(val - movingAverage, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    // Deviation from baseline (moving average)
    const deviation = currentValue - movingAverage;
    const absDeviation = Math.abs(deviation);

    // Rule: Anomaly if current is outside 2 standard deviations
    // Or if stdDev is 0 and it deviates (simplistic fallback)
    const threshold = stdDev === 0 ? movingAverage * 0.1 : 2 * stdDev; 
    const isAnomaly = absDeviation > threshold;

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
    if (isAnomaly) {
      const zScore = stdDev === 0 ? (absDeviation / (movingAverage || 1)) : absDeviation / stdDev;
      if (zScore > 4) severity = 'HIGH';
      else if (zScore > 3) severity = 'MEDIUM';
      else severity = 'LOW';
    }

    return {
      metricKey,
      currentValue,
      baselineValue: movingAverage,
      deviation,
      isAnomaly,
      severity
    };
  }
}
