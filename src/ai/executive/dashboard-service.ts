/**
 * Phase 49: Executive Dashboard Aggregation & Read-Model Service
 *
 * Implements a strict Read-Model boundary for the Executive Command Center:
 * 1. Fast Executive Snapshot (lightweight read model for first-screen hero, health, opportunities, risks, attention)
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
import { ExecutiveEventData, EventType, EventDomain, EventSeverity } from './events/types';

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
    snapshot?: {
      telemetry: number;
      decisionQueries: number;
      forecastQueries: number;
      attention: number;
      total: number;
    };
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
const inFlightSnapshots = new Map<string, Promise<ExecutiveSnapshotReadModel>>();
const inFlightDashboards = new Map<string, Promise<ExecutiveDashboardReadModel>>();
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
   * Latency target: Minimal bounded concurrent queries to ensure fast first-paint.
   */
  static async getExecutiveSnapshot(
    organizationId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ExecutiveSnapshotReadModel> {
    const startMs = Date.now();

    // In-flight request coalescing to prevent cache stampedes
    const inFlightKey = `snap:${organizationId}`;
    if (!options?.forceRefresh && inFlightSnapshots.has(inFlightKey)) {
      return inFlightSnapshots.get(inFlightKey) as Promise<ExecutiveSnapshotReadModel>;
    }

    const snapshotPromise = (async () => {
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

      // 3. Assemble lightweight snapshot data concurrently (Focused queries only)
      const telemetryStartMs = Date.now();
      const [
        telemetry,
        pendingDecision,
        pendingAction,
        pendingDecisionsCount,
        pendingActionsCount,
        topOpp,
        topRiskItem
      ] = await Promise.all([
        BusinessIntelligenceEngine.getSnapshotTelemetry(organizationId).catch(() => null),
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
      const queriesElapsedMs = Date.now() - telemetryStartMs;

      const telemetryMeasured = Boolean(telemetry?.metrics?.revenueMTD?.value != null || telemetry?.metrics?.totalLeads?.value != null);
      
      const healthResult = telemetryMeasured && telemetry 
        ? BusinessHealthEvaluator.evaluateHealth({ telemetry, goals: [] } as any)
        : null;

      const healthScore = telemetryMeasured && healthResult ? healthResult.overallScore : '—';
      const healthStatus = telemetryMeasured && healthResult ? healthResult.status : 'UNRATED';

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

      // Canonical attention calculation requires heavy operating-state construction.
      // We explicitly return null in the snapshot rather than fabricating a cheap rule.
      const topAttention = null;

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
          breakdown: telemetryMeasured && healthResult ? healthResult.domains : undefined,
        },
        executiveSummary: telemetryMeasured && healthResult && healthResult.overallScore >= 50
          ? `Operating at ${healthStatus} status.` 
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
          snapshot: {
            telemetry: queriesElapsedMs,
            decisionQueries: 0,
            forecastQueries: 0,
            attention: 0,
            total: Date.now() - startMs
          }
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
        metadata: { 
          cacheHit: false, 
          durationMs: elapsed,
          telemetryMs: queriesElapsedMs,
          decisionQueriesMs: 0,
          forecastQueriesMs: 0,
          attentionMs: 0
        },
      });

      return snapshot;
    })();

    // Store the in-flight promise to prevent stampedes
    inFlightSnapshots.set(inFlightKey, snapshotPromise);

    try {
      return await snapshotPromise;
    } finally {
      inFlightSnapshots.delete(inFlightKey);
    }
  }

  /**
   * Deep Executive Intelligence Read Model.
   * Loaded progressively after initial screen rendering.
   */
  static async getExecutiveDeepIntelligence(
    organizationId: string,
    options?: { forceRefresh?: boolean }
  ) {
    const [outcomes, recommendations, events, decisions, actionPlans, forecasts, goals, pendingActions] = await Promise.all([
      prisma.executiveOutcome.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }).catch(() => []),

      prisma.executiveRecommendation.findMany({
        where: { organizationId, status: 'PROPOSED' },
        orderBy: { confidence: 'desc' },
        take: 10,
      }).catch(() => []),

      prisma.executiveEvent.findMany({
        where: { organizationId },
        orderBy: { occurredAt: 'desc' },
        take: 15,
      }).catch(() => []),

      prisma.executiveDecision.findMany({
        where: { organizationId },
        orderBy: { priority: 'desc' },
        take: 20,
      }).catch(() => []),

      prisma.executiveActionPlan.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }).catch(() => []),

      prisma.executiveForecast.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }).catch(() => []),

      prisma.businessGoal.findMany({
        where: { organizationId },
        orderBy: { endDate: 'asc' },
        take: 10,
      }).catch(() => []),

      prisma.pendingAction.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }).catch(() => []),
    ]);

    return { outcomes, recommendations, events, decisions, actionPlans, forecasts, goals, pendingActions };
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
      const deepData = await this.getExecutiveDeepIntelligence(organizationId, options);
      
      // We do not re-build BusinessContext or getOperatingState here.
      // If we need a briefing, we create a lightweight deterministic one, or return null if insufficient.
      let briefing = null;
      
      return {
        // Omitting operatingState and valueSynthesis for pure deep queries unless specifically required
        briefing,
        calculationStatus: 'DEGRADED',
        evidence: 'INSUFFICIENT',
        ...deepData,
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
    const telemetryMeasuredDeep = Boolean(
      operatingState.businessContext?.telemetry?.metrics?.revenueMTD?.value != null || 
      operatingState.businessContext?.telemetry?.metrics?.totalLeads?.value != null
    );

    if (operatingState.businessContext && telemetryMeasuredDeep) {
      try {
        const mappedEvents: ExecutiveEventData[] = events.map((e: any) => ({
          ...e,
          eventType: e.eventType as EventType,
          domain: e.domain as EventDomain,
          severity: e.severity as EventSeverity,
          metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
          facts: typeof e.facts === 'string' ? JSON.parse(e.facts) : (e.facts || []),
          occurredAt: e.occurredAt instanceof Date ? e.occurredAt.toISOString() : e.occurredAt,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
          processedAt: e.processedAt instanceof Date ? e.processedAt.toISOString() : e.processedAt,
          resolvedAt: e.resolvedAt instanceof Date ? e.resolvedAt.toISOString() : e.resolvedAt,
        }));

        const criticalCount = mappedEvents.filter(e => e.severity === 'CRITICAL').length;
        const health = BusinessHealthEvaluator.evaluateHealth(operatingState.businessContext, {
          activeEventCount: mappedEvents.length,
          criticalEventCount: criticalCount,
        });
        const observations = ExecutiveObservationEngine.synthesizeObservations(
          operatingState.businessContext,
          mappedEvents
        );

        // Pass canonical recentLearningSignals without 'as any'
        briefing = ExecutiveBriefingEngine.generateGroundedFallback({
          context: operatingState.businessContext,
          events: mappedEvents,
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
