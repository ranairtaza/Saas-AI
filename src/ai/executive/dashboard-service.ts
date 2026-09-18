/**
 * Phase 47: Executive Dashboard Aggregation Service
 *
 * Provides a unified, single-query aggregation read model for the Executive Command Center.
 * Replaces multiple uncoordinated client API requests with a single cached/parallelized loader.
 * Guarantees zero side-effect writes during GET operations.
 */

import { prisma } from '../../lib/db';
import { ExecutiveOperatingSystemService } from './operating-state/service';
import { ExecutiveValueLayer } from './executive-value-layer';
import { ExecutiveBriefingEngine } from './briefing-engine';
import { BusinessHealthEvaluator } from './health-evaluator';
import { ExecutiveObservationEngine } from './observation-engine';

export interface ExecutiveDashboardReadModel {
  operatingState: any;
  valueSynthesis: any;
  briefing: any | null;
  outcomes: any[];
  recommendations: any[];
  events: any[];
  refreshedAt: string;
}

interface DashboardCacheEntry {
  data: ExecutiveDashboardReadModel;
  cachedAt: number;
}

const dashboardCache = new Map<string, DashboardCacheEntry>();
const DASHBOARD_CACHE_TTL_MS = 15_000; // 15-second fast read cache

export function invalidateDashboardCache(organizationId?: string): void {
  if (organizationId) {
    dashboardCache.delete(organizationId);
  } else {
    dashboardCache.clear();
  }
}

export class ExecutiveDashboardService {
  /**
   * Returns the complete, aggregated executive dashboard read model in a single call.
   */
  static async getDashboardReadModel(
    organizationId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ExecutiveDashboardReadModel> {
    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(organizationId);
      if (cached && Date.now() - cached.cachedAt < DASHBOARD_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 1. Fetch operating state (which already aggregates context, goals, decisions, forecasts)
    const operatingState = await ExecutiveOperatingSystemService.getOperatingState(organizationId, {
      forceRefresh: options?.forceRefresh,
    });

    // 2. Synthesize value layer from operating state (in-memory calculation, zero DB queries)
    const valueSynthesis = ExecutiveValueLayer.synthesize(operatingState);

    // 3. Parallel fetch of remaining executive entities using focused Prisma selects
    const [outcomes, recommendations, events] = await Promise.all([
      prisma.executiveOutcome.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }).catch(() => []),

      prisma.executiveRecommendation.findMany({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { priorityScore: 'desc' },
        take: 5,
      }).catch(() => []),

      prisma.executiveEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }).catch(() => []),
    ]);

    // 4. Synthesize executive briefing directly from the ALREADY-FETCHED businessContext (zero duplicate build)
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
          learningSignals: (operatingState as any).learningSignals || [],
        });
      } catch (e) {
        console.warn('[ExecutiveDashboardService] Briefing synthesis fallback:', e);
      }
    }

    const result: ExecutiveDashboardReadModel = {
      operatingState,
      valueSynthesis,
      briefing,
      outcomes,
      recommendations,
      events,
      refreshedAt: new Date().toISOString(),
    };

    dashboardCache.set(organizationId, {
      data: result,
      cachedAt: Date.now(),
    });

    return result;
  }
}
