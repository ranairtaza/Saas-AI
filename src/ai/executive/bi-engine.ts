import { prisma } from '../../lib/db';
import { calculateFreshness } from '../../lib/integrations/health';
// CrmSnapshotter is intentionally NOT imported here to guarantee read-only telemetry queries with zero GET side-effects

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
    // Read-only deterministic telemetry: DO NOT perform database writes/snapshots on GET

    const metrics = await prisma.businessMetric.findMany({
      where: { organizationId },
      select: {
        key: true,
        unit: true,
        snapshots: {
          orderBy: { timestamp: 'desc' },
          take: 2,
          select: {
            source: true,
            value: true,
            timestamp: true,
          }
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

    // Read-only CRM counts if snapshots are not yet taken (ZERO database writes)
    let liveTotalLeads: number | null = null;
    let liveQualifiedLeads: number | null = null;
    let liveUnassignedPriorityLeads = 0;

    try {
      const [totalCount, qualCount, unassignedCount] = await Promise.all([
        !metricMap.has('TOTAL_LEADS') ? prisma.lead.count({ where: { organizationId } }) : Promise.resolve(null),
        !metricMap.has('QUALIFIED_LEADS') ? prisma.lead.count({ where: { organizationId, score: { gte: 75 } } }) : Promise.resolve(null),
        prisma.lead.count({ where: { organizationId, ownerId: null, score: { gte: 75 } } }).catch(() => 0),
      ]);
      liveTotalLeads = totalCount;
      liveQualifiedLeads = qualCount;
      liveUnassignedPriorityLeads = unassignedCount ?? 0;
    } catch {
      // Non-blocking read fallback
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
      if (key === 'TOTAL_LEADS' && liveTotalLeads !== null) {
        return {
          value: liveTotalLeads,
          unit: 'COUNT',
          source: 'crm',
          freshness: 'REAL_TIME',
          confidence: 'HIGH',
          conflict: false,
          lastUpdatedAt: null,
        };
      }
      if (key === 'QUALIFIED_LEADS' && liveQualifiedLeads !== null) {
        return {
          value: liveQualifiedLeads,
          unit: 'COUNT',
          source: 'crm',
          freshness: 'REAL_TIME',
          confidence: 'HIGH',
          conflict: false,
          lastUpdatedAt: null,
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
          value: liveUnassignedPriorityLeads,
          unit: 'COUNT',
          source: 'crm',
          freshness: 'REAL_TIME',
          confidence: 'HIGH',
          conflict: false,
          lastUpdatedAt: null
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

    // Calculate anomalies (e.g. unassigned leads) using already-queried liveUnassignedPriorityLeads (ZERO duplicate DB count)
    const unassignedHighPriorityLeadsCount = liveUnassignedPriorityLeads;

    telemetry.metrics.unassignedHighPriorityLeads.value = unassignedHighPriorityLeadsCount;

    if (unassignedHighPriorityLeadsCount >= 3) {
      telemetry.recentAnomalies.push({
        metric: 'unassigned_leads',
        deviationPct: 40,
        description: `${unassignedHighPriorityLeadsCount} high-value leads are unassigned and require executive routing.`,
      });
    }

    // Determine data freshness for external providers ONLY (Single bounded batch query, eliminating N+1 DB calls)
    const connections = await prisma.integrationConnection.findMany({
      where: { organizationId },
      include: { integration: true }
    });

    const connectionIds = connections.map((c) => c.id);
    const syncJobs = connectionIds.length > 0
      ? await prisma.syncJob.findMany({
          where: {
            integrationConnectionId: { in: connectionIds },
            status: 'COMPLETED',
          },
          orderBy: { completedAt: 'desc' },
          select: {
            integrationConnectionId: true,
            completedAt: true,
          },
        })
      : [];

    const latestJobMap = new Map<string, Date>();
    for (const job of syncJobs) {
      if (!latestJobMap.has(job.integrationConnectionId) && job.completedAt) {
        latestJobMap.set(job.integrationConnectionId, job.completedAt);
      }
    }

    const freshnessList = connections.map((conn) => {
      const lastSuccessfulSyncAt = latestJobMap.get(conn.id) || null;
      return {
        provider: conn.integration.provider,
        status: conn.status,
        freshness: calculateFreshness(lastSuccessfulSyncAt),
        lastSuccessfulSyncAt,
      };
    });

    telemetry.dataFreshness = freshnessList;

    return telemetry;
  }
}
