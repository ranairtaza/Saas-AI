/**
 * Phase 49: Executive Dashboard Aggregation & Read-Model Service
 *
 * Implements a strict Read-Model boundary for the Executive Command Center:
 * 1. Fast Executive Snapshot (sub-50ms read model for first-screen hero, health, opportunities, risks, attention)
 * 2. Deep Executive Intelligence (outcomes, recommendations, events, forecasts, decisions, action plans)
 * 3. Unified or Staged progressive loading (mode: 'snapshot' | 'deep' | 'full')
 * 4. Production-safe distributed caching via Upstash Redis with bounded in-memory fallback
 * 5. Explicit freshness metadata (generatedAt, sourceDataThrough, freshness, calculationStatus)
 * 6. Focused Prisma selects (eliminating large JSON snapshots and payloads)
 * 7. Clean canonical property alignment: operatingState.recentLearningSignals
 * 8. Zero GET side-effects, zero synchronous Gemini calls, zero external provider calls
 */

import { prisma } from '../../lib/db';
import { ExecutiveOperatingSystemService } from './operating-state/service';
import { ExecutiveValueLayer } from './executive-value-layer';
import { ExecutiveBriefingEngine } from './briefing-engine';
import { BusinessHealthEvaluator } from './health-evaluator';
import { BusinessIntelligenceEngine } from './bi-engine';
import { ExecutiveObservationEngine } from './observation-engine';
import { Redis } from '@upstash/redis';
import { recordTelemetry } from '../../lib/observability/telemetry';

export interface ExecutiveSnapshotReadModel {
  health: {
    overallScore: number | string;
    status: string;
    breakdown?: any;
  };
  executiveSummary: string;
  topOpportunity: {
    title: string;
    financialImpact?: number | null;
    domain?: string;
  } | null;
  topRisk: {
    title: string;
    severity?: string;
    domain?: string;
  } | null;
  topAttention: any | null;
  topPendingDecision: any | null;
  topPendingAction: any | null;
  pendingDecisionsCount: number;
  pendingActionsCount: number;
  syncStatus: Array<{
    provider: string;
    status: string;
    freshness: string;
    lastSuccessfulSyncAt: Date | string | null;
  }>;
  evidenceState: {
    overallEvidenceSufficiency: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';
    telemetryMeasured: boolean;
    confidence: string;
  };
  metadata: {
    generatedAt: string;
    sourceDataThrough: string | null;
    freshness: 'REAL_TIME' | 'FRESH' | 'AGING' | 'STALE';
    calculationStatus: 'READY' | 'COMPUTING' | 'DEGRADED' | 'EMPTY';
    cacheHit: boolean;
  };
}

