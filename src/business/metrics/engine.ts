export class MetricEngine {
  /**
   * Calculates profit given revenue and expenses.
   */
  static calculateProfit(revenue: number, expenses: number): number {
    return revenue - expenses;
  }

  /**
   * Calculates profit margin given revenue and profit.
   * Returns a percentage (e.g., 20.5 for 20.5%).
   * Returns 0 if revenue is 0.
   */
  static calculateMargin(revenue: number, profit: number): number {
    if (revenue === 0) return 0;
    return (profit / revenue) * 100;
  }

  /**
   * Calculates the percentage growth between a previous and current value.
   * Returns a percentage (e.g., -15.5 for -15.5%).
   * Returns 0 if previous value is 0 (to avoid infinity).
   */
  static calculateGrowthPercentage(previous: number, current: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0; // simplistic fallback
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  /**
   * Aggregates an array of numeric values based on the specified type.
   */
  static aggregate(values: number[], type: 'SUM' | 'AVERAGE' | 'MIN' | 'MAX'): number {
    if (values.length === 0) return 0;

    switch (type) {
      case 'SUM':
        return values.reduce((sum, val) => sum + val, 0);
      case 'AVERAGE':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'MIN':
        return Math.min(...values);
      case 'MAX':
        return Math.max(...values);
      default:
        return 0;
    }
  }
}
