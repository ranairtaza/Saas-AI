import { calculateFreshness } from '../../../lib/integrations/health';

export interface RawSnapshotInput {
  timestamp: Date | string;
  value: number | null | undefined;
  source: string;
}

export interface ValidatedPeriod {
  period: string;
  timestamp: Date;
  value: number;
  source: string;
}

export interface DataQualityGateResult {
  metric: string;
  status: 'VALID' | 'INSUFFICIENT_DATA' | 'CONFLICTING' | 'INVALID';
  validPeriods: ValidatedPeriod[];
  hasConflict: boolean;
  isStale: boolean;
  hasMissingPeriods: boolean;
  volatilityPct: number;
  providersUsed: string[];
  explanation: string;
}

export class DataQualityGate {
  /**
   * Formats a date into a standardized monthly period string 'YYYY-MM'.
   */
  static getPeriodKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Computes the next chronological period string.
   */
  static getNextPeriodKey(period: string): string {
    const parts = period.split('-');
    if (parts.length === 2) {
      let year = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);
      month += 1;
      if (month > 12) {
        year += 1;
        month = 1;
      }
      return `${year}-${String(month).padStart(2, '0')}`;
    }
    // Default fallback
    return 'NEXT_PERIOD';
  }

  /**
   * Validates raw historical snapshots for a specific metric before forecasting.
   */
  static validate(
    metric: string,
    rawSnapshots: RawSnapshotInput[],
    options?: { asOfDate?: Date }
  ): DataQualityGateResult {
    const now = options?.asOfDate ?? new Date();

    if (!rawSnapshots || rawSnapshots.length === 0) {
      return {
        metric,
        status: 'INSUFFICIENT_DATA',
        validPeriods: [],
        hasConflict: false,
        isStale: false,
        hasMissingPeriods: false,
        volatilityPct: 0,
        providersUsed: [],
        explanation: `No historical snapshots available for metric ${metric}. Minimum 3 valid periods required.`,
      };
    }

    // 1. Filter out null, undefined, NaN, Infinity, and invalid numbers
    const validRaw: Array<{ timestamp: Date; value: number; source: string }> = [];
    const providersSet = new Set<string>();

    for (const snap of rawSnapshots) {
      if (snap.value === null || snap.value === undefined) continue;
      if (typeof snap.value !== 'number' || isNaN(snap.value) || !isFinite(snap.value)) continue;

      // Negative values check: revenue, customer counts, subscriptions, leads cannot be negative
      const isNonNegativeMetric =
        metric.includes('REVENUE') ||
        metric.includes('CUSTOMER') ||
        metric.includes('SUBSCRIPTION') ||
        metric.includes('LEAD') ||
        metric.includes('TRANSACTION');

      if (isNonNegativeMetric && snap.value < 0) continue;

      const date = snap.timestamp instanceof Date ? snap.timestamp : new Date(snap.timestamp);
      if (isNaN(date.getTime())) continue;

      validRaw.push({
        timestamp: date,
        value: snap.value,
        source: snap.source || 'unknown',
      });
      providersSet.add(snap.source || 'unknown');
    }

    if (validRaw.length === 0) {
      return {
        metric,
        status: 'INVALID',
        validPeriods: [],
        hasConflict: false,
        isStale: false,
        hasMissingPeriods: false,
        volatilityPct: 0,
        providersUsed: Array.from(providersSet),
        explanation: `Historical data for ${metric} contained only invalid or null values.`,
      };
    }

    // Sort chronologically ascending
    validRaw.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // 2. Group by period to detect conflicts and duplicates
    // Period is YYYY-MM (or YYYY-MM-DD if timestamps span less than 3 months)
    const firstDate = validRaw[0].timestamp;
    const lastDate = validRaw[validRaw.length - 1].timestamp;
    const spanDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    const useDailyPeriods = spanDays <= 31;

    const periodMap = new Map<string, Array<{ timestamp: Date; value: number; source: string }>>();

    for (const item of validRaw) {
      const pKey = useDailyPeriods
        ? item.timestamp.toISOString().split('T')[0]
        : this.getPeriodKey(item.timestamp);

      if (!periodMap.has(pKey)) {
        periodMap.set(pKey, []);
      }
      periodMap.get(pKey)!.push(item);
    }

    let hasConflict = false;
    const consolidatedPeriods: ValidatedPeriod[] = [];

    for (const [pKey, items] of periodMap.entries()) {
      if (items.length === 1) {
        consolidatedPeriods.push({
          period: pKey,
          timestamp: items[0].timestamp,
          value: items[0].value,
          source: items[0].source,
        });
      } else {
        // Multi-snapshot period: check for source conflict
        const sources = new Set(items.map((i) => i.source));
        const values = items.map((i) => i.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);

        if (sources.size > 1 && minVal !== maxVal) {
          const denom = minVal !== 0 ? Math.abs(minVal) : Math.abs(maxVal);
          const variance = denom > 0 ? (maxVal - minVal) / denom : 1;
          if (variance > 0.05) {
            hasConflict = true;
          }
        }

        // Take latest snapshot in this period
        const latest = items[items.length - 1];
        consolidatedPeriods.push({
          period: pKey,
          timestamp: latest.timestamp,
          value: latest.value,
          source: latest.source,
        });
      }
    }

    // 3. Check for gaps / missing periods (Missing periods MUST NOT become zero)
    let hasMissingPeriods = false;
    if (!useDailyPeriods && consolidatedPeriods.length >= 2) {
      for (let i = 0; i < consolidatedPeriods.length - 1; i++) {
        const currParts = consolidatedPeriods[i].period.split('-').map(Number);
        const nextParts = consolidatedPeriods[i + 1].period.split('-').map(Number);
        if (currParts.length === 2 && nextParts.length === 2) {
          const monthDiff = (nextParts[0] - currParts[0]) * 12 + (nextParts[1] - currParts[1]);
          if (monthDiff > 1) {
            hasMissingPeriods = true;
            break;
          }
        }
      }
    }

    // 4. Check data freshness of most recent snapshot
    const latestSnapshot = consolidatedPeriods[consolidatedPeriods.length - 1];
    let isStale = false;
    if (useDailyPeriods) {
      const freshnessStatus = calculateFreshness(latestSnapshot.timestamp, now);
      isStale = freshnessStatus === 'STALE';
    } else {
      const elapsedDays = (now.getTime() - latestSnapshot.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      isStale = elapsedDays > 45;
    }

    // 5. Data Sufficiency Check: Minimum 3 periods required
    if (consolidatedPeriods.length < 3) {
      return {
        metric,
        status: 'INSUFFICIENT_DATA',
        validPeriods: consolidatedPeriods,
        hasConflict,
        isStale,
        hasMissingPeriods,
        volatilityPct: 0,
        providersUsed: Array.from(providersSet),
        explanation: `Insufficient historical data for ${metric}: ${consolidatedPeriods.length} period(s) found, minimum 3 required.`,
      };
    }

    // 6. If source conflict detected on recent/critical periods, status is CONFLICTING
    if (hasConflict) {
      return {
        metric,
        status: 'CONFLICTING',
        validPeriods: consolidatedPeriods,
        hasConflict: true,
        isStale,
        hasMissingPeriods,
        volatilityPct: 0,
        providersUsed: Array.from(providersSet),
        explanation: `Conflicting source observations detected across validated periods for ${metric}.`,
      };
    }

    // 7. Calculate historical volatility: Coefficient of variation = (stdDev / mean) * 100
    const values = consolidatedPeriods.map((p) => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    let volatilityPct = 0;

    if (mean !== 0) {
      const variance =
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      volatilityPct = Math.round((stdDev / Math.abs(mean)) * 10000) / 100;
    }

    return {
      metric,
      status: 'VALID',
      validPeriods: consolidatedPeriods,
      hasConflict: false,
      isStale,
      hasMissingPeriods,
      volatilityPct,
      providersUsed: Array.from(providersSet),
      explanation: `${consolidatedPeriods.length} validated historical periods ready for forecasting (${values.length} observations).`,
    };
  }
}