export interface ExecutiveDashboardReadModel {
  snapshot?: ExecutiveSnapshotReadModel;
  operatingState: any;
  valueSynthesis: any;
  briefing: any | null;
  outcomes: any[];
  recommendations: any[];
  events: any[];
  refreshedAt: string;
  metadata?: {
    generatedAt: string;
    sourceDataThrough: string | null;
    freshness: 'REAL_TIME' | 'FRESH' | 'AGING' | 'STALE';
    calculationStatus: 'READY' | 'COMPUTING' | 'DEGRADED' | 'EMPTY';
    cacheHit: boolean;
    mode?: string;
  };
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

// Bounded in-process cache (max 100 entries per map)
const snapshotCache = new Map<string, CacheEntry<ExecutiveSnapshotReadModel>>();
const dashboardCache = new Map<string, CacheEntry<ExecutiveDashboardReadModel>>();
const MAX_CACHE_ENTRIES = 100;

const SNAPSHOT_CACHE_TTL_MS = 30_000; // 30-second TTL for fast read snapshots
const DASHBOARD_CACHE_TTL_MS = 15_000; // 15-second TTL for deep read models

// Initialize Redis defensively
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const redis =
  redisUrl && redisToken && redisUrl.startsWith('https://') && !redisUrl.includes('...')
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

function setBoundedLocalCache<T>(map: Map<string, CacheEntry<T>>, key: string, data: T): void {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(key, { data, cachedAt: Date.now() });
}

export async function invalidateDashboardCache(organizationId?: string): Promise<void> {
  if (organizationId) {
    snapshotCache.delete(organizationId);
    dashboardCache.delete(organizationId);
    if (redis) {
      try {
        await Promise.all([
          redis.del(`exec_snap:${organizationId}`),
          redis.del(`exec_dash:${organizationId}`),
        ]);
      } catch {
        // Safe degrade if Redis is unavailable
      }
    }
  } else {
    snapshotCache.clear();
    dashboardCache.clear();
  }
}

export class ExecutiveDashboardService {
  /**
   * Fast First-Screen Executive Snapshot Read Model.
   * Serves the minimum data required for hero, health score, opportunities, risks, and attention.
   * Latency target: <50ms.
   */
  static async getExecutiveSnapshot(
    organizationId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ExecutiveSnapshotReadModel> {
    const startMs = Date.now();

    // 1. Check distributed Redis cache if configured
    if (!options?.forceRefresh && redis) {
      try {
        const cached = await redis.get<ExecutiveSnapshotReadModel>(`exec_snap:${organizationId}`);
        if (cached) {
          cached.metadata = { ...cached.metadata, cacheHit: true };
          return cached;
        }
      } catch {
        // Safe degrade to in-memory on Redis failure
      }
    }

    // 2. Check local in-memory cache
    if (!options?.forceRefresh) {
      const cached = snapshotCache.get(organizationId);
      if (cached && Date.now() - cached.cachedAt < SNAPSHOT_CACHE_TTL_MS) {
        return {
          ...cached.data,
          metadata: { ...cached.data.metadata, cacheHit: true },
        };
      }
    }

    // 3. Assemble lightweight snapshot data (Focused queries only)
    const [telemetry, pendingDecision, pendingAction, pendingDecisionsCount, pendingActionsCount, topOpp, topRiskItem] =
      await Promise.all([
        BusinessIntelligenceEngine.assembleTelemetry(organizationId).catch(() => null),
        prisma.executiveDecision.findFirst({
          where: { organizationId, status: { in: ['PENDING', 'DEFERRED'] } },
          orderBy: { priority: 'desc' },
          select: { id: true, title: true, domain: true, priority: true, status: true },
        }).catch(() => null),
        prisma.pendingAction.findFirst({
          where: { organizationId, status: 'WAITING' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, actionName: true, actionType: true, riskLevel: true, status: true },
        }).catch(() => null),
        prisma.executiveDecision.count({
          where: { organizationId, status: { in: ['PENDING', 'DEFERRED'] } },
        }).catch(() => 0),
        prisma.pendingAction.count({
          where: { organizationId, status: 'WAITING' },
        }).catch(() => 0),
        prisma.executiveForecast.findFirst({
          where: { organizationId, direction: 'INCREASING', confidence: { not: 'INSUFFICIENT' } },
          orderBy: { updatedAt: 'desc' },
          select: { metric: true, domain: true, forecastValue: true, currentValue: true }
        }).catch(() => null),
        prisma.executiveForecast.findFirst({
          where: { organizationId, direction: 'DECREASING', confidence: { not: 'INSUFFICIENT' } },
          orderBy: { updatedAt: 'desc' },
          select: { metric: true, domain: true, forecastValue: true, currentValue: true }
        }).catch(() => null)
      ]);

    const telemetryMeasured = Boolean(telemetry?.metrics?.revenueMTD?.value != null || telemetry?.metrics?.totalLeads?.value != null);
    
    // Evaluate health directly from telemetry (mocking the context shape needed by the evaluator)
    const mockContext = { telemetry: telemetry || { metrics: {} }, goals: [] };
    const healthResult = telemetryMeasured 
      ? BusinessHealthEvaluator.evaluateHealth(mockContext as any)
      : { overallScore: 75, status: 'STABLE', domains: {} as any };

    const healthScore = telemetryMeasured ? healthResult.overallScore : '—';
    const healthStatus = telemetryMeasured ? healthResult.status : 'UNRATED';

    const topOpportunity = topOpp
      ? {
          title: `${topOpp.metric} growth trajectory`,
          financialImpact: Math.abs(topOpp.forecastValue - topOpp.currentValue),
          domain: topOpp.domain,
        }
      : null;

    const topRisk = topRiskItem
      ? {
          title: `Decline in ${topRiskItem.metric}`,
          severity: 'HIGH',
          domain: topRiskItem.domain,
        }
      : null;

    const topAttention = null; // Lightweight snapshot leaves this null unless we want to query something specific

    const syncStatus = telemetry?.dataFreshness ?? [];
    const sourceDataThrough = syncStatus.reduce<string | null>((latest, item) => {
      if (!item.lastSuccessfulSyncAt) return latest;
      const ts = new Date(item.lastSuccessfulSyncAt).toISOString();
      return !latest || ts > latest ? ts : latest;
    }, null);

    let freshness: 'REAL_TIME' | 'FRESH' | 'AGING' | 'STALE' = syncStatus.length > 0 ? 'REAL_TIME' : 'STALE';
    if (syncStatus.length === 0) {
      freshness = 'STALE'; // Cannot claim real-time if no telemetry exists
    } else if (syncStatus.some((s) => s.freshness === 'STALE')) {
      freshness = 'STALE';
    } else if (syncStatus.some((s) => s.freshness === 'AGING')) {
      freshness = 'AGING';
    } else if (syncStatus.some((s) => s.freshness === 'FRESH')) {
      freshness = 'FRESH';
    }

    const snapshot: ExecutiveSnapshotReadModel = {
      health: {
        overallScore: healthScore,
        status: healthStatus,
        breakdown: telemetryMeasured ? healthResult.domains : undefined,
      },
      executiveSummary: telemetryMeasured 
        ? 'Business operating within expected parameters.' 
        : 'Awaiting sufficient telemetry to form an operational summary.',
      topOpportunity,
      topRisk,
      topAttention,
      topPendingDecision: pendingDecision,
      topPendingAction: pendingAction,
      pendingDecisionsCount,
      pendingActionsCount,
      syncStatus,
      evidenceState: {
        overallEvidenceSufficiency: telemetryMeasured ? 'PARTIAL' : 'INSUFFICIENT',
        telemetryMeasured,
        confidence: telemetryMeasured ? 'MEDIUM' : 'UNAVAILABLE',
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceDataThrough,
        freshness,
        calculationStatus: telemetryMeasured ? 'READY' : 'EMPTY',
        cacheHit: false,
      },
    };

    // Store in local cache
    setBoundedLocalCache(snapshotCache, organizationId, snapshot);

    // Store in Redis with 30s TTL
    if (redis) {
      redis.set(`exec_snap:${organizationId}`, snapshot, { ex: 30 }).catch(() => {});
    }

    const elapsed = Date.now() - startMs;
    recordTelemetry({
      organizationId,
      eventType: 'REQUEST',
      severity: 'INFO',
      route: '/api/executive/dashboard',
      method: 'GET',
      service: 'executive.snapshot',
      durationMs: elapsed,
      metadata: { cacheHit: false, durationMs: elapsed },
    });

    return snapshot;
  }

  /**
   * Deep Executive Intelligence Read Model (Outcomes, Recommendations, Events).
   * Loaded progressively after initial screen rendering.
   */
  static async getExecutiveDeepIntelligence(
    organizationId: string,
    options?: { forceRefresh?: boolean }
  ) {
    const [outcomes, recommendations, events] = await Promise.all([
      prisma.executiveOutcome.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          targetKpiKey: true,
          baselineValue: true,
          finalValue: true,
          deltaPercentage: true,
          expectedValue: true,
          variance: true,
          varianceStatus: true,
          resultStatus: true,
          attributionLevel: true,
          attributionRationale: true,
          effectivenessScore: true,
          measurementWindowDays: true,
          evaluationDueAt: true,
          startedAt: true,
          status: true,
        },
      }).catch(() => []),

      prisma.executiveRecommendation.findMany({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { priorityScore: 'desc' },
        take: 5,
        select: {
          id: true,
          priorityLevel: true,
          domain: true,
          priorityScore: true,
          status: true,
          title: true,
          executiveSummary: true,
          expectedImpact: true,
          createdAt: true,
        },
      }).catch(() => []),

      prisma.executiveEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          severity: true,
          domain: true,
          eventType: true,
          summary: true,
          sourceTable: true,
          sourceRecordId: true,
          facts: true,
          metadata: true,
          createdAt: true,
          occurredAt: true,
        },
      }).catch(() => []),
    ]);

    return { outcomes, recommendations, events };
  }

  /**
   * Returns the complete or staged executive dashboard read model.
   * Supports options.mode = 'snapshot' | 'deep' | 'full'
   */
  static async getDashboardReadModel(
    organizationId: string,
    options?: { forceRefresh?: boolean; mode?: 'snapshot' | 'deep' | 'full' }
  ): Promise<any> {
    const mode = options?.mode || 'full';

    // Staged loading: if only snapshot requested, delegate directly to fast snapshot
    if (mode === 'snapshot') {
      return this.getExecutiveSnapshot(organizationId, options);
    }

    // Staged loading: if only deep sections requested
    if (mode === 'deep') {
      const [operatingState, { outcomes, recommendations, events }] = await Promise.all([
        ExecutiveOperatingSystemService.getOperatingState(organizationId, {
          forceRefresh: options?.forceRefresh,
        }),
        this.getExecutiveDeepIntelligence(organizationId, options),
      ]);

      const valueSynthesis = ExecutiveValueLayer.synthesize(operatingState);
      let briefing: any | null = null;
      if (operatingState.businessContext) {
        try {
          const criticalCount = events.filter((e: any) => e.severity === 'CRITICAL').length;
          const health = BusinessHealthEvaluator.evaluateHealth(operatingState.businessContext, {
            activeEventCount: events.length,
            criticalEventCount: criticalCount,
          });
          const observations = ExecutiveObservationEngine.synthesizeObservations(
            operatingState.businessContext,
            events as any
          );
          briefing = ExecutiveBriefingEngine.generateGroundedFallback({
            context: operatingState.businessContext,
            events: events as any,
            recommendations,
            health,
            observations,
            decisions: operatingState.activeDecisions || [],
            forecasts: operatingState.activeForecasts || [],
            actionPlans: operatingState.actionPlans || [],
            learningSignals: operatingState.recentLearningSignals || [],
            recentLearningSignals: operatingState.recentLearningSignals || [],
          });
        } catch (e) {
          console.warn('[ExecutiveDashboardService] Briefing synthesis fallback:', e);
        }
      }

      return {
        operatingState,
        valueSynthesis,
        briefing,
        outcomes,
        recommendations,
        events,
        refreshedAt: new Date().toISOString(),
      };
    }

    // Full read model (or cached composite)
    if (!options?.forceRefresh && redis) {
      try {
        const cached = await redis.get<ExecutiveDashboardReadModel>(`exec_dash:${organizationId}`);
        if (cached) {
          if (cached.metadata) cached.metadata.cacheHit = true;
          return cached;
        }
      } catch {
        // Fallback
      }
    }

    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(organizationId);
      if (cached && Date.now() - cached.cachedAt < DASHBOARD_CACHE_TTL_MS) {
        return {
          ...cached.data,
          metadata: { ...(cached.data.metadata as any), cacheHit: true },
        };
      }
    }

    // Parallel fetch: operating state, snapshot, and deep entities
    const [operatingState, snapshot, { outcomes, recommendations, events }] = await Promise.all([
      ExecutiveOperatingSystemService.getOperatingState(organizationId, {
        forceRefresh: options?.forceRefresh,
      }),
      this.getExecutiveSnapshot(organizationId, options),
      this.getExecutiveDeepIntelligence(organizationId, options),
    ]);

    const valueSynthesis = ExecutiveValueLayer.synthesize(operatingState);

    // Synthesize executive briefing directly from operating state with CANONICAL recentLearningSignals
    let briefing: any | null = null;
    if (operatingState.businessContext) {
      try {
        const criticalCount = events.filter((e: any) => e.severity === 'CRITICAL').length;
        const health = BusinessHealthEvaluator.evaluateHealth(operatingState.businessContext, {
          activeEventCount: events.length,
          criticalEventCount: criticalCount,
        });
        const observations = ExecutiveObservationEngine.synthesizeObservations(
          operatingState.businessContext,
          events as any
        );

        // Pass canonical recentLearningSignals without 'as any'
        briefing = ExecutiveBriefingEngine.generateGroundedFallback({
          context: operatingState.businessContext,
          events: events as any,
          recommendations,
          health,
          observations,
          decisions: operatingState.activeDecisions || [],
          forecasts: operatingState.activeForecasts || [],
          actionPlans: operatingState.actionPlans || [],
          learningSignals: operatingState.recentLearningSignals || [],
          recentLearningSignals: operatingState.recentLearningSignals || [],
        });
      } catch (e) {
        console.warn('[ExecutiveDashboardService] Briefing synthesis fallback:', e);
      }
    }

    const result: ExecutiveDashboardReadModel = {
      snapshot,
      operatingState,
      valueSynthesis,
      briefing,
      outcomes,
      recommendations,
      events,
      refreshedAt: new Date().toISOString(),
      metadata: {
        generatedAt: snapshot.metadata.generatedAt,
        sourceDataThrough: snapshot.metadata.sourceDataThrough,
        freshness: snapshot.metadata.freshness,
        calculationStatus: snapshot.metadata.calculationStatus,
        cacheHit: false,
        mode: 'full',
      },
    };

    setBoundedLocalCache(dashboardCache, organizationId, result);

    if (redis) {
      redis.set(`exec_dash:${organizationId}`, result, { ex: 15 }).catch(() => {});
    }

    return result;
  }
}
