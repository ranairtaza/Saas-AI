import { prisma } from '../../lib/db';
import { calculateFreshness } from '../../lib/integrations/health';
import { CrmSnapshotter } from '../../business/metrics/crm-snapshotter';

export interface TelemetryMetric {
  value: number | null;
  unit: string;
  source: string;
  freshness: string; // 'REAL_TIME', 'CURRENT', 'AGING', 'STALE', 'UNKNOWN', 'UNAVAILABLE', 'CONFLICTING'
  confidence: string; // 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'
  conflict: boolean;
  lastUpdatedAt: Date | null;
}

export interface UnifiedTelemetry {
  metrics: {
    revenueMTD: TelemetryMetric;
    revenueLastMonth: TelemetryMetric;
    revenueGrowth: TelemetryMetric;
    transactionsMTD: TelemetryMetric;
    newCustomersMTD: TelemetryMetric;
    activeSubscriptions: TelemetryMetric;
    totalLeads: TelemetryMetric;
    qualifiedLeads: TelemetryMetric;
    activeLeadsCount: TelemetryMetric;
    unassignedHighPriorityLeads: TelemetryMetric;
    pipelineValue: TelemetryMetric;
  };
  recentAnomalies: Array<{ metric: string; deviationPct: number; description: string }>;
  dataFreshness: Array<{
    provider: string;
    status: string;
    freshness: string;
    lastSuccessfulSyncAt: Date | null;
  }>;
}

