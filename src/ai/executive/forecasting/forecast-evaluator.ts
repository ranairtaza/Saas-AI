import { ForecastEvaluationResult } from './types';

export class ForecastEvaluator {
  /**
   * Compares a forecasted value with an actual observed value.
   * Ensures missing actuals remain UNKNOWN, and zero denominators never produce NaN or Infinity.
   */
  static evaluate(
    metric: string,
    forecastPeriod: string,
    forecastValue: number,
    actualValue: number | null | undefined
  ): ForecastEvaluationResult {
    // Missing actual remains explicitly UNKNOWN
    if (
      actualValue === null ||
      actualValue === undefined ||
      typeof actualValue !== 'number' ||
      isNaN(actualValue) ||
      !isFinite(actualValue)
    ) {
      return {
        metric,
        forecastPeriod,
        forecastValue,
        actualValue: null,
        absoluteError: null,
        percentageError: null,
        status: 'UNKNOWN',
      };
    }

    // Absolute Error: actual - forecast (positive means actual beat forecast, negative means underperformed)
    const absoluteError = Math.round((actualValue - forecastValue) * 100) / 100;

    // Percentage Error: ((actual - forecast) / actual) * 100
    // Zero-denominator protection: if actualValue === 0, percentage error cannot be calculated
    let percentageError: number | null = null;
    if (actualValue !== 0) {
      percentageError = Math.round(((actualValue - forecastValue) / Math.abs(actualValue)) * 10000) / 100;
    }

    return {
      metric,
      forecastPeriod,
      forecastValue,
      actualValue,
      absoluteError,
      percentageError,
      status: 'EVALUATED',
    };
  }
}
