export type DataFreshnessStatus = 'CURRENT' | 'AGING' | 'STALE' | 'UNKNOWN';
export type IntegrationHealthState = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'DISCONNECTED' | 'NEVER_SYNCED' | 'STALE';

export interface ProviderHealth {
  provider: string;
  status: IntegrationHealthState;
  freshness: DataFreshnessStatus;
  lastSuccessfulSyncAt: Date | null;
  lastSyncAttemptAt: Date | null;
  consecutiveFailures: number;
}

const CURRENT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const AGING_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

export function calculateFreshness(lastSuccessfulSyncAt: Date | null, now: Date = new Date()): DataFreshnessStatus {
  if (!lastSuccessfulSyncAt) return 'UNKNOWN';
  
  const elapsed = now.getTime() - lastSuccessfulSyncAt.getTime();
  
  if (elapsed <= CURRENT_THRESHOLD_MS) return 'CURRENT';
  if (elapsed <= AGING_THRESHOLD_MS) return 'AGING';
  return 'STALE';
}

export function calculateIntegrationHealth(
  connectionStatus: string, 
  lastSuccessfulSyncAt: Date | null, 
  consecutiveFailures: number,
  now: Date = new Date()
): IntegrationHealthState {
  if (connectionStatus === 'DISCONNECTED') return 'DISCONNECTED';
  if (!lastSuccessfulSyncAt && consecutiveFailures === 0) return 'NEVER_SYNCED';

  const freshness = calculateFreshness(lastSuccessfulSyncAt, now);

  if (connectionStatus === 'FAILING' || consecutiveFailures >= 3) {
    return 'FAILING';
  }

  if (consecutiveFailures > 0 && consecutiveFailures < 3) {
    return 'DEGRADED';
  }

  if (freshness === 'STALE') {
    return 'STALE'; // or DEGRADED/FAILING based on preference
  }

  return 'HEALTHY';
}
