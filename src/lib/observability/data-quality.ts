/**
 * Phase 48: Data Quality & Integrity Checker
 * Evaluates business telemetry, integration sync freshness, schema alignment,
 * and outcome attributions deterministically without fake fallback values.
 */

import prisma from '@/lib/db';

export type QualityState = 'VALID' | 'WARNING' | 'INVALID' | 'INSUFFICIENT_DATA' | 'UNKNOWN';

export interface QualityCheckItem {
  id: string;
  name: string;
  check: string;
  category: 'TELEMETRY' | 'INTEGRATIONS' | 'ATTRIBUTION' | 'CONFIGURATION';
  status: QualityState;
  message: string;
  count?: number;
  details?: string;
}

export interface DataQualityReport {
  status: QualityState;
  overallStatus: QualityState;
  checkedAt: string;
  checks: QualityCheckItem[];
  warningsCount: number;
  invalidCount: number;
}

export async function checkDataQuality(): Promise<DataQualityReport> {
  const rawChecks: QualityCheckItem[] = [];
  const addCheck = (item: {
    id: string;
    name: string;
    category: 'TELEMETRY' | 'INTEGRATIONS' | 'ATTRIBUTION' | 'CONFIGURATION';
    status: QualityState;
    message: string;
    count?: number;
    details?: string;
  }) => {
    rawChecks.push({ ...item, check: item.name });
  };

  // 1. Check Telemetry & Metrics Presence
  try {
    const totalMetrics = await prisma.businessMetric.count();
    const metricsWithoutSnapshots = await prisma.businessMetric.count({
      where: {
        snapshots: { none: {} },
      },
    });

    if (totalMetrics === 0) {
      addCheck({
        id: 'metric-records',
        name: 'Business Metrics Telemetry',
        category: 'TELEMETRY',
        status: 'INSUFFICIENT_DATA',
        message: 'No business metric records found in database. Initial ingestion pending.',
      });
    } else if (metricsWithoutSnapshots > 0) {
      addCheck({
        id: 'metric-snapshots',
        name: 'Metric Snapshot Coverage',
        category: 'TELEMETRY',
        status: 'WARNING',
        count: metricsWithoutSnapshots,
        message: `${metricsWithoutSnapshots} metric(s) have no recorded snapshot data.`,
      });
    } else {
      addCheck({
        id: 'metric-records',
        name: 'Business Metrics Telemetry',
        category: 'TELEMETRY',
        status: 'VALID',
        count: totalMetrics,
        message: `${totalMetrics} business metrics verified with valid snapshot histories.`,
      });
    }
  } catch (err: any) {
    addCheck({
      id: 'metric-records-err',
      name: 'Business Metrics Telemetry',
      category: 'TELEMETRY',
      status: 'UNKNOWN',
      message: `Failed to query metrics: ${err.message || 'Database error'}`,
    });
  }

  // 2. Check Integration Freshness & Stale Connections (> 48 hours without sync)
  try {
    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const staleConnections = await prisma.integrationConnection.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { lastSyncAt: { lt: staleThreshold } },
          { lastSyncAt: null },
        ],
      },
      select: { id: true, integration: { select: { provider: true } }, lastSyncAt: true },
    });

    if (staleConnections.length > 0) {
      addCheck({
        id: 'stale-integrations',
        name: 'Integration Sync Freshness',
        category: 'INTEGRATIONS',
        status: 'WARNING',
        count: staleConnections.length,
        message: `${staleConnections.length} active integration(s) have not synced in > 48 hours.`,
        details: staleConnections.map((c) => c.integration.provider).join(', '),
      });
    } else {
      const activeCount = await prisma.integrationConnection.count({ where: { status: 'ACTIVE' } });
      addCheck({
        id: 'stale-integrations',
        name: 'Integration Sync Freshness',
        category: 'INTEGRATIONS',
        status: activeCount > 0 ? 'VALID' : 'INSUFFICIENT_DATA',
        count: activeCount,
        message: activeCount > 0
          ? 'All active integration connections synced within 48-hour SLA.'
          : 'No active integration connections configured.',
      });
    }
  } catch (err: any) {
    addCheck({
      id: 'integrations-err',
      name: 'Integration Freshness',
      category: 'INTEGRATIONS',
      status: 'UNKNOWN',
      message: `Failed to verify integrations: ${err.message}`,
    });
  }

  // 3. Check Outcome Attributions & Inconclusive States
  try {
    const totalOutcomes = await prisma.executiveOutcome.count();
    const inconclusiveOutcomes = await prisma.executiveOutcome.count({
      where: { resultStatus: 'INCONCLUSIVE' },
    });

    if (totalOutcomes === 0) {
      addCheck({
        id: 'outcome-attributions',
        name: 'Executive Outcome Attributions',
        category: 'ATTRIBUTION',
        status: 'INSUFFICIENT_DATA',
        message: 'No executive outcomes evaluated yet.',
      });
    } else if (inconclusiveOutcomes > 0) {
      addCheck({
        id: 'outcome-attributions',
        name: 'Executive Outcome Attributions',
        category: 'ATTRIBUTION',
        status: 'WARNING',
        count: inconclusiveOutcomes,
        message: `${inconclusiveOutcomes} outcome(s) marked INCONCLUSIVE (e.g. unknown KPI or missing baseline).`,
      });
    } else {
      addCheck({
        id: 'outcome-attributions',
        name: 'Executive Outcome Attributions',
        category: 'ATTRIBUTION',
        status: 'VALID',
        count: totalOutcomes,
        message: `${totalOutcomes} outcome evaluations verified with causal/correlated attribution.`,
      });
    }
  } catch (err: any) {
    addCheck({
      id: 'outcomes-err',
      name: 'Executive Outcomes',
      category: 'ATTRIBUTION',
      status: 'UNKNOWN',
      message: `Failed to query outcomes: ${err.message}`,
    });
  }

  const checks = rawChecks;
  const warningsCount = checks.filter((c) => c.status === 'WARNING').length;
  const invalidCount = checks.filter((c) => c.status === 'INVALID').length;

  let overallStatus: QualityState = 'VALID';
  if (invalidCount > 0) overallStatus = 'INVALID';
  else if (warningsCount > 0) overallStatus = 'WARNING';
  else if (checks.every((c) => c.status === 'INSUFFICIENT_DATA')) overallStatus = 'INSUFFICIENT_DATA';

  return {
    status: overallStatus,
    overallStatus,
    checkedAt: new Date().toISOString(),
    checks,
    warningsCount,
    invalidCount,
  };
}