export class BusinessIntelligenceEngine {
  static async assembleTelemetry(organizationId: string): Promise<UnifiedTelemetry> {
    await CrmSnapshotter.snapshotOrganization(organizationId);

    const metrics = await prisma.businessMetric.findMany({
      where: { organizationId },
      include: {
        snapshots: {
          orderBy: { timestamp: 'desc' },
          take: 2,
        },
      },
    });

    const metricMap = new Map<string, any>();
    
    for (const m of metrics) {
      if (m.snapshots.length > 0) {
        const primary = m.snapshots[0];
        let isConflict = false;
        
        if (m.snapshots.length > 1) {
          const secondary = m.snapshots[1];
          const timeDiffHours = Math.abs(primary.timestamp.getTime() - secondary.timestamp.getTime()) / (1000 * 60 * 60);
          if (timeDiffHours <= 24 && primary.source !== secondary.source) {
            if (primary.value !== secondary.value) {
              if (secondary.value !== 0) {
                 const variance = Math.abs(primary.value - secondary.value) / Math.abs(secondary.value);
                 if (variance > 0.05) isConflict = true; 
              } else if (primary.value !== 0) {
                 isConflict = true;
              }
            }
          }
        }

        const freshnessStatus = primary.source === 'crm' ? 'REAL_TIME' : calculateFreshness(primary.timestamp);
        let confidence = 'UNKNOWN';
        if (isConflict) {
          confidence = 'LOW';
        } else if (freshnessStatus === 'REAL_TIME' || freshnessStatus === 'CURRENT') {
          confidence = 'HIGH';
        } else if (freshnessStatus === 'STALE') {
          confidence = 'LOW';
        } else if (freshnessStatus === 'AGING') {
          confidence = 'MEDIUM';
        } else {
          confidence = 'UNKNOWN';
        }

        metricMap.set(m.key, {
          value: primary.value,
          unit: m.unit,
          source: primary.source,
          freshness: isConflict ? 'CONFLICTING' : freshnessStatus,
          confidence,
          conflict: isConflict,
          lastUpdatedAt: primary.timestamp
        });
      }
    }

    const resolveMetric = (key: string): TelemetryMetric => {
      const data = metricMap.get(key);
      if (data) {
        return {
          value: data.value,
          unit: data.unit,
          source: data.source,
          freshness: data.freshness,
          confidence: data.confidence,
          conflict: data.conflict,
          lastUpdatedAt: data.lastUpdatedAt
        };
      }
      return {
        value: null,
        unit: 'UNKNOWN',
        source: 'NONE',
        freshness: 'UNAVAILABLE',
        confidence: 'UNKNOWN',
        conflict: false,
        lastUpdatedAt: null
      };
    };

    const telemetry: UnifiedTelemetry = {
      metrics: {
        revenueMTD: resolveMetric('REVENUE_MTD'),
        revenueLastMonth: resolveMetric('REVENUE_LAST_MONTH'),
        revenueGrowth: {
          value: null,
          unit: 'PERCENTAGE',
          source: 'calculated',
          freshness: 'UNAVAILABLE',
          confidence: 'UNKNOWN',
          conflict: false,
          lastUpdatedAt: null
        },
        transactionsMTD: resolveMetric('TRANSACTIONS_MTD'),
        newCustomersMTD: resolveMetric('NEW_CUSTOMERS_MTD'),
        activeSubscriptions: resolveMetric('ACTIVE_SUBSCRIPTIONS'),
        totalLeads: resolveMetric('TOTAL_LEADS'),
        qualifiedLeads: resolveMetric('QUALIFIED_LEADS'),
        activeLeadsCount: resolveMetric('TOTAL_LEADS'),
        unassignedHighPriorityLeads: {
          value: 0,
          unit: 'COUNT',
          source: 'crm',
          freshness: 'REAL_TIME',
          confidence: 'HIGH',
          conflict: false,
          lastUpdatedAt: new Date()
        },
        pipelineValue: resolveMetric('PIPELINE_VALUE')
      },
      recentAnomalies: [],
      dataFreshness: []
    };

    const revMTD = telemetry.metrics.revenueMTD;
    const revLastMonth = telemetry.metrics.revenueLastMonth;

    if (revMTD.conflict || revLastMonth.conflict) {
      telemetry.metrics.revenueGrowth = {
        value: null,
        unit: 'PERCENTAGE',
        source: 'calculated',
        freshness: 'CONFLICTING',
        confidence: 'LOW',
        conflict: true,
        lastUpdatedAt: new Date()
      };
    } else if (
      revMTD.freshness !== 'UNAVAILABLE' &&
      revLastMonth.freshness !== 'UNAVAILABLE' &&
      typeof revMTD.value === 'number' &&
      typeof revLastMonth.value === 'number' &&
      revLastMonth.value !== 0
    ) {
      const growth = ((revMTD.value - revLastMonth.value) / revLastMonth.value) * 100;
      
      const confMap: Record<string, number> = { 'UNKNOWN': 0, 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
      const mtdConf = confMap[revMTD.confidence] ?? 0;
      const lastMonthConf = confMap[revLastMonth.confidence] ?? 0;
      const minConf = Math.min(mtdConf, lastMonthConf);
      const confStr = minConf === 3 ? 'HIGH' : minConf === 2 ? 'MEDIUM' : minConf === 1 ? 'LOW' : 'UNKNOWN';
      
      telemetry.metrics.revenueGrowth = {
        value: growth,
        unit: 'PERCENTAGE',
        source: 'calculated',
        freshness: revMTD.freshness === 'AGING' || revLastMonth.freshness === 'AGING' ? 'AGING' : revMTD.freshness,
        confidence: confStr,
        conflict: false,
        lastUpdatedAt: new Date()
      };
    } else {
      telemetry.metrics.revenueGrowth = {
        value: null,
        unit: 'PERCENTAGE',
        source: 'calculated',
        freshness: 'UNAVAILABLE',
        confidence: 'UNKNOWN',
        conflict: false,
        lastUpdatedAt: new Date()
      };
    }

    // Calculate anomalies (e.g. unassigned leads)
    const unassignedHighPriorityLeadsCount = await prisma.lead.count({
      where: {
        organizationId,
        score: { gte: 75 },
        ownerId: null,
      },
    });

    telemetry.metrics.unassignedHighPriorityLeads.value = unassignedHighPriorityLeadsCount;

    if (unassignedHighPriorityLeadsCount >= 3) {
      telemetry.recentAnomalies.push({
        metric: 'unassigned_leads',
        deviationPct: 40,
        description: `${unassignedHighPriorityLeadsCount} high-value leads are unassigned and require executive routing.`,
      });
    }

    // Determine data freshness for external providers ONLY
    const connections = await prisma.integrationConnection.findMany({
      where: { organizationId },
      include: { integration: true }
    });

    const freshnessList = await Promise.all(connections.map(async (conn) => {
      const latestSuccessJob = await prisma.syncJob.findFirst({
        where: { integrationConnectionId: conn.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' }
      });
      
      const lastSuccessfulSyncAt = latestSuccessJob?.completedAt || null;
      
      return {
        provider: conn.integration.provider,
        status: conn.status,
        freshness: calculateFreshness(lastSuccessfulSyncAt),
        lastSuccessfulSyncAt
      };
    }));

    telemetry.dataFreshness = freshnessList;

    return telemetry;
  }
}
